// lib/loop-watchdog.js — Giám sát event loop: phát hiện app treo lặng.
//
// Bối cảnh: app trên Railway treo lặng 3 lần (2026-11-13 ~02:35, ~08:21,
// ~09:19): mọi route trả 502, không stack trace, không OOM. Nguyên nhân
// thật là RoomManager.destroy() gọi room.io.close() đóng luôn HTTP server
// chung (đã sửa ở 7c5e390) — nhưng watchdog cũ cũng lỗi thiết kế nên
// không cứu được lần nào.
//
// Thiết kế cũ (commit 6fbbccc, ĐÃ BỎ): worker_threads ping main, worker
// gọi process.exit(1) khi main không pong 20s. Audit chứng minh
// process.exit() trong worker CHỈ giết worker, không giết process
// (docs/hang-audit-2026-11-13.md §3.1) — watchdog "active" nhưng không
// thể giết process đóng băng.
//
// Thiết kế mới (2026-11-13):
//  1. SUPERVISOR (lib/loop-supervisor.js): child process riêng, poll
//     GET /healthz của cha mỗi 2s; cha không trả lời 20s liên tiếp (sau
//     60s ân hạn) thì SIGKILL cha rồi tự thoát — Railway restart
//     container. Poll qua HTTP nên bắt được cả listener chết lẫn loop
//     đóng băng. Supervisor tự thoát khi cha chết trước.
//  2. LAG SELF-EXIT (Fix 3 của audit): LagTracker trên main thread —
//     nếu một nhịp đo lag >= 30s thì process.exit(1) NGAY TRÊN MAIN
//     THREAD (giết được process). Chỉ bắt loop CHẬM nặng, không bắt
//     đóng băng cứng (loop đóng băng thì tick không chạy) — đóng băng
//     cứng là việc của supervisor.
//
// Ngưỡng 20s + ân hạn 60s là cố ý: thà bỏ sót một lần treo còn hơn
// kill nhầm một room đang live vì false positive.
'use strict';

const path = require('path');
const { fork } = require('child_process');

const PING_INTERVAL_MS = 2000; // supervisor poll /healthz mỗi 2s
const MAX_MISSED_MS = 20000; // không trả /healthz 20s liên tiếp -> coi là treo
const GRACE_PERIOD_MS = 60000; // 60s đầu sau khởi động không kill
const LAG_CHECK_INTERVAL_MS = 1000; // đo độ trễ event loop mỗi 1s
const LAG_EXIT_MS = 30000; // một nhịp lag >= 30s -> main thread tự exit(1)
const SUPERVISOR_HEALTHZ_TIMEOUT_MS = 5000; // một lần poll /healthz tối đa 5s

function parseEnvInt(name, dflt) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}

// ---- Phần thuần (test được, không phụ thuộc process/thread) ----

// Độ trễ của một lần hẹn giờ: hẹn lúc `expected`, chạy thật lúc `actual`.
// Chạy sớm (actual < expected) tính là 0, không âm.
function computeLagMs(expected, actual) {
  return Math.max(0, actual - expected);
}

// Đếm số mili-giây đã trôi qua kể từ lần pong cuối; quyết định có nên kill.
class MissTracker {
  constructor({ gracePeriodMs = GRACE_PERIOD_MS, maxMissedMs = MAX_MISSED_MS, startedAt = Date.now() } = {}) {
    this.gracePeriodMs = gracePeriodMs;
    this.maxMissedMs = maxMissedMs;
    this.startedAt = startedAt;
    this.lastPongAt = startedAt;
  }

  recordPong(now = Date.now()) {
    this.lastPongAt = now;
  }

  missedMs(now = Date.now()) {
    return now - this.lastPongAt;
  }

  shouldExit(now = Date.now()) {
    if (now - this.startedAt < this.gracePeriodMs) return false;
    return this.missedMs(now) >= this.maxMissedMs;
  }
}

// Đo độ trễ event loop trên main thread bằng độ lệch của setInterval.
// onLagExit (nếu có): gọi khi một nhịp lag >= lagExitMs. Đây là đường
// thoát cho loop CHẬM nặng — chạy trên main thread nên exit được process.
// Mặc định null = chỉ đo, không thoát (an toàn khi dùng trong test).
class LagTracker {
  constructor({ intervalMs = LAG_CHECK_INTERVAL_MS, lagExitMs = LAG_EXIT_MS, onLagExit = null } = {}) {
    this.intervalMs = intervalMs;
    this.lagExitMs = lagExitMs;
    this.onLagExit = onLagExit;
    this.lagMs = 0;
    this.maxLagMs = 0;
    this.timer = null;
  }

  recordTick(expected, actual) {
    const lag = computeLagMs(expected, actual);
    this.lagMs = lag;
    if (lag > this.maxLagMs) this.maxLagMs = lag;
    if (this.lagExitMs > 0 && lag >= this.lagExitMs && typeof this.onLagExit === 'function') {
      this.onLagExit(lag);
    }
    return lag;
  }

  start() {
    if (this.timer) return;
    let expected = Date.now() + this.intervalMs;
    this.timer = setInterval(() => {
      const actual = Date.now();
      this.recordTick(expected, actual);
      // Neo lại mốc hẹn theo lúc chạy thật: đo độ trễ từng nhịp,
      // không để độ lệch cộng dồn qua nhiều nhịp.
      expected = actual + this.intervalMs;
    }, this.intervalMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

// ---- Nhánh main: tạo handle, start/stop từ server.js ----

function createLoopWatchdog(opts = {}) {
  const lag = new LagTracker({
    intervalMs: opts.lagCheckIntervalMs ?? LAG_CHECK_INTERVAL_MS,
    lagExitMs: opts.lagExitMs ?? parseEnvInt('LOOP_WATCHDOG_LAG_EXIT_MS', LAG_EXIT_MS),
    onLagExit: null, // chỉ gắn khi start() và watchdog được bật (xem dưới)
  });
  let supervisor = null;
  let started = false;

  const handle = {
    status: 'disabled',
    get supervisorPid() { return supervisor ? supervisor.pid : null; },
    getLagMs: () => lag.lagMs,
    getMaxLagMs: () => lag.maxLagMs,
    start,
    stop,
  };

  // port: cổng HTTP mà supervisor poll /healthz (server.js truyền
  // server.address().port sau khi listen). Không có port thì supervisor
  // không thể kiểm tra -> status giữ 'disabled', không báo active giả.
  function start(port) {
    if (started) return handle;
    started = true;
    lag.start();
    const enabled = opts.enabled !== false && process.env.LOOP_WATCHDOG_DISABLED !== '1';
    if (!enabled) {
      handle.status = 'disabled';
      return handle;
    }
    // Fix 3: loop chậm nặng -> main thread tự exit (giết được process).
    lag.onLagExit = (lagMs) => {
      console.error(`[loop-watchdog] event loop lag ${lagMs}ms >= ${lag.lagExitMs}ms — thoát để Railway restart.`);
      process.exit(1);
    };
    const p = Number(port ?? opts.port);
    if (!Number.isInteger(p) || p <= 0 || p > 65535) {
      console.warn('[loop-watchdog] không biết cổng /healthz — supervisor không khởi động, chỉ đo lag + lag self-exit.');
      handle.status = 'disabled';
      return handle;
    }
    try {
      const pollMs = opts.pollIntervalMs ?? parseEnvInt('LOOP_SUPERVISOR_POLL_MS', PING_INTERVAL_MS);
      const graceMs = opts.gracePeriodMs ?? parseEnvInt('LOOP_SUPERVISOR_GRACE_MS', GRACE_PERIOD_MS);
      const maxMissedMs = opts.maxMissedMs ?? parseEnvInt('LOOP_SUPERVISOR_MAX_MISSED_MS', MAX_MISSED_MS);
      const timeoutMs = opts.healthzTimeoutMs ?? parseEnvInt('LOOP_SUPERVISOR_HEALTHZ_TIMEOUT_MS', SUPERVISOR_HEALTHZ_TIMEOUT_MS);
      supervisor = fork(path.join(__dirname, 'loop-supervisor.js'), [
        String(process.pid), String(p), String(pollMs), String(graceMs), String(maxMissedMs), String(timeoutMs),
      ], { silent: false });
      // Không giữ parent sống vì supervisor: parent thoát bình thường thì
      // supervisor tự thoát khi phát hiện parent chết / IPC đóng.
      supervisor.unref();
      supervisor.on('error', (err) => {
        console.warn('[loop-watchdog] supervisor lỗi:', err && err.message);
      });
      supervisor.on('exit', (code, signal) => {
        supervisor = null;
        if (handle.status === 'active') {
          handle.status = 'disabled';
          console.warn(`[loop-watchdog] supervisor đã dừng (code ${code}, signal ${signal}) — watchdog tắt.`);
        }
      });
      handle.status = 'active';
    } catch (e) {
      console.warn('[loop-watchdog] không khởi động được supervisor:', e && e.message);
      handle.status = 'disabled';
    }
    return handle;
  }

  function stop() {
    lag.stop();
    lag.onLagExit = null;
    if (supervisor) {
      const s = supervisor;
      supervisor = null;
      try { s.kill('SIGTERM'); } catch {}
    }
    started = false;
    handle.status = 'disabled';
    return handle;
  }

  return handle;
}

module.exports = {
  PING_INTERVAL_MS,
  MAX_MISSED_MS,
  GRACE_PERIOD_MS,
  LAG_CHECK_INTERVAL_MS,
  LAG_EXIT_MS,
  SUPERVISOR_HEALTHZ_TIMEOUT_MS,
  computeLagMs,
  MissTracker,
  LagTracker,
  createLoopWatchdog,
};
