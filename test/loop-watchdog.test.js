// test/loop-watchdog.test.js — Test watchdog event loop:
// logic thuần (lag, đếm miss, ngưỡng, ân hạn), worker thật với exit stub
// (exitMode 'notify' — KHÔNG bao giờ kill test runner), và /healthz.
// Ngưỡng test được rút ngắn qua opts; production vẫn dùng hằng số mặc định.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PING_INTERVAL_MS,
  MAX_MISSED_MS,
  GRACE_PERIOD_MS,
  computeLagMs,
  MissTracker,
  LagTracker,
  createLoopWatchdog,
} = require('../lib/loop-watchdog');
const { start } = require('../server');

test('hằng số ngưỡng: ping 2s, miss 20s, ân hạn 60s', () => {
  assert.equal(PING_INTERVAL_MS, 2000);
  assert.equal(MAX_MISSED_MS, 20000);
  assert.equal(GRACE_PERIOD_MS, 60000);
  assert.equal(MAX_MISSED_MS, PING_INTERVAL_MS * 10, '20s = 10 ping lỡ');
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

test('worker thật: main không trả pong -> onUnresponsive được gọi đúng 1 lần (exit stub)', async () => {
  let calls = 0;
  const wd = createLoopWatchdog({
    exitMode: 'notify', // test: báo về main thay vì process.exit(1)
    respondToPings: false, // giả lập main thread bị chặn
    pingIntervalMs: 200,
    maxMissedMs: 600,
    gracePeriodMs: 300,
    onUnresponsive: () => { calls += 1; },
  });
  try {
    wd.start();
    assert.equal(wd.status, 'active');
    const deadline = Date.now() + 5000;
    while (calls === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(calls, 1, 'phải gọi stub đúng 1 lần sau ngưỡng, không gọi lặp');
  } finally {
    wd.stop();
  }
});

test('worker thật: main trả pong đều -> không gọi onUnresponsive', async () => {
  let calls = 0;
  const wd = createLoopWatchdog({
    exitMode: 'notify',
    pingIntervalMs: 200,
    maxMissedMs: 600,
    gracePeriodMs: 300,
    onUnresponsive: () => { calls += 1; },
  });
  try {
    wd.start();
    assert.equal(wd.status, 'active');
    await new Promise((r) => setTimeout(r, 1500));
    assert.equal(calls, 0, 'pong đều thì không được báo treo');
  } finally {
    wd.stop();
  }
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

test('GET /healthz (server thật qua start): có eventLoopLagMs, eventLoopLagMaxMs, watchdog=active', async () => {
  const { server, loopWatchdog } = start(0);
  try {
    await new Promise((r) => (server.listening ? r() : server.once('listening', r)));
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
  } finally {
    loopWatchdog.stop();
    await new Promise((r) => server.close(r));
  }
});
