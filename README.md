# CourtMate

**Sports Court Booking & Management Platform**

A web-based system that helps players discover sports venues, view court availability, and submit reservations while providing court owners with tools to manage courts, schedules, and bookings.

**Team:** Nexora (T05)  
**Course:** Introduction to Software Engineering — University of Science, VNU-HCM (HCMUS)  
**Repository:** [hungstupid/CourtMate](https://github.com/hungstupid/CourtMate)

## Project Overview

CourtMate aims to make sports court reservations more accessible and organized for both players and venue operators. The proposed scope focuses on a complete booking workflow, from court discovery to reservation management.

| User role | Core capabilities |
| --- | --- |
| **Player** | Register and sign in; browse/search courts; view court information and availability; manage reservations and profile |
| **Court Owner** | Maintain court listings and operating schedules; view and manage bookings for their courts |

**Planned priorities:** 8 Must-have features (authentication, search, court details/availability, booking, booking history, court/schedule management, owner booking management, and profile management) and 2 Should-have features (reviews and promotions).

The detailed booking duration, reservation confirmation process, and cancellation rules will be defined through requirements analysis. Payment integration is outside the initial Must-have scope.

## Technology

The preliminary technology proposal is:

| Layer | Proposed technology |
| --- | --- |
| Frontend | React |
| Backend / API | Python + FastAPI |
| Database | PostgreSQL |
| Collaboration | GitHub, GitHub Projects, Pull Requests |

Technology choices and deployment details are subject to team review during project planning.

## Repository Structure

| Directory | Contents |
| --- | --- |
| [`frontend/`](frontend/README.md) | Web application source, UI assets, and frontend tests |
| [`backend/`](backend/README.md) | API, business logic, data access, migrations, and backend tests |
| [`docs/management/`](docs/management/README.md) | Plans, WBS, estimates, schedule, risks, meeting minutes, contribution evidence, and weekly status reports |
| [`docs/requirements/`](docs/requirements/README.md) | Product vision, stakeholders, requirements, use cases, business rules, and traceability |
| [`docs/design/`](docs/design/README.md) | C4, architecture decisions, UML, database design, and UI/UX specifications |
| [`docs/testing/`](docs/testing/README.md) | Test plans, cases, execution reports, defects, and testing evidence |
| [`docs/ai-usage/`](docs/ai-usage/README.md) | AI tool usage records and human verification notes |
| [`pa/`](pa/README.md) | Submitted PDF and editable source files for each project assignment |
| [`.github/`](.github/PULL_REQUEST_TEMPLATE.md) | Issue templates, Pull Request template, and repository checks |

Each directory contains a dedicated `README.md` defining its purpose and file placement **throughout the entire project**, not just one assignment.

### Document Management

- **Working documents:** `docs/` — updated as the project evolves.
- **Official submissions:** `pa/PA0/` through `pa/PA5/` and `pa/Final/` — committed copies of the files submitted for each milestone.
- **Weekly reports:** `docs/management/weekly/` — one report per week from W2 through W10.
- **Implementation:** `frontend/` and `backend/` — application code and code-level tests.

Submitted assignments serve as project baselines. Subsequent changes should be documented and traced to affected requirements, designs, and tests.

## Development Workflow

Team tasks are coordinated through [GitHub Issues](https://github.com/hungstupid/CourtMate/issues) and [GitHub Projects](https://github.com/hungstupid/CourtMate/projects). Each agreed WBS work package should have an assigned owner, due date, estimated effort, and reviewable deliverable.

1. Select an agreed Issue and create a working branch from `main` (e.g., `docs/pa1-wbs`, `feat/court-search`).
2. Make focused changes and use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
3. Open a Pull Request referencing the Issue and describe the changes and validation performed.
4. Obtain a review from another team member before merging into `main`.
5. Update the Issue and project board with the outcome and supporting evidence.

For contribution standards, review responsibilities, and security practices, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Course Deliverables

| Milestone | Deliverable |
| --- | --- |
| PA0 | Project Idea & Team Contract |
| PA1 | Project Proposal & Plan |
| PA2 | Software Requirements Specification |
| PA3 | Software Design |
| PA4 | Test Plan & Test Cases |
| PA5 | Implementation, Testing & Deployment |
| Final | Presentation & Demonstration |

Submit each assignment in the format and by the deadline required on Moodle. The repository's `pa/` directory maintains a corresponding version-controlled copy of the submitted PDF and editable source. The graded assignments include the team's contribution assessment and AI Usage Log.

## References

- [Project Idea & Team Contract (PA0 working document)](https://docs.google.com/document/d/1q32BiCtVhKpyceWly3hzzVZmYrN8v_fZM5uOVZal5VE/edit)
- [Contribution Guidelines](CONTRIBUTING.md)
- [Documentation Directory](docs/README.md)
- [Assignment Archive](pa/README.md)
