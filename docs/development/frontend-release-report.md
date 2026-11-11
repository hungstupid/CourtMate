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

### Post-push verification — 11 November 2026 (UTC+7)

- Reviewed source: [`c1e33e4b85bd63e7655a2552bb63d8d7ddf0b9b1`](https://github.com/hungstupid/CourtMate/commit/c1e33e4b85bd63e7655a2552bb63d8d7ddf0b9b1), pushed to the existing bootstrap branch with `3d49b38` and `bcbae7a`; no main merge or force-push.
- [CourtMate quality 42861206327](https://github.com/hungstupid/CourtMate/actions/runs/42861206327): **SUCCESS**, both frontend-push and integration-push. Logs independently confirm **239 pytest / 22 Playwright PASS**, Chromium 156.0.8078.4 on Linux; locked installs, Ruff, migrations and frontend checks pass. Repository guide/secret-filename check also passed locally (20 guides).
- Vercel `dpl_vUbv3Jtm6xLwBZA8SmpZwvvKQu4f`: **READY**, source SHA `c1e33e4`; production `/version.json` returned that exact full SHA after CI. Public home/login/register at 375/768/1280 had no page-level overflow or browser JS exception.
- Render remains **LIVE at `2b95e0934eeaea68b6ce55678e23f4aedb02b371`**, deploy `dep-dbpj6c67bikc73dnbo8g`. Its configured branch is correct and auto-deploy is `checksPass`; however no new deploy/event was observed after this successful CI. **The contact PATCH fix is verified locally/CI but is not verified deployed on Render.** No manual deploy, service setting change, secret access or cloud business mutation was performed. Treat backend release synchronization as outstanding; do not claim the cloud backend runs this reviewed source.
- Read-only cloud checks: `/health` and `/ready` 200; unauthenticated bookings/owner-courts 401; CORS preflight for the actual production frontend origin 200. No production sign-up, booking, cancellation, room participation or offer mutation/load was used to validate this review.

This final evidence-only update does not alter the tested application. Subsequent documentation-only HEADs may have newer Vercel version markers; the verified application source and CI above remain explicit.

## PA2/usability follow-up — 11 November 2026

- [UC-by-UC review and evidence boundaries](pa2-usability-review.md): 179/179 supplied frame IDs preserved, no Figma edits; full before/after stored-reaction fingerprints unchanged, 4,367 recursive actions/133 conditionals inspected, all destinations resolve, 35 representative Section 8 edges present. This is structural verification, not Figma playback execution. Submitted PA2 and business rules remain unchanged.
- Player: fresh backend quotes retain valid selection and require reacceptance; conflicts remove only unavailable choices; network errors retain review and expose history recovery. Last-Minute Deals is accessible through phone/tablet/desktop navigation.
- Owner: unsaved court/slot/batch/hours/maintenance/offer inputs are protected across query/context, navigation/back, editor close and browser exit. Keep/Escape retains input/focus; explicit discard never publishes; saving blocks destructive discard and clears obsolete prompts. Batch/maintenance preview/back retains configuration, closed-day hours are disabled, booking filters survive detail/back.
- Shared UI: Vietnamese states/errors/date presentation; labelled inline validation and API field errors; photo preview and sport-correct broken-image fallback using existing source assets/neutral fallback. No dependency, backend API/model, business-rule or production-data change.
- Local release checks: locked npm/uv installs, frontend lint/typecheck/build, backend Ruff/migration head twice/drift check; **239 pytest / 38 Playwright PASS**. All baseline 22 browser tests retained, with assertions updated for intentional translated labels and explicit discard confirmation; 16 new tests cover actual SDK/API/database flows and explicitly named failure injection. Axe/geometry and keyboard/dialog checks at 375/768/1280. Only 48 run-marker accounts/28 courts were cleaned from the guarded test DB in the final full browser run.
- Visual screenshots reviewed for updated repricing (duplicate warning removed), Owner form/booking/batch/maintenance and Open Play. Manual screen reader/composited contrast, external map accuracy and Figma player variable execution remain pending. Build emits an approximately 519 kB entry-chunk warning; it is recorded rather than hidden.
- This section supersedes earlier browser counts and automatic-draft-discard behavior for the current application. Historical test evidence above remains unchanged. Remote CI and deployed commit readback follow the authorized branch push.

### Final asynchronous-save regression

A browser Back during an outstanding Hours modal save reproduced an obsolete discard prompt after the save completed. `DraftProvider` now reads the latest blocker when an asynchronous save finishes, rather than the callback’s earlier router snapshot. The new real-API test first failed, then passed. The current complete local suite is **39 Playwright PASS** (17 added usability cases), alongside the unchanged **239 pytest PASS** and passing lint/typecheck/build. Final browser cleanup removed only 49 run-marker accounts/29 courts from the guarded test DB. The preceding 38-test result remains historical.

### PA2/usability deployment verification — 11 November 2026

- Application source [`f4b127539f678dc98d580efc10e114a34095d931`](https://github.com/hungstupid/CourtMate/commit/f4b127539f678dc98d580efc10e114a34095d931); UX implementation `66c4663`, asynchronous-save correction `e120da5`, portable/retry-isolated fixtures `f4b1275`. Existing branch only; no main merge, dependency upgrade or PA2 edit.
- [CourtMate quality 42870704883](https://github.com/hungstupid/CourtMate/actions/runs/42870704883): **SUCCESS**, frontend-push and integration-push; logs confirm **239 pytest / 39 Playwright PASS** on Linux. The earlier macOS-only screenshot-path CI failure was fixed, not relabeled PASS; the superseded run was cancelled by the existing concurrency policy.
- Vercel `dpl_9mMkPPUMb9UzsANz1cpFcRu9MZ6n`: **READY**. Production `/version.json` returned exact SHA `f4b1275`. Public home/login/register at 375/768/1280: no page overflow or JS exception; mobile/tablet/desktop navigation exposes `/deals`. No production form submission/business write was used for verification.
- Render existing service `courtmate-api`, `srv-dbg8tmu7bikc73fdlb7g`, did not produce an automatic deploy after successful CI. After confirming the intended branch, tested source and absence of any new backend/migration/startup change in this task, an existing-service redeploy was triggered without clearing cache or changing settings/resources. Deploy `dep-dbplpp6c6qcc73ddppi0`: **LIVE** at exact SHA `f4b1275`, finished `2026-11-10T18:06:34Z`. Auto-deploy remains `yes` / `checksPass` on the same branch; automatic trigger behavior remains unproven for subsequent backend changes.
- Read-only Render checks after LIVE: `/health` 200, `/ready` 200/database ok, `/openapi.json` 200 with `CourtPatch.contact` permitting empty string (the prior deployment gap is now resolved), unauthenticated bookings/owner-courts 401. Runtime error-level log scan from `18:05:24Z` through `18:06:49Z` returned no errors. No production records, database reset, new schema migration or new cloud resource were used.

This final evidence-only update can produce a newer Git/Vercel version SHA; application source is identical to the tested/deployed `f4b1275` apart from documentation. Remaining manual checks are in [PA2 review](pa2-usability-review.md): actual Figma player interactions, human screen reader/exhaustive contrast/focus and external map/route accuracy. Structural PA2 link preservation is fully recorded separately from those unexecuted interactions.


## Final acceptance of d74b78d — 11 November 2026

Two evidenced UI defects fixed: map failure had no loading/recovery/retry feedback; generic sport-image fallback text had insufficient 2:1 contrast. Map/address/manual-origin flow follows Figma S69. Real Google Maps now verified with GPS denied, a visually reviewed Chợ Bến Thành map pin and a supplied Thảo Cầm Viên → Chợ Bến Thành route. Fault injection separately covers blocked, stalled and blank provider documents; recovery never treats an iframe load as a verified map.

**Current functional coverage: 49/49 FR and 106/106 AC DONE**, 10 BR regression-covered. NFR-05 remains **PARTIAL** for human screen-reader/full manual focus and composited contrast review. PA2's 179 IDs/full reaction fingerprints and 17 UC mappings remain intact; prototype playback remains unverified. [Acceptance evidence](evidence/final-acceptance.json).

Local checks: `npm ci`, lint/typecheck/build; `uv sync --locked`, Ruff lint/format; isolated local migrations to head twice and drift check; **239 pytest PASS / 42 Playwright PASS** (full suite with opt-in live Google check). Regular CI runs **41 deterministic browser tests** and explicitly skips the external-provider test. Existing tests are retained; reload assertions verify persisted court hours, published slots, booking/cancellation, room lifecycle, offers and maintenance through the real local API/PostgreSQL/Firebase Auth Emulator. The build still warns about a ~520 kB minified entry; 10 existing moderate npm audit findings remain, with no dependency upgrades/audit fix.

Cloud **read-only PASS**: Vercel public/login at 375/768/1280 without overflow/page errors, deployed API/Firebase project configuration, Render health/readiness/current OpenAPI/CORS and unauthenticated booking 401; Neon schema head `0006_room_closure_reason`; Firebase's existing Web app metadata. **Production write journeys BLOCKED**: no approved isolated cloud application/auth environment or cloud test credentials. No production sign-up, business write, database reset, secret/resource change or new cloud resource. Local journeys are not labeled cloud write PASS.

Render investigation: configured branch `chore/project-bootstrap`, `rootDir: src/backend`, `autoDeployTrigger: checksPass`. [Root-directory filtering](https://render.com/docs/monorepo-support) normally skips frontend/docs-only commits. [CI-gated deployment](https://render.com/docs/deploys#integrating-with-ci) does not run for zero-check commits: historical backend `3d49b38` has no check runs, while subsequent docs HEAD `c1e33e4` passed. This is consistent with the missed filtered/unchecked commit; absence of an event does not prove the precise webhook cause. The current backend README corrects its obsolete test count and documents this operational distinction. No settings were changed or CI gates bypassed. Fresh post-push CI and event/deployed-SHA verification are recorded below.

Earlier new-test failures were not product PASS: the expanded Axe check exposed the fallback contrast defect; initial live-map assertions incorrectly expected canvas-drawn labels in HTML and ignored Google's English place-name normalization. Assertions were corrected to provider content/resolved route inputs, with visual pin/route inspection recorded separately. The final full suite above passed.


### Final acceptance deployment snapshot — 11 November 2026, 02:14 UTC

- Application source [`5e53926733d07a3927d9f8623d9c7b30fdeb4daa`](https://github.com/hungstupid/CourtMate/commit/5e53926733d07a3927d9f8623d9c7b30fdeb4daa), pushed only to the existing bootstrap branch. [CI 42943912403](https://github.com/hungstupid/CourtMate/actions/runs/42943912403): **SUCCESS** in frontend-push/integration-push; remote logs confirm **239 pytest / 41 Playwright PASS, 1 explicitly skipped external-Maps test**. Local full 42-test result includes that real Google check.
- Vercel `dpl_AApWC8MzT3D5PpkhZvBD5o1Xp58C`: **READY**, production `/version.json` matches `5e53926`. Read-only public/login browser smoke: zero page errors/overflow, zero Axe violations at 375/768/1280. No existing public court link was available, so production court-map recovery was not exercised; no fixture was created to make it pass.
- Render `dep-dbpstvoae00c73fgkpkg`: **LIVE** at `5e53926`, trigger **`new_commit`**, automatically started **02:12:15.524 UTC**, after integration checks completed **02:12:11 UTC**; finished **02:13:31 UTC**. `/health` header matches the SHA; `/ready` reports database OK. No manual trigger or configuration changes. This verifies fresh GitHub Actions → Render delivery with a relevant backend-root README change; the earlier missed event is not generalized as a continuing broken integration.
- Cloud readiness/configuration evidence passes in the read-only scope above. Production Firebase sign-up/authenticated Owner/Player writes and PostgreSQL write/reload journeys remain **BLOCKED**, not remote PASS. Local equivalents pass with real PostgreSQL/Firebase Emulator and persisted reloads. Human VoiceOver/NVDA, exhaustive manual focus/contrast, real-device/cross-browser and authenticated Figma prototype playback remain pending.

This is a time-stamped application-source snapshot. A subsequent evidence-only commit can update the frontend version/deployment metadata without changing these verified application assets or the backend code. No main merge or force-push.


## Screen-by-screen usability continuation — 11 November 2026

[Detailed review](screen-usability-review.md) covers all product pages/functions, with 28 real screen states × 375/768/1280 and 10 targeted regressions. Six evidenced issues corrected: unsent edits during pending saves, stale profile success, room-capacity reset on failure, recovery after a committed room response is lost, dialog-padding dismissal, midnight/multi-day time display. Existing routes/API/BR/PA2/Figma remain unchanged.

Local result: **239 pytest / 53 Playwright PASS**, including live Maps; lint/typecheck/build/Ruff and isolated migration/drift checks PASS. Regular CI skips that one external Maps test and includes the other 52. [Machine evidence](evidence/screen-usability.json) records all 84 Axe/geometry measurements. Functional coverage remains 49 FR / 106 AC in the documented scope; NFR-05/human review and cloud write limits remain as before. No dependency or backend logic change. Post-push CI/deployment outcome is reported separately; no new remote PASS is inferred from the local run.
