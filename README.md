# CourtMate · Nexora (T05)

**Introduction to Software Engineering — HCMUS**

CourtMate là đồ án web tìm kiếm và đặt sân thể thao, hỗ trợ chủ sân quản lý lịch đặt. Đây là repository chung cho **toàn bộ PA0–PA5 và Final**. Mọi quyết định chưa được nhóm hoặc TA thông qua đều là đề xuất.

## Đăng tài liệu ở đâu?

| Thư mục | Mọi người dùng để |
| --- | --- |
| [`frontend/`](frontend/README.md) | Code và test giao diện web |
| [`backend/`](backend/README.md) | API, nghiệp vụ, database/migration, test backend |
| [`docs/management/`](docs/management/README.md) | Kế hoạch/WBS, Gantt, risks, họp, quyết định, đóng góp, **weekly report W2–W10** |
| [`docs/requirements/`](docs/requirements/README.md) | Vision, scope, FR/NFR, use case, business rules, traceability |
| [`docs/design/`](docs/design/README.md) | C4, ADR, UML, ERD, UI/UX |
| [`docs/testing/`](docs/testing/README.md) | Test plan/cases, kết quả thật, defect và bằng chứng |
| [`docs/ai-usage/`](docs/ai-usage/README.md) | AI Usage Log và cách thành viên kiểm chứng |
| [`pa/`](pa/README.md) | **Chỉ bản chính thức đã nộp** PDF + source của từng PA/Final |
| [`.github/`](.github/PULL_REQUEST_TEMPLATE.md) | Mẫu PR, Issues và kiểm tra tự động cơ bản |

**Nhớ 4 nơi chính:** Task → GitHub Projects/Issues; bản đang sửa → `docs/`; bản nộp → `pa/`; code → `frontend/` / `backend/`.

## Cách phối hợp

1. Sau buổi họp, nhóm chốt **WBS ID, owner, reviewer, deadline, person-hours** rồi tạo Issue bằng mẫu Work Package và đưa vào GitHub Projects.
2. Tạo branch riêng (`docs/...`, `feat/...`, `fix/...`) → commit có nghĩa → mở PR → **ít nhất 1 người khác review** → merge.
3. Xem [CONTRIBUTING.md](CONTRIBUTING.md) để biết quy tắc làm việc và bảo mật. Không commit `.env`, API key hoặc dữ liệu riêng tư.
4. Mỗi tuần W2–W10 cập nhật báo cáo vào [`docs/management/weekly/`](docs/management/weekly/README.md); deadline nội bộ đang **dự kiến** Chủ nhật 22:00, nhóm cần xác nhận.
5. Với mỗi PA: nộp PDF + file nguồn lên Moodle; commit bản giống hệt vào `pa/PAx/`, không sửa âm thầm bản đã nộp. Kiểm tra deadline chính thức trên Moodle.

## CourtMate: điểm chưa chốt

Phạm vi PA0 đề xuất 8 Must-have và 2 Should-have. **Thời lượng đặt sân** và **cách xác nhận booking** chưa thống nhất (không tự gán 60 phút). React + FastAPI + PostgreSQL mới là stack đề xuất.

[PA0 Google Doc](https://docs.google.com/document/d/1q32BiCtVhKpyceWly3hzzVZmYrN8v_fZM5uOVZal5VE/edit) · [Issues](https://github.com/hungstupid/CourtMate/issues) · [Projects](https://github.com/hungstupid/CourtMate/projects)

> README và CI cơ bản đã chuẩn bị; **tạo Project board, bảo vệ `main` (PR + review), thêm đủ thành viên và TA** cần thao tác/kiểm tra trong GitHub Settings. README không tự bật các cài đặt quản trị.
