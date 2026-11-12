# TESTING — Bếp Ăn Tập Thể – Nấu Cỗ

## Link live (sau khi Railway deploy)

- Overlay: `https://live-game-platform-production.up.railway.app/o/bep-an-tap-the/<tiktok-id>/overlay.html`
- Dashboard: `https://live-game-platform-production.up.railway.app/o/bep-an-tap-the/<tiktok-id>/dashboard`
- Hướng dẫn TikFinity: `https://live-game-platform-production.up.railway.app/huong-dan-tikfinity?game=bep-an-tap-the&username=<tiktok-id>`

## Chuẩn bị

1. Mở dashboard → **bật "Chế độ thử (demoMode)"** để test giả lập; **TẮT trước khi live thật**.
2. Trong TikFinity, tạo 1 Action Webhook POST riêng cho phòng này (xem trang hướng dẫn — KHÔNG dùng chung link với phòng/game khác). Go LIVE trước rồi mới Connect.

## Mốc cần kiểm chứng trên live thật

- [ ] Bình luận "thịt bò" → nồi +3 (🥩 tăng 1); "rau muống" → +2; "muối" → +1; "hello" → +1 gia vị chung. Tên người thả hiện ở ticker.
- [ ] Bình luận 2 lần trong 5s → lần 2 bị chặn (log "chống spam").
- [ ] Thả 50 tim → nồi +5, lửa lên cấp 3 trong 30s, nguyên liệu lúc lửa to được +1 (thịt bò → +4).
- [ ] Cứ 20 tim → người thả +1 điểm cá nhân.
- [ ] Quà 10 xu → nồi +100 điểm, quà tích lũy 10 xu. Quà 100 xu tích lũy → mở 🍗 Gà luộc (banner + giọng đọc). Quà 500 xu tích lũy → mở 🍙 Bánh chưng + 🍖 Giò chả.
- [ ] Quà lạ (không rõ số xu trong TikFinity) → KHÔNG cộng điểm, chỉ ghi log đỏ "không rõ số xu".
- [ ] Follow → +10đ cá nhân, không cộng điểm nồi. Share → +5đ cá nhân.
- [ ] Nồi đủ 300 điểm → banner "CỖ ĐÃ CHÍN", dọn cỗ 15s → bốc thăm 10 người đang trong phòng → nồi mới #2 từ 0, điểm cá nhân giữ nguyên.
- [ ] Overlay dọc 1080x1920: nồi 🍲 + lửa 🔥, thanh tiến độ, số lượng thịt/rau/gia vị, 4 món đặc biệt (mở thì sáng), top 5 đầu bếp, ticker.
- [ ] Dashboard: đổi potTarget / mốc món / số người trúng → lưu → overlay đổi theo. Nút "Nồi mới ngay" và "Làm mới phiên" hoạt động.
- [ ] Avatar người chơi là avatar TikTok thật; nếu không có thì hiện chữ cái đầu + ghi chú trong dashboard (avatarStats).

## Quyết định đã tự chốt (khác/khuyết trong bản thiết kế)

- **Tap có 2 bộ đếm độc lập**: cứ 20 tap = +1 điểm cá nhân; cứ 50 tap = 1 lần thổi lửa (nồi +5, người thổi +1đ). Cả 2 đều chạy theo bản thiết kế.
- **Khi nồi đang dọn cỗ/kết quả**: bình luận/quà vẫn +điểm cá nhân nhưng KHÔNG cộng điểm nồi; thổi lửa lúc này chỉ +1đ cá nhân (không cộng nồi). Nồi mới reset điểm nấu + số lượng nguyên liệu + quà tích lũy + món đã mở, nhưng **điểm cá nhân giữ nguyên cả phiên**.
- **Quà**: không có bảng quà hardcode — số xu lấy thẳng từ payload webhook (`diamondCount`); payload không gửi xu → 0 điểm + log cảnh báo (đúng tinh thần "không bao giờ mặc định +5").
- **Mốc món**: mở dần theo tổng xu quà tích lũy TRONG NỒI (reset theo nồi mới). Một quà lớn có thể mở nhiều món cùng lúc.
- **Khớp nguyên liệu**: từ khóa dài nhất trước, ưu tiên thịt → rau → gia vị, khớp theo ranh giới từ (vd "cam ơn" không bị tính là "cá").
