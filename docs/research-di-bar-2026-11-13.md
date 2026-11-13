# Nghiên cứu: TikTok LIVE Bar Game — trước khi làm lại Đi Bar Online

- Ngày: 2026-11-13
- Game: `di-bar-online` (Đi Bar Online) — `~/workspace/live-game-platform/games/di-bar-online/`
- Mục đích: học **format / cơ chế / bố cục** của game bar trên TikTok LIVE rồi mới code lại overlay thành vũ trường thật. **Chỉ học ý tưởng — KHÔNG lấy ảnh/art/nhạc của người ta.** Mọi asset của mình tự vẽ theo chuẩn 2D game asset hoặc vendor CC0/CC-BY đã kiểm chứng.
- Cách nghiên cứu: tìm kiếm web + đọc trang (không xem được video trực tiếp — chỉ đọc mô tả video, bài viết, README). Ảnh tham khảo 136/137/138 của Chủ tịch chỉ được đọc qua tóm tắt của coordinator (chưa xem trực tiếp file ảnh); ảnh 135 (overlay hiện tại bị chê) đã xem trực tiếp.

## 1. Ảnh Chủ tịch gửi (theo tóm tắt của coordinator)

- **Ảnh 1 (sàn xanh):** sàn nhảy lớn đầy vũ công chibi **có cánh**, mỗi người có tag tên ("Dancer 18", "Dancer 23"...); banner trên đầu "Chủ tịch: Dancer 18 đã tặng VIP Gift cho anh em bar!"; log chat "Dancer 23 tặng VIP Gift (x10)", "Dancer 5: đổi nv", "Dancer 22: Xin chào LiveBar!".
- **Ảnh 2 (club tối):** DJ nữ thật ở quầy trên; chữ "chat: 1 vào BAR. 1k tym có cánh"; giàn đèn tròn trên trần + quả cầu disco xanh; đám đông vũ công chibi; menu bên phải: CAMERA, GÓI NV, ĐI VÒNG, NHẢY 1 CÁI, PHÁO HOA, HUY HIỆU + CÁNH, TO LÊN, NHỎ LẠI.
- **Ảnh 3 (màn hình TikTok live):** "Chat '1' to enter the bar / Give a gift to stand out"; sàn trắng có vũ công + đèn disco, DJ phía sau; menu phải giống ảnh 2; chat "Gia Hân đã gửi Hoa hồng × 1", "Minh Huy Hạng 1 đã tham gia".

## 2. Nguồn đã đọc trên mạng

### 2.1 Livecade — Dance Floor (livecade.itch.io/dance-floor)
- Bố cục: **DJ trên booth, sàn nhảy ở giữa, khán giả là vũ công**. Người xem chat là bước lên sàn làm dancer, **đeo ảnh đại diện TikTok của mình**, sàn lấp đầy từ hàng trước ra sau thành đám đông nhún nhảy.
- Cơ chế:
  - Vào sàn: chỉ cần chat (mọi comment đều lên sàn). Like/gift cũng đưa lên sàn.
  - Like/comment = "hype" vũ công của mình (nhảy mạnh hơn); cả đám đông hype đủ thì kích hoạt **DROP chung** — "khoảnh khắc không ai mua được".
  - Quà = **mua sự chú ý**: xoay vũ công, **to lên** (grow — lên bậc kích thước), đổi mặt/áo, nhảy lên hàng trước, hoặc **chiếm spotlight** (cả sàn tối lại, chỉ chiếu người tặng).
  - Xu tặng tích thành **bảng top gifter**; người tặng nhiều nhất đội vương miện.
  - Comment hiện thành **bong bóng chat nổi trên đầu vũ công**.
  - Sàn vắng thì có vũ công tự động lấp đầy (auto dancers), nhường chỗ khi người thật vào.
- Học được: sàn phải **đầy người ngay từ cái nhìn đầu tiên** (front-row first); quà = làm người tặng nổi bật (to lên / spotlight), không phải chỉ cộng điểm; DROP là phần thưởng tập thể, không mua được.

### 2.2 Sàn Quẩy — vn-tool.online/tool/san-quay (sản phẩm trả phí, 259.000đ)
- Bố cục: sàn nhảy 3D khung dọc 1080×1920, DJ booth, bảng top trên quầy DJ, cầu disco, đèn quét, laser.
- Cơ chế:
  - Bình luận → nhân vật mang **avatar + tên TikTok** rơi từ trần xuống sàn, nhảy theo nhạc. Sàn đầy thì người im lặng lâu nhất nhường chỗ.
  - **14 điệu nhảy**: gõ `nhún`, `lắc`, `xoay`, `robot`, `disco`, `hiphop`… hoặc số 1–14 để đổi điệu; lệnh `nhảy`, `đi vòng`, `ghép đôi`, `đổi đồ`.
  - **Thả tim → "sàn cháy"**: tim làm đầy thanh "Nhiệt sàn" → cả sàn nhảy nhanh gấp đôi + laser + pháo giấy.
  - **Quà → hành động** (tự gán quà cho từng hành động): camera zoom cận người tặng, **mọc cánh**, catwalk, pháo hoa, mưa bong bóng, **khổng lồ**, lên DJ, tên lửa, cưỡi rồng, ngồi ngai vàng. Quà không gán sẵn thì chọn hành động theo giá quà.
  - **Người xem làm DJ**: bảng top trên quầy DJ, người đứng đầu được lên đứng sau bàn DJ.
  - Danh hiệu theo xu (Quý Tộc / Vua / Hoàng Đế), âm thanh quà theo mức xu, MC tự nói.
- Học được: menu hành động theo quà là chuẩn của format; tim tích lũy thành "nhiệt sàn" rồi bùng nổ tập thể; top 1 được đứng sau bàn DJ (vị trí danh dự, không chỉ là chữ trên LED).

### 2.3 tieumyai07/tiktok-live-bar — github.com/tieumyai07/tiktok-live-bar
- Bố cục: sàn disco 3D (99 ô sàn LED chạy theo nhịp 128 BPM, vòng truss 20 moving head, 24 tia laser, strobe, quả cầu gương, LED wall, màn hình video DJ, loa); **Top 3 gifter đứng trên bục trước bàn DJ với cánh và huy hiệu**.
- Cơ chế:
  - Vào live là lên sàn, camera chào 2.5 giây; đông người thì xếp hàng rồi chuyển góc toàn cảnh.
  - Lệnh chat: `nhảy`/`dance`, `đi vòng`/`walk`, `đổi nv`.
  - Gift theo 3 mức: **1–9 xu** → nhân vật nhảy, zoom camera; **10–99 xu** → cánh VIP, đổi nhân vật, đi vòng; **100+ xu** → phóng to, Top DJ, pháo hoa.
  - **Khách nền**: đặt số người tối thiểu trên sàn, khách thật vào thì khách nền nhường chỗ.
- ⚠️ **Bản quyền / giấy phép**: trang GitHub hiển thị License "NOASSERTION" (không khẳng định), dù README ghi "MIT License" và có file LICENSE. Theo luật cứng của đội (chỉ dùng repo có LICENSE file thật, đọc trực tiếp), repo này **KHÔNG được dùng làm nguồn code/art** — chỉ học format/cơ chế từ README công khai như trên. Không copy code, không lấy asset.

### 2.4 VNLook Live 3D — livestudio.vn (sản phẩm trả phí)
- Bố cục: sân khấu 3D — Bar Club Online, vũ trường 3D, khán giả là người nhảy.
- Cơ chế: người xem bước vào sàn thành nhân vật 3D; ai tương tác được **camera bắt sáng, đám đông giãn thành vòng tròn cổ vũ**, nhân vật nhảy solo (hip hop, breaking, samba). Bình luận/thả tim → spotlight + điệu nhảy riêng giữa vòng tròn. Tặng quà → lên bục TOP, ánh sáng sân khấu, tên LED trên đầu. Lệnh "đổi nhân vật" chọn trong 22 vũ công 3D.
- Học được: **spotlight = vòng tròn cổ vũ** (đám đông giãn ra, người được chọn nhảy solo ở giữa) — khác với chỉ chiếu đèn.

### 2.5 Reel "Bar Online" — facebook.com/reel/1300576721902160 (mô tả video)
- Hàng chục avatar chibi nhỏ có tên người dùng ("TrangEm", "NELLY", "h.a.h_97", "Bích Thủy") nhảy trên sân khấu tối, đèn neon xanh/tím, khói. Overlay chữ "hey = nhay" (chat "hey" để nhảy). Nhạc EDM nhanh.
- Học được: **tên người dùng luôn gắn trên đầu nhân vật nhỏ**; luật chơi có thể chỉ là 1 từ chat duy nhất, viết ngay trên màn hình.

## 3. Bố cục chuẩn học được (tổng hợp)

| Vùng màn hình (dọc 9:16) | Nội dung |
|---|---|
| Trên cùng | LED chạy chữ / banner sự kiện (ai tặng quà, ai lên top) |
| Sân khấu trên | **DJ ở quầy mix nhạc** (người thật hoặc nhân vật), giàn đèn tròn, cầu disco, màn LED sau lưng DJ |
| Giữa (lớn nhất) | **Sàn nhảy đầy vũ công chibi**: avatar + tên ngay trên đầu, nhảy theo nhịp; người nổi bật (quà/top) thì to hơn / có cánh / có spotlight; sàn có ô LED/laser quét |
| Dưới sàn | Quầy bar / bàn VIP / bảng top / hàng chờ |
| Cạnh màn hình | Menu hành động (camera, đổi nhân vật, đi vòng, pháo hoa, to/nhỏ...) — chỉ ở bản trả phí, bản mình chưa có |

Nguyên tắc chung: **nhìn vào 1 giây phải đọc ra "đây là vũ trường, kia là người chơi đang nhảy"** — người chơi PHẢI ở trong sân, không phải danh sách/icon ngoài sân.

## 4. Đối chiếu với engine của mình

Engine: `games/di-bar-online/engine.js` — `defaultSettings` + `handleIntake` + `tick`. Số thật (mặc định):

| Cơ chế | Engine mình (số thật) | Nguồn trong engine.js |
|---|---|---|
| Vào bar | Bình luận `vào bar` / `join` / `quẩy` → dancer, random 1 trong 8 nhân vật; bình luận số `1–8` chọn/đổi nhân vật | `detectJoin`, `detectCharacterPick`, `MAX_FLOOR = 24` |
| Sức chứa sàn | Tối đa **24 dancer** trên sàn; người vào sau đứng quầy bar chờ lượt | `MAX_FLOOR = 24`, `floorDancers()` / `waiting` |
| 1 tim | **+1 năng lượng** (delta theo tổng like) | `tapEnergy: 1` |
| 1 bình luận tính điểm | **+5 năng lượng**, chống spam **1 bình luận / 5 giây** | `commentEnergy: 5`, `commentSpamS: 5` |
| 1 xu quà | **+10 năng lượng + 1 ly** đồ uống | `coinToEnergy: 10` |
| Follow | **+30 năng lượng, 1 lần/vòng** | `followEnergy: 30`, `followedRound` |
| Đồ uống | ≥10 xu cocktail; ≥50 xu bottle service (pháo giấy + zoom); ≥100 xu sâm panh (phun cả sàn) | `handleIntake` kind `gift`, tier `cocktail`/`bottle`/`champagne` |
| Vua sàn nhảy | Vòng **3 phút** (180s); dancer nhiều năng lượng nhất khi hết vòng → Vua; vinh danh **20 giây** rồi vòng mới, năng lượng về 0 | `roundDurationS: 180`, `spotlightS: 20`, `endRound`/`resetRound` |
| DJ drop | Mỗi **2 phút** (120s), báo trước **10 giây**, drop **15 giây**, trong drop tim **×2** | `dropIntervalS: 120`, `dropWarningS: 10`, `dropDurationS: 15`, `tick()` |
| Đấu bàn VIP | Bình luận `bàn vàng` / `bàn đỏ`; điểm bàn = tổng năng lượng + số ly; thắng vòng; thắng **2 vòng liên tiếp** → bàn đó "bao cả bar" **1 phút** (dancer của bàn ×2 năng lượng) | `detectTable`, `computeTableScores`, `tableStreak`, `barCover` |
| Demo | `?demo=1` tự chạy 12 dancer demo; dừng khi có event thật; từ chối khi đã có event thật | `startDemo`/`stopDemo`, `demoMode` |

Những gì engine mình **ĐÃ CÓ nhưng overlay cũ chưa thể hiện**: sàn nhảy, DJ, vũ công đứng trên sàn, spotlight vua — đây là việc của đợt làm lại overlay (không cần sửa engine).

## 5. Cơ chế tham khảo có mà engine mình CHƯA CÓ — "cần thêm vào engine" (chưa duyệt)

> ⚠️ Danh sách này chỉ là **đề xuất để Chủ tịch chốt**. KHÔNG tự bịa số, KHÔNG tự thêm cơ chế mới vào engine khi chưa được duyệt. Overlay đợt này chỉ code theo những gì engine hiện có + brief làm lại vũ trường đã duyệt (sàn nhảy, vũ công trên sàn, DJ, spotlight vua, bảng hướng dẫn).

1. **Cánh sau 1.000 tim** ("1k tym có cánh", ảnh 2; Sàn Quẩy/tiktok-live-bar: quà → mọc cánh).
   - Engine hiện: không có cánh, không có mốc tim tích lũy theo người.
   - Đề xuất: thêm mốc tích lũy tim theo dancer (số mốc lấy theo ảnh tham khảo: 1.000 tim — **số tham khảo, chưa chốt**), đạt mốc thì dancer hiện cánh (👼/🪽) trong overlay; cần Chủ tịch chốt mốc + cánh có hết hạn không.
2. **VIP Gift / quà làm người tặng NỔI BẬT** (ảnh 1: banner "đã tặng VIP Gift cho anh em bar!"; Livecade: quà → to lên / spotlight / nhảy hàng trước).
   - Engine hiện: quà chỉ cộng năng lượng + ly + tier cocktail/bottle/champagne (có zoom camera + pháo giấy ở ≥50/≥100 xu), không có trạng thái "nổi bật" bám theo người tặng.
   - Đề xuất: người tặng quà ≥ mốc (vd 50/100 xu — trùng tier bottle/champagne hiện có) được **phóng to + spotlight riêng trong X giây**; cần Chủ tịch chốt mốc + thời gian.
3. **Menu hành động** (ảnh 2: CAMERA, GÓI NV, ĐI VÒNG, NHẢY 1 CÁI, PHÁO HOA, HUY HIỆU + CÁNH, TO LÊN, NHỎ LẠI).
   - Engine hiện: không có menu hành động; camera chỉ auto theo shot + sự kiện; không đổi cỡ nhân vật, không đi vòng, không pháo hoa theo lệnh.
   - Đề xuất: thêm lệnh chat tương ứng (vd `to lên`, `nhỏ lại`, `đi vòng`, `pháo hoa`) hoặc nút dashboard; cần Chủ tịch chốt danh sách lệnh + hiệu ứng nào được làm.
4. **Top gifter / Vua lên bục DJ** (Sàn Quẩy: top 1 lên đứng sau bàn DJ; tiktok-live-bar: Top 3 đứng bục trước bàn DJ với cánh + huy hiệu).
   - Engine hiện: có top 5 + Vua sàn + bàn VIP, nhưng chỉ hiện tên trên LED; không có vị trí bục DJ.
   - Đề xuất: Vua sàn (hoặc top 1) hiện ở vị trí danh dự cạnh DJ trong lúc vinh danh; cần Chủ tịch chốt.
5. **Vào bar bằng chat "1"** (ảnh 2/3: "chat 1 vào BAR").
   - Engine hiện: vào bar bằng `vào bar`/`join`/`quẩy`; chữ `1` hiện là **chọn nhân vật số 1** (`detectCharacterPick`), nên thêm "1 = vào bar" sẽ **xung đột** với chọn nhân vật.
   - Đề xuất: giữ nguyên lệnh vào bar hiện tại, HOẶC đổi cơ chế chọn nhân vật (vd chỉ chọn nhân vật khi đã ở trên sàn) — cần Chủ tịch chốt, không tự đổi.
6. **Thanh "Nhiệt sàn" / DROP tập thể theo hype** (Sàn Quẩy: tim đầy thanh nhiệt → sàn nhảy nhanh ×2 + laser + pháo giấy; Livecade: cả đám hype đủ → DROP chung).
   - Engine hiện: DJ drop theo **thời gian cố định** (mỗi 2 phút), không theo hype tích lũy.
   - Đề xuất: thêm thanh nhiệt sàn tích từ tim/comment cả phòng, đầy thì kích hoạt drop sớm; cần Chủ tịch chốt ngưỡng.
7. **Khách nền giữ sàn đông khi vắng** (tiktok-live-bar: `npcCrowdTarget`; Livecade: auto dancers lấp đầy khi vắng).
   - Engine hiện: không có khách nền; chỉ có demo 12 người (tắt khi live thật bắt đầu).
   - Đề xuất: thêm NPC khách nền (không tính điểm, nhường chỗ cho người thật); cần Chủ tịch chốt có làm hay không.
8. **Bong bóng chat trên đầu vũ công** (Livecade: comment hiện thành bubble trên đầu dancer).
   - Engine hiện: comment chỉ cộng điểm + ghi log; overlay không hiện nội dung chat trên dancer.
   - Đề xuất: hiện câu chat mới nhất của dancer thành bubble nhỏ vài giây; cần Chủ tịch chốt.
9. **Đổi điệu nhảy bằng lệnh** (Sàn Quẩy: 14 điệu qua từ `nhún`/`lắc`/`xoay`/`robot`…).
   - Engine hiện: điệu nhảy gắn cố định với nhân vật (8 nhân vật, mỗi nhân vật 1 điệu `move`); chỉ đổi được nhân vật (số 1–8).
   - Đề xuất: tách điệu nhảy khỏi nhân vật, thêm lệnh đổi điệu; cần Chủ tịch chốt.

## 6. Bản quyền

- Chỉ học format/cơ chế/bố cục từ các nguồn công khai trên. Không tải, không dùng lại ảnh/art/nhạc/clip của bất kỳ nguồn nào.
- Repo `tieumyai07/tiktok-live-bar` ghi MIT trong README nhưng trang GitHub báo license NOASSERTION → **không dùng code/art của repo này** (luật cứng của đội).
- Sản phẩm trả phí (Sàn Quẩy, VNLook, Ông Chú MMO Bar) chỉ đọc mô tả công khai, không mua/không crack/không lấy asset.
- Asset overlay đợt này: tự vẽ bằng CSS/emoji theo chuẩn 2D game asset; nhạc tự tổng hợp WebAudio như cũ (không nhạc ngoài).

## 7. Kết luận — đợt làm lại overlay chỉ làm những gì đã duyệt

- Sàn nhảy lớn ở giữa + vũ công đứng TRÊN SÀN (avatar + tên trên đầu, nhảy theo nhịp, năng lượng cao nhảy mạnh + to/sáng hơn).
- DJ ở quầy trên, gật đầu + gạt đĩa theo nhạc; dừng khi nhạc tắt.
- Spotlight (vòng sáng) chiếu đúng vũ công dẫn đầu trên sàn + vương miện; **bỏ banner chữ to đè lên thẻ**.
- Bảng hướng dẫn với số thật từ engine (mục 4).
- Sửa tiêu đề góc phải bị cắt (rút ngắn nhãn vòng, không để tràn).
- Các mục ở phần 5 để Chủ tịch chốt sau — không code vào đợt này.
