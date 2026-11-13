// lib/loop-supervisor.js — Giám sát tiến trình cha từ BÊN NGOÀI process.
//
// Bối cảnh: watchdog cũ dùng worker_threads và gọi process.exit(1) trong
// worker — đã chứng minh là CHỈ giết worker, không giết process (audit
// docs/hang-audit-2026-11-13.md §3.1). Một tiến trình bị đóng băng không
// thể tự giết mình từ bên trong. Supervisor là một CHILD PROCESS riêng
// (child_process.fork từ server): nó poll GET /healthz của cha mỗi 2s;
// cha không trả lời 20s liên tiếp (sau 60s ân hạn) thì supervisor
// SIGKILL cha rồi tự thoát — Railway Restart Policy khởi động lại
// container. Poll qua HTTP /healthz (không phải IPC ping) nên còn bắt
// được cả trường hợp listener chết nhưng vòng lặp vẫn sống (lỗi
// room.io.close() ngày 2026-11-13).
//
// Cách chạy: node lib/loop-supervisor.js <parentPid> <port> [pollMs] [graceMs] [maxMissedMs] [timeoutMs]
// Thoát: 0 = đã SIGKILL cha, hoặc cha chết trước; 2 = tham số sai.
'use strict';

const http = require('http');
const {
  MissTracker,
  PING_INTERVAL_MS,
  MAX_MISSED_MS,
  GRACE_PERIOD_MS,
} = require('./loop-watchdog');

const DEFAULT_TIMEOUT_MS = 5000; // một lần poll /healthz tối đa 5s

function parseArgs(argv) {
  const parentPid = Number(argv[2]);
  const port = Number(argv[3]);
  if (!Number.isInteger(parentPid) || parentPid <= 0) return { error: 'parentPid phải là số nguyên dương' };
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return { error: 'port phải là 1-65535' };
  const num = (v, dflt) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : dflt;
  };
  return {
    parentPid,
    port,
    pollMs: num(argv[4], PING_INTERVAL_MS),
    graceMs: num(argv[5], GRACE_PERIOD_MS),
    maxMissedMs: num(argv[6], MAX_MISSED_MS),
    timeoutMs: num(argv[7], DEFAULT_TIMEOUT_MS),
  };
}

// process.kill(pid, 0) không gửi signal, chỉ kiểm tra pid còn tồn tại.
// EPERM = tồn tại nhưng không có quyền signal -> vẫn tính là còn sống.
function parentAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e && e.code === 'EPERM';
  }
}

function runSupervisor(cfg) {
  const tracker = new MissTracker({
    gracePeriodMs: cfg.graceMs,
    maxMissedMs: cfg.maxMissedMs,
    startedAt: Date.now(),
  });
  let inFlight = false; // chỉ 1 request /healthz tại một thời điểm
  let done = false;

  console.error(`[loop-supervisor] giám sát parent pid=${cfg.parentPid} qua /healthz 127.0.0.1:${cfg.port} mỗi ${cfg.pollMs}ms, SIGKILL sau ${cfg.maxMissedMs}ms không phản hồi (ân hạn ${cfg.graceMs}ms).`);

  function exitSelf(reason) {
    if (done) return;
    done = true;
    clearInterval(timer);
    console.error(`[loop-supervisor] thoát: ${reason}`);
    process.exit(0);
  }

  function checkMissed(now = Date.now()) {
    if (done) return;
    if (!parentAlive(cfg.parentPid)) {
      exitSelf(`parent pid=${cfg.parentPid} đã chết trước`);
      return;
    }
    if (tracker.shouldExit(now)) {
      done = true;
      clearInterval(timer);
      const missed = tracker.missedMs(now);
      console.error(`[loop-supervisor] parent pid=${cfg.parentPid} không trả /healthz ${missed}ms — SIGKILL để Railway restart.`);
      try {
        process.kill(cfg.parentPid, 'SIGKILL');
      } catch (e) {
        console.error(`[loop-supervisor] không SIGKILL được parent: ${e && e.message}`);
      }
      process.exit(0);
    }
  }

  function pollOnce() {
    if (done) return;
    if (!parentAlive(cfg.parentPid)) {
      exitSelf(`parent pid=${cfg.parentPid} đã chết trước`);
      return;
    }
    checkMissed();
    if (done || inFlight) return;
    inFlight = true;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      inFlight = false;
    };
    const req = http.get(
      { host: '127.0.0.1', port: cfg.port, path: '/healthz', timeout: cfg.timeoutMs },
      (res) => {
        res.resume();
        res.on('end', () => {
          settle();
          if (res.statusCode === 200) tracker.recordPong(Date.now());
          checkMissed();
        });
        res.on('error', () => {
          settle();
          checkMissed();
        });
      },
    );
    req.on('timeout', () => {
      req.destroy(new Error('[loop-supervisor] /healthz timeout'));
    });
    req.on('error', () => {
      settle();
      checkMissed();
    });
  }

  const timer = setInterval(pollOnce, cfg.pollMs);
  // 'disconnect': cha fork ra supervisor; khi cha chết, kênh IPC đóng.
  process.on('disconnect', () => exitSelf('kênh IPC với parent đã đóng'));
  process.on('SIGTERM', () => exitSelf('nhận SIGTERM'));
  process.on('SIGINT', () => exitSelf('nhận SIGINT'));
  pollOnce();
}

if (require.main === module) {
  const cfg = parseArgs(process.argv);
  if (cfg.error) {
    console.error(`[loop-supervisor] tham số sai: ${cfg.error}. Dùng: node loop-supervisor.js <parentPid> <port> [pollMs] [graceMs] [maxMissedMs] [timeoutMs]`);
    process.exit(2);
  }
  runSupervisor(cfg);
}

module.exports = { parseArgs, parentAlive, runSupervisor, DEFAULT_TIMEOUT_MS };
