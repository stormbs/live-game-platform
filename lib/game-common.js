// lib/game-common.js — Dụng cụ dùng chung cho các game mới trên nền tảng
// (vuon-hoa-mua-xuan, bep-an-tap-the, dua-xe-leo-nui, vong-quay-may-man,
// bau-troi-phao-hoa). Các engine cũ (ve-avatar, buong-giam, thap-sang-ban-do)
// tự chứa code riêng nên không dùng module này.
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

function loadJson(file, fallback) {
  try {
    if (fs.existsSync(file)) return { ...fallback, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (e) { console.error('Load JSON lỗi:', file, e.message); }
  return { ...fallback };
}

function saveJson(file, obj) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) { console.error('Save JSON lỗi:', file, e.message); }
}

// Chuẩn hóa chữ để so khớp từ khóa: bỏ dấu, thường, gộp khoảng trắng.
function normVi(s) {
  return String(s || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
}

// ---------------- PHÂN TÍCH WEBHOOK TIKFINITY ----------------
// Bản rút gọn của parseEvent trong games/ve-avatar/engine.js (chuẩn đã
// kiểm chứng): nhận cả body triggerTypeId (TikFinity) lẫn dạng {type,...}
// (adapter TikTok LIVE / bản đồ). Trả về event đã chuẩn hóa.
// Định dạng THẬT mà TikFinity gửi (xác minh 2026-11-13 từ log live thật của
// game bản đồ ~/workspace/game-thap-sang-ban-do/server.log + giao diện
// TikFinity trên máy user): action "Trigger WebHook" CHỈ có ô URL, KHÔNG có
// ô body — TikFinity tự gửi body cố định dạng form-urlencoded:
//   value1=<tên tài khoản> & value2=<nội dung chính / tên quà>
//   & value3=<số xu quà> & content=<bình luận> & avatar_url=<avatar thật>
// (một số bản gửi JSON {event, data:{...}} — vẫn hỗ trợ).
// Loại sự kiện KHÔNG nằm trong form → phân biệt bằng query trên URL:
// webhook của phòng + ?event=gift|chat|like|follow|share|join (mỗi sự kiện
// 1 action webhook riêng với URL riêng). Parser đọc query trước (data =
// {...query, ...bodyObj}) nên ?event= quyết định kind.
// LƯU Ý: đừng bao giờ bắt user nhập body JSON — TikFinity không có chỗ nhập.
function parseTikFinityEvent(rawBody, query) {
  let bodyObj = (typeof rawBody === 'object' && rawBody !== null) ? rawBody : {};
  if (typeof rawBody === 'string' && rawBody.trim()) {
    const s = rawBody.trim();
    try { bodyObj = JSON.parse(s); }
    catch (e) {
      if (s.includes('=')) {
        try {
          const params = new URLSearchParams(s);
          const o = {};
          for (const [k, v] of params) o[k] = v;
          bodyObj = Object.keys(o).length ? o : { content: s.slice(0, 200) };
        } catch (e2) { bodyObj = { content: s.slice(0, 200) }; }
      } else {
        bodyObj = { content: s.slice(0, 200) };
      }
    }
    if (typeof bodyObj !== 'object' || bodyObj === null) bodyObj = {};
  }
  const data = { ...(query || {}), ...bodyObj };
  const innerData = [data.data, data.args, data.payload].find((v) => typeof v === 'object' && v !== null) || {};
  const args = (typeof data.args === 'object' && data.args !== null) ? data.args : {};
  const triggerTypeId = Number(data.triggerTypeId || innerData.triggerTypeId || args.triggerTypeId || 0);
  const ev = [
    data.event, data.type, data.actionName, data.name, data.displayType, data.socialType,
    data.subType, data.label, data.value1, data.value2, data.value3, data.content,
    data.commandParams, data.message, innerData.event, innerData.type, innerData.action,
    innerData.name, innerData.content, innerData.message, innerData.commandParams,
  ].map((s) => String(s || '').toLowerCase()).join(' ');

  const userObj = [data.user, innerData.user].find((v) => typeof v === 'object' && v !== null) || {};
  const uid = String(
    userObj.userId || userObj.id || userObj.user_id || data.userId || data.id || data.user_id ||
    innerData.userId || innerData.id || innerData.user_id || args.userId || args.user_id ||
    data.value1 || innerData.value1 || args.value1 ||
    userObj.uniqueId || userObj.username || data.username || innerData.username || '',
  ).trim();
  const name = String(
    userObj.nickname || userObj.name || data.nickname || data.userName || data.user_name ||
    data.name || innerData.nickname || innerData.userName || innerData.name ||
    args.nickname || args.username || data.value1 || innerData.value1 || args.value1 || uid || 'Khán giả',
  ).trim().slice(0, 60) || 'Khán giả';
  const avatar = String(
    userObj.profilePictureUrl || userObj.avatarUrl || userObj.avatar || userObj.avatar_url ||
    userObj.avatar_thumb || userObj.profile_picture_url ||
    data.profilePictureUrl || data.avatarUrl || data.avatar || data.avatar_url ||
    data.avatar_thumb || data.profile_picture_url || data.avatar_large || data.profilePic ||
    innerData.profilePictureUrl || innerData.avatarUrl || innerData.avatar ||
    innerData.avatar_url || innerData.avatar_thumb || innerData.profile_picture_url ||
    args.profilePictureUrl || args.avatar || args.avatar_url || args.avatar_thumb || '',
  ).trim();

  const evMeta = [
    data.event, data.type, data.actionName, data.name, data.displayType, data.socialType,
    data.subType, data.label, data.value1, data.value2, data.value3,
    innerData.event, innerData.type, innerData.action, innerData.name,
  ].map((s) => String(s || '').toLowerCase()).join(' ');
  const isShare = triggerTypeId === 8 || evMeta.includes('share') ||
    evMeta.includes('chia sẻ') || evMeta.includes('chia se');
  const isFollow = triggerTypeId === 1 || triggerTypeId === 2 ||
    ev.includes('follow') || ev.includes('theo dõi') || ev.includes('theo doi') ||
    ev.includes('member_follow') || ev.includes('subscribe');
  const isGift = triggerTypeId === 3 || ev.includes('gift') ||
    Boolean(data.giftName || data.gift || innerData.giftName || innerData.gift || args.giftName ||
      data.diamondCount || data.diamonds || data.coins || innerData.coins || args.coins);
  const isLike = triggerTypeId === 7 || evMeta.includes('like') || evMeta.includes('tap') ||
    ev.includes('member_like') || ev.includes('like_count') ||
    Boolean(data.likeCount || data.likes || innerData.likeCount || args.likeCount);
  const isJoin = triggerTypeId === 6 || (!isFollow && !isGift && !isLike &&
    (ev.includes('join') || ev.includes('member') || ev.includes('enter') || ev.includes('welcome')));
  const isChat = !isFollow && !isGift && !isLike && !isJoin && (triggerTypeId === 11 ||
    ev.includes('chat') || ev.includes('comment') ||
    Boolean(data.comment || data.content || data.text || data.message || data.commandParams ||
      innerData.comment || innerData.content || innerData.text || innerData.message));

  let kind = 'other';
  if (isGift) kind = 'gift';
  else if (isShare) kind = 'share';
  else if (isChat) kind = 'comment';
  else if (isFollow) kind = 'follow';
  else if (isJoin) kind = 'join';
  else if (isLike) kind = 'tap';

  // Xu quà: CHỈ lấy số thật trong sự kiện, không bao giờ đoán/mặc định.
  // Hỗ trợ cả giftId để dashboard tra bảng quà.
  const coinRaw = data.diamondCount ?? data.diamond_count ?? data.coins ?? data.diamonds ??
    innerData.diamondCount ?? innerData.coins ?? args.coins ?? data.gift?.diamond_count ??
    data.gift?.coins ?? data.value3 ?? innerData.value3 ?? args.value3 ?? null;
  const repeatRaw = data.repeatCount ?? data.count ?? data.combo ?? innerData.repeatCount ?? args.repeatCount ?? 1;
  const qty = Math.max(1, parseInt(repeatRaw, 10) || 1);
  let coins = null;
  if (coinRaw !== null && coinRaw !== '' && !isNaN(Number(coinRaw))) {
    coins = Math.floor(Number(coinRaw));
    if (qty > 1 && coins > 0 && coins < qty) coins *= qty; // đơn giá -> nhân số lượng
  }
  const giftName = String(
    data.giftName || data.gift?.name || data.gift?.gift_name || innerData.giftName ||
    innerData.gift?.name || args.giftName || (typeof data.gift === 'string' ? data.gift : '') ||
    data.value2 || innerData.value2 || 'Quà',
  ).slice(0, 60);
  const giftId = String(
    data.giftId || data.gift?.id || data.gift?.gift_id || innerData.giftId || args.giftId || '',
  ).slice(0, 60);
  const text = String(
    data.comment ?? data.content ?? data.text ?? data.message ?? data.commandParams ??
    innerData.comment ?? innerData.content ?? innerData.text ?? innerData.message ??
    args.comment ?? args.text ?? data.value2 ?? innerData.value2 ?? '',
  ).slice(0, 200);

  // Tim: TikFinity gửi likeCount là TỔNG TÍCH LŨY; adapter gửi thêm
  // totalLikeCount (tích lũy) + likeCount (theo đợt). Ưu tiên tổng tích lũy.
  const totalRaw = data.totalLikeCount ?? data.totalLikes ?? innerData.totalLikeCount ?? innerData.totalLikes ?? null;
  const likeRaw = data.likeCount ?? data.likes ?? data.count ?? data.tapCount ??
    innerData.likeCount ?? innerData.likes ?? args.likeCount ?? args.count ?? null;
  // Không có số tim trong payload (vd. form mặc định của TikFinity không kèm
  // tổng tim) → null để engine tính 1 tim/sự kiện, thay vì mặc định 1 rồi bị
  // TapDelta nuốt hết (delta lần đầu = 0, các lần sau tổng vẫn 1 → 0).
  let likeCount = null;
  if (likeRaw !== null && likeRaw !== '' && !isNaN(Number(likeRaw))) {
    // 0 là 0 (baseline gieo tim), không ép lên 1 — ép lên 1 làm delta sau
    // đó thiếu 1 (baseline 1 → tim 15 chỉ tính 14).
    likeCount = Math.max(0, Math.floor(Number(likeRaw)));
  }
  let totalLikeCount = null;
  if (totalRaw !== null && totalRaw !== '' && !isNaN(Number(totalRaw))) {
    totalLikeCount = Math.max(0, Math.floor(Number(totalRaw)));
  }

  return { uid, name, avatar, kind, coins, giftName, giftId, text, qty, likeCount, totalLikeCount };
}

// ---------------- TAP DELTA ----------------
// likeCount của TikFinity là tổng tích lũy: chỉ cộng phần tăng so với lần
// trước của chính người đó (giống game bản đồ). Lần đầu thấy người này thì
// delta = 0 (tránh nhảy vọt vì họ đã tim từ trước khi room tạo).
class TapDelta {
  constructor() { this.last = {}; }
  delta(uid, total) {
    const t = Math.max(0, Math.floor(Number(total) || 0));
    const prev = this.last[uid];
    this.last[uid] = t;
    if (prev === undefined) return 0;
    if (t <= prev) return 0;
    return Math.min(t - prev, 5000); // chặn 1 đợt tối đa 5000 tap
  }
  reset() { this.last = {}; }
}

// ---------------- TIMER THEO DÕI (dọn khi room hủy) ----------------
function withTimers(ctx) {
  const timers = new Set();
  const setInterval = (fn, ms, ...a) => {
    if (ctx.dead) return 0;
    const id = global.setInterval(fn, ms, ...a);
    timers.add(id);
    return id;
  };
  const setTimeout = (fn, ms, ...a) => {
    if (ctx.dead) return 0;
    const id = global.setTimeout(fn, ms, ...a);
    timers.add(id);
    return id;
  };
  const clearInterval = (id) => { timers.delete(id); return global.clearInterval(id); };
  const clearTimeout = (id) => { timers.delete(id); return global.clearTimeout(id); };
  const clearAll = () => {
    ctx.dead = true;
    for (const id of timers) {
      try { global.clearTimeout(id); } catch {}
      try { global.clearInterval(id); } catch {}
    }
    timers.clear();
  };
  return { setInterval, setTimeout, clearInterval, clearTimeout, clearAll };
}

// ---------------- GOOGLE TTS PROXY ----------------
// Server tải mp3 tiếng Việt về, overlay/dashboard chỉ phát file từ server
// (bản rút gọn của proxy trong games/ve-avatar/engine.js).
function mountTts(app, dataDir) {
  const cacheDir = path.join(dataDir, 'tts_cache');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  function fetchChunk(q) {
    return new Promise((resolve, reject) => {
      const cleanQ = (q || '').trim();
      if (!cleanQ) return resolve(Buffer.alloc(0));
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanQ)}&tl=vi&client=tw-ob`;
      https.get(url, (ttsRes) => {
        if (ttsRes.statusCode === 200) {
          const chunks = [];
          ttsRes.on('data', (c) => chunks.push(c));
          ttsRes.on('end', () => resolve(Buffer.concat(chunks)));
        } else {
          ttsRes.resume();
          reject(new Error(`TTS status ${ttsRes.statusCode}`));
        }
      }).on('error', reject);
    });
  }
  async function fetchLongTts(str) {
    if (!str || !str.trim()) return Buffer.alloc(0);
    const clean = str.trim();
    if (clean.length <= 180) return fetchChunk(clean);
    const parts = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
    const buffers = [];
    let current = '';
    for (const part of parts) {
      if ((current + ' ' + part).trim().length <= 180) {
        current = (current + ' ' + part).trim();
      } else {
        if (current) buffers.push(await fetchChunk(current));
        current = part.trim();
      }
    }
    if (current) buffers.push(await fetchChunk(current));
    return Buffer.concat(buffers);
  }
  app.get('/api/tts', async (req, res) => {
    const rawText = String(req.query.text || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!rawText) return res.status(400).send('No text');
    const hash = crypto.createHash('md5').update(rawText).digest('hex');
    const cachePath = path.join(cacheDir, `${hash}.mp3`);
    try {
      if (fs.existsSync(cachePath)) {
        res.setHeader('Content-Type', 'audio/mpeg');
        return fs.createReadStream(cachePath).pipe(res);
      }
      const buf = await fetchLongTts(rawText);
      if (buf && buf.length > 0) {
        try { fs.writeFileSync(cachePath, buf); } catch (e) {}
        res.setHeader('Content-Type', 'audio/mpeg');
        return res.send(buf);
      }
      return res.status(502).send('TTS empty');
    } catch (err) {
      console.error('TTS proxy lỗi:', err.message);
      return res.status(502).send('TTS failed');
    }
  });
}

module.exports = { loadJson, saveJson, normVi, parseTikFinityEvent, TapDelta, withTimers, mountTts };
