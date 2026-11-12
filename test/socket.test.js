// test/socket.test.js — Test Socket.io thật: client nối vào đúng path của
// room, nhận được state-update của room đó; 2 room khác nhau không nhận
// chéo state của nhau.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const { startTestServer, stopTestServer } = require('./helpers');

// Nối socket và gom mọi state-update ngay từ lúc tạo (kể cả event phát
// ngay khi kết nối) — tránh mất event vì đăng ký listener muộn.
function trackSocket(base, game, username) {
  const states = [];
  const socket = io(base, {
    path: `/o/${game}/${username}/socket.io`,
    timeout: 5000,
    reconnection: false,
  });
  socket.on('state-update', (st) => states.push(st));
  const connected = new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('timeout khi nối socket')), 6000);
  });
  return { socket, states, connected };
}

function waitFor(pred, ms = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (pred()) return resolve(true);
      if (Date.now() - start > ms) return reject(new Error('timeout chờ điều kiện'));
      setTimeout(tick, 50);
    };
    tick();
  });
}

test('socket: client nối room ve-avatar nhận state-update của đúng room', async () => {
  const t = await startTestServer();
  try {
    const room = await t.rooms.getOrCreate('ve-avatar', 'socket_user');
    const { socket, states, connected } = trackSocket(t.base, 've-avatar', 'socket_user');
    await connected;
    await waitFor(() => states.length > 0);
    assert.equal(states[0].proto, 6);
    assert.equal(room.overlayClients, 1);
    socket.disconnect();
    await waitFor(() => room.overlayClients === 0);
  } finally {
    await stopTestServer(t);
  }
});

test('socket: 2 room cùng game, state-update không lọt chéo', async () => {
  const t = await startTestServer();
  try {
    const roomA = await t.rooms.getOrCreate('ve-avatar', 'sock_a');
    const roomB = await t.rooms.getOrCreate('ve-avatar', 'sock_b');
    const a = trackSocket(t.base, 've-avatar', 'sock_a');
    const b = trackSocket(t.base, 've-avatar', 'sock_b');
    await Promise.all([a.connected, b.connected]);
    assert.equal(roomA.overlayClients, 1);
    assert.equal(roomB.overlayClients, 1);
    // Xóa state lúc mới nối, chỉ tính state sau khi gửi gift vào room A.
    a.states.length = 0;
    b.states.length = 0;

    await t.rooms.dispatchWebhook(roomA, {
      triggerTypeId: 3, userId: '888', nickname: 'SocketChiA',
      giftName: 'Hoa hồng', diamondCount: 5, repeatCount: 1,
    });
    await waitFor(() => a.states.some((s) => JSON.stringify(s).includes('SocketChiA')));
    // Đợi thêm một nhịp để chắc client B không nhận gì muộn.
    await new Promise((r) => setTimeout(r, 500));
    assert.equal(b.states.length, 0, 'client B không được nhận state của room A');
    a.socket.disconnect();
    b.socket.disconnect();
  } finally {
    await stopTestServer(t);
  }
});
