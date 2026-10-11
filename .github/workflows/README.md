# CI workflows — all phases

GitHub Actions is used for **repeatable checks**. `repository-hygiene.yml` verifies the existence of the required cross-phase README and template structure, basic relative documentation links and absence of accidentally committed common secret files.

**It does NOT compile React, test FastAPI, run migrations or prove CourtMate is functioning.** After the team selects its final stack and adds real code, create or extend separate workflows for:
- Frontend install, lint, build and unit tests.
- Backend dependency setup, lint/type checks, unit/integration tests with a controlled test database.
- PR-triggered checks with captured results/coverage.
- Deployment/smoke tests only after environments and credentials exist.

Record actual CI runs in the relevant Issues/PRs and `docs/test/`. Configure `main` protection to require the check **after verifying the workflow runs**.

Never place credentials in workflow YAML; use scoped GitHub Actions secrets.
