# TESTING — Đua Thuyền Rồng (dua-thuyen-rong, game 12/13)

## Luật chơi (tóm tắt)
- Bình luận `vàng` / `đỏ` (hoặc `1`/`2`) để vào đội; đổi đội chỉ giữa các cuộc đua
  (người mới chưa có đội vẫn được vào đội giữa đua).
- Chèo: 1 tim (delta) = +1m; 1 bình luận tính điểm (chống spam 1/5s) = +5m;
  quà 1 xu = +5m; follow +20m (1 lần/đua). Quà không rõ xu = 0 + log WARN.
- Combo trống: trong cửa sổ 2s có ≥10 tim của cùng 1 đội → trống dồn:
  đội đó +10m thưởng + hiệu ứng trống + tiếng trống WebAudio (tối đa 1 combo/5s/đội).
- Đường đua 500m. Thuyền nào chạm đích trước thắng. Tối đa 5 phút — hết giờ,
  thuyền xa hơn thắng. Vinh danh 30s → đua mới (đội giữ nguyên, mét về 0).
- Mỗi thuyền tối đa 12 người chèo hiện trên thuyền (người vào sau vẫn tính mét
  nhưng đứng ở bờ cổ vũ); tên hiện trên người chèo.

## Link live (Railway)
- Trang chính: https://live-game-platform-production.up.railway.app/
- Overlay: `https://live-game-platform-production.up.railway.app/o/dua-thuyen-rong/<tiktok-username>/overlay`
- Dashboard: `https://live-game-platform-production.up.railway.app/o/dua-thuyen-rong/<tiktok-username>/`
- Overlay demo: `.../overlay?demo=1`

## Cài đặt TikFinity (6 Action, mỗi action 1 URL riêng `?event=`, KHÔNG body)
Lấy URL từ dashboard (mục "🎯 Cài đặt TikFinity") hoặc route
`GET /o/dua-thuyen-rong/<username>/api/tikfinity-actions`. Tạo 6 Action webhook:
- `Đua Thuyền Rồng - Qua` — trigger "Sending a gift with min. coins value" (min 1)
- `Đua Thuyền Rồng - Binh luan` — trigger "Chat (any comment)"
- `Đua Thuyền Rồng - Tim` — trigger "Sending likes (taps)"
- `Đua Thuyền Rồng - Follow` — trigger "Follow"
- `Đua Thuyền Rồng - Share` — trigger "Share"
- `Đua Thuyền Rồng - Vao phong` — trigger "Join"
Rồi tạo 6 Event, mỗi event chọn đúng action ở "Trigger all of these actions".
Hướng dẫn đầy đủ: `/huong-dan-tikfinity`.

## Checklist test thủ công (Agent Windows / live thật)
- [ ] T01. Mở overlay: thấy 2 làn sông + 2 thuyền rồng + cột mốc 100–500m.
- [ ] T02. Bình luận "vàng" (tài khoản 1) + "đỏ" (tài khoản 2): đua tự bắt đầu,
      2 người hiện đúng đội.
- [ ] T03. Tài khoản 1 tap ~20 lần: thuyền Vàng tiến lên, thanh tiến trình tăng.
- [ ] T04. Cả đội cùng tap dồn dập (≥10 tim/2s): trống dồn — thuyền vọt +10m,
      hiệu ứng trống + tiếng trống, TTS "Trống dồn!".
- [ ] T05. Tặng quà 10 xu: +50m cho thuyền đội người tặng.
- [ ] T06. Follow 1 lần: +20m; follow lần 2 trong đua: không cộng.
- [ ] T07. Thuyền chạm 500m: thắng ngay, vinh danh 30s (rồng phun lửa + TTS),
      đua mới bắt đầu.
- [ ] T08. Hết 5 phút chưa ai về đích: thuyền xa hơn thắng.
- [ ] T09. Demo: mở overlay `?demo=1` -> huy hiệu DEMO + 2 thuyền tự chạy;
      có event thật -> demo tự dừng.
- [ ] T10. Dashboard: lưu cài đặt (cự ly, mét/tim, ngưỡng combo) có hiệu lực;
      nút Test hoạt động khi bật demoMode.

## Test tự động
`node --test test/dua-thuyen-rong.test.js` — 9 test:
1. Tap +1m đúng đội; comment +5m; quà 10 xu = +50m; quà lạ = 0 + WARN.
2. Combo 10 tim/2s -> +10m thưởng, tối đa 1/5s.
3. Chạm đích trước thắng + đua mới.
4. Hết giờ thuyền xa hơn thắng.
5. Tap delta + chống spam comment.
6. Demo start/stop + từ chối khi đã có event thật.
7. Endpoint test 1 lượt + overlay/dashboard 200 + guide + tikfinity-actions.
8. Settings clamp + room isolation.
9. Đổi đội bị chặn khi đang đua; "vang" không dấu cũng nhận; follow 1 lần/đua.
