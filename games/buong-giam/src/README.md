# Buồng Giam — TikTok LIVE Interactive Game

Game tương tác 2D cho TikTok LIVE. Tương tác của viewer làm thay đổi điểm buồng, vị trí tầng và hoạt ảnh trên overlay dọc 1080 × 1920. Project có dashboard điều khiển, âm thanh/giọng đọc tiếng Việt, nhận sự kiện live qua TikFinity (webhook — xem mục "Cài đặt TikFinity" trên dashboard).

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

## Kết nối TikTok LIVE (qua TikFinity — đường sự kiện chính)

Trên nền tảng tập trung, game nhận sự kiện live qua **TikFinity** chạy trên
máy Windows của bạn: TikFinity gửi event (chat/gift/like/follow/share/join)
về webhook của room (xem mục "🎯 Cài đặt TikFinity" trên dashboard — tải file
.tfc của phòng rồi import, hoặc tạo Action bằng tay). Adapter trực tiếp
(`tiktok-live-connector`) hiện KHÔNG nhận được event (Euler chặn ký
websocket, key miễn phí đã thử và không mở được) — chỉ còn để kiểm tra
live/offline và đếm event TikFinity.

## Dữ liệu cục bộ

`data/` chứa cấu hình, trạng thái phiên và cache TTS. `public/avatars/` lưu ảnh đại diện viewer tải về khi chạy. Hai thư mục này cùng log và dependencies không được đưa vào Git. Cài lại dependencies bằng `npm install` sau khi clone.

Ứng dụng và các cầu nối mặc định phục vụ trên máy local. Không mở các cổng hoặc chuyển tiếp chúng ra Internet nếu chưa thêm xác thực và kiểm soát truy cập.

## Công nghệ

- Node.js, Express, Socket.IO, WebSocket
- HTML/CSS/JavaScript cho dashboard và overlay
- `tiktok-live-connector` cho kết nối TikTok LIVE
