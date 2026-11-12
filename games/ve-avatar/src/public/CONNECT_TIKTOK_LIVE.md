# Kết nối trực tiếp Vẽ Avatar với TikTok LIVE

Không cần cài thêm gì. Nền tảng tự kết nối vào LIVE của bạn bằng TikTok ID trong link overlay.

## 1. Cách chạy (nền tảng)

1. Mở trang chính nền tảng, nhập TikTok ID, chọn game Vẽ Avatar, bấm **Lấy link overlay**.
2. Trong TikTok LIVE Studio: thêm nguồn **Link**, dán link overlay, đặt kích thước **1080 × 1920**.
3. Bấm **Go LIVE** — máy chủ tự kết nối trong tối đa 1 phút. Khán giả like / bình luận / tặng quà là game phản ứng ngay.

> Kiểm tra lại TikTok ID trong link: nhập sai nick là máy chủ theo dõi nhầm tài khoản, game không nhận event nào. Thẻ "Kết nối trực tiếp" trên dashboard và banner trên overlay sẽ báo ngay khi tài khoản chưa live.

## 2. Chạy local (bản gốc, chỉ để phát triển)

1. Cài Node.js 18 trở lên.
2. Mở thư mục project và chạy:

   ```powershell
   npm install
   npm start
   ```

   Hoặc chạy `CHAY_VE_AVATAR.bat` trên Windows.
3. Mở dashboard: <http://localhost:3005>
4. Mở overlay: <http://localhost:3005/overlay.html>

Giữ cửa sổ server chạy trong suốt buổi live. Bản local cũng tự nối TikTok LIVE trực tiếp, không cần phần mềm trung gian.

## 3. Định dạng event nội bộ (để tham khảo khi debug)

Máy chủ nền tảng tự nối TikTok LIVE và đẩy event vào engine qua `POST /api/webhook` nội bộ với body dạng sau. Không cần cấu hình gì — chỉ để đối chiếu khi đọc log:

**Quà tặng (Gift)**

```json
{"triggerTypeId":3,"userId":"$userId","nickname":"$nickname","profilePictureUrl":"$profilePictureUrl","giftName":"$giftName","diamondCount":$diamondCount,"repeatCount":$repeatCount}
```

**Bình luận (Chat)**

```json
{"triggerTypeId":11,"userId":"$userId","nickname":"$nickname","profilePictureUrl":"$profilePictureUrl","content":"$comment"}
```

**Theo dõi (Follow)**

```json
{"triggerTypeId":1,"userId":"$userId","nickname":"$nickname","profilePictureUrl":"$profilePictureUrl"}
```

**Chia sẻ (Share)**

```json
{"triggerTypeId":8,"event":"share","userId":"$userId","nickname":"$nickname","profilePictureUrl":"$profilePictureUrl"}
```

**Thả tim (Like/Tap)**

```json
{"triggerTypeId":7,"userId":"$userId","nickname":"$nickname","profilePictureUrl":"$profilePictureUrl","likeCount":$likeCount}
```

`userId` nhận diện viewer; `profilePictureUrl` cung cấp ảnh đại diện thật từ LIVE (tuyệt đối không bịa avatar); `diamondCount` là số xu thực của quà; `likeCount` là số tim trong đợt.

## 4. Chạy thử an toàn

- Demo mode được bật mặc định. Khi bật, dashboard bỏ qua sự kiện live thật và chỉ nhận nút mô phỏng trong dashboard.
- Để kiểm tra event thật, chuyển **Chế độ thử (Demo)** sang tắt, Go LIVE rồi thử thả tim / bình luận / tặng quà nhỏ và xem log cùng hàng đợi trên dashboard.
- Trước buổi live thật, kiểm tra lại URL overlay, thẻ kết nối trực tiếp, avatar viewer và log. Bấm **Làm mới phiên** nếu muốn bắt đầu hàng đợi mới.

## 5. Sự cố thường gặp

| Hiện tượng | Kiểm tra |
| --- | --- |
| Overlay trống hoặc không tải | Server còn chạy không; URL overlay có đúng dạng `…/o/ve-avatar/<tên TikTok>`; nguồn Link trong LIVE Studio đã refresh chưa. |
| Thẻ kết nối báo "chưa LIVE" | Sai TikTok ID trong link, hoặc chưa Go LIVE. Sửa lại username rồi Go LIVE, đợi tối đa 1 phút. |
| Thẻ kết nối báo lỗi Euler / Business plan | Máy chủ cần API key Euler (đăng ký miễn phí) để nối TikTok LIVE. Xem README của nền tảng, mục "Kết nối trực tiếp". |
| Event tới nhưng không vào hàng đợi | Demo mode phải tắt để xử lý event thật; kiểm tra body JSON có `userId` cùng `triggerTypeId`. |
| Viewer hiện chữ cái thay avatar | Event cần có `profilePictureUrl` (hoặc trường avatar tương đương). |
| Gift không lên hàng đợi | Kiểm tra `diamondCount` và ngưỡng xu đặt trong dashboard. |
| Like không lên hàng đợi | Số tim tích lũy phải đạt mục tiêu trong dashboard. |
