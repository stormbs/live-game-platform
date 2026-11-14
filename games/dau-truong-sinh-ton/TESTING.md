# TESTING — Đấu Trường Sinh Tồn (dau-truong-sinh-ton)

Game chạy trong nền tảng live-game-platform (không còn server local).
Cơ chế lấy từ `~/workspace/overlay-moi/prompt-agent-dau-truong-sinh-ton.md`.

## Link live (sau khi Railway deploy main mới nhất)

- Overlay (dán vào TikTok LIVE Studio, nguồn Link / Browser Source 1080x1920):
  `https://live-game-platform-production.up.railway.app/o/dau-truong-sinh-ton/<tiktok-id>`
- Dashboard: `https://live-game-platform-production.up.railway.app/room/dau-truong-sinh-ton/<tiktok-id>`
- Hướng dẫn TikFinity: `https://live-game-platform-production.up.railway.app/huong-dan-tikfinity?game=dau-truong-sinh-ton&username=<tiktok-id>`

## Cài đặt TikFinity (cơ chế thật — xác minh từ log live thật 2026-11-13)

⚠️ Action "Trigger WebHook" của TikFinity **chỉ có ô URL, KHÔNG có ô body**
— TikFinity tự gửi body dạng form cố định
(`value1=<tên tài khoản>&value2=<nội dung/tên quà>&value3=<số xu>&content=<bình luận>&avatar_url=<avatar>`).
**KHÔNG CÓ BODY — không nhập body ở đâu cả.** TikFinity gửi KÈM loại sự kiện
trong body (trường `event`) nên **chỉ cần 1 Action duy nhất** với URL gốc của
phòng (`<webhook>`, không thêm `?event=`); mọi Event đều trỏ vào Action đó.

**Bước 1 — Tạo 1 Action webhook duy nhất** (URL lấy từ nút "Sao chép URL" trong mục
"🎯 Cài đặt TikFinity" ở dashboard; `<webhook>` = link webhook của phòng):
tên Action theo mẫu "Dau Truong Sinh Ton", loại Webhook, Method POST, URL = `<webhook>`.

**Bước 2 — Tạo 6 Event** (mỗi event đều chọn Action duy nhất vừa tạo ở "Trigger all of these actions"):

| Loại trigger trong TikFinity (Event) | Action chọn |
|---|---|
| Sending a gift with min. coins value (min coins = 1) | `Dau Truong Sinh Ton` |
| Chat (any comment) | `Dau Truong Sinh Ton` |
| Sending likes (taps) | `Dau Truong Sinh Ton` |
| Follow | `Dau Truong Sinh Ton` |
| Share | `Dau Truong Sinh Ton` |
| Join | `Dau Truong Sinh Ton` |

**Dự phòng — Tách riêng từng sự kiện** (chỉ dùng khi TikFinity không gửi trường event trong body): 6 URL `<webhook>?event=gift|chat|like|follow|share|join` + 6 tên Action `Dau Truong Sinh Ton - Qua`, `Dau Truong Sinh Ton - Binh luan`, `Dau Truong Sinh Ton - Tim`, `Dau Truong Sinh Ton - Follow`, `Dau Truong Sinh Ton - Share`, `Dau Truong Sinh Ton - Vao phong` (dữ liệu lấy từ endpoint `/api/tikfinity-actions`).

**Go LIVE trước rồi mới Connect TikFinity.**

## Cách test live (Agent Windows test bằng tài khoản thứ 2)

1. Mở dashboard → bật **chế độ thử** → bấm "Tham gia" (2 người), "Thả 5 tim",
   "Đánh tên ngẫu nhiên", "Quà 10 xu", "Quà 100 xu", "Follow" — kiểm tra HP
   các chiến binh thay đổi đúng mô tả từng nút. Bấm "▶️ Chạy demo tự động" —
   12 chiến binh demo đánh nhau, HP giảm dần, có người gục; bấm "■ Dừng demo"
   thì dừng hẳn.
2. Mở overlay với `?demo=1` — demo tự chạy, có huy hiệu 🧪 DEMO. Nếu phòng đã
   có event thật thì overlay báo "không chạy demo được".
3. Tắt chế độ thử → **Làm mới phiên** → Go LIVE bằng tài khoản chính, dùng
   tài khoản thứ 2 vào live thật: bình luận "tham gia" → chiến binh xuất hiện
   với 100 HP; tim → địch ngẫu nhiên mất HP; bình luận tên địch → địch −3 HP.
4. Kiểm chứng các mốc (cần kiểm tra bằng live thật, không tính demo):
   - [ ] Trận tự bắt đầu khi đủ 2 chiến binh (không cần bấm nút).
   - [ ] Vũ khí ngẫu nhiên kiếm/cung/búa, chỉ khác hình, không khác sức mạnh.
   - [ ] Quà 10 xu = +10 sát thương cho đòn tiếp theo (chỉ 1 đòn, rồi về 0).
   - [ ] Quà ≥100 xu hồi +20 HP (tối đa 100); follow +10 HP 1 lần/trận.
   - [ ] HP về 0 → gục, tên vào bảng "Đã gục", 10s sau biến mất khỏi sân.
   - [ ] Người gục bình luận "tham gia" trong trận đang chạy → KHÔNG hồi sinh, phải chờ trận sau.
   - [ ] Tối đa 24 người trên sân — người thứ 25 xếp hàng chờ, vào thay khi có người gục.
   - [ ] Vòng bo sau 3 phút: mỗi 10s mọi chiến binh −1 HP, vòng tròn đỏ thu hẹp thấy được.
   - [ ] Hết 10 phút còn >1 người → người nhiều HP nhất thắng.
   - [ ] Còn đúng 1 người → spotlight 30s (vương miện + tên to + TTS xướng tên) → trận mới, mọi người phải "tham gia" lại.
   - [ ] Comment 2 lần trong 5s: lần 2 không trừ HP (chống spam).
   - [ ] Quà không rõ xu: chỉ log cảnh báo, 0 sát thương — KHÔNG cộng mặc định.
   - [ ] Tap tính theo delta: người đã tim 5000 lần từ trước thì đợt tim đầu tiên KHÔNG đánh ồ ạt.
   - [ ] Giọng đọc: "X đã gục!", xướng tên người thắng trận.
   - [ ] Nhân vật vẽ sẵn theo vũ khí (không dùng avatar TikTok); không bịa avatar.
   - [ ] Event thật đầu tiên tới khi demo đang chạy → demo tự dừng, chuyển sang TRỰC TIẾP.

## Test tự động

`test/dau-truong-sinh-ton.test.js` — 11 test: join 100 HP + tap địch ngẫu
nhiên + comment tên −3; quà 10 xu +10 dmg dồn (dùng 1 đòn) + quà lạ 0 + WARN;
quà 100 xu hồi 20 HP + follow 1 lần/trận; gục 0 HP + thắng + trận mới; vòng bo
trừ HP đều; chống spam + tap baseline; tối đa 24 + hàng chờ + vào thay; demo
start/stop + tăng đòn đánh; demo từ chối khi đã có event thật; test 1 lượt +
overlay/dashboard/guide/tikfinity-actions; settings clamp + room isolation.
