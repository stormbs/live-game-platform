# QA Notes — Đua Xe Leo Núi (dua-xe-leo-nui) — 2026-11-13

SSoT: `sprite-request.json` (cell xe 1024×512, cờ 512×1024, mây 512×256;
anchor bottom-centre; idle 4f @4fps loop; drive 4f @8fps loop).
Pipeline: `build-sprites.py` (rembg u2net → fit cell → posterize 16 màu →
palette-swap bake → sheet + manifest). Mọi số dưới đây đo trực tiếp trên file
chốt của lần chạy cuối (sheet xe 278.588 B), kiểm bằng mắt trên nền tối
`#1E1E2E` + đo bằng số. Ghi chú này thay bản nháp của phiên song song
(xem § "Ghi chú phiên làm việc").

## Kết quả bake (curated/bake-report.json)

- Base: `raw/xe-base-raw.png` (xe đỏ AI) — **đã lật ngang**: ảnh gốc quay đầu
  sang TRÁI, sprite-request yêu cầu facing-right (đầu xe phải, khói xả trái)
  nên flip ngang khi fit cell. Đã kiểm bằng mắt: đèn pha phải, pô + cánh gió
  trái, khớp xe CSS hiện tại.
- Sau rembg + fit cell: posterize 16 màu chính (xem `palette16` trong
  manifest) — ảnh AI gốc có ~52.000 màu (gradient nhiễu), posterize làm đúng
  chuẩn flat-vector/cel-shading và giúp sheet nén được.
- Base red: `#FD2C27`. Red family: **7 màu / 85.986 px**.
- 5 colourway, mỗi màu: substituted **7 màu**, `unused_sources: []`
  (không có — map xây từ đúng màu có trong ảnh), passthrough **9 màu**
  (kính xanh `#B2DFDB`, vàng accent `#FDCA14`, lốp/viền navy, nâu pô...).
- Alpha byte-identical giữa 5 màu: **đã kiểm chứng (0 px khác)** trên sheet
  RGBA master (so alpha channel do_idle f0 vs tim_idle f0).
- Màu thân đo được trên sheet chốt vs target (vùng cánh sau, mode màu):

| Màu | Target | Đo được | Chênh |
|---|---|---|---|
| do | #E5322D | #E4322D | 1 level |
| xanh-duong | #1E90FF | #1E8FFF | 1 level |
| vang | #FFCF3D | #FDCB20 | vàng đậm hơn chút (trộn với accent vàng) |
| xanh-la | #22C55E | #22C45E | ~1 level |
| tim | #A855F7 | #AB5CF6 | ~2 level |

Chênh do sheet chốt là bản quantize 32 màu (xem § "Dung lượng"); bản RGBA
master giữ đúng hex target từng pixel (assert trong script).

## QA từng state

| State | Verdict | Bằng chứng |
|---|---|---|
| idle (4f, 4fps, loop) | **pass** | Bob dọc đo trên sheet RGBA master: đỉnh xe y=162/160/164 px (cols 0/1/3) = đúng [0,-2,+2]; seam khép (bước +2→0 bằng các bước 2px khác: diff 83.501 px). Frame 2 = frame 0, dùng chung rect (ô col 2 trên sheet đo được max alpha 0 ở bản RGBA — trống thật). GIF `qa/idle-do.gif`: 4 frame × 250 ms. |
| drive (4f, 8fps, loop) | **pass** | Mâm xe xoay 0/90/180/270° chiều kim đồng hồ (xe chạy sang phải): diff giữa các frame liên tiếp đều đúng **10.115 px**, bbox diff x[168,819] y[329,452] = chỉ 2 đĩa mâm, thân xe đứng yên (alpha drive f0 = alpha idle f0, 0 px khác; số pixel vàng trong mâm ổn định ~3.710/frame). Seam khép: f3→f0 cũng 10.115 px. GIF `qa/drive-do.gif`: 4 frame × 120 ms (~8 fps). |
| static cờ đích | **pass** | 1 frame 512×1024; caro đen trắng + cán cờ nguyên vẹn sau rembg; không halo (kiểm bằng mắt trên nền tối). |
| static mây | **pass** | 1 frame 512×256; vendor Kenney, đã trong suốt sẵn, không cần rembg. |

## Checklist B5 (sau rembg / cắt nền)

- [x] Không halo màu key ở viền: xe cut chỉ **7 px** gần-trắng bán trong
      suốt; cờ kiểm bằng mắt trên nền tối — sạch (số halo của cờ không có ý
      nghĩa vì caro trắng là chi tiết thật, không phải viền).
- [x] Chi tiết nhỏ còn nguyên: pixel vàng accent raw 56.666 → cut 56.564
      (**99,8%** giữ lại).
- [x] Alpha biên mềm: rembg u2net cho alpha nội thất 251–254 (gần như đặc,
      nhìn không khác 255) + ramp mềm ở biên; không có bậc 0/255 ở viền
      (kiểm bằng mắt trên nền tối).
- [x] PNG < 300 KB: xe sheet **278.588 B (272,1 KB)**; cờ **189.987 B**;
      mây **30.214 B**. (Sheet xe RGBA master 2.118.707 B giữ kèm để đối
      chiếu: `xe-dua-sheet-rgba.png`.)
- [x] Bóng: ellipse đen mờ dưới chân, trong từng frame, đúng ground line
      (đáy bánh y=478 trong cell 512; đo trên sheet: 13.229 px đen bán trong
      suốt ở y479–495, tâm alpha 88 ≈ 35%).
- [x] Không chữ/logo trong ảnh. Đúng phong cách 2D game (flat vector,
      cel-shading, viền đậm, màu bão hòa).

## Dung lượng — cách đạt <300 KB (ghi rõ để khỏi ai "tối ưu" lại sai)

Sheet RGBA 40 frame ở cell 1024×512 là **2.118.707 B**; pngquant 65–80 chỉ
xuống 437 KB. Bản chốt dùng: posterize base 16 màu + quantize sheet
FASTOCTREE 32 màu, không dither → **278.588 B**, kiểm bằng mắt không thấy
khác bản RGBA (so sánh 6 frame mẫu: 5 màu + drive). Tác dụng phụ duy nhất
của quantize (đã đo, không nhìn thấy khi hiển thị):
- 4 góc sheet chốt alpha = **2** thay vì 0 (bản RGBA master = 0); viền ngoài
  cùng của outline đậm (alpha 31–44 ở master) về alpha 2 — outline vẫn đặc
  vì pixel outline đặc dùng palette entry khác (alpha 254). Không sửa vì sửa
  sẽ phá các pixel khác cùng palette entry.

## Vấn đề đã biết (best-effort, không chặn)

1. **Xe vàng:** accent vàng (tròn cửa, váy xe, cánh gió) chìm vào thân vàng —
   chỉ còn viền đậm định hình. Mâm xe vẫn nổi (vàng trên lốp đen). Xe vẫn
   nhận diện rõ là màu vàng. Khắc phục sau (nếu cần): map accent → trắng
   riêng cho colourway vàng trong `bake_map`.
2. **GIF chỉ là preview:** Pillow ghi duration 120 ms thay vì 125 ms
   (8 fps ≈ đúng); GIF idle f0 vs f2 lệch 1.982 px (0,38%) do palette của
   GIF — sheet chốt dùng chung rect nên f0 = f2 tuyệt đối. Manifest giữ
   đúng durations_ms 250/125.
3. **`python3 -m rembg` KHÔNG chạy được** với rembg 2.0.87 (không có
   `__main__`); `remove()` mặc định đòi tải model `bria-rmbg-2.0.onnx`
   (~1,02 GB, ~10–25 phút). Cách chạy đúng: Python API +
   `new_session('u2net')` (model cache tại `~/.rembg/models/u2net/u2net.onnx`,
   cắt 2 ảnh hết ~13 giây).
4. **Màu đỏ vs cam:** overlay hiện dùng `CAR_COLORS` 5 màu trong đó có cam
   `#F97316`, còn sprite-request chốt đỏ `#E5322D`. Khi gắn Đợt C: hoặc map
   slot cam → sprite đỏ, hoặc bake thêm colourway cam từ cùng base (1 dòng
   trong `COLORWAYS`, chạy lại script). Xem `SOURCES.md`.
5. **Hai bánh xe AI vẽ không đều nhau:** mâm sau r≈102 px, mâm trước r≈94 px,
   tâm lệch nhau 11 px theo chiều dọc — đã đo hình học từng bánh riêng
   (không giả định 2 bánh giống nhau); đáy lốp thì thẳng hàng (y=561).
6. **Mây chạm mép trên/dưới cell** (asset vendor gốc đã vậy) — là mây trôi
   nền nên chấp nhận được.

## Ghi chú phiên làm việc

- Nhân viên trước bị ngắt giữa chừng (server restart); công việc dở dang trên
  đĩa gồm `sprite-request.json` + 3 file `raw/` + `frames/may.png` — đã tiếp
  nối, không làm lại từ đầu.
- Trong lúc làm có **phiên song song** cùng sửa thư mục này (nó viết bản
  `SOURCES.md` / `qa-notes.md` nháp lúc 10:00:53 và từng chạy pipeline); bản
  qa-notes này viết lại từ số đo của lần chạy cuối (10:02) để tránh số liệu
  không kiểm chứng. Nếu phiên kia còn chạy, file chốt có thể bị ghi đè sau
  thời điểm này — cần đối chiếu `stat` trước khi gắn Đợt C.
- Không sửa code overlay nào.

## File chốt (overlay chỉ đọc curated/)

- `curated/xe-dua-sheet.png` (4096×5120, 278.588 B) + `xe-dua-manifest.json`
- `curated/xe-dua-sheet-rgba.png` (master RGBA, 2.118.707 B, đối chiếu)
- `curated/co-dich-sheet.png` (512×1024, 189.987 B) + `co-dich-manifest.json`
- `curated/may-sheet.png` (512×256, 30.214 B) + `may-manifest.json`
- `curated/bake-report.json`, `curated/qa/idle-do.gif`, `curated/qa/drive-do.gif`
