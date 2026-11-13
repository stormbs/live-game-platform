# Meme faces — nguồn + bản quyền

Bộ 12 mặt meme dùng làm nhân vật người chơi trong các game LIVE (thay emoji/chữ cái).
Ảnh GỐC (không phải vẽ lại) — Chủ tịch chốt 2026-11-14 00:21: "Dùng đúng ảnh meme
gốc (có rủi ro bản quyền)". CEO đã báo trước rủi ro, Chủ tịch chấp nhận.
**Đa dạng (Chủ tịch 2026-11-14 00:23): mỗi người chơi 1 mặt khác nhau theo hash
tên/uid — KHÔNG phải mọi người chung 1 mặt.** 8 mặt dưới đây, gán bằng
`shared/meme.js` (`MemeFaces.faceFor(player)`).

## Các mặt (curated 512×512, nền trong suốt)

| id | nguồn | ghi chú |
|----|-------|---------|
| trollface | https://foni.papik.pro/uploads/posts/2024-10/foni-papik-pro-1uzf-p-kartinki-troll-feis-na-prozrachnom-fone-27.png | Mặt troll gốc. Nền checkerboard đã cắt bằng flood-fill v2 (dilate viền đen 5px để bịt khe hở rồi mới flood). |
| panda | https://static.four.meme/market/f58f1887-c5d3-4aee-aa48-98f969e576d07783554274588074374.png | Mặt meme "đầu gấu trúc" (熊猫头) kiểu Hà Nhân — mặt tròn trắng, mắt liếc, má hồng, thân đen. File gốc đã có nền trong suốt. |
| forever_alone | https://avatanplus.com/files/resources/mid/5b89753f688bd16590f1ffc4.png | Mặt "Forever Alone" (rage comic). Nền checkerboard đã cắt bằng flood-fill v2. |
| serious | https://www.pngmart.com/files/11/Trollface-Transparent-Background.png | Mặt rage "nghiêm túc/khó chịu" (không phải trollface — file pngmart ghi nhầm tên). File gốc đã có nền trong suốt. |
| rage | https://papik.pro/uploads/posts/2023-01/thumbs/1674348865_papik-pro-p-risunki-ugarnie-33.png | Mặt gào "FFFFFUUUU" (rage comic). Nền checkerboard đã cắt bằng flood-fill v1. |
| me_gusta | https://toppng.com/uploads/preview/me-gusta-meme-render-11550201669b2zs2hittg.png | Me Gusta. Bản talkie-ai bị hở viền (flood lọt vào mặt dù dilate 15px) nên dùng bản toppng này — flood-fill v2 chạy đúng. |
| yuno | https://www.pikpng.com/pngl/m/66-663732_bet-you-think-jarjar-binks-was-a-good.png | Mặt vàng "Y U NO" (mắt trợn, miệng há). File về là JPEG; nền checkerboard đã cắt bằng flood-fill v1 (viền đen dày bịt kín nên không lọt). |
| cereal | https://w7.pngwing.com/pngs/459/136/png-transparent-breakfast-cereal-rage-comic-internet-meme-cereal-guy-miscellaneous-white-food.png | Cereal Guy (ăn ngũ cốc, mặt lạnh). Nền checkerboard đã cắt bằng flood-fill v1. |
| poker | https://www.pngitem.com/pimgs/m/97-974536_rage-comic-poker-face-hd-png-download.png | Poker Face (mặt đơ, 2 mắt chấm + miệng thẳng + cuống cổ). Nền trắng đã cắt bằng flood-fill v2. |
| crying | https://e7.pngegg.com/pngimages/612/296/png-clipart-rage-comic-internet-meme-humour-grumpy-cat-rage-love-white-thumbnail.png | Mặt khóc "crying rage" (nước mắt đỏ, tay che miệng, sticker viền trắng). Nền checkerboard đã cắt bằng flood-fill v2. |
| okay | https://www.kindpng.com/picc/m/97-974772_okay-face-meme-png-transparent-png.png | Okay Guy (mặt cam chịu, shading xám). File gốc có chữ đỏ "Okay" ở góc phải — đã cắt bỏ bằng cách giữ lại component opaque lớn nhất (mặt). Nền đã cắt bằng flood-fill v2. |
| angry | https://www.kindpng.com/picc/b/637-6374287_angry-face-meme-png-transparent-angry-meme-png.png | Mặt giận mắt đỏ, tay với về phía trước. File gốc đã có nền trong suốt thật, dùng nguyên. |

## Xử lý

- `raw/` giữ file gốc tải về + bản đã cắt nền (`*_clean.png`, `*_clean2.png`).
- Flood-fill: từ biên ảnh đi qua pixel sáng; **v1 (không dilate) bị lọt vào mặt**
  ở trollface / forever_alone / me_gusta_a (mặt trắng trong suốt, xem nhầm thành
  đen trên nền tối). **v2: dilate viền đen bằng MinFilter(5) trước khi flood**
  để bịt khe hở viền — sửa được trollface + forever_alone; me_gusta_a vẫn lọt
  (viền hở lớn) nên đổi sang bản toppng.
- `curated/` là ảnh dùng trong game: cắt theo bounding box nội dung, resize vừa
  khung 512×512 (giữ tỉ lệ, padding 8px), nền trong suốt (RGBA). Đã kiểm chứng
  bằng mắt qua contact sheet: cả 8 mặt đều trắng/vàng đặc, không còn nền
  checkerboard, không mặt nào bị đen/trong suốt.
- `curated/manifest.json` (v3) liệt kê 8 mặt + file tương ứng.
- `shared/meme.js` (ngoài thư mục này): `MemeFaces.faceFor(player)` hash
  uid/tên → 1 trong 8 mặt; `faceImg(player, cls)` trả thẻ `<img>`; `faceUrl(id)`.
- `shared/meme.css`: class `.meme-face` (fill khung, object-fit contain,
  drop-shadow nhẹ). Mặt KHÔNG cắt tròn.

## Rủi ro bản quyền (đã báo Chủ tịch, Chủ tịch chấp nhận)

- **Trollface: CÓ BẢN QUYỀN.** Tác giả Carlos Ramirez đăng ký bản quyền Mỹ
  (27/07/2010), đã thu >$100.000 tiền cấp phép và từng DMCA gỡ game "Meme Run"
  khỏi Wii U eShop vì dùng Trollface làm nhân vật chính trong game. Dùng ảnh
  này trong game LIVE có rủi ro bị khiếu nại/gỡ. Chủ tịch đã biết và vẫn chốt
  dùng ảnh gốc.
- **Panda head (熊猫头) / Forever Alone / Serious / Rage / Me Gusta / Y U NO /
  Cereal Guy:** meme template lan truyền rộng, nguồn gốc không rõ một chủ sở
  hữu duy nhất; rủi ro thấp hơn trollface nhưng không phải license sạch
  (không phải CC0/MIT).
- Quy tắc "chỉ dùng asset có license thật" của công ty KHÔNG áp dụng cho bộ
  này theo quyết định riêng của Chủ tịch (2026-11-14 00:21). Không dùng bộ này
  cho các sản phẩm khác khi chưa có quyết định riêng.

## Cách dùng trong game

- Mỗi người chơi được gán 1 mặt theo hash uid/tên (ổn định trong phiên, người
  khác nhau thì mặt khác nhau).
- Mặt hiển thị làm ĐẦU nhân vật (to, rõ) + tên người chơi ngay trên đầu +
  thân đơn giản theo game (màu đội). Xem `docs/meme-characters-2026-11-14.md`.
