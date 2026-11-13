// test/loop-watchdog.test.js — Test watchdog event loop:
// logic thuần (lag, đếm miss, ngưỡng, ân hạn, lag self-exit), /healthz,
// và tính trung thực của status (supervisor chết -> disabled).
// Ngưỡng test được rút ngắn qua opts/env; production vẫn dùng hằng số mặc định.
//
// LƯU Ý: 2 test "worker thật" của thiết kế cũ (worker_threads + exitMode
// 'notify') ĐÃ XÓA — cơ chế worker bị chứng minh là không giết được
// process (audit docs/hang-audit-2026-11-13.md §3.1) và đã thay bằng
// supervisor child process. Hành vi supervisor được test thật ở
// test/loop-supervisor.test.js (kể cả end-to-end SIGSTOP).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PING_INTERVAL_MS,
  MAX_MISSED_MS,
  GRACE_PERIOD_MS,
  LAG_EXIT_MS,
  computeLagMs,
  MissTracker,
  LagTracker,
  createLoopWatchdog,
} = require('../lib/loop-watchdog');
const { start } = require('../server');

// Đợi watchdog thành active (callback của server.listen() — nơi start
// watchdog — có thể chạy sau event 'listening', nên không assert ngay).
async function waitForActive(wd, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (wd.status !== 'active' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
  }
  return wd.status === 'active';
}

test('hằng số ngưỡng: poll 2s, miss 20s, ân hạn 60s, lag-exit 30s', () => {
  assert.equal(PING_INTERVAL_MS, 2000);
  assert.equal(MAX_MISSED_MS, 20000);
  assert.equal(GRACE_PERIOD_MS, 60000);
  assert.equal(LAG_EXIT_MS, 30000);
  assert.equal(MAX_MISSED_MS, PING_INTERVAL_MS * 10, '20s = 10 lần poll lỡ');
});

test('computeLagMs: đúng giờ hoặc sớm -> 0; trễ bao nhiêu tính bấy nhiêu', () => {
  assert.equal(computeLagMs(1000, 1000), 0);
  assert.equal(computeLagMs(1000, 950), 0, 'chạy sớm không tính lag âm');
  assert.equal(computeLagMs(1000, 1050), 50);
  assert.equal(computeLagMs(1000, 3000), 2000);
});

test('LagTracker: lag cập nhật từng nhịp, maxLag giữ giá trị lớn nhất', () => {
  const lag = new LagTracker({ intervalMs: 1000 });
  assert.equal(lag.recordTick(0, 100), 100);
  assert.equal(lag.lagMs, 100);
  assert.equal(lag.maxLagMs, 100);
  assert.equal(lag.recordTick(1000, 1010), 10);
  assert.equal(lag.lagMs, 10, 'lag hiện tại cập nhật theo nhịp mới');
  assert.equal(lag.maxLagMs, 100, 'max không tụt theo nhịp tốt');
  assert.equal(lag.recordTick(2000, 2500), 500);
  assert.equal(lag.maxLagMs, 500, 'max tăng khi có nhịp tệ hơn');
});

test('LagTracker: lag >= ngưỡng thì gọi onLagExit; dưới ngưỡng thì không', () => {
  const calls = [];
  const lag = new LagTracker({ intervalMs: 1000, lagExitMs: 100, onLagExit: (ms) => calls.push(ms) });
  lag.recordTick(0, 50);
  assert.equal(calls.length, 0, 'lag 50ms < ngưỡng 100ms thì không gọi');
  lag.recordTick(1000, 1150);
  assert.deepEqual(calls, [150], 'lag 150ms >= ngưỡng thì gọi 1 lần với đúng số ms');
});

test('LagTracker: lagExitMs 0 hoặc onLagExit null thì chỉ đo, không thoát', () => {
  const lag = new LagTracker({ intervalMs: 1000, lagExitMs: 0, onLagExit: () => { throw new Error('không được gọi'); } });
  assert.equal(lag.recordTick(0, 99999), 99999);
  const lag2 = new LagTracker({ intervalMs: 1000, lagExitMs: 100 });
  assert.equal(lag2.recordTick(0, 99999), 99999, 'không có onLagExit thì không làm gì');
});

test('MissTracker: 1 lần lỡ pong chưa đủ ngưỡng -> không exit', () => {
  const t = new MissTracker({ startedAt: 0 });
  t.recordPong(61000); // qua ân hạn 60s, vừa pong xong
  assert.equal(t.shouldExit(66000), false, 'lỡ 5s (2-3 ping) chưa exit');
  assert.equal(t.shouldExit(70500), false, 'lỡ 9,5s vẫn chưa exit');
});

test('MissTracker: lỡ đủ 20s liên tiếp sau ân hạn -> exit', () => {
  const t = new MissTracker({ startedAt: 0 });
  t.recordPong(61000);
  assert.equal(t.shouldExit(80999), false, 'lỡ 19,999s chưa đủ');
  assert.equal(t.shouldExit(81000), true, 'lỡ đúng 20s thì exit');
  assert.equal(t.missedMs(81000), 20000);
});

test('MissTracker: trong 60s ân hạn thì không exit dù đã lỡ quá 20s', () => {
  const t = new MissTracker({ startedAt: 0 });
  assert.equal(t.shouldExit(30000), false, 'khởi động 30s, lỡ 30s vẫn không exit');
  assert.equal(t.shouldExit(59999), false, '59,999s vẫn trong ân hạn');
  assert.equal(t.shouldExit(60000), true, 'hết ân hạn + lỡ >= 20s thì exit');
});

test('MissTracker: pong mới reset bộ đếm lỡ', () => {
  const t = new MissTracker({ startedAt: 0 });
  t.recordPong(70000);
  assert.equal(t.shouldExit(89000), false, 'lỡ 19s sau pong mới chưa exit');
  t.recordPong(89000);
  assert.equal(t.shouldExit(108000), false, 'pong lúc 89s reset, lỡ 19s chưa exit');
  assert.equal(t.shouldExit(109000), true, 'lỡ 20s sau pong cuối thì exit');
});

test('watchdog tắt (enabled: false) -> status disabled, lag vẫn là số', () => {
  const wd = createLoopWatchdog({ enabled: false });
  try {
    wd.start();
    assert.equal(wd.status, 'disabled');
    assert.equal(typeof wd.getLagMs(), 'number');
    assert.equal(typeof wd.getMaxLagMs(), 'number');
  } finally {
    wd.stop();
  }
});

test('watchdog start không có cổng /healthz -> status disabled, không báo active giả', () => {
  const wd = createLoopWatchdog();
  try {
    wd.start(); // không truyền port, supervisor không thể poll
    assert.equal(wd.status, 'disabled');
    assert.equal(wd.supervisorPid, null);
  } finally {
    wd.stop();
  }
});

test('GET /healthz (server thật qua start): có eventLoopLagMs, eventLoopLagMaxMs, watchdog=active + supervisor đang chạy', async () => {
  const { server, loopWatchdog } = start(0);
  try {
    await new Promise((r) => (server.listening ? r() : server.once('listening', r)));
    // LƯU Ý: callback của server.listen() (nơi start watchdog) có thể
    // chạy SAU event 'listening' — phải đợi status thành active, không
    // được assert ngay sau khi nghe 'listening'.
    assert.ok(await waitForActive(loopWatchdog), 'watchdog phải thành active sau khi listen');
    const port = server.address().port;
    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.ok, true);
    assert.equal(typeof json.eventLoopLagMs, 'number');
    assert.ok(json.eventLoopLagMs >= 0);
    assert.equal(typeof json.eventLoopLagMaxMs, 'number');
    assert.ok(json.eventLoopLagMaxMs >= json.eventLoopLagMs);
    assert.equal(json.watchdog, 'active');
    assert.ok(loopWatchdog.supervisorPid > 0, 'phải có supervisor child process đang chạy');
  } finally {
    loopWatchdog.stop();
    await new Promise((r) => server.close(r));
  }
});

test('supervisor chết -> status chuyển disabled (không giữ active giả)', async () => {
  const { server, loopWatchdog } = start(0);
  try {
    await new Promise((r) => (server.listening ? r() : server.once('listening', r)));
    assert.ok(await waitForActive(loopWatchdog), 'watchdog phải thành active sau khi listen');
    const pid = loopWatchdog.supervisorPid;
    assert.ok(pid && pid > 0, 'phải có supervisor pid');
    process.kill(pid, 'SIGKILL');
    const deadline = Date.now() + 5000;
    while (loopWatchdog.status === 'active' && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(loopWatchdog.status, 'disabled', 'supervisor chết thì status phải tụt xuống disabled');
    assert.equal(loopWatchdog.supervisorPid, null);
  } finally {
    loopWatchdog.stop();
    await new Promise((r) => server.close(r));
  }
});
