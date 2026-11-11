# Rà soát usability theo giao diện — 11/11/2026

Tiếp tục từ `41b6ccf` trên `chore/project-bootstrap`. Đọc các page/component hiện hành và tái sử dụng SRS/PA2/Figma mapping đã xác minh; không đổi route, business rules, API, dependency, PA2 hoặc Figma. Dữ liệu ghi chỉ thuộc test marker trong PostgreSQL local + Firebase Auth Emulator. `/development` là công cụ chẩn đoán nội bộ, không được tính là màn hình sản phẩm trong matrix.

**Kết luận:** cần sửa 6 nhóm lỗi dưới đây; đã sửa và kiểm thử. Ngoài các lỗi này, chưa phát hiện lỗi buộc phải thay đổi màn hình qua phạm vi đã chạy. Đây là đánh giá kỹ thuật/UX và thao tác browser có kiểm soát, chưa phải nghiên cứu usability với người dùng đại diện.

## Từng giao diện và chức năng

`screen-matrix.spec.ts` chụp và chạy Axe/geometry cho **28 trạng thái thực × 375/768/1280 px = 84 phép đo**. Matrix gồm login/register; các trạng thái rỗng Owner court/calendar/bookings/offers, Player history, court/room search; các trạng thái có dữ liệu Guest/Player/Owner. `screen-usability.spec.ts` bổ sung 10 ca hồi quy mới. `business`, `review`, `usability`, `client`, `bootstrap`, `acceptance` là các spec được giữ lại và chạy lại đầy đủ. Ảnh các nhóm form, calendar, booking, discovery, availability và room đã được xem trực quan; không suy diễn rằng mỗi nhánh/ảnh đều được người dùng thật đánh giá.

| Giao diện / route | Chức năng và evidence đã rà | Kết quả / cần sửa |
|---|---|---|
| Header, mobile Menu | Link theo role, mở/đóng, Escape, focus trả về, backdrop, link Deals; matrix cả 3 width + test padding | UX-05 đã sửa; không đổi navigation/route. |
| Đăng nhập `/login` | Native validation, lỗi credentials, giữ email, đăng nhập lại, intended destination, session outage/retry/expiry | Không có lỗi mới trong các ca đã chạy; giữ thông báo tiếng Việt và password manager. |
| Đăng ký `/register` | Player/Owner ban đầu, duplicate email, validation, provider đang xử lý | UX-01: khóa email/password/role trong lúc gửi; test Firebase thật hoàn tất đúng role. |
| Tìm sân `/` | Tên/môn/địa điểm/thời gian, dropdown keyboard, clear time, retained criteria, empty/loading/network retry, slot preview/Back | Không có lỗi mới; matrix kiểm tra query `q` thực và kết quả thật. Không thêm filter/phân trang ngoài SRS. |
| Chi tiết sân `/courts/:id` | Địa chỉ/liên hệ, ảnh URL/fallback/gallery, giá, mở lịch, map/manual origin/GPS denial/provider recovery | Không có lỗi mới; giữ các sửa map/ảnh đã đạt trước đó. Ca Google thật được chạy lại trong full suite. |
| Chọn giờ `/courts/:id/slots` | Ngày, available/booked/blocked, chọn slot liên tiếp, xóa chọn, loading/empty/error, tổng dự kiến | UX-06: slot kết thúc đúng nửa đêm hiển thị `24:00`; không đổi khoảng đặt/giá. |
| Review/xác nhận booking | Một booking cho cả lựa chọn, QUOTE_CHANGED lặp lại, conflict, retry, Keep/đổi lựa chọn | UX-05/06 dùng cùng dialog/định dạng mới; các regression báo giá, cạnh tranh và giữ lựa chọn vẫn PASS. |
| Lịch đặt `/bookings` | Danh sách mới nhất, empty, accepted totals, xem chi tiết | Không có lỗi mới; giữ giới hạn 10 booking theo SRS. |
| Booking `/bookings/:id` | Tổng đã chấp nhận, cutoff/hủy toàn bộ/Keep, trả slot, tạo/xem Open Play, reload | UX-03/04/06 đã sửa. Cả lỗi trước khi gửi và mất phản hồi sau commit đều được kiểm tra riêng. |
| Danh sách phòng `/rooms` | Search địa điểm, empty, OPEN/FULL, retained query/detail/Back | Không có lỗi mới; dùng API thật, không giả dữ liệu để tạo kết quả PASS. |
| Phòng `/rooms/:id` — Guest | Xem roster/ước tính, login CTA, thông tin sân; không lộ email | Không có lỗi mới; matrix + các test guest/join và quyền backend. |
| Phòng `/rooms/:id` — Player | Organizer/member, Join/Keep/Leave/Close, FULL/CLOSED, giữ roster/booking, reload | UX-05 dùng dialog đã sửa; capacity/create recovery nằm ở booking. Không thêm quyền hoặc sửa lifecycle. |
| Hồ sơ `/profile` — 2 role | Save/reload, read-only identity/role, logout, unsaved guard, retry | UX-01/02 đã sửa; không còn hiển thị “đã lưu” cho bản nháp mới. |
| Sân Owner `/owner` | Empty/create, list/edit/calendar/bookings, deactivate Keep/Confirm | Không có lỗi mới ngoài shared dialog; giữ booking đã xác nhận. |
| Tạo/sửa `/owner/courts/new`, `/owner/courts/:id/edit` | Required/native/API field errors, ảnh preview/fallback, optional contact, retained form, cancel/draft, pending save | UX-01: khóa input trong lúc lưu để không làm mất thay đổi chưa gửi. |
| Lịch `/owner/schedule` | Chọn sân/ngày, cả ngày/gaps, saved/blocked/booked/unpublished, refresh, unsaved Keep/discard | UX-06 làm rõ mốc cuối ngày; các guard và trạng thái đã hoạt động được giữ nguyên. |
| Giờ hoạt động / sửa slot | Mở/đóng từng ngày, 24:00, closed-day disabled, giá/publish/block, validation, cancel | UX-01: khóa cả giờ, giá và checkbox khi lưu; real readback xác nhận giá/giờ đã gửi. |
| Batch slot | Settings, generate, add/edit/remove, preview/back, overlap correction, atomic publish, unsaved guard | Chưa có lỗi mới trong suite; không đổi cách tạo nháp hoặc quy tắc công bố. |
| Maintenance | Nhập/preview/Back, ảnh hưởng booking, conflict/retry, confirm/remove, reload | UX-06: khoảng nhiều ngày phải hiện ngày kết thúc thật, không rút gọn nhầm thành một ngày. |
| Booking Owner `/owner/bookings`, `/:id` | Court/query/status/date filters, details/Back, contact đúng Owner, forbidden khác role | Không có lỗi mới; danh sách rỗng/có dữ liệu và chi tiết có contact được kiểm tra. |
| Owner offers `/owner/offers` | Chọn court/day/slot, manual/automatic, fractional lead, accepted totals, Keep/cancel/deactivate, conflict/retained form | Không có lỗi mới; config/history/empty thực có trong matrix, F09 regression/concurrency giữ nguyên. |
| Player Deals `/deals` | Mobile/desktop navigation, ưu đãi thật, giá thường/giá mới, chọn slot/review lại | Không có lỗi mới; matrix có offer đủ điều kiện thật trong 24 giờ và existing mobile test vẫn PASS. |

## Các lỗi đã sửa và cách tái hiện

1. **UX-01 — P1, input sau snapshot gửi không được lưu:** giữ PATCH profile đang chờ, sửa tiếp ô tên, cho request hoàn tất: UI chứa tên mới nhưng PostgreSQL chỉ lưu tên cũ, guard đã clean. Tạo/sửa sân, giờ hoạt động và slot có cùng cách lưu và vẫn cho sửa khi pending. Sửa tối thiểu: `disabled={busy}` cho input, `aria-busy` trên form và feedback nền; thông tin đã nhập được giữ để sửa/retry sau khi request kết thúc. Áp dụng nhất quán cho signup ban đầu và capacity tạo phòng.
2. **UX-02 — P2, thông báo thành công lỗi thời:** sau save profile, sửa tiếp vẫn còn “Hồ sơ đã lưu thành công.” Xóa thông báo này khi người dùng nhập bản nháp mới; vẫn bảo vệ unsaved changes.
3. **UX-03 — P2, capacity bị reset:** nhập 12, chặn POST tạo phòng, đợi booking readback: modal remount về 4. Capacity nay nằm trong state của trang; retry tạo đúng 12 và reload vẫn đúng.
4. **UX-04 — P1, mất phản hồi sau commit:** test gửi POST thật tới API/DB rồi chỉ làm mất response. Booking readback đã có `room_id` nhưng form cũ vẫn mời tạo lại. Nay chỉ khi readback có room ID mới hiển thị liên kết mở phòng đã lưu; test xác nhận đúng 1 phòng, capacity 12. Không suy đoán thành công khi chưa có bằng chứng server.
5. **UX-05 — P2, click padding đóng nhầm modal:** click tọa độ nằm trong dialog nhưng không nằm trên child bị coi là backdrop. Chỉ dismiss khi tọa độ thực sự ngoài bounding rect; Escape, nút đóng, Back/Cancel/Keep và focus return vẫn giữ hành vi cũ.
6. **UX-06 — P2, mốc thời gian gây hiểu nhầm:** calendar hiển thị `23:00–00:00`, maintenance nhiều ngày mất ngày kết thúc. Mốc đúng cuối ngày hiển thị `24:00`; khoảng dài hơn hiện ngày kết thúc. Ca thật xác minh calendar → availability → review → booking/reload và maintenance preview → save → reload. Không đổi timezone, slot duration, business rule hoặc dữ liệu backend.

## Kiểm chứng và giới hạn

- **239 pytest PASS**, locked uv sync, Ruff lint/format, guarded local migration head hai lần và drift check PASS; không sửa backend logic/schema.
- Frontend lint/typecheck/build PASS; **53 Playwright PASS** với live Google check bật. CI bình thường chạy 52 ca và skip rõ 1 ca external Maps. Không bỏ test cũ, không thay dependency. Build còn warning entry khoảng 521 kB đã có ở baseline.
- **84/84** phép đo không có page overflow hoặc Axe violation theo WCAG2A/AA/2.1AA tags. Không thấy button đang hiển thị dưới 24 CSS px; phép đo này không phải chứng nhận mọi link/label/touch target đạt 44 px. Keyboard/focus/dialog/draft/error/loading/empty/concurrency có evidence riêng trong suite.
- Các test đỏ trước sửa và harness lỗi không được ghi thành PASS: lần đầu dev server trỏ nhầm port local; test logout/readback cần đợi session; GET slot phải dùng collection endpoint hiện hữu. Đã sửa harness và chạy lại đúng môi trường.
- Không thử ghi production, không sửa/reset DB production, không đổi cloud config, PA2 hay Figma. 49 FR/106 AC không được tăng thêm hoặc thay nghĩa. NFR-05 vẫn **PARTIAL** vì chưa có human screen-reader session hoặc đánh giá exhaustive contrast/focus/real-device/cross-browser.

[Bằng chứng máy đọc được và matrix đủ 28 trạng thái](evidence/screen-usability.json). Script chụp ảnh vào thư mục tạm của hệ điều hành; không commit ảnh sân test hoặc dữ liệu tài khoản.

## Chỉ nên cân nhắc sau khi thử với người dùng

- Nút hiện/ẩn mật khẩu có thể giảm lỗi nhập trên mobile, nhưng hiện chưa có user-study chứng minh cần đổi form. Giữ khả năng paste/password manager hiện hữu.
- Form tạo sân mobile khá dài: có thể thử chia nhóm/thu gọn phần ảnh và thông tin bổ sung. Chưa tự thay wizard hoặc giấu trường bắt buộc vì phải kiểm tra ảnh hưởng tới PA2, validation và draft recovery.
- Cần người dùng Player/Owner thực đi qua toàn bộ 17 UC, VoiceOver/NVDA và prototype playback có đăng nhập. Không đánh dấu những hoạt động này PASS bằng số đo Axe hoặc node tồn tại.
