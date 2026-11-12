// lib/webhook-bodies.js — Bảng body webhook TikFinity cho từng game + URL
// webhook của room. Đây là nguồn sự thật duy nhất (single source of truth)
// cho:
//  - bài hướng dẫn cài đặt TikFinity (lib/guide.js — bảng body từng sự kiện),
//  - bảng body mẫu trên dashboard từng game,
//  - test/tikfinity.test.js (body thay biến mẫu xong phải parse được JSON và
//    được engine của game nhận).
//
// BỐI CẢNH (2026-11-12): đường kết nối trực tiếp (tiktok-live-connector)
// không vào được phòng live vì Euler Stream chặn ký websocket ẩn danh
// ("This endpoint requires a Business plan"); key miễn phí đã thử và vẫn
// bị chặn. Đường sự kiện chính quay lại TikFinity: TikFinity chạy trên máy
// Windows của streamer, gửi sự kiện live (chat/gift/like/follow/share/join)
// về POST /o/<game>/<username>/api/webhook của room (xem lib/rooms.js).
//
// QUYẾT ĐỊNH 2026-11-12 (Chủ tịch chốt): KHÔNG làm file .tfc nữa — file
// .tfc thật của TikFinity là JSON mã hóa AES (OpenSSL-salted), mật khẩu mã
// hóa không công khai, nên file JSON thô sinh ra không khẳng định import
// được. Chỉ làm bài hướng dẫn tạo Action bằng tay (đã chạy thật trong các
// live trước). File lib/tikfinity.js cũ đã xóa.
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
//
// LINK WEBHOOK KHÔNG DÙNG CHUNG: mỗi streamer có link riêng theo game +
// username TikTok của mình (/o/<game>/<username>/api/webhook). Username
// trong link cho server biết event thuộc phòng nào; dùng chung 1 link sẽ
// trộn event của mọi người vào cùng 1 game. Body thì giống nhau cho mọi
// người — chỉ khác URL.
'use strict';

const DEFAULT_BASE_URL = 'https://live-game-platform-production.up.railway.app';

// Cấu hình riêng từng game: tên Action trong TikFinity + triggerTypeId của
// sự kiện share (xem ghi chú ở đầu file — buong-giam đọc 8 là LEAVE).
const GAMES = {
  've-avatar': { actionName: 'Ve Avatar - Moi su kien', shareTriggerTypeId: 8 },
  'buong-giam': { actionName: 'Buong Giam - Moi su kien', shareTriggerTypeId: 4 },
  'thap-sang-ban-do': { actionName: 'Thap Sang Ban Do - Moi su kien', shareTriggerTypeId: 8 },
  'vuon-hoa-mua-xuan': { actionName: 'Vuon Hoa Mua Xuan - Moi su kien', shareTriggerTypeId: 8 },
  'bep-an-tap-the': { actionName: 'Bep An Tap The - Moi su kien', shareTriggerTypeId: 8 },
  'dua-xe-leo-nui': { actionName: 'Dua Xe Leo Nui - Moi su kien', shareTriggerTypeId: 8 },
  'vong-quay-may-man': { actionName: 'Vong Quay May Man - Moi su kien', shareTriggerTypeId: 8 },
  'bau-troi-phao-hoa': { actionName: 'Bau Troi Phao Hoa - Moi su kien', shareTriggerTypeId: 8 },
  'keo-co': { actionName: 'Keo Co - Moi su kien', shareTriggerTypeId: 8 },
  'dau-truong-sinh-ton': { actionName: 'Dau Truong Sinh Ton - Moi su kien', shareTriggerTypeId: 8 },
  'chiem-co': { actionName: 'Chiem Co - Moi su kien', shareTriggerTypeId: 8 },
};

function isSupportedGame(game) {
  return Object.prototype.hasOwnProperty.call(GAMES, game);
}

// Base URL công khai của nền tảng (để ghép webhook URL tuyệt đối — TikFinity
// trên máy user POST về URL này). Thứ tự: biến môi trường PUBLIC_BASE_URL
// (đặt trên Railway nếu domain đổi) > host của request hiện tại (đúng cả
// khi chạy local) > domain Railway mặc định.
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
    throw new Error(`game chưa hỗ trợ: ${game}`);
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

module.exports = {
  DEFAULT_BASE_URL,
  GAMES,
  isSupportedGame,
  publicBaseUrl,
  webhookUrl,
  eventBodies,
};
