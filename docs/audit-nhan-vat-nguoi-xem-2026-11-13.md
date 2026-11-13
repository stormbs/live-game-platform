# Audit — Nhân vật người xem trong game (2026-11-13 ~17:20)

Yêu cầu Chủ tịch: (1) nhân vật sống động + hành động đúng game; (2) avatar + tên NGAY TRÊN ĐẦU nhân vật; (3) game đối kháng đội: dashboard đổi tên đội / ảnh nền đội / chi tiết khác.

Nguồn avatar: `parseTikFinityEvent` (lib/game-common.js) trả `avatar` từ field `avatar_url` của form TikFinity. Engine lưu `avatarUrl` (keo-co/dua-thuyen/chiem-co/dau-truong/dau-tri) hoặc `avatar` (vuon-hoa/bep-an/dua-xe/di-bar) trên player. Demo players có avatarUrl null/'' → fallback chữ cái đầu tên.

## Bảng hiện trạng

| Game | Nhân vật hiện tại | Animation | Avatar+tên trên đầu? | Đội? | Ghi chú |
|---|---|---|---|---|---|
| keo-co | `.puller`: avatar tròn 96px + tên DƯỚI + lực (lưới 4 cột/đội) | Không (chỉ dây/cờ động) | Avatar+tên CÓ nhưng dạng roster, không phải nhân vật trên sân | Xanh/Đỏ | state pullers có avatarUrl; settings đầy đủ expose |
| dua-thuyen-rong | Thuyền emoji 🐉🛶 + '🚣'.repeat(n); mái chèo CSS row | Mái chèo khua, sóng, surge | KHÔNG | Vàng/Đỏ | rowers/top CHỈ {name, meters} — engine cần thêm uid+avatarUrl; settings expose từng field lẻ |
| chiem-co | KHÔNG có nhân vật — chỉ 3 cờ CSS vẫy + capbar | Cờ vẫy/nghiêng/pop | KHÔNG | Xanh/Đỏ | top CHỈ {name, force} — engine cần thêm uid+avatarUrl |
| dau-truong-sinh-ton | `.fighter`: emoji vũ khí + tên DƯỚI + HP | Không (chỉ hit-float) | KHÔNG | FFA | fighters/top KHÔNG avatarUrl — engine cần thêm từ session.players |
| vuon-hoa-mua-xuan | Ô hoa theo giai đoạn (emoji) + sway/bloom-pop | Sway + bloom-pop | Tên chỉ khi nở, BÊN DƯỚI, không avatar | Không | flowers ĐÃ có avatar trong state (overlay chưa dùng) |
| bep-an-tap-the | KHÔNG có nhân vật — chỉ nồi 🍲 + lửa | Nồi bubble, lửa flame | KHÔNG (top list có avatar) | Không | s.top đã có avatar |
| dua-xe-leo-nui | Xe CSS (bánh xoay, khói, boost, win bounce) + .tag tên TRÊN xe | Bánh/khói/boost | Tên có, avatar KHÔNG | Không | s.cars đã có avatar; sprite 5 màu, slot cam → map 'do' |
| dau-tri | KHÔNG có nhân vật — thẻ câu hỏi + top list tên | Không | KHÔNG | A/B | top/top3 KHÔNG avatarUrl — engine cần thêm |
| di-bar-online | `.dancer`: emoji nhảy 88px + tên DƯỚI + năng lượng | Nhảy bounce (đồng bộ) | KHÔNG | Không | s.dancers ĐÃ có avatarUrl |
| thap-sang-ban-do | Avatar trên bản đồ (.avatar .pic img + .nm) + avatarDrop | avatarDrop | CÓ (đã đạt) | Không | Không cần làm |
| buong-giam | Nhân vật tù (.inmate-avatar-frame + nametag) | — | CÓ (đã đạt) | Không | File generated 3041 dòng — không đụng |
| vong-quay-may-man | Không có nhân vật người xem (chỉ vòng quay) | — | Không áp dụng | Không | Ngoài phạm vi |
| bau-troi-phao-hoa | Top card có avatar + tên (không phải nhân vật trong sân) | — | Top card có | Không | Ngoài phạm vi |
| ve-avatar | App vẽ avatar (bản chất khác) | — | — | Không | Ngoài phạm vi |

## Team settings — schema thống nhất (4 game đội)

- keo-co: teamXanhName 'Xanh' / teamDoName 'Đỏ' / teamXanhBg-teamDoBg '' / teamXanhColor '#1E90FF' / teamDoColor '#E63946'
- dua-thuyen-rong: teamVangName 'Vàng' / teamDoName 'Đỏ' / teamVangBg-teamDoBg '' / teamVangColor '#FACC15' / teamDoColor '#EF4444'
- chiem-co: teamXanhName 'Xanh' / teamDoName 'Đỏ' / teamXanhBg-teamDoBg '' / teamXanhColor '#0284C7' / teamDoColor '#DC2626'
- dau-tri: teamAName 'Đội A' / teamBName 'Đội B' / teamABg-teamBBg '' / teamAColor '#38BDF8' / teamBColor '#FB923C'
- Validate: tên trim + strip <>& + slice 24; bg chỉ /^https?:\/\/|\/shared\// không khoảng trắng/ngoặc/nháy; màu /^#[0-9a-fA-F]{6}$/. Sau saveSettings() phải broadcast() để overlay cập nhật ngay. Từ khóa vào đội KHÔNG đổi (chỉ tên hiển thị).

## Nhân viên đã điều (9 worker, song song, không commit)

1. keo-co — pull animation + team settings
2. dua-thuyen-rong — sprite thuyền + người chèo avatar + team settings
3. chiem-co — cầu thủ chạy/cắm cờ + team settings
4. dau-truong-sinh-ton — fighter lunge/bob/ngã + avatar
5. vuon-hoa-mua-xuan — avatar trên ô hoa + animation tưới + sprite hoa
6. bep-an-tap-the — đầu bếp đảo nồi + sprite nồi/lửa
7. dua-xe-leo-nui — sprite xe + avatar trên xe (slot cam → 'do')
8. dau-tri — first-correct/spotlight avatar + team settings
9. di-bar-online — avatar trên vũ công + nhịp nhảy riêng

Mỗi worker: node --check JS inline + npm test fail 0 + báo cáo cuối. Coordinator kiểm chứng độc lập → commit + push (KHÔNG deploy Railway).

## Kết quả đợt 1 (kiểm chứng độc lập bởi coordinator, 2026-11-13 ~17:36)

- node --check JS inline + CSS balance 0: 12/12 file HTML + 5 engine.js + lib/game-common.js — OK.
- npm test: **281 pass / 0 fail**.
- Serve thật (server tạm, đã tắt): 9/9 overlay 200, 4/4 dashboard đội 200 + có mục "Tùy chỉnh đội"; URL API transform đúng 1 prefix, không còn literal `/api/` trần; 5/5 sprite sheet 200.
- Chức năng thật: POST /api/settings Kéo Co validate đúng (tên strip `<>`, bg `javascript:` bị từ chối, màu sai giữ cũ, giá trị hợp lệ lưu được); webhook join/chat với avatar_url → state có avatarUrl (Đua Thuyền rowers + Kéo Co pullers) — avatar chảy đầu-cuối.
- **Bug avatar phát hiện trong đợt (worker Đấu Trí):** `parseTikFinityEvent` trả `avatar` nhưng 5 engine đọc `ev.avatarUrl` → avatar thật không bao giờ vào player (Kéo Co, Đua Thuyền, Chiếm Cờ, Đấu Trường, Đi Bar). Đã sửa tập trung 1 dòng ở `lib/game-common.js` (return thêm `avatarUrl: avatar`), test/tikfinity-form.test.js 10 pass.
- Commit đợt 1: Kéo Co (chỉ engine.js + overlay.html — dashboard đã lên af7ffc7), Chiếm Cờ, Đấu Trí, Đấu Trường, Vườn Hoa, Bếp Ăn, Đua Xe, Đi Bar, lib/game-common.js. Đua Thuyền GIỮ LẠI chưa commit (làm lại thuyền dài đợt 2).

## Đợt 2 — Chuẩn chung 5 nguyên tắc (Chủ tịch 17:38, áp cho MỌI game)

1. Nhân vật người xem HIỆN TRONG SÂN GAME đúng vị trí chơi (không chỉ icon/list/roster ngoài sân), sống động, hành động đúng game, đồng bộ sự kiện (tap/gift/comment).
2. Avatar + tên NGAY TRÊN ĐẦU nhân vật.
3. Bảng HƯỚNG DẪN CHƠI trên overlay: cách vào đội + tỉ lệ điểm THẬT từ engine game đó — KHÔNG bịa số, KHÔNG dùng số ví dụ.
4. NPC/phụ họa đúng vai trò + bối cảnh theo chủ đề game (2D game asset).
5. Game đối kháng đội: dashboard đổi tên/ảnh nền/màu đội (đã xong đợt 1).

Riêng Đua Thuyền (phác tay Chủ tịch image-133.png): thuyền DÀI nằm ngang (đầu rồng + đuôi, 8–12 người chèo trong thuyền) + NPC trống ở mũi thuyền gắn cơ chế "trống dồn" + lễ hội truyền thống Việt Nam + bảng hướng dẫn với số thật (1 tim +1m, 1 bình luận +5m, 1 xu +5m, follow +20m 1 lần/đua, đích 500m, cmt "1"/"vàng" → Vàng, "2"/"đỏ" → Đỏ). LƯU Ý: số ví dụ của Chủ tịch "10 tim = +1m" KHÁC luật thật — dùng số thật của engine, đã hỏi Chủ tịch có muốn đổi tỉ lệ không.
