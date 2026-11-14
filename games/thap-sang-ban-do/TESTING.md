# TESTING — Thắp Sáng Bản Đồ Việt Nam (thap-sang-ban-do)

Game chạy trong nền tảng live-game-platform (không còn server local cổng 3009).
Engine là file GENERATED (`engine.mjs`) vendored từ bản gốc
`~/workspace/game-thap-sang-ban-do/server.js` — **TUYỆT ĐỐI KHÔNG chạy
`npm run build`** (xóa `src/` rồi vendor lại); mọi sửa engine phải áp cùng
thay đổi vào bản gốc.

## Link live (sau khi Railway deploy main mới nhất)

- Overlay (dán vào TikTok LIVE Studio, nguồn Link / Browser Source 1080x1920):
  `https://live-game-platform-production.up.railway.app/o/thap-sang-ban-do/<tiktok-id>`
- Dashboard: `https://live-game-platform-production.up.railway.app/room/thap-sang-ban-do/<tiktok-id>`
- Hướng dẫn TikFinity: `https://live-game-platform-production.up.railway.app/huong-dan-tikfinity?game=thap-sang-ban-do&username=<tiktok-id>`

## Chế độ demo (demo-mode-contract.md)

Demo tái dùng vòng lặp giả lập có sẵn của game (`simStep` mỗi 1.2s: comment tên
tỉnh / tim / quà / follow / vào phòng, tên + tỉnh tiếng Việt) — không viết
simulator mới.

- Xem demo: mở overlay với `?demo=1`
  (`.../o/thap-sang-ban-do/<tiktok-id>?demo=1`) — tự chạy demo khi mở link,
  chỉ khi phòng chưa có event thật. Huy hiệu `🧪 DEMO — đang mô phỏng khán giả`
  hiện ở góc phải trên overlay.
- Dashboard: nút `▶ Chạy demo` / `■ Dừng demo` (cạnh checkbox "Giả lập người
  xem" — checkbox cũ vẫn dùng được, đồng bộ với demoActive).
- API: `POST /api/test/demo` với `{action:"start"|"stop"|"once"}`; state có
  thêm `demoActive: true|false` (kèm `simulator` có sẵn).
- An toàn: start bị từ chối khi phòng đã có event thật
  (`{success:false, message:'Phòng đang có event thật...'}`); event thật đầu
  tiên tới (webhook) thì demo tự dừng + tắt simulator, live thật tiếp quản.
  Dừng demo → vòng lặp dừng, state đứng yên; hết ván demo tự chạy ván mới.
- Người xem mô phỏng KHÔNG có avatar TikTok thật (chỉ tên + chữ cái đầu) —
  tuyệt đối không bịa avatar.

## Cách test live (Agent Windows test bằng tài khoản thứ 2)

- [ ] Mở overlay `?demo=1`: trong ~1 phút đầu phải thấy tỉnh sáng dần, tên
      người xem xuất hiện, huy hiệu DEMO hiện.
- [ ] Dashboard → `■ Dừng demo`: bản đồ đứng yên, huy hiệu DEMO biến mất.
- [ ] Go LIVE thật + Connect TikFinity rồi comment tên tỉnh: demo (nếu đang
      chạy) tự dừng, tỉnh thắp theo comment thật.
- [ ] Hoàng Sa sáng cùng Đà Nẵng, Trường Sa sáng cùng Khánh Hòa.
- [ ] Comment số (1–34) không thắp gì; chỉ comment tên tỉnh mới tính.
- [ ] Avatar neo ở quê tới hết ván dù người chơi đã rời live.
- [ ] 2 room khác username không thấy event của nhau.

## TikFinity — cơ chế 1 Action duy nhất (không body)
- Chỉ cần 1 Action webhook duy nhất với URL gốc của phòng `.../api/webhook` (không thêm `?event=`) — mọi Event đều trỏ vào Action đó (xem bài hướng dẫn `/huong-dan-tikfinity?game=thap-sang-ban-do`). Action chỉ có ô URL, không nhập body. Đường dự phòng: 6 URL `.../api/webhook?event=gift|chat|like|follow|share|join` (chỉ dùng khi TikFinity không gửi trường event trong body).
- Engine đọc form TikFinity (`value1`/`value2`/`value3`/`content`/`avatar_url`) + loại sự kiện từ trường `event` trong body (dự phòng: `?event=` trên URL). Share không cộng điểm (chỉ ghi nhận loại sự kiện).
