# Nguồn asset game 2D — Strom Live Game Platform

Thư mục này chứa asset game 2D tải về từ các nguồn miễn phí bản quyền, dùng làm
tài nguyên cho 14 overlay TikTok LIVE (nền, sprite, UI, hiệu ứng).
**Tất cả asset trong thư mục này đều được phép dùng thương mại.**
Ảnh nền AI tự tạo cho từng game nằm ở `../bg/*.webp` (không thuộc file này).

## 1. Kenney — https://kenney.nl/assets (toàn bộ CC0)

Giấy phép: **CC0 1.0 Universal (public domain)** — dùng thương mại thoải mái,
không bắt buộc ghi nguồn. Xác nhận tại https://kenney.nl/support
("all game assets on the asset pages are public domain licensed (CC0)")
và từng trang pack đều ghi "License: CC0" (đã kiểm tra trực tiếp trang
https://kenney.nl/assets/ui-pack ngày 2026-11-13).
Tải bằng link ký từ kenney.nl (endpoint `download-link`), giữ nguyên file zip gốc
+ giải nén vào thư mục cùng tên.

| Pack | Trang nguồn | Nội dung chính | File |
|---|---|---|---|
| background-elements | https://kenney.nl/assets/background-elements | Cây, mây, lâu đài, cỏ, hàng rào — dựng nền 2D | 135 |
| background-elements-remastered | https://kenney.nl/assets/background-elements-remastered | Bản làm lại của background-elements | 171 |
| ui-pack | https://kenney.nl/assets/ui-pack | 430+ nút, panel, slider, font, âm thanh UI | 1315 |
| game-icons | https://kenney.nl/assets/game-icons | Icon game (PNG + Vector + spritesheet) | 434 |
| platformer-art-deluxe | https://kenney.nl/assets/platformer-art-deluxe | Tiles + nhân vật platformer, bản gốc + 4 expansion (buildings, candy, ice, mushroom) | 1021 |
| simplified-platformer-pack | https://kenney.nl/assets/simplified-platformer-pack | Tiles + nhân vật platformer đơn giản | 101 |
| food-kit | https://kenney.nl/assets/food-kit | Đồ ăn, nguyên liệu (2D renders) — game Bếp Ăn | 1009 |
| furniture-kit | https://kenney.nl/assets/furniture-kit | Nội thất phòng (isometric + 2D) — game Buồng Giam / Bếp Ăn | 1546 |
| particle-pack | https://kenney.nl/assets/particle-pack | Hiệu ứng hạt (pháo hoa, confetti, khói) PNG trong suốt + nền đen | 195 |
| pixel-ui-pack | https://kenney.nl/assets/pixel-ui-pack | UI pixel 9-slice | 40 |
| tiny-town | https://kenney.nl/assets/tiny-town | Tiles + tilemap thị trấn mini — game Thắp Sáng Bản Đồ | 141 |
| playing-cards-pack | https://kenney.nl/assets/playing-cards-pack | Bộ bài tây — game Vòng Quay / Đấu Trí | 291 |
| animal-pack | https://kenney.nl/assets/animal-pack | Sprite động vật — game Vườn Hoa | 124 |
| input-prompts | https://kenney.nl/assets/input-prompts | Phím bàn phím / chuột / tay cầm (hướng dẫn chơi) | 4667 |
| pattern-pack | https://kenney.nl/assets/pattern-pack | Pattern + texture làm nền (PNG + Vector + tilesheet) | 256 |

Tổng Kenney: 15 pack, ~11.400 file.

## 2. OpenGameArt.org — https://opengameart.org (chỉ CC0, kiểm tra từng asset)

Giấy phép từng asset đã kiểm tra trực tiếp trên trang của asset đó
(trường "License(s): CC0"). Tải từ `https://opengameart.org/sites/default/files/<tên file>`,
giữ nguyên file zip gốc + giải nén vào thư mục cùng tên.

| Asset | Tác giả | Trang nguồn | Giấy phép | Nội dung chính | File |
|---|---|---|---|---|---|
| Sunny Land 2D Pixel Art Pack | ansimuz (Luis Zuno) | https://opengameart.org/content/sunny-land-2d-pixel-art-pack | CC0 | Parallax background, nhân vật 6 animation, 3 enemy, items + FX — platformer | 302 |
| Superpowers assets — background elements | Sparklin Labs | https://opengameart.org/content/superpowers-asset-packs | CC0 | Lớp nền parallax nhiều chủ đề (medieval-fantasy...) | 315 |
| Public Domain Backgrounds | madameberry | https://opengameart.org/content/public-domain-backgrounds | CC0 | 5 ảnh nền menu/desktop | 5 |
| UI Casual Free #5 [Buttons, Bars, Panels] | Wenrexa | https://opengameart.org/content/assets-ui-casual-free-5-buttons-bars-panels | CC0 | 717 nút/bar/panel 3 màu (vàng, tím, xanh) | 719 |
| Free Bubble Game Button Pack | pzUH (GameArt2D) | https://opengameart.org/content/free-bubble-game-button-pack | CC0 | 40+ nút kiểu bong bóng, 4 biến thể màu (PNG + vector) | 6 |
| Meter | (xem trang asset) | https://opengameart.org/content/meter | CC0 | Thanh tiến độ 3 mảnh (back/empty/filler), 200×1000 | 3 |

Tổng OpenGameArt: 6 asset, ~1.350 file.

## 3. Asset tìm được nhưng KHÔNG tải

| Asset | Nguồn | Lý do |
|---|---|---|
| platformer-pack-redux | kenney.nl | Trang pack không còn tồn tại (Error 2026-11-13) — thay bằng `platformer-art-deluxe` + `simplified-platformer-pack` |
| emoticons (Kenney) | kenney.nl | Trang pack không còn tồn tại (Error 2026-11-13) |
| casino-pack, board-game-pack | kenney.nl | Trang pack không còn tồn tại (Error 2026-11-13) |
| Pixel UI pack (OpenGameArt) | opengameart.org/content/pixel-ui-pack | Trùng byte 100% với Kenney `pixel-ui-pack` (cùng md5 `5a6b056180f7a7e16446883d2233a562`) — đã xóa bản trùng, giữ bản Kenney |
| toon-characters-1, scribble-platformer, space-shooter-redux | kenney.nl | Tồn tại, CC0, nhưng lệch hướng 2D hiện tại / chưa cần cho 14 game — có thể tải sau khi cần |

## Ghi chú sử dụng

- CC0 = dùng tự do, kể cả thương mại, không cần ghi nguồn. CC-BY (không có
  asset nào trong thư mục này) sẽ bắt buộc ghi tên tác giả — nếu tải thêm asset
  CC-BY sau này, ghi tên tác giả vào bảng mục 2.
- Không dùng logo Kenney trong sản phẩm (logo chỉ dành cho dự án chính thức của Kenney).
- Tổng dung lượng thư mục: ~221 MB, ~12.800 file (tính đến 2026-11-13).
