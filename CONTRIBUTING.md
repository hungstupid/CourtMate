# Collaboration Guidelines

Áp dụng cho toàn bộ PA0–PA5 và Final. Mục đích là làm việc minh bạch, kiểm tra được **đóng góp thật** của từng thành viên mà không cần tạo thêm nhiều tài liệu quản lý.

## Task → Issue → PR → Review

1. Cả nhóm thống nhất công việc (WBS ID nếu có), mục tiêu, người phụ trách, người review, ước lượng giờ công và deadline.
2. Tạo [Issue](https://github.com/hungstupid/CourtMate/issues) theo mẫu có sẵn và thêm vào GitHub Projects. `Assignee` là người chịu trách nhiệm chính; `Due date` là hạn dự kiến.
3. Người làm tạo nhánh riêng từ `main` (ví dụ `docs/pa1-plan`, `feat/court-search`), commit với tiền tố `docs:`, `feat:`, `fix:`, `test:` hoặc `chore:`.
4. Tạo Pull Request (PR), đính kèm Issue và kết quả kiểm tra thực tế; ít nhất **một người khác** review trước khi merge vào `main`.
5. Chỉ chuyển task sang `Done` sau khi có sản phẩm, review và bằng chứng thích hợp.

**GitHub Projects** là bảng theo dõi công việc, không cần tạo bảng đóng góp thứ hai chỉ để chép lại trạng thái Issues.

## Cách commit vừa đủ

### Làm tài liệu trên Google Docs
Viết phần được giao trên tài liệu chung bằng tài khoản cá nhân. Khi xong, comment link và vị trí phần viết trong Issue, chuyển sang Review. Người review góp ý/xác nhận trong Docs và Issue. Không cần mỗi bạn xuất một bản Word để tạo commit. Người tổng hợp đưa bản PA đã chốt lên repo.

### Đưa Word/PDF lên GitHub bằng giao diện
1. Mở đúng thư mục, ví dụ `pa/PA1/` hoặc `docs/management/weekly/`.
2. Chọn **Add file → Upload files**, chọn file đã chốt.
3. Ghi commit message, ví dụ `docs: add W02 status report`.
4. Chọn **Create a new branch for this commit and start a pull request**, đặt tên branch, rồi lưu.
5. Mở PR vào `main`, ghi link Issue (nếu có), chọn bạn review. Sau khi được chấp nhận và checks đạt, người có quyền merge gộp PR; xóa branch đã xong.

Báo cáo tuần đặt tên `W02-status.docx`, `W03-status.docx`… W2–W10 có tổng 9 báo cáo. Nhóm chọn deadline và ghi trong PA1 (PA0 hiện đề xuất Chủ nhật 22:00). Bản nháp có thể ở Drive; bản được lưu vào repo mới có lịch sử commit. Không ghi lùi ngày để che trễ hạn.

### Làm code bằng Git
Lần đầu: `git clone https://github.com/hungstupid/CourtMate.git`, rồi `cd CourtMate`. Đăng nhập GitHub trên công cụ Git của bạn khi được yêu cầu.

Mỗi task mới, bắt đầu khi working tree sạch:

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/court-search
# Sửa code trong src/frontend/ hoặc src/backend/, chạy kiểm tra phù hợp
git status
git add src/frontend/
git diff --cached
git commit -m "feat: add court search"
git push -u origin feat/court-search
```

Đổi tên branch, đường dẫn trong `git add` và message theo task thực tế. `git status` kiểm tra file đã đổi; `git add` chọn file; `git diff --cached` kiểm tra phần sắp commit; `commit` lưu thay đổi; `push` đưa branch lên GitHub. Sau đó mở PR, nhờ review và merge như trên. Nếu Git báo conflict hoặc lỗi, dừng và trao đổi với Lead/người sửa cùng phần; không force push vào `main`.

## Evidence of Contribution

Để cuối mỗi PA tính Member Contribution, ưu tiên:
- **Issue:** người nhận việc, phạm vi, deadline và tiến độ.
- **PR/Commit/Review:** thay đổi và người kiểm tra.
- **Google Docs revision history:** chứng minh chỉnh sửa tài liệu nhóm khi nhiều người cùng viết một file.
- **Weekly report:** kết quả thật, liên kết đến tài liệu/Issue/PR và blockers.

Bảng **Member Contribution** phải có trong mỗi PA được chấm và cộng thành 100%, dựa trên thỏa thuận và bằng chứng. Một người upload Word/PDF không đồng nghĩa người đó đã viết toàn bộ tài liệu.

## Documents and Submission

- Cấu trúc theo mẫu PA1: code trong `src/frontend/` và `src/backend/`; tài liệu trong `docs/management/`, `docs/requirements/`, `docs/design/`, `docs/test/`, `docs/ai-usage/`.
- WBS, Gantt, risks, requirements, architecture, test cases... được trình bày **trực tiếp trong tài liệu của PA tương ứng** theo mẫu môn học. Không bắt buộc tách thành các file riêng trong repository.
- Làm nháp trên công cụ cộng tác phù hợp; bản nộp chính thức gồm PDF và file nguồn lưu tại `pa/PAx/` và nộp Moodle.
- Báo cáo tiến độ W2–W10: `docs/management/weekly/W<week>-status.docx` (hoặc `.md` theo mẫu thầy). Commit đúng hạn do nhóm thống nhất; không sửa báo cáo cũ để che trễ hạn.
- File nguồn hoặc đường dẫn bản đang làm đặt trong thư mục `docs/` tương ứng; tránh chép lặp toàn bộ nội dung PA.
- AI Usage Log nằm trong từng PA; chỉ ghi hoạt động AI và nội dung kiểm chứng có thật.
- Không công bố mật khẩu, `.env`, API key, private key, dữ liệu cá nhân hay bằng chứng không có thật.



