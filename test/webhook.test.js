// test/webhook.test.js — Test tương thích webhook cũ (TikFinity):
// POST /o/<game>/<username>/api/webhook với body dạng triggerTypeId như
// TikFinity gửi phải được game nhận và phản ánh vào state của room đó.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, fetchJson } = require('./helpers');

test('ve-avatar: webhook chat + gift + like kiểu TikFinity -> 200, state đổi', async () => {
  const t = await startTestServer();
  try {
    const base = '/o/ve-avatar/webhook_user';
    const chat = await fetchJson(t.base, `${base}/api/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        triggerTypeId: 11,
        userId: '111',
        nickname: 'WebhookChat',
        profilePictureUrl: 'https://example.com/a.jpg',
        content: 'xin chào',
      }),
    });
    assert.equal(chat.status, 200);

    const gift = await fetchJson(t.base, `${base}/api/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        triggerTypeId: 3,
        userId: '222',
        nickname: 'WebhookGift',
        profilePictureUrl: 'https://example.com/b.jpg',
        giftName: 'Hoa hồng',
        diamondCount: 5,
        repeatCount: 1,
      }),
    });
    assert.equal(gift.status, 200);

    const like = await fetchJson(t.base, `${base}/api/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggerTypeId: 7, userId: '333', nickname: 'WebhookLike', likeCount: 10 }),
    });
    assert.equal(like.status, 200);

    const state = await fetchJson(t.base, `${base}/api/state`);
    assert.equal(state.status, 200);
    // Quà vào hàng đợi vẽ của room này.
    assert.ok(JSON.stringify(state.json).includes('WebhookGift'), 'state phải thấy quà webhook');
  } finally {
    await stopTestServer(t);
  }
});

test('buong-giam: webhook gift kiểu TikFinity -> user xuất hiện trong state', async () => {
  const t = await startTestServer();
  try {
    const base = '/o/buong-giam/webhook_user';
    const gift = await fetchJson(t.base, `${base}/api/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        triggerTypeId: 3,
        userId: '444',
        nickname: 'WebhookGiam',
        profilePictureUrl: 'https://example.com/c.jpg',
        giftName: 'Kính râm',
        diamondCount: 10,
        repeatCount: 1,
      }),
    });
    assert.equal(gift.status, 200);
    const state = await fetchJson(t.base, `${base}/api/state`);
    assert.equal(state.status, 200);
    assert.ok(JSON.stringify(state.json).includes('WebhookGiam'), 'state phải thấy user tặng quà');
  } finally {
    await stopTestServer(t);
  }
});

test('thap-sang-ban-do: webhook chat/gift dạng {type,...} -> 200, state đổi', async () => {
  const t = await startTestServer();
  try {
    const base = '/o/thap-sang-ban-do/webhook_user';
    const chat = await fetchJson(t.base, `${base}/api/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'chat', user: 'WebhookMap', nickname: 'WebhookMap', text: 'Hà Nội' }),
    });
    assert.equal(chat.status, 200);
    const gift = await fetchJson(t.base, `${base}/api/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'gift', user: 'WebhookMap', nickname: 'WebhookMap', giftName: 'Hoa hồng', coins: 5 }),
    });
    assert.equal(gift.status, 200);
    const state = await fetchJson(t.base, `${base}/api/state`);
    assert.equal(state.status, 200);
    assert.ok(JSON.stringify(state.json).includes('WebhookMap'), 'state phải thấy event webhook');
  } finally {
    await stopTestServer(t);
  }
});

test('webhook của room A không lọt sang room B (qua đường HTTP)', async () => {
  const t = await startTestServer();
  try {
    await fetchJson(t.base, '/o/ve-avatar/phong_a/api/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        triggerTypeId: 3, userId: '555', nickname: 'ChiPhongA',
        giftName: 'Hoa hồng', diamondCount: 5, repeatCount: 1,
      }),
    });
    const stateB = await fetchJson(t.base, '/o/ve-avatar/phong_b/api/state');
    assert.equal(stateB.status, 200);
    assert.ok(!JSON.stringify(stateB.json).includes('ChiPhongA'), 'room B không được thấy event của room A');
  } finally {
    await stopTestServer(t);
  }
});
