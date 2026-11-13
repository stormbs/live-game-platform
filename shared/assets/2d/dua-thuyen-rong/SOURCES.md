# Nguồn asset — Đua Thuyền Rồng (dua-thuyen-rong)

Ngày: 2026-11-13. Quy tắc: vendor CC0 trước, tự tạo sau (asset-plan §0).

## Vendor — đã kiểm tra, KHÔNG có asset khớp

- Kenney (kenney.nl, toàn bộ CC0) và OpenGameArt (chỉ CC0/CC-BY): không có
  thuyền rồng, trống lễ hội, cờ đích kẻ ô, mái chèo khớp phong cách game.
  → Không dùng asset vendor nào cho game này.

## Tự tạo bằng AI — toàn bộ 5 sprite

Ảnh gốc trong `raw/` (AI tạo theo prompt chuẩn §0.1 + nền trắng trơn),
cắt nền bằng `rembg` 2.0.87 session `u2net` thành PNG trong suốt (`frames/`),
gom thành sheet + manifest (`curated/`). Ảnh AI tự tạo thuộc sở hữu của
công ty Strom (không dùng asset có bản quyền của bên thứ ba).

| Sprite | Nguồn | File gốc |
|---|---|---|
| thuyen-vang | AI tự tạo | `raw/thuyen-vang.png` (2736×912) |
| thuyen-do | AI tự tạo | `raw/thuyen-do.png` (2736×912) |
| trong | AI tự tạo | `raw/trong.png` (1600×1600) |
| co-dich | AI tự tạo | `raw/co-dich.png` (1120×2240) |
| mai-cheo | AI tự tạo | `raw/mai-cheo.png` (1600×1600) |

## Xử lý thêm

- 2 sheet thuyền được palette-quantize 64 màu (Pillow Fast Octree, giữ
  alpha) để đạt gate <300KB — xem `qa-notes.md` §5. Không thay đổi nguồn gốc.
- Bóng ellipse mờ vẽ bằng Pillow trong quá trình build (`build-sprites.py`).
- Không dùng CSS hue-rotate; không palette-swap thuyền đỏ từ thuyền vàng
  (hình học khác nhau — xem `qa-notes.md` §3).
