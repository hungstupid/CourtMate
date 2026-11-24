# CourtMate

**Sports Court Booking & Management Platform**

CourtMate is a web application for players to discover sports courts, check availability and make reservations, while helping venue owners manage courts, schedules and bookings.

**Team:** Nexora — T05  
**Course:** Introduction to Software Engineering — University of Science, VNU-HCM (HCMUS)

## Project Overview

| User | Primary activities |
| --- | --- |
| Player | Search courts, inspect available times, manage reservations and account information |
| Court Owner | Manage court information, opening schedules and incoming bookings |

The [SRS](https://docs.google.com/document/d/1zL3Ra_0LceKOF_2pZa9iWpq7HIbRtALB/edit) defines 38 Must FR across F01–F07 and F10. F08 profile and F09 offers are included. [PA3](https://docs.google.com/document/d/1b8tVkH3fjPObuf5piq0AejaUdxBCBAa2/edit) defers FR-013 map and directions. Online payments remain outside scope.

**Development stack:** React + TypeScript + Vite, FastAPI + Python 3.12 + uv, PostgreSQL, and Firebase Authentication. Local database uses Docker; cloud uses Vercel, Render and Neon.

## Run CourtMate

Public deployment: [CourtMate](https://courtmate-court-mate.vercel.app) · [API readiness](https://courtmate-api-cs7b.onrender.com/ready).

Install Node 24, uv, Docker Compose with PostgreSQL 17, and the Firebase CLI as listed in the [setup guide](docs/development/setup.md).

```sh
git clone --branch chore/project-bootstrap https://github.com/hungstupid/CourtMate.git
cd CourtMate
make setup db-up migrate
```

Run `make auth-emulator`, `make dev-api` and `make dev-web` in separate terminals. Open http://localhost:5173. Check http://localhost:8000/ready if the web app cannot load courts. Check the generated environment files and emulator if sign-in fails. Run `make test`, then `make e2e` after the browser installation in the setup guide.

- **Player:** Search by name, sport, address or time. Choose consecutive slots on one court and date, review the quote, then confirm. Open **Lịch đặt** for history, eligible cancellation and creating an Open Play Room. Use **Open Play** to find and join rooms and **Ưu đãi giờ gần** to see last-minute offers.
- **Court Owner:** Open **Sân của tôi**, add a court and set operating hours in **Lịch sân**. Preview and publish draft slots, schedule maintenance, manage offers and see bookings for your own courts.

[Isolated demo data and demo script](docs/development/demo-catalog.md) · [PA4/PA5 and Final materials](docs/test/pa4-pa5/)

## Repository Structure

For verified local setup, isolated tests, Firebase roles, migrations and deployment, see the [development guide](docs/development/setup.md) and [bootstrap evidence](docs/development/bootstrap-report.md).

| Path | Purpose |
| --- | --- |
| [`src/frontend/`](src/frontend/README.md) | Web application source code and frontend tests |
| [`src/backend/`](src/backend/README.md) | API, business logic, database integration and backend tests |
| [`docs/management/weekly/`](docs/management/weekly/README.md) | Weekly status reports, W2–W10 |
| [`docs/management/`](docs/management/README.md) | Project plan, meeting notes and management evidence |
| [`docs/requirements/`](docs/requirements/README.md) | Vision, SRS, use cases and mockups |
| [`docs/design/`](docs/design/README.md) | C4, ADRs, UML and UI design |
| [`docs/test/`](docs/test/README.md) | Test plans, cases and reports |
| [`docs/ai-usage/`](docs/ai-usage/README.md) | AI usage records and references to each PA log |
| [`pa/`](pa/README.md) | **Final submitted copies** of PA0–PA5 and Final materials |
| [`.github/`](.github/PULL_REQUEST_TEMPLATE.md) | Issue/PR templates and automated repository checks |

**Documents for each PA are written as one assignment document**, including the WBS, Gantt chart, risk register, requirements, designs or test cases relevant to that PA. The repository follows the folder structure in the PA1 course template. Supporting sources and references belong in the corresponding `docs/` folders; sections already included in PA documents need not be duplicated as separate files. Working drafts may be maintained collaboratively in Google Docs/Drive; `pa/PAx/` holds the corresponding submitted PDF and editable source.

## Collaboration and Contribution Evidence

The team uses [GitHub Issues](https://github.com/hungstupid/CourtMate/issues) and [GitHub Projects](https://github.com/hungstupid/CourtMate/projects) to assign and track approved work packages. Each task should identify an owner, due date, expected output and review criteria.

1. Agree on the work package; create and assign an Issue.
2. Create a branch, make a focused change and commit it.
3. Open a Pull Request (PR) referencing the work, and obtain an independent review before merging into `main`.
4. Update the Issue/Project status and record evidence in the weekly report.
5. Summarize actual individual contributions in the **Member Contribution** table of each graded PA.

Work completed in collaborative documents can be evidenced by document revision history and task/review records; Git commits alone do not capture all such contributions. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Project Assignments

| Phase | Submission |
| --- | --- |
| [PA0](pa/PA0/README.md) | Project Idea & Team Contract |
| [PA1](pa/PA1/README.md) | Project Proposal & Plan |
| [PA2](pa/PA2/README.md) | Software Requirements Specification |
| [PA3](pa/PA3/README.md) | Software Design |
| [PA4](pa/PA4/README.md) | Test Plan & Test Cases |
| [PA5](pa/PA5/README.md) | Implementation, Testing & Deployment |
| [Final](pa/Final/README.md) | Presentation & Demonstration |

Submit PDFs and editable source files to Moodle as required by the course, then commit matching submission copies to the appropriate `pa/` directory. Graded PAs include a **Member Contribution** table and **AI Usage Log** within the document. Submitted versions are baselines: record any later changes instead of silently replacing history.

Weekly reports are committed separately in [`docs/management/weekly/`](docs/management/weekly/README.md).

## References

- [PA0 Project Idea & Team Contract — working document](https://docs.google.com/document/d/1q32BiCtVhKpyceWly3hzzVZmYrN8v_fZM5uOVZal5VE/edit)
- [Contribution Guidelines](CONTRIBUTING.md)
- [Submission Guidelines](pa/README.md)
