# TESTING — Vườn Hoa Mùa Xuân (vuon-hoa-mua-xuan)

Game chạy trong nền tảng live-game-platform (không còn server local cổng 3010).
Cơ chế lấy từ `~/workspace/overlay-moi/prompt-agent-vuon-hoa-mua-xuan.md`.

## Link live (sau khi Railway deploy main mới nhất)

- Overlay (dán vào TikTok LIVE Studio, nguồn Link / Browser Source 1080x1920):
  `https://live-game-platform-production.up.railway.app/o/vuon-hoa-mua-xuan/<tiktok-id>`
- Dashboard: `https://live-game-platform-production.up.railway.app/room/vuon-hoa-mua-xuan/<tiktok-id>`
- Hướng dẫn TikFinity: `https://live-game-platform-production.up.railway.app/huong-dan-tikfinity?game=vuon-hoa-mua-xuan&username=<tiktok-id>`

## Cách test live (Agent Windows test bằng tài khoản thứ 2)

1. Mở dashboard → bật **chế độ thử** → bấm "Test 100 người vào" (100 người
   vào xem), "Bình luận", "Thả 20 tim", "Quà 10/100/500 xu", "Follow" —
   kiểm tra vườn thay đổi đúng mô tả từng nút.
2. Tắt chế độ thử → **Làm mới phiên** → Go LIVE bằng tài khoản chính, dùng
   tài khoản thứ 2 vào live thật: bình luận → hạt gieo ngay; tim → hạt;
   follow → hoa hồng vàng ở nụ; quà 1 xu → tưới; quà 100 xu → mưa;
   quà 500 xu → cầu vồng (1 hoa nở ngay).
3. Kiểm chứng các mốc (cần kiểm tra bằng live thật, không tính demo):
   - [ ] Hạt tự nảy mầm sau ~10s không cần tương tác.
   - [ ] Sương xuân mỗi 60s: mọi hoa +1 tăng trưởng (nhìn hoa đổi giai đoạn).
   - [ ] Hoa nở 90s thì bay vào giỏ, luống được trả; hạt trong vườn ươm tự gieo vào.
   - [ ] Comment 2 lần trong 5s: lần 2 không gieo hạt (chống spam).
   - [ ] Quà không rõ xu (quà lạ TikFinity chưa gửi diamondCount): chỉ log
         cảnh báo đỏ, 0 điểm, không tưới — KHÔNG được cộng mặc định.
   - [ ] Tap tính theo delta: người đã tim 5000 lần từ trước khi room tạo
         thì đợt tim đầu tiên KHÔNG gieo ồ ạt (delta lần đầu = 0).
   - [ ] Avatar hiển thị là avatar TikTok thật; không có avatar thì hoa hiện
         tên không ảnh (không bịa avatar).
   - [ ] Đủ 100 hoa nở → lễ hội hoa 30s → kết quả 30s → ván mới (vườn trống,
         điểm về 0). Có thể hạ "Mốc vườn đầy" trong dashboard xuống 2 để test nhanh.
   - [ ] Giọng đọc tiếng Việt xướng tên khi hoa nở / lễ hội / cầu vồng
         (cần bật âm thanh trên nguồn Link trong Studio).
   - [ ] 2 room khác username không thấy event của nhau.
   - [ ] Overlay 1080x1920 không tràn chữ, tên hoa không che nhau khi vườn đầy 40 luống.

## Quyết định tự chốt khi build (khác bản thiết kế)

- **Quà lạ:** bản thiết kế nói "quà chưa có trong bảng → 0 điểm + log".
  Trên nền tảng không có bảng quà hardcode — số xu lấy thẳng từ payload
  webhook (diamondCount). Quà nào payload không gửi xu → 0 điểm + log WARN
  (đúng tinh thần "không bao giờ mặc định +5").
- **Tưới quà:** 1 xu = 1 tăng trưởng vào hoa non nhất của người tặng; nếu
  người tặng chưa có hoa thì tưới hoa non nhất của cả vườn.
- **Join:** chỉ tạo viewer, không gieo hạt (đúng bản thiết kế).
- **Giọng đọc:** overlay dùng proxy TTS của server (`/api/tts`, Google TTS
  tiếng Việt, có cache) với fallback giọng trình duyệt; không dùng
  Azure Neural (cần key).

## Chế độ demo (2026-11-13)
- Mở overlay với `?demo=1` (vd. `…/o/vuon-hoa-mua-xuan/<tiktok-id>?demo=1`) → tự
  bật chế độ thử + chạy demo: 3 người xem ảo (An, Bình, Chi…) vào vườn, bình
  luận/tim/quà/follow/share liên tục qua đúng đường event thật; huy hiệu `DEMO`
  hiện ở góc trái overlay. Hết ván tự sang ván mới, demo chạy tiếp tới khi dừng.
- Dashboard → mục Test: nút `▶ Chạy demo` / `■ Dừng demo` (+ `▶ Demo 1 lượt mẫu`
  chạy 1 lượt An/Bình như cũ). API: `POST /api/test/demo {action:"start"|"stop"|"once"}`.
- An toàn: demo từ chối bật khi phòng đã có event thật (`webhookCount > 0`);
  event thật đầu tiên tới thì demo tự dừng. Người xem demo không có avatar thật,
  không tính vào thống kê avatar.
