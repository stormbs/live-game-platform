// lib/loop-watchdog.js — Giám sát event loop: phát hiện app treo lặng.
//
// Bối cảnh: app trên Railway treo lặng 2 lần (2026-11-13 ~02:35 và ~08:21):
// mọi route trả 502 "Application failed to respond", không stack trace,
// không OOM, không lỗi trong log. Healthcheck /healthz + Restart Policy
// của Railway KHÔNG tự khởi động lại sau >1h treo — lần nào cũng phải
// Restart tay trên dashboard.
//
// Vì setInterval trên main thread cũng đứng im khi event loop bị chặn,
// việc phát hiện PHẢI chạy trên một worker thread riêng (worker_threads):
// worker ping main mỗi 2s, main trả pong ngay. Worker không nhận được
// pong 20s liên tiếp (sau 60s ân hạn từ lúc khởi động) thì ép
// process.exit(1) để Railway restart container (Restart Policy On Failure).
//
// Ngưỡng 20s + ân hạn 60s là cố ý: thà bỏ sót một lần treo còn hơn
// kill nhầm một room đang live vì false positive.
'use strict';

const PING_INTERVAL_MS = 2000; // worker ping main mỗi 2s
const MAX_MISSED_MS = 20000; // không pong 20s liên tiếp (10 ping) -> coi là treo
const GRACE_PERIOD_MS = 60000; // 60s đầu sau khởi động không exit
const LAG_CHECK_INTERVAL_MS = 1000; // đo độ trễ event loop mỗi 1s

let workerThreads = null;
try {
  workerThreads = require('worker_threads');
} catch {
  workerThreads = null; // môi trường không có worker_threads -> chạy không watchdog
}

// ---- Phần thuần (test được, không phụ thuộc thread) ----

// Độ trễ của một lần hẹn giờ: hẹn lúc `expected`, chạy thật lúc `actual`.
// Chạy sớm (actual < expected) tính là 0, không âm.
function computeLagMs(expected, actual) {
  return Math.max(0, actual - expected);
}

// Đếm số mili-giây đã trôi qua kể từ lần pong cuối; quyết định có nên exit.
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
class LagTracker {
  constructor({ intervalMs = LAG_CHECK_INTERVAL_MS } = {}) {
    this.intervalMs = intervalMs;
    this.lagMs = 0;
    this.maxLagMs = 0;
    this.timer = null;
  }

  recordTick(expected, actual) {
    const lag = computeLagMs(expected, actual);
    this.lagMs = lag;
    if (lag > this.maxLagMs) this.maxLagMs = lag;
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

// ---- Nhánh worker: chạy khi file này được load trong worker thread ----

function runWorkerLoop() {
  const { parentPort, workerData } = workerThreads;
  const data = workerData || {};
  const tracker = new MissTracker({
    gracePeriodMs: data.gracePeriodMs ?? GRACE_PERIOD_MS,
    maxMissedMs: data.maxMissedMs ?? MAX_MISSED_MS,
    startedAt: Date.now(),
  });
  const pingIntervalMs = data.pingIntervalMs ?? PING_INTERVAL_MS;
  // 'exit' (mặc định): ép process.exit(1) để Railway restart.
  // 'notify' (chỉ dùng cho test): gửi message về main thay vì exit,
  // để test stub được hành vi exit mà không kill test runner.
  const exitMode = data.exitMode || 'exit';

  parentPort.on('message', (msg) => {
    if (msg && msg.type === 'pong') tracker.recordPong(Date.now());
  });

  const timer = setInterval(() => {
    parentPort.postMessage({ type: 'ping', at: Date.now() });
    if (tracker.shouldExit(Date.now())) {
      clearInterval(timer);
      if (exitMode === 'notify') {
        parentPort.postMessage({ type: 'unresponsive', missedMs: tracker.missedMs(Date.now()) });
      } else {
        // Main thread đã không phản hồi quá ngưỡng: ép thoát để
        // Railway restart container.
        process.exit(1);
      }
    }
  }, pingIntervalMs);
}

if (workerThreads && !workerThreads.isMainThread) {
  runWorkerLoop();
}

// ---- Nhánh main: tạo handle, start/stop từ server.js ----

function createLoopWatchdog(opts = {}) {
  const lag = new LagTracker({ intervalMs: opts.lagCheckIntervalMs ?? LAG_CHECK_INTERVAL_MS });
  let worker = null;
  let started = false;

  const handle = {
    status: 'disabled',
    getLagMs: () => lag.lagMs,
    getMaxLagMs: () => lag.maxLagMs,
    start,
    stop,
  };

  function start() {
    if (started) return handle;
    started = true;
    lag.start();
    const enabled = opts.enabled !== false && process.env.LOOP_WATCHDOG_DISABLED !== '1';
    if (!enabled || !workerThreads) {
      if (!workerThreads) {
        console.warn('[loop-watchdog] worker_threads không khả dụng — watchdog tắt, chỉ đo lag.');
      }
      handle.status = 'disabled';
      return handle;
    }
    try {
      const { Worker } = workerThreads;
      worker = new Worker(__filename, {
        workerData: {
          exitMode: opts.exitMode || 'exit',
          pingIntervalMs: opts.pingIntervalMs ?? PING_INTERVAL_MS,
          maxMissedMs: opts.maxMissedMs ?? MAX_MISSED_MS,
          gracePeriodMs: opts.gracePeriodMs ?? GRACE_PERIOD_MS,
        },
      });
      worker.on('message', (msg) => {
        if (!msg) return;
        if (msg.type === 'ping' && opts.respondToPings !== false) {
          worker.postMessage({ type: 'pong', at: Date.now() });
        } else if (msg.type === 'unresponsive' && typeof opts.onUnresponsive === 'function') {
          // Chỉ xảy ra ở exitMode 'notify' (test): main còn sống nên
          // mới nhận được message này; production thì worker đã exit(1).
          opts.onUnresponsive(msg);
        }
      });
      worker.on('error', (err) => {
        console.warn('[loop-watchdog] worker lỗi:', err && err.message);
      });
      worker.on('exit', (code) => {
        if (handle.status === 'active') {
          handle.status = 'disabled';
          console.warn(`[loop-watchdog] worker đã dừng (code ${code}) — watchdog tắt.`);
        }
      });
      handle.status = 'active';
    } catch (e) {
      console.warn('[loop-watchdog] không khởi động được worker:', e && e.message);
      handle.status = 'disabled';
    }
    return handle;
  }

  function stop() {
    lag.stop();
    if (worker) {
      const w = worker;
      worker = null;
      w.terminate().catch(() => {});
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
  computeLagMs,
  MissTracker,
  LagTracker,
  createLoopWatchdog,
};
