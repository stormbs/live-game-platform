// test/tikfinity-form.test.js — Parser đọc đúng payload THẬT của TikFinity.
//
// Xác minh 2026-11-13: action "Trigger WebHook" của TikFinity CHỈ có ô URL,
// KHÔNG có ô body. TikFinity tự gửi body cố định dạng form-urlencoded
// (thấy trong log live thật ~/workspace/game-thap-sang-ban-do/server.log):
//   value1=<tên tài khoản> & value2=<nội dung chính / tên quà>
//   & value3=<số xu quà> & content=<bình luận> & avatar_url=<avatar thật>
// Loại sự kiện không nằm trong form → phân biệt bằng query trên URL:
// .../api/webhook?event=gift|chat|like|follow|share|join (mỗi sự kiện
// 1 action webhook riêng với URL riêng). Test dùng dữ liệu thử trong log
// thật (tài khoản lan123, avatar pravatar test) — không phải người thật.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTikFinityEvent } = require('../lib/game-common');

const CHAT_FORM = {
  value1: 'lan123',
  value2: 'Hà Nội',
  value3: '',
  content: 'Hà Nội',
  avatar_url: 'https://i.pravatar.cc/150?img=12',
};
const CHAT_FORM_RAW =
  'value1=lan123&value2=H%C3%A0+N%E1%BB%99i&value3=&content=H%C3%A0+N%E1%BB%99i&avatar_url=https%3A%2F%2Fi.pravatar.cc%2F150%3Fimg%3D12';

test('form chat + ?event=chat -> comment, uid từ value1, text từ content', () => {
  const ev = parseTikFinityEvent(CHAT_FORM, { event: 'chat' });
  assert.equal(ev.kind, 'comment');
  assert.equal(ev.uid, 'lan123');
  assert.equal(ev.name, 'lan123');
  assert.equal(ev.text, 'Hà Nội');
  assert.equal(ev.avatar, 'https://i.pravatar.cc/150?img=12');
});

test('form chat dạng chuỗi thô URL-encoded cũng parse được', () => {
  const ev = parseTikFinityEvent(CHAT_FORM_RAW, { event: 'chat' });
  assert.equal(ev.kind, 'comment');
  assert.equal(ev.uid, 'lan123');
  assert.equal(ev.text, 'Hà Nội');
});

test('form gift + ?event=gift -> gift, xu từ value3, tên quà từ value2', () => {
  const ev = parseTikFinityEvent(
    { value1: 'lan123', value2: 'Hoa hồng', value3: '10', content: '', avatar_url: '' },
    { event: 'gift' },
  );
  assert.equal(ev.kind, 'gift');
  assert.equal(ev.uid, 'lan123');
  assert.equal(ev.coins, 10);
  assert.equal(ev.giftName, 'Hoa hồng');
});

test('form gift KHÔNG có ?event= thì không nhận ra loại (URL ?event= là bắt buộc)', () => {
  const ev = parseTikFinityEvent(
    { value1: 'lan123', value2: 'Hoa hồng', value3: '10', content: '', avatar_url: '' },
    {},
  );
  assert.equal(ev.kind, 'other');
  assert.equal(ev.uid, 'lan123');
});

test('form like + ?event=like -> tap, không có số tim thì likeCount null (engine tính 1 tim/sự kiện)', () => {
  const ev = parseTikFinityEvent(
    { value1: 'lan123', value2: '', value3: '', content: '', avatar_url: '' },
    { event: 'like' },
  );
  assert.equal(ev.kind, 'tap');
  assert.equal(ev.uid, 'lan123');
  assert.equal(ev.likeCount, null);
  assert.equal(ev.totalLikeCount, null);
});

test('form follow + ?event=follow -> follow, uid từ value1', () => {
  const ev = parseTikFinityEvent(
    { value1: 'lan123', value2: '', value3: '', content: '', avatar_url: '' },
    { event: 'follow' },
  );
  assert.equal(ev.kind, 'follow');
  assert.equal(ev.uid, 'lan123');
});

test('form join + ?event=join -> join', () => {
  const ev = parseTikFinityEvent(
    { value1: 'lan123', value2: '', value3: '', content: '', avatar_url: '' },
    { event: 'join' },
  );
  assert.equal(ev.kind, 'join');
  assert.equal(ev.uid, 'lan123');
});

test('form share + ?event=share -> share', () => {
  const ev = parseTikFinityEvent(
    { value1: 'lan123', value2: '', value3: '', content: '', avatar_url: '' },
    { event: 'share' },
  );
  assert.equal(ev.kind, 'share');
});

test('JSON gift dạng cũ vẫn chạy (event + data.giftName/diamondCount/user)', () => {
  const ev = parseTikFinityEvent(
    { event: 'gift', data: { giftName: 'Hoa hồng', diamondCount: 10, repeatCount: 1, repeatEnd: true, user: { nickname: 'Yen' } } },
    {},
  );
  assert.equal(ev.kind, 'gift');
  assert.equal(ev.coins, 10);
  assert.equal(ev.giftName, 'Hoa hồng');
  assert.equal(ev.name, 'Yen');
});
