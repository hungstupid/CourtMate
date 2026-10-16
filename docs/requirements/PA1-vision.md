# 2. Vision

## 2.1 Preliminary Problem Statement

### Business Background and Problem Description
Recreational sports such as badminton, football, tennis, and pickleball attract a large number of regular players. However, the process of discovering venues, checking slot availability, and reserving courts remains fragmented and largely manual. Currently, players typically have to contact multiple venue operators via phone calls or messaging applications (such as Zalo or Facebook Messenger) to ask about hourly rates, opening hours, and vacant time slots. Public information across social media pages or map listings is often incomplete or outdated, making it difficult for players to compare options or confirm a reservation quickly.

On the operational side, small and medium-sized venue owners frequently manage court schedules using chat messages, paper notebooks, or standalone spreadsheets. When incoming requests are handled manually across multiple channels, delayed updates and inconsistent record-keeping frequently occur. Two players may request the same court and time slot simultaneously, resulting in double bookings, customer disputes, and additional administrative effort for venue staff. Furthermore, without a centralized system to track reservations and cancellations, court owners struggle to prevent unavailable or maintenance slots from being booked.

### Proposed Solution Overview
**CourtMate** addresses these challenges by providing a centralized, responsive web platform that connects sports players with court owners through a consistent end-to-end booking workflow:
* **For Players:** The system enables users to browse listed venues, filter and search courts by name, sport type, and location/area, inspect court details and hourly pricing, view up-to-date available time slots, and submit or cancel reservations online without back-and-forth messaging.
* **For Court Owners:** The system provides management tools to publish and update court listings, configure operating hours, mark specific time slots as unavailable, and monitor all reservations for their courts in one place.

Rather than attempting to replicate full-scale enterprise facility management suites, CourtMate focuses on a reliable, conflict-free reservation lifecycle enforced by server-side validation and database transactions.

### Operating Environment
* **Client Environment:** The application operates as a responsive web interface accessible via modern desktop and mobile web browsers supporting HTML5, CSS3, and JavaScript (e.g., Google Chrome, Mozilla Firefox, Microsoft Edge, Apple Safari). No separate native mobile application (iOS/Android) is required.
* **Server and Cloud Environment:** The backend REST API and relational database are hosted on cloud infrastructure (planned deployment on Vercel for the frontend, Render for the backend service, and Neon for managed PostgreSQL), accessible over HTTPS.
* **User Characteristics:** Primary end users are everyday sports players and venue operators with basic web browsing familiarity. All sensitive operations are protected by role-based access control separating `Player` and `Court Owner` permissions.

### Design and Implementation Constraints
* **Technology Stack Constraints:**
  * **Frontend:** ReactJS for building reusable UI components, search filters, schedule views, and role-based navigation.
  * **Backend:** Python with FastAPI, exposing RESTful APIs that enforce authentication, court ownership checks, and booking validation rules on the server.
  * **Database:** PostgreSQL for persistent storage of accounts, courts, schedules, and reservations, utilizing ACID transactions and row-level locking or constraints to prevent concurrent double bookings.
  * **Testing and CI:** Automated testing using Pytest and FastAPI `TestClient`, integrated with GitHub Actions for continuous integration.
* **Schedule and Resource Constraints:** The system is developed by a four-member student team (**T05 – Nexora**) following a strict Waterfall phase-gate schedule (PA1 through PA5), with core implementation and testing concentrated within Weeks 8–10.
* **Financial and Scope Constraints:** Online payment gateway integration, digital wallets, and automated coupon settlement are excluded from the project scope. All bookings follow a reserve-online, pay-at-the-venue model.
* **Process and Documentation Standards:** All deliverables must maintain strict traceability across PA baselines. Source code and documentation changes on the `main` branch require pull requests, peer reviews, and Conventional Commits formatting.

### Assumptions and Preliminary Open Issues
These problem statements reflect initial domain assumptions established in PA0 without formal quantitative market surveys. Specific operational rules—including fixed versus flexible booking slot durations, reservation confirmation workflows (instant confirmation versus owner approval), and cancellation cut-off windows—will be finalized with teaching staff feedback and specified in detail in the PA2 Software Requirements Specification (SRS).

---

## 2.2 Product Position Statement

| Element | Content |
| :--- | :--- |
| **For** | Sports players and sports court owners |
| **Who** | Need a reliable way to discover courts, check up-to-date slot availability, make reservations, and manage court schedules without manual phone or chat coordination |
| **The CourtMate** | Is a web-based sports court booking and schedule management platform |
| **That** | Enables players to search venues, view available time slots, and submit or cancel bookings online while allowing court owners to manage court listings, operating hours, and incoming reservations in one place |
| **Unlike** | Manual booking through phone calls, chat apps, and spreadsheets, or large commercial platforms (such as SanBong.vn and ALOBO) that bundle complex financial reporting and payment ecosystems |
| **Our product** | Delivers a focused, maintainable end-to-end reservation workflow with strict server-side validation and database concurrency control to prevent double bookings within an accessible web interface |

---

## 2.3 Stakeholders and Users

| # | Stakeholder / User | Description | Main Interests |
| :-: | :--- | :--- | :--- |
| 1 | **Player** | End users (individuals or group organizers) who use CourtMate to find and reserve sports courts. | Searching and comparing courts by name, sport type, and area; viewing accurate pricing and available time slots; submitting and cancelling bookings easily; managing basic account details. |
| 2 | **Court Owner** | End users (venue operators or staff) who list and manage sports courts on the platform. | Publishing and updating court information; configuring operating hours and blocking unavailable slots; preventing double bookings; monitoring reservation details and statuses for their own courts. |
| 3 | **Nexora (Team T05)** | The four-member student engineering team responsible for analyzing, designing, implementing, testing, and deploying CourtMate. | Delivering all 8 Must-have features on time for PA5; maintaining clear scope boundaries and documentation consistency across PAs; achieving high software quality and a 10/10 course grade. |
| 4 | **Course Instructor & Teaching Assistants (TAs)** | Academic evaluators and project supervisors from the Software Engineering Department (FIT – HCMUS). | Evaluating requirement completeness, traceability, architectural soundness, teamwork collaboration evidence, adherence to the Waterfall process, and working software delivery. |

---

## 2.4 Scope and Key Features

The project scope is prioritized using the **MoSCoW** method. It comprises eight **Must-have** features (`F01`–`F08`) that form the mandatory baseline for PA5 delivery, two optional **Should-have** features (`F09`–`F10`), and explicit **Won't-have** exclusions to ensure feasibility within the course timeline.

| ID | Feature | Description | Priority (M/S/C/W) |
| :-: | :--- | :--- | :-: |
| **F01** | **Authentication & Authorization** | Users can register, sign in, and sign out; the system enforces role-based access control separating `Player` and `Court Owner` permissions. | **Must** |
| **F02** | **Browse & Search Courts** | Players can browse listed active courts and filter or search by court name, sport type, and geographical area/location. | **Must** |
| **F03** | **Court Details & Availability** | Users can view detailed court information, including location, supported sport, facility descriptions, hourly price, and available dates and time slots. | **Must** |
| **F04** | **Court Booking** | Players can select an available date and time slot and submit a reservation; the server validates slot availability and uses database transactions/constraints to prevent conflicting or overlapping bookings. | **Must** |
| **F05** | **My Bookings** | Players can view their upcoming and past reservations and cancel an eligible booking in accordance with defined cancellation rules. | **Must** |
| **F06** | **Court & Schedule Management** | Court owners can add, edit, and deactivate courts they own, configure regular operating hours, and mark specific time slots as unavailable. | **Must** |
| **F07** | **Owner Booking Management** | Court owners can view and monitor reservations made for their own courts, including booking dates, time slots, player contact details, and booking status. | **Must** |
| **F08** | **Profile Management** | Authenticated users can view and edit basic account information, with authentication checks required for sensitive account updates. *(Note: Subject to TA confirmation on whether this remains separate or merges into F01).* | **Must** |
| **F09** | **Ratings & Reviews** | After completing a booking, players can submit a star rating and a short written review for the court. | **Should** |
| **F10** | **Promotions** | Court owners can publish simple promotional announcements or discount descriptions on their court listings without automated price calculation or coupon validation. | **Should** |

### Out of Scope (Won't-have for this Project)
To maintain a realistic workload for a four-member team during the W8–W10 implementation phase, the following features and activities are explicitly **out of scope** (Won't-have):
* **Online Payment Processing:** Integration with payment gateways, e-wallets, automated deposits, or online refund settlement. Players pay directly at the venue, and the system does not verify financial settlement.
* **Automated Coupon & Discount Engines:** Promotional codes, automated checkout price deductions, or loyalty point calculations.
* **Native Mobile Applications:** Standalone Android or iOS apps (the system is delivered strictly as a responsive web application).
* **Real-Time Communication & Notifications:** In-app live chat between players and owners, SMS gateways, or push notification services.
* **Advanced Venue & Multi-Branch Operations:** Multi-branch administration, staff shift scheduling, equipment/refreshment inventory (POS), and advanced financial/revenue analytics.
* **Advanced Scheduling & Check-In Automation:** Recurring weekly/monthly reservations, automated waiting lists, QR-code check-in scanners, and AI-based court recommendations.