// lib/normalize.js — Chuẩn hóa TikTok username thành key của room.
// TikTok uniqueId chỉ gồm chữ/số/dấu gạch dưới/chấm, dài 2-24 ký tự.
'use strict';

function normalizeUsername(raw) {
  let u = String(raw || '').trim();
  // Chấp nhận cả dạng URL: https://www.tiktok.com/@linhmochi/live
  const m = u.match(/tiktok\.com\/@([A-Za-z0-9._]+)/);
  if (m) u = m[1];
  u = u.replace(/^@/, '').trim().toLowerCase();
  return u;
}

function isValidUsername(u) {
  return /^[a-z0-9._]{2,24}$/.test(u);
}

function roomKey(game, username) {
  return `${game}:${username}`;
}

module.exports = { normalizeUsername, isValidUsername, roomKey };
