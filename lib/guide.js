// lib/guide.js — Bài hướng dẫn cài đặt TikFinity (tạo Action bằng tay).
// Trang độc lập, không phụ thuộc file ngoài, render từ bảng body chuẩn
// trong lib/webhook-bodies.js (cùng 1 nguồn sự thật với dashboard + test).
//
// Quyết định 2026-11-12 (Chủ tịch chốt): KHÔNG làm file .tfc nữa. Cách duy
// nhất là tạo Action bằng tay trong TikFinity theo bài này — đã chạy thật
// trong các live trước.
//
// ĐIỂM QUAN TRỌNG NHẤT (phải nằm nổi bật ở đầu bài): link webhook KHÔNG
// dùng chung. Mỗi streamer có link riêng theo game + username TikTok của
// mình: /o/<game>/<username>/api/webhook. Username trong link cho server
// biết event thuộc phòng nào; dùng chung 1 link sẽ trộn event của mọi người
// vào cùng 1 game. Body Action thì giống nhau cho mọi người — chỉ khác URL.
'use strict';

const { GAMES, isSupportedGame, webhookUrl, eventBodies } = require('./webhook-bodies');

const GAME_NAMES = {
  've-avatar': 'Vẽ Avatar',
  'buong-giam': 'Buồng Giam',
  'thap-sang-ban-do': 'Thắp Sáng Bản Đồ Việt Nam',
  'vuon-hoa-mua-xuan': 'Vườn Hoa Mùa Xuân',
};

// Chỉ escape & < > — body JSON không chứa 3 ký tự này nên hiện nguyên văn
// trong <pre> (test kiểm chứng body trong trang khớp đúng bảng chuẩn).
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isValidUsername(u) {
  return typeof u === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(u);
}

function cleanUsername(u) {
  if (typeof u !== 'string') return '';
  const s = u.trim().replace(/^@+/, '');
  return isValidUsername(s) ? s : '';
}

// Bảng body JSON mẫu cho 1 game (render từ eventBodies — khớp đúng parser).
function bodiesTable(game) {
  const bodies = eventBodies(game);
  const rows = bodies.map((e) => {
    const shareNote = e.key === 'share' && game === 'buong-giam'
      ? ' <b style="color:#b91c1c">(⚠️ buồng giam đọc 8 là “rời phòng”, KHÔNG dùng 8 cho share)</b>'
      : '';
    return `<h4>${esc(e.label)} — triggerTypeId ${e.triggerTypeId}${shareNote}</h4>\n<pre>${esc(e.body)}</pre>`;
  }).join('\n');
  return rows;
}

// Trang hướng dẫn đầy đủ. opts: { game?, username?, baseUrl? }.
// - game + username hợp lệ: trang cá nhân hóa cho đúng phòng (hiện đúng
//   webhook URL của phòng + bảng body của game đó mở sẵn).
// - không có game/username: trang chung — giải thích link riêng + cho chọn
//   game, hiện bảng body của cả 3 game (bấm để mở).
function buildGuideHtml(opts = {}) {
  const game = isSupportedGame(opts.game) ? opts.game : '';
  const username = cleanUsername(opts.username);
  const base = String(opts.baseUrl || 'https://live-game-platform-production.up.railway.app').replace(/\/+$/, '');
  const personal = game && username;
  const url = personal ? webhookUrl(game, username, base) : '';

  const gameButtons = Object.keys(GAMES).map((g) => {
    const q = `?game=${encodeURIComponent(g)}${username ? `&username=${encodeURIComponent(username)}` : ''}`;
    const active = g === game ? ' style="background:#0369a1;color:#fff;border-color:#0369a1"' : '';
    return `<a href="/huong-dan-tikfinity${q}"><button${active}>${esc(GAME_NAMES[g])}</button></a>`;
  }).join(' ');

  const tables = Object.keys(GAMES).map((g) => {
    const open = g === game ? ' open' : '';
    return `<details${open}>\n<summary style="cursor:pointer;font-size:16px;font-weight:700">Body mẫu — game ${esc(GAME_NAMES[g])}</summary>\n${bodiesTable(g)}\n</details>`;
  }).join('\n');

  const urlBox = personal
    ? `<p><b>Link webhook của bạn (game ${esc(GAME_NAMES[game])}, TikTok @${esc(username)}):</b></p>\n<p><code id="guide-webhook-url" style="background:#fff7d6;padding:6px 10px;border-radius:6px;word-break:break-all;font-size:15px">${esc(url)}</code> <button onclick="navigator.clipboard&&navigator.clipboard.writeText(document.getElementById('guide-webhook-url').textContent)">📋 Sao chép</button></p>`
    : `<p><b>Dạng link webhook của bạn:</b></p>\n<p><code style="background:#fff7d6;padding:6px 10px;border-radius:6px;word-break:break-all;font-size:15px">${esc(base)}/o/&lt;tên-game&gt;/&lt;tên-TikTok-của-bạn&gt;/api/webhook</code></p>\n<p>Link đúng của bạn hiện sẵn trong dashboard của phòng (mục “🎯 Cài đặt TikFinity”, ô “Webhook của phòng này” + nút Sao chép) — sao chép ở đó cho chắc, đừng gõ tay. Chọn game của bạn để xem bảng body đúng game:</p>\n<p>${gameButtons}</p>`;

  const actionName = game ? GAMES[game].actionName : '“Tên game - Moi su kien” (vd. Ve Avatar - Moi su kien)';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hướng dẫn cài đặt TikFinity — Nền tảng Live Game</title>
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;max-width:860px;margin:0 auto;padding:20px 16px 60px;color:#111827;line-height:1.7;background:#fff}
h1{font-size:24px;line-height:1.3} h2{font-size:19px;margin-top:28px;border-top:1px solid #e5e7eb;padding-top:18px} h3{font-size:16px;margin-top:20px} h4{font-size:14px;margin:14px 0 4px}
.warn{background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:14px 16px}
.ok{background:#ecfdf5;border:1px solid #10b981;border-radius:10px;padding:14px 16px}
pre{background:#0b1226;color:#cfe0ff;padding:12px;border-radius:8px;overflow-x:auto;font-size:13px;white-space:pre-wrap;word-break:break-all}
code{font-size:14px} button{cursor:pointer;padding:6px 12px;border:1px solid #d1d5db;border-radius:8px;background:#f9fafb;font-size:14px}
ol,ul{padding-left:24px} li{margin-bottom:6px} details{margin:10px 0}
a{color:#0369a1}
</style>
</head>
<body>
<h1>🎯 Hướng dẫn cài đặt TikFinity — kết nối game với TikTok LIVE</h1>
<p>Game nhận sự kiện live (bình luận, quà, tim, follow, share, vào phòng) qua <b>TikFinity</b> chạy trên máy Windows của bạn. TikFinity gửi sự kiện về máy chủ qua 1 link webhook. Cài 1 lần theo bài này là dùng cho mọi buổi live sau — chỉ làm lại khi đổi game hoặc đổi tài khoản TikTok.</p>

<div class="warn">
<h2 style="border:0;margin:0 0 8px;padding:0">⚠️ QUAN TRỌNG: link webhook KHÔNG dùng chung — mỗi người 1 link riêng</h2>
<p style="margin:0">Link webhook của bạn có dạng:</p>
<p><code style="font-size:15px"><b>${esc(base)}/o/&lt;tên-game&gt;/&lt;tên-TikTok-của-bạn&gt;/api/webhook</b></code></p>
<p><b>Username TikTok trong link cho máy chủ biết event thuộc phòng nào.</b> Mỗi streamer phải dùng link của riêng mình — lấy từ dashboard của phòng mình, đừng lấy link của người khác, đừng đăng link của mình lên chỗ công cộng cho người khác dùng.</p>
<p><b>Ví dụ nếu dùng chung:</b> bạn A live bằng tài khoản @a_live nhưng dán link webhook của bạn B (…/o/ve-avatar/b_live/api/webhook) vào TikFinity — mọi comment, quà, tim của khán giả phòng A sẽ đổ hết vào game của B, còn game của A thì không nhận được gì. Hai người live cùng lúc mà dùng chung 1 link thì event của cả hai trộn vào cùng 1 game, không gỡ ra được.</p>
<p style="margin-bottom:0"><b>Body Action thì giống nhau cho mọi người — chỉ khác URL.</b> Bảng body mẫu ở bước 4 dùng chung cho tất cả, bạn chỉ cần thay đúng link webhook của mình ở bước 3.</p>
</div>

<h2>Bước 1 — Lấy link webhook của bạn</h2>
${urlBox}
<p>Link này có sẵn trong dashboard của phòng (mở dashboard → mục “🎯 Cài đặt TikFinity” → ô “Webhook của phòng này” → nút <b>📋 Sao chép</b>). Dán link này vào TikFinity ở bước 3.</p>

<h2>Bước 2 — Tạo Action mới trong TikFinity</h2>
<ol>
<li>Mở <b>TikFinity</b> trên máy Windows.</li>
<li>Vào phần <b>Actions</b> (danh sách Action) → tạo 1 Action mới, đặt tên <b>${esc(actionName)}</b>.</li>
<li>Chỉ tạo <b>1 Action duy nhất</b> cho cả 6 sự kiện bên dưới — đừng tạo 6 Action riêng, sẽ khó quản lý và dễ bật thiếu.</li>
</ol>

<h2>Bước 3 — Thêm trigger Webhook POST vào Action</h2>
<ol>
<li>Trong Action vừa tạo, thêm 1 trigger loại <b>Webhook</b> (gửi HTTP request).</li>
<li>Đặt Method là <b>POST</b>, Content-Type là <b>application/json</b>.</li>
<li>Ô URL: dán đúng <b>link webhook của bạn</b> đã sao chép ở bước 1 (link riêng theo game + username của bạn, không phải link mẫu).</li>
</ol>

<h2>Bước 4 — Gắn 6 sự kiện vào cùng Action, mỗi sự kiện 1 body riêng</h2>
<p>Trong cùng Action đó, gắn 6 sự kiện: <b>Gift</b> (quà tặng), <b>Chat</b> (bình luận), <b>Like</b> (thả tim), <b>Follow</b> (theo dõi), <b>Share</b> (chia sẻ), <b>Viewer joined</b> (vào phòng). Mỗi sự kiện gửi đúng body mẫu của nó (sao chép nguyên văn, chỉ thay biến $… bằng nút chèn biến của TikFinity):</p>
${tables}
<p><b>Lưu ý khi nhập body:</b></p>
<ul>
<li>Tên biến (<code>$userId</code>, <code>$nickname</code>, <code>$uniqueId</code>, <code>$comment</code>…) tùy phiên bản TikFinity — bấm nút chèn biến (insert variable) của TikFinity để lấy đúng tên. Nếu không có <code>$uniqueId</code> thì dùng biến tên TikTok mà TikFinity gợi ý, hoặc bỏ trường <code>uniqueId</code> (engine tự dùng nickname thay thế).</li>
<li>Số (<code>$diamondCount</code>, <code>$repeatCount</code>, <code>$likeCount</code>) để <b>trần, không ngoặc kép</b> — TikFinity thay bằng số thật khi gửi. Số xu chỉ lấy <code>$diamondCount</code> thật, không bịa.</li>
<li>Trường <code>"event"</code> (gift/chat/like/follow/share/join) là <b>bắt buộc</b>, nhất là với game Thắp Sáng Bản Đồ — game này không đọc <code>triggerTypeId</code>, và follow/join không suy ra được nếu thiếu chuỗi loại sự kiện.</li>
<li>Share khác nhau theo game: Vẽ Avatar dùng <code>triggerTypeId 8</code>, Thắp Sáng Bản Đồ dùng <code>8</code>, riêng Buồng Giam dùng <code>4</code> (buồng giam đọc 8 là “rời phòng”).</li>
</ul>

<h2>Bước 5 — Thứ tự lên live (bắt buộc đúng thứ tự)</h2>
<ol>
<li>Kiểm tra Action vừa tạo đang <b>bật</b> (enabled). Action tắt thì TikFinity không gửi gì cả.</li>
<li>Mở <b>TikTok LIVE Studio</b> → bấm <b>Go LIVE</b> TRƯỚC.</li>
<li>Sau khi đã Go LIVE, quay sang TikFinity bấm <b>Connect</b>.</li>
<li>Link overlay của game đã dán sẵn trong LIVE Studio làm nguồn Link (1080 × 1920) từ trước.</li>
</ol>
<p><b>Nhắc lại:</b> Go LIVE trước, Connect sau. Connect trước khi live thì TikFinity không bắt được phiên live đó.</p>

<h2>Bước 6 — Kiểm chứng đã nối đúng chưa</h2>
<ol>
<li>Quay lại dashboard của phòng → nhìn thẻ <b>“📡 Kết nối trực tiếp TikTok LIVE”</b> (cũng là đèn báo sự kiện TikFinity): sau comment/tim/quà đầu tiên của khán giả, <b>số sự kiện phải &gt; 0</b>.</li>
<li>Số sự kiện &gt; 0 là TikFinity đã nối đúng — game sẽ phản ứng ngay với comment/quà/tim.</li>
<li>Nếu vẫn 0 sau vài phút có tương tác, kiểm tra theo thứ tự:
<ul>
<li>Link webhook trong Action có đúng game + đúng username TikTok đang live không (sai username là game theo dõi nhầm tài khoản).</li>
<li>Đã Go LIVE trước rồi mới Connect chưa (xem bước 5).</li>
<li>Action có đang bật không, trigger Webhook có đúng URL không.</li>
<li>Body từng sự kiện có đúng mẫu ở bước 4 không (nhất là trường <code>"event"</code> và số để trần không ngoặc kép).</li>
</ul></li>
</ol>

<div class="ok">
<p style="margin:0"><b>Đổi game hoặc đổi tài khoản TikTok?</b> Tạo phòng mới cho game/tài khoản mới — mỗi phòng có link webhook riêng của nó. Action cũ vẫn dùng được nếu chỉ cần sửa lại URL webhook (bước 3) và body share nếu đổi game (bước 4).</p>
</div>

<p style="margin-top:24px"><a href="/">← Về trang chính</a></p>
</body>
</html>
`;
}

module.exports = { buildGuideHtml, GAME_NAMES, isValidUsername, cleanUsername };
