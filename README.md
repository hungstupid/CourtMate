# CourtMate

**Nexora · Team T05 · Introduction to Software Engineering · HCMUS**

CourtMate is a proposed web platform for discovering sports courts, checking availability, making reservations and managing court schedules. The project follows the course's **Waterfall phase gates**, with test planning based on the V-model. Details in PA0 are proposals until reviewed with the team and TA.

> **Current stage:** repository foundation / preparation for PA1. This README does **not** claim that the application, project board, reviews or approvals are already complete.

## Start here

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) before editing any code or document.
2. Check [the directory guide](docs/README.md) and [phase submissions](pa/README.md).
3. Track agreed work in **GitHub Issues + GitHub Projects**: [Issues](https://github.com/hungstupid/CourtMate/issues) · [Projects](https://github.com/hungstupid/CourtMate/projects).
4. Create a branch (`docs/...`, `feat/...`, `fix/...`, `test/...`, `chore/...`), commit using Conventional Commits, and open a pull request.
5. Have another member review the change before merging into `main`. Never commit passwords or tokens.

## Where things go

| Path | Purpose |
| --- | --- |
| [`frontend/`](frontend/README.md) | Browser interface and frontend-specific code/docs |
| [`backend/`](backend/README.md) | API, business logic, database/migrations and backend code/docs |
| [`infra/`](infra/README.md) | Deployment and environment configuration **without secrets** |
| [`scripts/`](scripts/README.md) | Repeatable development/maintenance scripts |
| [`docs/management/`](docs/management/README.md) | Plans, WBS, schedules, risks, decisions, meeting minutes and weekly status reports |
| [`docs/requirements/`](docs/requirements/README.md) | Stakeholders, requirements, rules, use cases and traceability |
| [`docs/design/`](docs/design/README.md) | C4, ADR, UML, database and UI design documents |
| [`docs/test/`](docs/test/README.md) | Test plans, cases, results, defects and evidence |
| [`docs/ai-usage/`](docs/ai-usage/README.md) | Significant AI tool usage and human verification |
| [`docs/references/`](docs/references/README.md) | External references and research notes |
| [`pa/`](pa/README.md) | Immutable submitted snapshots of PA0–PA5 and final presentation |
| [`.github/`](.github/README.md) | Issue templates, PR checklist and repository workflows |

Every folder contains a **README describing what belongs there across the whole course**. A folder guide is not evidence that a deliverable has been completed.

## Course checkpoints

| Phase | Planned checkpoint | Canonical submission path |
| --- | --- | --- |
| PA0 | Project idea and team contract; TA approval needed | `pa/PA0/` |
| PA1 | Vision, scope, C4 context, WBS, estimates, schedule, risks and tools | `pa/PA1/` |
| PA2 | Software requirements specification | `pa/PA2/` |
| PA3 | Software design | `pa/PA3/` |
| PA4 | Test plan and test cases | `pa/PA4/` |
| PA5 | Implementation, execution, deployment and retrospective | `pa/PA5/` |
| Final | Slides and demo materials | `pa/Final/` |

Confirm exact deadlines on Moodle. PA submissions require **PDF + editable source** on Moodle and a matching committed snapshot under `pa/PAx/`. Filename convention: `T05-PAx.pdf` and source equivalent, unless course staff require otherwise. Previously submitted versions are baselines: record changes instead of quietly rewriting history.

## Working agreements

- **Communication:** TA-facing channel in Discord / Slack / Microsoft Teams; team may also use Messenger and Meet internally. The TA must be included in the official team channel.
- **Project board:** GitHub Projects (or Jira if approved), with each approved WBS work package linked to an issue, owner and due date. Status: Backlog → To Do → In Progress → Review → Blocked → Done.
- **Weekly reports:** from W2 to W10 in `docs/management/weekly/`; the team has proposed Sunday at 22:00 as its internal deadline, subject to confirmation.
- **Pull requests:** at least one review by a teammate; protect `main` in GitHub settings. This may require manual administrator action and is not enforced merely by this README.
- **AI:** significant use must be disclosed and verified by members; see `docs/ai-usage/`.
- **Security:** no `.env` or keys in the repository; see [SECURITY.md](SECURITY.md).

## Project scope at PA0

Proposed Must-have: authentication/authorization, search, court details/availability, booking, my bookings, owner court/schedule management, owner booking management and profile management. Should-have: reviews and basic promotions. **Booking duration and approval flow remain undecided**; do not assume fixed 60-minute slots. Online payment integration is currently out of scope.

**Provisional stack:** React, FastAPI, PostgreSQL. Team/TA confirmation is required before treating it as final.

### Links

- [PA0 project idea & team contract (Google Docs)](https://docs.google.com/document/d/1q32BiCtVhKpyceWly3hzzVZmYrN8v_fZM5uOVZal5VE/edit)
- [Issue templates](.github/ISSUE_TEMPLATE/README.md) · [Repository management templates](docs/management/templates/README.md)
