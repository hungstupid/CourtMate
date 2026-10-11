# management/ — quản lý cho toàn bộ PA

**Gộp một chỗ để nhóm dễ tìm.** Không cần thêm nhiều lớp `planning/`, `templates/`, `meetings/`, `contributions/` cho đến khi thực sự cần.

| Loại tài liệu | Tên gợi ý và cần ghi |
| --- | --- |
| Kế hoạch, WBS | `project-plan.md`, `WBS.md`: ≥3 cấp, owner, deliverable, person-hours, dependency, Issue link |
| Timeline / Gantt | `schedule.md`, `gantt.png`: duration khác effort, milestone, critical path |
| Chi phí | `cost-estimate.md`: hourly rate × effort, tool/hosting, giả định |
| Rủi ro | `risk-register.md`: Risk, Type, Probability, Loss, RE=P×Loss, Mitigation, Contingency, Owner |
| Họp và quyết định | `YYYY-MM-DD-meeting.md`, `decision-log.md`: người dự, lựa chọn, việc đã chốt/chưa chốt, action owner và hạn |
| Bằng chứng đóng góp | `contributions.md`: links đến issue, PR, commits, reviews, deliverables |
| Báo cáo tuần | [weekly/](weekly/README.md): W2 tới W10, commit đúng hạn |

**Mẫu biên bản họp:** ngày, người dự, agenda → phương án thảo luận → decision status (Proposed/Approved) → bảng `Task | Owner | Due | Reviewer | Issue` → TA questions.

**Risk register:** ít nhất 5 rủi ro; dùng thang Probability/Loss của **bài giảng môn**, không tự chế mức chấm. Rủi ro, estimate và contribution là **dự kiến** cho đến khi nhóm duyệt.

**Nguồn trạng thái task:** GitHub Projects. Tài liệu trong folder ghi kế hoạch, lý do và lịch sử quyết định, không thay thế task board.

Các quyết định về thời lượng booking, xác nhận booking, công nghệ và số giờ làm việc phải được ghi lại đúng trạng thái (chưa chốt/đã chốt).
