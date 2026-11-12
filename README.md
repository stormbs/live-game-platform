# Live Game TikTok — Nền tảng host tập trung (kiểu Livecade)

Một service Node duy nhất host 3 game TikTok LIVE: **Vẽ Avatar**, **Buồng Giam**,
**Thắp Sáng Bản Đồ Việt Nam**. Streamer chỉ cần nhập TikTok ID, chọn game, copy
link overlay và dán vào TikTok LIVE Studio là chạy — không cần cài đặt gì, không
cần TikFinity hay Streamer.bot.

## Cách dùng (người dùng cuối)

1. Mở trang chính `/`.
2. Nhập TikTok ID (không cần `@`, nhận cả link `tiktok.com/@user`), chọn 1 trong 3 game.
3. Bấm **Lấy link overlay** → copy link dạng `https://<host>/o/<game>/<username>`.
4. Trong TikTok LIVE Studio: thêm nguồn **Link** (Browser Source), dán link,
   đặt kích thước **1080 × 1920**.
5. Bấm **Go LIVE** — game tự kết nối vào LIVE và phản ứng theo like, bình luận,
   quà tặng, follow của khán giả.
6. Dashboard của streamer: `https://<host>/room/<game>/<username>` — cài đặt
   riêng của room, gửi event thử, xem trạng thái kết nối, reset phiên.

Không hỏi mật khẩu TikTok. Nền tảng chỉ đọc feed LIVE công khai bằng username.

## Kiến trúc

```
live-game-platform/
├── server.js                 Entry point: Express + HTTP server
├── public/landing.html       Trang chính (nhập ID + chọn game + lấy link)
├── lib/
│   ├── normalize.js          Chuẩn hóa username, key room = game:username
│   ├── transform.js          Viết lại URL/ io() trong HTML/JS/CSS theo prefix room
│   ├── dispatch.js           Gọi trực tiếp route của room (không qua HTTP vòng lại)
│   ├── tiktok.js             Adapter TikTok LIVE -> event dạng webhook của game
│   └── rooms.js              RoomManager: tạo/hủy room, idle sweep, Socket.io/room
├── games/<game>/
│   ├── src/                  Code gốc của game (không sửa, để đối chiếu)
│   └── engine.js / .mjs      Engine dạng factory createEngine(ctx), sinh bởi build-engines.js
├── scripts/build-engines.js  Vendor code gốc -> engine factory (chạy lại khi cập nhật game)
├── test/                     node:test (adapter, rooms, routes, webhook, socket, smoke)
├── render.yaml               Render free web service
└── data/rooms/               Dữ liệu riêng từng room (gitignore, không commit)
```

### Room — một room = một game + một TikTok username

- Key room: `(game, username)`; username chuẩn hóa (bỏ `@`, chữ thường,
  nhận cả URL `tiktok.com/@user`).
- Mỗi room chạy **một engine riêng**: state, timer, file dữ liệu (`data/rooms/<game>-<username>/data/`)
  hoàn toàn tách biệt — event của room này không bao giờ lọt sang room khác.
- Mỗi room có **một Socket.io riêng** ở path `/o/<game>/<username>/socket.io`
  (overlay nối đúng room của mình) và **một TikTokLiveConnection riêng**.
- Game bản đồ dùng SSE (`/api/stream`) thay vì Socket.io; dispatcher giữ nguyên.
- Room tự hủy sau **30 phút** không còn client overlay/SSE nào (mặc định,
  đổi bằng `ROOM_IDLE_MINUTES`); tối đa **8 room** cùng lúc (mặc định,
  đổi bằng `MAX_ROOMS`) để vừa RAM gói Render free.
- Room **Vẽ Avatar** được tắt `demoMode` ngay khi tạo (mặc định gốc là bật,
  bỏ qua event thật) để event live chạy ngay; streamer vẫn bật lại được trong
  dashboard của room nếu muốn test tay.

### Adapter TikTok (lib/tiktok.js)

`tiktok-live-connector` bắn event `chat / gift / like / follow / share / member`.
Adapter chuyển mỗi event về **đúng định dạng webhook mà game đã chuẩn hóa**
(mang cả `triggerTypeId` cho Vẽ Avatar + Buồng Giam và `type` cho game bản đồ):

| Event connector | triggerTypeId | type |
|---|---|---|
| chat | 11 | chat |
| gift | 3 | gift |
| like | 7 | like |
| follow | 1 | follow |
| share | 8 | share |
| member (vào phòng) | 6 | join |

- **Avatar:** lấy từ `profilePicture` / `avatarLarge` / `avatarMedium` /
  `avatarThumb` (dạng `urls[0]`) hoặc `profilePictureUrl`.
- **Số xu quà:** chỉ lấy số thật từ `extendedGiftInfo.diamondCount`
  (bật `enableExtendedGiftInfo: true`); không có thì để `null` — **không bịa số**.
- **Quà streak** (giftType 1): bỏ qua các lần bắn giữa chừng, chỉ xử lý khi
  `repeatEnd` để không tính trùng.
- Event đi **thẳng vào engine của room** qua `dispatch.js` (gọi trực tiếp route),
  không POST HTTP vòng lại.
- Kết nối tự nối lại khi rớt; tài khoản chưa live thì báo trạng thái `offline`
  và thử lại mỗi 60 giây; không bao giờ hỏi mật khẩu.

### Webhook dự phòng

TikFinity vẫn dùng được như trước: `POST /o/<game>/<username>/api/webhook`
với body JSON dạng `triggerTypeId` (gift=3, like=7, share=8, chat=11, follow=1,
join=6). Dispatcher chuyển tiếp vào đúng room.

### Overlay chạy dưới prefix room như thế nào

HTML/JS/CSS của game gốc viết đường dẫn tuyệt đối từ gốc (`/api/...`,
`/assets/...`, `io()` nối Socket.io ở gốc). Dispatcher đọc file text, chạy
`transformText()` để gắn prefix `/o/<game>/<username>` vào mọi URL và viết
lại `io()` thành `io({ path: '<prefix>/socket.io' })`. File nhị phân
(ảnh, nhạc, voice) để engine tự phục vụ. File gốc trong `games/<game>/src/`
**không bị sửa** — chỉ transform lúc serve.

## Chạy local

```bash
cd live-game-platform
npm install
npm test        # 47 test, phải pass hết
npm start       # chạy tại http://localhost:3000
```

Mở `http://localhost:3000`, nhập username TikTok đang live thật để test đầu-cuối.
Biến môi trường:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | 3000 | Cổng nghe (Render cấp qua env) |
| `MAX_ROOMS` | 8 | Số room tối đa cùng lúc |
| `ROOM_IDLE_MINUTES` | 30 | Hủy room sau từng ấy phút không có người xem |

Cập nhật game gốc (khi repo game có bản mới): copy code mới vào
`games/<game>/src/` rồi chạy `npm run build` để sinh lại `engine.js`.

## Deploy lên Render (gói Free)

Chuẩn bị trước: code đã push lên một repo GitHub (riêng, chỉ thư mục này).

1. Đăng nhập [Render](https://render.com) → **New +** → **Web Service** →
   chọn repo GitHub vừa push.
2. Render tự nhận `render.yaml` trong repo (Blueprint): Node, gói **Free**,
   Build Command `npm install`, Start Command `npm start`, Health Check Path
   `/healthz`. Nếu không dùng Blueprint, nhập tay các giá trị đó.
3. Bấm **Create Web Service**, đợi build xong. Render cấp một URL dạng
   `https://live-game-platform.onrender.com`.
4. Kiểm tra: mở `https://<host>/healthz` phải trả `{"ok":true,...}`; mở trang
   chính, tạo thử 1 room, dán link overlay vào TikTok LIVE Studio và test
   trong một buổi live thật.
5. Sau này cập nhật code: push lên GitHub là Render tự deploy lại.

Không cần thẻ tín dụng cho gói Free. Không có biến môi trường bí mật nào cần
đặt — TikTok adapter không dùng key/token.

## Giới hạn đã biết

- **Render free ngủ sau 15 phút không có traffic** (750 giờ/tháng). Trước giờ
  live vài phút, mở dashboard của room một lần để máy tỉnh lại. Lần đầu sau
  khi máy ngủ, overlay có thể mất ~30–60 giây để tải.
- **TikTok không có API LIVE chính thức.** `tiktok-live-connector` đọc feed
  LIVE không chính thức; TikTok có thể đổi phía server bất cứ lúc nào khiến
  kết nối trực tiếp ngừng hoạt động. Khi đó dùng webhook TikFinity làm đường
  dự phòng (`POST /o/<game>/<username>/api/webhook`).
- **Nguồn Link trong TikTok LIVE Studio có thể lag** so với OBS. Nếu cần mượt
  hơn, dùng OBS Virtual Camera đưa overlay vào LIVE Studio.
- **Tối đa ~8 room** cùng lúc trên gói Free (giới hạn RAM). Vượt giới hạn,
  API trả lỗi `ROOM_FULL` và trang chính báo "máy chủ đang đầy".
- **Dữ liệu room không bền vững**: Render free xóa đĩa khi deploy lại hoặc
  khi máy ngủ lâu. Điểm số/phiên của room chỉ sống trong lúc live; sau khi
  room bị hủy (30 phút không có người xem) thì mất. Đây là giới hạn chấp nhận
  được cho game live theo phiên.
- **Buồng Giam** vẫn còn code Streamer.bot (`localhost:8080`) trong engine
  gốc nhưng không bắt buộc — lỗi kết nối được bỏ qua im lặng, game chạy bình
  thường bằng TikTok trực tiếp hoặc webhook.
- Game **Thắp Sáng Bản Đồ** không dùng Socket.io mà dùng SSE; overlay của nó
  không có `io()`.

## Test

```bash
npm test
```

- `adapter.test.js` — 5 loại event TikTok map đúng triggerTypeId/type, avatar
  URL, số xu quà (và không bịa số khi thiếu), bỏ qua quà streak chưa chốt.
- `rooms.test.js` — cô lập room: event room A không lọt sang room B (cả 3 game);
  chuẩn hóa username; giới hạn số room.
- `routes.test.js` — landing, healthz, tạo room, overlay 200 đúng game,
  dashboard, game không tồn tại.
- `webhook.test.js` — tương thích webhook TikFinity cũ (cả 3 game, qua HTTP).
- `socket.test.js` — client Socket.io thật nối đúng path room, nhận
  state-update đúng room, không lọt chéo.
- `smoke.test.js` — khởi động server thật, tải `/` và một URL overlay.

Chưa kiểm chứng được bằng live thật (cần streamer live thật mới test được):
kết nối `tiktok-live-connector` tới một tài khoản đang LIVE, độ trễ event
thực tế, và hành vi khi TikTok đổi phía server.
