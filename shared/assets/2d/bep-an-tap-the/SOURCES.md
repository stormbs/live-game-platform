# Nguồn sprite — Bếp Ăn Tập Thể (bep-an-tap-the)

Ngày: 2026-11-13. Phong cách: 2D game asset — flat vector, cel-shading, viền đậm,
màu bão hòa (theo `docs/asset-plan-2d-2026-11-13.md` §0). SSoT số học:
`sprite-request.json` (cell 512×512, anchor bottom-centre).

> Ghi chú hợp nhất 2 phiên (2026-11-13 ~09:55 UTC): phiên tiếp nối chạy chồng
> lên phiên trước và ghi đè `curated/` lúc 09:47 UTC; toàn bộ sheet đã được
> dựng lại theo đúng pipeline + số đo trong qa-notes gốc (composite bếp lửa,
> quantize palette) từ `frames/` còn nguyên và `qa/*.gif` còn sót, đo lại toàn
> bộ — xem `qa-notes.md` (đầu file). Bảng dưới đây giữ nguyên kết luận nguồn
> của phiên trước, bổ sung snapshot ID + công cụ nén bản dựng lại.

## 1. Vendor đã kiểm tra TRƯỚC (ưu tiên theo quy trình)

| Nguồn | Kết quả |
|---|---|
| Kenney **food-kit** (CC0, https://kenney.nl/assets/food-kit) — `shared/assets-vendor/kenney_food-kit/Previews/` | **KHÔNG DÙNG.** Tên file khớp (pot-stew, meat-cooked, salad, shaker-salt, bowl-soup) nhưng preview chỉ **64×64px** và là **low-poly 3D render** — trái chuẩn flat-vector bắt buộc của asset-plan §0, phóng to sẽ vỡ. Đã xem trực tiếp 5 preview phóng to để xác nhận. |
| Kenney **furniture-kit** (CC0) | **KHÔNG DÙNG.** Chỉ có bếp điện isometric (`kitchenStove*.png`), không có nồi/bếp lửa. |
| Kenney **particle-pack** (CC0) | Không dùng — flame/smoke PNG có sẵn nhưng là hiệu ứng hạt, không phải bếp lửa hoàn chỉnh. |

## 2. Sprite bản chốt (curated/ — overlay chỉ đọc từ đây)

Tất cả **AI tự tạo** bằng media.generate_image, prompt chuẩn asset-plan §0.1
(`2D game asset art, flat vector style, cel shading, vibrant saturated colors,
clean shapes, bold outlines, side-scroller game background, no text` +
`isolated on plain solid white background, full body, centered`),
cắt nền bằng **rembg 2.0.87 (u2net, Python API `from rembg import remove`)**,
fit cell 512×512 + bóng ellipse đen ~40%, rồi **quantize palette**
(phiên trước: Pillow FASTOCTREE 256 màu; bản dựng lại: pngquant 2.18.0
`--quality=65-80 --speed 1`, sai lệch trung bình 0.83–1.42/255, so sánh trực
tiếp trước/sau: không khác biệt nhìn thấy được, dung lượng giảm ~70%).

| Sprite (curated/) | Nguồn | Snapshot ID (trong `raw/*.json`) | Ghi chú |
|---|---|---|---|
| `noi-sheet.png` + `noi-manifest.json` | AI tự tạo (1 ảnh gốc `raw/noi.png`, 1600×1600) | `9355f032-b366-4d68-8941-ae2a585cf1b0:yf3nv4` | Nồi đen + hơi nước, nghiêng 3/4 |
| `bep-lua-sheet.png` + `bep-lua-manifest.json` | AI tự tạo (frame 1 `raw/bep-lua.png` + 3 biến thể lửa `raw/bep-lua-f2/f3/f4.png` từ cùng snapshot, chỉ đổi hình lửa) | `24477f25-8df9-4d9a-8d38-65a71fb1063e:elr3f9` (f1; f2–f4 không có `.json` riêng) | 4 frame burn 8fps. Frame 2–4 đã composite lại trên nền bếp/củi/bóng của frame 1 (blend y 280–320) để bếp không rung — xem qa-notes.md |
| `thit-sheet.png` + `thit-manifest.json` | AI tự tạo (1 ảnh gốc `raw/thit.png`, 1600×1600) | `505c3428-446b-4307-9efa-d1bdccc0a250:4c415k` | Đùi gà chiên trên đĩa |
| `rau-sheet.png` + `rau-manifest.json` | AI tự tạo (1 ảnh gốc `raw/rau.png`, 1600×1600) | `7f570c4d-df22-4095-8e14-3920fef44515:g4eiii` | Đĩa rau cải/xà lách |
| `muoi-sheet.png` + `muoi-manifest.json` | AI tự tạo (1 ảnh gốc `raw/muoi.png`, 1920×1280) | `499d53f7-0a29-45bc-9539-f15add9c87da:rnwxtf` | Bát muối trắng + thìa gỗ |
| `canh-sheet.png` + `canh-manifest.json` | AI tự tạo (1 ảnh gốc `raw/canh.png`, 1920×1280) | `846bd41c-02f6-4c6a-9dec-25f91a9366a5:9clbvo` | Bát canh + hơi nước + thìa kim loại; bản dựng lại fit theo content-bbox (472px, xem qa-notes.md) |

## 3. Lưu trữ

- `raw/` — ảnh gốc AI (không ghi đè) + file `.json` sidecar của media-generation.
- `frames/` — `*-cut.png` (rembg, full-size trong suốt) + `*.png` (cell 512×512 đã fit + bóng; bản RGBA gốc, chưa quantize).
- `curated/` — sheet + manifest.json bản chốt (overlay chỉ đọc từ đây).
- `qa/` — GIF preview từng state + `qa-notes.md`.

## 4. Giấy phép / lưu ý

- Ảnh AI tự tạo: không vướng bản quyền bên thứ ba; phong cách flat-vector tự vẽ theo prompt.
- Vendor Kenney CC0 đã kiểm tra nhưng không dùng (lý do ở mục 1) — không có asset vendor nào trong bản chốt.
- Không sửa code overlay nào trong đợt này (chỉ asset + docs).
