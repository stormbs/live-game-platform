// lib/guide.js — Bài hướng dẫn cài đặt TikFinity (tạo Action bằng tay).
// Trang độc lập, không phụ thuộc file ngoài.
//
// CƠ CHẾ THẬT ĐÃ XÁC MINH (2026-11-13, từ ảnh TikFinity thật + log live
// thật của game bản đồ): action "Trigger WebHook" của TikFinity CHỈ có ô
// URL, KHÔNG có ô body. TikFinity tự gửi body cố định dạng form-urlencoded
// (value1=tên tài khoản, value2=nội dung/tên quà, value3=số xu,
// content=bình luận, avatar_url=avatar). Loại sự kiện KHÔNG nằm trong form
// → phân biệt bằng query trên URL: mỗi sự kiện 1 Action webhook riêng với
// URL riêng .../api/webhook?event=gift|chat|like|follow|share|join.
// → Bài này KHÔNG có body, KHÔNG có khối pre nào. Mọi bản hướng dẫn cũ
// nói "1 Action duy nhất" hoặc "mỗi sự kiện 1 body" đều SAI — đã bỏ.
//
// Quyết định 2026-11-12 (Chủ tịch chốt): KHÔNG làm file .tfc nữa. Cách duy
// nhất là tạo Action bằng tay trong TikFinity theo bài này — đã chạy thật
// trong các live trước.
//
// ĐIỂM QUAN TRỌNG NHẤT (phải nằm nổi bật ở đầu bài): link webhook KHÔNG
// dùng chung. Mỗi streamer có link riêng theo game + username TikTok của
// mình: /o/<game>/<username>/api/webhook. Username trong link cho server
// biết event thuộc phòng nào; dùng chung 1 link sẽ trộn event của mọi người
// vào cùng 1 game.
'use strict';

const { GAMES, isSupportedGame, webhookUrl } = require('./webhook-bodies');

const GAME_NAMES = {
  've-avatar': 'Vẽ Avatar',
  'buong-giam': 'Buồng Giam',
  'thap-sang-ban-do': 'Thắp Sáng Bản Đồ Việt Nam',
  'vuon-hoa-mua-xuan': 'Vườn Hoa Mùa Xuân',
  'bep-an-tap-the': 'Bếp Ăn Tập Thể – Nấu Cỗ',
  'dua-xe-leo-nui': 'Đua Xe Leo Núi',
  'vong-quay-may-man': 'Vòng Quay May Mắn Khổng Lồ',
  'bau-troi-phao-hoa': 'Bầu Trời Pháo Hoa',
  'keo-co': 'Kéo Co',
  'dau-truong-sinh-ton': 'Đấu Trường Sinh Tồn',
  'chiem-co': 'Chiếm Cờ',
  'dua-thuyen-rong': 'Đua Thuyền Rồng',
  'dau-tri': 'Đấu Trí',
  'di-bar-online': 'Đi Bar Online',
};

// 6 sự kiện TikFinity — mỗi sự kiện 1 URL riêng (?event=...) + 1 Action
// riêng + 1 Event riêng. "trigger" là tên đúng trong giao diện TikFinity.
const EVENTS = [
  { key: 'gift', label: 'Quà tặng', actionLabel: 'Quà', trigger: 'Sending a gift with min. coins value', triggerNote: 'đặt min = 1 để bắt mọi quà (KHÔNG dùng "Sending a specific gift")' },
  { key: 'chat', label: 'Bình luận', actionLabel: 'Bình luận', trigger: 'Chat (any comment)', triggerNote: '' },
  { key: 'like', label: 'Thả tim', actionLabel: 'Tim', trigger: 'Sending likes (taps)', triggerNote: '' },
  { key: 'follow', label: 'Theo dõi', actionLabel: 'Follow', trigger: 'Follow', triggerNote: '' },
  { key: 'share', label: 'Chia sẻ', actionLabel: 'Share', trigger: 'Share', triggerNote: '' },
  { key: 'join', label: 'Vào phòng', actionLabel: 'Vào phòng', trigger: 'Join', triggerNote: '' },
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Bỏ dấu tiếng Việt để đặt tên Action (vd "Vườn Hoa" -> "Vuon Hoa").
function removeDiacritics(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

// Tên Action của 1 sự kiện: "<Tên game> - <Sự kiện>", không dấu
// (vd "Vuon Hoa - Qua", "Buong Giam - Binh luan").
function actionNameFor(game, ev) {
  return `${removeDiacritics(GAME_NAMES[game] || game)} - ${removeDiacritics(ev.actionLabel)}`;
}

function eventUrl(base, game, username, key) {
  return `${webhookUrl(game, username, base)}?event=${key}`;
}

function isValidUsername(u) {
  return typeof u === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(u);
}

function cleanUsername(u) {
  if (typeof u !== 'string') return '';
  const s = u.trim().replace(/^@+/, '');
  return isValidUsername(s) ? s : '';
}

// Bảng 6 URL webhook của phòng (bước 1) + bảng tên Action (bước 2) —
// cá nhân hóa khi có game + username, không thì hiện dạng mẫu.
function eventUrlRows(game, username, base) {
  const personal = game && username;
  return EVENTS.map((ev) => {
    const url = personal
      ? eventUrl(base, game, username, ev.key)
      : `${esc(base)}/o/&lt;tên-game&gt;/&lt;tên-TikTok-của-bạn&gt;/api/webhook?event=${ev.key}`;
    const action = personal ? esc(actionNameFor(game, ev)) : esc(`${removeDiacritics(GAME_NAMES[game] || 'Ten game')} - ${removeDiacritics(ev.actionLabel)}`);
    const codeId = `guide-url-${ev.key}`;
    const copyBtn = personal
      ? ` <button onclick="navigator.clipboard&&navigator.clipboard.writeText(document.getElementById('${codeId}').textContent)">📋 Sao chép URL</button>`
      : '';
    return `<li style="margin-bottom:10px"><b>${esc(ev.label)}</b> — Action <b>${action}</b><br><code id="${codeId}" style="background:#fff7d6;padding:4px 8px;border-radius:6px;word-break:break-all;font-size:14px">${url}</code>${copyBtn}</li>`;
  }).join('\n');
}

// Danh sách 6 Action cần tạo (bước 2): chỉ tên Action + sự kiện — URL đã
// có ở bước 1, không lặp lại để tránh trùng id.
function actionRows(game) {
  return EVENTS.map((ev) => `<li style="margin-bottom:6px">Action <b>${esc(actionNameFor(game, ev))}</b> — dán URL của sự kiện <b>${esc(ev.label)}</b> (đã sao chép ở bước 1).</li>`).join('\n');
}
function eventTriggerRows(game) {
  return EVENTS.map((ev) => {
    const note = ev.triggerNote ? ` <span style="color:#b91c1c">(${esc(ev.triggerNote)})</span>` : '';
    return `<li style="margin-bottom:6px"><b>${esc(ev.label)}</b> — trigger <b>${esc(ev.trigger)}</b>${note} → ở ô “Trigger all of these actions” chọn Action <b>${esc(actionNameFor(game, ev))}</b>.</li>`;
  }).join('\n');
}

// Trang hướng dẫn đầy đủ. opts: { game?, username?, baseUrl? }.
// - game + username hợp lệ: trang cá nhân hóa cho đúng phòng (hiện đúng
//   6 URL webhook của phòng + tên Action đúng game).
// - không có game/username: trang chung — giải thích link riêng + cho chọn
//   game, hiện 6 URL dạng mẫu.
function buildGuideHtml(opts = {}) {
  const game = isSupportedGame(opts.game) ? opts.game : '';
  const username = cleanUsername(opts.username);
  const base = String(opts.baseUrl || 'https://live-game-platform-production.up.railway.app').replace(/\/+$/, '');
  const personal = game && username;

  const gameButtons = Object.keys(GAMES).map((g) => {
    const q = `?game=${encodeURIComponent(g)}${username ? `&username=${encodeURIComponent(username)}` : ''}`;
    const active = g === game ? ' style="background:#0369a1;color:#fff;border-color:#0369a1"' : '';
    return `<a href="/huong-dan-tikfinity${q}"><button${active}>${esc(GAME_NAMES[g] || g)}</button></a>`;
  }).join(' ');

  const urlBox = personal
    ? `<p><b>6 URL webhook của bạn (game ${esc(GAME_NAMES[game])}, TikTok @${esc(username)}):</b></p>\n<p>Link webhook của phòng này: <code id="guide-webhook-url" style="background:#fff7d6;padding:4px 8px;border-radius:6px;word-break:break-all;font-size:14px">${esc(webhookUrl(game, username, base))}</code> — mỗi sự kiện dùng link này + <code>?event=…</code> riêng:</p>\n<ul>\n${eventUrlRows(game, username, base)}\n</ul>`
    : `<p><b>Dạng link webhook của bạn:</b></p>\n<p><code style="background:#fff7d6;padding:4px 8px;border-radius:6px;word-break:break-all;font-size:14px">${esc(base)}/o/&lt;tên-game&gt;/&lt;tên-TikTok-của-bạn&gt;/api/webhook</code></p>\n<p>Mỗi sự kiện dùng link này + <code>?event=…</code> riêng — 6 URL dạng mẫu:</p>\n<ul>\n${eventUrlRows('', '', base)}\n</ul>\n<p>Link đúng của bạn hiện sẵn trong dashboard của phòng (mục “🎯 Cài đặt TikFinity”, 6 URL theo sự kiện + nút Sao chép) — sao chép ở đó cho chắc, đừng gõ tay. Chọn game của bạn để xem đúng 6 URL + tên Action của game đó:</p>\n<p>${gameButtons}</p>`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hướng dẫn cài đặt TikFinity — Nền tảng Live Game</title>
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;max-width:860px;margin:0 auto;padding:20px 16px 60px;color:#111827;line-height:1.7;background:#fff}
h1{font-size:24px;line-height:1.3} h2{font-size:19px;margin-top:28px;border-top:1px solid #e5e7eb;padding-top:18px} h3{font-size:16px;margin-top:20px}
.warn{background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:14px 16px}
.ok{background:#ecfdf5;border:1px solid #10b981;border-radius:10px;padding:14px 16px}
code{font-size:14px} button{cursor:pointer;padding:6px 12px;border:1px solid #d1d5db;border-radius:8px;background:#f9fafb;font-size:14px}
ol,ul{padding-left:24px} li{margin-bottom:6px}
a{color:#0369a1}
</style>
</head>
<body>
<h1>🎯 Hướng dẫn cài đặt TikFinity — kết nối game với TikTok LIVE</h1>
<p>Game nhận sự kiện live (bình luận, quà, tim, follow, share, vào phòng) qua <b>TikFinity</b> chạy trên máy Windows của bạn. TikFinity gửi sự kiện về máy chủ qua webhook. Cài 1 lần theo bài này là dùng cho mọi buổi live sau — chỉ làm lại khi đổi game hoặc đổi tài khoản TikTok.</p>

<div class="warn">
<h2 style="border:0;margin:0 0 8px;padding:0">⚠️ QUAN TRỌNG: link webhook KHÔNG dùng chung — mỗi người 1 link riêng</h2>
<p style="margin:0">Link webhook của bạn có dạng:</p>
<p><code style="font-size:15px"><b>${esc(base)}/o/&lt;tên-game&gt;/&lt;tên-TikTok-của-bạn&gt;/api/webhook</b></code></p>
<p><b>Username TikTok trong link cho máy chủ biết event thuộc phòng nào.</b> Mỗi streamer phải dùng link của riêng mình — lấy từ dashboard của phòng mình, đừng lấy link của người khác, đừng đăng link của mình lên chỗ công cộng cho người khác dùng.</p>
<p><b>Ví dụ nếu dùng chung:</b> bạn A live bằng tài khoản @a_live nhưng dán link webhook của bạn B (…/o/ve-avatar/b_live/api/webhook) vào TikFinity — mọi comment, quà, tim của khán giả phòng A sẽ đổ hết vào game của B, còn game của A thì không nhận được gì. Hai người live cùng lúc mà dùng chung 1 link thì event của cả hai trộn vào cùng 1 game, không gỡ ra được.</p>
<p style="margin-bottom:0"><b>Mỗi sự kiện dùng 1 URL riêng</b> (link webhook + <code>?event=…</code>). 6 URL của bạn ở bước 1 — đừng dùng URL của phòng khác, cũng đừng đăng URL của mình lên chỗ công cộng.</p>
</div>

<h2>Bước 1 — Lấy 6 URL webhook của bạn</h2>
${urlBox}
<p><b>Mẹo — URL chung cho mọi game:</b> thay vì URL riêng của phòng, bạn có thể dùng URL chung <code>${esc(base)}/api/webhook?game=&lt;tên-game&gt;&amp;room=&lt;tên-TikTok-của-bạn&gt;&amp;event=&lt;loại&gt;</code> — cùng tác dụng, đổi game chỉ cần sửa <code>game=</code> và <code>room=</code> trong URL. Vẫn cần <b>1 Action cho mỗi loại sự kiện</b> (mỗi Action 1 <code>event=</code> riêng) vì TikFinity không gửi loại sự kiện trong body — URL gốc không có <code>event=</code> thì Follow/Vào phòng bị bỏ qua, Thả tim bị nhận nhầm thành Quà.</p>
<p>6 URL này có sẵn trong dashboard của phòng (mở dashboard → mục “🎯 Cài đặt TikFinity” → sao chép từng URL theo sự kiện). Dán từng URL đúng sự kiện của nó ở bước 2 — dán nhầm URL là game nhận nhầm loại sự kiện (vd quà tính thành bình luận).</p>

<h2>Bước 2 — Tạo 6 Action webhook trong TikFinity</h2>
<p>Tạo 6 Action riêng, mỗi Action cho 1 sự kiện. Với mỗi Action: chọn loại <b>Webhook</b> (Trigger WebHook), Method <b>POST</b>, rồi dán URL của đúng sự kiện đó (đã sao chép ở bước 1):</p>
<ul>
${personal ? actionRows(game) : EVENTS.map((ev) => `<li style="margin-bottom:6px">Action <b>${esc(removeDiacritics(GAME_NAMES[game] || 'Ten game'))} - ${esc(removeDiacritics(ev.actionLabel))}</b> — dán URL của sự kiện <b>${esc(ev.label)}</b> (đã sao chép ở bước 1).</li>`).join('\n')}
</ul>
<p><b>Không cần nhập body:</b> action “Trigger WebHook” của TikFinity chỉ có ô URL, không có ô body — TikFinity tự gửi sẵn nội dung sự kiện (tên tài khoản, nội dung/tên quà, số xu…), bạn không cần nhập gì thêm. Máy chủ phân biệt loại sự kiện bằng <code>?event=…</code> trên URL, nên chỉ cần dán đúng URL là đủ.</p>

<h2>Bước 3 — Tạo 6 Event, mỗi Event chọn đúng trigger + đúng Action</h2>
<p>Trong TikFinity, tạo 6 Event. Mỗi Event chọn đúng trigger, rồi ở ô <b>“Trigger all of these actions”</b> chọn đúng Action đã tạo ở bước 2:</p>
<ul>
${personal ? eventTriggerRows(game) : EVENTS.map((ev) => `<li style="margin-bottom:6px"><b>${esc(ev.label)}</b> — trigger <b>${esc(ev.trigger)}</b>${ev.triggerNote ? ` <span style="color:#b91c1c">(${esc(ev.triggerNote)})</span>` : ''} → ở ô “Trigger all of these actions” chọn Action <b>${esc(removeDiacritics(GAME_NAMES[game] || 'Ten game'))} - ${esc(removeDiacritics(ev.actionLabel))}</b>.</li>`).join('\n')}
</ul>
<p>Chọn game của bạn ở bước 1 để xem tên Action đúng game (tên Action theo mẫu “&lt;Tên game&gt; - &lt;Sự kiện&gt;”, không dấu).</p>

<h2>Bước 4 — Thứ tự lên live (bắt buộc đúng thứ tự) + kiểm chứng</h2>
<ol>
<li>Kiểm tra 6 Action vừa tạo đang <b>bật</b> (enabled). Action tắt thì TikFinity không gửi gì cả.</li>
<li><b>Tắt “Chế độ thử” trong dashboard của phòng</b> trước khi live thật (mục cài đặt phòng). Phòng đang bật chế độ thử thì game bỏ qua mọi sự kiện thật — quên tắt là live chạy mà game đứng yên.</li>
<li>Mở <b>TikTok LIVE Studio</b> → bấm <b>Go LIVE</b> TRƯỚC.</li>
<li>Sau khi đã Go LIVE, quay sang TikFinity bấm <b>Connect</b>.</li>
<li>Link overlay của game đã dán sẵn trong LIVE Studio làm nguồn Link (1080 × 1920) từ trước.</li>
</ol>
<p><b>Nhắc lại:</b> Go LIVE trước, Connect sau. Connect trước khi live thì TikFinity không bắt được phiên live đó.</p>
<p><b>Kiểm chứng đã nối đúng chưa:</b> quay lại dashboard của phòng → nhìn thẻ <b>“📡 Kết nối trực tiếp TikTok LIVE”</b> (cũng là đèn báo sự kiện TikFinity): sau comment/tim/quà đầu tiên của khán giả, <b>số sự kiện phải &gt; 0</b>. Số sự kiện &gt; 0 là TikFinity đã nối đúng — game sẽ phản ứng ngay với comment/quà/tim.</p>
<p>Nếu vẫn 0 sau vài phút có tương tác, kiểm tra theo thứ tự:</p>
<ul>
<li>URL trong mỗi Action có đúng game + đúng username TikTok đang live không (sai username là game theo dõi nhầm tài khoản), và có đúng <code>?event=…</code> của sự kiện đó không (dán nhầm URL là game nhận nhầm loại sự kiện).</li>
<li>Đã Go LIVE trước rồi mới Connect chưa.</li>
<li>6 Action có đang bật không, mỗi Event có chọn đúng Action của nó không.</li>
</ul>

<div class="ok">
<p style="margin:0"><b>Đổi game hoặc đổi tài khoản TikTok?</b> Tạo phòng mới cho game/tài khoản mới — mỗi phòng có 6 URL webhook riêng của nó. Sửa lại URL trong 6 Action đã tạo (bước 2) theo 6 URL mới là dùng được, không cần tạo lại Event. Dùng URL chung <code>${esc(base)}/api/webhook?game=&lt;tên-game&gt;&amp;room=&lt;tên-TikTok&gt;&amp;event=&lt;loại&gt;</code> thì đổi game chỉ cần sửa <code>game=</code> và <code>room=</code> trong từng Action, giữ nguyên <code>event=</code>.</p>
</div>

<p style="margin-top:24px"><a href="/">← Về trang chính</a></p>
</body>
</html>
`;
}

module.exports = { buildGuideHtml, GAME_NAMES, EVENTS, actionNameFor, eventUrl, isValidUsername, cleanUsername };
