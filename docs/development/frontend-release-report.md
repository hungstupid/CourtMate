# CourtMate SRS/frontend release — 10 November 2026

Branch: `chore/project-bootstrap`, based on existing `a1cf7b9`. No merge into main, rebase, reset, force-push, PA edits or new cloud resources.

## Delivered

Current-source audit of 49 FR / 106 AC / 10 BR; initial role selection and protected profile, full-address/time search and unbounded slot preview, atomic batch publication, scoped Player contact, organizer room closure/retained roster/reasons, server-receipt cancellation boundary, manual and fractional-lead automatic offers with transactional quote protection. Additive migrations through `0006_room_closure_reason` preserve existing data.

React screens cover both roles using the current Figma's tokens, local source assets and API records. Includes navigation/mobile menu, authentication/recovery, discovery/details/availability/review/confirm/history/cancel, court forms/deactivation, calendar/drafts/hours/maintenance/Owner bookings, Open Play participation/closure, profile and offers. Errors/loading/empty/conflict/session handling are implemented. Diagnostic UI is separate at `/development`.

## Original release verification (preserved historical evidence)

- Backend: locked sync, Ruff lint/format, migration upgrade twice, schema drift check PASS; **230 pytest passed** with PostgreSQL 17 and real Firebase Auth Emulator. Concurrency uses independent observed PostgreSQL lock contention.
- Frontend: `npm ci`, lint, typecheck, build PASS; no added application dependency or lockfile upgrade. npm audit: 10 existing moderate development-tool findings, no high/critical finding; no automatic dependency mutation.
- Playwright: **12 tests**, including real two-slot booking, room Join/Keep/Leave/Close/cancellation, Owner eight-row batch add/edit/remove, F09 scheduling/Keep/cancel, profile reload, maintenance, Firebase persistence/sign-out/outage/expiry and API cancellation/network/error handling. Final local/CI result is recorded below.
- Axe/geometry/keyboard: discovery at 375/768/1280; real Owner calendar and booking review at all three widths; dialog Escape/focus return and no page-level horizontal overflow. These checks do not replace a human screen-reader session.
- Lighthouse 13.6.0 production build: **100 accessibility** for home(1280), rooms(375), slots(768). [Measured settings/results](evidence/srs-lighthouse.json).
- Docker k6 2.3.0: 30 VUs, 5-second warm-up and 60-second steady load, 1-second think time, 1 court/8 slots/30 Players/1 Owner. [Measured results](evidence/srs-nfr-k6.json); local only, not cloud capacity evidence.

Failed intermediate runs were not relabeled PASS: initial browser labels/hover contrast/Clear-time race were corrected; one overlapping benchmark/pytest invocation caused fixture-count interference and was followed by targeted cleanup and sequential reruns. Only this session's generated fixture rows were removed; existing data and local PostgreSQL volume were preserved.

## Remaining verification at baseline 4e8bf68 (historical)

Audit status: **48/49 FR DONE, 1 PARTIAL; 95/106 AC DONE, 11 PARTIAL**. All Must-have business features are implemented; partial entries identify exact verification variants, not fabricated successful tests. Optional map integration needs external geocoding/route/GPS-denial verification. Human screen-reader/full manual focus and contrast review, all protected-page Lighthouse runs and exhaustive Figma pixel comparison remain pending. Cloud business writes/load were not run.

Historical October evidence in `bootstrap-report.md` / `backend-core-report.md` remains historical and unchanged. Use this report and the current audit for the November application state.

## Commits, CI and deployment

- `c50cba1`: current-source account/core corrections and initial audit.
- `c69c8f5`: transactional manual/automatic slot offers.
- `85e8932`: backend receipt-time cancellation, trusted legacy email recovery, safe room projections/closure reasons and public deal readback.
- `7f1496c`: Figma-based application and real browser integration, with isolated fixture cleanup.
- Release source [`2b95e0934eeaea68b6ce55678e23f4aedb02b371`](https://github.com/hungstupid/CourtMate/commit/2b95e0934eeaea68b6ce55678e23f4aedb02b371), pushed on the existing branch.
- [GitHub Actions 42840466467](https://github.com/hungstupid/CourtMate/actions/runs/42840466467): **SUCCESS**, frontend-push and integration-push; CI independently ran **230 pytest / 12 Playwright** successfully.
- Vercel deployment `dpl_E4gdTpZg1PkrWLxQVfjni4FemeAv`: **READY** at the same release SHA. [Production frontend](https://courtmate-court-mate.vercel.app) `/version.json` returned that SHA. SVG/WOFF2 responses have the correct types; desktop/mobile public/login browser checks found no JS error or page overflow.
- Render deployment `dep-dbpj6c67bikc73dnbo8g`: **LIVE**, triggered automatically only after checks passed. [API](https://courtmate-api-cs7b.onrender.com/docs) health header returned the exact release SHA; `/ready`, OpenAPI/current routes and public courts/rooms/deals returned 200.
- Neon read-only SQL on the existing application branch/database verified `0006_room_closure_reason`. Missing-token protected calls returned 401; allowed-origin CORS returned 200 and unlisted-origin 400. [Cloud readback evidence](evidence/srs-cloud-readback.json).
- No real-account protected cloud write/load was run. Full business writes, authorization and races were exercised in local/CI PostgreSQL/Firebase Emulator instead. This subsequent evidence-only commit changes no application source or deployment configuration.

## Review of 4e8bf68 — 10–11 November 2026

Three reproduced defects fixed, without refactoring or dependency changes:

- Court PATCH now accepts empty optional contact consistently with court creation; null/length validation and ownership remain enforced.
- Directions require a non-whitespace explicit origin. With GPS denied and no origin, the action is disabled, matching Figma S69.
- Long valid court names wrap in F09 information headings at 375 px instead of overflowing the page.

**Current coverage: 105/106 AC DONE, 1 PARTIAL (AC-F03-04); 48/49 FR DONE, 1 PARTIAL (FR-013).** Ten former PARTIAL variants are verified by `review.spec.ts`, `test_review_regressions.py` and the added F09 tests; exact mapping is in the audit.

Checks executed: `npm ci`, lint, typecheck, build; `uv sync --locked`, Ruff lint/format; migration head upgrade twice/schema drift check; **239 pytest / 22 Playwright PASS**. All original 230 backend/12 browser tests retained. Review writes and targeted cleanup ran only against isolated local PostgreSQL/demo Firebase Auth Emulator.

Authenticated accessibility review adds 26 Lighthouse 13.6.0 snapshots scoring **100**, and Axe/geometry/keyboard checks at 375/768/1280. These snapshots use the live Vite development server with real local session/API; they supplement, rather than replace, historical production-build results. Twenty-one unobscured paragraph computed-color/background pairs have minimum contrast **5.709:1**. [Settings, measured scores, external image and limits](evidence/review-accessibility.json).

Mandatory manual verification remains: actual rendered map/geocoding and a correct route with permitted or typed origin (the inspected iframe was blank); screen-reader execution of core tasks at the three widths; exhaustive composited text-contrast/focus review. Full Figma pixel equality, untested devices/browsers and protected production business writes/load are not claimed. No production data mutation was performed.

Review commits: `3d49b38` (contact/F09 regressions), `bcbae7a` (origin guard, wrapping and ten browser regressions). Local checks above completed; remote CI/deployment verification follows the authorized branch push and is recorded below.
