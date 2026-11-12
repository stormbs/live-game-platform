# TESTING — Bầu Trời Pháo Hoa

## Link live (sau khi Railway deploy)

- Overlay: `https://live-game-platform-production.up.railway.app/o/bau-troi-phao-hoa/<tiktok-id>/overlay.html`
- Dashboard: `https://live-game-platform-production.up.railway.app/o/bau-troi-phao-hoa/<tiktok-id>/dashboard`
- Hướng dẫn TikFinity: `https://live-game-platform-production.up.railway.app/huong-dan-tikfinity?game=bau-troi-phao-hoa&username=<tiktok-id>`

## Chuẩn bị

1. Mở dashboard → **bật "Chế độ thử (demoMode)"** để test giả lập; **TẮT trước khi live thật**.
2. Trong TikFinity, tạo 1 Action Webhook POST riêng cho phòng này (xem trang hướng dẫn — KHÔNG dùng chung link với phòng/game khác). Go LIVE trước rồi mới Connect.

## Mốc cần kiểm chứng trên live thật

- [ ] Join lần đầu → 0đ + pháo chào mừng mang tên nổ trong vài giây (vào muộn vẫn được chào như người đầu).
- [ ] Tap 20 lần → +1đ + 1 pháo nhỏ (dư tap giữ lại: tap 45 lần = +2đ, dư 5). Gửi lại likeCount cũ → +0đ, không pháo.
- [ ] Comment → +1đ + 1 pháo nhỏ + bong bóng comment (tối đa 5 bong bóng). Comment 2 lần trong 5s → lần 2 bị chặn.
- [ ] Share → +1đ + 1 pháo nhỏ; share lần 2 trong 30s bị chặn.
- [ ] Follow → +5đ + pháo chữ TÊN người follow bay lên trời (từng ký tự là chùm pháo). Follow lần 2 trong phiên = 0.
- [ ] Quà 1 xu → +10đ, pháo tròn 1 màu (Hoa hồng = đỏ). Quà 10 xu → +100đ, pháo chùm 3 vòng nhiều màu. Quà 100 xu → +1000đ, pháo hình trái tim ❤️ + banner Epic 8s + giọng đọc "Cảm ơn [tên] đã tặng [tên quà]!".
- [ ] Quà lạ (không rõ số xu trong TikFinity) → +0đ + log WARN đỏ, pháo nhỏ visual only.
- [ ] Cứ 100 pháo → MÀN PHÁO LỚN 10s: banner Epic + 12 pháo đủ màu + giọng đọc top 3 theo ĐIỂM. Trong 10s màn lớn: pháo nhỏ tạm dừng, pháo quà vẫn nổ chung. Màn lớn KHÔNG reset bộ đếm (mốc tiếp 200, 300...).
- [ ] Countdown: mặc định TẮT (không đặt giờ G thì không hiện đồng hồ). Đặt giờ G + dòng chúc mừng → overlay hiện đồng hồ đếm ngược; 60s cuối nhấp nháy + mỗi 10s 1 pháo nhỏ + giọng đọc "Còn 30 giây!", "Còn 10 giây!"; tới giờ G → MÀN ĐẠI 15s (20 pháo + pháo chữ dòng chúc mừng) rồi countdown tự TẮT.
- [ ] Nút "Test countdown 10s" → đếm 10…0 → màn đại. Nút "Hủy countdown" hoạt động.
- [ ] Đông người cùng bắn: 20 pháo nhỏ cùng lúc → gộp thành vài pháo "x3"/"x5", không vượt 8 pháo/giây, không rớt pháo quà. Hàng đợi pháo nhỏ đầy 20 → rớt trái cũ nhất (chỉ visual, điểm vẫn đủ).
- [ ] Top 3 hiện avatar TikTok thật + điểm + số pháo; không có avatar thì ngôi sao ⭐ + ghi chú trong dashboard (avatarStats).
- [ ] Overlay dọc 1080x1920: bầu trời đêm + sao + trăng + thành phố phía dưới, pháo nổ ở vùng trời (không che nóc nhà), bong bóng comment tối đa 5, ticker.
- [ ] Dashboard: đổi mọi ngưỡng (tap/điểm, mốc 100, 8 pháo/giây...), đổi hình pháo lớn (tim/sao/chữ), đổi màu theo quà, đặt giờ G → áp dụng ngay. Nút "Bắn màn lớn ngay", "Làm mới phiên" hoạt động. Nút "Đặt tổng pháo = X" CHỈ hiện khi demoMode bật.

## Quyết định đã tự chốt (khác/khuyết trong bản thiết kế)

- **Quà**: không có bảng quà hardcode theo tên quà — số xu lấy thẳng từ payload webhook (`diamondCount`); mốc xu → tầng pháo chính là bảng. Màu theo tên quà có bảng mặc định (Hoa hồng đỏ, Kính râm xanh dương, Heo may mắn hồng, Xe hơi vàng, Vương miện tím), quà không có trong bảng → màu mặc định theo tầng xu.
- **Pháo vẽ bằng canvas phía overlay**: server chỉ giữ sự kiện pháo (loại, màu, hình, chữ, vị trí, xN) + đếm; overlay vẽ tên lửa bay lên → nổ bung hạt → tàn rơi. Pháo hình tim/sao vẽ bằng hạt dọc theo đường cong tim / biên sao 5 cánh.
- **Đổi `grandEvery` trong dashboard**: mốc tiếp theo được tính lại từ tổng pháo hiện tại (vd tổng 37, đổi mốc 5 → mốc tiếp là 40).
- **Màn lớn trùng màn đại countdown**: ưu tiên countdown, màn 100 pháo dời lại 20s sau khi màn đại xong (đúng bản thiết kế).
- **Pháo countdown mỗi 10s trong 60s cuối**: có tính vào tổng pháo; nếu chạm mốc 100 thì màn lớn vẫn bắn (không bỏ mốc).
- **Nút "Đặt tổng pháo = X"**: chỉ tồn tại trong chế độ thử (API + dashboard đều chặn khi demoMode tắt) — live thật không có nút này, tổng pháo chỉ tăng khi pháo nổ thật.

## Chế độ demo (2026-11-13)
- Mở overlay với `?demo=1` → tự bật chế độ thử + chạy demo: 3 người xem ảo vào
  bầu trời, bình luận/tim bắn pháo nhỏ, tặng quà bắn pháo tròn/chùm/hình, follow
  bắn pháo chữ tên, share liên tục qua đúng đường event thật; huy hiệu `DEMO` ở
  góc trái overlay. Đủ 100 pháo tự bắn màn lớn, chạy tiếp tới khi dừng.
- Dashboard → mục Test: `▶ Chạy demo` / `■ Dừng demo` (+ `🎬 Demo 12 bước` 1 lượt mẫu).
  API: `POST /api/test/demo {action:"start"|"stop"|"once"}`.
- An toàn: từ chối bật khi phòng đã có event thật; event thật đầu tiên tới thì
  demo tự dừng. Người xem demo không tính vào thống kê avatar.
