# TESTING — Vòng Quay May Mắn Khổng Lồ

## Link live (sau khi Railway deploy)

- Overlay: `https://live-game-platform-production.up.railway.app/o/vong-quay-may-man/<tiktok-id>/overlay.html`
- Dashboard: `https://live-game-platform-production.up.railway.app/o/vong-quay-may-man/<tiktok-id>/dashboard`
- Hướng dẫn TikFinity: `https://live-game-platform-production.up.railway.app/huong-dan-tikfinity?game=vong-quay-may-man&username=<tiktok-id>`

## Chuẩn bị

1. Mở dashboard → **bật "Chế độ thử (demoMode)"** để test giả lập; **TẮT trước khi live thật**.
2. Trong TikFinity, tạo 1 Action Webhook POST riêng cho phòng này (xem trang hướng dẫn — KHÔNG dùng chung link với phòng/game khác). Go LIVE trước rồi mới Connect.

## Mốc cần kiểm chứng trên live thật

- [ ] Vòng quay đủ 20 ô, tổng tỉ lệ 100% (trúng 75% / trượt 25%), kim ở đỉnh.
- [ ] 50 tim → quay chung; 10 bình luận → quay chung; trộn 25 tim + 5 bình luận → quay chung. Thanh tích lũy luôn hiện ("37/50"), điểm dư giữ lại sau khi quay (53/50 → còn 3).
- [ ] Người trúng quay chung là người đang trong phòng (đã join, tương tác trong 5 phút gần nhất). Người vừa trúng không được trúng quay chung 2 lần liên tiếp.
- [ ] Quà 1 xu → 1 lượt riêng; 10 xu → 2; 50 xu → 3; 100 xu → 5; 500 xu → 10; 1000 xu → 20 lượt + hiệu ứng Epic. Quà quay riêng NGAY (xếp hàng nếu vòng đang quay, quay riêng ưu tiên trước quay chung).
- [ ] Quà lạ (không rõ số xu trong TikFinity) → 0 lượt + log đầy đủ trong mục "Quà chưa rõ xu", không crash, không mặc định lượt.
- [ ] Vòng quay mượt 5–8s, tăng tốc rồi giảm dần, kim dừng ĐÚNG ô trúng (không nhảy cóc, không dừng đột ngột). Ô trúng sáng + tên người trúng + tên phần thưởng hiện to 8s + giọng đọc xướng tên.
- [ ] Trúng ô trượt (🍂 "Chúc bạn may mắn lần sau") → hiện lời động viên, không SFX buồn quá to.
- [ ] Trúng ô 🎁 "Quay Thêm 1 Lượt" → quay tiếp 1 lượt miễn phí sau 2s.
- [ ] Chống spam: 1 người tap 100 lần/phút → chỉ 10 tim tính điểm; comment 10 lần/phút → chỉ 2 tính điểm (dashboard hiện số bị chặn).
- [ ] Lịch sử trúng 8 dòng + Top May Mắn 5 người cập nhật ngay sau mỗi lượt quay.
- [ ] Avatar người trúng là avatar TikTok thật; không có thì fallback mascot + ghi chú trong dashboard (avatarStats).
- [ ] Dòng "Quay vui miễn phí — trúng thưởng chỉ là vinh danh trong live" hiện trên overlay và dashboard.
- [ ] Dashboard: sửa tên/tỉ lệ 1 ô (tổng phải = 100%, sai thì báo đỏ và không lưu), đổi ngưỡng 50 → 30 thì thanh đổi theo ngay; nút "Quay ngay 1 lượt chung", "Reset thanh", "Khôi phục bảng ô mặc định" hoạt động.

## Quyết định đã tự chốt (khác/khuyết trong bản thiết kế)

- **Quà**: không có bảng quà hardcode theo tên quà — số xu lấy thẳng từ payload webhook (`diamondCount`); mốc xu → lượt quay chính là bảng (1–9→1, 10–49→2, 50–99→3, 100–499→5, 500–999→10, ≥1000→20). Payload không gửi xu → 0 lượt + log vào mục "Quà chưa rõ xu" (đúng tinh thần "không bao giờ mặc định +5 hay +1 lượt").
- **Hàng chờ**: không có giới hạn cứng 10 lượt — vượt 10 thì dashboard cảnh báo nhưng KHÔNG mất lượt nào (bản thiết kế vừa nói "tối đa 10 lượt chờ" vừa nói "KHÔNG mất lượt" — chọn không mất lượt).
- **Giới hạn 5 lượt riêng/người/phút**: tính lúc BẮT ĐẦU quay (tick), không tính lúc xếp hàng — lượt vượt vẫn chờ trong hàng, không mất.
- **Top May Mắn**: chỉ đếm lần trúng ô CÓ THƯỞNG (trượt không tính). Lịch sử 8 dòng gần nhất ghi CẢ lượt trúng lẫn lượt trượt (ghi rõ "(trượt)").
- **Quay chung khi pool trống**: nếu chỉ còn người vừa trúng trong phòng thì lượt quay chung vẫn chờ (pendingShared giữ nguyên), không quay cho cùng 1 người, không mất lượt — có người mới vào là quay tiếp.
- **Ép ô hiếm / ép ô quay thêm**: chỉ có trong chế độ Test (dashboard + API test), live thật không có.
- **Vòng đang quay dở khi server restart**: bỏ lượt đó (currentSpin reset khi load session) — trạng thái còn lại (thanh, hàng chờ, lịch sử, top) vẫn giữ.

## Chế độ demo (2026-11-13)
- Mở overlay với `?demo=1` → tự bật chế độ thử + chạy demo: 3 người xem ảo vào
  phòng, bình luận/tim cộng điểm thanh chung (tôn trọng giới hạn 10 tim + 2 bình
  luận/phút/người), tặng quà lấy lượt quay riêng, follow/share liên tục qua đúng
  đường event thật; huy hiệu `DEMO` ở góc trái overlay. Đủ 50đ tự quay chung.
- Dashboard → mục Test: `▶ Chạy demo` / `■ Dừng demo` (+ `🎬 Demo tự động` 1 lượt mẫu).
  API: `POST /api/test/demo {action:"start"|"stop"|"once"}`.
- An toàn: từ chối bật khi phòng đã có event thật; event thật đầu tiên tới thì
  demo tự dừng. Người xem demo không tính vào thống kê avatar.
