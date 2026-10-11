# testing/ — kiểm thử cho mọi PA

Lưu tài liệu **lập kế hoạch và bằng chứng thật** về kiểm thử:
- PA4: test plan, levels/types, entry/exit criteria, kỹ thuật EP/BVA/decision table, test cases (ID, preconditions, data, steps, expected), requirement traceability cho **mọi Must-have**.
- PA5: kết quả execution thật (ngày, commit/version, actual result, Pass/Fail), defects/bug issue link, test summary, coverage và CI run link.
- Nếu cần regression ở giai đoạn sau, lưu cùng nơi với mã test tương ứng ở `frontend/`, `backend/`.

**Không ghi rằng test Pass, có coverage hoặc đã deploy nếu chưa chạy/kiểm chứng thực tế.** Không dùng dữ liệu người dùng thật trong test evidence. PDF bản nộp ở `pa/PA4` hoặc `pa/PA5`.
