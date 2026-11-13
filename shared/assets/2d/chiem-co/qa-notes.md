# QA notes — sprite 2D game Chiếm Cờ (chiem-co)

- Ngày: 2026-11-13 (tiếp nối nhân viên trước, bị ngắt do máy chủ khởi động lại)
- Căn cứ: `sprite-request.json` (SSoT), `docs/asset-plan-2d-2026-11-13.md` §0/§2,
  `docs/research-sprite-gen-2026-11-13.md` §3/§5 (checklist Đợt B)
- Công cụ cắt nền: `rembg 2.0.87`, session `u2net` (model đã có sẵn local
  `~/.rembg/models/u2net/u2net.onnx`). Lưu ý môi trường: session mặc định của
  rembg 2.0.87 kéo model `bria-rmbg` ~1,02 GB (chậm, ~25 phút ở tốc độ mạng lúc
  làm); đã dừng tiến trình đó và dùng `u2net` một cách tường minh — cắt xong 3 ảnh trong ~18 giây.
  Các game khác nên dùng `new_session("u2net")` luôn.- Curation trên bản cắt (frames/ giữ nguyên bản rembg thô):
  alpha < 8 → 0 (diệt nhiễu vô hình), alpha > 247 → 255 (bão hòa phần trong),
  fill-hole kín trong mask alpha > 128, resize tách RGB/alpha (LANCZOS) để
  không sinh viền sáng. Sheet 512×512, anchor bottom-centre, margin 8px.
- GIF preview: 1 frame tĩnh/250 ms mỗi sprite (`qa/<tên>-preview.gif`) +
  contact sheet 2×2 trên nền tối (`qa/contact-sheet-dark.png`).
  Vì mỗi sprite chỉ có 1 frame (hiệu ứng vẫy bằng CSS ở overlay), GIF chỉ để
  kiểm tra tĩnh + alpha, không có seam/loop để kiểm tra.

## Kết quả từng sprite (state `idle`, 1 frame, fps 4, loop)

| Sprite | Sheet | Kích thước | Dung lượng | Kết quả | Ghi chú |
|---|---|---|---|---|---|
| co-xanh | `curated/co-xanh-sheet.png` | 512×512, rect {x:9,y:277,w:494,h:226} | 90 KB | **pass** | Cắt sạch, không halo (0 px trắng đục, 0 px trắng bán trong). Palette: xanh #1086f2/#0868d1 + viền đậm, ≤16 màu chính. Alpha biên có ramp mềm (4.614 px bán trong). |
| co-do | `curated/co-do-sheet.png` | 512×512, rect {x:9,y:223,w:494,h:280} | 92 KB | **pass** | Cắt sạch, không halo. Palette: đỏ #f11b18/#c6110f + viền đậm, ≤16 màu chính. Alpha biên ramp mềm (4.955 px bán trong). Hình học khác cờ xanh (tạo AI riêng, cao hơn) — chấp nhận được, mỗi cờ 1 sheet riêng. |
| co-trung-lap | `curated/co-trung-lap-sheet.png` | 512×512, rect {x:9,y:277,w:494,h:226} | 51 KB | **pass** | Recolor bake từ co-xanh (luminance desaturate 0.299R+0.587G+0.114B), alpha giữ nguyên byte-identical với co-xanh (cùng 4.614 px bán trong, cùng rect). Đối chiếu: file `raw/co-trung-lap-derived.png` của nhân viên trước khớp đúng phương pháp này (mean abs diff 0,26 so với luminance của raw co-xanh) nên không dùng file đó trực tiếp mà bake lại từ frame đã cắt để alpha đồng nhất tuyệt đối. |
| coi | `curated/coi-sheet.png` | 512×512, rect {x:9,y:258,w:493,h:245} | 93 KB | **best-effort** | Đạt sau 1 lần sửa lỗi cắt (xem dưới). Palette: bạc #b1bbc4 + vàng #f2b705 + viền nâu đậm, ≤16 màu chính. Alpha biên ramp mềm (8.342 px bán trong). |

## Lỗi đã gặp và cách sửa (fail-loud, không lặng lẽ dùng)

- **Còi — lỗ trong suốt giả ở mặt trên miệng còi:** rembg/u2net nhầm vùng bạc
  rất sáng (gần trắng) trên mặt trên của miệng còi thành nền: 11.149 px có
  alpha < 128 trong vùng đó (mean alpha 171,8), soi trên nền magenta thấy
  màu nền lộ qua, trên nền tối thấy vệt tối. Đã sửa bằng binary hole-fill
  trên mask alpha > 128: fill 2.696 px lỗ kín, giữ nguyên RGB gốc (bạc sáng),
  alpha đặt 255. Kiểm tra lại trên nền tối + magenta: mặt còi đặc, không còn
  lộ nền. Cờ xanh/cờ đỏ không có lỗ (holes_filled = 0).
- **Vệt tối nhỏ còn lại trên mặt trên miệng còi** (thấy ở contact sheet) là
  shading của ảnh AI gốc, không phải lỗi cắt — chấp nhận, ghi best-effort
  thay vì pass tuyệt đối cho còi.
- **Alpha trong của rembg/u2net không bão hòa:** phần trong cờ chỉ đạt
  alpha 245–254 thay vì 255 (u2net). Đã bão hòa > 247 → 255 ở bước curation;
  nội dung nhìn không đổi, chỉ sạch số liệu.
- Không có ảnh raw nào phải tạo lại: cả 4 ảnh AI đều đúng phong cách 2D
  (flat vector, cel-shading, viền đậm, màu bão hòa, không chữ, nền trắng
  trơn, chỉ vải cờ không cột).

## Bóng đổ

- **Cờ: KHÔNG bóng trong sheet** — cờ treo trên cột, không chạm đất; bóng
  dưới chân không có ý nghĩa. Đợt C gắn thêm `filter: drop-shadow(...)` ở
  overlay nếu cần nổi khối (theo §2 bước 5 của asset-plan).
- **Còi: KHÔNG bóng trong sheet** — còi là đạo cụ/UI, có thể hiện lơ lửng
  hoặc cầm tay, không cố định trên mặt đất. Bake bóng vào sheet sẽ gây
  double-shadow nếu overlay cũng dùng drop-shadow. Khi Đợt C đặt còi trên
  mặt đất thì thêm bóng ellipse mờ (radial-gradient đen 40%) dưới chân còi
  ở phía overlay, theo ghi chú trong `sprite-request.json`.

## Đối chiếu với cờ CSS hiện tại — sprite có đẹp hơn rõ rệt không?

- **Có, rõ rệt.** Cờ hiện tại trong `games/chiem-co/src/overlay.html` là
  hình chữ nhật CSS màu phẳng (`#0284c7`/`#dc2626`/`#78716c`, bo góc) + emoji
  🏳️/🔵/🔴 ở giữa, trên cột CSS. Trong file này **không có animation vẫy**
  (không có `@keyframes`/wave — khác với giả định trong nhiệm vụ; có thể
  wave nằm ở bản khác hoặc chỉ có trong kế hoạch). Sprite AI là lá cờ vải
  thật: nếp gấp, cel-shading, viền đậm, hình dáng bay — hơn hẳn hình chữ
  nhật + emoji, kể cả khi chưa có wave. **Khuyến nghị dùng sprite.**
- Lưu ý cho Đợt C: sprite cờ rộng (tỉ lệ ~2,2:1), mép trái là phía cán cờ
  (gấp nhọn) — khi gắn phải căn mép trái sprite vào cột, không căn giữa;
  hiệu ứng vẫy vẫn cần CSS (skew/sway nhẹ trên `<img>`), sprite chỉ thay
  phần vải. Còi hiện chưa có trong overlay — là đạo cụ mới, Đợt C tự chọn
  vị trí (góc thông báo/trọng tài).

## Checklist Đợt B (§5 research)

- [x] B1 sprite-request.json đã có từ trước, tuân theo (cell 512×512, anchor bottom-centre, idle 1 frame)
- [x] B3 1 cell thống nhất/game, nền trắng phẳng lúc tạo
- [x] B4 idle 1 frame (hiệu ứng bằng CSS), không tham frame
- [x] B5 kiểm tra sau cắt: halo = 0 (cờ), chi tiết còn nguyên, alpha biên ramp mềm, PNG < 300 KB, alpha thật (4 góc sheet alpha = 0)
- [x] B6 bóng: cờ không cần (treo cột); còi không bake bóng, thêm ở overlay (lý do trên)
- [x] B7 mỗi sprite 1 sheet + manifest.json (frame_layout rect tuyệt đối, animation fps/durations_ms/loop)
- [x] B8 GIF preview + contact sheet; frame lỗi (lỗ còi) đã dừng và sửa, không lặng lẽ dùng
- [x] B9 raw/ → frames/ → curated/; overlay chỉ đọc curated/
- [ ] C1–C5 Đợt C gắn overlay — chưa làm (ngoài phạm vi nhiệm vụ này)

## File đã giao

- `frames/co-xanh.png`, `frames/co-do.png`, `frames/coi.png` (rembg thô),
  `frames/co-trung-lap.png` (recolor bake từ co-xanh)
- `curated/co-xanh-sheet.png` + `curated/co-xanh-manifest.json`
- `curated/co-do-sheet.png` + `curated/co-do-manifest.json`
- `curated/co-trung-lap-sheet.png` + `curated/co-trung-lap-manifest.json`
- `curated/coi-sheet.png` + `curated/coi-manifest.json`
- `qa/co-*-preview.gif` (4 file), `qa/contact-sheet-dark.png`
- `SOURCES.md`, `qa-notes.md` (file này)
- Không sửa code overlay nào.
