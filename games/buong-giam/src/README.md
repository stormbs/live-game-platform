# Buồng Giam — TikTok LIVE Interactive Game

Game tương tác 2D cho TikTok LIVE. Tương tác của viewer làm thay đổi điểm buồng, vị trí tầng và hoạt ảnh trên overlay dọc 1080 × 1920. Project có dashboard điều khiển, âm thanh/giọng đọc tiếng Việt, kết nối trực tiếp TikTok LIVE (không cần phần mềm trung gian).

## Chạy local

Yêu cầu Node.js 18 trở lên.

```powershell
npm install
npm start
```

Trên Windows, có thể chạy `CHAY_BUONG_GIAM.bat`.

- Dashboard: <http://localhost:3003>
- Overlay: <http://localhost:3003/overlay.html>

Giữ server chạy trong khi dùng LIVE Studio. Trong TikTok LIVE Studio, thêm nguồn Link và dùng URL overlay ở trên; chọn kích thước 1080 × 1920.

## Kết nối trực tiếp TikTok LIVE

Trên nền tảng tập trung, máy chủ tự nối TikTok LIVE bằng username trong link overlay (`/o/buong-giam/<username>`) — không cần cài thêm gì. Event live (chat/gift/like/follow/share/join) đi vào engine qua intake nội bộ `POST /api/webhook`. Chạy bản local này cũng tự nối trực tiếp khi có mạng.

## Dữ liệu cục bộ

`data/` chứa cấu hình, trạng thái phiên và cache TTS. `public/avatars/` lưu ảnh đại diện viewer tải về khi chạy. Hai thư mục này cùng log và dependencies không được đưa vào Git. Cài lại dependencies bằng `npm install` sau khi clone.

Ứng dụng và các cầu nối mặc định phục vụ trên máy local. Không mở các cổng hoặc chuyển tiếp chúng ra Internet nếu chưa thêm xác thực và kiểm soát truy cập.

## Công nghệ

- Node.js, Express, Socket.IO, WebSocket
- HTML/CSS/JavaScript cho dashboard và overlay
- `tiktok-live-connector` cho kết nối TikTok LIVE
