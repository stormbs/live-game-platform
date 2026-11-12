# Dịch vụ Buff tương tác (mạng xã hội) — Tài liệu vận hành

Nền tảng gọi API panel **bufflikenhanh.com** (SMM API chuẩn) để chạy đơn,
khách trả bằng **USDT (BEP20)** qua ví của phòng kế toán. Chatbot trên website
tư vấn và đặt đơn qua API của nền tảng (`/api/buff/*`) — không bao giờ gọi
thẳng panel từ trình duyệt, không lộ API token.

## Quy tắc tính giá (Chủ tịch chốt 2026-11-12)

Tiêu chí phân loại **duy nhất**: đơn giá gốc của panel (`rate`, VND / 1000 đơn vị).

| Nhóm | Điều kiện | Hệ số bán |
|---|---|---|
| Dịch vụ **ĐẮT** | `rate >= 100.000 VND / 1000` | gốc × **1,20** (lãi 20%) |
| Dịch vụ **RẺ** | `rate < 100.000 VND / 1000` | gốc × **1,40** (lãi 40%, mặc định trong khoảng 30–50%) |

- Tỷ giá đổi VND -> USDT: `VND_PER_USDT = 26.000` (hằng số duy nhất).
- Giá bán làm tròn **lên** 4 chữ số thập phân (không bao giờ bán dưới vốn).
- Tài chính chỉ chỉnh 4 hằng số trong `lib/buff.js`:
  `VND_PER_USDT`, `EXPENSIVE_RATE_THRESHOLD_VND`, `MARKUP_EXPENSIVE`,
  `MARKUP_CHEAP`. Không hard-code hệ số ở chỗ khác.

Ví dụ (giá panel ngày 2026-11-12, tỷ giá 26.000):

| Dịch vụ | Nhóm | Giá gốc /1000 | Giá bán /1000 |
|---|---|---|---|
| TikTok View (id 513) | Rẻ ×1,40 | 2,2692 USDT | **3,1770 USDT** |
| Facebook Like (id 444) | Rẻ ×1,40 | 1,3077 USDT | **1,8308 USDT** |
| Instagram Share (id 2793) | Rẻ ×1,40 | 0,0026 USDT | **0,0037 USDT** |
| X View (id 5952) | Rẻ ×1,40 | 0,1654 USDT | **0,2316 USDT** |
| YouTube Like (id 732) | Đắt ×1,20 | 17,3077 USDT | **20,7693 USDT** |
| Shopee (id 5446) | Đắt ×1,20 | 6,8846 USDT | **8,2616 USDT** |
| LinkedIn Follow (id 41735) | Đắt ×1,20 | 24,1923 USDT | **29,0308 USDT** |

Catalog ngày 2026-11-12: **857 dịch vụ** (toàn bộ đang bật), 62 chuyên mục,
11 nền tảng: Facebook 407, TikTok 140, YouTube 133, Instagram 80, Shopee 28,
X 19, Telegram 7, Threads 23, LinkedIn 4, Traffic & SEO 15, Google 1.
Snapshot: `data/buff/catalog.json` (tự làm mới mỗi 6 giờ khi có `BUFF_API_KEY`).

## Luồng tiền

1. **Nạp tiền**: khách chuyển USDT (BEP20) tới ví kế toán
   `0x1104DB8596dF727FB21a1a5a5A19cc540067720c`, dán mã giao dịch (tx hash)
   + số USDT vào chatbot. Backend xác minh giao dịch trên BSC qua RPC công
   khai (receipt thành công + log Transfer USDT về đúng ví) rồi cộng ví.
   Một mã giao dịch chỉ cộng được 1 lần.
2. **Mua đơn**: chatbot báo giá -> kiểm tra **số dư panel trước** -> trừ ví
   khách -> đặt đơn lên panel -> lưu đơn. Panel thiếu tiền thì **không trừ
   ví**, đồng thời gửi cảnh báo Telegram cho Chủ tịch. Panel nhận đơn lỗi
   sau khi trừ -> **hoàn tiền tự động** vào ví.
3. **Theo dõi đơn**: chatbot "Xem đơn của tôi" + đồng bộ trạng thái từ panel.

## An toàn số dư (backend không có service_role key)

- `wallets`: RLS chỉ cho SELECT ví của mình; không sửa trực tiếp được.
- Trừ tiền qua hàm `SECURITY DEFINER deduct_wallet` (kiểm tra số dư, khóa
  hàng, ghi transaction).
- Cộng tiền nạp qua `credit_wallet` + chữ ký HMAC-SHA256 (bí mật chung
  `BUFF_RPC_SECRET`, xem mục setup). Khách không tự gọi RPC để cộng tiền.
- Xem chi tiết trong `supabase/buff-schema.sql`.

## Setup (main agent / Chủ tịch làm tay)

### 1. Áp SQL
Supabase Dashboard -> SQL Editor -> chạy `supabase/buff-schema.sql` (1 lần).

### 2. Bí mật RPC (bắt buộc để nạp tiền chạy được)
```sh
openssl rand -hex 32   # -> <SECRET>
```
- SQL Editor: `insert into public.buff_settings(key, value) values ('rpc_secret', '<SECRET>') on conflict (key) do update set value = excluded.value;`
- Railway (project unique-empathy -> service live-game-platform -> Variables):
  `BUFF_RPC_SECRET=<SECRET>` (cùng chuỗi với SQL).

### 3. Biến môi trường Railway (service live-game-platform)
| Biến | Giá trị | Ghi chú |
|---|---|---|
| `BUFF_API_KEY` | token API bufflikenhanh.com (Chủ tịch đã giao, **không ghi vào file/code**) | Bắt buộc: không có thì API buff trả lỗi `PANEL_NO_KEY`, catalog không tự làm mới, watchdog không chạy. |
| `BUFF_RPC_SECRET` | chuỗi bí mật chung với SQL (mục 2) | Bắt buộc cho nạp tiền (chế độ RPC). |
| `TELEGRAM_ALERT_CHAT_ID` | (mặc định `1617048347` — chat Chủ tịch) | Tùy chọn. |
| `TELEGRAM_ALERTS_ENABLED` | `false` để tắt cảnh báo | Tùy chọn. |
| `SUPABASE_SERVICE_KEY` | service_role key (lấy trong Supabase Dashboard) | Tùy chọn: có thì backend dùng chế độ đặc quyền (không cần RPC secret cho nạp tiền). Không có vẫn chạy chế độ RPC. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | mặc định đã đúng project cong-ty-agent | Tùy chọn. |

### 4. Nạp tiền panel (quan trọng)
Số dư panel ngày 2026-11-12 chỉ còn **1.824,5256 VND** (~0,07 USDT) — gần như
cạn. Phải nạp tiền vào tài khoản bufflikenhanh thì mới chạy được đơn cho
khách. Ngưỡng cảnh báo Telegram: dưới **500.000 VND** (hằng
`PANEL_LOW_BALANCE_VND` trong `lib/buff.js`); watchdog kiểm tra mỗi 15 phút
và trước mỗi đơn, tối đa 1 cảnh báo/giờ cho mỗi loại.

## API nội bộ (Railway)

| Route | Auth | Mô tả |
|---|---|---|
| `GET /api/buff/services` | không | Danh sách dịch vụ (cache) |
| `GET /api/buff/platforms` | không | Nền tảng -> chuyên mục |
| `GET /api/buff/config` | không | Ví nạp, tỷ giá, hệ số lãi |
| `POST /api/buff/quote` | không | Báo giá `{service_id, quantity}` |
| `GET /api/buff/wallet` | JWT khách | Số dư USDT |
| `POST /api/buff/order` | JWT khách | Đặt đơn |
| `GET /api/buff/orders` | JWT khách | Đơn của khách |
| `GET /api/buff/order/:id/status` | JWT khách | Đồng bộ trạng thái từ panel |
| `POST /api/buff/topup` | JWT khách | Nạp USDT bằng tx hash |

## Kiểm thử

`npm test` — gồm test tính giá (2 nhóm lãi, ngưỡng, làm tròn), xác minh
giao dịch BSC (mock RPC), route public (catalog cache, báo giá) và luồng đặt
đơn/nạp tiền với store + panel giả (đủ tiền / hết tiền ví / panel hết tiền /
panel lỗi -> hoàn tiền). Không đặt đơn thật, không gọi panel thật trong test.

## Hạn chế đã biết

- Panel balance gần cạn (xem mục 4) — nạp tiền panel trước khi mở bán.
- `BUFF_API_KEY` và `BUFF_RPC_SECRET` chưa được đặt trên Railway (subagent
  không có quyền Railway CLI) — main agent đặt theo bảng mục 3.
- SQL chưa được áp dụng lên Supabase (cần main agent chạy tay).
- Xác minh nạp tiền dùng RPC công khai của BSC (không cần API key BscScan);
  nếu RPC chậm, chatbot báo thử lại sau.
