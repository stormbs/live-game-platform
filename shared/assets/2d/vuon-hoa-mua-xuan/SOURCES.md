# Nguồn sprite — Vườn Hoa Mùa Xuân (vuon-hoa-mua-xuan)

Phong cách: 2D GAME ASSET — flat vector, cel-shading, viền đậm, màu bão hòa.
Chuẩn số học: `sprite-request.json` (cell 512×512, anchor bottom-centre, 1 frame/state).

## 1. AI tự tạo (ảnh gốc trong `raw/`, prompt chuẩn §0.1 asset-plan + nền trắng trơn)

| Sprite | File raw | Cắt nền |
|---|---|---|
| hat (hạt trên đất) | `raw/media-generation-hat-raw-0-b4665eb4-3b6c-4471-9581-e9150424bbad.png` | rembg u2net |
| mam (mầm 2 lá) | `raw/media-generation-mam-raw-0-754b56ce-7e5f-41ee-8e70-30b1bd70f629.png` | rembg u2net |
| nu (nụ hồng) | `raw/media-generation-nu-raw-0-766cb51a-0bdf-4d36-88c1-8eefec223a7d.png` | white-cut (xem §3) |
| hoa-no (hoa hồng nở) | `raw/media-generation-hoa-no-raw-0-28a55517-1978-4c98-80db-8e04e55365a6.png` | white-cut (xem §3) |
| binh-tuoi (bình tưới xanh) | `raw/media-generation-binh-tuoi-raw-0-7b3a318b-3370-404a-ada2-6eb462070fdb.png` | white-cut (xem §3) |
| cau-vong (cầu vồng 7 màu + mây 2 đầu) | `raw/media-generation-cau-vong-raw-0-187bb48d-3a69-440d-adec-dc879abc71df.png` | rembg u2net |
| mat-troi (mặt trời cười + 16 tia) | `raw/media-generation-mat-troi-raw-0-6aa0104e-ab4f-485c-96b9-a8f30c713d58.png` | white-cut (xem §3) |

## 2. Vendor Kenney — CC0 1.0 Universal (public domain, dùng thương mại thoải mái, không bắt buộc ghi nguồn)

Nguồn gốc đã kiểm chứng trong `shared/assets-vendor/SOURCES.md`
(Kenney: "all game assets on the asset pages are public domain licensed (CC0)").

| Sprite | File vendor gốc | Kiểm chứng |
|---|---|---|
| ong | `shared/assets-vendor/kenney_platformer-art-deluxe/Extra animations and enemies/Enemy sprites/bee_fly.png` (61×42) | md5 trùng byte 100% với file lạc ở thư mục game (`9af9dab61fb3b058753751a7ec6e5ad1`); bản sao lưu ở `raw/kenney_bee_fly.png` |
| may | `shared/assets-vendor/kenney_background-elements-remastered/PNG/Default/cloud1.png` (203×121) | pixel trùng 100% (mean abs diff 0.0) với file lạc ở thư mục game; bản sao lưu ở `raw/kenney_cloud1.png` |

Cả hai đều là PNG trong suốt sẵn — không cần cắt nền. File lạc `ong.png` / `may.png`
ở thư mục gốc của game đã được chuyển về `frames/` (và bản gốc vendor lưu thêm ở `raw/`).

## 3. Ghi chú phương pháp cắt nền

- **rembg u2net** (mặc định): sạch với hat, mam, cau-vong.
- **white-cut** (nu, hoa-no, binh-tuoi, mat-troi): rembg u2net FAIL trên 4 ảnh này
  (xem `qa-notes.md` §1) nên cắt lại bằng phương pháp xác định: alpha theo
  min-channel, ramp 235→248 + despill unmix nền trắng ở pixel bán trong suốt.
  Chỉ dùng được vì 4 ảnh này không có chi tiết trắng trong chủ thể
  (cau-vong có mây trắng nên KHÔNG dùng white-cut — giữ rembg).
- **ong 2-frame**: KHÔNG làm. Kenney có thêm `bee.png` (56×48) nhưng đó là pose
  khác hẳn (thân xoay dọc, cánh khép) — ghép với `bee_fly.png` thành loop sẽ giật
  hình, không "gọn". Giữ 1 frame `bee_fly` (cánh xòe), bay bằng CSS ở Đợt C
  (đúng quyết định đã ghi trong `sprite-request.json`).
