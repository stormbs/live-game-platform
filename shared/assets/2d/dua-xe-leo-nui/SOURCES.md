# Nguồn asset — Đua Xe Leo Núi (dua-xe-leo-nui)

Ngày: 2026-11-13. Quy tắc: vendor CC0 trước, tự tạo sau (xem
`docs/asset-plan-2d-2026-11-13.md` §0 và `docs/research-sprite-gen-2026-11-13.md` §3).

## Xe đua (1 base → bake 5 màu)

| File chốt | Nguồn |
|---|---|
| `curated/xe-dua-sheet.png` + `xe-dua-manifest.json` (5 màu × idle/drive) | **AI tự tạo** — 1 xe base duy nhất `raw/xe-base-raw.png` (xe đỏ, flat vector 2D, prompt chuẩn §0.1 + nền trắng trơn), rồi bake 5 colourway bằng palette swap xác định (script `build-sprites.py`, giữ alpha byte-identical). KHÔNG vẽ 5 xe riêng, KHÔNG CSS hue-rotate. Chi tiết bake: `curated/bake-report.json`. |
| 5 màu | do `#E5322D`, xanh-duong `#1E90FF`, vang `#FFCF3D`, xanh-la `#22C55E`, tim `#A855F7` (khớp `CAR_COLORS` trong overlay, trừ đỏ thay cam `#F97316` — xem ghi chú dưới). |

Ghi chú: overlay hiện dùng 5 màu `CAR_COLORS` = vàng, xanh dương, tím, xanh lá,
**cam** (`#F97316`). Sprite giao màu **đỏ** theo brief (task giao `xe-do.png`).
Khi gắn Đợt C: hoặc map slot cam → sprite đỏ, hoặc bake thêm colourway cam
(`#F97316`) từ cùng base (1 dòng trong `COLORWAYS`, chạy lại script).

## Cờ đích

| File chốt | Nguồn |
|---|---|
| `curated/co-dich-sheet.png` + `co-dich-manifest.json` | **AI tự tạo** — `raw/co-dich-raw.png` (cờ caro đen trắng + cán cờ, flat vector 2D, prompt chuẩn §0.1 + nền trắng trơn), cắt nền bằng rembg (u2net). Vendor Kenney chỉ có cờ màu trơn (platformer-art-deluxe `flagBlue/Red/...`), không có cờ caro nên không dùng vendor được. |

## Mây

| File chốt | Nguồn |
|---|---|
| `curated/may-sheet.png` + `may-manifest.json` | **Vendor Kenney — CC0 1.0** (public domain, dùng thương mại thoải mái, không bắt buộc ghi nguồn). Pack `background-elements`, file gốc `kenney_background-elements/PNG/cloud1.png` (190×127, đã trong suốt sẵn, không cần rembg), lưu kèm tại `raw/may-vendor-kenney-cloud1.png`. Nguồn pack: https://kenney.nl/assets/background-elements (giấy phép CC0, xem `shared/assets-vendor/SOURCES.md` §1). |

## File trung gian

- `raw/` — ảnh gốc, không ghi đè: `xe-base-raw.png`, `co-dich-raw.png`,
  `may-vendor-kenney-cloud1.png`.
- `frames/` — cache đã cắt nền / đã fit cell: `xe-base-cut.png`,
  `co-dich-cut.png`, `xe-base.png` (base trong cell), `co-dich.png`, `may.png`.
- `build-sprites.py` — pipeline Pillow tái tạo toàn bộ (đọc `sprite-request.json`).
- `sprite-request.json` — SSoT số học (cell, anchor, states, fps, màu).
- `qa-notes.md` — kết quả kiểm chứng từng state.
