# Tích hợp TikHub — Tải video TikTok / Douyin không logo

Dịch vụ: người dùng dán link video TikTok hoặc Douyin vào trang
`/tai-video` trên website Strom -> nhận link tải không watermark + preview.

## 1. Tài liệu TikHub đã dùng (đọc trực tiếp)

- Spec OpenAPI V5.3.2 (2026-06-22): https://api.tikhub.io/openapi.json
- Swagger: https://api.tikhub.io/docs
- Văn bản (HTTP status, auth): https://docs.tikhub.io
- Base URL: `https://api.tikhub.io`
- Auth: header `Authorization: Bearer <token>`
- Giới hạn mặc định: 10 request/giây. Tính phí theo lượt gọi, từ $0,001/lượt
  (xem mục 5).

## 2. Endpoint đã chọn (đều nhận thẳng `share_url`)

| Nền tảng | Endpoint | Ghi chú |
|---|---|---|
| TikTok | `GET /api/v1/tiktok/app/v3/fetch_one_video_by_share_url?share_url=<url>` | App V3 được TikHub khuyên dùng vì ổn định nhất |
| Douyin | `GET /api/v1/douyin/app/v3/fetch_one_video_by_share_url?share_url=<url>` | Thử trước; rỗng thì fallback Web bên dưới |
| Douyin (fallback) | `GET /api/v1/douyin/web/fetch_one_video_by_share_url?share_url=<url>` | Chất lượng cao hơn, ít trường hơn |

Link không watermark: trường `downloadAddr` trong video-detail (theo FAQ
TikHub). Code ưu tiên `download_addr.url_list[0]`, rồi mới tới
`play_addr.url_list[0]`. Link App tải trực tiếp không cần cookie; link Web
cần cookie `tt_chain_token` và hết hạn sau ~24h (gặp 403 thì gọi lại).

## 3. Gắn route vào server (CEO làm — file mới đã xong, chỉ thiếu bước này)

Trong `server.js` (đừng sửa các phần khác):

```js
// Dòng require — đặt cạnh dòng require buff-routes (dòng ~23):
const { mountTikHubRoutes } = require('./lib/tikhub-routes');
```

```js
// Dòng mount — đặt ngay sau mountBuffRoutes(app); (dòng ~62):
mountTikHubRoutes(app);
```

Không cần sửa gì khác: `lib/tikhub.js` tự đọc key từ biến môi trường,
route tự chặn spam 10 request/phút/IP.

## 4. Biến môi trường trên Railway

| Biến | Giá trị | Cách đặt |
|---|---|---|
| `TIKHUB_API_KEY` | Key TikHub do Chủ tịch cung cấp 2026-11-12 | Railway dashboard -> service live-game-platform -> Variables -> Add `TIKHUB_API_KEY` (KHÔNG ghi key vào file/code/log nào) |

Thiếu key: `GET /api/download/health` trả 503, `POST /api/download` trả 503
`NOT_CONFIGURED` với thông báo thân thiện (không lộ chi tiết key).

## 5. Chi phí + giới hạn (theo tài liệu TikHub)

- Tính phí theo lượt gọi: từ $0,001/lượt gọi endpoint thường. 1 lượt tải
  video TikTok = 1 lượt gọi; Douyin = 1 lượt nếu App V3 có kết quả,
  2 lượt nếu phải fallback sang Web.
- KHÔNG dùng endpoint `fetch_video_high_quality_play_url` ($0,005/lượt) —
  chỉ lấy link chuẩn từ video-detail, đủ cho nhu cầu tải thường.
- Chỉ video công khai mới tải được. Video riêng tư / chỉ một số người xem /
  đã xóa / hạn chế bản quyền: TikHub trả HTTP 200 kèm `filter_detail`
  (Douyin: `filter_list[0].reason` 8 = không tồn tại hoặc hạn chế bản quyền,
  5 = riêng tư, 10 = chỉ một số người xem) — và VẪN TÍNH PHÍ lượt gọi đó.
- Video album ảnh (slideshow) không có `download_addr` dạng video — code
  trả `VIDEO_NOT_FOUND`; nếu sau này cần hỗ trợ album thì map thêm trường
  ảnh trong `mapAweme()`.
- Link tải hết hạn sau ~24h: nếu người dùng bấm tải mà gặp 403, hướng dẫn
  họ dán lại link để lấy link mới (trang web đã ghi chú này).
- Douyin: tài khoản Blue V (doanh nghiệp) và video chạy quảng cáo (DOU+)
  không lấy được link chất lượng gốc qua endpoint high-quality — không ảnh
  hưởng endpoint thường đang dùng.

## 6. API của Strom (sau khi gắn route)

- `GET /api/download/health` -> `{ok: true, configured: true}` khi có key;
  503 `{ok: false, configured: false}` khi chưa có key.
- `POST /api/download` body `{url}` -> 200:
  `{ok, platform, video_id, video_url, cover, music_url, music_title,
  title, duration, author: {nickname, unique_id, avatar}}`
- Lỗi: 400 `INVALID_URL` / `UNSUPPORTED_URL`, 404 `VIDEO_NOT_FOUND` /
  `VIDEO_PRIVATE` / `VIDEO_PARTIAL`, 429 `RATE_LIMITED` (quá 10/phút/IP),
  503 `NOT_CONFIGURED` / `INVALID_API_KEY` / `INSUFFICIENT_BALANCE`,
  502 `UPSTREAM_ERROR` / `UPSTREAM_UNAVAILABLE`, 504 `TIMEOUT` (15s).

## 7. Kiểm chứng sau khi gắn route + đặt key (CEO làm)

1. `curl https://live-game-platform-production.up.railway.app/api/download/health`
   -> 200 `{ok: true, configured: true}`.
2. `curl -X POST .../api/download -H 'Content-Type: application/json' -d '{"url":"<link TikTok công khai>"}'`
   -> 200, `video_url` mở được trong trình duyệt, tải về không có logo.
3. Thử link Douyin `https://v.douyin.com/...` -> 200.
4. Thử link Youtube -> 400 `UNSUPPORTED_URL`; thử link video đã xóa ->
   404 `VIDEO_NOT_FOUND`.
5. Mở trang `/tai-video` trên web, dán link, kiểm tra preview + nút tải.

## 8. Cấu trúc response — lưu ý kiểm chứng

TikHub chỉ ghi tài liệu endpoint + tham số, không ghi chi tiết từng key
trong payload (FAQ: "responses are large and vary per platform"). Mapper
trong `lib/tikhub.js` (`findAweme` + `mapAweme`) đã thử nhiều dạng
(`aweme_detail` / `aweme_list[0]` / `item` / `data` trực tiếp) và nhiều
trường URL (`download_addr` rồi mới `play_addr`). Nếu bước kiểm chứng 7
cho thấy trường nào lệch (ví dụ TikHub đổi tên key), sửa đúng chỗ đó trong
`mapAweme()`, không đổi endpoint hay luồng gọi. Test giả lập ở
`test/tikhub.test.js` (21 test) dùng đúng dạng fixture này — cập nhật
fixture theo response thật nếu cần.
