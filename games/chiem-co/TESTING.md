# TESTING — Chiếm Cờ (chiem-co, game 11/13)

## Luật chơi (tóm tắt)
- Bình luận `xanh` / `đỏ` (hoặc `1`/`2`) để vào đội; đổi đội chỉ giữa các trận.
- Chọn cờ để đánh: bình luận `cờ trái` / `cờ giữa` / `cờ phải` (hoặc chỉ
  `trái` / `giữa` / `phải`). Mặc định: cờ Giữa. Lực của người chơi đổ vào cờ
  họ đang tập trung.
- Lực: 1 tim (delta) = +1; 1 bình luận tính điểm (chống spam 1/5s) = +5;
  quà 1 xu = +20; follow +30 (1 lần/trận); share +15 (1 lần/trận).
  Người chưa chọn đội không tính lực. Quà không rõ xu = 0 + log WARN.
- Mỗi cửa sổ 30s: đội mạnh hơn ở 1 cờ thì chiếm cờ đó (hòa lực -> không đổi).
- Giữ cờ: +1 điểm/giây/cờ; cờ Giữa x2 (+2/s).
- Trận 10 phút: nhiều điểm hơn thắng; hòa điểm -> nhiều cờ hơn thắng;
  vẫn hòa -> đội chiếm cờ cuối thắng; không ai chiếm cờ -> hòa.
- Vinh danh 30s -> trận mới (đội giữ nguyên).

## Link live (Railway)
- Trang chính: https://live-game-platform-production.up.railway.app/
- Overlay: `https://live-game-platform-production.up.railway.app/o/chiem-co/<tiktok-username>/overlay`
- Dashboard: `https://live-game-platform-production.up.railway.app/o/chiem-co/<tiktok-username>/`
- Overlay demo: `.../overlay?demo=1`

## Cài đặt TikFinity (1 Action duy nhất, KHÔNG body)
Chỉ cần 1 Action webhook duy nhất với URL gốc của phòng (lấy từ dashboard,
mục "🎯 Cài đặt TikFinity"; không thêm `?event=`), tên Action theo mẫu
"Chiếm Cờ", loại Webhook, Method POST. Rồi tạo 6 Event, mỗi event đều chọn
Action duy nhất vừa tạo ở "Trigger all of these actions":
- Quà — trigger "Sending a gift with min. coins value" (min 1)
- Bình luận — trigger "Chat (any comment)"
- Tim — trigger "Sending likes (taps)"
- Follow — trigger "Follow"
- Share — trigger "Share"
- Vào phòng — trigger "Join"
Hướng dẫn đầy đủ: `/huong-dan-tikfinity`.
Dự phòng (chỉ dùng khi TikFinity không gửi trường event trong body): 6 URL
riêng `?event=gift|chat|like|follow|share|join` + 6 tên Action
`Chiếm Cờ - Qua`, `Chiếm Cờ - Binh luan`, `Chiếm Cờ - Tim`,
`Chiếm Cờ - Follow`, `Chiếm Cờ - Share`, `Chiếm Cờ - Vao phong` (lấy từ
route `GET /o/chiem-co/<username>/api/tikfinity-actions`).

## Checklist test thủ công (Agent Windows / live thật)
- [ ] T01. Mở overlay: thấy 3 cột cờ + bảng điểm 2 đội + đồng hồ trận.
- [ ] T02. Bình luận "xanh" (tài khoản 1) + "đỏ" (tài khoản 2): trận tự bắt đầu,
      2 người hiện đúng đội.
- [ ] T03. Tài khoản 1 tap ~20 lần: lực cờ Giữa bên Xanh tăng; thanh chiếm
      nghiêng về Xanh.
- [ ] T04. Hết cửa sổ 30s: đội mạnh hơn chiếm cờ; overlay đổi màu cờ + TTS
      đọc "Đội Xanh vừa chiếm cờ Giữa!".
- [ ] T05. Giữ cờ 10s: điểm đội giữ cờ tăng (Giữa +2/s, Trái/Phải +1/s).
- [ ] T06. Bình luận "cờ trái": lực chuyển sang cờ Trái (xem thanh chiếm).
- [ ] T07. Tặng quà 10 xu: +200 lực vào cờ đang tập trung.
- [ ] T08. Follow 1 lần: +30 lực; follow lần 2 trong trận: không cộng.
- [ ] T09. Hết 10 phút: đội nhiều điểm thắng, vinh danh 30s, trận mới bắt đầu.
- [ ] T10. Demo: mở overlay `?demo=1` -> huy hiệu DEMO + cờ/điểm tự thay đổi;
      có event thật -> demo tự dừng.
- [ ] T11. Dashboard: lưu cài đặt (cửa sổ chiếm, điểm/giây, thời gian trận)
      có hiệu lực; nút Test hoạt động khi bật demoMode.

## Test tự động
`node --test test/chiem-co.test.js` — 9 test:
1. Cửa sổ 30s: đội mạnh hơn chiếm cờ; giữ cờ +điểm/giây (Giữa x2).
2. Quà 10 xu = +200 lực; quà không rõ xu = 0 + log WARN.
3. Tap delta + chống spam comment; hết trận đội nhiều điểm thắng + trận mới.
4. Hòa điểm -> xét số cờ (Đỏ thắng 2-1).
5. Hòa điểm + hòa cờ -> cờ chiếm cuối thắng.
6. Demo start/stop + từ chối khi đã có event thật.
7. Endpoint test 1 lượt + overlay/dashboard 200 + guide + tikfinity-actions.
8. Settings clamp + room isolation.
9. Đổi đội bị chặn khi đang đấu; "đồ" không nhầm "đỏ"; follow/share 1 lần/trận.

## Ghi chú thiết kế
- File gốc không ghi cách chọn cờ để đánh — engine bổ sung chọn cờ bằng
  từ khóa "cờ trái/giữa/phải" (mặc định cờ Giữa). Nếu không có cách chọn cờ,
  cả 3 cờ luôn đổi chủ cùng lúc và cờ Giữa x2 điểm trở nên vô nghĩa.
- Từ "phải" trong câu thường ("phải kéo mạnh") KHÔNG đổi focus — chỉ đổi khi
  kèm từ "cờ" hoặc đứng một mình.
