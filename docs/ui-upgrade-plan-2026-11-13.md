# Kế hoạch nâng cấp giao diện + chức năng 14 overlay TikTok LIVE

- Ngày: 2026-11-13
- Người lập: QA kiêm thiết kế UI — Strom
- Phạm vi: chỉ lập kế hoạch, **không sửa code overlay**. File này là bản thiết kế để code theo.
- Nguồn: đọc trực tiếp `games/<slug>/src/public/overlay.html` của cả 14 game, `shared/music.js`, `public/landing.html` (ngày 2026-11-13).
- Bối cảnh: Chủ tịch nhận xét overlay hiện tại "nhìn phèn quá" — trông rẻ tiền, thiếu đẳng cấp. Mục tiêu: nâng toàn bộ 14 game lên chuẩn "sân khấu livestream" — nhìn là biết phòng live chuyên nghiệp, mọi sự kiện (quà, tap, follow, chat, join) đều có phản hồi thị giác + âm thanh rõ ràng.

---

## 1. Chẩn đoán chung — vì sao trông "phèn"

Đọc hết 14 file, có 8 nguyên nhân gốc lặp lại ở hầu hết các game. Sửa 8 điểm này là đã hết 70% cảm giác rẻ tiền.

### 1.1. Font chữ: không có font thật nào được load

- **0/14 overlay load font ngoài** (không có link Google Fonts nào).
- 5 game dùng `"Be Vietnam Pro"` trong `font-family` (bếp ăn, đua xe, vòng quay, bầu trời, thắp sáng, chiếm cờ, đua thuyền, đấu trí) nhưng **không hề load font này** — máy nào không cài sẵn Be Vietnam Pro thì trình duyệt tự rớt về `system-ui`. Tức là "font đẹp" hiện tại chỉ là may rủi theo máy streamer.
- 3 game dùng `"Segoe UI", Verdana` (vườn hoa, kéo co, đấu trường) — Segoe UI là font văn phòng, không có cá tính, nhìn như slide PowerPoint.
- Vẽ avatar dùng `Georgia, 'Times New Roman', serif` — serif cổ điển, hợp khung tranh nhưng lạc tông TikTok.
- Đi Bar dùng `system-ui` thuần.
- **Hậu quả:** tiêu đề các game trông giống nhau, không có "chữ thương hiệu" nào để nhận diện Strom.

### 1.2. Nền: gradient 2–3 màu phẳng, không có chiều sâu

- Hầu hết nền chỉ là `linear-gradient(180deg, màu A, màu B)` với điểm dừng cứng. Ví dụ:
  - `vuon-hoa-mua-xuan` dòng 59: `#7ec8f7 → #aee3ff → #e8f7d9 → #8fce62` (trời xanh chuyển sang cỏ — chuyển màu gắt ở 45%).
  - `keo-co` dòng 71: `#1b4d8a → #3a7bd5 → #8a5a2b → #6b4423` (trời xanh đột ngột thành đất nâu ở 62%).
  - `dau-truong-sinh-ton` dòng 60: `#0d1b2e → #1b3a5c → #2c2118`.
  - `dua-thuyen-rong` dòng 9: `#7dd3fc → #38bdf8 → #0ea5e9` (3 sắc xanh dương liền nhau, không có điểm nhấn).
- Không có: texture, vignette (tối 4 góc), hạt nhiễu (grain), lớp cảnh xa/gần, ánh sáng (glow) — nên nền nhìn như "tô màu" thay vì "một nơi chốn".
- Ngoại lệ tốt: `thap-sang-ban-do` dùng ảnh nền thật (`/trong-dong-bg.jpg`) + lớp phủ tối radial + panel kính mờ (`backdrop-filter: blur(8px)` dòng 27); `buong-giam` dùng ảnh nền thật (`/assets/nen-tu-anh-41.webp`).

### 1.3. Hình ảnh chính = emoji to, không có đồ hoạ thật

- 12/14 game dùng emoji làm hình ảnh chính: nồi `🍲` 330px (bếp ăn), xe `🏎️` 92px (đua xe), thuyền `🐉🛶` 110px (đua thuyền), cờ `🏳️` (chiếm cờ), vũ công `🕺` 88px (đi bar), hoa `🌸` (vườn hoa), mặt trời `☀️` 90px, mây `☁️`.
- Emoji render khác nhau theo hệ điều hành (Windows vs Mac vs Android) — cùng một overlay, mỗi máy khán giả thấy một kiểu hình khác nhau. Không kiểm soát được.
- Chỉ 3 game có tài sản hình thật: `buong-giam` (ảnh PNG/WebP: nền tù, khung ăn gà 3 frame, bàn mâm, ghế), `ve-avatar` (`bg-paper.webp`, `rail.webp`), `thap-sang-ban-do` (bản đồ SVG 34 tỉnh + ảnh trống đồng).
- Emoji vẫn dùng được làm **icon phụ** (huy hiệu, nhãn, nút), nhưng không được làm **nhân vật/cảnh chính**.

### 1.4. Tiêu đề: chữ hoa + text-shadow cứng, kiểu 2010

- Mẫu lặp lại ở 10 game: `h1 { font-size: 48–64px; text-shadow: 0 3px 0 #màu, 0 6px 18px rgba(0,0,0,.4); }` — bóng đổ đặc, không có gradient chữ, không có viền sáng, không có khoảng chữ (letter-spacing chỉ 1–2px, riêng `chiem-co` 6px và `dua-thuyen-rong`/`dau-tri` 4px là khá).
- Mọi tiêu đề đều mở đầu bằng emoji + chữ hoa toàn bộ (`🍲 BẾP ĂN TẬP THỂ 🍲`, `🪢 KÉO CO 🪢`) — nhìn như banner chợ, không như logo game.

### 1.5. Panel: hộp đen mờ, không có chiều sâu

- Mẫu lặp lại: `background: rgba(0,0,0,.4–.55); border-radius: 16–22px;` — hộp đen trong suốt, không viền, không bóng đổ thật, không blur.
- Số `box-shadow` trong CSS mỗi file (chỉ tính panel): `dua-thuyen-rong` 0, `chiem-co` 1, `dau-tri` 1, `bep-an-tap-the` 2, `dua-xe-leo-nui` 2, `keo-co` 3, `bau-troi-phao-hoa` 3, `dau-truong-sinh-ton` 4, `vuon-hoa-mua-xuan` 5, `vong-quay-may-man` 6.
- Chỉ 2 game dùng `backdrop-filter: blur()` (kính mờ thật): `thap-sang-ban-do` và `buong-giam`. Còn lại là hộp đen phẳng đè lên nền — cảm giác "dán giấy lên màn hình".

### 1.6. Animation: gần như không có chuyển động

Số `@keyframes` mỗi file:

| Game | @keyframes | Nhận xét |
|---|---|---|
| chiem-co | 0 | Hoàn toàn tĩnh — cờ không vẫy, không có chuyển động nào |
| dua-xe-leo-nui | 1 | Chỉ có `winbounce` khi thắng |
| vong-quay-may-man | 1 | Chỉ có `epicGlow` khi trúng lớn |
| keo-co | 1 | Chỉ có `pop` của banner |
| bau-troi-phao-hoa | 2 | `flash` (đếm ngược) + `bubbleIn` |
| dau-truong-sinh-ton | 2 | `floatUp` (số damage bay) + `pop` |
| dua-thuyen-rong | 2 | `surge` (thuyền vọt) + `flash` (trống) |
| dau-tri | 2 | `correctBlink` + `floatUp` (tim bay) |
| bep-an-tap-the | 3 | `steam`, `bubble`, `flame` |
| ve-avatar | 3 | `t4halo`, `t4pulse`, `t5pulse` |
| vuon-hoa-mua-xuan | 4 | `drift` (mây), `sway` (hoa), `pop`, `fly` (ong) |
| thap-sang-ban-do | 9 | `shimmer`, `avatarDrop`, `litPulse`, `topPulse`, `flash`, `bob`, `ringExp`, `fw`, `livePulse` |
| di-bar-online | 16 | Laser, EQ, disco quay, dancer nhảy, confetti, camera… |
| buong-giam | 27 | Ăn gà 4 frame, hơi nước, rung mâm, nametag pulse, banner… |

- 9/14 game có ≤ 3 keyframes. Phòng live mà màn hình đứng yên thì khán giả tưởng ảnh tĩnh — đây là lý do lớn nhất khiến overlay "nhìn phèn".
- Chuyển đổi trạng thái cũng thô: banner dùng `display: none → block` + `pop .4s` ở gần như mọi game, không có confetti, không có flash sáng màn hình, không có rung.

### 1.7. Phản hồi sự kiện: chỉ đổi số, không "nổ"

- Khi có quà/tap/follow, đa số game chỉ: cập nhật con số + đọc TTS. Không có:
  - Flash sáng toàn màn hình khi quà lớn (chỉ `di-bar-online` có `#beat-flash`, `bau-troi-phao-hoa` có canvas pháo hoa).
  - Chữ `+10đ` / `-5 HP` bay lên (chỉ `dau-truong-sinh-ton` có `.hit-float`, `dau-tri` có tim bay `❤️`).
  - Rung/lắc phần tử bị tác động (chỉ `dua-thuyen-rong` có `surge`, `vong-quay-may-man` có `epicGlow`).
  - Confetti (chỉ `di-bar-online` có `confettiBurst()`).
- Ticker (dòng chạy sự kiện) ở 10 game là khối chữ tĩnh thay bằng `innerHTML` — không cuộn, không có hiệu ứng dòng mới trượt vào. Chỉ `di-bar-online` có marquee thật (LED chính), nhưng marquee này có khoảng trống giữa 2 vòng lặp.
- Trùng lặp thừa: `bau-troi-phao-hoa` dòng ticker và dòng info dưới cùng **in cùng một câu** ("Tap 20 = 1 pháo • Comment = 1 pháo…"); `dua-xe-leo-nui` cũng vậy (ticker = info).

### 1.8. Chữ nhỏ, bảng xếp hạng đơn điệu, badge demo không thống nhất

- Chữ quá nhỏ trên khung 1080px (khi lên OBS thu nhỏ còn ~560px thì gần như không đọc được):
  - `vuon-hoa-mua-xuan`: tên người trồng `.plot .nm` 15px, giai đoạn `.st` 13px.
  - `keo-co`: tên người kéo `.puller .nm` 19px, lực `.fc` 17px, nhãn đích/vạch 18px.
  - `chiem-co`: `.capnum` 22px, `.rate` 22px, `#hint` 22px.
  - `dau-tri`: `.top-list .row` 24px, `#hint` 22px.
- Bảng xếp hạng ở 11 game là danh sách text thuần (`🥇 Tên — Xđ`), không có: avatar to, thanh điểm, màu hạng 1/2/3, highlight khi đổi hạng, animation khi có người mới vào top. Ngoại lệ: `buong-giam` đã có `.rank-1/.rank-2/.rank-3` (vàng/bạc/đồng + glow).
- Avatar người chơi chỉ 52–56px ở hầu hết game (`bep-an-tap-the` 52px, `dua-xe-leo-nui` 54px, `bau-troi-phao-hoa` 56px) — quá nhỏ so với khung 1080px, không nhận ra mặt.
- Badge DEMO có **3 kiểu khác nhau**: góc trái trên, nền `#b8860b`, bo 999px (8 game: vườn hoa, bếp ăn, đua xe, vòng quay, bầu trời, kéo co, đấu trường…); góc phải trên, nền `#f59e0b`, bo 14px (chiếm cờ, đấu trí, đua thuyền); `di-bar-online` dùng class `body.demo` (badge vàng `#facc15`).
- Trạng thái trống ("Chưa có ai…") ở mọi game chỉ là một dòng chữ xám, không có hình minh hoạ, không có lời kêu gọi hành động nhấp nháy.

---

## 2. Hệ thiết kế dùng chung — `shared/ui.css` + `shared/ui.js`

**Nguyên tắc:** làm 1 lần, dùng cho cả 14 game. Mỗi overlay chỉ thêm **2 dòng** (1 link CSS + 1 script JS) và đổi class của vài khối chính sang class dùng chung. Không đổi id, không đổi logic JS, không đổi kích thước khung 1080×1920.

> Lưu ý kỹ thuật: route tĩnh `/shared` đã có trong `server.js` (đặt trước room dispatcher) và `lib/transform.js` **không viết lại** đường dẫn `/shared/` — giống như `shared/music.js` đang chạy tốt trên cả 10 game. Vì vậy `/shared/ui.css`, `/shared/ui.js` và `/shared/fonts/*.woff2` sẽ tới được overlay mà không cần sửa server.

### 2.1. Font chữ — tự host, không phụ thuộc Google Fonts

Máy streamer chạy OBS có thể chặn hoặc chậm khi tải Google Fonts. **Tải file woff2 về `shared/fonts/`** (lấy từ Google Fonts API với subset `vietnamese`).

- **Font tiêu đề:** `Baloo 2` weight 700/800 — tròn, vui, đậm, hỗ trợ tiếng Việt đầy đủ, đọc rõ ở cỡ lớn. (Dự phòng nếu muốn cá tính "game show" hơn: `Bungee` 400 cho tiêu đề chính, nhưng Bungee khó đọc ở chữ nhỏ nên chỉ dùng cho 1 dòng tiêu đề.)
- **Font thân:** `Be Vietnam Pro` weight 400/600/700/800/900 — font Việt chuẩn, đã được 8 game "khai" trong `font-family` nhưng chưa bao giờ load thật. Lần này load thật.
- **Font số/đồng hồ:** `Be Vietnam Pro` 900 + `font-variant-numeric: tabular-nums` (số không nhảy chiều rộng khi đếm ngược).

```css
/* shared/ui.css — đầu file */
@font-face {
  font-family: 'Baloo 2';
  src: url('/shared/fonts/baloo2-800.woff2') format('woff2');
  font-weight: 800; font-display: swap;
}
@font-face {
  font-family: 'Be Vietnam Pro';
  src: url('/shared/fonts/bevietnampro-400.woff2') format('woff2');
  font-weight: 400; font-display: swap;
}
@font-face {
  font-family: 'Be Vietnam Pro';
  src: url('/shared/fonts/bevietnampro-700.woff2') format('woff2');
  font-weight: 700; font-display: swap;
}
@font-face {
  font-family: 'Be Vietnam Pro';
  src: url('/shared/fonts/bevietnampro-900.woff2') format('woff2');
  font-weight: 900; font-display: swap;
}
```

### 2.2. Bảng màu — biến CSS, mỗi game chỉ đổi 2 biến accent

```css
/* shared/ui.css */
:root {
  --ui-gold: #FFD700;
  --ui-gold-2: #FF9D00;
  --ui-ink: #0B1020;
  --ui-glass: rgba(10, 18, 40, .55);
  --ui-glass-strong: rgba(10, 18, 40, .82);
  --ui-glass-border: rgba(255, 255, 255, .16);
  --ui-glass-border-gold: rgba(255, 215, 0, .45);
  --ui-text: #FFFFFF;
  --ui-text-dim: rgba(255, 255, 255, .75);
  --ui-red: #FF3B30;
  --ui-green: #34D399;
  --ui-blue: #38BDF8;
  --ui-pink: #FF2D95;
  --ui-shadow: 0 12px 32px rgba(0, 0, 0, .45);
  /* Mỗi game ghi đè 2 biến này trong <style> của mình: */
  --ui-accent: #FFD700;
  --ui-accent-2: #FF9D00;
}
```

Gợi ý accent mỗi game (ghi vào `<style>` riêng của từng overlay, ngay sau khi nối `ui.css`):

| Game | --ui-accent | --ui-accent-2 |
|---|---|---|
| ve-avatar | #D4A017 (vàng khung tranh) | #8B5E00 |
| buong-giam | #D4AF37 (vàng đồng) | #7A5C00 |
| thap-sang-ban-do | #FFD700 | #FF9D00 |
| vuon-hoa-mua-xuan | #FF5E8A (hồng hoa) | #2E7D32 |
| bep-an-tap-the | #FF9A3D (cam lửa) | #C25E00 |
| dua-xe-leo-nui | #FFCF3D (vàng đường đua) | #1E90FF |
| vong-quay-may-man | #FFD24D | #7C3AED |
| bau-troi-phao-hoa | #FFD24D | #7C3AED |
| keo-co | #1E90FF (xanh) | #E63946 (đỏ) |
| dau-truong-sinh-ton | #FF3B30 | #FFD700 |
| chiem-co | #0284C7 (xanh) | #DC2626 (đỏ) |
| dua-thuyen-rong | #FACC15 (vàng) | #EF4444 (đỏ) |
| dau-tri | #4F46E5 (chàm) | #F59E0B |
| di-bar-online | #FF2D95 (hồng neon) | #22D3EE (cyan) |

### 2.3. Các component dùng chung (class + CSS mẫu)

**a. Panel kính — `.ui-panel` (thay cho `rgba(0,0,0,.4)` phẳng ở mọi game)**

```css
.ui-panel {
  background: var(--ui-glass);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  border: 1px solid var(--ui-glass-border);
  border-radius: 22px;
  box-shadow: var(--ui-shadow);
}
.ui-panel-gold {
  border: 1px solid var(--ui-glass-border-gold);
  box-shadow: var(--ui-shadow), 0 0 24px rgba(255, 215, 0, .18);
}
```

**b. Tiêu đề game — `.ui-title` (thay cho `h1` + `text-shadow: 0 3px 0` cứng)**

```css
.ui-title {
  font-family: 'Baloo 2', 'Be Vietnam Pro', sans-serif;
  font-weight: 800;
  font-size: 62px;
  letter-spacing: 2px;
  background: linear-gradient(180deg, #FFFFFF 20%, var(--ui-accent) 75%, var(--ui-accent-2) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, .55));
}
.ui-sub {
  font-size: 26px;
  color: var(--ui-text-dim);
  text-shadow: 0 2px 6px rgba(0, 0, 0, .6);
}
```

**c. Badge DEMO thống nhất — `.ui-demo-badge` (thay 3 kiểu badge hiện tại)**

```css
.ui-demo-badge {
  position: absolute; top: 18px; left: 18px; z-index: 60;
  background: linear-gradient(135deg, #FFD700, #FF9D00);
  color: #1C1C1C; font-size: 24px; font-weight: 900;
  padding: 10px 18px; border-radius: 999px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, .45);
  display: none;
}
.ui-demo-badge.on { display: block; animation: ui-badge-in .3s ease; }
@keyframes ui-badge-in { from { transform: translateY(-8px); opacity: 0; } }
```
Cách đổi: đổi `id="demo-badge"` giữ nguyên id (JS đang dùng id này), chỉ thay class thành `ui-demo-badge` và xoá luật `#demo-badge` cũ trong `<style>` của từng game. Riêng `di-bar-online` đang dùng `body.demo #demo-badge` — đổi sang class chung luôn.

**d. Bảng xếp hạng — `.ui-board` + `.ui-row` (thay danh sách text thuần)**

```css
.ui-board h3 {
  font-family: 'Baloo 2', sans-serif; font-size: 28px; font-weight: 800;
  color: var(--ui-accent); margin-bottom: 8px;
}
.ui-row {
  display: flex; align-items: center; gap: 12px;
  font-size: 26px; font-weight: 700; padding: 8px 0;
  border-bottom: 1px dashed rgba(255, 255, 255, .15);
}
.ui-row:last-child { border-bottom: 0; }
.ui-row .ui-rank {
  width: 44px; height: 44px; flex: none; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 900; background: #3A4454; color: #EEE;
}
.ui-row.rank-1 .ui-rank { background: linear-gradient(135deg, #FFE98A, #FFB800); color: #231A00; box-shadow: 0 0 14px rgba(255, 215, 0, .8); }
.ui-row.rank-2 .ui-rank { background: linear-gradient(135deg, #F2F2F2, #B9B9B9); color: #222; }
.ui-row.rank-3 .ui-rank { background: linear-gradient(135deg, #F0A868, #8C4A12); color: #FFF; }
.ui-row .ui-ava {
  width: 56px; height: 56px; flex: none; border-radius: 50%; object-fit: cover;
  border: 3px solid var(--ui-accent); background: #333;
}
.ui-row .ui-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ui-row .ui-pts { font-weight: 900; color: var(--ui-accent); }
.ui-row .ui-bar { height: 8px; border-radius: 4px; background: rgba(255,255,255,.15); overflow: hidden; margin-top: 4px; }
.ui-row .ui-bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--ui-accent), var(--ui-accent-2)); transition: width .5s ease; }
/* Khi có người mới vào top / đổi hạng: thêm class .ui-row-new vào hàng đó trong 1.5s */
.ui-row-new { animation: ui-row-in .5s ease; }
@keyframes ui-row-in { from { transform: translateX(30px); opacity: 0; background: rgba(255,215,0,.25); } }
```
Áp dụng: thay chuỗi HTML render top trong `render()` của từng game (giữ nguyên dữ liệu, chỉ đổi markup + class). Avatar tối thiểu 56px (mục tiêu 64px ở game có chỗ).

**e. Thanh tiến độ — `.ui-progress` (thêm vệt sáng chạy)**

```css
.ui-progress { height: 30px; border-radius: 999px; background: rgba(0,0,0,.45); overflow: hidden; position: relative; }
.ui-progress > i {
  display: block; height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, var(--ui-accent), var(--ui-accent-2));
  transition: width .5s ease; position: relative; overflow: hidden;
}
.ui-progress > i::after { /* vệt sáng chạy ngang */
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);
  animation: ui-shine 1.8s linear infinite;
}
@keyframes ui-shine { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
.ui-progress.hot > i { animation: ui-progress-pulse .8s ease-in-out infinite alternate; }
@keyframes ui-progress-pulse { from { filter: brightness(1); } to { filter: brightness(1.35); } }
```
Cách dùng: thêm class `hot` khi tiến độ > 80% (sắp đạt mốc) — JS chỉ cần `el.classList.toggle('hot', pct > 80)`.

**f. Toast sự kiện — `.ui-toast` (dòng thông báo nổi, thay ticker tĩnh)**

```css
.ui-toast {
  position: absolute; left: 50%; top: 120px; transform: translateX(-50%);
  z-index: 40; max-width: 940px; text-align: center;
  background: var(--ui-glass-strong);
  border: 1px solid var(--ui-glass-border-gold);
  border-radius: 999px; padding: 14px 28px;
  font-size: 28px; font-weight: 800; color: #FFE9A0;
  box-shadow: var(--ui-shadow); display: none;
}
.ui-toast.show { display: block; animation: ui-toast-in .35s cubic-bezier(.18,.89,.32,1.28); }
@keyframes ui-toast-in { from { transform: translateX(-50%) translateY(-16px) scale(.92); opacity: 0; } }
```

**g. Banner chiến thắng — `.ui-banner` (thay banner `display:block` + `pop .4s` hiện tại)**

```css
.ui-banner {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  z-index: 30; width: 940px; text-align: center;
  background: linear-gradient(135deg, rgba(20,10,0,.96), rgba(10,18,40,.96));
  border: 3px solid var(--ui-accent); border-radius: 28px;
  padding: 40px 32px; box-shadow: 0 20px 60px rgba(0,0,0,.6), 0 0 40px rgba(255,215,0,.25);
  display: none;
}
.ui-banner.show { display: block; animation: ui-banner-in .45s cubic-bezier(.18,.89,.32,1.28); }
@keyframes ui-banner-in { from { transform: translate(-50%,-50%) scale(.8); opacity: 0; } }
.ui-banner h2 {
  font-family: 'Baloo 2', sans-serif; font-size: 58px; font-weight: 800;
  background: linear-gradient(180deg, #FFF, var(--ui-accent));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.ui-banner p { font-size: 30px; color: var(--ui-text-dim); margin-top: 12px; line-height: 1.5; }
```

**h. Trạng thái trống — `.ui-empty` (thay dòng "Chưa có ai…" xám)**

```css
.ui-empty { text-align: center; padding: 18px 10px; color: var(--ui-text-dim); font-size: 26px; font-weight: 700; }
.ui-empty .ui-empty-ic { font-size: 56px; display: block; animation: ui-bob 1.6s ease-in-out infinite; }
.ui-empty .ui-empty-cta { color: var(--ui-accent); animation: ui-blink-soft 1.2s ease-in-out infinite alternate; }
@keyframes ui-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes ui-blink-soft { from { opacity: .6; } to { opacity: 1; } }
```

**i. Thanh trạng thái cuối màn hình — `.ui-statusbar` (thay thanh màu phẳng full-width)**

```css
.ui-statusbar {
  position: absolute; left: 30px; right: 30px; bottom: 18px; height: 84px;
  display: flex; align-items: center; justify-content: space-around;
  background: var(--ui-glass); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
  border: 1px solid var(--ui-glass-border); border-radius: 999px;
  font-size: 26px; font-weight: 800; box-shadow: var(--ui-shadow);
}
.ui-statusbar .big { font-size: 34px; color: var(--ui-accent); font-variant-numeric: tabular-nums; }
```
Lưu ý: thanh cũ cao 140px full-width (`vuon-hoa`, `keo-co`, `dau-truong`) — đổi sang pill 84px sẽ giải phóng ~56px chiều cao cho nội dung chính. Các game dùng `.status` absolute bottom (bếp ăn, đua xe, vòng quay, bầu trời) thì đổi sang class này và bỏ `left/right` cũ.

**j. Lớp nền chiều sâu — `.ui-vignette` + `.ui-grain` (dán vào trong `#scaler`/`#stage`, ngay sau nền)**

```css
.ui-vignette {
  position: absolute; inset: 0; pointer-events: none; z-index: 1;
  background: radial-gradient(ellipse at 50% 42%, transparent 55%, rgba(0,0,0,.38) 100%);
}
.ui-grain {
  position: absolute; inset: 0; pointer-events: none; z-index: 1; opacity: .05;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E");
}
```
Đặt 2 div này làm con đầu tiên của `#scaler`/`#stage`/`#wrap` (dưới nội dung, trên nền). Không cần asset ngoài, chạy được offline.

### 2.4. Hiệu ứng sự kiện — `shared/ui.js` (JS helper, ~120 dòng)

Các game hiện chỉ đổi số + TTS khi có sự kiện. Thêm `StromUI` để mọi game gọi cùng một kiểu phản hồi:

```js
// shared/ui.js — dùng chung, không phụ thuộc engine game
(function (global) {
  'use strict';
  function el(id) { return document.getElementById(id); }
  // 1. Flash sáng toàn màn hình khi quà lớn / thắng (màu theo game)
  function flash(color, ms) {
    var f = el('ui-flash');
    if (!f) {
      f = document.createElement('div');
      f.id = 'ui-flash';
      f.style.cssText = 'position:absolute;inset:0;z-index:45;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 45%, COLOR 0%, transparent 65%);transition:opacity .45s ease-out;';
      (el('scaler') || el('stage') || document.body).appendChild(f);
    }
    f.style.background = 'radial-gradient(circle at 50% 45%, ' + (color || 'rgba(255,215,0,.55)') + ' 0%, transparent 65%)';
    f.style.transition = 'none'; f.style.opacity = '1';
    requestAnimationFrame(function () { f.style.transition = 'opacity .45s ease-out'; f.style.opacity = '0'; });
  }
  // 2. Chữ bay lên (+10đ, -5 HP, +1 🌸...) tại toạ độ x,y trong khung
  function floatText(x, y, text, color) {
    var host = el('scaler') || el('stage') || document.body;
    var d = document.createElement('div');
    d.className = 'ui-float-text';
    d.textContent = text;
    d.style.cssText = 'left:' + x + 'px;top:' + y + 'px;color:' + (color || '#FFD700') + ';';
    host.appendChild(d);
    setTimeout(function () { d.remove(); }, 1600);
  }
  // 3. Confetti rơi (canvas-free, div) — dùng khi thắng / quà lớn / mốc
  function confetti(n) {
    var host = el('scaler') || el('stage') || document.body;
    var colors = ['#FFD700', '#FF2D95', '#22D3EE', '#FACC15', '#A855F7', '#4ADE80', '#FFF'];
    for (var i = 0; i < (n || 36); i++) {
      var c = document.createElement('div');
      c.className = 'ui-confetti';
      c.style.left = Math.floor(Math.random() * 1060) + 'px';
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = (Math.random() * 0.5) + 's';
      host.appendChild(c);
      (function (node) { setTimeout(function () { node.remove(); }, 3400); })(c);
    }
  }
  // 4. Toast ngắn (dùng chung thay cho ticker tĩnh khi có sự kiện nổi bật)
  var toastTimer = null;
  function toast(text, ms) {
    var t = el('ui-toast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 4000);
  }
  // 5. Tiếng "ting" / "pop" / "win" bằng WebAudio (không cần file, không cần TTS)
  var actx = null;
  function sfx(kind) {
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      if (!actx) actx = new AC();
      if (actx.state === 'suspended') actx.resume();
      var t0 = actx.currentTime;
      function tone(freq, at, dur, vol, type) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = type || 'sine'; o.frequency.value = freq;
        g.gain.setValueAtTime(vol || 0.25, t0 + at);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + at + dur);
        o.connect(g); g.connect(actx.destination);
        o.start(t0 + at); o.stop(t0 + at + dur + 0.02);
      }
      if (kind === 'gift') { tone(880, 0, 0.18, 0.3); tone(1318, 0.09, 0.25, 0.3); }
      else if (kind === 'win') { tone(523, 0, 0.2, 0.3); tone(659, 0.12, 0.2, 0.3); tone(784, 0.24, 0.35, 0.32); }
      else if (kind === 'pop') { tone(660, 0, 0.12, 0.25, 'triangle'); }
      else if (kind === 'join') { tone(587, 0, 0.15, 0.2); tone(880, 0.08, 0.2, 0.2); }
    } catch (e) { /* bỏ qua nếu trình duyệt chặn audio */ }
  }
  global.StromUI = { flash: flash, floatText: floatText, confetti: confetti, toast: toast, sfx: sfx };
})(typeof window !== 'undefined' ? window : this);
```

CSS đi kèm trong `ui.css` cho 2 class mà `ui.js` tạo ra:

```css
.ui-float-text {
  position: absolute; z-index: 46; pointer-events: none;
  font-size: 36px; font-weight: 900;
  text-shadow: 0 2px 6px rgba(0,0,0,.7);
  animation: ui-float-up 1.5s ease-out forwards;
}
@keyframes ui-float-up { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-90px); opacity: 0; } }
.ui-confetti {
  position: absolute; top: -20px; width: 14px; height: 22px; z-index: 48; pointer-events: none;
  animation: ui-confetti-fall 2.8s ease-in forwards;
}
@keyframes ui-confetti-fall { to { transform: translateY(1980px) rotate(720deg); opacity: .9; } }
```

**Quy ước gọi trong từng game (thêm 1–3 dòng vào handler socket đã có):**

| Sự kiện | Gọi |
|---|---|
| Quà lớn (gift ≥ 50 xu, hoặc theo ngưỡng từng game) | `StromUI.flash(); StromUI.sfx('gift'); StromUI.confetti(24);` |
| Thắng / về đích / trúng lớn | `StromUI.flash('#FFD700'); StromUI.sfx('win'); StromUI.confetti(48);` |
| Người mới join / follow | `StromUI.sfx('join');` |
| Điểm tăng tại vị trí nhân vật (x, y đã biết) | `StromUI.floatText(x, y, '+10đ');` |
| Sự kiện nổi bật cần đọc nhanh | `StromUI.toast('🎁 Lan tặng 99 xu!');` |

### 2.5. Cách nối vào từng overlay (chuẩn 2 dòng + đổi class)

Mỗi file `games/<slug>/src/public/overlay.html`:

```html
<!-- 1. Trong <head>, TRƯỚC thẻ <style> của game: -->
<link rel="stylesheet" href="/shared/ui.css">
<script src="/shared/music.js"></script>   <!-- đã có ở hầu hết game, giữ nguyên -->
<script src="/shared/ui.js"></script>

<!-- 2. Trong <body>, ngay sau khi mở #scaler / #stage / .wrap: -->
<div class="ui-vignette"></div>
<div class="ui-grain"></div>
<div class="ui-toast" id="ui-toast"></div>
```

Thứ tự CSS: `ui.css` load trước `<style>` của game nên luật riêng của game vẫn thắng khi cần ghi đè — an toàn, không vỡ layout cũ. Sau đó, từng game đổi class theo mục 3 (chỉ đổi class + thêm 1–3 dòng JS gọi `StromUI`, không đổi id hay tên hàm `render()`).

**Thứ tự làm hệ chung (Đợt 0 — làm trước tất cả game):**
1. Tải 4 file woff2 (Baloo 2 800; Be Vietnam Pro 400/700/900, subset vietnamese) vào `shared/fonts/`.
2. Viết `shared/ui.css` (~350 dòng, gồm mục 2.1–2.3 + 2.4 CSS).
3. Viết `shared/ui.js` (~120 dòng, mục 2.4).
4. Kiểm tra: mở 1 overlay bất kỳ (vd. kéo co) với `?demo=1`, xác nhận font đổi, panel kính hiện, không lỗi console, test suite vẫn pass (ui.css/ui.js không chạm engine nên test không đổi).
5. Sau đó mới áp từng game theo đợt 1 → 2 → 3.

---

## 3. Đánh giá từng game — điểm "phèn" cụ thể + nâng cấp

Quy ước: vị trí dòng tham chiếu theo file `games/<slug>/src/public/overlay.html` tại thời điểm đọc (2026-11-13). Mức độ: 🔴 xấu (làm đợt 1) · 🟡 trung bình (đợt 2) · 🟢 tạm ổn (đợt 3, chỉ polish).

---

### 3.1. 🔴 Đua Xe Leo Núi (`dua-xe-leo-nui`) — xấu nhất

**Điểm phèn:**
- Dòng 32–33: xe chỉ là emoji `🏎️` 92px + tên + số mét. Không có thân xe, bánh xe, khói, vệt đường — 4 "xe" giống hệt nhau, chỉ khác màu chấm `🔵🔴🟣🟢`.
- Dòng 27–28: núi là 2 gradient phẳng (`#bfe9ff → #8fd07a → #6aa84f → #4e7d3a`) + 2 đám mây emoji `☁️` đứng yên, mặt trời emoji đứng yên. Không có cây, đá, đường mòn, chim.
- Dòng 35: `.lane .track` chỉ là thanh xám `rgba(0,0,0,.25)` cao 14px — không có vạch kẻ đường, không có mốc 250m/500m/750m.
- Dòng 38: `transition: left 1s linear` — xe trượt đều đều, không có tăng tốc, không rung, không nghiêng.
- Chỉ 1 keyframe (`winbounce`).
- Dòng 43–44: đồng hồ `.clock` nền vàng `#ffcf3d` chữ đen — nhìn như nhãn dán, không có trạng thái "sắp hết giờ".

**Nâng cấp (5):**
1. **Vẽ xe bằng CSS/SVG** (thay emoji): thân xe = div bo tròn + kính + 2 bánh xe tròn quay (`animation: spin` khi đang chạy) + vệt khói sau xe (3 chấm mờ bay ngược, `animation: smoke`). Mỗi xe một màu thân riêng. File sửa: `<style>` dòng 36–41 (`.car .body`), thêm class `.car .wheel`.
2. **Núi có chiều sâu:** thêm 2 lớp núi xa (màu nhạt hơn, opacity .6) + hàng cây tam giác CSS ở chân núi + đường đua có vạch trắng đứt đoạn (`repeating-linear-gradient`) + cọc mốc 250/500/750m. Sửa: `.mountain` dòng 29–30, thêm `.ridge`, `.trees`, `.milestone`.
3. **Xe có cảm giác tốc độ:** khi xe tăng mét trong 1s thì thêm class `.car.boost` 0.6s (nghiêng 6°, scale 1.05, khói dày hơn). JS: trong `render()` dòng ~150 (vòng lặp cars), so mét mới vs mét cũ, toggle class.
4. **Bảng xếp hạng có thanh %:** mỗi `.brow` thêm `.ui-bar` (dùng `.ui-progress` mini) + highlight `.lead` đã có thì thêm animation viền vàng nhấp nháy nhẹ. Sửa: `.brow` dòng 24–26 + HTML render dòng ~140.
5. **Đồng hồ đếm ngược:** khi còn < 60s thì `.clock` đổi nền đỏ `#FF3B30`, chữ trắng, thêm `animation: ui-blink-soft`. Khi về đích: `StromUI.confetti(48) + sfx('win')` (gọi trong handler `socket.on('win')`).

### 3.2. 🔴 Chiếm Cờ (`chiem-co`) — xấu thứ 2

**Điểm phèn:**
- **0 keyframes** — game duy nhất không có animation nào. Cờ đứng im hoàn toàn.
- Dòng 26–28: lá cờ là emoji `🏳️`/`🔵`/`🔴` đặt trong div `.cloth` màu nền — "cờ" thực chất là một hình chữ nhật màu + emoji, không có hình dáng lá cờ (không vẫy, không tam giác, không bóng).
- Dòng 10–12: sân cỏ chỉ là gradient xanh + 2 vệt sáng radial mờ + sọc dọc mờ (`opacity: .12`) — không có vạch sân, không có vòng tròn giữa, không giống sân bóng.
- Dòng 40–44: `.capbar` 2 màu xanh/đỏ chia đôi, không có % số, không có animation khi đổi chiều.
- Dòng 33: điểm đội 76px nhưng là số trơ — khi +điểm không có hiệu ứng nhảy số.
- Dòng 54–57: `#banner` chỉ là chữ vàng 72px `display:none/block`, không có nền, không có confetti.

**Nâng cấp (5):**
1. **Cờ vẫy:** thêm `@keyframes flag-wave { 0%,100% { transform: skewY(0deg); } 50% { transform: skewY(3deg); } }` áp cho `.cloth` (dòng 27), chạy liên tục 1.2s. Khi đổi chủ: thêm class `.flag-captured` 1s (scale 1.15 + flash màu đội mới + `StromUI.sfx('pop')`).
2. **Vẽ lá cờ bằng clip-path:** thay emoji trong `.cloth` bằng hình tam giác (`clip-path: polygon(0 0, 100% 15%, 88% 50%, 100% 85%, 0 100%)`) + màu đội + chữ cái đội (X/Đ). Sửa: `.flag .cloth` dòng 27–28 + JS render dòng ~150 (`cloth.textContent`).
3. **Sân bóng thật:** thêm vạch biên trắng + vòng tròn giữa sân + chấm phạt đền bằng CSS (div absolute, border trắng mờ). Sửa: `#field` dòng 33, thêm `.pitch-lines`.
4. **Điểm nhảy số:** khi điểm đội tăng, thêm class `.pts-bump` 0.4s (scale 1.25 → 1) cho `#pts-xanh/#pts-do`. JS: trong `render()`, so điểm mới vs cũ.
5. **Capbar có số %:** thêm nhãn `%` giữa thanh + transition width đã có thì thêm vệt sáng (dùng `.ui-progress > i::after`). Banner thắng đổi sang `.ui-banner` + `StromUI.confetti(48)`.

### 3.3. 🔴 Đua Thuyền Rồng (`dua-thuyen-rong`) — xấu thứ 3

**Điểm phèn:**
- Dòng 40: thuyền là emoji `🐉🛶` 110px + dòng `🚣` lặp lại + tên `THUYỀN VÀNG` — không có hình thuyền thật, không có mái chèo chuyển động.
- Dòng 31–32: sông chỉ là 2 lane gradient trắng mờ (`rgba(255,255,255,.18) → .05`) + vạch đứt — nước đứng yên hoàn toàn, không có sóng.
- Dòng 9: nền trời 3 sắc xanh liền nhau, mây `radial-gradient` tĩnh (dòng 11).
- `box-shadow: 0` trong toàn file — không một panel nào có bóng đổ.
- Dòng 42: `#drum-flash` chữ `🥁 TRỐNG DỒN!` 90px — hiệu ứng trống dồn mạnh nhất game nhưng chỉ là chữ hiện rồi mờ, không rung màn hình.
- Dòng 37: `.boat .bname` 24px + `.crew` 30px — tên thuyền nhỏ, khó đọc từ xa.

**Nâng cấp (5):**
1. **Sóng nước chuyển động:** thêm `@keyframes waves { from { background-position-x: 0; } to { background-position-x: 240px; } }` cho `.lane` với `background-image: repeating-radial-gradient` (gợn sóng) chạy 3s linear infinite. Thêm vệt nước trắng sau thuyền (div `.wake` mờ, dài 120px).
2. **Thuyền có mái chèo:** giữ emoji rồng làm đầu thuyền, thêm 3 mái chèo CSS (thanh dài xoay `±25deg`, `animation: row .6s ease-in-out infinite alternate`) dưới thuyền. Tốc độ chèo tăng khi `energy` cao (đổi `animation-duration` qua JS theo `s.combos`).
3. **Trống dồn rung màn hình:** khi `socket.on('drum')` (đã có `drumFlash()`), thêm class `.shake` 0.5s cho `#stage` (`@keyframes shake { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }`) + `StromUI.sfx('gift')` + flash vàng.
4. **Score box có tiến độ:** `.team-box .bar` (dòng 24) đổi sang `.ui-progress` + thêm dòng "còn XXXm tới đích" + % to. Sửa: render dòng ~170 (`#bar-vang/#bar-do`).
5. **Mây trôi + tên thuyền to:** `.clouds` thêm `animation: drift 40s linear infinite` (translateX); `.boat .bname` tăng 24px → 30px, thêm `text-shadow` đậm + nền pill đen mờ.

### 3.4. 🔴 Vườn Hoa Mùa Xuân (`vuon-hoa-mua-xuan`)

**Điểm phèn:**
- Dòng 59: nền gradient trời→cỏ chuyển gắt ở 45%; mặt trời emoji `☀️` 90px + 2 mây emoji `☁️` (chỉ mây có animation `drift`).
- Dòng 40–44: ô đất `.plot` 62px emoji hoa + tên người **15px** + giai đoạn **13px** — trên khung 1080px thì tên chỉ ~8px khi hiển thị thực tế qua OBS, không đọc được.
- Dòng 45: `.plot.empty::after` chỉ là `"· · ·"` — 40 ô đất trống nhìn như bảng chấm.
- Dòng 46–47: `.nursery` (vườn ươm) là hộp trắng phẳng, không có hình hạt.
- Top 5 (dòng 36): hộp trắng `.88` + chữ 22px, không avatar, không thanh điểm.
- Dòng 52: `.banner` trắng + viền hồng 6px — nhìn như popup web 2015.

**Nâng cấp (5):**
1. **Hoa nở có animation:** thêm `@keyframes bloom-pop { 0% { transform: scale(.3) rotate(-20deg); opacity: 0; } 60% { transform: scale(1.25); } 100% { transform: scale(1); } }` — khi hoa chuyển sang `bloom` thì thêm class `.just-bloomed` 0.6s (JS: trong `render()`, so stage cũ/mới của từng ô). Thêm cánh hoa rơi: 8 div `.petal` (hình oval hồng, `animation: fall` 6s) khi vào `festival`.
2. **Ô đất có đất thật:** `.plot` thêm nền nâu có vân (`radial-gradient` đốm đất) + viền cỏ xanh trên miệng ô; ô trống hiện icon hạt `🌱` mờ 30px thay vì `"· · ·"`.
3. **Chữ đọc được:** `.plot .nm` 15px → 20px, `.st` 13px → bỏ chữ giai đoạn, thay bằng icon giai đoạn to 40px + tooltip tên. Tên người trồng cắt tối đa 8 ký tự.
4. **Top 5 chuẩn `.ui-board`:** avatar tròn 48px + thanh điểm + huy hiệu 🥇🥈🥉 (thay `['🥇','🥈','🥉','4.','5.']` text thuần hiện tại — giữ emoji nhưng đặt trong `.ui-rank`).
5. **Thanh tiến độ + mốc:** `.bar` đổi sang `.ui-progress` (vệt sáng chạy); mốc `.ms.hit` thêm scale pop + `StromUI.sfx('pop')` khi chạm mốc (gọi trong handler `socket.on('milestone')` đã có).

### 3.5. 🔴 Bếp Ăn Tập Thể (`bep-an-tap-the`)

**Điểm phèn:**
- Dòng 18–20: nồi là emoji `🍲` 330px + hơi `♨️` + lửa `🔥` — 3 emoji xếp chồng, không có bếp, không có bàn, không có ánh lửa hắt lên nồi.
- Dòng 11–12: nền `.wrap` là gradient nâu đỏ 4 điểm dừng + 1 vệt sáng cam radial — vẫn phẳng, không có gạch bếp/khói/xoong treo.
- Dòng 29: `.dish` chưa mở: `opacity: .45; filter: grayscale(1)` — nhìn như ô bị hỏng, không gợi "sắp mở".
- Dòng 33–35: top đầu bếp avatar 52px, không thanh điểm.
- Dòng 37: `.ticker` và `.status` đều là chữ nhỏ cuối trang, không có điểm nhấn.

**Nâng cấp (5):**
1. **Nồi có bếp:** thêm bệ bếp (div nâu đậm bo tròn dưới nồi) + vòng lửa cam phát sáng dưới nồi (`box-shadow: 0 0 60px #FF6B00` khi `fireLevel === 3`) + bong bóng sôi: 6 chấm tròn trắng mờ nổi lên từ nồi (`animation: bubble-up 1.2s infinite`, delay lệch nhau). Sửa: `.potzone` dòng 16–17.
2. **Món sắp mở:** `.dish` chưa mở nhưng sắp đủ xu (còn < 20 xu) thì thêm class `.almost` (viền vàng nhấp nháy + opacity .8). Khi mở: `StromUI.confetti(24) + sfx('gift')` trong handler `socket.on('dish')` đã có.
3. **Thanh nấu chuẩn `.ui-progress`:** thêm class `hot` khi > 80% + chữ `%` to 40px + nhãn "SẮP CHÍN!" nhấp nháy. Sửa: `.barWrap` dòng 23–26.
4. **Top đầu bếp chuẩn `.ui-board`:** avatar 52px → 64px, thêm thanh điểm nấu + huy hiệu top 1.
5. **Nền có chiều sâu:** thêm lớp khói mờ bay lên (2 div blur trắng, `animation: smoke-up 8s`) + `.ui-vignette` + `.ui-grain` (theo mục 2.3j).

### 3.6. 🟡 Kéo Co (`keo-co`)

**Điểm phèn:**
- Dòng 47: dây chỉ là `repeating-linear-gradient` nâu nhạt/dậm — phẳng, không có độ xoắn, không có bóng.
- Dòng 54–56: người kéo avatar 96px nhưng không có thân người — chỉ có mặt tròn + tên 19px + lực 17px (quá nhỏ).
- Dòng 41–42: sân (`.ground`) là gradient nâu phẳng + viền trên `#c89b5e` — không có vạch sân, không có khán đài.
- Dòng 48: cờ `🚩` 72px trượt `left` với `transition .5s` — chuyển động mượt nhưng không rung khi giằng co.
- Banner thắng (dòng 68) là hộp trắng + viền xanh — giống popup vườn hoa, không có màu đội thắng.

**Nâng cấp (4):**
1. **Dây có xoắn + bóng:** `.rope` thêm `box-shadow: 0 6px 12px rgba(0,0,0,.5)` + lớp xoắn chéo (`repeating-linear-gradient(45deg, ...)`) + khi chênh lệch lực lớn thì thêm class `.rope-strain` (rung nhẹ `animation: rope-shake .3s`).
2. **Người kéo có "người":** thêm bóng đổ ellipse dưới avatar + khi đội đang dẫn thì avatar nghiêng về phía kéo (`transform: rotate(±6deg)`, transition .5s theo `flagPct`) + tên 19px → 22px, lực 17px → 20px, thêm viền màu đội đã có thì tăng độ dày 4px → 5px + glow khi top 1.
3. **Sân có khán đài:** thêm 2 hàng emoji khán giả mờ (`👥👥👥` lặp, opacity .5) ở mép trên sân + vạch trắng giữa sân đã có thì thêm chấm tròn giữa.
4. **Banner thắng theo màu đội:** khi đội Xanh thắng thì `.banner` viền `#1e90ff` + nền gradient xanh; đội Đỏ thì viền `#e63946` + nền gradient đỏ (JS: trong `render()` khi `phase === 'matchEnd'`, set `banner.style.borderColor`). Thêm `StromUI.confetti(48)` khi thắng trận.

### 3.7. 🟡 Vòng Quay May Mắn (`vong-quay-may-man`)

**Điểm phèn:**
- Dòng 29–30: 20 ô quay chỉ là `conic-gradient` liền nhau — không có đường kẻ phân cách giữa các ô, không có đinh tán, nhìn như đĩa màu.
- Dòng 26: kim chỉ là emoji `🔻` 72px — không có kim quay thật, không rung khi bánh xe dừng.
- Dòng 34: hub giữa là emoji `🎡` 96px trên nền radial cam — không có logo, không có số lượt quay.
- Dòng 36–37: `.segLabel` 21px — chữ trên ô quay nhỏ, khó đọc khi quay.
- Dòng 44–46: lịch sử + top là 2 hộp đen giống hệt nhau, không có phân biệt thị giác.

**Nâng cấp (5):**
1. **Ô quay có vạch phân cách:** vẽ 20 đường kẻ bằng `repeating-conic-gradient` phủ lên `.wheel` (lớp phủ riêng, `pointer-events: none`) + đinh tán vàng ở mỗi ranh giới (20 chấm tròn nhỏ). Sửa: `.wheel` dòng 29 + thêm `.wheel-lines`.
2. **Kim chỉ thật:** thay emoji `🔻` bằng tam giác CSS (`border-left/right: 36px solid transparent; border-top: 60px solid #FFD24D`) + khi bánh xe đang quay thì kim rung (`animation: tick .12s` mỗi khi qua 1 ô — kích hoạt bằng JS theo `wheelRotation`).
3. **Hub có số:** hub giữa hiện số lượt quay còn lại trong hàng chờ (`queueLength`) to 64px + chữ "QUAY" nhỏ bên dưới, thay emoji `🎡`.
4. **Kết quả trúng:** `.result` đổi sang `.ui-banner` + `StromUI.confetti(36)` khi trúng (không phải trượt) + `sfx('win')`. Đã có `.epic` glow — giữ lại, thêm confetti.
5. **Lịch sử gọn:** tối đa 5 dòng, mỗi dòng có icon ô trúng + tên + giờ (giờ 20px mờ), top 5 đổi sang `.ui-board` mini.

### 3.8. 🟡 Bầu Trời Pháo Hoa (`bau-troi-phao-hoa`)

**Điểm phèn:**
- Dòng 25: cửa sổ nhà là `content: "🟨🟨  🟨   🟨🟨 🟨  🟨"` trong `::after` — dùng emoji làm cửa sổ, khoảng cách không đều, nhìn lộn xộn.
- Dòng 15–17: sao chỉ là 10 `radial-gradient` tĩnh — không nhấp nháy.
- Dòng 18: trăng là emoji `🌙` 110px.
- Dòng 28–30: `.topCard` avatar 56px, tên 24px, điểm 22px — nhỏ so với vị trí top trang.
- Dòng 51–52: ticker và info in cùng một câu (trùng lặp, xem 1.7).

**Nâng cấp (4):**
1. **Cửa sổ sáng đèn thật:** thay `::after` emoji bằng `background-image: repeating-linear-gradient` (cửa sổ vàng 14×20px, cách nhau 26px) trên `.bld` + 30% cửa sổ nhấp nháy (thêm class `.lit` ngẫu nhiên bằng JS, `animation: window-flicker 4s`).
2. **Sao nhấp nháy:** `.stars` thêm 2 lớp (`.stars` + `.stars2`) với `animation: twinkle 3s ease-in-out infinite alternate` (opacity .4 → 1), delay lệch nhau.
3. **Top 3 chuẩn `.ui-board` ngang:** avatar 56px → 72px, top 1 thêm 👑 + viền vàng phát sáng, thêm thanh điểm pháo. Xoá dòng info trùng ticker (giữ 1 dòng duy nhất, tăng cỡ ticker lên 28px).
4. **Trăng vẽ bằng CSS:** thay emoji `🌙` bằng div tròn `background: radial-gradient(circle at 35% 35%, #FFFDE7, #FFE082)` + `box-shadow: 0 0 60px rgba(255, 240, 180, .8)` + 2 miệng hố nhỏ (div tròn mờ).

### 3.9. 🟡 Đấu Trường Sinh Tồn (`dau-truong-sinh-ton`)

**Điểm phèn:**
- Dòng 26–27: đấu trường là vòng tròn xanh lá phẳng (`radial-gradient` 3 điểm dừng) + viền nâu — không có cỏ, đá, cây, địa hình.
- Dòng 28–30: chiến binh chỉ là emoji vũ khí 56px + tên 19px + HP bar 12px + số HP 16px — HP bar quá mỏng, số HP quá nhỏ.
- Dòng 31: người gục chỉ `opacity: .45; filter: grayscale(1)` + đổi emoji thành `💀` — không có hiệu ứng "chết".
- Dòng 35–36: 2 panel top/downed giống hệt nhau, chữ 22px.
- Vòng bo (`.zone-ring`) đã có glow đỏ tốt — nhưng khi bo siết không có cảnh báo toàn màn hình.

**Nâng cấp (5):**
1. **Địa hình đấu trường:** thêm 8–10 chấm cỏ/đá (div tròn xanh đậm/nâu, vị trí ngẫu nhiên cố định) + vòng tròn cát ở giữa + bóng đổ dưới mỗi chiến binh (ellipse đen mờ).
2. **HP bar to + rõ:** `.hpbar` 12px → 18px, `.hpnum` 16px → 22px, thêm số HP dạng "87/100" + màu chuyển xanh→vàng→đỏ theo % (đã có `.low`, thêm `.mid` vàng khi 25–50%).
3. **Chết có hiệu ứng:** khi chiến binh gục (từ `alive` → `down`), thêm class `.just-down` 1.2s (emoji 💀 bay lên + mờ dần, `animation: soul-rise`) + `StromUI.floatText(x, y, '💀 ' + name)` tại vị trí chiến binh (toạ độ đã có trong `fighterPos`).
4. **Bị đánh rung:** khi `socket.on('hit')` (đã có `floatText`), thêm class `.shake` 0.3s cho fighter tương ứng (JS: tìm node theo `data-uid` — cần thêm `data-uid` vào HTML fighter trong `render()`).
5. **Bo siết cảnh báo:** khi `zoneActive` thì viền màn hình đỏ nhấp nháy (`#scaler` thêm class `.zone-danger` với `box-shadow: inset 0 0 120px rgba(255,0,0,.35)`, `animation: zone-pulse 1s`) + `StromUI.toast('⭕ Vòng bo đang siết!')` 1 lần mỗi lần siết.

### 3.10. 🟡 Đấu Trí (`dau-tri`)

**Điểm phèn:**
- Dòng 19–20: thẻ câu hỏi nền trắng `#fff` phẳng + bo 28px — sạch nhưng nhạt, không có viền, không có tag chủ đề/độ khó.
- Dòng 24: thanh fill đáp án `#a5b4fc` phẳng — không gradient, không % to.
- Dòng 40–41: đồng hồ chỉ là số 52px trong hộp đen — không có vòng tròn đếm ngược, không đổi màu khi sắp hết giờ.
- Dòng 46–48: top 2 đội là 2 hộp đen giống hệt nhau, chữ 24px, không avatar.
- Dòng 50: `#spotlight` nền đen `.6` + chữ vàng — mờ, không nổi bật bằng banner các game khác.

**Nâng cấp (4):**
1. **Thẻ câu hỏi có viền gradient:** `#qcard` thêm `border: 4px solid transparent; background: linear-gradient(#fff, #fff) padding-box, linear-gradient(135deg, #4F46E5, #F59E0B) border-box;` + tag chủ đề (vd. "LỊCH SỬ • DỄ") ở góc trên + số câu to hơn (`.qno` 26px → 30px, màu accent).
2. **Đáp án có % + gradient:** `.opt .fill` đổi sang gradient chàm (`#818CF8 → #4F46E5`) + `.cnt` thêm `%` bên cạnh số người (vd. "12 người • 34%") + khi chốt đáp án đúng: `StromUI.confetti(24)` nhỏ + `sfx('win')` (đã có `correctBlink`, giữ lại).
3. **Đồng hồ vòng tròn:** thay hộp đen bằng vòng tròn `conic-gradient` (phần còn lại màu accent, phần hết màu xám) + số ở giữa + khi < 5s thì vòng đỏ + rung nhẹ. Sửa: `#timer` dòng 38–39, JS cập nhật `--p` (phần trăm) trong `render()`.
4. **Top có avatar + thanh:** 2 `.top-list` đổi sang `.ui-board` mini (avatar 48px + thanh số câu đúng). `#spotlight` đổi sang `.ui-banner` + top 3 có huy hiệu.

### 3.11. 🟡 Đi Bar Online (`di-bar-online`) — tốt nhất nhóm game mới

**Điểm phèn:**
- Dòng 9: font `system-ui` thuần — chưa có font thương hiệu (dù là game "chất" nhất).
- Dòng 66–68: vũ công chỉ là emoji 88px + tên 26px + năng lượng 28px — không dùng avatar thật của người chơi (trong khi ve-avatar đã chứng minh lấy được avatar TikTok).
- Dòng 31: LED marquee có khoảng trống giữa 2 vòng lặp (đã biết từ kiểm chứng 13/11: "banner marquee cuộn chữ có khoảng trống giữa 2 vòng lặp").
- Dòng 104: nút nhạc `#music-btn` là nút thô (viền trắng 2px, bo 10px) — không theo hệ pill.
- Dòng 84–86: 2 bàn VIP giống hệt nhau chỉ khác màu viền, không có thanh tiến độ tới "bao bar".

**Nâng cấp (5):**
1. **Font thương hiệu:** `font-family` đổi sang `'Baloo 2', 'Be Vietnam Pro', system-ui` (sau khi nối `ui.css`); tiêu đề `DJ STROM` + `SÀN NHẢY` dùng `.ui-title` (gradient hồng→cyan).
2. **Vũ công có avatar thật:** `.dancer` thêm avatar tròn 64px ở trên emoji (lấy `d.avatar` nếu engine trả về, fallback emoji như hiện tại) + thanh năng lượng mini dưới tên (thay số `⚡` trơ). Sửa: template dancer trong `render()` dòng ~280.
3. **Marquee liền mạch:** nhân đôi nội dung `#led-text` (JS: `el.innerHTML = text + ' • ' + text`) và đổi animation `marquee` từ `translateX(-100%)` sang `translateX(-50%)` để không có khoảng trống.
4. **Nút nhạc chuẩn pill:** `#music-btn` đổi sang `.ui-panel` pill + icon 🔊/🔇 to hơn + vị trí giữ nguyên (top 100px, left 40px).
5. **Bàn VIP có tiến độ:** thêm thanh `.ui-progress` mini dưới điểm mỗi bàn (tiến độ tới mốc "bao bar") + khi đạt mốc: `StromUI.flash('#FACC15')` + chữ "BAO CẢ BAR" nhấp nháy (class `.cover` đã có, thêm animation).

### 3.12. 🟢 Thắp Sáng Bản Đồ (`thap-sang-ban-do`) — đã tốt, chỉ polish

**Điểm phèn (ít):**
- Dòng 70–74: tiêu đề đã có `shimmer` vàng — tốt, nhưng chưa có gradient chữ (chỉ là màu vàng đơn + shimmer background-position).
- Dòng 27: panel kính đã có (`backdrop-filter: blur(8px)`) — tốt nhất hệ thống. Nhưng chữ legend/side còn nhỏ (side legend ~20px).
- Dòng 98–99: avatar rơi `avatarDrop` đã có — tốt. Nhưng khi tỉnh vừa thắp, hiệu ứng chỉ là `flash` + `ringExp` — chưa có số điểm bay lên.
- Dòng 35: `.sideSec` viền vàng mờ — tốt, nhưng 2 cột side chưa cân đối (cột phải có khoảng trống trong suốt chỗ Hoàng Sa/Trường Sa — cố ý, giữ nguyên).

**Nâng cấp (3):**
1. **Tiêu đề gradient:** `#header h1` (hoặc `#title`) thêm `background: linear-gradient(180deg, #FFF, #FFD700); -webkit-background-clip: text; color: transparent;` (giữ `shimmer` bằng cách áp shimmer lên background-size 200%).
2. **Số điểm bay lên:** khi tỉnh vừa thắp (đã có `.prov.flash`), thêm `StromUI.floatText(x, y, '+5đ')` tại toạ độ tỉnh (toạ độ đã có trong SVG) + `sfx('pop')`.
3. **Chữ side to hơn:** side legend + side stats tăng 20px → 24px, thêm icon 🗺️/💡 vào tiêu đề mục. Spotlight card thêm viền vàng phát sáng (`.ui-panel-gold`).

### 3.13. 🟢 Vẽ Avatar (`ve-avatar`) — đã tốt, chỉ polish

**Điểm phèn (ít):**
- Dòng 12: font `Georgia, 'Times New Roman', serif` toàn stage — serif cổ điển hợp khung tranh nhưng lạc tông với 13 game còn lại (sans).
- Dòng 28–33: khung tranh đã đẹp (vàng radial, bo tròn) nhưng tier t3/t4/t5 chỉ khác nhau bằng conic-gradient + halo — người xem khó phân biệt tier nếu không đọc chữ.
- Dòng 199–204: `#event-text` / `#notify-text` là dải đen + viền vàng — tốt, nhưng không có animation trượt vào (chỉ hiện).
- Hàng đợi (queue-panel): chữ thuần, không avatar, không số xu.

**Nâng cấp (4):**
1. **Font:** tiêu đề + tên người chuyển sang `'Baloo 2'` (giữ Georgia italic chỉ cho dòng cảm ơn "thanks-line" — như chữ ký tay). Sửa: `#stage` dòng 12 (font-family) + `.frame .fname` các dòng 75/100/125.
2. **Tier phân biệt rõ:** t3 thêm 1 viên ngọc (đã có `.gem` ở t4/t5 — thêm cho t3 màu xanh), t4 thêm 2 viên, t5 thêm 3 viên + hào quang xoay nhanh hơn (t4halo 14s → t5 8s). Thêm nhãn tier ("KHUNG VÀNG", "KHUNG KIM CƯƠNG") dưới tên.
3. **Event band trượt vào:** `#event-text` thêm `animation: ui-toast-in .35s` khi đổi nội dung (JS: remove/add class mỗi lần cập nhật text).
4. **Hàng đợi có avatar:** queue-panel thêm avatar tròn 48px + số xu của từng người chờ + highlight người đang được vẽ (viền vàng + chữ "ĐANG VẼ").

### 3.14. 🟢 Buồng Giam (`buong-giam`) — tốt nhất, chỉ polish

**Điểm phèn (ít, chủ yếu là nhất quán):**
- 3041 dòng, 27 keyframes — giàu hiệu ứng nhất hệ thống, có tài sản ảnh thật. Vấn đề chính là **không nhất quán**: panel dùng nhiều kiểu nền khác nhau (`rgba(14,18,25,.94)`, `rgba(16,20,26,.9)`, gradient slate `rgba(15,23,42,.94) → rgba(30,41,59,.94)`), badge demo riêng, leaderboard riêng.
- Leaderboard đã có `.rank-1/.rank-2/.rank-3` (vàng/bạc/đồng + glow) — tốt, nhưng chưa có thanh điểm và avatar vẫn nhỏ.
- Cutscene "ra tù" đã có overlay riêng — nhưng chưa có flash/confetti khi thả người.

**Nâng cấp (4):**
1. **Chuẩn hoá panel:** đổi tất cả panel chính sang `.ui-panel` / `.ui-panel-gold` (giữ màu tối đặc trưng, chỉ đổi sang kính mờ + viền thống nhất). Không đổi vị trí/kích thước.
2. **Leaderboard có thanh điểm:** thêm `.ui-bar` dưới mỗi hàng + avatar 56px → 64px + animation `.ui-row-new` khi có người mới vào top (JS: trong `renderCharacters`/`updateLeaderboard`, so top cũ/mới).
3. **Ra tù có "nổ":** khi cutscene thả người bắt đầu, gọi `StromUI.flash('#FFD700'); StromUI.confetti(36); sfx('win');` (thêm vào hàm mở cutscene đã có).
4. **Badge demo + watermark thống nhất:** đổi `#demo-badge`/`#demo-watermark` sang `.ui-demo-badge` (mục 2.3c). Ghi chú: file 3041 dòng — tách CSS dùng chung sang `ui.css` là việc dọn dẹp riêng, làm sau đợt 3, không bắt buộc để "đẹp lên".

---

## 4. Thứ tự ưu tiên

### Đợt 0 — Hệ thiết kế dùng chung (làm trước, ~1 buổi)
- Tải font woff2 vào `shared/fonts/` (Baloo 2 800; Be Vietnam Pro 400/700/900).
- Viết `shared/ui.css` + `shared/ui.js` (mục 2).
- Nối thử vào 1 game (kéo co) + kiểm chứng live `?demo=1` + `npm test` vẫn pass.
- **Xong đợt 0 mới làm các đợt sau** — nếu không, mỗi game sẽ tự chế một kiểu "đẹp" khác nhau và lại loạn như hiện tại.

### Đợt 1 — 5 game xấu nhất (làm ngay sau đợt 0)
| # | Game | Lý do làm trước | Ước lượng |
|---|---|---|---|
| 1 | dua-xe-leo-nui | Xe = emoji, núi phẳng, 1 keyframe duy nhất | Lớn (vẽ xe + núi + khói) |
| 2 | chiem-co | 0 keyframes, cờ = hình chữ nhật + emoji | Trung bình |
| 3 | dua-thuyen-rong | Thuyền = emoji, nước đứng yên, 0 box-shadow | Trung bình |
| 4 | vuon-hoa-mua-xuan | Chữ 13–15px không đọc được, ô đất là dấu chấm | Trung bình |
| 5 | bep-an-tap-the | Nồi = 3 emoji chồng nhau, món chưa mở nhìn như hỏng | Trung bình |

### Đợt 2 — 6 game trung bình
| # | Game | Việc chính |
|---|---|---|
| 6 | keo-co | Dây xoắn, người kéo nghiêng, khán đài, banner theo màu đội |
| 7 | vong-quay-may-man | Vạch ô quay, kim chỉ thật, hub có số, kết quả confetti |
| 8 | bau-troi-phao-hoa | Cửa sổ thật, sao nhấp nháy, top 3 to hơn, xoá dòng trùng |
| 9 | dau-truong-sinh-ton | Địa hình, HP bar to, hiệu ứng chết, bo siết cảnh báo |
| 10 | dau-tri | Thẻ câu hỏi viền gradient, đồng hồ vòng tròn, top có avatar |
| 11 | di-bar-online | Font thương hiệu, avatar vũ công thật, sửa marquee, nút nhạc |

### Đợt 3 — 3 game đã tạm ổn (polish cuối)
| # | Game | Việc chính |
|---|---|---|
| 12 | thap-sang-ban-do | Tiêu đề gradient, số điểm bay, chữ side to hơn |
| 13 | ve-avatar | Font tiêu đề Baloo 2, tier phân biệt bằng ngọc, hàng đợi có avatar |
| 14 | buong-giam | Chuẩn hoá panel, leaderboard có thanh điểm, ra tù có confetti |

### Ngoài phạm vi (ghi chú, không làm trong kế hoạch này)
- `public/landing.html`: cũng dùng `system-ui` + thẻ game phẳng (`border: 2px solid #39406b`, không có ảnh) — nên áp font + panel kính chung sau khi xong overlay, nhưng landing là trang web (không phải overlay live) nên làm riêng 1 đợt khác.
- Dashboard các phòng (`games/<slug>/src/public/index.html` hoặc `dashboard.html`): chưa rà soát trong kế hoạch này — nên rà soát riêng sau (nút DEMO/LIVE mới thêm đợt S2 cũng cần chuẩn hoá theo hệ này).

---

## 5. Checklist nghiệm thu (mỗi game phải đạt đủ 7 điểm mới tính là "hết phèn")

1. **Font:** tiêu đề dùng Baloo 2, thân dùng Be Vietnam Pro (load thật từ `shared/fonts/`, không còn font rớt về hệ thống).
2. **Nền có chiều sâu:** có vignette + grain (mục 2.3j) và ít nhất 1 lớp cảnh có chuyển động (mây trôi / sóng / sao nhấp nháy / khói).
3. **Không còn emoji làm hình chính:** nhân vật/cảnh chính vẽ bằng CSS/SVG/ảnh thật; emoji chỉ làm icon phụ (≤ 40px, không phải trung tâm khung hình).
4. **Chữ đọc được:** không còn chữ nào < 20px trong nội dung chính (trừ chú thích nhỏ ≤ 22px ở chân trang). Tên người chơi ≥ 22px.
5. **Panel kính:** mọi panel chính dùng `.ui-panel` (blur + viền + bóng), không còn hộp đen phẳng `rgba(0,0,0,.4)` trơ.
6. **Mọi sự kiện có phản hồi:** quà lớn → flash + sfx + confetti; thắng → banner `.ui-banner` + confetti; join/follow → sfx; điểm tăng → số bay (`floatText`) hoặc bump.
7. **Không có chuyển động chết:** màn hình luôn có ít nhất 1 chuyển động liên tục khi phòng đang live (quay/trôi/nhấp nháy/thở), và không có trạng thái trống nào chỉ là dòng chữ xám (dùng `.ui-empty`).

Kiểm chứng: mỗi game mở `?demo=1` trên Railway, xem ở cửa sổ ngang 1920×1000, chụp màn hình ở 3 thời điểm (phòng trống / đang chơi / thắng) và đối chiếu checklist. Riêng hiệu ứng âm thanh (sfx) chỉ kiểm chứng được bằng tai trên máy streamer — ghi chú trong báo cáo kiểm chứng.

## 6. Rủi ro & lưu ý kỹ thuật

1. **Font tự host là bắt buộc, không dùng link Google Fonts trực tiếp.** OBS Browser Source có thể chặn/tải chậm font ngoài; `shared/fonts/*.woff2` đi cùng server nên luôn tải được. Nhớ dùng đường dẫn tuyệt đối `/shared/fonts/...` (đường dẫn tương đối sẽ vỡ vì overlay nằm ở `/o/<game>/<user>`).
2. **Không đổi id/class mà JS đang dùng.** Chỉ thêm class mới hoặc đổi class của phần tử tĩnh. Riêng `#demo-badge` giữ nguyên id, chỉ đổi class. `render()` của các game innerHTML toàn bộ panel — khi đổi markup top/bảng thì phải đổi cả template string trong `render()`, không chỉ CSS.
3. **Hiệu năng:** chỉ dùng animation `transform` và `opacity` (GPU), không animate `width/height/top/left` (trừ thanh tiến độ đã có `transition: width`). Confetti tối đa 48 mảnh/lần, tự xoá sau 3.4s. Không thêm canvas mới ngoài `bau-troi-phao-hoa` đã có.
4. **Không vỡ test:** `npm test` (281 test) chỉ kiểm tra engine, không kiểm tra overlay — đổi CSS/HTML overlay không làm rớt test. Nhưng sau mỗi đợt vẫn chạy `npm test` + `node --check` cho file JS inline đã sửa (trích `<script>` ra file tạm như quy trình S1 đã làm).
5. **Emoji vẫn cần ở một số chỗ:** huy hiệu hạng (🥇🥈🥉), icon trạng thái (👀❤️🎁), nhãn đội — giữ lại, chỉ thay emoji làm **hình chính**. Khi thay emoji bằng CSS/SVG, nhớ giữ lại emoji cũ trong `alt`/fallback để máy cũ không bị trống hình.
6. **Đừng làm 14 game cùng lúc.** Làm theo đợt 0 → 1 → 2 → 3, mỗi đợt deploy + kiểm chứng live xong mới sang đợt sau. Nếu gộp hết vào 1 lần sửa thì không biết game nào vỡ do đâu.
7. **Âm thanh:** `StromUI.sfx` dùng WebAudio giống `StromMusic` — trình duyệt chặn autoplay nên sfx chỉ kêu sau khi có tương tác/event đầu tiên (giống nhạc nền hiện tại). Không dùng file âm thanh ngoài (bản quyền + dung lượng).
