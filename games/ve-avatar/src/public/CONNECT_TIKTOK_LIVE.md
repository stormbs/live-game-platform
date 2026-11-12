# Kết nối Vẽ Avatar với TikTok LIVE (qua TikFinity)

Đường sự kiện chính là **TikFinity**: TikFinity chạy trên máy Windows của
bạn, gửi sự kiện live (like, bình luận, quà, follow, share, vào phòng) về
máy chủ nền tảng qua webhook. Thẻ "Kết nối trực tiếp" trên dashboard cũng
đếm mọi sự kiện này — khi số sự kiện > 0 là TikFinity đã nối đúng.

## 1. Cách chạy (nền tảng)

1. Mở trang chính nền tảng, nhập TikTok ID, chọn game Vẽ Avatar, bấm **Lấy link overlay**.
2. Trong TikTok LIVE Studio: thêm nguồn **Link**, dán link overlay, đặt kích thước **1080 × 1920**.
3. Mở dashboard của phòng (link "Dashboard của streamer") → mục **🎯 Cài đặt TikFinity**:
   - Bấm **⬇️ Tải file TikFinity (.tfc)** (file đã có sẵn webhook URL của phòng này), rồi import vào TikFinity: **Setup & Options → Import and Export Settings → Select File** (hoặc kéo-thả file .tfc vào cửa sổ TikFinity) → đợi báo **"Settings successfully imported!"**.
   - ⚠️ **File .tfc là bản thử nghiệm, chưa xác minh được việc import sẽ thành công** (định dạng export của TikFinity được mã hóa, mật khẩu mã hóa không công khai). Nếu import lỗi, dùng cách tạo tay ở mục 4 bên dưới — cách đó đã chạy thật trong các live trước.
   - Kiểm tra Action mới đã có và đang **bật**: tên Action "Ve Avatar - Moi su kien", chứa 1 Webhook POST tới đúng webhook URL của phòng.
4. **Thứ tự lên live:** bấm **Go LIVE** trong TikTok LIVE Studio TRƯỚC, rồi mới bấm **Connect** trong TikFinity.
5. Kiểm chứng: khán giả like / bình luận / tặng quà nhỏ → xem log + hàng đợi trên dashboard nhảy, số sự kiện trên thẻ trạng thái > 0.

> Kiểm tra lại TikTok ID trong link: nhập sai nick là TikFinity gửi event về đúng room nhưng game theo dõi nhầm tài khoản, không nhận event nào. Thẻ trạng thái trên dashboard và banner trên overlay sẽ báo ngay khi tài khoản chưa live.

## 2. Kết nối trực tiếp (phương án dự phòng — hiện KHÔNG nhận được event)

Nền tảng có sẵn adapter tự nối TikTok LIVE (`tiktok-live-connector`), nhưng
TikTok bắt websocket phải có chữ ký qua máy chủ ký của Euler Stream, và Euler
chặn ký ẩn danh ("This endpoint requires a Business plan"). **Key miễn phí đã
thử ngày 2026-11-12 và vẫn bị chặn** — chỉ key gói Business (~$75/tháng) mới
mở được route ký. Vì vậy adapter trực tiếp hiện chỉ kiểm tra được
live/offline và đếm event (qua `state.webhook.count`, kể cả event TikFinity),
không tự nhận event live. Dùng TikFinity theo mục 1 ở trên. Nếu sau này có
key Euler gói Business, đặt biến môi trường `EULER_API_KEY` trên máy chủ
(Railway → Variables); adapter đọc key này qua `signApiKey`.

## 3. Chạy local (bản gốc, chỉ để phát triển)

1. Cài Node.js 18 trở lên.
2. Mở thư mục project và chạy:

   ```powershell
   npm install
   npm start
   ```

   Hoặc chạy `CHAY_VE_AVATAR.bat` trên Windows.
3. Mở dashboard: <http://localhost:3005>
4. Mở overlay: <http://localhost:3005/overlay.html>

Giữ cửa sổ server chạy trong suốt buổi live. Bản local nhận event qua
TikFinity giống hệt nền tảng (webhook URL là `http://localhost:3005/api/webhook`
khi chạy local — TikFinity trên máy Windows POST thẳng về đó được).

## 4. Cách tạo Action TikFinity bằng tay (chắc chắn chạy)

1. Trong TikFinity: tạo 1 Action mới, đặt tên "Ve Avatar - Moi su kien".
2. Thêm trigger **Webhook POST**: Method **POST**, Content-Type **application/json**, URL = webhook của phòng (`https://live-game-platform-production.up.railway.app/o/ve-avatar/<tên TikTok>/api/webhook` — xem trên dashboard, nút Sao chép).
3. Gắn 6 sự kiện vào cùng Action này (Gift, Chat, Like, Follow, Share, Viewer joined), mỗi sự kiện gửi đúng body mẫu của nó (xem mục 5). Tên biến ($userId, $nickname, $uniqueId, $comment…) tùy phiên bản TikFinity — bấm nút chèn biến (insert variable) của TikFinity để lấy đúng tên. Nếu không có $uniqueId thì dùng biến tên TikTok mà TikFinity gợi ý, hoặc bỏ trường uniqueId (engine tự dùng nickname thay thế).

## 5. Định dạng event (để tham khảo khi debug)

TikFinity (và adapter trực tiếp, nội bộ) đẩy event vào engine qua `POST /api/webhook` với body dạng sau:

**Quà tặng (Gift)**

```json
{"triggerTypeId":3,"event":"gift","userId":"$userId","nickname":"$nickname","uniqueId":"$uniqueId","profilePictureUrl":"$profilePictureUrl","giftName":"$giftName","diamondCount":$diamondCount,"repeatCount":$repeatCount}
```

**Bình luận (Chat)**

```json
{"triggerTypeId":11,"event":"chat","userId":"$userId","nickname":"$nickname","uniqueId":"$uniqueId","profilePictureUrl":"$profilePictureUrl","content":"$comment"}
```

**Theo dõi (Follow)**

```json
{"triggerTypeId":1,"event":"follow","userId":"$userId","nickname":"$nickname","uniqueId":"$uniqueId","profilePictureUrl":"$profilePictureUrl"}
```

**Chia sẻ (Share)**

```json
{"triggerTypeId":8,"event":"share","userId":"$userId","nickname":"$nickname","uniqueId":"$uniqueId","profilePictureUrl":"$profilePictureUrl"}
```

**Thả tim (Like/Tap)**

```json
{"triggerTypeId":7,"event":"like","userId":"$userId","nickname":"$nickname","uniqueId":"$uniqueId","profilePictureUrl":"$profilePictureUrl","likeCount":$likeCount}
```

**Vào phòng (Join)**

```json
{"triggerTypeId":6,"event":"join","userId":"$userId","nickname":"$nickname","uniqueId":"$uniqueId","profilePictureUrl":"$profilePictureUrl"}
```

`userId` nhận diện viewer; `profilePictureUrl` cung cấp ảnh đại diện thật từ LIVE (tuyệt đối không bịa avatar); `diamondCount` là số xu thực của quà; `likeCount` là số tim trong đợt. Trường `event` (chuỗi loại sự kiện) là bắt buộc cho game Bản đồ (parser của nó không đọc `triggerTypeId`).

## 6. Chạy thử an toàn

- Demo mode được bật mặc định. Khi bật, dashboard bỏ qua sự kiện live thật và chỉ nhận nút mô phỏng trong dashboard.
- Để kiểm tra event thật, chuyển **Chế độ thử (Demo)** sang tắt, Go LIVE rồi thử thả tim / bình luận / tặng quà nhỏ và xem log cùng hàng đợi trên dashboard.
- Trước buổi live thật, kiểm tra lại URL overlay, thẻ kết nối, avatar viewer và log. Bấm **Làm mới phiên** nếu muốn bắt đầu hàng đợi mới.

## 7. Sự cố thường gặp

| Hiện tượng | Kiểm tra |
| --- | --- |
| Overlay trống hoặc không tải | Server còn chạy không; URL overlay có đúng dạng `…/o/ve-avatar/<tên TikTok>`; nguồn Link trong LIVE Studio đã refresh chưa. |
| Thẻ kết nối báo "chưa LIVE" | Sai TikTok ID trong link, hoặc chưa Go LIVE. Sửa lại username rồi Go LIVE, đợi tối đa 1 phút. |
| Thẻ kết nối báo lỗi Euler / Business plan | Kết nối trực tiếp không dùng được (Euler yêu cầu gói Business, key miễn phí đã thử và không mở được). Dùng TikFinity theo mục 1 — thẻ này vẫn đếm sự kiện TikFinity gửi về. |
| Số sự kiện vẫn 0 dù đã live | TikFinity đã bấm **Connect** sau khi Go LIVE chưa? Action TikFinity đã bật chưa? Webhook URL trong Action có đúng URL trên dashboard không? Thử comment/tim trong live rồi xem lại. |
| Import file .tfc báo lỗi | File .tfc là bản thử nghiệm chưa xác minh (định dạng export của TikFinity được mã hóa). Dùng cách tạo tay ở mục 4. |
| Event tới nhưng không vào hàng đợi | Demo mode phải tắt để xử lý event thật; kiểm tra body JSON có `userId` cùng `triggerTypeId`. |
| Viewer hiện chữ cái thay avatar | Event cần có `profilePictureUrl` (hoặc trường avatar tương đương). |
| Gift không lên hàng đợi | Kiểm tra `diamondCount` và ngưỡng xu đặt trong dashboard. |
| Like không lên hàng đợi | Số tim tích lũy phải đạt mục tiêu trong dashboard. |
