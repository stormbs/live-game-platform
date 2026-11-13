# AGENTS.md — live-game-platform

Nền tảng TikTok LIVE game: 1 server Node Express + Socket.io, nhiều phòng.
Overlay: `/o/<game>/<username>` — Dashboard: `/room/<game>/<username>`.
Repo: https://github.com/stormbs/live-game-platform — nhánh `main`.
Deploy: Railway (project unique-empathy), **auto-deploy TẮT** — deploy tay sau khi push.

## Luật cứng — vi phạm là hỏng việc

1. **TUYỆT ĐỐI KHÔNG chạy `npm run build`.**
   `scripts/build-engines.js` xóa `games/thap-sang-ban-do/src/` rồi vendor lại từ
   bản gốc ngoài repo, xóa sạch mọi sửa tay trong đó. Không bao giờ chạy.

2. **Luật URL của `lib/transform.js` (quan trọng nhất khi sửa overlay/dashboard).**
   Mọi literal chuỗi trong HTML/JS được serve mà khớp mẫu quote + `/` + từ khóa
   (`api|assets|voice|music|avatars|audio|css|js|provinces.json|islands.json|
   overlay.html|index.html|dashboard|socket.io`) sẽ bị viết lại thành đường dẫn
   có prefix phòng `/o/<game>/<room>/...`.
   → Code overlay/dashboard KHÔNG được chứa literal như `'/api/...'` hay `'/music/'`.
   Phải ghép URL bằng biến, vd: `location.origin + '/' + 'api' + '/webhook?...'`.
   URL tuyệt đối `/shared/...` AN TOÀN (segment đầu là `shared`, không khớp mẫu).
   Không dùng URL tương đối cho file tĩnh (overlay serve ở `/o/<game>/<room>`
   không có `/` cuối nên URL tương đối resolve lên 1 cấp → 404).

3. **Tên phòng KHÔNG chứa dấu gạch ngang `-`.** Dùng gạch dưới `_` hoặc chấm.

4. **Chỉ commit file của mình.** Trước khi commit, chạy `git status` và `git diff`.
   File người khác đang sửa dở (modified/untracked không phải của mình) thì
   KHÔNG add, KHÔNG commit thay. Khi commit chỉ add đúng file mình sửa.

5. **Test trước khi push:** `npm test` (`node --test test/*.test.js`).
   Full suite có 2 fail có từ trước ở `test/tikfinity.test.js` (guide 6 URL /
   dashboard 6 Action — test chưa cập nhật theo hướng 1-Action), không do game
   gây ra, không chặn deploy. Fail mới ngoài 2 cái đó thì phải sửa.

6. **Không bịa số liệu, không xác nhận suông.** Chỉ báo xong khi có bằng chứng
   kiểm chứng được: test chạy, link live mở được, screenshot đã tự xem.

## Cấu trúc

- `server.js` — server chính, room dispatcher, webhook chung
  `POST /api/webhook?game=<slug>&room=<username>`.
- `lib/` — `rooms.js` (registry GAMES), `game-common.js` (`parseTikFinityEvent`),
  `tiktok.js`, `guide.js`, `transform.js`, `dispatch.js`, `webhook-bodies.js`,
  `buff.js`, `tikhub.js` (+ `*-routes.js`, `*-store.js`).
- `games/<slug>/` — mỗi game: `engine.js` (thap-sang-ban-do là `engine.mjs`) +
  `src/public/{overlay,index}.html` (thap-sang dùng `dashboard.html`) +
  `test/<slug>.test.js` + `TESTING.md`.
- `shared/` — asset dùng chung: `ui.css`, `ui.js`, `music.js`, `meme.js`,
  `meme.css`, `fonts/`, `bg/`, `assets/2d/<slug>/curated/`.
- `public/landing.html` — danh sách GAMES ghi cứng, thêm game mới phải sửa cả
  `landing.html` lẫn `lib/rooms.js`.
- `.gitignore`: `shared/assets-vendor/*` (trừ SOURCES.md),
  `shared/assets/2d/*/raw/`, `frames/`, `cut/` — chỉ `curated/` + SOURCES.md
  mới commit/deploy.

## Hệ nhân vật meme (bắt buộc cho mọi game có người chơi)

- 12 mặt trong `shared/assets/2d/meme/curated/` (512×512, nền trong suốt):
  trollface, panda (Hà Nhân), forever_alone, serious, rage, me_gusta, yuno,
  cereal, poker, crying, okay, angry. Manifest: `curated/manifest.json`.
- Dùng helper `shared/meme.js` (`window.MemeFaces`):
  `faceImgIn(p, players, cls)` / `assignFaces(players)` — gán THAM LAM theo
  danh sách toàn game: **mỗi người chơi 1 mặt KHÁC NHAU**, tới khi hết 12 mặt
  mới lặp. Không dùng `faceFor` riêng lẻ (sẽ trùng mặt).
- Kèm `shared/meme.css` (`.meme-face`: fill khung, object-fit contain,
  drop-shadow nhẹ, KHÔNG cắt tròn).
- Nguồn + rủi ro bản quyền: `shared/assets/2d/meme/SOURCES.md`.
  (Chủ tịch đã nghe rủi ro bản quyền trollface và vẫn chốt dùng ảnh gốc.)
- Mẫu chuẩn: game Kéo Co (`games/keo-co/`) — mặt meme làm đầu, thân áo màu đội,
  tên 13px, nghiêng kéo luôn tối thiểu 11° (không về 0°).

## Chuẩn kiểm chứng — bằng mắt, không bằng test xanh

Demo mode: mở overlay với `?demo=1` (phòng kiểm chứng hay dùng: `kiemtra1`,
`kiemtra2`). Một game chỉ được coi là ĐẠT khi mở overlay xem bằng mắt thấy:
người chơi hiện trong sân đúng vị trí chơi, có hành động đúng game, nhìn vào
đọc ra ngay là game gì, avatar + tên thấy rõ (không cắt, không dính nhau),
hướng dẫn chơi đọc rõ với tỉ lệ điểm thật từ engine.
Demo chạy / nút bấm được / test xanh / link không 404 KHÔNG đủ để báo ĐẠT.

## TikFinity (đường sự kiện duy nhất đang chạy)

- TikFinity POST sự kiện về webhook của phòng. Hướng 1-Action: 1 Action webhook
  duy nhất với URL webhook của phòng (không `?event=`), mọi Event đều trỏ vào
  Action đó. Parser đọc trường `event` trong body.
- Khi `demoMode` BẬT thì `/api/webhook` TỪ CHỐI event thật (reason `demo-mode`).
  Test webhook thật phải tắt demoMode trước.

## 14 game

`ve-avatar`, `buong-giam`, `thap-sang-ban-do`, `vuon-hoa-mua-xuan`,
`bep-an-tap-the`, `dua-xe-leo-nui`, `vong-quay-may-man`, `bau-troi-phao-hoa`,
`keo-co`, `dau-truong-sinh-ton`, `chiem-co`, `dua-thuyen-rong`, `dau-tri`,
`di-bar-online`.
Ba game đầu (Thắp Sáng, Vẽ Avatar, Buồng Giam) đã tạm ổn — không đụng tới
khi chưa có lệnh mới.

## Tài liệu trong repo

- `docs/ui-upgrade-plan-2026-11-13.md` — kế hoạch nâng cấp giao diện.
- `docs/fix-dot2-0-7-2026-11-13.md` — danh sách lỗi đợt 2 cần sửa.
- `docs/asset-plan-2d-2026-11-13.md` — kế hoạch asset 2D.
- `games/<slug>/TESTING.md` — checklist test live từng game.
- Phong cách asset: 2D game asset — flat vector, cel-shading, viền đậm,
  màu bão hòa. Video nền đã dừng; asset chỉ làm nhân vật + cảnh (ảnh tĩnh).
