// test/rooms.test.js — Test cô lập room: 2 room cùng game, event gửi vào
// room này không lọt sang room kia (state, engine, dataDir đều tách biệt).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');

const GIFT = {
  triggerTypeId: 3,
  userId: '999001',
  nickname: 'KiemTraCoLap',
  uniqueId: 'kiemtra_colap',
  profilePictureUrl: 'https://example.com/a.jpg',
  giftName: 'Hoa hồng',
  diamondCount: 5,
  repeatCount: 1,
};

test('ve-avatar: gift vào room A không xuất hiện ở room B', async () => {
  const t = await startTestServer();
  try {
    const roomA = await t.rooms.getOrCreate('ve-avatar', 'streamer_a');
    const roomB = await t.rooms.getOrCreate('ve-avatar', 'streamer_b');
    assert.notEqual(roomA.engine, roomB.engine);
    assert.notEqual(roomA.io, roomB.io);
    assert.notEqual(roomA.dataDir, roomB.dataDir);

    const r = await t.rooms.dispatchWebhook(roomA, GIFT);
    assert.equal(r.status, 200);

    const stateA = await t.rooms.getState(roomA);
    const stateB = await t.rooms.getState(roomB);
    assert.ok(JSON.stringify(stateA.body).includes('KiemTraCoLap'), 'room A phải thấy event');
    assert.ok(!JSON.stringify(stateB.body).includes('KiemTraCoLap'), 'room B không được thấy event');
  } finally {
    await stopTestServer(t);
  }
});

test('buong-giam: gift vào room A không xuất hiện ở room B', async () => {
  const t = await startTestServer();
  try {
    const roomA = await t.rooms.getOrCreate('buong-giam', 'streamer_a');
    const roomB = await t.rooms.getOrCreate('buong-giam', 'streamer_b');
    assert.notEqual(roomA.engine, roomB.engine);

    const r = await t.rooms.dispatchWebhook(roomA, GIFT);
    assert.equal(r.status, 200);

    const stateA = await t.rooms.getState(roomA);
    const stateB = await t.rooms.getState(roomB);
    assert.ok(JSON.stringify(stateA.body).includes('KiemTraCoLap'), 'room A phải thấy user');
    assert.ok(!JSON.stringify(stateB.body).includes('KiemTraCoLap'), 'room B không được thấy user');
  } finally {
    await stopTestServer(t);
  }
});

test('thap-sang-ban-do: chat vào room A không xuất hiện ở room B', async () => {
  const t = await startTestServer();
  try {
    const roomA = await t.rooms.getOrCreate('thap-sang-ban-do', 'streamer_a');
    const roomB = await t.rooms.getOrCreate('thap-sang-ban-do', 'streamer_b');
    assert.notEqual(roomA.engine, roomB.engine);

    const chat = {
      type: 'chat',
      user: 'KiemTraCoLap',
      nickname: 'KiemTraCoLap',
      text: 'Hà Nội đẹp quá',
      avatar: 'https://example.com/a.jpg',
    };
    const r = await t.rooms.dispatchWebhook(roomA, chat);
    assert.equal(r.status, 200);

    const stateA = await t.rooms.getState(roomA);
    const stateB = await t.rooms.getState(roomB);
    assert.ok(JSON.stringify(stateA.body).includes('KiemTraCoLap'), 'room A phải thấy chat');
    assert.ok(!JSON.stringify(stateB.body).includes('KiemTraCoLap'), 'room B không được thấy chat');
  } finally {
    await stopTestServer(t);
  }
});

test('getOrCreate cùng key trả đúng 1 room; username chuẩn hóa (bỏ @, chữ thường)', async () => {
  const t = await startTestServer();
  try {
    const r1 = await t.rooms.getOrCreate('ve-avatar', '@Streamer_X');
    const r2 = await t.rooms.getOrCreate('ve-avatar', 'streamer_x');
    assert.equal(r1, r2);
    assert.equal(r1.username, 'streamer_x');
    assert.equal(t.rooms.rooms.size, 1);
  } finally {
    await stopTestServer(t);
  }
});

test('giới hạn số room: vượt maxRooms thì báo lỗi ROOM_FULL', async () => {
  const t = await startTestServer({ maxRooms: 2 });
  try {
    await t.rooms.getOrCreate('ve-avatar', 'mot');
    await t.rooms.getOrCreate('ve-avatar', 'hai');
    await assert.rejects(
      t.rooms.getOrCreate('ve-avatar', 'ba'),
      (e) => e.code === 'ROOM_FULL',
    );
  } finally {
    await stopTestServer(t);
  }
});
