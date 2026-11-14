# TESTING — Đấu Trí (dau-tri, game 13/13)

## Luật chơi (tóm tắt)
- Bình luận `đội a` / `đội b` (hoặc `1`/`2`) để vào đội; đổi đội chỉ giữa các trận.
  Chưa chọn đội thì câu trả lời không tính điểm đội (vẫn hiện tên).
- Ngân hàng câu hỏi: dashboard thêm/sửa/xóa (mặc định 10 câu kiến thức chung +
  đố vui). Streamer bấm "Câu tiếp theo" hoặc bật chế độ tự động.
- Trả lời: bình luận đúng 1 chữ A/B/C/D. Mỗi người 1 lần/câu (lần đầu tính,
  lần sau bỏ qua). Đúng = +10 điểm đội; người đúng ĐẦU TIÊN của câu +5 thưởng.
  Sai = 0. Hết 30s/câu → chốt đáp án, hiện đáp án đúng + bảng điểm (reveal 5s).
- Tim không tính điểm (chỉ cổ vũ, hiện hiệu ứng tim bay). Quà: 1 xu = +2 điểm
  đội người tặng. Follow = +10 điểm đội mình 1 lần/trận.
- Hết 10 câu: đội nhiều điểm hơn thắng. Hòa → đội có nhiều lần đúng đầu tiên
  hơn thắng. Vinh danh top 3 cá nhân (nhiều câu đúng nhất) 30s → trận mới
  (câu hỏi xáo trộn lại, đội giữ nguyên).

## Link live (Railway)
- Trang chính: https://live-game-platform-production.up.railway.app/
- Overlay: `https://live-game-platform-production.up.railway.app/o/dau-tri/<tiktok-username>/overlay`
- Dashboard: `https://live-game-platform-production.up.railway.app/o/dau-tri/<tiktok-username>/`
- Overlay demo: `.../overlay?demo=1`

## Cài đặt TikFinity (1 Action duy nhất, KHÔNG body)
Chỉ cần 1 Action webhook duy nhất với URL gốc của phòng (lấy từ dashboard,
mục "🎯 Cài đặt TikFinity"; không thêm `?event=`), tên Action theo mẫu
"Đấu Trí", loại Webhook, Method POST. Rồi tạo 6 Event, mỗi event đều chọn
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
`Đấu Trí - Qua`, `Đấu Trí - Binh luan`, `Đấu Trí - Tim`,
`Đấu Trí - Follow`, `Đấu Trí - Share`, `Đấu Trí - Vao phong` (lấy từ
route `GET /o/dau-tri/<username>/api/tikfinity-actions`).

## Checklist test thủ công (Agent Windows / live thật)
- [ ] T01. Mở overlay: thấy thẻ câu hỏi to + 4 đáp án + đồng hồ + bảng điểm.
- [ ] T02. Dashboard bấm "Câu tiếp theo": overlay hiện câu 1, TTS đọc câu hỏi.
- [ ] T03. Bình luận "đội a" (tài khoản 1) + "đội b" (tài khoản 2).
- [ ] T04. Tài khoản 1 bình luận đáp án đúng đầu tiên: đội A +15 (10+5),
      tên hiện "⚡ trả lời đúng ĐẦU TIÊN!".
- [ ] T05. Tài khoản 2 trả lời đúng sau: đội B +10. Trả lời lại lần 2: bỏ qua.
- [ ] T06. Tài khoản chưa chọn đội trả lời đúng: không cộng điểm đội nào,
      nhưng tên vẫn hiện + cột đáp án tăng.
- [ ] T07. Hết 30s: tự chốt, đáp án đúng tô xanh, thanh đáp án theo số người chọn.
- [ ] T08. Tặng quà 10 xu: +20 điểm đội người tặng. Follow: +10 (1 lần/trận).
- [ ] T09. Hết 10 câu: đội thắng + top 3 cá nhân hiện 30s, trận mới xáo câu.
- [ ] T10. Dashboard thêm/sửa/xóa câu hỏi có hiệu lực ở trận sau.
- [ ] T11. Demo: mở overlay `?demo=1` -> huy hiệu DEMO + 12 người demo tự
      trả lời, điểm 2 đội tăng; có event thật -> demo tự dừng.

## Test tự động
`node --test test/dau-tri.test.js` — 8 test:
1. Trả lời đúng +10, đúng đầu tiên +5; 1 người 1 lần/câu; sai = 0; tự chốt hết giờ.
2. Quà 10 xu = +20 điểm đội; quà không rõ xu = 0 + log WARN.
3. Hết 3 câu hòa điểm -> xét số lần đúng đầu tiên (A thắng 2-0).
4. Ngân hàng câu hỏi mặc định đủ 10; thêm/sửa/xóa được.
5. Demo start/stop + từ chối khi đã có event thật.
6. Endpoint test 1 lượt + overlay/dashboard 200 + guide + tikfinity-actions.
7. Settings clamp + room isolation.
8. Đổi đội bị chặn giữa trận; trả lời không đội không tính điểm đội.

## Ghi chú thiết kế
- Người chưa chọn đội trả lời đúng ĐẦU TIÊN: tên vẫn hiện là người đúng đầu
  tiên, nhưng không cộng điểm đội và không tính vào firstCounts (thưởng +5
  thuộc về đội của người đó — không có đội thì không có đội nào nhận). Người
  có đội trả lời đúng sau đó chỉ được +10, không được thưởng đầu tiên.
- Đáp án đúng KHÔNG có trong state JSON khi câu chưa chốt (chống gian lận);
  chỉ hiện sau khi chốt (reveal).
- Chế độ tự động: hết reveal 5s thì tự mở câu kế (nhịp thực tế = giây/câu +
  giây reveal, mặc định 30+5 = 35s/câu).
