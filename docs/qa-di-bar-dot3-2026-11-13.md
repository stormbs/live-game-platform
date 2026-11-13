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
- [ ] node --check JS inline overlay
- [ ] npm test (toàn suite)
- [ ] Mở overlay ?demo=1 xem bằng mắt (chuẩn Chủ tịch): sàn caro có đổi màu không, DJ + màn hình + EQ có thấy không, vũ công có đứng TRÊN SÀN đúng vị trí không, tên + avatar trên đầu không, người dẫn đầu có chip + cánh + vòng sáng + spotlight không, bảng hướng dẫn đọc được trong 3 giây không, có chữ chồng/chữ cắt không.
- [ ] Commit + push + deploy Railway + kiểm chứng live bằng đúng luồng user (dashboard → link overlay).
