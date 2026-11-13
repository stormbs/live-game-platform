# QA notes — Đi Bar đợt 3 (2026-11-13)

Người làm: worker #9 (đợt 2 + đợt 3 dở) → CEO tự tay làm tiếp sau khi worker #9 dừng (nhân sự hết token).
Nguồn nghiên cứu: `docs/research-di-bar-live-2026-11-13.md` — xem trực tiếp 2 live thật @dibar5.0, @hoang_thinh_hp (18:02–18:16, chỉ xem + ghi chép).

## Đã làm (đợt 2, commit 589607b — đã push, coordinator kiểm chứng bằng mắt + npm test 281 pass)
- Overlay vũ trường thật, bỏ lưới thẻ card: DJ trên quầy (gật đầu, 2 đĩa vinyl xoay, mixer, EQ, "ĐANG MIX/TẠM NGHỈ"), cầu disco, sàn LED 12 vũ công (4×3), spotlight chiếu đúng Vua, bảng hướng dẫn 4 dòng số thật, menu bar + Bàn Vàng/Đỏ + TOP 3, không còn chữ chồng.

## Đã làm (đợt 3, working tree — CEO kiểm chứng lại)
- Sàn CARO ĐỔI MÀU: 2 lớp ô vuông 2 màu crossfade (tím/hồng ↔ cyan/xanh lá), không dùng hue-rotate.
- Sân khấu cuối sàn: màn hình nền phát sáng + 2 cột LED equalizer dọc 2 bên.
- Người nổi bật: banner danh hiệu trên đầu (VUA SÀN NHẢY lúc vinh danh / DẪN ĐẦU lúc đang nhảy — từ trạng thái thật) + vòng sáng dưới chân + spotlight.
- Lưới sàn dày 6×4 khi >12 người (tối đa 24 — MAX_FLOOR của engine).
- BXH đổi tên thành "VŨ CÔNG NỔI BẬT" (theo live thật).
- Bảng hướng dẫn làm nổi bật hơn (viền vàng 3px + bóng sáng).
- CEO thêm: CÁNH CSS cho người dẫn đầu — vẽ bằng CSS từ trạng thái thật isLeader, không cần dữ liệu engine.

## Quyết định "Vua Sàn Nhảy" (CEO, 2026-11-13)
GIỮ nhãn này trong LED ticker + banner chip lúc vinh danh, vì đó là cơ chế thật của engine (state.king, log "Vua sàn nhảy vòng N"). Live thật chỉ không dùng đúng nhãn đó chứ không cấm đặt tên cho khoảnh khắc vinh danh. Bản cũ bị chê là do banner chữ to ĐÈ lên thẻ, nay chỉ còn chip nhỏ trên đầu người dẫn đầu. BXH đã đổi tên theo live thật.

## KHÔNG thêm (có lý do ghi trong comment cuối overlay.html)
- Menu hành động mép trên (CẢ SÀN QUẨY/MƯA TIM/PHÁO GIẤY...) — engine không hỗ trợ; thêm nút giả là báo cáo cho có.
- Vai trò CHỦ TỊCH/PHÓ/THƯ KÝ — engine không có.
- Hiệu ứng gift toàn màn hình — live thật chỉ hiện dòng chat.

## Kiểm chứng (CEO tự làm)
- [x] node --check JS inline overlay (đợt 3)
- [x] npm test (toàn suite) — fail 0 (đợt 3)
- [x] Mở overlay ?demo=1 xem bằng mắt (chuẩn Chủ tịch) — kiểm chứng live Railway 18:36–18:46, deployment 301a1e37, phòng ceo_dibar + dibar5.0: ĐẠT — nhận ra bar ngay, sàn caro đổi màu, DJ + màn hình + 2 cột EQ rõ, 12 vũ công đứng TRÊN SÀN (tên + avatar trên đầu), người dẫn đầu có chip + vương miện + CÁNH + quầng sáng, bảng hướng dẫn đọc được, BXH "Vũ công nổi bật" + Bàn Vàng 1369 / Bàn Đỏ 362 đúng 12 người, demo badge hiện. CHƯA ĐẠT — xem "Lỗi camera kẹt zoom" dưới đây.
- [ ] Commit + push + deploy Railway + kiểm chứng live bằng đúng luồng user (dashboard → link overlay).

## Lỗi camera kẹt zoom (phát hiện khi kiểm chứng live 18:46, tái hiện 3/3 phòng)
- Triệu chứng: overlay vừa tải thì vừa khung hoàn hảo, nhưng sau ~1–1,5 phút demo chạy, toàn bộ sân khấu tự phóng to và bị cắt hai bên (tên vũ công, hướng dẫn, ticker bị cắt; menu/bàn biến mất); không tự phục hồi qua DJ DROP hay sang Vòng 2; chỉ tải lại trang mới hết.
- Nguyên nhân gốc (CEO chẩn đoán từ code, đã xác minh): `startShotTimer()` được `render()` gọi mỗi lần state cập nhật — demo/live đông broadcast state ~2s/lần — mà hàm cũ `clearInterval` + tạo lại interval 8s mỗi lần → `cycleShot()` không bao giờ tới lượt chạy → camera kẹt mãi ở góc zoom của sự kiện gần nhất. Cộng thêm `eventShot()` gia hạn hold vô hạn khi sự kiện dồn dập.
- Sửa (CEO, commit sau e8cbbb3): `startShotTimer()` chỉ tạo interval 1 lần (idempotent); `eventShot()` không gia hạn hold đã kéo dài quá 20s; `cycleShot()` sau khi hết hold thì về toàn cảnh trước rồi mới chạy vòng lại. Đã kiểm chứng bằng mô phỏng node (`/tmp/camera-sim.js`): sự kiện dồn dập mỗi 1s trong 12s → camera về `full` ở 27,2s rồi chạy vòng `dj → top...` bình thường — PASS.
- Sửa kèm theo đợt này: nút "Nhạc: Bật" + badge DEMO dời xuống dải trống y=404 (bản cũ nút nhạc chồng lên góc trái panel DJ/cột LED trái); vòng sáng dưới chân người dẫn đầu to + sáng hơn (200×42, bottom 8px — bản cũ mờ, không đọc ra); chùm spotlight đậm hơn (0,52).
- Phòng `ceo-dibar` (gạch ngang) bị từ chối khi tạo room — đúng luật sẵn có (tên TikTok không có gạch ngang), không phải lỗi; dùng `ceo_dibar`.
