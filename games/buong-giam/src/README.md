# Buồng Giam — TikTok LIVE Interactive Game

Game tương tác 2D cho TikTok LIVE. Tương tác của viewer làm thay đổi điểm buồng, vị trí tầng và hoạt ảnh trên overlay dọc 1080 × 1920. Project có dashboard điều khiển, âm thanh/giọng đọc tiếng Việt, tích hợp TikFinity và Streamer.bot.

## Chạy local

Yêu cầu Node.js 18 trở lên.

```powershell
npm install
npm start
```

Trên Windows, có thể chạy `CHAY_BUONG_GIAM.bat`.

- Dashboard: <http://localhost:3003>
- Overlay: <http://localhost:3003/overlay.html>
- TikFinity webhook: <http://localhost:3003/api/webhook>
- Streamer.bot WebSocket: <ws://127.0.0.1:8080/>

Giữ server chạy trong khi dùng LIVE Studio. Trong TikTok LIVE Studio, thêm nguồn Link và dùng URL overlay ở trên; chọn kích thước 1080 × 1920.

## TikFinity và Streamer.bot

Kết nối tài khoản TikTok trong TikFinity, sau đó gắn các event/action phù hợp tới webhook của ứng dụng. Bật TikFinity LIVE trước khi mong đợi sự kiện trực tiếp. Streamer.bot có thể kết nối tới WebSocket local trên cổng 8080.

## Dữ liệu cục bộ

`data/` chứa cấu hình, trạng thái phiên và cache TTS. `public/avatars/` lưu ảnh đại diện viewer tải về khi chạy. Hai thư mục này cùng log và dependencies không được đưa vào Git. Cài lại dependencies bằng `npm install` sau khi clone.

Ứng dụng và các cầu nối mặc định phục vụ trên máy local. Không mở các cổng hoặc chuyển tiếp chúng ra Internet nếu chưa thêm xác thực và kiểm soát truy cập.

## Công nghệ

- Node.js, Express, Socket.IO, WebSocket
- HTML/CSS/JavaScript cho dashboard và overlay
- `tiktok-live-connector` cho kết nối TikTok LIVE
