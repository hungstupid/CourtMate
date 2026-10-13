# Project Documentation

Folders follow the PA1 course template:

- `management/`: project plan, meeting records and weekly reports in `management/weekly/`.
- `requirements/`: Vision, SRS, use cases and mockups.
- `design/`: C4 architecture, ADRs, UML models and UI design.
- `test/`: test plan, test cases and test reports.
- `ai-usage/`: AI usage records and references to the logs in each PA.

Keep current collaborative drafts in Google Docs/Drive. Store supporting source files or links here when available; archive submitted PDF and editable source in [`pa/`](../pa/README.md). Do not duplicate task status: use GitHub Issues/Projects.

## Naming conventions

| Item | Convention | Example |
| --- | --- | --- |
| Branch | `type/short-task-name` (lowercase, hyphenated; branch from `main`) | `docs/pa1-vision`, `feat/court-search` |
| Commit | `type: short description` (`docs`, `feat`, `fix`, `test`, `chore`) | `docs: add PA1 vision section` |
| Working PA files | `PAx-topic.md` in the relevant `docs/` folder | `docs/requirements/PA1-vision.md` |
| Weekly reports | `Wxx-status.docx` (or `.md`) | `docs/management/weekly/W03-status.docx` |
| Submitted PA | `T05-PAx.pdf` + editable source in `pa/PAx/` | `pa/PA1/T05-PA1.pdf` |

For Git-tracked changes, open a PR to `main`, link the related Issue and ask another team member to review. Keep the official submitted PA as **one consolidated document**; working section files are optional.
