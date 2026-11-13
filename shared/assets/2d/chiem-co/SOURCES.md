# Nguồn asset — game Chiếm Cờ (chiem-co)

Ngày: 2026-11-13. Quy tắc nguồn theo `docs/asset-plan-2d-2026-11-13.md` §0:
vendor CC0 trước, tự tạo sau. Game này **không dùng asset vendor** (không có
cờ vải/còi trọng tài 2D khớp trong Kenney/OpenGameArt đã săn ở Đợt A) — toàn
bộ sprite là ảnh AI tự tạo + cắt nền, thuộc sở hữu của công ty, không dính
giấy phép bên thứ ba.

## Sprite đã chốt (curated/)

| Sprite | File chốt | Nguồn | Giấy phép / quyền dùng |
|---|---|---|---|
| Cờ xanh | `curated/co-xanh-sheet.png` | Ảnh AI tự tạo (prompt chuẩn §0.1 + nền trắng trơn), cắt nền bằng rembg 2.0.87 (u2net). Raw: `raw/media-generation-co-xanh-raw-0-e75aed9a-427b-41f0-abd2-35eaafad5740.png` | Tự tạo — công ty sở hữu |
| Cờ đỏ | `curated/co-do-sheet.png` | Ảnh AI tự tạo, cắt nền bằng rembg 2.0.87 (u2net). Raw: `raw/media-generation-co-do-raw-0-8dd4dacb-8a46-45f5-870d-76ffb71db9cf.png` | Tự tạo — công ty sở hữu |
| Cờ trung lập | `curated/co-trung-lap-sheet.png` | Recolor bake từ cờ xanh (luminance desaturate, alpha giữ nguyên byte-identical), theo §3d của `docs/research-sprite-gen-2026-11-13.md`. Không vẽ lại. | Tự tạo (phái sinh từ cờ xanh) — công ty sở hữu |
| Còi trọng tài | `curated/coi-sheet.png` | Ảnh AI tự tạo, cắt nền bằng rembg 2.0.87 (u2net) + hole-fill 1 lỗ trong suốt giả ở mặt trên miệng còi (xem `qa-notes.md`). Raw: `raw/media-generation-coi-raw-0-e9306c7f-b12f-47ea-bcde-4c042b41a898.png` | Tự tạo — công ty sở hữu |

## File raw không dùng trực tiếp (giữ lại để đối chiếu)

- `raw/media-generation-co-trung-lap-raw-0-016247e0-c499-42f1-a3e0-e3eb565dbbc7.png`
  — ảnh AI cờ trung lập tạo riêng (nhân viên trước). **Không dùng:** cờ trung
  lập đã chốt bằng recolor bake từ cờ xanh để đồng nhất hình học tuyệt đối
  với cờ xanh (§3d). File này chỉ giữ làm dự phòng.
- `raw/co-trung-lap-derived.png` — bản desaturate của cờ xanh do nhân viên
  trước để lại. **Không dùng trực tiếp:** đã đối chiếu, khớp phương pháp bake
  (mean abs diff 0,26 so với luminance của raw cờ xanh); bản chốt được bake
  lại từ frame đã cắt (`frames/co-xanh.png`) để alpha đồng nhất.
- `raw/*.json` — metadata của công cụ tạo ảnh (snapshot id, media handle),
  giữ nguyên kèm ảnh raw.

## Vendor

- Không dùng asset vendor cho game này. Asset CC0 đã săn ở Đợt A ghi ở
  `shared/assets-vendor/SOURCES.md` (cấp platform, không phải cấp game).
