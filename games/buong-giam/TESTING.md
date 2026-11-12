
## Chế độ demo (2026-11-13)
- Mở overlay với `?demo=1` → tự bật chế độ DEMO + chạy demo: 3 tù nhân ảo vào
  buồng (người đầu tặng Heo 50 xu = 250đ lên Mâm 1 ăn gà ngay), rồi bình luận /
  thả tim / tặng quà / follow liên tục qua đúng các hàm intake thật; watermark
  `🧪 CHẾ ĐỘ DEMO ĐANG BẬT` có sẵn hiện khi demo chạy. Người demo có cờ
  `isSimulated` (miễn đá idle + trừ điểm), không có avatar TikTok thật.
- Dashboard → tab Test: `▶ Chạy demo` / `■ Dừng demo` (giữ nguyên công tắc
  Chế độ DEMO, `/api/demo-mode`, `demoFastChicken`, các nút `/api/simulate`).
  API: `POST /api/test/demo {action:"start"|"stop"|"once"}` (once = 3 người mẫu).
- An toàn: từ chối bật khi phòng đã có event thật; event thật đầu tiên tới thì
  demo tự dừng. Dừng demo không xóa tù nhân đang trong buồng.

## TikFinity — cơ chế mới (không body, 6 URL riêng)
- Mỗi sự kiện 1 Action webhook riêng, URL `.../api/webhook?event=gift|chat|like|follow|share|join` (xem bài hướng dẫn `/huong-dan-tikfinity?game=buong-giam`). Action chỉ có ô URL, không nhập body.
- Engine đọc form TikFinity: `value1` = tên tài khoản, `value2` = tên quà, `value3` = số xu (10 xu = 50đ). Quà lạ/không rõ xu → fallback danh mục, không mặc định +5.
