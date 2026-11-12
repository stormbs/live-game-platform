// test/routes.test.js — Test route của platform: landing, healthz, tạo room,
// overlay 200 đúng game, dashboard, trạng thái room, game không tồn tại.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');

test('GET / trả 200, là trang nhập TikTok ID', async () => {
  const t = await startTestServer();
  try {
    const { status, text } = await fetchJson(t.base, '/');
    assert.equal(status, 200);
    assert.ok(text.includes('TikTok'), 'landing phải nhắc tới TikTok');
    assert.ok(text.includes('ve-avatar'), 'landing phải liệt kê game Vẽ Avatar');
  } finally {
    await stopTestServer(t);
  }
});

test('GET /healthz trả 200 { ok: true }', async () => {
  const t = await startTestServer();
  try {
    const { status, json } = await fetchJson(t.base, '/healthz');
    assert.equal(status, 200);
    assert.equal(json.ok, true);
  } finally {
    await stopTestServer(t);
  }
});

test('POST /api/rooms tạo room, trả link overlay đúng định dạng', async () => {
  const t = await startTestServer();
  try {
    const { status, json } = await fetchJson(t.base, '/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: 'buong-giam', username: '@Duong_Tank' }),
    });
    assert.equal(status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.overlayUrl, '/o/buong-giam/duong_tank');
    assert.equal(json.roomUrl, '/room/buong-giam/duong_tank');
    assert.equal(json.username, 'duong_tank');
  } finally {
    await stopTestServer(t);
  }
});

test('POST /api/rooms với game không tồn tại -> 400; username rỗng -> 400', async () => {
  const t = await startTestServer();
  try {
    const bad = await fetchJson(t.base, '/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: 'game-la', username: 'ai_do' }),
    });
    assert.equal(bad.status, 400);
    const badUser = await fetchJson(t.base, '/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: 've-avatar', username: '!!!' }),
    });
    assert.equal(badUser.status, 400);
  } finally {
    await stopTestServer(t);
  }
});

test('GET /o/:game/:username trả 200 đúng game + Socket.io đã viết lại theo prefix room', async () => {
  const t = await startTestServer();
  try {
    for (const game of ['ve-avatar', 'buong-giam', 'thap-sang-ban-do']) {
      const { status, text } = await fetchJson(t.base, `/o/${game}/streamer_route`);
      assert.equal(status, 200, `overlay ${game} phải trả 200`);
      assert.ok(text.length > 500, `overlay ${game} phải có nội dung`);
      // ve-avatar + buong-giam nối Socket.io; bản đồ dùng SSE.
      const expected = game === 'thap-sang-ban-do'
        ? `/o/${game}/streamer_route/api/stream`
        : `/o/${game}/streamer_route/socket.io`;
      assert.ok(
        text.includes(expected),
        `overlay ${game} phải nối đúng dữ liệu theo prefix room (${expected})`,
      );
    }
  } finally {
    await stopTestServer(t);
  }
});

test('GET /room/:game/:username trả 200 (dashboard streamer)', async () => {
  const t = await startTestServer();
  try {
    for (const game of ['ve-avatar', 'buong-giam', 'thap-sang-ban-do']) {
      const { status, text } = await fetchJson(t.base, `/room/${game}/streamer_dash`);
      assert.equal(status, 200, `dashboard ${game} phải trả 200`);
      assert.ok(text.length > 500);
    }
  } finally {
    await stopTestServer(t);
  }
});

test('GET /o/game-khong-ton-tai/x trả 400; GET /api/rooms/:game/:username/status của room chưa có -> exists false', async () => {
  const t = await startTestServer();
  try {
    const bad = await fetchJson(t.base, '/o/game-la/ai_do');
    assert.equal(bad.status, 400);
    const st = await fetchJson(t.base, '/api/rooms/ve-avatar/chua_co_room/status');
    assert.equal(st.status, 200);
    assert.equal(st.json.exists, false);
  } finally {
    await stopTestServer(t);
  }
});
