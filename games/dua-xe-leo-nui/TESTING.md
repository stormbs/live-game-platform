# TESTING — Đua Xe Leo Núi

## Link live (sau khi Railway deploy)

- Overlay: `https://live-game-platform-production.up.railway.app/o/dua-xe-leo-nui/<tiktok-id>/overlay.html`
- Dashboard: `https://live-game-platform-production.up.railway.app/o/dua-xe-leo-nui/<tiktok-id>/dashboard`
- Hướng dẫn TikFinity: `https://live-game-platform-production.up.railway.app/huong-dan-tikfinity?game=dua-xe-leo-nui&username=<tiktok-id>`

## Chuẩn bị

1. Mở dashboard → **bật "Chế độ thử (demoMode)"** để test giả lập; **TẮT trước khi live thật**.
2. Trong TikFinity, tạo 1 Action Webhook POST riêng cho phòng này (xem trang hướng dẫn — KHÔNG dùng chung link với phòng/game khác). Go LIVE trước rồi mới Connect.

## Mốc cần kiểm chứng trên live thật

- [ ] Bình luận → xe streamer +10m ngay (nhích liên tục, không đợi đủ ngưỡng). Bình luận 2 lần trong 5s → lần 2 bị chặn (log "chống spam").
- [ ] Thả tim → xe streamer +0,5m/tim (theo delta likeCount tích lũy).
- [ ] Quà 10 xu của người ngoài top 3 → xe streamer +10m, đồng thời tích 10đ quà cho người đó. Quà tiếp theo đủ điểm vào top 3 → xe riêng của họ xuất hiện (chạy từ vạch xuất phát lên đúng vị trí), có banner + giọng đọc tên.
- [ ] Top 3 đổi hạng: màu xe đổi theo hạng (hạng 1 🔵 xanh, hạng 2 🔴 đỏ, hạng 3 🟣 tím), vị trí mét giữ nguyên. Người rớt khỏi top 3: xe biến mất nhưng điểm quà giữ nguyên — tặng tiếp thì xe quay lại đúng vị trí.
- [ ] Quà lạ (không rõ số xu trong TikFinity) → KHÔNG cộng điểm, chỉ ghi log đỏ "không rõ số xu".
- [ ] Follow → xe streamer +5m, chỉ 1 lần/người/ván (follow lần 2 không cộng).
- [ ] Xe chạm 1000m → thắng NGAY: cờ + banner "VỀ ĐÍCH ĐẦU TIÊN" + giọng đọc + bảng vinh danh 30s → ván mới (#2, mọi xe về 0m).
- [ ] Hết 10 phút chưa ai tới đỉnh → xe cao nhất thắng. Hòa mét → ai đạt mức đó TRƯỚC thắng.
- [ ] Xe vượt mốc 500m / 750m / 900m → log + giọng đọc tên. Còn 60s cuối → cảnh báo + giọng đọc.
- [ ] Overlay dọc 1080x1920: bảng xếp hạng 4 hàng, dốc núi với 4 xe trượt mượt (không nhảy cóc), cờ đích trên đỉnh, đồng hồ đếm ngược, ticker.
- [ ] Dashboard: đổi độ dài đường đua / thời gian ván / mức đẩy → áp dụng ngay. Nút "Ván mới ngay", "Ép hết giờ", "Đồng hồ còn 60s" hoạt động.
- [ ] Avatar trên xe là avatar TikTok thật; nếu không có thì hiện chữ cái đầu + ghi chú trong dashboard (avatarStats).

## Quyết định đã tự chốt (khác/khuyết trong bản thiết kế)

- **Demo bước 4 của bản thiết kế sai luật**: Bình gift 5 xu khi chưa ai có điểm quà — theo đúng luật "top 3 người tặng quà nhiều nhất" thì Bình VÀO top 3 hạng 1 (xe của mình 5m), không phải "ngoài top 3 → xe streamer +5m". Engine làm theo luật, không theo bước demo sai đó. Xe streamer trong demo = 150m (30 cmt + 20 tap + 100 cmt), không phải 155m.
- **Quà**: không có bảng quà hardcode — số xu lấy thẳng từ payload webhook (`diamondCount`); payload không gửi xu → 0 điểm + log cảnh báo (đúng tinh thần "không bao giờ mặc định +5").
- **Xe chạy mượt**: phía overlay dùng CSS transition trên vị trí (trượt theo %), server chỉ giữ vị trí đích (mét). Xe mới vào top 3 trượt từ vạch xuất phát lên đúng vị trí nhờ transition; xe rớt top 3 biến mất (điểm quà giữ nguyên).
- **Luật hòa**: mỗi xe ghi timestamp lần đầu đạt mức mét nguyên mới (`bestAt`); hết giờ mà bằng mét thì xe có `bestAt` sớm hơn thắng.
- **Trong lúc bảng vinh danh (30s)**: bình luận/tap/quà/follow chỉ ghi log, không tính điểm ván đã kết thúc; join vẫn nhận.
- **Số xe tay đua (topN) chỉnh được 1–5** (mặc định 3); màu theo hạng: 🔵🔴🟣🟢🟠.

## Chế độ demo (2026-11-13)
- Mở overlay với `?demo=1` → tự bật chế độ thử + chạy demo: 3 người xem ảo vào
  đường đua, bình luận/tim đẩy xe streamer, tặng quà chạy xe Top 3, follow/share
  liên tục qua đúng đường event thật; huy hiệu `DEMO` ở góc trái overlay.
  Hết ván (về đích/hết giờ) tự sang ván mới, demo chạy tiếp tới khi dừng.
- Dashboard → mục Test: `▶ Chạy demo` / `■ Dừng demo` (+ `🎬 Demo 10 bước` 1 lượt mẫu).
  API: `POST /api/test/demo {action:"start"|"stop"|"once"}`.
- An toàn: từ chối bật khi phòng đã có event thật; event thật đầu tiên tới thì
  demo tự dừng. Người xem demo không tính vào thống kê avatar.
