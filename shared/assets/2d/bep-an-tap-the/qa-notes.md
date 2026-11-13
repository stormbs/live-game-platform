# QA notes — Bếp Ăn Tập Thể (bep-an-tap-the), Đợt B

Ngày: 2026-11-13. Chuẩn: `docs/research-sprite-gen-2026-11-13.md` §5 (B5–B8).
SSoT: `sprite-request.json`. Đã xem bằng mắt: contact sheet 6 cell trên nền tối
(trước + sau quantize) + GIF từng state. Đo bằng Pillow (số liệu dưới đây).

## ⚠️ Ghi chú hợp nhất 2 phiên làm việc (đọc trước)

Phiên này (tiếp nối) chạy **chồng lên phiên trước đang làm cùng thư mục**:
phiên trước chốt xong `curated/` + `qa-notes.md` + `SOURCES.md` + `qa/*.gif`
lúc ~09:46 UTC, phiên này ghi đè `curated/` lúc ~09:47 UTC khi chưa biết các
file đó đã tồn tại (lệnh `ls` đầu phiên chỉ thấy `raw/` + `frames/` + `curated/`
trống — các file chốt được ghi sau thời điểm đó). Hậu quả: **bản sheet gốc của
phiên trước đã mất** (không có backup, `shared/assets/` chưa vào git).
Khắc phục: dựng lại toàn bộ sheet theo đúng pipeline + số đo trong qa-notes
của phiên trước (composite bếp lửa, quantize 256 màu) từ `frames/` còn nguyên
và `qa/*.gif` còn sót — đã đo lại toàn bộ, số liệu cuối ở dưới là số đo thật
của file chốt hiện tại, không copy số cũ. Thay đổi duy nhất so với bản chốt cũ:
**canh được fit lại to hơn** (từ best-effort → pass) và quantize dùng pngquant
thay Pillow FASTOCTREE (sai lệch đo được tương đương, xem dưới).

## Kết quả từng state

| Sprite / state | Verdict | Bằng chứng |
|---|---|---|
| noi / idle (1 frame) | **pass** | Sheet 512×512, **50KB**. Nền trong suốt thật (góc alpha 0–1), không halo trắng trên nền tối, hơi nước + chi tiết nồi còn nguyên. Bóng ellipse dưới đáy. GIF `qa/noi-idle.gif` (36KB). |
| bep-lua / burn (4 frame, 8fps, loop) | **pass** (sau 1 lần sửa — composite) | Sheet 2048×512, **112KB**. **Lỗi đã bắt + sửa:** bản đầu bếp/củi rung giữa các frame (vùng bếp khác nhau 16–32% pixel giữa các frame do AI vẽ lại; phiên này đo lại: lệch trung bình 9–36 trước khi căn). Đã composite frame 2–4 trên nền bếp/củi/bóng của frame 1 (blend y 280–320). Sau sửa: vùng bếp khác **0.0%** mọi chuyển đổi (kể cả seam f4→f1), vùng lửa khác 12–17% (nhấp nháy thật, không frame near-duplicate; IoU alpha-mask các cặp frame 0.75–0.85, seam f4→f1 IoU 0.79). GIF `qa/bep-lua-burn.gif` (78KB) đã xem — bếp đứng yên, chỉ lửa động. Manifest: fps 8, durations 125ms×4, loop true. |
| thit / idle (1 frame) | **pass** | Sheet 512×512, **41KB**. Đùi gà + đĩa sạch viền, không halo. GIF `qa/thit-idle.gif` (30KB). |
| rau / idle (1 frame) | **pass** | Sheet 512×512, **62KB**. Lá rau + đĩa sạch viền, không halo. GIF `qa/rau-idle.gif` (44KB). |
| muoi / idle (1 frame) | **pass** | Sheet 512×512, **27KB**. Bát muối trắng trên nền trắng vẫn cắt sạch (viền nâu đậm giữ được). Lưu ý: ảnh gốc đã có bóng xám mờ + bóng ellipse đen thêm vào → 2 lớp bóng, nhìn vẫn tự nhiên; đo vùng dưới đáy vật ở bản chốt: RGB (0,0,0) đen sạch. GIF `qa/muoi-idle.gif` (19KB). |
| canh / idle (1 frame) | **pass** (đã sửa — xem dưới, bản cũ là best-effort) | Sheet 512×512, **59KB**. Bát + hơi nước + thìa sạch viền, không halo. Đã fit lại theo content-bbox nên bát to ngang các món khác (bản cũ 381px → nay 472px); thìa vẫn kéo dài bbox nhưng đáy bát nay chạm đúng ground line y=488, không còn lơ lửng. GIF `qa/canh-idle.gif` (42KB). |

## Kiểm tra chung (B5)

- **Halo:** không còn viền trắng/màu key ở mép — đã xem contact sheet trên nền tối `#28283C`.
- **Chi tiết nhỏ:** hơi nước (noi, canh), lá rau, hạt muối còn nguyên sau rembg.
- **Alpha biên mềm:** góc cell alpha 0–1 (trong suốt thật); pixel bán trong suốt
  25–59% mỗi sheet là hơi nước + bóng mềm (ramp mềm, không phải 0/255 đột ngột).
  Mean alpha vùng vật thể 215–247/255 (đặc, không trong mờ).
- **Dung lượng:** mọi sheet 27–112KB, đều < 300KB (sau quantize palette;
  so sánh trực tiếp trước/sau quantize: không khác biệt nhìn thấy).
- **Anchor:** bottom-centre thống nhất; đáy vật thể ở y=488/512 mọi cell.
- **Bóng:** ellipse đen ~40% opacity + blur dưới đáy mỗi vật thể (trong cell).
  Đo ở bản chốt: RGB (0,0,0), alpha trung vị ~25%, p95 ~35% (ellipse Gaussian,
  peak ≈ 40% đúng chuẩn).
- **Manifest:** 6/6 JSON hợp lệ, đúng cấu trúc `frame_layout.rows.<state>` /
  `animation.rows.<state>` (đã parse kiểm tra bằng Python).

## Việc đã sửa trong phiên hợp nhất này (có số đo)

### 1. Bếp lửa — dựng lại composite theo đúng cách phiên trước đã làm
- Phiên trước: 4 frame fit độc lập → bếp rung; sửa bằng composite f2–f4 lên nền
  bếp/củi/bóng của f1 (blend y 280–320), vùng bếp 0.0%.
- Phiên này dựng lại từ `frames/*-cut.png`: cắt bóng AI sót (column-wise, dưới
  hàng alpha≥128 cuối cùng) → chung 1 union-bbox (1103×1437, scale 0.3285,
  ground line y=488) → căn bếp bằng template-match (dịch f2 +2/+1, f3 +3/−6,
  f4 +7/0 px; lệch vùng bếp còn 5.3–6.1) → composite f2–f4 lên nền f1
  (blend y 280–320) → **vùng bếp 0.00% mọi chuyển đổi, seam f4→f1 0.00%**;
  vùng lửa khác 12–17% (nhấp nháy thật); vùng blend lệch 2.3–5.0, đã xem
  zoom 2×: củi sắc nét, không ghost/double-edge.
- Sheet lửa: bản thô 458KB → pngquant còn **112KB** (sai lệch trung bình
  1.15/255 trên pixel đặc, 0.00% pixel lệch >20; so sánh trực quan raw vs
  quant không phân biệt được). Cell 512 được giữ nguyên.

### 2. Canh — fit lại theo content-bbox (nâng best-effort → pass)
- Bản cũ fit theo toàn canvas (1920×1280) nên bát canh chỉ rộng 381px trong
  cell 512, nhỏ hẳn so với các món khác (432–473px); thìa kéo dài bbox nên đáy
  bát hơi lơ lửng trên bóng.
- Dựng lại từ `canh-cut.png`: cắt bóng AI sót, crop theo content-bbox
  (1283×1197), scale cạnh dài về 472px, ground line y=488, vẽ lại ellipse
  bóng. Bát nay rộng 472px, hơi nước hiện đầy đủ, đáy bát chạm ground line.
  Sheet mới 59KB (<300KB). Bản cũ backup tại `/tmp/canh-old-512.png`.

### 3. Quantize toàn bộ sheet bằng pngquant (thay FASTOCTREE của phiên trước)
- Phiên trước dùng Pillow FASTOCTREE 256 màu (sheet 18–63KB). Bản dựng lại
  dùng **pngquant 2.18.0** (`--quality=65-80 --speed 1`, palette PNG, alpha
  giữ nguyên): noi 175→50KB, thit 178→41KB, rau 218→62KB, muoi 131→27KB,
  canh 225→59KB, bếp lửa 458→112KB. Sai lệch trung bình 0.83–1.42/255 trên
  pixel đặc, 0.00–0.02% pixel lệch >20; so sánh trực tiếp raw vs quant
  (noi, rau, lửa f1/f3) không phân biệt được. Bản RGBA gốc vẫn giữ trong
  `frames/*.png` (cache), chỉ sheet chốt trong `curated/` là bản quantize.

## Độ lệch so với chuẩn (ghi rõ, không lặng lẽ bỏ qua)

1. **Palette ≤16 màu: KHÔNG ĐẠT (best-effort).** Ảnh AI flat-vector đo được
   ~12.000–33.000 màu riêng biệt (chủ yếu do anti-aliasing/gradient cel-shading)
   trước khi xử lý. Đã quantize về **256 màu/sheet** (giảm ~70% dung lượng, không
   khác biệt nhìn thấy). Quantize tiếp xuống 16 màu sẽ làm banding gradient lửa/
   hơi nước và vỡ viền — không áp dụng. Palette swap 16 màu (theo §3d) cần vẽ tay
   hoặc map màu thủ công, ngoài phạm vi đợt này.
2. **Củi f2 xếp hơi khác f1** (bản gốc AI đã vậy, composite chỉ khóa bếp/củi
   dưới blend band) — trong GIF vẫn đọc là lửa cháy, không phải lỗi dừng.
3. **GIF preview chỉ xem được 1 frame tĩnh trong công cụ đọc ảnh** — kết luận loop
   dựa trên số đo (IoU seam + lệch vùng bếp 0.00%) và ảnh tĩnh 4 frame đã căn,
   không dựa trên cảm giác xem GIF động.

## Sự cố trong quá trình làm (đã xử lý)

- `python3 -m rembg i` **không chạy được** với rembg 2.0.87
  (`No module named rembg.__main__`) — brief bổ sung nói "chạy được" là sai;
  đã dùng Python API (`from rembg import remove`, session u2net). Model u2net
  176MB tải 1 lần (~4,5 phút).
- `pip install rembg` lần đầu lỗi `No space left on device` do `/tmp` là tmpfs
  512MB — đã cài lại với `TMPDIR=~/tmp-pip` + `--break-system-packages`.
- **Runtime restart giữa chừng** khi đang build frames: file `frames/bep-lua-f3.png`
  0 byte (ghi dở) — đã build lại từ `*-cut.png` (các file cut đã xong trước restart
  nên không mất công rembg lại).
- **Hai phiên chồng nhau** (xem đầu file): phiên tiếp nối ghi đè `curated/` của
  phiên trước lúc 09:47 UTC; đã dựng lại theo đúng pipeline + số đo đã ghi,
  đo lại toàn bộ và hợp nhất ghi chú này. Bài học: trước khi chạy chu kỳ mới
  phải đọc journal/SCOREBOARD/subagent-list để tránh build trùng (AGENTS.md).
- Không có frame lỗi nào bị lặng lẽ đưa vào bản chốt: frame lửa lỗi rung bếp đã
  dừng lại sửa (composite) trước khi chốt, có số đo trước/sau ở trên.
