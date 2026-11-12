# TESTING — Đi Bar Online (di-bar-online, game 14/14)

Phòng bar online to, rộng: DJ đánh nhạc remix, khán giả vào làm dancer, quà là
đồ uống, bảng LED chạy chữ, camera lia khắp phòng, Vua sàn nhảy + đấu bàn VIP.

## Link live (sau khi Railway redeploy)

- Trang chính: https://live-game-platform-production.up.railway.app
- Overlay: https://live-game-platform-production.up.railway.app/o/di-bar-online/<TikTokID>
- Dashboard: https://live-game-platform-production.up.railway.app/room/di-bar-online/<TikTokID>
- Demo: mở overlay với `?demo=1` (tự chạy demo) hoặc bấm "▶ Chạy demo" ở dashboard.

## Luật đã build

- Vào bar: bình luận `vào bar` / `join` / `quẩy` → dancer với 1 trong 8 nhân
  vật gốc (random; bình luận số 1–8 để chọn/đổi nhân vật). Tối đa 24 dancer
  trên sàn; người vào sau đứng ở quầy bar chờ lượt (vẫn tính năng lượng).
- Nhảy: 1 tim (delta) = +1 năng lượng; 1 bình luận tính điểm (chống spam
  1/5s) = +5; quà 1 xu = +10 năng lượng + 1 ly đồ uống (xu thật; không rõ xu
  → 0 + log WARN, KHÔNG mặc định); follow +30 (1 lần/vòng).
- Vua sàn nhảy: vòng 3 phút (mặc định), dancer nhiều năng lượng nhất khi hết
  vòng → lên ngôi Vua (camera zoom, LED chạy tên to, đội vương miện, TTS
  xướng tên). Vinh danh 20s → vòng mới, năng lượng về 0.
- Đồ uống: quà ≥10 xu = cocktail; ≥50 xu = bottle service (pháo giấy +
  camera zoom người tặng + LED ghi tên); ≥100 xu = mở sâm panh (phun sâm
  panh cả sàn, đèn chớp, LED tên to 10s).
- DJ drop: mỗi 2 phút DJ "drop" (báo trước 10s): trong 15s drop, mọi tim
  tính ×2, đèn nhấp nháy nhanh, camera zoom vào DJ.
- Đấu bàn VIP: bình luận `bàn vàng` / `bàn đỏ` để chọn bàn. Điểm bàn = tổng
  năng lượng + số ly của các thành viên. Hết vòng, bàn nhiều điểm hơn thắng
  vòng (hiện trên LED). Thắng 2 vòng liên tiếp → bàn đó "bao cả bar" 1 phút
  (mọi dancer của bàn được ×2 năng lượng).
- 8 nhân vật gốc (CSS/emoji — không copy ai): DJ 🎧, Hip-hop 🧢, Dancer 💃,
  Robot 🤖, Punk 🤘, Dân văn phòng 👔, Cao bồi 🤠, Người ngoài hành tinh 👽.
- Camera: toàn bộ cảnh trong 1 container, camera = scale + translate với
  transition mượt 1.2s. Các shot: Toàn cảnh → DJ booth → Top dancer → Quầy
  bar → Lia ngang đám đông → Bảng LED. Đổi shot mỗi 6–10s (tự động), HOẶC
  theo sự kiện: quà ≥50 → zoom người tặng; drop → zoom DJ; hết vòng → zoom
  Vua sàn. Dashboard chỉnh: chế độ auto/thủ công, thời gian mỗi shot.
- Nhạc: vòng lặp remix tự tổng hợp bằng WebAudio (kick 4-on-floor 128 BPM,
  hat, bassline, synth stab), không file nhạc ngoài, không nhạc có bản quyền.
  Drop = kick dồn + stab cao hơn. Nút tắt/bật nhạc ở dashboard + overlay.
- 3 bảng LED: (1) chính trên DJ: chữ chạy (sự kiện mới nhất, tên Vua sàn);
  (2) menu ở quầy bar (tên đồ uống + giá xu); (3) bên: top 3 dancer + điểm
  2 bàn VIP. Cập nhật live từ state.
- TTS (proxy server `/api/tts` + cache, fallback speechSynthesis): xướng tên
  Vua sàn, "Mở sâm panh!", tên người tặng bottle. Hàng đợi TTS.

## Lưu ý test

- **Bật tiếng trên nguồn Link trong TikTok LIVE Studio mới nghe được nhạc
  remix + giọng đọc** (trình duyệt/Studio mặc định tắt tiếng nguồn Link).
- Nhạc WebAudio chỉ chạy sau khi người xem tương tác với trang (chính sách
  autoplay của trình duyệt) — trên overlay thật, bấm nút 🔊 1 lần nếu nhạc
  chưa lên.
- Comment chọn bàn (`bàn vàng`/`bàn đỏ`) vẫn gán bàn ngay cả khi bị chống
  spam chặn phần +5 năng lượng (bình luận trong 5s sau comment trước).
- Comment vào bar cũng là bình luận tính điểm (+5) như các game khác.
- Quà không rõ xu vẫn hiển thị hiệu ứng? Không — quà lạ = 0 điểm, 0 ly,
  chỉ log WARN (đúng luật cứng chung).

## Checklist test (cho Agent Windows / test live thật)

- [ ] Mở overlay `?demo=1`: 12 dancer demo quẩy, năng lượng tăng, LED chạy chữ, camera tự lia.
- [ ] Bình luận `vào bar` từ tài khoản thứ 2 → xuất hiện làm dancer với 1 trong 8 nhân vật.
- [ ] Tim → năng lượng tăng theo delta; bình luận → +5 (spam 5s bị chặn).
- [ ] Tặng quà 10 xu → +100 năng lượng + 1 ly cocktail; 50 xu → bottle + zoom; 100 xu → sâm panh cả sàn.
- [ ] Hết vòng 3 phút → Vua sàn được xướng tên, LED + camera zoom vào Vua.
- [ ] Drop: báo trước 10s → trong 15s drop tim ×2, đèn nhấp nháy, camera zoom DJ.
- [ ] 2 người chọn 2 bàn khác nhau, tap lệch nhau → bàn nhiều điểm thắng vòng; thắng 2 vòng liên tiếp → bao cả bar (×2).
- [ ] 25 người vào bar → 24 trên sàn, 1 chờ ở quầy.
- [ ] TTS đọc tên Vua + "Mở sâm panh!" (bật tiếng nguồn Link).
- [ ] Nhạc remix nghe được, không phải nhạc bản quyền (tự tổng hợp WebAudio).

## Test tự động

`node --test test/di-bar-online.test.js` — 10 test (xem file test).
