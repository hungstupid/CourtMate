# Contributing to CourtMate

This is a **team coursework repository**, not a collection of individually finished assignments. Follow this process for **every PA and every code change**.

## 1. Before starting
1. Read the README of the target folder to decide where the deliverable belongs.
2. Find or create an approved GitHub **work-package Issue** after agreeing on its WBS ID, output and due date. Associate it with the GitHub Project board.
3. Confirm the **primary owner**, **reviewer/backup**, effort estimate (person-hours), dependency and definition of done. Do not self-assign other members without agreement.
4. If work modifies PA0 baseline or a previously submitted PA, record the rationale in the decision log and affected PA change list.

## 2. Branch / commit / pull request
- Branch from latest `main`: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `test/<topic>`, `chore/<topic>`.
- Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:` (e.g. `docs: add PA2 use case diagrams`).
- Keep pull requests focused: link the corresponding issue (`Closes #123` only when genuinely complete); explain changes, verification steps and screenshots for UI changes.
- Have **at least one other teammate review** before merging into `main`. Do not approve your own work. Resolve all blocking comments.
- Protect `main` in Settings → Rules → Rulesets / Branch protection. This is a **manual admin setting**, not achieved by merely committing this policy.
- **Use the issue's real status:** Review while waiting for checks/review; Done only after approved merge, required artifacts and evidence. Never close unfinished work as completed.

## 3. Documents / waterfall baselines
- Drafts and living records go under `docs/`; finalized submitted snapshots go under `pa/PAx/`.
- Follow the official course templates, rubric and TA directions. Include member contribution assessment and AI Usage Log in every **graded PA**.
- On submission: upload **PDF + editable source** to Moodle and commit copies in `pa/PAx/`; verify filenames `T05-PAx.*`.
- After submission, the PA is a **baseline**: do not quietly replace it. If a change is approved, track what changed, why, affected downstream documents and the new revision.

## 4. Quality, security and evidence
- Never commit `.env`, private keys, tokens, passwords, personal data or false evidence.
- Keep test evidence truthful: test cases/results must correspond to executions, CI runs to actual runs, interviews to actual interviews.
- Every member maintains evidence through assigned Issues, commits, PRs, reviews, meeting notes and reports.
- Use `docs/management/weekly/` for reports from W2 through W10; earlier weeks' records must not be rewritten.
- AI may assist, but humans review and disclose significant use in `docs/ai-usage/` or the relevant PA log.

## 5. Communication
Use the official Discord/Slack/Teams channel with the TA for required communication. Decisions affecting scope, deadlines, architecture or ownership belong in a versioned record, **not only in chat**.

See [management templates](docs/management/templates/README.md), [security guidance](SECURITY.md), and [PR template](.github/PULL_REQUEST_TEMPLATE.md).
