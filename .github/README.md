# GitHub collaboration setup — whole course

GitHub is used for **source control, work tracking and peer review** throughout PA0–PA5 and Final.

## How to work
1. **GitHub Projects**: create one team project (Board + Table), add repository Issues. Suggested statuses: Backlog / To Do / In Progress / Review / Blocked / Done.
2. **Issue**: use the [WBS work-package form](ISSUE_TEMPLATE/README.md), bug form or change request. Each agreed work package needs WBS ID, owner, due date, effort in person-hours, dependency, deliverable and acceptance criteria.
3. **Branch / PR**: branch from `main`, commit conventionally, open PR using [the PR template](PULL_REQUEST_TEMPLATE.md), obtain independent review, then merge.
4. **CI**: [repository-hygiene.yml](workflows/repository-hygiene.yml) checks cross-phase guide files and tracked secrets. Add **actual application build/lint/tests** after the approved stack is implemented; do not claim this workflow runs app tests.

## Required manual administrator setup

The repository files cannot by themselves configure GitHub permissions or branch protection. Repository owner must:

- **Settings → Collaborators**: invite all 4 members and grant the TA/instructor required repository access; avoid unnecessary Admin roles.
- **Settings → Rules → Rulesets / Branch protection**: target `main`, require Pull Request before merge, **≥1 approval**, resolve review conversations, block force pushes/deletion. Require a passing CI check once it has actually run successfully; verify ruleset enforcement and whether the GitHub plan supports it.
- **Projects tab → New project**: create `Nexora – CourtMate` (Board/Table). Create fields: Status, Priority, Phase/PA, WBS ID, Estimated hours, Due date and optional Reviewer. Link WBS issues after team approval.
- **Settings → General**: enable Issues, Projects, and pull requests if needed.
- **Discord/Slack/Teams**: create one official team communication channel and invite the TA per course rules.

The GitHub integration in this workflow may not expose repository administrator, Projects or label-creation mutations. **Do not mark those items done until verified in GitHub Settings.**

## Labels suggested for manual creation

`phase:PA1` through `phase:PA5`, `kind:work-package`, `kind:bug`, `kind:change`, `priority:high`, `priority:medium`, `priority:low`, `blocked`. Labels supplement, but do not replace, Project fields.

See [CONTRIBUTING](../CONTRIBUTING.md) and [management templates](../docs/management/templates/README.md).
