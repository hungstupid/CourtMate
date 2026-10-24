# 5.3 Domain Requirements & Business Rules — CourtMate

## 1. Overview
Tài liệu này định nghĩa các quy tắc nghiệp vụ cốt lõi (Business Rules - BR) và các ràng buộc miền ứng dụng (Domain Requirements) cho hệ thống **CourtMate**. Các quy tắc này đóng vai trò là nền tảng logic để kiểm chứng các Yêu cầu Chức năng (Functional Requirements - FR) và Tiêu chí Chấp nhận (Acceptance Criteria - AC).

---

## 2. Business Rules Catalog Summary

| ID | Rule Name | Category | Enforcement Level | Related Modules |
| :--- | :--- | :--- | :--- | :--- |
| **BR-01** | Booking Slot Duration & Time-Step Rules | Constraint | Strict (System-enforced) | Court Scheduling & Booking |
| **BR-02** | Booking Cancellation Eligibility & Cutoff | Constraint / Computation | Strict (System-enforced) | Booking & Payment/Refund |
| **BR-03** | Schedule Changes Conflicting with Confirmed Bookings | Action Enabler / Constraint | Strict (System-enforced) | Venue Management & Booking |
| **BR-04** | Confirmed Booking & Linked Open Play Room Constraints | Prerequisite / Constraint | Strict (System-enforced) | Booking & Open Play Room |
| **BR-05** | Room Capacity & Organizer Participation | Constraint / Inference | Strict (System-enforced) | Open Play Room |
| **BR-06** | Full-Room Behavior & Booking Cancellation Effects | State Transition / Trigger | Strict (System-enforced) | Open Play Room & Notification |
| **BR-07** | Last-Minute Deals Eligibility & Owner-Managed Discounts | Computation / Constraint | Strict / Guideline | Promotions & Pricing |

---

## 3. Detailed Business Rules Specification

### BR-01 — Booking Slot Duration and Time-Step Rules
* **Rule Statement:** 
  1. Mọi lượt đặt sân (Booking) phải có thời lượng tối thiểu là **[60] phút** và tối đa là **[4] giờ** cho một lần đặt.
  2. Thời gian bắt đầu (Start Time) và thời gian kết thúc (End Time) của một lượt đặt sân phải tuân theo bước nhảy cố định (time-step increment) là **[30] phút** (ví dụ: chỉ chấp nhận `08:00`, `08:30`, `09:00`; không chấp nhận các mốc lẻ như `08:15` hay `08:40`).
  3. Lượt đặt sân phải nằm hoàn toàn trong khung giờ hoạt động (Operating Hours) đã cấu hình của sân đó.
* **Source / Rationale:** 
  * *Source:* Quy chuẩn vận hành thực tế của các cụm sân thể thao (cầu lông, pickleball, tennis) và tài liệu phân tích nghiệp vụ CourtMate.
  * *Rationale:* Tối ưu hóa việc lấp đầy lịch trống trên lưới thời gian (calendar grid), ngăn chặn tình trạng "phân mảnh thời gian" (time fragmentation — tạo ra các khoảng trống lẻ 15-20 phút không thể cho thuê tiếp).
* **Cross-Check (FR & AC Alignment):**
  * **FR:** Liên kết với chức năng *Search Available Courts* và *Create Court Booking*.
  * **AC:** Hệ thống chỉ hiển thị các time-slot hợp lệ trên UI; API backend trả về lỗi `400 Bad Request (INVALID_TIME_SLOT)` nếu payload chứa thời gian không chia hết cho bước nhảy 30 phút hoặc thời lượng `< 60 phút`.

---

### BR-02 — Booking Cancellation Eligibility and Cutoff
* **Rule Statement:** 
  1. Người chơi (Player/Organizer) chỉ được phép chủ động hủy lượt đặt sân ở trạng thái `Confirmed` nếu thời điểm yêu cầu hủy cách thời điểm bắt đầu trận đấu (`Booking Start Time`) tối thiểu **[24] giờ** (Cutoff Window).
  2. Nếu hủy **trước** mốc Cutoff (**$\ge$ [24] giờ**): Cho phép hủy trên hệ thống và hoàn trả **[100%]** tiền cọc/tiền sân (hoặc chuyển vào ví nội bộ).
  3. Nếu thời gian còn lại **ít hơn** mốc Cutoff (**$<$ [24] giờ**): Hệ thống khóa chức năng tự hủy trực tuyến (hoặc cho phép hủy nhưng áp dụng mức phí phạt **[100%]** tiền cọc — tức không hoàn tiền).
  4. Không cho phép hủy đối với các lượt đặt sân đang diễn ra (`In-Progress`) hoặc đã hoàn thành (`Completed`).
* **Source / Rationale:** 
  * *Source:* Chính sách bảo vệ doanh thu của Chủ sân (Court Owner) và quy định thanh toán.
  * *Rationale:* Bảo vệ chủ sân khỏi việc bị hủy kèo sát giờ dẫn đến trống sân không kịp tìm khách thay thế, đồng thời nâng cao trách nhiệm của người đặt sân.
* **Cross-Check (FR & AC Alignment):**
  * **FR:** Liên kết với chức năng *Cancel Booking* và *Process Refund*.
  * **AC:** Nút "Cancel Booking" bị vô hiệu hóa (hoặc hiển thị cảnh báo mất cọc rõ ràng) khi `Current_Time > (Booking_Start_Time - 24h)`.

---

### BR-03 — Schedule Changes Conflicting with Confirmed Bookings
* **Rule Statement:** 
  1. Chủ sân (Court Owner) **không được phép** chỉnh sửa giờ đóng/mở cửa, đổi giá базо (base price), hoặc đóng sân bảo trì trực tiếp trên các khung giờ đã có lượt đặt sân ở trạng thái `Confirmed`.
  2. Mọi thay đổi về lịch hoạt động chung của sân chỉ được áp dụng cho các khung giờ còn trống (`Available`) trong tương lai.
  3. *Trường hợp bất khả kháng (Force Majeure / Emergency Closure):* Nếu chủ sân buộc phải đóng sân vào khung giờ đã có lịch `Confirmed`, hệ thống yêu cầu chủ sân thực hiện luồng **"Force Cancel by Owner"** kèm lý do bắt buộc, tự động hoàn tiền **100%** cho khách và gửi thông báo khẩn cấp cho toàn bộ người chơi liên quan.
* **Source / Rationale:** 
  * *Source:* Cam kết dịch vụ (SLA) giữa nền tảng CourtMate, Chủ sân và Người chơi.
  * *Rationale:* Đảm bảo tính toàn vẹn dữ liệu lịch đặt (schedule integrity) và giữ uy tín cho nền tảng, tránh việc chủ sân tự ý đổi lịch làm khách đến nơi không có sân chơi.
* **Cross-Check (FR & AC Alignment):**
  * **FR:** Liên kết với chức năng *Manage Court Schedule / Operating Hours* và *Owner Force Cancellation*.
  * **AC:** Khi chủ sân lưu lịch hoạt động mới gây xung đột với các booking `Confirmed`, hệ thống chặn thao tác lưu và hiển thị danh sách các Booking ID đang bị trùng để chủ sân xử lý trước.

---

### BR-04 — Confirmed Booking and Linked Open Play Room Constraints
* **Rule Statement:** 
  1. Một phòng giao lưu (**Open Play Room**) chỉ được phép khởi tạo khi và chỉ khi người tạo phòng (Organizer) đã sở hữu một lượt đặt sân ở trạng thái `Confirmed` trong tương lai.
  2. Mỗi lượt đặt sân `Confirmed` chỉ được liên kết với **tối đa một (01)** Open Play Room đang hoạt động (`Active`/`Open`/`Full`) tại một thời điểm (quan hệ 1-1).
  3. Thời gian diễn ra và địa điểm (Sân, Cụm sân) của Open Play Room phải kế thừa chính xác và bị khóa cứng (read-only) theo thông tin của lượt đặt sân `Confirmed` gốc.
* **Source / Rationale:** 
  * *Source:* Nghiệp vụ cốt lõi của tính năng ghép người chơi (Social/Open Play matching) trên CourtMate.
  * *Rationale:* Ngăn chặn tuyệt đối tình trạng tạo "phòng ảo" (gom người chơi nhưng thực tế chưa đặt được sân) hoặc spam nhiều phòng cho cùng một sân gây hỗn loạn khi người chơi đến sân.
* **Cross-Check (FR & AC Alignment):**
  * **FR:** Liên kết với chức năng *Create Open Play Room*.
  * **AC:** Người dùng không thể nhập tay địa điểm/thời gian khi tạo phòng mà phải chọn từ danh sách `My Confirmed Bookings` chưa có phòng liên kết.

---

### BR-05 — Room Capacity and Organizer Participation
* **Rule Statement:** 
  1. Khi khởi tạo một Open Play Room, người tạo phòng (Organizer) mặc định được tính là thành viên đầu tiên tham gia vào phòng (chiếm **01** slot).
  2. Tổng sức chứa của phòng (`Max_Capacity`) phải lớn hơn hoặc bằng **2** và không được vượt quá giới hạn người chơi tối đa do loại sân quy định (`Court_Max_Players`, ví dụ: `[8]` người/sân đối với cầu lông/pickleball xoay tua).
  3. Số lượng chỗ trống còn lại cho người chơi vãng lai tham gia được tính theo công thức:
     $$\text{Available\_Slots} = \text{Max\_Capacity} - \text{Current\_Participants}$$
     *(Trong đó $\text{Current\_Participants} = 1 + \text{Accepted\_Guests\_Count}$, với $1$ là Organizer).*
* **Source / Rationale:** 
  * *Source:* Quy tắc tổ chức trận đấu giao lưu và giới hạn vật lý của sân thể thao.
  * *Rationale:* Đảm bảo tính toán chính xác số lượng người cần tuyển thêm và tránh việc nhận quá nhiều người dẫn đến quá tải tại sân.
* **Cross-Check (FR & AC Alignment):**
  * **FR:** Liên kết với chức năng *Create Open Play Room* và *Join Open Play Room*.
  * **AC:** Ngay sau khi tạo phòng với `Max_Capacity = N`, trạng thái số lượng người trong phòng hiển thị là `1 / N` (với Organizer nằm trong danh sách thành viên) và còn `N - 1` slot trống.

---

### BR-06 — Full-Room Behavior and Booking Cancellation Effects
* **Rule Statement:** 
  1. **Hành vi khi đầy phòng (Full-Room Behavior):** 
     * Khi $\text{Current\_Participants} == \text{Max\_Capacity}$, trạng thái của Open Play Room tự động chuyển từ `Open` sang `Full`.
     * Các phòng ở trạng thái `Full` sẽ từ chối mọi yêu cầu xin vào phòng mới (`Join Request`).
     * Nếu một thành viên (không phải Organizer) rời phòng trước giờ khóa sổ khiến $\text{Current\_Participants} < \text{Max\_Capacity}$ (và chưa quá giờ bắt đầu), trạng thái phòng tự động mở lại thành `Open`.
  2. **Hiệu ứng dây chuyền khi hủy sân (Booking Cancellation Effects):** 
     * Nếu lượt đặt sân `Confirmed` gốc bị hủy (bởi Organizer theo **BR-02** hoặc bởi Chủ sân theo **BR-03**), Open Play Room liên kết với booking đó phải tự động chuyển sang trạng thái `Cancelled` ngay lập tức (Cascading Cancellation).
     * Hệ thống tự động gửi thông báo hủy phòng cho toàn bộ thành viên đã tham gia và hủy các yêu cầu xin vào phòng đang chờ duyệt (`Pending`).
* **Source / Rationale:** 
  * *Source:* Quản lý vòng đời trạng thái (State Lifecycle) giữa thực thể `Booking` và `OpenPlayRoom`.
  * *Rationale:* Tránh lỗi đồng bộ (race condition / overbooking người chơi) khi phòng đã đủ người, và đảm bảo không tồn tại các "phòng mồ côi" (orphaned rooms) khi sân thi đấu thực tế đã bị hủy.
* **Cross-Check (FR & AC Alignment):**
  * **FR:** Liên kết với chức năng *Join/Leave Open Play Room* và *Cancel Booking*.
  * **AC:** 
    * Khi người chơi thứ $N$ tham gia thành công, nút "Join Room" lập tức bị khóa đối với các người dùng khác.
    * Khi Booking gốc chuyển sang `Cancelled`, trạng thái phòng liên kết đổi thành `Cancelled` trong cùng một database transaction.

---

### BR-07 — Last-Minute Deals Eligibility and Owner-Managed Discount Rules
* **Rule Statement:** 
  1. **Điều kiện áp dụng (Eligibility):** Chương trình giảm giá giờ chót (**Last-Minute Deal**) chỉ được áp dụng cho các khung giờ sân đang trống (`Available`) có thời gian bắt đầu nằm trong khoảng từ thời điểm hiện tại đến tối đa **[12 - 24] giờ** tới ($\text{Current\_Time} < \text{Slot\_Start\_Time} \le \text{Current\_Time} + \text{Deal\_Window}$).
  2. **Quyền cấu hình của Chủ sân (Owner-Managed Rules):** 
     * Chủ sân có quyền bật/tắt tính năng Last-Minute Deal và thiết lập mức phần trăm giảm giá (`Discount_Rate`) nằm trong ngưỡng cho phép của hệ thống: tối thiểu **[5%]** và tối đa **[70%]** so với giá gốc.
     * Giá sau giảm được tính theo công thức: $\text{Deal\_Price} = \text{Base\_Price} \times (1 - \text{Discount\_Rate})$.
  3. **Quy tắc không cộng dồn & Hủy lịch (Non-Stacking & Cancellation):** 
     * Một khung giờ chỉ được áp dụng một chương trình giảm giá duy nhất của chủ sân tại một thời điểm (không cộng dồn nhiều mã giảm giá).
     * Do đặc thù sát giờ (nằm trong hoặc sát ngưỡng Cutoff của **BR-02**), các lượt đặt sân sử dụng Last-Minute Deal mặc định **không hỗ trợ hoàn tiền khi người chơi hủy (Non-refundable)**.
* **Source / Rationale:** 
  * *Source:* Chiến lược tối ưu hóa doanh thu (Yield Management) cho các khung giờ trống sát nút của Chủ sân.
  * *Rationale:* Giúp chủ sân thu hồi vốn cho các ca sân có nguy cơ bỏ trống cao, đồng thời ngăn chặn lỗi cấu hình nhầm giá (như giảm 100% hoặc giảm giá âm) và ngăn người chơi lợi dụng đặt sân giá rẻ rồi hủy ngang.
* **Cross-Check (FR & AC Alignment):**
  * **FR:** Liên kết với chức năng *Configure Last-Minute Deals (Owner)* và *Book Court with Deal (Player)*.
  * **AC:** Hệ thống tự động gắn nhãn "Last-Minute Deal" và hiển thị giá giảm khi slot trống bước vào khung thời gian `Deal_Window`; từ chối cấu hình của chủ sân nếu `Discount_Rate < 5%` hoặc `> 70%`.

---

## 4. Unresolved Business Decisions (Open Issues for Team Discussion)

Bảng dưới đây tổng hợp các điểm nghiệp vụ biên (edge cases) cần cả nhóm và Product Owner chốt lại trong buổi Review để đồng bộ code và tài liệu:

| Issue ID | Related BR | Question / Decision Needed | Options / Proposed Resolution | Impacted Areas |
| :--- | :--- | :--- | :--- | :--- |
| **TBD-01** | **BR-01** | Có cho phép đặt sân nối tiếp qua nửa đêm (ví dụ: 23:00 hôm nay đến 01:00 sáng hôm sau) đối với sân mở 24/7 không? | **Đề xuất:** Trong phạm vi MVP (PA2), giới hạn đặt sân trong cùng một ngày dương lịch để đơn giản hóa logic kiểm tra lịch. | Booking UI, Availability Query |
| **TBD-02** | **BR-02, BR-04** | Nếu một Booking đã tạo Open Play Room và **đã có người chơi khác tham gia**, Organizer có được phép tự ý hủy Booking gốc (dù vẫn trước mốc 24h) không? | **Option A:** Cho phép hủy tự do, tự động giải tán phòng (như BR-06).<br>**Option B (Đề xuất):** Cảnh báo gắt gao hoặc trừ điểm uy tín của Organizer nếu hủy phòng đã có khách tham gia. | Cancel Booking Logic, User Reputation |
| **TBD-03** | **BR-05** | Trường hợp Organizer đặt sân giúp bạn bè nhưng bản thân **không trực tiếp ra sân đánh** (chỉ đứng ra tổ chức) thì có bắt buộc chiếm 1 slot trong `Max_Capacity` không? | **Đề xuất:** Giữ nguyên quy tắc Organizer luôn chiếm 1 slot để đơn giản hóa mô hình dữ liệu; nếu muốn tuyển thêm 1 người thì Organizer chỉ cần tăng `Max_Capacity` lên +1 khi tạo phòng. | Room Creation Form, Capacity Calculation |
| **TBD-04** | **BR-05, BR-06** | Khi thành viên tham gia Open Play Room, tiền sân chia sẻ (split fee) được thanh toán trực tiếp qua hệ thống CourtMate hay tự thu tiền mặt tại sân? | **Đề xuất:** Cần chốt rõ: Nếu thu tại sân thì khi hủy Booking gốc (BR-06) chỉ cần hoàn tiền cho Organizer. Nếu thu qua app thì phải hoàn tiền cho từng Guest trong phòng. | Payment Module, Refund Flow |
| **TBD-05** | **BR-06** | Có quy định thời gian khóa sổ (Cutoff time) cho việc **Guest rời khỏi Open Play Room** không? (Tránh trường hợp Guest thoát phòng trước giờ đánh 10 phút làm thiếu người). | **Đề xuất:** Khóa nút "Leave Room" của Guest trong vòng **[6] giờ** trước khi trận đấu bắt đầu. | Open Play Room Member Management |

---

## 5. Traceability & Consistency Matrix (FR & AC Cross-Check)

| Business Rule | Consistency Check Criteria | Status | Verification Note |
| :--- | :--- | :--- | :--- |
| **BR-01** | Time-step (30m) và Min/Max Duration nhất quán giữa UI DatePicker và Backend Validation. | ✅ Verified | Đảm bảo AC của chức năng đặt sân kiểm tra cả biên dưới (60m) và bước nhảy (30m). |
| **BR-02** | Mốc Cutoff hủy sân (24h) nhất quán với trạng thái Booking State Machine. | ✅ Verified | Đảm bảo không có FR nào cho phép chuyển trạng thái từ `Completed` sang `Cancelled`. |
| **BR-03** | Quyền chỉnh sửa lịch của Owner không ghi đè lên các bản ghi Booking `Confirmed`. | ✅ Verified | Đã tách biệt luồng *Update Regular Schedule* và *Emergency Force Cancel*. |
| **BR-04** | Ràng buộc khóa ngoại `booking_id` (Unique, Not Null, Status = Confirmed) trong bảng `open_play_rooms`. | ✅ Verified | Khớp hoàn toàn với sơ đồ ERD và AC của tính năng tạo phòng. |
| **BR-05** | Công thức tính slot trống nhất quán trên màn hình danh sách phòng và chi tiết phòng. | ✅ Verified | `Current_Participants` khởi tạo bằng `1` ngay khi tạo phòng. |
| **BR-06** | Trạng thái phòng (`Open` $\leftrightarrow$ `Full` $\rightarrow$ `Cancelled`) đồng bộ tức thời với biến động thành viên và Booking gốc. | ✅ Verified | AC đã bao phủ kịch bản tự động mở lại phòng khi có người rời đi và hủy dây chuyền khi hủy sân. |
| **BR-07** | Điều kiện thời gian và giới hạn % giảm giá của Last-Minute Deal không mâu thuẫn với chính sách hoàn hủy (BR-02). | ✅ Verified | Các booking qua Last-Minute Deal được gắn cờ `is_refundable = false` để tránh xung đột với BR-02. |