// lib/tiktok.js — Nối TikTok LIVE thật vào room + chuyển event của
// tiktok-live-connector về ĐÚNG định dạng webhook mà 3 game đã chuẩn hóa.
// Nguồn định dạng (đã kiểm chứng trong code gốc):
//  - Vẽ Avatar (CONNECT_TIKTOK_LIVE.md + parseEvent): triggerTypeId
//    1=follow, 3=gift, 6=join, 7=like, 8=share, 11=chat; kèm userId,
//    nickname, profilePictureUrl, giftName, diamondCount, repeatCount,
//    likeCount, content.
//  - Buồng Giam (processWebhookData): cùng bộ triggerTypeId trên.
//  - Bản đồ (handleTikFinityEvent): nhận diện theo chuỗi type/event
//    ('gift'/'chat'/'like'/'follow'/'join') hoặc hình dạng dữ liệu.
// Vì vậy mỗi event adapter trả về mang CẢ triggerTypeId CẢ type — 3 game
// đều nhận diện đúng, không game nào bị đổi luật.
// Số xu quà: CHỈ lấy số thật (extendedGiftInfo.diamondCount khi bật
// enableExtendedGiftInfo, nếu không có thì để null — KHÔNG đoán số xu,
// đúng luật của game Vẽ Avatar).
'use strict';

const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');

// Trích user từ payload của connector (proto User có avatarThumb/
// avatarMedium/avatarLarge dạng { urls: [...] }; bản connector chuẩn hóa
// có thể đưa profilePictureUrl/avatarUrl).
function extractUser(user) {
  if (!user) return { userId: '', uniqueId: '', nickname: 'Khán giả', avatar: '' };
  const firstUrl = (img) => {
    if (!img) return '';
    if (typeof img === 'string') return img;
    if (Array.isArray(img.urls) && img.urls.length) return img.urls[0];
    if (typeof img.url === 'string') return img.url;
    return '';
  };
  const avatar =
    firstUrl(user.profilePicture) ||
    firstUrl(user.avatarLarge) ||
    firstUrl(user.avatarMedium) ||
    firstUrl(user.avatarThumb) ||
    user.profilePictureUrl || user.avatarUrl || user.avatar || '';
  return {
    userId: String(user.userId || user.id || user.uniqueId || ''),
    uniqueId: String(user.uniqueId || ''),
    nickname: String(user.nickname || user.uniqueId || 'Khán giả').slice(0, 60),
    avatar: String(avatar || ''),
  };
}

// Chuyển 1 event của connector thành object dạng webhook của game.
// Trả null khi event phải bỏ qua (vd. quà đang trong streak, chưa chốt).
function toWebhookEvent(game, type, data) {
  if (!data) return null;
  const u = extractUser(data.user);
  const base = {
    userId: u.userId || u.uniqueId,
    nickname: u.nickname,
    uniqueId: u.uniqueId,
    username: u.uniqueId,
    profilePictureUrl: u.avatar,
    avatar_url: u.avatar,
    avatar: u.avatar,
  };

  switch (type) {
    case 'chat': {
      const text = String(data.comment ?? data.content ?? '');
      return { ...base, type: 'chat', triggerTypeId: 11, content: text, comment: text, text };
    }
    case 'gift': {
      // Quà streak (giftType 1): connector bắn nhiều lần khi đang tặng dồn;
      // chỉ xử lý khi streak kết thúc (repeatEnd) hoặc quà không streak.
      const giftType = data.giftDetails?.giftType ?? data.giftType;
      const repeatEnd = !!data.repeatEnd;
      if (giftType === 1 && !repeatEnd) return null;
      const giftName =
        data.giftDetails?.giftName ||
        data.extendedGiftInfo?.name ||
        data.gift?.name ||
        data.giftName ||
        'Quà';
      const diamondCount =
        data.extendedGiftInfo?.diamondCount ??
        data.gift?.diamondCount ??
        data.diamondCount ??
        null;
      const repeatCount = Math.max(1, Number(data.repeatCount) || 1);
      return {
        ...base,
        type: 'gift',
        triggerTypeId: 3,
        giftName: String(giftName).slice(0, 60),
        diamondCount,
        coins: diamondCount,
        repeatCount,
        count: repeatCount,
        giftId: String(data.giftId || ''),
      };
    }
    case 'like': {
      const likeCount = Math.max(1, Number(data.likeCount ?? data.count) || 1);
      return {
        ...base,
        type: 'like',
        triggerTypeId: 7,
        likeCount,
        totalLikeCount: Number(data.totalLikeCount ?? data.total ?? likeCount) || likeCount,
      };
    }
    case 'follow':
      return { ...base, type: 'follow', triggerTypeId: 1 };
    case 'share':
      return { ...base, type: 'share', triggerTypeId: 8, event: 'share' };
    case 'member':
      return { ...base, type: 'join', triggerTypeId: 6 };
    default:
      return null;
  }
}

// Một kết nối TikTok LIVE cho một room: tự nối lại khi rớt, tự thử lại khi
// tài khoản chưa live. Không bao giờ hỏi mật khẩu TikTok — chỉ đọc feed
// LIVE công khai bằng username (giống Livecade).
// onEvent(type, data): room gọi adapter rồi đưa event vào engine.
// onState(state, detail): báo trạng thái cho room ('connecting' | 'live' |
// 'offline' | 'reconnecting' | 'error').
function createTikTokLink(username, onEvent, onState) {
  let conn = null;
  let retryTimer = null;
  let stopped = false;
  let connecting = false;

  function setState(s, detail) {
    try { onState(s, detail || ''); } catch {}
  }

  function scheduleRetry(ms) {
    if (stopped) return;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => { if (!stopped) connect(); }, ms);
    if (retryTimer.unref) retryTimer.unref();
  }

  async function connect() {
    if (stopped || connecting) return;
    connecting = true;
    setState('connecting');
    try {
      conn = new TikTokLiveConnection(username, { enableExtendedGiftInfo: true });
      conn.on(WebcastEvent.CHAT, (d) => onEvent('chat', d));
      conn.on(WebcastEvent.GIFT, (d) => onEvent('gift', d));
      conn.on(WebcastEvent.LIKE, (d) => onEvent('like', d));
      conn.on(WebcastEvent.FOLLOW, (d) => onEvent('follow', d));
      conn.on(WebcastEvent.SHARE, (d) => onEvent('share', d));
      conn.on(WebcastEvent.MEMBER, (d) => onEvent('member', d));
      conn.on(ControlEvent.CONNECTED, () => setState('live'));
      conn.on(ControlEvent.DISCONNECTED, () => {
        setState('reconnecting');
        scheduleRetry(15000);
      });
      conn.on(ControlEvent.ERROR, (e) => {
        setState('error', (e && e.message) || String(e || ''));
      });
      await conn.connect();
      connecting = false;
    } catch (e) {
      connecting = false;
      try { if (conn) await conn.disconnect().catch(() => {}); } catch {}
      conn = null;
      const msg = (e && e.message) || String(e || '');
      if (/offline/i.test(msg) || (e && e.name === 'UserOfflineError')) {
        setState('offline', 'Tài khoản chưa LIVE');
      } else {
        setState('error', msg);
      }
      scheduleRetry(60000);
    }
  }

  function stop() {
    stopped = true;
    clearTimeout(retryTimer);
    if (conn) {
      const c = conn;
      conn = null;
      c.disconnect().catch(() => {});
    }
  }

  return { start: connect, stop };
}

module.exports = { extractUser, toWebhookEvent, createTikTokLink };
