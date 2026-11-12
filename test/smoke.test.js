// test/smoke.test.js — Smoke test: khởi động server thật, tải trang chính
// và một URL overlay. Chạy nhanh, bắt lỗi khởi động (port, require, engine).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');

test('smoke: server khởi động, GET / và GET /o/buong-giam/smoke đều 200', async () => {
  const t = await startTestServer();
  try {
    const home = await fetchJson(t.base, '/');
    assert.equal(home.status, 200);
    assert.ok(home.text.includes('Live Game'));

    const overlay = await fetchJson(t.base, '/o/buong-giam/smoke');
    assert.equal(overlay.status, 200);
    assert.ok(overlay.text.length > 1000);

    const health = await fetchJson(t.base, '/healthz');
    assert.equal(health.status, 200);
    assert.equal(health.json.ok, true);
    assert.equal(health.json.rooms, 1);
  } finally {
    await stopTestServer(t);
  }
});
