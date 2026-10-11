# Backend — guidance for every PA

**Purpose:** API, domain/business logic, authentication/authorization, booking validation, persistence and migrations. PA0 proposes **FastAPI + PostgreSQL**, subject to team confirmation.

When development begins, document actual folders such as `app/` (API/routes/services/data access), `tests/`, `migrations/`, dependency files and a safe `.env.example`. Choose names appropriate for the final stack.

**Required engineering considerations:** users and court-owner permissions, date/time validation, overlapping reservations, database transaction/constraint strategy, cancellations, error handling, logging and testability. Do not assume a fixed 60-minute duration or automatic booking approval until agreed.

**Store outside this folder:** SRS and business rules (`docs/requirements/`), design decisions and database ERD (`docs/design/`), submitted PA files (`pa/`), test plans/reports (`docs/test/`).

Add proven local setup, migrations, testing and run commands here after project scaffolding is actually implemented. Do not commit secrets or generated databases.
