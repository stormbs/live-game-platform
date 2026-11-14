# TESTING — Kéo Co (keo-co)

Game chạy trong nền tảng live-game-platform (không còn server local).
Cơ chế lấy từ `~/workspace/overlay-moi/prompt-agent-keo-co.md`.

## Link live (sau khi Railway deploy main mới nhất)

- Overlay (dán vào TikTok LIVE Studio, nguồn Link / Browser Source 1080x1920):
  `https://live-game-platform-production.up.railway.app/o/keo-co/<tiktok-id>`
- Dashboard: `https://live-game-platform-production.up.railway.app/room/keo-co/<tiktok-id>`
- Hướng dẫn TikFinity: `https://live-game-platform-production.up.railway.app/huong-dan-tikfinity?game=keo-co&username=<tiktok-id>`

## Cài đặt TikFinity (cơ chế thật — xác minh từ log live thật 2026-11-13)

⚠️ Action "Trigger WebHook" của TikFinity **chỉ có ô URL, KHÔNG có ô body**
— TikFinity tự gửi body dạng form cố định
(`value1=<tên tài khoản>&value2=<nội dung chính / tên quà>&value3=<số xu>&content=<bình luận>&avatar_url=<avatar>`).
**KHÔNG CÓ BODY — không nhập body ở đâu cả.** TikFinity gửi KÈM loại sự kiện
trong body (trường `event`) nên **chỉ cần 1 Action duy nhất** với URL gốc của
phòng (`<webhook>`, không thêm `?event=`); mọi Event đều trỏ vào Action đó.

**Bước 1 — Tạo 1 Action webhook duy nhất** (URL lấy từ nút "Sao chép URL" trong mục
"🎯 Cài đặt TikFinity" ở dashboard; `<webhook>` = link webhook của phòng):
tên Action theo mẫu "Keo Co", loại Webhook, Method POST, URL = `<webhook>`.

**Bước 2 — Tạo 6 Event** (mỗi event đều chọn Action duy nhất vừa tạo ở "Trigger all of these actions"):

| Loại trigger trong TikFinity (Event) | Action chọn |
|---|---|
| Sending a gift with min. coins value (min coins = 1) | `Keo Co` |
| Chat (any comment) | `Keo Co` |
| Sending likes (taps) | `Keo Co` |
| Follow | `Keo Co` |
| Share | `Keo Co` |
| Join | `Keo Co` |

**Dự phòng — Tách riêng từng sự kiện** (chỉ dùng khi TikFinity không gửi trường event trong body): 6 URL `<webhook>?event=gift|chat|like|follow|share|join` + 6 tên Action `Keo Co - Qua`, `Keo Co - Binh luan`, `Keo Co - Tim`, `Keo Co - Follow`, `Keo Co - Share`, `Keo Co - Vao phong` (dữ liệu lấy từ endpoint `/api/tikfinity-actions`).

**Go LIVE trước rồi mới Connect TikFinity.**

## Cách test live (Agent Windows test bằng tài khoản thứ 2)

1. Mở dashboard → bật **chế độ thử** → bấm "Bình luận xanh/đỏ", "Thả 20 tim",
   "Quà 10 xu", "Follow", "Chia sẻ" — kiểm tra lực 2 đội + cờ di chuyển đúng
   mô tả từng nút. Bấm "▶️ Chạy demo tự động" — 12 người demo kéo 2 đội,
   lực tăng dần, cờ lệch dần; bấm "■ Dừng demo" thì dừng hẳn.
2. Mở overlay với `?demo=1` (vd. `.../o/keo-co/<id>?demo=1`) — demo tự chạy,
   có huy hiệu 🧪 DEMO. Nếu phòng đã có event thật thì overlay báo "không
   chạy demo được".
3. Tắt chế độ thử → **Làm mới phiên** → Go LIVE bằng tài khoản chính, dùng
   tài khoản thứ 2 vào live thật: bình luận "xanh"/"đỏ" → vào đội ngay;
   tim → lực đội tăng; quà 10 xu → +100 lực; follow → +20.
4. Kiểm chứng các mốc (cần kiểm tra bằng live thật, không tính demo):
   - [ ] Hiệp tự bắt đầu khi cả 2 đội đều có người (không cần bấm nút).
   - [ ] Cờ chạm vạch đích 1 bên → đội đó thắng hiệp ngay, tỉ số cập nhật.
   - [ ] Hết 3 phút, đội đang dẫn lực thắng hiệp; hòa lực thì không đội nào thắng hiệp.
   - [ ] Thắng 3 hiệp → thắng trận, vinh danh 20s → trận mới (đội giữ nguyên, lực về 0).
   - [ ] Đang trong hiệp, bình luận đổi đội không có tác dụng (chỉ đổi được giữa các hiệp).
   - [ ] Bình luận "đồ đẹp quá" KHÔNG làm người đó vào đội Đỏ (chỉ "đỏ"/"do"/"2" mới vào).
   - [ ] Comment 2 lần trong 5s: lần 2 không cộng lực (chống spam).
   - [ ] Quà không rõ xu (quà lạ TikFinity chưa gửi diamondCount): chỉ log cảnh báo, 0 lực — KHÔNG được cộng mặc định.
   - [ ] Tap tính theo delta: người đã tim 5000 lần từ trước khi room tạo thì đợt tim đầu tiên KHÔNG cộng ồ ạt (delta lần đầu = 0).
   - [ ] Tối đa 24 người kéo dây mỗi bên — người thứ 25 chờ ở khán đài, vẫn tính lực.
   - [ ] Giọng đọc: thắng hiệp/trận đọc tên đội thắng; cờ sắp chạm đích đọc "Kéo mạnh lên!".
   - [ ] Avatar người chơi là ảnh TikTok thật; không có URL ảnh thì hiện chữ cái đầu, không bịa avatar.
   - [ ] Event thật đầu tiên tới khi demo đang chạy → demo tự dừng, chuyển sang TRỰC TIẾP.

## Test tự động

`test/keo-co.test.js` — 12 test: 2 đội + tap đúng đội + hết hiệp đội mạnh
thắng; quà 10 xu = +100 lực; quà lạ = 0 + WARN; tap delta baseline; chống
spam + hòa lực; cờ chạm đích + thắng trận + trận mới; đổi đội giữa hiệp bị
chặn + "đồ" không nhầm "đỏ"; follow/share 1 lần/hiệp; demo start/stop +
tăng lực; demo từ chối khi đã có event thật; test 1 lượt + bulk-join 100;
`/api/tikfinity-actions` trả đủ 6 URL dự phòng `?event=` (không body);
settings clamp + room isolation.
