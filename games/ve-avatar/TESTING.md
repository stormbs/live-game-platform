
## Chế độ demo (2026-11-13)
- Mở overlay với `?demo=1` → tự bật chế độ thử + chạy demo: khán giả ảo vào
  vẽ liên tục (quà/bình luận/follow/share/tim qua đúng đường event thật), mỗi
  lượt dùng tên tiếng Việt mới; huy hiệu `DEMO` ở góc trái overlay. Khung vẽ
  dùng chữ cái đầu tên (người demo không có avatar TikTok thật).
- Dashboard → mục THỬ: `▶ Chạy demo` / `■ Dừng demo` (nút cũ "Chạy thử tự động"
  theo kịch bản cố định đã thay bằng vòng lặp demo liên tục phía server).
  API: `POST /api/test/demo {action:"start"|"stop"|"once"}` (once = 3 lượt mẫu).
- An toàn: từ chối bật khi phòng đã có event thật; event thật đầu tiên tới thì
  demo tự dừng; dừng demo không xóa hàng đợi đang vẽ. Người xem demo không
  tính vào thống kê avatar (không gây cảnh báo avatar giả).
