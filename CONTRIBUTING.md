# Quy tắc đóng góp — áp dụng cho mọi PA

## Trước khi làm
- Thống nhất trong nhóm: WBS ID, mục tiêu, file đầu ra, owner, reviewer/backup, estimate (person-hours), dependency và due date.
- Dùng **GitHub Projects** để theo dõi `Backlog → To Do → In Progress → Review → Done` (hoặc `Blocked`). **Done** chỉ khi đầu ra có thật, đã review và có link bằng chứng.

## Khi làm
1. Branch mới từ `main`: ví dụ `docs/pa1-wbs`, `feat/court-search`, `fix/booking-overlap`.
2. Commit theo Conventional Commits: `docs:`, `feat:`, `fix:`, `test:`, `chore:`...
3. PR dùng biểu mẫu có sẵn, gắn Issue/WBS, liệt kê điều đã thay đổi và test **thực sự chạy**.
4. Có **≥1 người khác review** và giải quyết góp ý trước khi merge vào `main`; không tự approve.
5. Cập nhật issue/board và liên kết PR, commit hoặc tài liệu. Không đánh dấu hoàn tất nếu thiếu bằng chứng.

## Bài nộp và trách nhiệm
- Draft để trong `docs/`; bản đã nộp (PDF và file nguồn) trong `pa/PAx/` và trên Moodle.
- Sau mỗi PA, bản nộp là baseline: mọi thay đổi quan trọng phải ghi lý do và phạm vi ảnh hưởng tới requirement/design/test.
- PA1–PA5 cần Member Contribution (tổng 100%) và AI Usage Log. Đánh giá đóng góp dựa trên công việc **có chứng cứ**, không chia đều mặc định.
- W2–W10: báo cáo tuần đúng hạn trong `docs/management/weekly/`, không sửa quá khứ nhằm che trễ hạn.
- **Tuyệt đối không commit** password, `.env`, API token, private key, dữ liệu cá nhân, test giả hoặc bằng chứng giả. AI có thể hỗ trợ nhưng phải kiểm chứng và khai báo.

## Việc Team Lead cần bật bằng giao diện GitHub
- Settings → Rules/Rulesets: bảo vệ `main`, yêu cầu PR, ≥1 approval và cấm force push.
- Mời thành viên, TA/giảng viên vào repo với quyền cần thiết.
- Tạo GitHub Project board và gán Issues theo WBS **sau khi họp**.
- Bảo đảm kênh Discord/Slack/Teams chính thức có TA.

**Lưu ý:** file quy định không thể thay thế các cấu hình quản trị thực tế.
