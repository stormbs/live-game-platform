# QA notes — Đua Thuyền Rồng (dua-thuyen-rong), Đợt B

Ngày: 2026-11-13. Người làm: nhân viên thiết kế (tiếp nối ca trước).
SSoT: `sprite-request.json` v1.0. Script build tái chạy được: `build-sprites.py`
(frames/ → curated/ + qa/). Không sửa code overlay nào.

## 1. Ảnh raw — kiểm chứng bằng mắt trước khi cắt

Cả 5 ảnh raw đều ĐẠT, không cần tạo lại:
- Phong cách 2D game asset đúng chuẩn §0: flat vector, cel-shading, viền đậm,
  màu bão hòa. Không có chữ/logo. Nền trắng trơn.
- `thuyen-vang`: thuyền vàng, đầu rồng chi tiết ở mũi, đuôi lửa cong ở lái,
  4 người chèo áo đỏ/khăn đỏ, mái chèo rõ. `thuyen-do`: thuyền đỏ, đầu rồng
  khác hẳn (mắt, bờm, đuôi xoắn ốc), 4 người chèo áo vàng/khăn vàng.
- `trong`: trống đỏ + dùi đầu đỏ bắt chéo + giá gỗ. `co-dich`: cờ kẻ ô
  đen/trắng bay + cán gỗ + cầu vàng. `mai-cheo`: 1 mái chèo gỗ nghiêng.

## 2. Cắt nền (rembg)

- Dùng Python API `rembg` 2.0.87, session **`u2net`** (đúng sprite-request).
  LƯU Ý: `remove()` mặc định ở bản này tải model `bria-rmbg` ~1,02GB
  (đã dừng kịp, xóa file tạm); phải chỉ định `new_session("u2net")` —
  model u2net đã cache sẵn (`~/.rembg/models/u2net/u2net.onnx`, 176MB),
  cắt xong 5 ảnh trong ~20s.
- Kiểm chứng sau cắt (contact sheet nền tối `#102A44` + nền trắng):
  viền sạch, KHÔNG halo màu key; râu rồng, mái chèo mỏng, tua khăn còn nguyên;
  alpha biên mềm.
- Phân bố alpha (mẫu `thuyen-vang` / `trong`): alpha 0 = 65,4% / 55,7%;
  alpha 1–7 (nhiễu nền) chỉ 2,7% / 1,0%, không thấy bằng mắt trên nền tối;
  dải 248–254 (cạnh anti-alias) 23,9% / 30,9% — bình thường với art AI,
  không phải halo. Không cần làm sạch thêm.

## 3. Palette swap — KHÔNG áp dụng (đã ghi rõ lý do)

2 thuyền AI vẽ riêng, **hình học khác nhau** (đầu rồng, bờm, đuôi, dáng thân,
vị trí người chèo đều khác) nên không có map hex→hex đúng. Giữ 2 base riêng
theo `recolor_note` trong sprite-request. Không dùng CSS hue-rotate.

## 4. Frame animation

- `idle` (4f, 4fps, loop): bob dọc y `[0,-4,-8,-4]`px, bóng cố định ở ground
  line (thuyền nhấp nhô phía trên bóng). Seam khép kín: bước frame cuối →
  frame đầu là +4px, cùng biên độ các bước còn lại.
- `row` (4f, 8fps, loop): **best-effort** — bob `[0,-3,-6,-3]`px + rock
  xoay `[-1,0,1,0]°` quanh tâm đáy. Đây KHÔNG phải animation tay chèo thật:
  từ 1 frame tĩnh không thể tách tay/mái chèo để khua riêng bằng Pillow mà
  không vẽ sai. Nếu Đợt C cần tay khua thật: thêm hiệu ứng CSS (xoay nhẹ
  cả sprite đã có sẵn trong row) hoặc vẽ lại 4 pose chèo riêng.
- Near-duplicate check (IoU alpha mask các frame idle liên tiếp, kể cả wrap):
  thuyen-vang 0,837; thuyen-do 0,866 — đều < 0,98 → chuyển động thật,
  không frame hold ngoài ý muốn.
- Bóng: ellipse đen mờ ~40% (alpha 102/255, blur 6px) dưới thân thuyền /
  dưới chân vật thể, vẽ vào từng frame của sheet. Thuyền: 860×34px tại
  y=478 (cell 1024×512). Trống: 380×30. Cờ đích: 220×24. Mái chèo: 300×26.

## 5. Dung lượng — sheet thuyền phải palette-quantize mới đạt gate

Sheet thuyền RGBA gốc: thuyen-vang 2.251.650 B, thuyen-do 2.548.233 B
(8 frame chi tiết vảy rồng nén PNG kém) — VƯỢT gate <300KB.
Giải pháp: quantize palette 64 màu (Pillow Fast Octree, giữ alpha) —
so sánh cạnh nhau trên nền tối: **không thấy khác biệt bằng mắt**
(đầu rồng, người chèo, vảy đều nguyên; không banding).
Sau quantize: thuyen-vang 204.387 B, thuyen-do 255.001 B. ĐẠT gate.
3 sheet tĩnh giữ RGBA gốc (đã <300KB). GIF preview được xuất lại từ sheet
cuối cùng đã quantize nên QA thấy đúng bản sẽ ship.

## 6. Kết quả từng state

| Sprite / state | Kết quả | Ghi chú |
|---|---|---|
| thuyen-vang / idle | **pass** | Bob mượt, seam kín, bóng cố định |
| thuyen-vang / row | **best-effort** | Rock + bob; không có tay chèo khua thật (xem §4) |
| thuyen-do / idle | **pass** | Như trên |
| thuyen-do / row | **best-effort** | Như trên |
| trong / static | **pass** | 1 frame, đứng yên theo §3c |
| co-dich / static | **pass** | 1 frame; cờ bay đã vẽ sẵn trong ảnh |
| mai-cheo / static | **pass** | 1 frame |

## 7. File QA

- `qa/thuyen-vang-idle.gif`, `qa/thuyen-vang-row.gif`,
  `qa/thuyen-do-idle.gif`, `qa/thuyen-do-row.gif` — preview từng state.
- `qa/thuyen-*-idle-strip.png`, `qa/thuyen-*-row-strip.png` — filmstrip
  4 frame/state trên nền tối, kiểm tra bob/rock + seam.
- `qa/contact-sheet-dark.png`, `qa/contact-sheet-white.png` — toàn bộ
  5 sprite trên nền tối + trắng (kiểm tra halo).
