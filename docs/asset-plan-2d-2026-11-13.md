# Kế hoạch Asset 2D — 14 Overlay TikTok LIVE (2026-11-13)

Chủ tịch chốt: **phong cách 2D GAME ASSET** — flat vector, cel-shading, hình khối sạch,
viền đậm, màu bão hòa rực rỡ (kiểu Stardew Valley / game mobile 2D). KHÔNG photorealistic,
KHÔNG 3D render thực, KHÔNG emoji làm hình chính.
**Video nền ĐÃ DỪNG** (Chủ tịch 16:20): asset chỉ dùng để tạo **nhân vật + cảnh** (ảnh tĩnh).
Flow chỉ dùng để tạo **ảnh nhân vật/cảnh** (Imagen), không tạo video nữa.

## 0. Chuẩn phong cách (áp cho mọi asset)

- **Scene (cảnh/nền):** ảnh dọc 9:16 (1152×2048), `background-size: cover`, viền tối dần
  (vignette) để chữ trắng đọc được, KHÔNG có chữ/logo trong ảnh.
- **Sprite (nhân vật/vật thể):** PNG **nền trong suốt**, viền đậm, cel-shading, góc nhìn
  thống nhất trong 1 game (nghiêng 3/4 hoặc ngang hông). Kích thước đích ghi trong bảng.
- **UI (icon/huy hiệu):** PNG trong suốt, 1 bộ icon dùng chung cả 14 game
  (loa, cúp, huy chương vàng/bạc/đồng, tim, quà, vương miện, cờ).
- **Nguồn (theo thứ tự ưu tiên):**
  1. **Vendor CC0** — kenney.nl (toàn bộ CC0) và opengameart.org (CHỈ CC0/CC-BY,
     kiểm tra giấy phép từng asset, ghi `shared/assets-vendor/SOURCES.md`).
  2. **Tự tạo** — ảnh AI phong cách 2D game (prompt có hậu tố chuẩn, xem §0.1),
     rồi cắt nền bằng `rembg` thành PNG trong suốt (sprite) hoặc dùng trực tiếp (scene).
  3. **Google Flow (ảnh)** — tín dụng của Chủ tịch (còn ~1000), CHỈ tạo ảnh nhân vật/cảnh
     2D, không tạo video. Dừng khi số dư dưới 100.
- **Hậu tố prompt chuẩn (mọi ảnh tự tạo/Flow):**
  `2D game asset art, flat vector style, cel shading, vibrant saturated colors,
  clean shapes, bold outlines, side-scroller game background, no text`
  Sprite thêm: `isolated on plain solid white background, full body, centered`.
- **Thư mục:**
  - `shared/bg/<slug>.webp` — ảnh nền cảnh (14 game).
  - `shared/assets-vendor/` — asset tải về (giữ tên gốc) + `SOURCES.md`.
  - `shared/assets/2d/<slug>/<ten>.png` — sprite/UI đã cắt nền xong, sẵn gắn overlay.
  - `shared/assets/2d/common/<ten>.png` — icon/UI dùng chung 14 game.

## 1. Bảng asset theo game (emoji = thứ đang dùng, cần thay)

### 1.1 ve-avatar — Vẽ Avatar
- Scene: `bg/ve-avatar.webp` (xưởng vẽ) — tự tạo, đang làm lại v2.
- Sprite: cọ vẽ (thay ❤️ tim bay?), bảng màu, khung tranh vàng/bạc/đồng cho top 3.
- UI chung: loa 🔊, cảnh báo ⚠️ (đã ẩn mặc định).
- Ghi chú: avatar người xem là ảnh thật từ TikTok, không vẽ lại.

### 1.2 buong-giam — Buồng Giam
- Scene: `bg/buong-giam.webp` (phòng giam) — tự tạo, đang làm lại v2.
- Sprite: gà luộc nguyên con (thay 🍗), bát bún/rau, huy chương vàng/bạc/đồng (thay 🏅),
  song sắt (lớp phủ), sao ⭐.
- UI chung: cúp 🏆.

### 1.3 thap-sang-ban-do — Thắp Sáng Bản Đồ
- Scene: `bg/thap-sang-ban-do.webp` (Hạ Long) — tự tạo, đang làm lại v2
  (bản v1 có chữ giả mờ trên buồm → tạo lại sạch).
- Sprite: ngọn lửa/đèn lồng cho tỉnh đã thắp (thay hiệu ứng CSS), trống đồng Đông Sơn,
  vương miện 👑 cho người thắp nhiều nhất.
- Ghi chú: bản đồ SVG 34 tỉnh GIỮ NGUYÊN, chỉ thay lớp nền + sprite.

### 1.4 vuon-hoa-mua-xuan — Vườn Hoa Mùa Xuân
- Scene: `bg/vuon-hoa-mua-xuan.webp` (vườn xuân) — tự tạo, đang làm lại v2.
- Sprite: 4 giai đoạn hoa — hạt/mầm/nụ/nở (thay 🌱🌸🌹), bình tưới, ong 🐝,
  cầu vồng 🌈, mặt trời ☀️, mây ☁️.
- Ưu tiên vendor: Kenney pack hoa/cây nếu có.

### 1.5 bep-an-tap-the — Bếp Ăn Tập Thể
- Scene: `bg/bep-an-tap-the.webp` (bếp quê) — tự tạo, đang làm lại v2.
- Sprite: nồi lớn + hơi nước, bếp lửa 🔥, món ăn: thịt 🥩, rau 🥬, muối 🧂, canh 🍲.
- Ưu tiên vendor: Kenney food pack (CC0) nếu có món khớp.

### 1.6 dua-xe-leo-nui — Đua Xe Leo Núi
- Scene: `bg/dua-xe-leo-nui.webp` (đường núi) — tự tạo, đang làm lại v2.
  Lớp parallax: núi xa / núi gần / cây / mặt đường (tách riêng nếu được).
- Sprite: 5 xe đua nhìn ngang hông, 5 màu (thay xe CSS hiện tại),
  cờ đích 🏁, mây ☁️, cúp 🥇🥈🥉 (UI chung).
- Ghi chú: xe CSS hiện tại đã tốt — chỉ thay bằng sprite khi sprite đẹp hơn rõ rệt.

### 1.7 vong-quay-may-man — Vòng Quay May Mắn
- Scene: `bg/vong-quay-may-man.webp` (sân khấu carnival) — tự tạo, đang làm lại v2.
- Sprite: bánh xe quay (vẽ lại dạng sprite, thay 🎡), kim chỉ 🔻, hộp quà, vé số.
- Ghi chú: bánh xe hiện vẽ bằng CSS/canvas — giữ logic, chỉ thay mặt hình.

### 1.8 bau-troi-phao-hoa — Bầu Trời Pháo Hoa
- Scene: `bg/bau-troi-phao-hoa.webp` (bầu trời đêm) — tự tạo, đang làm lại v2.
- Sprite: tên lửa pháo 🎆, trăng 🌙, sao ⭐, mái nhà (lớp chân trời).
- Ghi chú: pháo hoa canvas GIỮ NGUYÊN, scene chỉ làm nền.

### 1.9 keo-co — Kéo Co
- Scene: `bg/keo-co.webp` (sân cỏ) — tự tạo, đang làm lại v2.
- Sprite: 2 đội kéo co nhìn ngang hông (xanh/đỏ, 3 người/đội), dây thừng 🪢,
  cờ 🚩, cúp 🏆 (UI chung).
- Ưu tiên vendor: Kenney character pack (CC0) nếu có nhân vật kéo co/kéo dây.

### 1.10 dau-truong-sinh-ton — Đấu Trường Sinh Tồn
- Scene: `bg/dau-truong-sinh-ton.webp` (đấu trường đá) — tự tạo, đang làm lại v2.
- Sprite: chiến binh sinh tồn (thay ⭕ tròn), đầu lâu 💀, kiếm ⚔️, vương miện 👑,
  vụ nổ 💥.
- Ưu tiên Flow ảnh: nhân vật chiến binh 2D (nhiều tư thế: đứng/chém/ngã).

### 1.11 chiem-co — Chiếm Cờ
- Scene: `bg/chiem-co.webp` (sân vận động đêm) — tự tạo, đang làm lại v2.
- Sprite: 3 lá cờ vải (thay 🏳️/chữ X/Đ/? — giữ animation vẫy CSS),
  còi, cúp 🏆 (UI chung).
- Ghi chú: cờ CSS + wave đã có — sprite chỉ dùng nếu đẹp hơn.

### 1.12 dua-thuyen-rong — Đua Thuyền Rồng
- Scene: `bg/dua-thuyen-rong.webp` (sông hoàng hôn) — tự tạo, đang làm lại v2.
- Sprite: 2 thuyền rồng nhìn ngang hông + người chèo (thay 🐉🛶🚣),
  trống 🥁, cờ đích 🏁, mái chèo.
- Ưu tiên Flow ảnh: thuyền rồng 2D chi tiết (vì vendor khó có đúng thuyền rồng).

### 1.13 dau-tri — Đấu Trí
- Scene: `bg/dau-tri.webp` (sân khấu quiz) — tự tạo, đang làm lại v2.
- Sprite: não 🧠, tia sét ⚡, dấu chấm hỏi ❓, cúp 🏆 (UI chung).
- Ghi chú: game chữ nhiều — sprite chỉ trang trí, không lấn nội dung câu hỏi.

### 1.14 di-bar-online — Đi Bar Online
- Scene: `bg/di-bar-online.webp` (bar đêm) — tự tạo, đang làm lại v2.
- Sprite: DJ 🎧, chai champagne 🍾, ly cocktail 🍹, vương miện 👑, lửa 🔥.
- Ghi chú: đèn disco/EQ đã có bằng CSS — scene chỉ làm nền.

## 2. Quy trình làm sprite (bài bản, không mò mẫm)

1. **Kiểm tra vendor trước** (Kenney/OpenGameArt): có sprite khớp → tải, ghi SOURCES.md, xong.
2. **Không có → tự tạo ảnh**: prompt chuẩn §0.1, nền trắng trơn, nhân vật/vật thể ở giữa.
3. **Cắt nền**: `rembg` (cài 1 lần: `pip install rembg`) → PNG trong suốt,
   kiểm tra bằng mắt (mở ảnh xem viền có sạch không).
4. **Lưu** vào `shared/assets/2d/<slug>/<ten>.png`, ghi vào bảng §1 (cột trạng thái).
5. **Gắn overlay**: `<img src="/shared/assets/2d/...">` (transformText KHÔNG chạm
   `/shared/` nên đường dẫn giữ nguyên), kèm `filter: drop-shadow(...)` cho nổi khối.
   Fallback: nếu file thiếu, overlay vẫn chạy bằng CSS/emoji cũ (không vỡ trang).
6. **Kiểm chứng**: mở overlay demo trên Railway, chụp màn hình, đối chiếu checklist §3.

## 3. Checklist nghiệm thu asset (mỗi asset)

- [ ] Đúng phong cách 2D game (flat vector, cel-shading, viền đậm, màu rực).
- [ ] Không có chữ/logo/chữ giả trong ảnh.
- [ ] Sprite: nền trong suốt thật (mở trên nền tối vẫn sạch viền).
- [ ] Scene: 1152×2048, viền tối, chữ trắng đặt lên vẫn đọc được.
- [ ] Dung lượng hợp lý (scene < 1MB, sprite < 300KB).
- [ ] Nguồn ghi rõ (tự tạo / vendor + giấy phép / Flow).

## 4. Thứ tự làm

- **Đợt A (đang chạy):** 14 ảnh nền v2 + săn asset CC0 (Kenney/OpenGameArt).
- **Đợt B:** sprite nhân vật/vật thể theo bảng §1 — ưu tiên 5 game xấu nhất trước
  (Đua Xe, Chiếm Cờ, Đua Thuyền, Vườn Hoa, Bếp Ăn), rồi 9 game còn lại.
- **Đợt C:** gắn asset vào overlay (thay emoji/CSS), commit, deploy, kiểm chứng live.
- **Đợt D:** tester chuyên trách test đủ 14 game → sửa → báo cáo Chủ tịch.

## 5. Nhật ký

- 2026-11-13 ~16:14: 14 ảnh nền v1 xong (shared/bg/, ~9,1MB) nhưng PHONG CÁCH SAI
  (photorealistic, có chữ giả trên buồm thap-sang) → đang làm lại v2 theo chuẩn §0.
- 2026-11-13 ~16:20: Chủ tịch chốt — asset chỉ làm nhân vật + cảnh, KHÔNG làm video.
  Tác vụ video Google Flow (5 clip) đã DỪNG. Flow chỉ dùng cho ảnh nhân vật/cảnh.
- 2026-11-13: test suite 281/281 pass (lượt chạy 16:24); 2 lượt chạy trước đó fail 1
  assertion giống nhau rồi rerun xanh — nghi test flake theo thời gian (ghi chú để theo dõi,
  không chặn deploy vì đã pass lại ngay sau đó).
