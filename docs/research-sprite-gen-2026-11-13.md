# Nghiên cứu GitHub: Skill/Repo làm game 2D tốt nhất cho 14 overlay TikTok LIVE

- Ngày: 2026-11-13
- Người làm: nhân viên nghiên cứu, công ty Strom
- Bối cảnh: 14 overlay HTML/CSS/JS, khung dọc 1080×1920, phong cách 2D game asset
  (flat vector, cel-shading, viền đậm, màu bão hòa). Đội đang làm sprite Đợt B
  cho 5 game (xe đua ngang hông 5 màu, cờ vải, thuyền rồng + người chèo,
  4 giai đoạn hoa, nồi + món ăn) bằng cách vendor CC0 trước rồi tự tạo + rembg.

## 1. REPO ĐÃ CHỌN

### aldegad/sprite-gen — https://github.com/aldegad/sprite-gen
- **Giấy phép: Apache-2.0** (đã đọc trực tiếp file `LICENSE` trong repo clone về
  `/tmp/sprite-gen`, dòng đầu "Apache License, Version 2.0, January 2004").
- **Số sao: 4.046 ★, 420 fork, 1.273 commit, 92 release** (đọc trực tiếp trang GitHub).
- Là **skill + Python CLI** hoàn chỉnh: pipeline tạo sprite từ 1 ảnh tĩnh →
  atlas + manifest + QA, kèm recolor (palette swap), background tile,
  projected shadow, breathe (idle breathing), scene composition (parallax),
  engine export (Aseprite JSON cho Phaser/Flame).
- Lý do chọn: khớp trực tiếp nhất với Đợt B/C của đội — recolor 5 xe đua 5 màu,
  background-tile cho parallax, manifest frame rects thay cho CSS animation tự chế,
  chroma→alpha unmix (đúng vấn đề rembg/cắt nền), breathe cho nhân vật đứng yên.
- **Lưu ý quan trọng:** phần *tạo ảnh* của sprite-gen chạy qua codex/Grok
  (cần đăng nhập/subscription, tính phí theo lượt). Đội KHÔNG cần phần đó —
  nguồn ảnh của đội là Google Flow (Imagen) + vendor CC0. Chỉ áp dụng **phần
  pipeline xác định (deterministic)** của họ: extract/compose/recolor/tile/
  shadow/breathe/scene — toàn bộ là Python/Pillow + ffmpeg, không cần provider.
  Không cần cài nguyên skill; học thiết kế rồi reimplement các mảnh nhỏ bằng Pillow.

## 2. ỨNG VIÊN ĐÃ LOẠI (đều đã đọc trực tiếp file LICENSE — MIT thật)

| Repo | Sao | Giấy phép | Lý do loại |
|---|---|---|---|
| patch-gg/pixelfx — https://github.com/patch-gg/pixelfx | 7.255 ★, 939 fork | MIT | **Giữ làm bổ sung, không phải lựa chọn chính.** 244 hiệu ứng pixel art bằng code (lửa, nổ, pháo hoa, thời tiết, UI, pickups) + skill, export sprite sheet PNG trong suốt + Aseprite JSON. Chỉ làm hiệu ứng, KHÔNG làm nhân vật/cảnh. Dùng cho: pháo hoa Bầu Trời, lửa Bếp Ăn, confetti Đi Bar. Font Patch Pixel KHÔNG thuộc MIT — đừng dùng font đó. |
| 0x0funky/agent-sprite-forge — https://github.com/0x0funky/agent-sprite-forge | 5.633 ★, 547 fork | MIT | 1 ảnh tĩnh → bộ sprite đầy đủ (idle/walk/run/attack/jump/hurt) nhưng dùng **image-to-video clip cho mỗi action** + pipeline Python, có hibit (flat art → pixel art) và palette 16 màu. Nặng hơn sprite-gen, phụ thuộc video model; đội không có video model rẻ/ổn định cho việc này. Chỉ dùng khi cần walk/run thật. |
| KilledByAPixel/LittleJS — https://github.com/KilledByAPixel/LittleJS | 4.383 ★, 238 fork | MIT | Engine HTML5 nhỏ: parallax layers lặp vô hạn, texture sheets/atlas, particles, 100+ ví dụ + 50 game mẫu. Tốt để **học mẫu parallax + atlas**, nhưng là engine nguyên khối — overlay của đội là DOM/CSS/JS, không chuyển sang engine. Chỉ lấy pattern, không lấy engine. |
| WU-HAOTIAN34/2dimg2motion — https://github.com/WU-HAOTIAN34/2dimg2motion | 269 ★, 11 fork | MIT | Skill chuyển 1 ảnh nhân vật tĩnh → chuỗi animation trong suốt 14 khung (00/02/05/08/11/13), identity lock + topology lock, validator, manifest.json, spritesheet. **Phương án dự phòng** đơn giản hơn sprite-gen; nhưng 14 khung là quá nhiều theo chuẩn sprite-gen (xem §3c) và ít sao/cộng đồng hơn hẳn. |
| skulitom/Pixelbolt — https://github.com/skulitom/Pixelbolt | 86 ★, 8 fork | MIT | Pixel art theo công thức JSON → PNG/APNG/atlas, khung tối đa 256×256. **Loại: lệch phong cách** — đội làm flat vector/cel-shading, không làm pixel art. |

## 3. BÀI HỌC CỤ THỂ TỪ sprite-gen

### (a) Sprite tổ chức thế nào — spritesheet + manifest, không phải file rời
- 1 atlas PNG trong suốt duy nhất (`sprite-sheet-alpha.png`) + 1 `manifest.json`.
  `manifest.frame_layout.rows.<state>` = danh sách rect tuyệt đối `{x, y, w, h}`
  theo đúng thứ tự phát; `manifest.animation.rows.<state>` = `{fps,
  durations_ms[], loop, frames}`. **Runtime KHÔNG suy grid từ alpha** — nó chỉ
  đọc manifest. JS overlay chỉ cần đổi `background-position` theo rect, không
  đổi `src`, không giật, ít request.
- Mọi frame của 1 state dùng **chung 1 cell size cố định** (VD 512×512),
  anchor mặc định **bottom-centre** (chân chạm đất, mọi frame chung 1 ground line).
  Frame trùng nhau (link clone, VD frame nghỉ lặp lại) **dùng chung 1 rect** —
  tiết kiệm texture, không nhân bản file.
- Áp dụng: sprite đội đang làm là từng PNG rời, kích thước không thống nhất,
  không có manifest → gắn vào overlay sẽ bị nhảy vị trí khi đổi frame, phải
  hard-code từng frame. Đợt C phải gom mỗi nhân vật/vật thể thành 1 sheet +
  1 manifest JSON theo đúng cấu trúc trên.

### (b) Cảnh parallax — 3 lớp, tốc độ tỉ lệ, tile có đo seam
- Scene spec của sprite-gen: mỗi layer có `parallax` (0 = đứng yên theo camera,
  1 = theo camera đầy đủ), `plane` với `velocity`, `repeat_x` + `period` cho dải
  lặp, `z` xếp lớp. Công thức vị trí màn hình:
  `at + (plane_v + layer_v)·t − (camera.at + camera.v·t)·parallax`.
- Background recipe: building + mặt đất vẽ **chung 1 phối cảnh**; núi xa / trời /
  cây **tách riêng** để parallax khác nhau; silhouette phải **đầy đủ + margin
  trong suốt/key-colour mọi phía** (cái đã bị cắt không khôi phục được); bóng
  tách riêng; tile lặp dùng overlap 32px và **đo seam bằng số + kiểm tra mắt
  ≥2 bản sao kề nhau** (`background-tile --axis x --period 512 --overlap 32`).
- Áp dụng cho overlay 1080×1920: chuẩn **3 lớp** — xa (parallax 0.2–0.3:
  trời/mây/núi), giữa (0.5–0.6: cây/nhà/thuyền xa), gần (1.0: mặt đất/nhân vật).
  Lớp gần nhanh gấp ~3–5 lần lớp xa. Hiện overlay chỉ có 1 lớp nền gradient phẳng
  + mây drift CSS — Đợt C tách nền v2 thành 2–3 lớp PNG trong suốt chồng nhau,
  mỗi lớp `translateX` với duration tỉ lệ nghịch parallax.

### (c) Nhân vật animation — ít frame, đúng số, seam khép kín
- Bảng số chuẩn (đã đo thực nghiệm trong `docs/states-and-frames.md`):
  - `idle`: **4 frames, loop, 4 fps**. `jump` / `attack`: **4 frames, 8 fps,
    không loop** (crouch → takeoff → airborne → landing; windup → strike → recovery).
  - `wave`: 4 frames, không loop; 5 frames chỉ khi frame cuối trở về gần frame 1.
  - **6 frames là giới hạn trên thận trọng** cho action đơn giản. 8 frames chỉ cho
    mascot nhỏ / locomotion, phải qua motion QA. **9 và 12 frames là anti-pattern**:
    đã đo là tăng duplicate bodies, empty/sparse frames, slot collapse, extract fail
    mà không thêm mượt.
  - `walk` / `run` là **experimental** — cần QA foot-contact thật (cùng 1 bàn chân
    chạm đất, đo stride), không được lặng lẽ nâng lên thành "đã xong".
- Loop là **vòng tròn**: frame cuối phải khớp frame đầu (wrap/seam). Kiểm tra bằng
  GIF preview xem như motion thật + `inspect-holds` (phát hiện frame bị lặp ngoài
  ý muốn: 2 frame liên tiếp giống nhau với IoU ≥ 0.98 là near-duplicate).
- **Breathe layer — idle sống động không cần vẽ thêm frame:** 1 pose tĩnh + warp
  xác định: đầu giữ **bit-identical** (rigid boundary ở cổ, không nhúc nhích);
  ngực phồng theo trọng số cos² quanh tâm ngực, vai theo sau chậm 0.08 chu kỳ;
  inhale 40% / exhale 60%; phase 0 = đúng ảnh gốc nên seam loop không giật.
  Static-pose recipe: 1 frame tĩnh + link clone = **18 cells** (breaths 3 ×
  6 frames/breath @4fps, loop ~4.5s). Loop 11 cells cũ bị loại vì gây rung
  (1px phase toggle mỗi frame). Áp dụng ngay: người chèo thuyền, đầu bếp, người
  trồng hoa… chỉ cần 1 ảnh + breathe (bake 6-frame loop hoặc CSS scaleY vùng ngực),
  **đừng vẽ 8 frame idle**.
- Shadow: bóng đổ là silhouette bị ép dẹt + nghiêng — `squash 0.25, shear 0.8,
  opacity 0.4, blur 3, màu tối (20,15,30)`, đặt tại anchor của sprite. Overlay
  hiện chưa có bóng cho nhân vật → bản đơn giản hoá đúng nguyên lý: ellipse mờ
  (radial-gradient đen 40%) dưới chân mỗi nhân vật.

### (d) Kỷ luật bảng màu + viền + bóng
- **Recolor = bake xác định, KHÔNG phải filter runtime.** 1 base sheet → N biến thể
  bằng palette map exact-match (RGB phải bằng đúng mới đổi), alpha giữ nguyên
  byte-identical, mọi biến thể dùng chung 1 manifest. Báo cáo bake ghi rõ
  `substituted / unused_sources / passthrough_colors` — màu ngoài map không được
  lặng lẽ bỏ qua. Runtime tint (CSS hue-rotate/filter) bị cấm trong triết lý này:
  làm lem viền, không QA được từng pixel.
- **Áp dụng trực tiếp cho 5 xe đua 5 màu: vẽ ĐÚNG 1 xe base, bake 5 colourway
  bằng palette swap** (script Pillow ~30 dòng: đọc PNG, map hex→hex, giữ alpha).
  Không vẽ lại 5 xe, không dùng CSS hue-rotate. Tiết kiệm ~80% công vẽ và đảm bảo
  5 xe đồng nhất hình học tuyệt đối.
- Mỗi sprite **≤16 màu chính** (kể cả outline + highlight + shadow). Palette nhỏ =
  dễ swap, dễ QA. Đếm màu theo tần suất trước khi chốt sprite.
- Viền: outline đậm 1px; khi scale phải tách coverage và colour khi resample
  (kiểu `resize_cell`) để không sinh viền sáng/key tint; scale 1 = byte-identical.
  Trong CSS: `image-rendering: pixelated` cho pixel art; tránh `transform: scale`
  không nguyên trên sprite có viền (gây mờ viền).
- Chroma key (đúng vấn đề cắt nền của đội): chọn key **XA hue chủ đạo của subject**
  — hồng/tím/đỏ → xanh lá `#00FF00`; xanh lá/teal → magenta; xanh dương → tránh
  cyan/blue key. Bán kính erase mặc định 96. **Unmix thay vì peel:** blend ở biên
  được tách thành despilled RGB + partial alpha (giữ sợi tóc/viền mảnh), không cắt
  nhị phân thành bậc thang. Đội dùng rembg (AI matting, tốt hơn chroma) nhưng vẫn
  phải kiểm tra sau cắt (xem §4.8).

### (e) Pipeline asset — 1 SSoT số học, fail-loud, deliver từ curated/
- Pipeline chuẩn: `prepare` (1 file `sprite-request.json` là SSoT số học: cell,
  chroma key, states, frame counts, fps, fit) → `generate` (chỉ 1 lần AI duy nhất
  cho mỗi state row) → `extract` (xác định; **fail thì không publish gì** vào
  `frames/`, lỗi ghi `extract-failure.json`) → `curate` (sidecar, không phá frames
  gốc) → `compose` (atlas + manifest) → `QA` (GIF preview + contact sheet +
  inspect/score, ghi `qa-notes.md` với pass/best-effort/experimental từng state)
  → deliver từ `curated/`, **không bao giờ copy từ `frames/`** (frames là cache
  chưa qua curation — copy từ đó là lặng lẽ vứt bỏ mọi chỉnh sửa).
- Nguyên tắc bất biến: ảnh gốc (raw) không bao giờ bị ghi đè; mọi chỉnh sửa là
  sidecar/lớp mới; corrupt record thì fail-loud, không đọc như "trống".
- Curation view luôn hiện: base reference row (identity truth) + mỗi state ghi rõ
  nó được tạo từ đâu (anchor/basis/guide).

## 4. ĐỐI CHIẾU: ĐỘI ĐANG LÀM ĐÚNG / SAI / LỆCH

### Đang làm đúng
- Vendor CC0 trước, tự tạo sau — đúng thứ tự của sprite-gen (dùng asset có sẵn
  trước khi tạo mới).
- Có fallback CSS/emoji cũ; làm theo đợt có checklist; ảnh nền v2 đúng chuẩn 2D.

### Sai / lệch so với cách chuẩn
1. **Chưa có SSoT số học** (`sprite-request.json`): cell size, frame counts,
   anchor đang nằm rải rác trong đầu/prompt từng người → sprite các game sẽ lệch
   kích thước/anchor, gắn vào overlay bị nhảy hình.
2. **5 xe đua:** nếu vẽ 5 xe riêng là sai. Phải 1 base + recolor bake (§3d).
3. **Sprite rời rạc từng PNG, không có manifest** → overlay hard-code từng frame.
   Cần sheet + `manifest.json` frame_layout + anchor bottom-centre thống nhất (§3a).
4. **Tham frame animation:** giữ 4–6 frames/state; 9–12 frames là anti-pattern
   đã đo (§3c).
5. **Nhân vật tĩnh định vẽ nhiều frame idle là lãng phí:** dùng breathe, 1 frame
   + warp (§3c).
6. **Nền 1 lớp gradient phẳng:** cần tách 2–3 lớp parallax + tile có đo seam (§3b).
7. **Chưa có QA gate bằng GIF preview + hold detection; chưa có quy tắc fail-loud:**
   frame lỗi có thể lặng lẽ chui vào overlay.
8. **Cắt nền bằng rembg mà không kiểm tra halo/màu chủ đạo sau cắt** (xem checklist).
9. **Chưa có bóng đổ cho nhân vật** (§3c cuối).
10. **Palette chưa giới hạn số màu** → recolor sau này khó (§3d).

## 5. CHECKLIST ÁP DỤNG CHO ĐỘT B/C

### Đợt B — làm sprite (mỗi sprite phải qua đủ mục mới được coi là xong)
- [ ] B1. Viết `sprite-request.json` cho mỗi game TRƯỚC khi tạo sprite: cell size
  (đề xuất 512×512 cho nhân vật, 1024×512 cho thuyền/xe ngang), states + frame
  counts (idle 4, action 4, tối đa 6), fps (idle 4, action 8), chroma key
  (xa hue chủ đạo, §3d), palette ≤16 màu.
- [ ] B2. Xe đua: vẽ ĐÚNG 1 xe base → bake 5 colourway bằng palette swap
  (Pillow, giữ alpha byte-identical, chung 1 manifest). Kiểm tra report:
  không có `unused_sources` (map sai) và `passthrough_colors` phải được nêu tên.
- [ ] B3. Mọi sprite: 1 cell size thống nhất/game, anchor bottom-centre, nền key
  phẳng hoặc trong suốt ngay từ lúc tạo (không để nền loang/gradient — cắt nền
  sẽ lỗi).
- [ ] B4. Frame counts: idle 4, action 4–6, KHÔNG 9/12. Nhân vật đứng yên:
  1 frame + breathe (18 cells = 3 breaths × 6 @4fps), không vẽ nhiều frame idle.
- [ ] B5. Sau rembg/cắt nền, kiểm tra từng sprite: (1) viền không còn halo màu
  key (xanh lá/magenta bám mép); (2) màu chủ đạo + chi tiết nhỏ (<1% pixel:
  mắt, ngọc, đèn) còn nguyên sau cắt — đếm pixel màu đó trước/sau; (3) alpha ở
  biên có ramp mềm (không phải 0/255 đột ngột); (4) PNG <300KB, alpha thật
  (không phải nền trắng giả trong suốt).
- [ ] B6. Mỗi nhân vật/vật thể có bóng: ellipse mờ dưới chân (bản đơn giản) hoặc
  projected shadow (squash 0.25, opacity 0.4).
- [ ] B7. Gom mỗi nhân vật/vật thể thành 1 sheet + `manifest.json`
  (`frame_layout.rows.<state>` = rect tuyệt đối, `animation.rows.<state>` =
  fps/durations_ms/loop). Frame trùng nhau dùng chung 1 rect.
- [ ] B8. QA mỗi state: xuất GIF preview xem như motion thật; loop seam khép
  (frame cuối khớp frame đầu); ghi `qa-notes.md` (pass/best-effort/experimental).
  Frame lỗi → dừng, không lặng lẽ dùng.
- [ ] B9. Lưu trữ: `raw/` (ảnh gốc, không bao giờ ghi đè) → `frames/` (đã cắt,
  cache) → `curated/` (bản chốt để gắn overlay). Overlay chỉ đọc từ `curated/`.

### Đợt C — gắn vào overlay
- [ ] C1. Nền v2 tách 3 lớp parallax (xa 0.2–0.3 / giữa 0.5–0.6 / gần 1.0),
  mỗi lớp PNG trong suốt riêng, `translateX` với duration tỉ lệ nghịch parallax.
  Tile lặp phải đo seam + kiểm tra mắt ≥2 bản sao kề nhau.
- [ ] C2. Thay emoji/CSS làm hình chính bằng sprite sheet + manifest; JS đổi
  `background-position` theo rect, không đổi `src`.
- [ ] C3. Hiệu ứng bằng code (pixelfx — MIT, bổ sung): pháo hoa Bầu Trời, lửa
  Bếp Ăn, confetti Đi Bar — export sheet PNG trong suốt + Aseprite JSON, gắn
  như sprite thường. Không dùng font của pixelfx.
- [ ] C4. Thêm bóng dưới chân nhân vật + kiểm tra lại toàn bộ overlay ở 1080×1920:
  không nhảy vị trí khi đổi frame, không mờ viền khi scale, loop idle không giật
  ở seam.
- [ ] C5. Deploy → kiểm chứng live từng game theo checklist nghiệm thu 7 điểm
  trong `docs/ui-upgrade-plan-2026-11-13.md` (font thật, nền có chiều sâu,
  không emoji làm hình chính, chữ ≥20px, panel kính, sự kiện có phản hồi,
  luôn có chuyển động).

## 6. NGUỒN ĐÃ ĐỌC (xác minh trực tiếp)
- Clone `--depth 1` https://github.com/aldegad/sprite-gen về `/tmp/sprite-gen`
  (708 file); đã đọc: `SKILL.md`, `docs/run-contract.md`,
  `docs/states-and-frames.md`, `docs/recolor.md`, `docs/asset-tools.md`,
  `docs/chroma-alpha.md`, `docs/atlas-workflow.md`, `docs/breathing.md`,
  `docs/engine-export.md`, `docs/scene.md`, `sprite_gen/compose/compose_atlas.py`;
  file `LICENSE` đọc trực tiếp (Apache-2.0).
- 5 repo còn lại: đã đọc trực tiếp trang GitHub + file LICENSE (MIT) và số sao
  trong phiên làm việc này.
