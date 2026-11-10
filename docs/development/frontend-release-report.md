# CourtMate SRS/frontend release — 10 November 2026

Branch: `chore/project-bootstrap`, based on existing `a1cf7b9`. No merge into main, rebase, reset, force-push, PA edits or new cloud resources.

## Delivered

Current-source audit of 49 FR / 106 AC / 10 BR; initial role selection and protected profile, full-address/time search and unbounded slot preview, atomic batch publication, scoped Player contact, organizer room closure/retained roster/reasons, server-receipt cancellation boundary, manual and fractional-lead automatic offers with transactional quote protection. Additive migrations through `0006_room_closure_reason` preserve existing data.

React screens cover both roles using the current Figma's tokens, local source assets and API records. Includes navigation/mobile menu, authentication/recovery, discovery/details/availability/review/confirm/history/cancel, court forms/deactivation, calendar/drafts/hours/maintenance/Owner bookings, Open Play participation/closure, profile and offers. Errors/loading/empty/conflict/session handling are implemented. Diagnostic UI is separate at `/development`.

## Local verification

- Backend: locked sync, Ruff lint/format, migration upgrade twice, schema drift check PASS; **230 pytest passed** with PostgreSQL 17 and real Firebase Auth Emulator. Concurrency uses independent observed PostgreSQL lock contention.
- Frontend: `npm ci`, lint, typecheck, build PASS; no added application dependency or lockfile upgrade. npm audit: 10 existing moderate development-tool findings, no high/critical finding; no automatic dependency mutation.
- Playwright: **12 tests**, including real two-slot booking, room Join/Keep/Leave/Close/cancellation, Owner eight-row batch add/edit/remove, F09 scheduling/Keep/cancel, profile reload, maintenance, Firebase persistence/sign-out/outage/expiry and API cancellation/network/error handling. Final local/CI result is recorded below.
- Axe/geometry/keyboard: discovery at 375/768/1280; real Owner calendar and booking review at all three widths; dialog Escape/focus return and no page-level horizontal overflow. These checks do not replace a human screen-reader session.
- Lighthouse 13.6.0 production build: **100 accessibility** for home(1280), rooms(375), slots(768). [Measured settings/results](evidence/srs-lighthouse.json).
- Docker k6 2.3.0: 30 VUs, 5-second warm-up and 60-second steady load, 1-second think time, 1 court/8 slots/30 Players/1 Owner. [Measured results](evidence/srs-nfr-k6.json); local only, not cloud capacity evidence.

Failed intermediate runs were not relabeled PASS: initial browser labels/hover contrast/Clear-time race were corrected; one overlapping benchmark/pytest invocation caused fixture-count interference and was followed by targeted cleanup and sequential reruns. Only this session's generated fixture rows were removed; existing data and local PostgreSQL volume were preserved.

## Remaining verification

Audit status: **48/49 FR DONE, 1 PARTIAL; 95/106 AC DONE, 11 PARTIAL**. All Must-have business features are implemented; partial entries identify exact verification variants, not fabricated successful tests. Optional map integration needs external geocoding/route/GPS-denial verification. Human screen-reader/full manual focus and contrast review, all protected-page Lighthouse runs and exhaustive Figma pixel comparison remain pending. Cloud business writes/load were not run.

Historical October evidence in `bootstrap-report.md` / `backend-core-report.md` remains historical and unchanged. Use this report and the current audit for the November application state.

## Commits, CI and deployment

- `c50cba1`: current-source account/core corrections and initial audit.
- `c69c8f5`: transactional manual/automatic slot offers.
- `85e8932`: backend receipt-time cancellation, trusted legacy email recovery, safe room projections/closure reasons and public deal readback.
- `7f1496c`: Figma-based application and real browser integration, with isolated fixture cleanup.
- Final release documentation commit: pending hash assignment. CI/deployed SHAs remain pending push/provider verification; no cloud result is claimed PASS yet.
