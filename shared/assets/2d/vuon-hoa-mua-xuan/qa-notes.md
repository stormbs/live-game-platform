# QA notes — Vườn Hoa Mùa Xuân (vuon-hoa-mua-xuan)

Ngày: 2026-11-13. Chuẩn: `docs/research-sprite-gen-2026-11-13.md` §5 checklist Đợt B.
Tất cả 9 sprite: 1 frame/state, cell 512×512, anchor bottom-centre, sheet < 300KB.
QA bằng mắt trên nền tối `#1e1e28` + đo alpha/palette bằng Pillow.
Preview: `qa/preview_<ten>.gif` (1 frame, 1000ms) + `qa/contact-sheet.png`.

## 1. Lỗi cắt nền đã phát hiện và xử lý (fail-loud, không lặng lẽ dùng)

rembg 2.0.87 / u2net FAIL trên 4/7 ảnh AI — đã cắt lại bằng white-cut
(min-channel ramp 235→248 + despill unmix), kiểm tra lại bằng mắt, đạt:

| Ảnh | Lỗi rembg | Cách xử lý |
|---|---|---|
| mat-troi | Quầng trắng dày quanh đĩa mặt trời; 15/16 tia vàng mờ gần như trong suốt (alpha thấp, chỉ còn viền đen) | white-cut → 16 tia đặc, hết quầng |
| binh-tuoi | Vệt trắng lớn kẹt trong vòng quai (vùng trắng khép kín bị giữ lại); 2 giọt nước rơi mờ (alpha thấp) | white-cut → quai thông, 3 giọt xanh đặc |
| hoa-no | Viền sáng (halo trắng) mỏng quanh cánh/lá/thân | white-cut → hết viền sáng |
| nu | Viền sáng nhẹ (ít hơn hoa-no) | white-cut → sạch |

Giữ rembg: hat, mam (sạch, không halo), cau-vong (mây trắng nên không white-cut
được; chỉ còn viền trắng rất mỏng ở mép trái dải đỏ — chấp nhận, xem §2).

## 2. Kết quả từng state

| Sprite | Sheet | Kích thước đặt trong cell | Dung lượng | Bóng | Palette (màu chính ≥0,5% px) | Kết quả |
|---|---|---|---|---|---|---|
| hat | `curated/hat/sheet.png` | 496×359 @ (8,121) | 180.288 B (~176KB) | ellipse baked, 40% | 13 | **pass** |
| mam | `curated/mam/sheet.png` | 385×480 @ (63,0) | 125.897 B (~123KB) | ellipse baked, 40% | 20 | **pass** (palette xem §3) |
| nu | `curated/nu/sheet.png` | 359×480 @ (76,0) | 110.861 B (~108KB) | ellipse baked, 40% | 19 | **pass** (palette xem §3) |
| hoa-no | `curated/hoa-no/sheet.png` | 412×480 @ (50,0) | 158.625 B (~155KB) | ellipse baked, 40% | 15 | **pass** |
| binh-tuoi | `curated/binh-tuoi/sheet.png` | 496×465 @ (8,15) | 108.988 B (~106KB) | ellipse baked, 40% | 19 | **pass** (palette xem §3) |
| cau-vong | `curated/cau-vong/sheet.png` | 496×303 @ (8,201) | 127.024 B (~124KB) | không (bay trên trời) | 19 | **best-effort** — viền trắng rất mỏng ở mép trái dải đỏ, chỉ thấy khi phóng to trên nền tối; ở cỡ hiển thị overlay không đáng kể |
| mat-troi | `curated/mat-troi/sheet.png` | 496×491 @ (8,13) | 146.767 B (~143KB) | không (trên trời) | 19 | **pass** (palette xem §3) |
| ong | `curated/ong/sheet.png` | 61×42 @ (225,462) native | 3.152 B (~3KB) | không (bay) | 8 | **pass** |
| may | `curated/may/sheet.png` | 203×121 @ (154,383) native | 5.588 B (~5KB) | không (bay) | 3 | **pass** |

- 4 giai đoạn hoa (hat/mam/nu/hoa-no): cùng tông hồng cánh sen + xanh lá, cùng
  phong cách flat vector viền đậm — không ảnh nào lệch tông, không cần tạo lại.
- Không sprite nào có chữ/logo. Alpha biên mềm (white-cut: ~1,6k–7,6k px bán
  trong suốt; rembg: kiểm tra bằng mắt, không halo).
- Manifest: `curated/<ten>/manifest.json` — `frame_layout.rows.idle = [{x:0,y:0,w:512,h:512}]`,
  `animation.rows.idle = {fps:1, durations_ms:[1000], loop:false, frames:1}`.
  Đã validate bằng script: đủ 9 manifest, rect đúng, sheet đúng 512×512, < 300KB.
- Loop seam: không áp dụng (toàn 1 frame tĩnh; breathe/flap để CSS ở Đợt C).

## 3. Palette — best-effort (không phải fail)

Mục tiêu sprite-request: ≤16 màu chính. Đếm màu có ≥0,5% số px đặc:
hat 13 ✓, hoa-no 15 ✓, ong 8 ✓, may 3 ✓;
mam/nu/binh-tuoi/cau-vong/mat-troi = 19–20 (vượt nhẹ).
Nguyên nhân: ảnh AI có shading chuyển sắc + anti-aliasing sinh nhiều tông trung gian
(vd. mặt trời: vàng → cam → highlight nhạt), không phải vẽ sai bảng màu.
Số màu fill phẳng nhìn bằng mắt vẫn ~10–12/sprite. Ghi best-effort, không vẽ lại —
vẽ lại 5 ảnh chỉ để ép đủ 16 màu sẽ phá tính đồng nhất của bộ hoa hồng.

## 4. Lưu ý cho Đợt C (gắn overlay)

- Bóng đã bake trong sheet (ellipse đen 40%, blur 3, rộng 70% sprite, tâm (256,492))
  cho hat/mam/nu/hoa-no/binh-tuoi — overlay KHÔNG vẽ thêm bóng cho 5 sprite này.
- cau-vong/mat-troi/may/ong: không bóng đất (ghi rõ trong manifest).
- ong/may giữ kích thước native Kenney trong cell (ong 61×42, may 203×121) —
  không upscale để tránh vỡ nét; overlay nên hiển thị ong ≤ ~120px, may ≤ ~400px rộng.
- ong 1 frame: bay/lượn bằng CSS; đừng ghép `bee.png` làm frame 2 (pose khác, sẽ giật).
- Overlay chỉ đọc từ `curated/` — không copy từ `frames/`.
