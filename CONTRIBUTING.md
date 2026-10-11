# Collaboration Guidelines

Áp dụng cho toàn bộ PA0–PA5 và Final. Mục đích là làm việc minh bạch, kiểm tra được **đóng góp thật** của từng thành viên mà không cần tạo thêm nhiều tài liệu quản lý.

## Task → Issue → PR → Review

1. Cả nhóm thống nhất công việc (WBS ID nếu có), mục tiêu, người phụ trách, người review, ước lượng giờ công và deadline.
2. Tạo [Issue](https://github.com/hungstupid/CourtMate/issues) theo mẫu có sẵn và thêm vào GitHub Projects. `Assignee` là người chịu trách nhiệm chính; `Due date` là hạn dự kiến.
3. Người làm tạo nhánh riêng từ `main` (ví dụ `docs/pa1-plan`, `feat/court-search`), commit với tiền tố `docs:`, `feat:`, `fix:`, `test:` hoặc `chore:`.
4. Tạo Pull Request (PR), đính kèm Issue và kết quả kiểm tra thực tế; ít nhất **một người khác** review trước khi merge vào `main`.
5. Chỉ chuyển task sang `Done` sau khi có sản phẩm, review và bằng chứng thích hợp.

**GitHub Projects** là bảng theo dõi công việc, không cần tạo bảng đóng góp thứ hai chỉ để chép lại trạng thái Issues.

## Evidence of Contribution

Để cuối mỗi PA tính Member Contribution, ưu tiên:
- **Issue:** người nhận việc, phạm vi, deadline và tiến độ.
- **PR/Commit/Review:** thay đổi và người kiểm tra.
- **Google Docs revision history:** chứng minh chỉnh sửa tài liệu nhóm khi nhiều người cùng viết một file.
- **Weekly report:** kết quả thật, liên kết đến tài liệu/Issue/PR và blockers.

Bảng **Member Contribution** phải có trong mỗi PA được chấm và cộng thành 100%, dựa trên thỏa thuận và bằng chứng. Một người upload Word/PDF không đồng nghĩa người đó đã viết toàn bộ tài liệu.

## Documents and Submission

- WBS, Gantt, risks, requirements, architecture, test cases... được trình bày **trực tiếp trong tài liệu của PA tương ứng** theo mẫu môn học. Không bắt buộc tách thành các file riêng trong repository.
- Làm nháp trên công cụ cộng tác phù hợp; bản nộp chính thức gồm PDF và file nguồn lưu tại `pa/PAx/` và nộp Moodle.
- Báo cáo tiến độ W2–W10: `docs/management/weekly/W<week>-status.md` (hoặc định dạng TA quy định). Commit đúng hạn do nhóm thống nhất; không sửa báo cáo cũ để che trễ hạn.
- AI Usage Log nằm trong từng PA; chỉ ghi hoạt động AI và nội dung kiểm chứng có thật.
- Không công bố mật khẩu, `.env`, API key, private key, dữ liệu cá nhân hay bằng chứng không có thật.

## Repository Administration

Team Lead cần kiểm tra bằng giao diện GitHub: thêm thành viên và TA theo yêu cầu, tạo Project Board, bảo vệ nhánh `main` bằng PR và ≥1 approval, và mời TA vào kênh Discord/Slack/Teams chính thức. Việc có file hướng dẫn **không tự bật** các cài đặt quản trị trên GitHub.
