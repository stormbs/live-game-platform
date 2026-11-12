// test/adapter.test.js — Unit test adapter TikTok -> game (lib/tiktok.js).
// Kiểm chứng: đủ 5 loại event (chat/gift/like/follow/share) map đúng
// triggerTypeId + type, avatar URL lấy đúng, số xu quà chỉ lấy số thật
// (không bịa), quà streak chưa chốt thì bỏ qua.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { toWebhookEvent, extractUser } = require('../lib/tiktok');

const GAMES = ['ve-avatar', 'buong-giam', 'thap-sang-ban-do'];

function sampleUser() {
  return {
    uniqueId: 'nguoi_xem_1',
    nickname: 'Người Xem 1',
    userId: '123456',
    avatarThumb: { urls: ['https://example.com/avatar-thumb.jpg'] },
    avatarMedium: { urls: ['https://example.com/avatar-medium.jpg'] },
  };
}

for (const game of GAMES) {
  test(`[${game}] chat -> triggerTypeId 11, type chat, đúng nội dung và avatar`, () => {
    const ev = toWebhookEvent(game, 'chat', { user: sampleUser(), comment: 'xin chào cả nhà' });
    assert.equal(ev.triggerTypeId, 11);
    assert.equal(ev.type, 'chat');
    assert.equal(ev.content, 'xin chào cả nhà');
    assert.equal(ev.nickname, 'Người Xem 1');
    assert.equal(ev.profilePictureUrl, 'https://example.com/avatar-medium.jpg'); // ưu tiên avatarMedium hơn avatarThumb
    assert.equal(ev.uniqueId, 'nguoi_xem_1');
  });

  test(`[${game}] gift -> triggerTypeId 3, đúng tên quà + số xu thật`, () => {
    const ev = toWebhookEvent(game, 'gift', {
      user: sampleUser(),
      giftId: '5655',
      giftDetails: { giftName: 'Hoa hồng', giftType: 0 },
      extendedGiftInfo: { diamondCount: 5, name: 'Hoa hồng' },
      repeatCount: 3,
      repeatEnd: true,
    });
    assert.equal(ev.triggerTypeId, 3);
    assert.equal(ev.type, 'gift');
    assert.equal(ev.giftName, 'Hoa hồng');
    assert.equal(ev.diamondCount, 5);
    assert.equal(ev.coins, 5);
    assert.equal(ev.repeatCount, 3);
  });

  test(`[${game}] gift không có số xu -> diamondCount null (không bịa số)`, () => {
    const ev = toWebhookEvent(game, 'gift', {
      user: sampleUser(),
      giftId: '1',
      giftDetails: { giftName: 'Quà lạ', giftType: 0 },
      repeatCount: 1,
      repeatEnd: true,
    });
    assert.equal(ev.diamondCount, null);
    assert.equal(ev.coins, null);
  });

  test(`[${game}] gift streak đang tặng dồn -> bỏ qua (trả null)`, () => {
    const ev = toWebhookEvent(game, 'gift', {
      user: sampleUser(),
      giftId: '1',
      giftDetails: { giftName: 'Quà streak', giftType: 1 },
      repeatCount: 5,
      repeatEnd: false,
    });
    assert.equal(ev, null);
  });

  test(`[${game}] gift streak đã chốt (repeatEnd) -> xử lý`, () => {
    const ev = toWebhookEvent(game, 'gift', {
      user: sampleUser(),
      giftId: '1',
      giftDetails: { giftName: 'Quà streak', giftType: 1 },
      extendedGiftInfo: { diamondCount: 10 },
      repeatCount: 5,
      repeatEnd: true,
    });
    assert.notEqual(ev, null);
    assert.equal(ev.repeatCount, 5);
  });

  test(`[${game}] like -> triggerTypeId 7, đúng số like`, () => {
    const ev = toWebhookEvent(game, 'like', { user: sampleUser(), likeCount: 42, totalLikeCount: 1000 });
    assert.equal(ev.triggerTypeId, 7);
    assert.equal(ev.type, 'like');
    assert.equal(ev.likeCount, 42);
    assert.equal(ev.totalLikeCount, 1000);
  });

  test(`[${game}] follow -> triggerTypeId 1`, () => {
    const ev = toWebhookEvent(game, 'follow', { user: sampleUser() });
    assert.equal(ev.triggerTypeId, 1);
    assert.equal(ev.type, 'follow');
  });

  test(`[${game}] share -> triggerTypeId 8`, () => {
    const ev = toWebhookEvent(game, 'share', { user: sampleUser() });
    assert.equal(ev.triggerTypeId, 8);
    assert.equal(ev.type, 'share');
  });

  test(`[${game}] member (vào phòng) -> triggerTypeId 6, type join`, () => {
    const ev = toWebhookEvent(game, 'member', { user: sampleUser() });
    assert.equal(ev.triggerTypeId, 6);
    assert.equal(ev.type, 'join');
  });
}

test('extractUser: ưu tiên avatar lớn, fallback về profilePictureUrl', () => {
  const u = extractUser({
    uniqueId: 'a',
    nickname: 'A',
    avatarLarge: { urls: ['https://example.com/large.jpg'] },
    avatarThumb: { urls: ['https://example.com/thumb.jpg'] },
  });
  assert.equal(u.avatar, 'https://example.com/large.jpg');
  const u2 = extractUser({ uniqueId: 'b', nickname: 'B', profilePictureUrl: 'https://example.com/p.jpg' });
  assert.equal(u2.avatar, 'https://example.com/p.jpg');
  const u3 = extractUser(null);
  assert.equal(u3.nickname, 'Khán giả');
  assert.equal(u3.avatar, '');
});
