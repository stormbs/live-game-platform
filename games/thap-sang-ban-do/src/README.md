# 🗺️ Thắp Sáng Bản Đồ Việt Nam — TikTok LIVE game

Game tương tác đang trend trên TikTok LIVE: người xem **comment tên quê để
thắp sáng tỉnh đó** trên bản đồ Việt Nam, avatar của họ **rơi xuống đúng vị
trí tỉnh quê**, rồi mọi tương tác sau đó đều cộng điểm cho tỉnh quê của mình.
Tỉnh nào đông người + nhiều quà thì leo lên **bảng xếp hạng tỉnh**.

Bản đồ dùng **ranh giới thật của 34 tỉnh/thành sau sáp nhập 1/7/2025**
(28 tỉnh + 6 thành phố trực thuộc trung ương). Số thứ tự 1–34 xếp theo tên
tỉnh (A–Z, không dấu). Có khung riêng cho **quần đảo Hoàng Sa** (sáng cùng
Đà Nẵng) và **quần đảo Trường Sa** (sáng cùng Khánh Hòa) — hình đảo thật từ
GeoJSON, không phải chấm tròn vẽ tay.

**Comment nhận dạng rất thoáng:** có dấu hay không dấu đều tính ("hà nội",
"ha noi"), **viết liền cũng tính** ("hanoi", "saigon", "dalat", "nhatrang",
"tphcm"), viết tắt ("hn", "sg", "bmt"), tên tỉnh cũ ("bình dương" →
TP.HCM, "nam định" → Ninh Bình), tên thành phố ("đà lạt" → Lâm Đồng) và
số thứ tự ("12", "#12"). Tối đa 3 tỉnh/comment.

## Chạy trên máy Windows

Yêu cầu: đã cài **Node.js** (bản LTS, tải tại nodejs.org).

1. Giải nén zip này ra 1 thư mục, ví dụ `C:\thap-sang-ban-do\`.
2. Chạy `start.bat` (hoặc `node server.js` trong terminal). Giữ cửa sổ này mở
   suốt buổi live.
3. Mở trình duyệt:
   - Overlay: `http://localhost:3009/`
   - Dashboard: `http://localhost:3009/dashboard`

## Kết nối trực tiếp (nền tảng tự nối)

Trên nền tảng tập trung, máy chủ tự kết nối vào LIVE bằng TikTok ID trong
link overlay — không cần cài thêm gì. Các loại event nhận được:

| Event | Ghi chú |
|---|---|
| Join | Vào xem |
| Chat | Comment thắp tỉnh / chọn quê |
| Gift (1+ xu) | Tặng quà cộng điểm cho tỉnh quê |
| Tap / Like (1+) | Tim cộng điểm cho tỉnh quê |
| Follow | Follow thắp 1 tỉnh |

Thứ tự khi live: **mở dashboard → mở OBS/TikTok LIVE Studio → Go LIVE**.
Máy chủ tự kết nối trong tối đa 1 phút. Kiểm tra lại TikTok ID trong link:
nhập sai nick là máy chủ theo dõi nhầm tài khoản.

## Đưa vào TikTok LIVE Studio

Link overlay (chạy trên máy Windows của bạn, sau khi chạy `start.bat`):

**`http://localhost:3009/overlay.html`**

1. Trong LIVE Studio: bấm **+ Thêm nguồn → Link** (nguồn trang web).
2. Dán link trên vào ô URL. Đặt **độ phân giải tùy chỉnh 1080 x 1920**
   (không để mặc định 800x600).
3. Kéo cho nguồn vừa đúng khung dọc 9:16 — chọn **Fit**, đừng chọn Stretch
   kẻo hình bị kéo dài. Overlay tự thu gọn vừa đúng 1 khung hình ở mọi kích
   thước cửa sổ.
4. Bật âm thanh của nguồn (để nghe voice + nhạc nền), tích **giữ trạng thái
   hoạt động** nếu có.
5. ⚠️ Nếu LIVE Studio báo "Enter correct URL": phải gõ đủ
   `http://localhost:3009/overlay.html` (có `/overlay.html` ở cuối).
   Link cũng hiện sẵn trong Dashboard (có nút Sao chép).

## Đưa vào OBS (nếu dùng OBS + Virtual Camera)

Thêm nguồn **Browser Source**: URL `http://localhost:3009/overlay.html`,
kích thước **1080 x 1920**, tick **Control audio via OBS**. Nếu mới mở mà
chưa nghe tiếng: bấm 1 lần vào khung preview của source (Interact) để mở
khóa audio.

## Luật chơi — bảng xếp hạng tính theo tỉnh

(Mặc định, chỉnh trong Dashboard → Luật chơi.)

| Người xem làm gì | Kết quả |
|---|---|
| Comment tên tỉnh, số 1–34, viết tắt, tên thành phố | Thắp tỉnh đó + **+1 điểm cho tỉnh quê của mình**. Comment đầu tiên chọn quê — avatar rơi xuống vị trí tỉnh đó |
| Comment tỉnh khác sau đó | **CHỐNG SPAM CỨNG (v7.4, thay luật v7.3 đổi quê không giới hạn):** mỗi người trong 1 ván chỉ được **đổi quê tối đa 1 lần** (mặc định, chỉnh được ở Dashboard → Luật chơi). Comment tỉnh khác dùng 1 lượt đổi → avatar bay sang tỉnh mới, điểm +1 và điểm tap/quà sau đó tính cho quê mới. Hết lượt rồi thì comment tỉnh khác **không thắp sáng cũng không cộng điểm** — chỉ comment đúng tỉnh quê hiện tại mới tính (vẫn +1đ, vẫn farm mốc). Ván mới reset lại lượt đổi |
| Comment tên tỉnh **cũ** (63 tỉnh) | Vẫn sáng tỉnh mới đã sáp nhập (vd. `Bình Dương` → TP.HCM, `Nam Định` → Ninh Bình, `Phú Quốc` → An Giang) — voice giải thích luôn trên live |
| Thả tim | **20 tim = +1 điểm** cho tỉnh quê của mình (chưa chọn quê thì tim chưa tính điểm) |
| Tặng quà | **1 xu = +5 điểm** cho tỉnh quê của mình; đồng thời thắp ngẫu nhiên tỉnh chưa sáng: <10 xu = 1 tỉnh, 10–99 xu = 2 tỉnh, ≥100 xu = 3 tỉnh. **Quà không tự gán quê (v7.7):** chưa comment quê thì điểm giữ lại, comment chọn quê sau sẽ nhận đủ — tỉnh thắp ngẫu nhiên không bao giờ thành quê của bạn |
| Follow mới | Thắp ngẫu nhiên 1 tỉnh chưa sáng |
| Sáng đủ 34/34 | 🎉 Pháo hoa + vinh danh người thắp nhiều nhất, tự chơi lại sau 60 giây |

Chống spam: mỗi người chỉ tính 1 comment thắp tỉnh / 5 giây.

Ví dụ comment hợp lệ: `Hà Nội`, `ha noi`, `hn`, `12`, `#12`, `sài gòn`,
`Đà Lạt` (→ Lâm Đồng), `Nha Trang` (→ Khánh Hòa), `Phú Quốc` (→ An Giang),
`Hội An` (→ Đà Nẵng), `cho mình đà nẵng nhé` (cả câu có tên tỉnh vẫn nhận).

**Avatar — ảnh đại diện thật của người comment:** adapter trực tiếp lấy kèm link
ảnh đại diện của viewer trong mỗi event — dạng JSON là field
`profilePictureUrl`, dạng form-urlencoded là field `avatar_url` (dạng
`https://p16-sign-*.tiktokcdn.com/...`). Khi ai comment tên tỉnh, ảnh thật
của người đó **rơi xuống đúng vị trí tỉnh vừa comment** (hình tròn viền vàng
+ tên bên dưới). Comment tỉnh khác thì ảnh bay sang tỉnh mới (overlay có
sẵn hiệu ứng trượt 0.6s + rơi lại).
Server đã đọc được đủ các dạng field avatar mà adapter có thể gửi
(`profilePictureUrl`, `avatar_url`, `user.profilePictureUrl`,
`userDetails.profilePictureUrls`, cả dạng viết tắt) — đã test cả 4 dạng.
Chỉ khi nào event thiếu hẳn avatar thì overlay mới vẽ vòng tròn chữ cái
đầu tên làm dự phòng, và khi đó không tự bịa ảnh của ai khác.
Mỗi tỉnh hiện tối đa 12 avatar, đông hơn thì gom lại thành badge `+N`.
Lưu ý: link ảnh TikTok có hạn dùng, nếu ảnh cũ quá không tải được thì
overlay tự hiện chữ cái thay thế.

## Độ dày 3D theo điểm tỉnh (5 nấc)

Bản đồ **3D**: mỗi tỉnh là 1 khối nổi — mặt trên vàng + mặt hông tối. Tỉnh
càng nhiều điểm thì khối càng **DÀY** (mặt trên dâng cao hơn), không đổi màu
theo điểm nữa:

- **Chưa sáng: phẳng** (mặt tối, không nổi)
- **1–5 điểm: dày 5** — hơi nổi
- **6–10 điểm: dày 9**
- **11–19 điểm: dày 14**
- **20 điểm trở lên: dày 19** (nổi cao rõ rệt)
- **Top 1–3 VÀ từ 20 điểm trở lên: dày 25** (cao nhất + viền sáng nhấp nháy)

Avatar, số thứ tự, vương miện đều đứng trên mặt trên của khối (tỉnh càng dày
thì avatar càng cao). Hoàng Sa / Trường Sa cũng nổi theo đúng độ dày của tỉnh
chủ quản (Đà Nẵng / Khánh Hòa). Mốc điểm 50/100/200 (thông báo + voice +
vòng tím) là cơ chế riêng, vẫn giữ nguyên.

## Sửa 3 lỗi v6 (2026-11-12, từ ảnh live thật)

1. **"Chưa sáng hết đã báo":** thực ra 34/34 đã sáng đủ, nhưng màn ăn mừng
   che gần hết bản đồ bằng nền tối 88% nên trông như còn tỉnh tối — đã sửa:
   màn ăn mừng giờ nền trong suốt, chỉ phần chữ nằm trong thẻ tối, bản đồ
   vàng hiện rõ phía sau + pháo giấy. Thêm 2 lỗi nhỏ cùng họ: tỉnh may mắn
   trước đây tô tím đè cả màu vàng của tỉnh đã sáng (giờ chỉ viền tím, không
   đè màu) và viền tím còn hiện cả lúc ăn mừng (giờ chỉ hiện lúc đang chơi).
2. **Voice đọc cả tên + đọc chọn lọc:** xem mục Voice ở trên.
3. **Điểm tap bị phồng:** TikTok gửi `likeCount` là TỔNG TÍCH LŨY của
   người đó từ đầu live, code cũ cộng trực tiếp nên 1000 tap thật thành
   500.500 tap (vd. Huế 30078 điểm với tổng chỉ 2728 xu). Đã sửa: server
   chỉ cộng phần TĂNG THÊM so với lần trước của chính người đó.

## Voice đọc (file TTS sẵn + đọc tên)

Voice **đọc cả tên người xem** khi thắp tỉnh lần đầu ("Lan đã thắp sáng Hà
Nội, thủ đô ngàn năm văn hiến!"). Câu có tên được server tổng hợp riêng
bằng giọng tiếng Việt (Google TTS, cùng giọng với các clip sẵn) rồi cache
lại trong `public/voice/cache/` — câu giống nhau không tổng hợp lại, lỗi
mạng thì voice đọc clip sẵn (không tên) để không kẹt hàng đợi. Cần mạng để
tổng hợp tên.

**Đọc chọn lọc khi nhiều comment cùng lúc:** thông báo trên MÀN HÌNH vẫn
đầy đủ mọi sự kiện, còn VOICE chỉ đọc tối đa 3 câu chờ, xếp theo ưu tiên:
**1 = tỉnh lần đầu được thắp** (đọc tên) → 2 = mốc điểm / vinh danh → 3 =
ván mới → 4 = cảm ơn quà/follow / tỉnh đã sáng. Câu ưu tiên thấp bị bỏ khi
hàng đợi đầy; không cắt ngang câu đang đọc dở, nghỉ 400ms giữa 2 câu nên
không bị vấp.

**Voice mốc điểm:** khi 1 tỉnh chạm mốc 50/100/200, voice đọc rõ tên tỉnh +
mốc điểm, vd. **"Tỉnh Hà Nội đã đạt mốc điểm 50!"**, **"Thành phố Hồ Chí
Minh đã đạt mốc điểm 100!"** (6 thành phố trực thuộc trung ương đọc là
"Thành phố", còn lại đọc là "Tỉnh"). Câu này được server tổng hợp riêng
bằng Google TTS (cùng giọng với các clip sẵn) rồi cache lại; lỗi mạng thì
đọc clip dự phòng chung (không tên tỉnh) để không kẹt hàng đợi.

Câu cố định dùng file TTS sẵn trong `public/voice/` (70 file: 34 tỉnh + 30
tên tỉnh cũ + 6 câu cố định). Khi voice đọc, nhạc nền tự nhỏ xuống 10% rồi
to lại. Bật/tắt + âm lượng voice + nút **Thử giọng** ở Dashboard. Muốn tạo
lại file voice: chạy `python3 gen-voice-gtts.py`.

**Bật tiếng cho voice + nhạc (quan trọng):** trình duyệt trong TikTok LIVE
Studio **khóa âm thanh cho tới khi host chạm 1 lần vào trang** — nếu không
làm bước này thì voice + nhạc đều im (dù hàng đợi vẫn chạy). Cách bật: trong
LIVE Studio, bấm chuột phải vào nguồn Link → **Interact (Tương tác)** → nhấn
1 lần vào khung overlay. Từ v7.3, khi audio đang bị khóa thì dòng voice dưới
bản đồ hiện **\"🔇 Voice đang bị khóa — nhấn vào màn hình 1 lần để bật
tiếng\"** để host biết; hàng đợi voice được GIỮ NGUYÊN trong lúc chờ (trước
đây mỗi clip bị từ chối là nhảy sang clip sau, cả hàng đợi bị đốt sạch mà
không tiếng nào kịp phát). Sau 1 lần nhấn, voice đọc tiếp từ câu đang dở,
không mất câu nào. Nhạc nền cũng tự bật theo sau lần nhấn đó. Nút **Thử
giọng** trong Dashboard chỉ thử được tiếng ở trang Dashboard (vì bạn đã nhấn
chuột ở đó) — không mở khóa được tiếng của overlay trong LIVE Studio.

**Bộ lọc từ:** tên người xem chứa link / spam / chửi thề thì hiện và đọc là
**"Bạn"**, không hiện tên gốc lên overlay hay voice (danh sách lọc trong
`server.js`, cùng bộ với Teddy `moderation.js`, chạy trên văn bản đã bỏ dấu
+ chống leetspeak, cẩn thận không chặn nhầm từ lành như "các", "đeo").

## Hiệu ứng zoom (phóng to / thu nhỏ)

Mỗi khi có tỉnh vừa thắp sáng, camera **bay tới phóng to tỉnh đó**, giữ
khoảng 2 giây rồi **thu nhỏ về toàn cảnh**. Không zoom lúc đang ăn mừng
sáng đủ 34/34. Tỉnh nhỏ (như Hà Nội) zoom vừa phải, không zoom quá sát.

## 🎵 Nhạc nền (playlist quê hương)

Overlay phát nhạc nền vòng lặp, tên bài hiện ở góc trên màn hình:

- 2 track mặc định: **Quê Hương Xanh** (80 giây) và **Đất Nước Mến Yêu**
  (90 giây) — nhạc hộp nhẹ tự tạo trong code (ngũ cung, không bản quyền).
- Muốn dùng bài hát thật: thả file **.mp3** vào thư mục `public/music/`
  rồi khởi động lại server — bài mới tự vào playlist.
- Điều khiển trong Dashboard → Nhạc nền: phát / dừng / bài trước / bài sau /
  âm lượng / chọn bài.

## Sửa 2 lỗi v5 (2026-11-12, từ ảnh live thật)

1. **Zoom kéo theo avatar:** trước đây zoom chỉ đổi viewBox của bản đồ SVG,
   còn lớp avatar là HTML đứng yên tại tọa độ cũ — nên khi zoom vào miền Nam,
   avatar của người ở miền Bắc vẫn nằm nguyên chỗ cũ, trôi lềnh bềnh giữa
   biển. Đã sửa: lớp avatar giờ dùng **cùng phép biến đổi với viewBox**
   (`syncAvatarZoom`), avatar bám chặt vào tỉnh của mình khi zoom (đã kiểm
   chứng bằng toán: điểm tỉnh và điểm avatar trùng đúng tọa độ màn hình khi
   zoom 2.57× vào Cà Mau).
2. **Voice không dùng giọng trình duyệt nữa:** đổi sang kiểu **Buồng giam** —
   file TTS tạo sẵn trước khi live, overlay chỉ phát file (xem mục Voice ở
   trên). Kèm **bộ lọc từ** cho tên người xem (link/spam/chửi → hiện "Bạn").

## Sửa 4 lỗi v4.1 (2026-11-11)

1. **Màn hình game quá to, không vừa 1 khung hình:** overlay giờ tự thu gọn
   vừa đúng khung ở mọi kích thước cửa sổ (tự scale 1080x1920). Trong LIVE
   Studio nhớ đặt độ phân giải tùy chỉnh **1080 x 1920** + chọn **Fit**.
2. **Link overlay cho TikTok LIVE Studio:** `http://localhost:3009/overlay.html`
   — hiện sẵn trong Dashboard (có nút Sao chép) cùng các bước thêm nguồn Link.
3. **Bảng xếp hạng:** bảng **TOP 5 TỈNH** dưới bản đồ giờ **luôn hiện đủ 5
   hàng** xếp theo điểm (tỉnh chưa sáng hiện mờ 0đ), top 3 có huy chương
   🥇🥈🥉. Trước đây bảng chỉ hiện tỉnh đã sáng nên lúc đầu ván trông như
   không có bảng.
4. **Giọng đọc không phải tiếng Việt thuần:** nguyên nhân là máy chưa có
   giọng Việt nên trình duyệt phải đọc bằng giọng nước ngoài. Đã thêm ô
   **Chọn giọng đọc** trong Dashboard (liệt kê mọi giọng, giọng Việt có cờ
   🇻🇳) + cảnh báo khi máy thiếu giọng Việt + hướng dẫn cài gói giọng Việt
   cho Windows.

## 🎉 Tính năng mới v4 — đẹp hơn + nhiều chức năng hơn

- **🏆 Mốc điểm tỉnh:** tỉnh nào chạm **50 / 100 / 200 điểm** (chỉnh được,
  cách nhau bằng dấu phẩy) thì cả phòng được thông báo + voice đọc tên tỉnh
  + mốc điểm (vd. "Tỉnh Hà Nội đã đạt mốc điểm 50!") + vòng sáng tím nổ ra
  ở tỉnh đó.
- **👑 Vương miện:** tỉnh đang dẫn đầu bảng xếp hạng được đội vương miện
  ngay trên bản đồ.
- **🎇 Spotlight:** mỗi khi có người thắp tỉnh mới, 1 thẻ to hiện giữa màn
  hình vài giây: ảnh đại diện người thắp + "Lan vừa thắp sáng Khánh Hòa!" +
  1 câu giới thiệu về tỉnh đó.
- **🔊 Hiệu ứng âm thanh:** pop khi tỉnh vừa sáng, chuông khi vượt mốc,
  kèn khi sáng đủ cả nước — tổng hợp bằng WebAudio, không cần file nhạc.
  Bật/tắt trong Dashboard → Hiệu ứng âm thanh.
- **✨ Đẹp hơn:** tiêu đề vàng ánh kim chạy (shimmer), tỉnh sáng **phát sáng
  thở** (glow pulse), sao nền nhấp nháy, vòng sáng lan ra khi tỉnh vừa sáng,
  pháo hoa canvas (confetti rơi) lúc sáng đủ cả nước thay cho chấm pháo cũ.

> ⚠️ **Đã bỏ từ v7:** cơ chế **🍀 Tỉnh may mắn** (viền tím + thưởng +5đ)
> và **🎁 Bảng Top tặng quà** (cột thứ 3) — overlay gọn hơn. Bản đồ đổi
> sang **3D**: tỉnh càng nhiều điểm càng dày (nổi cao hơn), không đổi màu
> theo điểm nữa.

## 📡 Thẻ kết nối trực tiếp

Không còn phải đoán "link có chạy không" — nhìn đèn là biết:

- **Overlay (cuối dòng phụ đề):** `● LIVE` (xanh, nhấp nháy) = vừa nhận sự kiện thật trong 60 giây qua; `● TÍN HIỆU YẾU` (vàng) = im hơn 60 giây; `○ CHỜ KẾT NỐI` (xám) = chưa từng nhận sự kiện nào từ khi server chạy.
- **Dashboard (khung "Kết nối trực tiếp TikTok LIVE"):** chi tiết hơn — trạng thái LIVE của tài khoản, sự kiện cuối cách đây bao lâu, loại sự kiện gần nhất (chat/gift/like/follow/join), tổng số sự kiện đã nhận, kèm hướng dẫn sửa khi chưa kết nối. Dashboard còn cảnh báo khi bạn đang bật "Giả lập người xem" (sự kiện giả cũng làm sáng bản đồ, dễ nhầm với sự kiện thật — tắt trước khi live thật).

**Lưu ý:** đèn báo chỉ tính sự kiện **LIVE thật từ adapter trực tiếp** — sự kiện giả lập và gửi tay qua Dashboard KHÔNG làm đèn xanh. Đó là chủ ý: đèn xanh = đường link live đang sống thật.

## 🔧 Comment không sáng thì kiểm tra (theo thứ tự)

1. **Nhìn đèn báo:** overlay góc phải trên hoặc Dashboard → khung "Kết nối trực tiếp TikTok LIVE".
   - Đèn xám/vàng → lỗi ở đường kết nối LIVE: xem bước 2.
   - Đèn xanh nhưng tỉnh không sáng → lỗi ở phía server: xem bước 3.
2. **Đèn chưa xanh:** (a) kiểm tra lại TikTok ID trong link overlay — nhập sai nick là máy chủ theo dõi nhầm tài khoản; (b) tài khoản đã Go LIVE chưa — thẻ kết nối báo "chưa LIVE" thì Go LIVE rồi đợi tối đa 1 phút; (c) thẻ báo lỗi Euler / Business plan thì máy chủ cần API key Euler (đăng ký miễn phí, xem README nền tảng).
3. **Đèn xanh nhưng không sáng:** (a) Dashboard → "Trạng thái": nếu báo "ĐÃ SÁNG ĐỦ 34/34" thì game đang ở màn ăn mừng, comment không tính — bấm "Chơi lại từ đầu"; (b) thử gửi tay trong Dashboard: comment `Thanh Hoá` — nếu sáng thì server ổn, vấn đề nằm ở nội dung comment thật (gửi lại nội dung đó cho mình xem); (c) log của server: mỗi sự kiện LIVE đều in 1 dòng — nếu thấy dòng `[webhook] event lạ, bỏ qua` thì chụp lại gửi mình, nghĩa là adapter gửi 1 dạng sự kiện lạ chưa nhận ra.
4. **v7.2 — event body rỗng `{}`:** đã gặp 1 lần (2026-11-12 01:31, 6 event liên tiếp đều `{}`): đèn vẫn xanh vì event tới được server, nhưng không có dữ liệu nên không thắp được tỉnh nào. Server giờ **ghi lại body thô + content-type của mọi event** (xem log server, dòng `[webhook] nhận: ...`, và trong Dashboard → khung "Kết nối trực tiếp" → "Xem sự kiện gần nhất"). Server cũng đã học cách đọc nhiều dạng body (JSON, JSON 2 lớp, form-urlencoded, dữ liệu thô không kèm tên loại) để lần sau gặp dạng nào cũng nhận được.
4. **Test trước khi live thật:** xem mục "Test trước khi live thật" bên dưới. **Không có nút chuyển demo → live** — server lúc nào cũng nghe event live thật; "Giả lập người xem" chỉ là bộ phát sự kiện giả để test, tắt nó trước khi live thật.

## v7.3 (2026-11-12, từ live thật — sự kiện đã chạy, còn 3 vấn đề)

1. **Voice không đọc:** trình duyệt trong LIVE Studio khóa âm thanh tới khi
   host tương tác 1 lần, mà code cũ đốt sạch hàng đợi mỗi khi `play()` bị từ
   chối (mỗi clip reject là nhảy sang clip sau). Đã sửa: khi bị khóa thì GIỮ
   nguyên clip, thử lại mỗi 2s, hiện dòng \"🔇 Voice đang bị khóa — nhấn vào
   màn hình 1 lần để bật tiếng\" ở dòng voice dưới bản đồ; sau 1 lần nhấn
   (Interact → nhấn vào overlay) thì đọc tiếp từ câu đang dở, không mất câu
   nào. Xem thêm mục Voice ở trên.
2. **Avatar không đúng:** adapter trực tiếp gửi avatar thật qua field `avatar_url`
   (dạng form-urlencoded), nhưng code chỉ đọc các dạng `profilePictureUrl` /
   `avatarUrl` nên avatar toàn rơi về vòng tròn chữ cái. Đã thêm `avatar_url`
   (+ `avatarURL`, `profile_picture_url`) vào danh sách field avatar; tên
   dự phòng thêm `value1` (username TikTok). Thêm 1 lỗi cùng họ: avatar
   element đã tạo rồi thì không bao giờ cập nhật lại ảnh — ảnh lỗi 1 lần
   (hết hạn chữ ký TikTok) hoặc URL đổi theo event mới thì mãi hiện chữ
   cái; giờ overlay gắn lại `<img>` mỗi khi URL avatar đổi.
3. **Quê = tỉnh comment gần nhất (thay luật v6.2 khóa quê suốt ván):** 1
   người trong cùng 1 thời điểm chỉ ở đúng 1 tỉnh — tỉnh vừa comment xong.
   Comment tỉnh mới thì avatar BAY sang tỉnh đó (overlay có sẵn hiệu ứng
   trượt 0.6s + rơi lại), điểm +1 và điểm tap/quà sau đó tính cho quê mới;
   điểm tỉnh đã tích ở tỉnh cũ vẫn giữ nguyên. Quà/follow vẫn chỉ thắp ngẫu
   nhiên, không đổi quê (trừ khi người đó chưa có quê thì quê = tỉnh vừa
   thắp).
4. **Dạng form (thấy từ log live thật):** body là
   `value1=username&value2=nội dung chính&value3=giá trị phụ&content=nội
   dung comment&avatar_url=...` — server đã chuẩn hóa dạng này (value2 làm
   text comment dự phòng, value3 số làm số xu quà), thứ tự suy luận loại sự
   kiện đổi thành quà → tim → chat để tên quà không bị nhầm thành comment.

## v7.4 (2026-11-12) — Chống spam đổi quê (thay luật v7.3 đổi quê không giới hạn)

Chỉ giới hạn đổi quê thôi thì chưa đủ chặn spam, vì code cũ comment tỉnh
nào là thắp luôn tỉnh đó — 1 người gõ tên hết các tỉnh là sáng nhanh cả
bản đồ. Luật mới, fix cứng:

- Mỗi người chơi trong 1 ván chỉ được **đổi quê tối đa 1 lần**
  (`maxHomeChangesPerRound`, mặc định 1, chỉnh ở Dashboard → Luật chơi;
  0 = khóa hẳn sau lần chọn quê đầu).
- Comment đầu tiên chọn quê (không tính lượt đổi). Comment tỉnh khác dùng
  1 lượt đổi → avatar bay sang tỉnh mới.
- Hết lượt rồi thì comment tỉnh khác **không thắp sáng cũng không cộng
  điểm** — chỉ comment đúng tỉnh quê hiện tại mới tính (vẫn +1đ, vẫn farm
  mốc điểm). Khi bị chặn, feed hiện 1 lần: "🔒 Lan đã hết lượt đổi quê
  trong ván này (đã đổi 1 lần), ở lại Đà Nẵng!".
- Ván mới (sáng đủ 34/34 tự reset, hoặc Reset tay) thì lượt đổi mở lại.
- Quà/follow vẫn thắp ngẫu nhiên như cũ (không tính lượt đổi); quà có
  thể gán quê trước nếu người đó chưa có quê — comment quê thật sau đó
  tính là 1 lượt đổi.

Kết quả: mỗi người tối đa thắp 2 tỉnh/ván (quê đầu + 1 lần đổi), bản đồ
chỉ đầy khi nhiều người cùng chơi. ĐÃ KIỂM CHỨNG: Lan Hà Nội → Đà Nẵng
(đổi lần 1) → Huế bị chặn (quê ở lại Đà Nẵng, Huế không sáng, feed báo
🔒) → comment lại Đà Nẵng vẫn +1đ → 40 tim vẫn +2đ cho Đà Nẵng → reset
ván xong Lan comment Huế đổi quê lại được.

## v7.5 (2026-11-12) — Sửa gốc vụ "live nghe được nhạc mà không nghe voice"

**Nguyên nhân (tìm bằng cách đọc lại code + tái hiện đúng kịch bản):**
id của mỗi câu voice (`announceSeq`) từng bắt đầu từ 0 — mỗi lần khởi
động lại server là đếm lại từ 1. Trong khi overlay trong LIVE Studio
chạy liên tục, biến `lastAnnounceId` của nó vẫn giữ số id cũ (vd. 47).
Câu mới sau restart có id 1..10 đều nhỏ hơn 47 nên overlay bỏ qua hết
→ voice chết hẳn cho tới khi tải lại nguồn Link. Nhạc vẫn phát vì nhạc
không dùng id. Tab Chrome của host thì mở lại sau restart nên voice vẫn
nghe được — đúng y triệu chứng user báo (Dashboard voice BẬT + volume
0.9, live nghe được nhạc, chỉ mất voice). ĐÃ TÁI HIỆN trên trình duyệt
thật: tab không reload, sau restart server thì câu mới không vào hàng
đợi nữa (lastId đứng yên, câu cũ kẹt lại).

**Sửa 2 lớp:**
1. **Server (gốc):** `announceSeq` khởi đầu bằng `Date.now()` thay vì 0
   → id luôn tăng đơn điệu qua mọi lần restart, không câu nào bị mất.
2. **Overlay (phòng thủ):** mỗi lần render, nếu id lớn nhất trong mảng
   nhỏ hơn id đã đọc thì bộ đếm đã quay lại (server cũ) → tự đồng bộ
   lại, voice hồi phục từ câu kế tiếp (mất tối đa 1 câu). Lần mở trang
   đầu cũng bỏ qua backlog cũ, không đọc bù câu từ trước khi mở overlay.

ĐÃ KIỂM CHỨNG bằng đúng kịch bản tái hiện (restart server, không reload
tab): câu sau restart vào hàng đợi ngay (lastId tăng theo id mới, queue
= 1); ép `lastAnnounceId` lên số khổng lồ để giả lập server cũ thì câu
kế tiếp vẫn vào hàng đợi (queue = 2).

**Lưu ý khi cập nhật:** phải chạy lại server từ bản mới thì voice mới
hồi phục (ván hiện tại sẽ chơi lại từ đầu — nên thay giữa 2 buổi live
nếu không muốn mất ván). Nguồn Link trong Studio không cần Refresh cũng
được (id mới lớn hơn mọi id cũ nên overlay cũ vẫn đọc được), nhưng nên
Refresh để lấy luôn lớp phòng thủ.

## v7.6 (2026-11-12) — Overlay và Studio không đồng bộ sau reset ván

**Phát hiện từ ảnh chụp màn hình của user (Chrome vs preview trong Studio
cùng lúc):** bản đồ, BXH, số liệu 2 bên giống nhau, nhưng dòng sự kiện
gần đây + dòng voice thì khác nhau — Chrome hiện "Chưa có ai thắp sáng"
(câu mặc định), Studio vẫn hiện "Hoangham vừa thắp sáng Đồng Tháp!" +
câu voice mốc điểm của VÁN TRƯỚC, dù bản đồ đã về 0/34.

**Nguyên nhân (đọc lại code):** `render()` chỉ GHI các dòng này khi có dữ
liệu mới, không bao giờ XÓA khi dữ liệu hết. Server reset ván thì
`recent = []`, `spotlight = null`, nhưng overlay chạy lâu (nguồn Link
trong Studio, mở từ trước khi reset) không có nhánh `else` để trả lại
dòng mặc định → giữ mãi chữ cũ. Tab Chrome mở lại sau thì hiện đúng
vì chưa từng ghi chữ cũ. Bản đồ/BXH thì render lại toàn bộ mỗi lần nên
vẫn đúng — chỉ 2 dòng này là "ghi 1 chiều".

**Sửa (overlay):**
- `recentText`: thêm nhánh `else` — khi `recent` rỗng thì trả lại dòng
  "✨ Chưa có ai thắp sáng — bạn sẽ là người đầu tiên?".
- Đổi ván (`roundNo` thay đổi): xóa hàng đợi voice + câu đang đọc dở,
  xóa dòng voice, ẩn thẻ spotlight ngay. Câu "Ván mới bắt đầu!" vẫn
  vào hàng đợi bình thường sau đó.

ĐÃ KIỂM CHỨNG trên trình duyệt thật (không tải lại tab): Lan thắp Hà
Nội → dòng hiện Lan + spotlight hiện; reset ván → dòng về mặc định,
spotlight ẩn, câu Lan cũ biến mất (câu đang giữ sau reset là "Ván mới
bắt đầu!"); Bao thắp Đà Nẵng ở ván mới → dòng hiện Bao bình thường.

**Riêng vụ overlay trong preview Studio bị CẮT TRÁI (tiêu đề mất chữ
"THẮP"):** không phải do code — body đã căn giữa bằng flex +
`fitStage` tự scale vừa khung nên code không thể làm lệch trái. Đó là
do lớp nguồn Link trong Studio đang đặt lệch/kích thước sai: bấm chọn
nguồn Link trong Studio → chuột phải → **Fit to screen** (hoặc chỉnh
lại vị trí 0,0 và kích thước 1080×1920 cho vừa khung dọc).

## v7.7 (2026-11-12) — Tặng quà không được tự gán quê (lỗi live thật)

**Vụ việc:** host tặng Hoa hồng (1 xu) khi chưa có quê trong ván → code
thắp ngẫu nhiên 1 tỉnh (Gia Lai) rồi lấy luôn tỉnh đó làm quê của host,
điểm quà (+5) cộng vào Gia Lai thay vì quê thật (Thanh Hóa), voice cũng
không thông báo đúng.

**Nguyên nhân (đọc lại code):** `lightProvince` có dòng `if (!viewer.home)
viewer.home = num` — quà/follow thắp ngẫu nhiên tỉnh nào thì lấy luôn
tỉnh đó làm quê. Dòng này có từ đầu (ý định "giữ điểm lại"), nhưng nó
cướp quê của người chơi.

**Sửa (server):**
- Bỏ hẳn việc tự gán quê trong `lightProvince` — quê chỉ do chính người
  chơi comment chọn. Quà/follow vẫn thắp ngẫu nhiên như cũ (phần thưởng
  nhìn thấy được), nhưng không bao giờ đổi quê của ai.
- Chưa có quê mà tặng quà: điểm không mất — được GIỮ LẠI
  (`bankedPoints`), feed/voice báo "comment tên quê để nhận điểm";
  khi comment chọn quê lần đầu, điểm giữ lại trả đủ về quê mới
  (+5đ quà + 1đ comment). Ván mới reset lại điểm giữ.
- Voice cảm ơn quà vẫn ở mức ưu tiên thấp nhất (4) — chỉ đọc khi hàng
  đợi rảnh; nếu live đang đông (nhiều câu thắp lần đầu) thì câu cảm ơn
  có thể bị bỏ qua. Muốn voice ưu tiên cảm ơn quà hơn thì nói mình.

ĐÃ KIỂM CHỨNG: Yen chưa có quê tặng Hoa hồng → Cà Mau sáng (ngẫu
nhiên, 0đ), KHÔNG bị gán quê, feed báo "+5 điểm đang chờ quê"; Yen
comment Thanh Hóa → quê 32, Thanh Hóa 6đ (5 giữ lại + 1 comment);
tặng tiếp Hoa hồng → +5 cho Thanh Hóa (11đ), quê không đổi; Lan có
quê Hà Nội tặng quà → +5 cho Hà Nội; Minh follow → thắp ngẫu nhiên,
không gán quê.

**Xử lý NGAY lúc đang live (không cần thay bản mới):** comment
"Thanh Hóa" 1 lần từ tài khoản vừa tặng quà để lấy lại quê (tốn 1 lượt
đổi quê nếu đang chạy v7.4+), rồi hãy tặng tiếp — điểm quà sẽ cộng cho
Thanh Hóa, quê không bị chuyển nữa. Muốn hết hẳn lỗi thì thay bản v7.7
+ chạy lại server (ván hiện tại chơi lại từ đầu — nên thay giữa 2 buổi
live nếu không muốn mất ván).

## v7.8 (2026-11-12) — Quà rơi nhầm người vì tên không khớp (lỗi live thật)

**Vụ việc (user đính chính v7.7):** host tặng Hoa hồng khi ĐÃ ở quê
Thanh Hóa, nhưng quà vẫn thắp ngẫu nhiên 1 tỉnh (Gia Lai) mà không cộng
điểm cho Thanh Hóa, không có voice cảm ơn. Chẩn đoán "chưa có quê" của
v7.7 là SAI với trường hợp này.

**Nguyên nhân thật (tái hiện đúng form event):** cùng 1 người nhưng
adapter gửi tên khác nhau theo loại event — chat có field nickname
"Đại Tư Sĩ", quà chỉ có value1/uniqueId "dai_tu_si". Hàm `viewerIdOf`
cũ chỉ viết thường + gộp khoảng trắng nên tách thành 2 người khác nhau:
comment thì quê Thanh Hóa (người "Đại Tư Sĩ"), quà thì rơi vào người
"dai_tu_si" không có quê → thắp ngẫu nhiên + điểm không về Thanh Hóa.
ĐÃ TÁI HIỆN: chat nickname → Thanh Hóa 1đ; quà chỉ value1 → feed hiện
"dai_tu_si tặng Hoa hồng... +5 điểm đang chờ quê", tỉnh ngẫu nhiên sáng,
Thanh Hóa vẫn 1đ; log ghi "quê chưa có".

**Sửa (server):**
- `viewerIdOf` dùng chung hàm `norm()` (bỏ dấu, gộp khoảng trắng/gạch
  dưới) để mọi cách viết tên đều về 1 id: "Đại Tư Sĩ" ≡ "dai_tu_si" ≡
  "DAI TU SI". Chat/quà/tim/follow của cùng 1 người giờ chung 1 hồ sơ.
- Voice cảm ơn quà tăng ưu tiên 4 → 2 (ngang mốc điểm, chỉ sau thắp lần
  đầu) để quà tặng được đọc cảm ơn thay vì bị bỏ qua khi live đông.

ĐÃ KIỂM CHỨNG cùng kịch bản: quà value1-only giờ về đúng người "Đại
Tư Sĩ", Thanh Hóa 6đ (1 comment + 5 quà), log "quê Thanh Hóa +5đ", câu
cảm ơn quà ưu tiên 2. Đường banked-points (v7.7) vẫn chạy: Yen chưa quê
tặng quà → giữ điểm, comment Huế → Huế 6đ.

**Bù điểm NGAY lúc đang live (không cần thay bản):** mở Dashboard →
mục gửi sự kiện tay → tên "Đại Tư Sĩ", quà "Hoa hồng", 1 xu → "Gửi
quà" — cộng ngay 5đ cho Thanh Hóa trên server đang chạy (kèm 1 tỉnh
thắp ngẫu nhiên nữa, đó là luật quà tặng). Muốn hết hẳn lỗi thì thay
bản v7.8 + chạy lại server (ván hiện tại chơi lại từ đầu — nên thay
giữa 2 buổi live nếu không muốn mất ván).

## v8.2 (2026-11-12) — Bố cục 3 cột: đảo KHÔNG BỊ CHE (user sửa lần 2)

**Vấn đề:** v8.1 để đảo sau khung bảng trong suốt — user bảo "để như này sao thấy", dặn bố cục lại, cùng lắm chia bảng thông báo sang 2 bên, và nhấn mạnh **không được che 2 quần đảo**.
**Cách sửa — bố cục 3 cột:**
- **Bảng điểm sang TRÁI** (240px): đồng hồ đếm ngược, tiến độ 34 tỉnh, TOP 5 TỈNH, TOP ĐÓNG GÓP, thống kê, nhật ký DIỄN BIẾN (flex:1, lấp đầy bảng).
- **Bản đồ ở GIỮA** (572px, viewBox crop mới 240,260,600,1300): tỉnh ~532px, nhỏ hơn v8 một chút để nhường chỗ cho 2 bảng.
- **Cột PHẢI** (240px): chỉ giữ sự kiện gần đây + dòng voice (trên) và gợi ý tỉnh chưa sáng + chú thích 4 màu/luật (dưới). **Giữa 2 mục đó là khoảng trống trong suốt đúng vị trí 2 quần đảo (y 340–913)** — đảo ở lớp SVG riêng, hiện rõ hoàn toàn, không bị che chút nào. Vì đảo không còn nằm sau khung nên khung được trở lại kính mờ đẹp (nền 45% + blur 8px).
- Chữ vinh danh (h1 72→54px, p 34→28px) + khung spotlight (700→520px) thu nhỏ cho vừa khu vực bản đồ hẹp hơn.

ĐÃ KIỂM CHỨNG BẰNG ẢNH THẬT: layout mới (đảo HOÀNG SA/TRƯỜNG SA hiện rõ hoàn toàn bên phải, không bị che), zoom tới Lâm Đồng, màn vinh danh hết giờ (Đà Nẵng 251đ + Lan 251đ + pháo giấy).

## v8.1 (2026-11-12) — Quần đảo về đúng vị trí + voice thông báo đảo

**1. Hoàng Sa / Trường Sa về đúng vị trí cũ bên phải (không để dưới nữa).**
- v8 đã dời đảo xuống biển dưới bản đồ vì sợ khung bảng che mất — user dặn đảo phải ở đúng vị trí (khung bên phải, x 855, y 340/620 như trước), khung bảng đã trong suốt thì không sợ che.
- Đảo giờ vẽ ở **lớp SVG riêng** phủ kín stage (hệ tọa độ 1080×1920 đầy đủ), nằm dưới khung bảng dọc — không bị viewBox crop của bản đồ cắt mất, nhìn xuyên qua khung.
- Khung bảng làm **gần như trong suốt** để đảo nhìn xuyên qua RÕ: nền panel 12% (trước 48%), mục con 18% (trước 55%), **bỏ hẳn blur** (thử nghiệm ảnh cho thấy nền 30% + blur 3px vẫn che đảo gần như hết). Chữ vẫn đọc rõ nhờ bóng chữ + viền khung. Tiêu đề đảo (vàng) + chấm đảo sáng màu vẫn đọc rõ qua khung; chữ trong bảng vẫn rõ.
- Đảo sáng vẫn cùng màu nhóm + nổi 3D theo tỉnh chủ quản; chấm đảo nhỏ nên tô **màu đặc** của nhóm (tím #a78bfa / xanh lá #a3e635) thay vì gradient (gradient trên chấm 3px không thấy mà còn nhạt).

**2. Voice thông báo quần đảo.**
- Tỉnh nào thắp sáng lần đầu thì đảo của tỉnh đó sáng theo VÀ voice đọc thêm 1 câu riêng (ưu tiên 2, sau câu thắp tỉnh): "Quần đảo Hoàng Sa cũng sáng cùng Đà Nẵng!" / "Quần đảo Trường Sa cũng sáng cùng Khánh Hòa!". Câu cố định nên tổng hợp 1 lần rồi cache dùng tiếp. Áp dụng mọi đường thắp (comment, quà, follow, gửi tay, giả lập) vì câu gắn trong `lightProvince`.

ĐÃ KIỂM CHỨNG: Đà Nẵng + Khánh Hòa thắp → 2 câu voice đảo có ttsUrl sẵn; DOM xác nhận island-6 fill #a78bfa lit=true, island-18 fill #a3e635 lit=true; ảnh chụp thấy rõ tiêu đề HOÀNG SA / TRƯỜNG SA + chấm đảo xuyên qua khung phải, chữ bảng vẫn đọc rõ.

## v8.0 (2026-11-12) — Thắng theo thời gian + 4 màu + nền trống đồng + thêm nhạc + voice rõ hơn + khung phải

**1. Cơ chế thắng mới: chơi theo thời gian (thay cho "sáng đủ 34/34 là thắng").**
- Mỗi ván dài `gameDurationMin` phút (mặc định **60 phút**, chỉnh ở Dashboard → Luật chơi; đổi thì đồng hồ ván hiện tại tính lại từ lúc đó).
- Hết giờ: **tỉnh điểm cao nhất thắng** (hòa → nhiều lượt thắp hơn, rồi thắp sớm hơn) + **người đóng góp nhiều nhất** (điểm cá nhân cao nhất) cũng được vinh danh trên màn ăn mừng + feed + voice. Sau đó tự chơi lại sau `autoResetSeconds` (60s).
- Sáng đủ 34/34 giờ chỉ là **1 mốc**: pháo hoa 6s + feed + voice "Cả nước đã sáng rồi! Mốc lớn đã đạt…" — ván vẫn chơi tiếp tới hết giờ, điểm vẫn cộng.
- Đồng hồ đếm ngược hiển thị to ở khung phải (kèm thanh thời gian).

ĐÃ KIỂM CHỨNG: đặt thời lượng 0.05 phút (3s) → hết giờ, phase complete, winner Hà Nội 6đ + Lan 6đ; lightAll → phase vẫn playing, lit 34/34, allLitAt có, không tự reset.

**2. Tô màu 4 màu (định lý bốn màu) — thay cho 1 màu vàng.**
- Tính kề từ ranh giới thật trong `provinces.json` (2 tỉnh chung ≥2 điểm biên = kề nhau): 58 cặp kề, tô 4 màu sao cho tỉnh kề nhau luôn khác màu (đã kiểm chứng 0 xung đột). Phân bổ cân bằng: 9/8/9/8 tỉnh mỗi màu.
- 4 nhóm: xanh ngọc, cam, tím, xanh lá. Chưa sáng = màu nền tối của nhóm; sáng = gradient của nhóm + phát sáng + viền cùng nhóm. Độ dày 3D theo điểm giữ nguyên; Hoàng Sa/Trường Sa cùng màu với tỉnh chủ quản (Đà Nẵng/Khánh Hòa).

**3. Background trống đồng Đông Sơn.**
- Ảnh mặt trống đồng (tạo bằng AI, 1600×1600) làm nền toàn khung: `public/trong-dong-bg.jpg`, phủ thêm lớp tối để bản đồ nổi. Server đã thêm route phục vụ file này (trước đây chỉ có route cho các file liệt kê sẵn nên ảnh nền 404).

**4. Thêm 4 bài nhạc (playlist giờ 6 bài, ~9 phút).**
- 03 Sông Quê Êm Đềm (88s), 04 Đất Nước Vươn Xa (88s), 05 Lễ Hội Quê Hương (80s), 06 Đêm Trăng Làng Quê (100s) — soạn bằng ffmpeg (pad hợp âm + arpeggio ngũ cung + echo), loudnorm về -18 dB như 2 bài cũ. Script tạo lại: `gen-music.py`. Tên bài đã thêm vào `MUSIC_NAMES` trong server.js.

**5. Voice rõ ràng, trơn tru hơn.**
- File voice động (câu có tên) giờ được **chuẩn hóa âm lượng về -16 LUFS** bằng ffmpeg ngay sau khi tổng hợp — trước đây file thô to/nhỏ thất thường so với clip cố định (-16.5 dB). ĐÃ ĐO: file động -16.4 dB ≈ clip cố định -16.5 dB. Best-effort: máy live không có ffmpeg thì giữ file thô (vẫn đọc).
- Câu đọc tên giờ tổng hợp 1 lần tới 200 ký tự (trước 180) nên ít bị cắt khúc; câu thắp tỉnh thêm dấu phẩy sau tên người ("Lan, đã thắp sáng Hà Nội…") để giọng ngắt nhịp tự nhiên; câu mốc điểm cũng vậy.

**6. BXH + bảng điểm sang khung dọc trong suốt bên phải, bản đồ to xuống dưới.**
- Khung phải (300px, kính mờ trong suốt) chứa: đồng hồ đếm ngược, tiến độ 34 tỉnh, TOP 5 TỈNH, TOP ĐÓNG GÓP, thống kê, sự kiện gần đây + dòng voice, nhật ký DIỄN BIẾN (mới, lấp đầy khung).
- Bản đồ dời viewBox crop theo nội dung (210,230,660,1620) — to hơn ~9% và tràn xuống dưới; Hoàng Sa/Trường Sa dời xuống vùng biển dưới bản đồ (khung phải đã chiếm chỗ cũ). Zoom + avatar đã cập nhật theo viewBox mới (đã kiểm chứng bằng ảnh: zoom tới Lâm Đồng, avatar bám đúng tỉnh khi phóng to).

ĐÃ KIỂM CHỨNG BẰNG ẢNH THẬT: layout mới (trống đồng + 4 màu + khung phải + đảo dưới), zoom, màn vinh danh hết giờ (Hà Nội 252đ + Lan 251đ + pháo giấy).

## v7.9 (2026-11-12) — Fix CỨNG identity bằng ID người chơi + xử lý sự kiện nhanh hơn

**1. Identity: lấy ID người chơi làm cơ sở (user yêu cầu, thay v7.8).**
v7.8 gộp mọi cách viết tên về 1 id — vẫn là lấy TÊN làm cơ sở, nên 2
người cùng tên hiển thị "Đại Tư Sĩ" sẽ va chạm thành 1 người. v7.9
tách hẳn 2 khái niệm:
- **Key (id): uniqueId** — tên tài khoản @... (value1 của event),
  ổn định, duy nhất mỗi tài khoản, có ở mọi loại event (chat/quà/tim/
  follow). userId số của TikTok chỉ dùng khi không có uniqueId (không
  chắc adapter gửi nó ở mọi loại event nên không được ưu tiên trước).
- **Tên hiển thị: nickname** — chỉ để hiện trên feed/BXH và đọc voice,
  không bao giờ làm key. Nếu quà đến trước chat (chỉ có username),
  tên hiển thị tự cập nhật thành nickname khi chat đầu tiên tới.
- Sự kiện gửi tay (Dashboard/simulator) chỉ có tên hiển thị: tự tìm
  người có tên hiển thị trùng để không tạo nhầm người mới — nhánh này
  chỉ chạy khi không có key, webhook luôn có key nên không khớp nhầm.

ĐÃ KIỂM CHỨNG: 2 tài khoản cùng nickname "Đại Tư Sĩ" (dai_tu_si và
dai_tu_si_2) thành 2 người riêng — 1 người quê Thanh Hóa 1đ, 1 người
quê Hà Nội 1đ; quà value1-only về đúng người (Thanh Hóa 11đ); quà gửi
tay "Đại Tư Sĩ" về đúng người; like gửi tay "Lan" (100 tim) về đúng
viewer webhook lan_01 (An Giang 6đ: 1 comment + 5 tim).

**2. Tốc độ xử lý sự kiện (live đông không bị chậm voice).**
- Tổng hợp voice: bỏ hàng đợi NỐI TIẾP, tổng hợp song song tối đa 3
  câu — trước đây câu thứ 5 phải chờ 4 câu trước (mỗi câu 0.5–1.5s
  mạng), overlay chỉ chờ 2.5s rồi đọc clip chung (mất tên).
- Overlay chờ file voice: 2.5s → 1.5s, kiểm tra lại mỗi 250ms (trước
  500ms) để bắt kịp file vừa về; nghỉ giữa 2 câu voice: 400ms → 250ms.
- Dashboard cập nhật mỗi 1s (trước 2s).
- Sửa bug câu lặp: câu đã tổng hợp rồi (vd. cảm ơn cùng 1 món quà lặp
  lại) từng không được gắn url vào entry mới — overlay chờ đủ 1.5s rồi
  đọc clip chung. Giờ nhánh cache gắn url ngay.

ĐÃ KIỂM CHỨNG: 5 người thắp sáng cùng lúc (5 chat trong 0.45s) — cả
5 câu voice có tên đều sẵn sau **1.91s**; 2 câu cảm ơn quà giống hệt
nhau đều có file voice ngay (trước đây câu thứ 2 mất tên). Map/bảng
vẫn cập nhật ngay khi webhook tới (broadcast tức thì + heartbeat 500ms).

## Test trước khi live thật

1. Mở Dashboard → bật **Giả lập người xem**, xem overlay sáng dần, avatar
   rơi vào tỉnh, voice đọc, nhạc chạy. **Nhớ tắt giả lập trước khi live thật.**
2. Hoặc gửi tay trong Dashboard: comment `Hà Nội`, quà 10 xu, follow,
   +100 tim (kèm link avatar để xem thử avatar rơi).
3. Bấm **Sáng hết** để xem thử pháo hoa mốc 34/34 (ván vẫn chơi tiếp, không tự chơi lại). Muốn xem màn vinh danh hết giờ: Dashboard → Luật chơi → Thời lượng 1 ván = 1 phút → Lưu → chờ hết 1 phút.

## File trong zip

- `server.js` — server + luật game (Node thuần, **không cần `npm install`**)
- `public/overlay.html` — màn hình game cho OBS (1080x1920)
- `public/dashboard.html` — điều khiển, thắp tay, chỉnh luật, voice, nhạc, giả lập
- `public/provinces.json` — dữ liệu 34 tỉnh (đường biên thật, đã chiếu sẵn)
- `public/islands.json` — dữ liệu Hoàng Sa / Trường Sa (hình đảo thật)
- `public/music/` — playlist nhạc nền (6 track mặc định + chỗ thả mp3 thêm)
- `start.bat` — chạy server trên Windows
- `config.json` — tự tạo khi chạy lần đầu (lưu luật chơi đã chỉnh)

Nguồn bản đồ: GeoJSON từ Free-GIS-Data (Nguyễn Duy Liêm, public use),
đơn giản hóa từ dữ liệu "Vietnam Administrative Divisions (Post-2025)".
