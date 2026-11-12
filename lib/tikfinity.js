// lib/tikfinity.js — Sinh file TikFinity (.tfc) cho từng room + bảng body
// webhook mà TikFinity phải gửi về nền tảng.
//
// BỐI CẢNH (2026-11-12): đường kết nối trực tiếp (tiktok-live-connector)
// không vào được phòng live vì Euler Stream chặn ký websocket ẩn danh
// ("This endpoint requires a Business plan"); key miễn phí đã thử và vẫn
// bị chặn. Đường sự kiện chính quay lại TikFinity: TikFinity chạy trên máy
// Windows của streamer, gửi sự kiện live (chat/gift/like/follow/share/join)
// về POST /o/<game>/<username>/api/webhook của room (xem lib/rooms.js).
//
// ĐỊNH DẠNG FILE .tfc — THÀNH THẬT MÀ NÓI, CHƯA XÁC MINH ĐƯỢC:
// File .tfc thật của TikFinity là JSON mã hóa AES theo định dạng
// OpenSSL-salted (magic bytes "Salted__", base64 "U2FsdGVkX1..."), mật khẩu
// mã hóa KHÔNG công khai, không tìm thấy parser/mã nguồn giải mã nào, và
// không có file .tfc mẫu nào trong workspace để đối chiếu. Vì vậy file
// sinh ra ở đây là JSON THÔ (plaintext) theo schema tự ghi rõ bên dưới —
// best-effort, KHÔNG khẳng định sẽ import được vào TikFinity. Dashboard
// luôn ghi rõ điều này và đưa cách tạo Action bằng tay (đã chạy thật trong
// các live trước) làm đường chắc chắn. Nếu sau này có 1 file .tfc mẫu do
// user export từ TikFinity, đối chiếu lại schema/mật khẩu rồi cập nhật hàm
// buildTikfinityFile — đừng tự đoán mật khẩu rồi mã hóa theo.
//
// BODY WEBHOOK (đã chạy thật, lấy từ guide cũ của team + parser của engine):
// Mỗi sự kiện gửi 1 body JSON riêng về webhook URL của room, Method POST,
// Content-Type application/json, dùng biến $... của TikFinity (bấm nút chèn
// biến của TikFinity để lấy đúng tên theo phiên bản; tên biến dưới đây là
// tên đã dùng trong các live trước: $userId, $nickname, $profilePictureUrl,
// $giftName, $diamondCount, $repeatCount, $comment, $likeCount).
// - triggerTypeId theo từng game: gift=3, chat=11, like=7, follow=1,
//   join=6; share KHÁC NHAU theo game — ve-avatar=8, buong-giam=4 (parser
//   buong-giam đọc 8/9 là LEAVE nên share của buong-giam KHÔNG được dùng 8),
//   thap-sang-ban-do không đọc triggerTypeId nên dùng 8.
// - Trường "event" (chuỗi loại sự kiện) là BẮT BUỘC cho game bản đồ: parser
//   của nó không đọc triggerTypeId, và follow/join không suy ra được từ
//   hình dạng dữ liệu — thiếu chuỗi loại là follow/join bị bỏ qua.
// - Trường "uniqueId" (tên TikTok @, không @): bản đồ định danh viewer bằng
//   uniqueId, không dùng nickname. Nếu phiên bản TikFinity không có biến
//   $uniqueId thì dùng biến tên TikTok mà TikFinity gợi ý, hoặc bỏ trường
//   này — engine tự lấy nickname/userId thay thế.
// - Số ($diamondCount, $repeatCount, $likeCount) để TRẦN (không ngoặc kép)
//   như guide cũ — TikFinity thay bằng số thật khi gửi.
'use strict';

const DEFAULT_BASE_URL = 'https://live-game-platform-production.up.railway.app';

// Cấu hình riêng từng game: tên Action trong TikFinity + triggerTypeId của
// sự kiện share (xem ghi chú ở đầu file — buong-giam đọc 8 là LEAVE).
const GAMES = {
  've-avatar': { actionName: 'Ve Avatar - Moi su kien', shareTriggerTypeId: 8 },
  'buong-giam': { actionName: 'Buong Giam - Moi su kien', shareTriggerTypeId: 4 },
  'thap-sang-ban-do': { actionName: 'Thap Sang Ban Do - Moi su kien', shareTriggerTypeId: 8 },
};

function isSupportedGame(game) {
  return Object.prototype.hasOwnProperty.call(GAMES, game);
}

// Base URL công khai của nền tảng (để nhúng webhook URL tuyệt đối vào file
// .tfc — TikFinity trên máy user POST về URL này). Thứ tự: biến môi trường
// PUBLIC_BASE_URL (đặt trên Railway nếu domain đổi) > host của request hiện
// tại (đúng cả khi chạy local) > domain Railway mặc định.
function publicBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
  if (req) {
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const host = req.get('host');
    if (host) return `${proto}://${host}`;
  }
  return DEFAULT_BASE_URL;
}

function webhookUrl(game, username, baseUrl) {
  return `${String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')}/o/${game}/${username}/api/webhook`;
}

// Bảng body webhook cho 1 game: 6 loại sự kiện, mỗi loại 1 body template.
// Trả về mảng { key, label, triggerTypeId, body } — body là CHUỖI JSON
// (để giữ số $... trần như guide cũ; JSON.parse sau khi thay biến mẫu thì
// phải hợp lệ — test/tikfinity.test.js kiểm chứng điều này).
function eventBodies(game) {
  if (!isSupportedGame(game)) {
    throw new Error(`game chưa hỗ trợ file TikFinity: ${game}`);
  }
  const shareId = GAMES[game].shareTriggerTypeId;
  const who = '"userId":"$userId","nickname":"$nickname","uniqueId":"$uniqueId","profilePictureUrl":"$profilePictureUrl"';
  return [
    {
      key: 'gift',
      label: 'Quà tặng (Gift)',
      triggerTypeId: 3,
      body: `{"triggerTypeId":3,"event":"gift",${who},"giftName":"$giftName","diamondCount":$diamondCount,"repeatCount":$repeatCount}`,
    },
    {
      key: 'chat',
      label: 'Bình luận (Chat)',
      triggerTypeId: 11,
      body: `{"triggerTypeId":11,"event":"chat",${who},"content":"$comment"}`,
    },
    {
      key: 'like',
      label: 'Thả tim (Like/Tap)',
      triggerTypeId: 7,
      body: `{"triggerTypeId":7,"event":"like",${who},"likeCount":$likeCount}`,
    },
    {
      key: 'follow',
      label: 'Theo dõi (Follow)',
      triggerTypeId: 1,
      body: `{"triggerTypeId":1,"event":"follow",${who}}`,
    },
    {
      key: 'share',
      label: 'Chia sẻ (Share)',
      triggerTypeId: shareId,
      body: `{"triggerTypeId":${shareId},"event":"share",${who}}`,
    },
    {
      key: 'join',
      label: 'Vào phòng (Join)',
      triggerTypeId: 6,
      body: `{"triggerTypeId":6,"event":"join",${who}}`,
    },
  ];
}

// Sinh nội dung file .tfc cho 1 room (game + username). Trả về chuỗi JSON.
// Xem ghi chú đầu file: đây là JSON THÔ best-effort, chưa xác minh import.
function buildTikfinityFile(game, username, req) {
  if (!isSupportedGame(game)) {
    throw new Error(`game chưa hỗ trợ file TikFinity: ${game}`);
  }
  const base = publicBaseUrl(req);
  const url = webhookUrl(game, username, base);
  const doc = {
    format: 'tikfinity-settings',
    formatVersion: 1,
    generator: 'live-game-platform (best-effort, chua xac minh import — xem lib/tikfinity.js)',
    game,
    username,
    webhookUrl: url,
    note: 'File .tfc that cua TikFinity la JSON ma hoa AES (OpenSSL-salted), mat khau ma hoa khong cong khai. File nay la JSON tho best-effort, chua chac import duoc. Neu TikFinity bao loi khi import, tao Action bang tay theo huong dan tren dashboard (muc Cai dat TikFinity) — cach do da chay that trong cac live truoc.',
    actions: [
      {
        name: GAMES[game].actionName,
        kind: 'webhook',
        method: 'POST',
        contentType: 'application/json',
        url,
        events: eventBodies(game).map((e) => ({
          type: e.key,
          label: e.label,
          triggerTypeId: e.triggerTypeId,
          body: e.body,
        })),
      },
    ],
  };
  return JSON.stringify(doc, null, 2) + '\n';
}

module.exports = {
  DEFAULT_BASE_URL,
  GAMES,
  isSupportedGame,
  publicBaseUrl,
  webhookUrl,
  eventBodies,
  buildTikfinityFile,
};
