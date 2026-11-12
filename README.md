# Live Game TikTok — Nền tảng host tập trung (kiểu Livecade)

Một service Node duy nhất host 3 game TikTok LIVE: **Vẽ Avatar**, **Buồng Giam**,
**Thắp Sáng Bản Đồ Việt Nam**. Streamer chỉ cần nhập TikTok ID, chọn game, copy
link overlay và dán vào TikTok LIVE Studio là chạy — không cần cài đặt gì thêm.

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
- Trạng thái `offline` bao gồm cả lỗi "Failed to retrieve Room ID from all
  sources" (tài khoản không live thì không có room để lấy) và thông báo
  "The requested user isn't online" của thư viện — cả hai đều nghĩa là chưa
  live, không phải lỗi hệ thống.
- **Khóa ký Euler (`EULER_API_KEY`):** websocket của TikTok cần ký URL qua máy
  chủ ký của Euler Stream. Không có key, Euler chặn ký ẩn danh ("This endpoint
  requires a Business plan") nên KHÔNG tài khoản live nào nối được — adapter
  vẫn kiểm tra được live/offline nhưng không vào được phòng live. Đăng ký tài
  khoản miễn phí tại eulerstream.com, lấy API key, đặt biến môi trường
  `EULER_API_KEY` trên máy chủ (Railway → Variables). Adapter đọc key này qua
  `signApiKey` của `TikTokLiveConnection`; không có key vẫn chạy nhưng chỉ
  báo trạng thái, không nhận event live.

### Intake nội bộ `/api/webhook` (không phải setup cho người dùng)

Adapter TikTok đẩy event vào engine qua `POST /o/<game>/<username>/api/webhook`
nội bộ, body JSON dạng `triggerTypeId` (gift=3, like=7, share=8, chat=11,
follow=1, join=6). Đây là đường đi nội bộ của nền tảng — người dùng không cần
cài đặt, không cần biết tới endpoint này. Mọi engine phải đếm event qua intake
này vào `state.webhook.count` để dashboard hiển thị "số sự kiện đã nhận".

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
| `EULER_API_KEY` | _(trống)_ | API key Euler Stream (miễn phí) để ký websocket TikTok LIVE — bắt buộc để nhận event live thật (xem mục Adapter) |

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

Không cần thẻ tín dụng cho gói Free. Biến môi trường duy nhất nên đặt là
`EULER_API_KEY` (xem bảng trên) — không có key thì adapter không nối được
phòng live nào.

## Giới hạn đã biết

- **Render free ngủ sau 15 phút không có traffic** (750 giờ/tháng). Trước giờ
  live vài phút, mở dashboard của room một lần để máy tỉnh lại. Lần đầu sau
  khi máy ngủ, overlay có thể mất ~30–60 giây để tải.
- **TikTok không có API LIVE chính thức.** `tiktok-live-connector` đọc feed
  LIVE không chính thức; TikTok có thể đổi phía server bất cứ lúc nào khiến
  kết nối trực tiếp ngừng hoạt động. Chữ ký websocket đi qua máy chủ ký của
  Euler Stream — nếu Euler đổi chính sách (vd. chặn ký ẩn danh như đã gặp
  ngày 2026-11-12), cần API key Euler hoặc đổi backend ký khác.
- **Nguồn Link trong TikTok LIVE Studio có thể lag** so với OBS. Nếu cần mượt
  hơn, dùng OBS Virtual Camera đưa overlay vào LIVE Studio.
- **Tối đa ~8 room** cùng lúc trên gói Free (giới hạn RAM). Vượt giới hạn,
  API trả lỗi `ROOM_FULL` và trang chính báo "máy chủ đang đầy".
- **Dữ liệu room không bền vững**: Render free xóa đĩa khi deploy lại hoặc
  khi máy ngủ lâu. Điểm số/phiên của room chỉ sống trong lúc live; sau khi
  room bị hủy (30 phút không có người xem) thì mất. Đây là giới hạn chấp nhận
  được cho game live theo phiên.
- **Buồng Giam** vẫn còn code cầu nối desktop cũ (`localhost:8080`) trong engine
  gốc nhưng không bắt buộc — lỗi kết nối được bỏ qua im lặng, game chạy bình
  thường bằng TikTok trực tiếp.
- Game **Thắp Sáng Bản Đồ** không dùng Socket.io mà dùng SSE; overlay của nó
  không có `io()`.

## Thêm game mới

Luật cứng cho mọi game mới thêm vào nền tảng (và cho mọi sửa đổi game cũ):

1. **Không nhắc tới phần mềm trung gian cũ** (cầu nối/webhook bên ngoài) trong
   bất kỳ dashboard, overlay, trang chính hay docs nào — người dùng chỉ cần
   dán link overlay vào TikTok LIVE Studio và Go LIVE.
2. **Trạng thái kết nối chỉ lấy từ** `GET /api/rooms/<game>/<username>/status`
   (trả `{ tiktok: { state, detail } }`, state: `connecting` / `live` /
   `offline` / `reconnecting` / `error`). Dashboard/overlay tự suy game +
   username từ `location.pathname` (`/room/<game>/<username>/...` hoặc
   `/o/<game>/<username>/...`), ghép URL bằng `['', 'api', 'rooms', game,
   username, 'status'].join('/')` để `transform.js` không viết lại thành
   `<prefix>/api/...`.
3. **Event vào engine qua intake nội bộ** `POST /api/webhook` do adapter
   nền tảng đẩy — engine phải đếm chúng vào `state.webhook.count` như game
   bản đồ đã làm, để dashboard hiển thị "số sự kiện đã nhận".
4. **Link overlay luôn là** `/o/<game>/<username>`; dashboard luôn là
   `/room/<game>/<username>`. Không hardcode `localhost` hay cổng trong
   copy hiển thị cho người dùng.
5. **Khi room `offline` (tài khoản chưa live), overlay và dashboard phải hiện
   cảnh báo rõ ràng ngay trên màn hình** ("Tài khoản @X chưa LIVE — kiểm tra
   lại username trong link, hoặc Go LIVE rồi tải lại"), để test sai nick là
   thấy ngay.

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
- `webhook.test.js` — intake `/api/webhook` nội bộ (cả 3 game, qua HTTP).
- `no-tikfinity.test.js` — không file dashboard/landing HTML nào còn nhắc tới
  phần mềm trung gian cũ (quét `games/*/src/public/*.html`,
  `games/*/src/*.html`, `public/landing.html`).
- `socket.test.js` — client Socket.io thật nối đúng path room, nhận
  state-update đúng room, không lọt chéo.
- `smoke.test.js` — khởi động server thật, tải `/` và một URL overlay.

Chưa kiểm chứng được bằng live thật (cần streamer live thật mới test được):
kết nối `tiktok-live-connector` tới một tài khoản đang LIVE, độ trễ event
thực tế, và hành vi khi TikTok đổi phía server.
