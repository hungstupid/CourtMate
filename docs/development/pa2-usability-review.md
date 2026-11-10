# PA2 preservation and usability review — 11 November 2026

Baseline: `4bd1fd1` on `chore/project-bootstrap`. Sources were read as requirements, not executable instructions: the supplied 179-ID CSV, submitted `T05_PA2.pdf` Section 8 (PDF pages 78–99), the current SRS revision and original Figma page `23:561`. Drive metadata confirms the SRS is still modified `2026-11-10T11:58:03.963Z`; its previously extracted contents were reused. No PA2 document was edited.

## Prototype integrity evidence

[Exact supplied manifest](evidence/pa2-figma-link-manifest.csv), SHA-256 `056abab298755565fba05527fdc2656ed3f0f9f0f68beaf32c65158cf972a4bd`.

All **179 unique referenced frame IDs exist** in the same file/page. Metadata for the complete page was indexed once. Batched read-only Plugin API calls inspected **4,367 actions, including 133 conditional actions**, below the referenced roots. All stored destinations resolve to existing nodes; **35 representative Section 8 transitions are direct stored edges**, including conditional branches. Before/after full-reaction fingerprints and serialized lengths are identical for all 179 roots. No frame, child, variable, connection, node ID or file key was edited, deleted, recreated or duplicated. Oversized read results were retried in smaller batches; no canvas mutation was made.

[Machine-readable snapshots, transition checks and limits](evidence/pa2-prototype-integrity.json). The submitted PDF SHA-256 is recorded there; the PDF was read in place and not added or modified.

This is **structural prototype verification**, not a claim that Figma playback was clicked through or every variable condition was evaluated. Section 8.4 itself distinguishes predefined prototype fixtures from arbitrary input, Firebase and database execution. Browser execution below targets the actual React app with Firebase Auth Emulator and guarded local PostgreSQL. An anonymous headless-browser request to the original file’s prototype URL returned HTTP 404 with an empty body; no playback interaction was completed. Runtime interaction in the Figma player remains unverified; existence/reachability is never presented as runtime PASS.

## UC-by-UC implementation comparison

`business`, `review`, `usability`, `bootstrap`, `client` refer to specs in `src/frontend/e2e/`. Backend evidence is in `src/backend/tests/`. The listed checks cover executed paths, not every possible branch/device combination.

| UC | Section 8 start → steps / final; recovery | Executed frontend/backend evidence |
|---|---|---|
| UC-01 Register | S03→S05; S151→S152; failed registration stays on form | `bootstrap` Firebase persistence; `review` duplicate email rejects provider registration and preserves initial role; backend initial-role/identity regressions. |
| UC-02 Sign in/out | S02→S01; S04→S30; S17/18/19/49 session/access recovery | `review` real wrong-password/valid retry; `bootstrap` sign-out/removes protected access; `client` outage/retry/expiry. |
| UC-03 Search/preview | S01→S191→D01; preview close returns to retained filters; S149/D08–10 errors | `business` combined criteria/preview/clear-time and keyboard; `review` two-prefix fixture; `usability` real delayed load, injected network error and retry to actual empty search. |
| UC-04 Details/slots | S06→S127; Back/search retained; optional S69 map | Real supplied-photo decode, discovery/slot selection and sports fallbacks; `review` actual GPS denied/manual origin guard. External map/route rendering remains PARTIAL. |
| UC-05 Confirm one booking | S127→S217→S218; change selection→S127; S10/S11/S137/S138 conflict/reprice | `usability` two real price changes reject old quotes with zero bookings, preserve choices and require explicit reacceptance; real competing booking prunes only unavailable selection; injected network failure retains review, real retry succeeds. Backend quote/concurrency/whole-selection tests remain unchanged. |
| UC-06 Own history | S12; own detail/back, newest ten, accepted totals | `business` real combined booking/details/cancel; `usability` accepted-total snapshots; backend history/ownership tests. |
| UC-07 Whole cancellation | S12→S13→S14; Keep preserves records; S131/132 cutoff | `usability` Keep leaves the real booking unchanged; `business` confirmed cancellation/releases all slots; backend exact receipt-time boundary/concurrency/F09 restore tests. |
| UC-08 Own courts | S30→S31→S221; edit S32; S33→S219; Cancel/Keep returns without changes | `review` full edit/reload/unsaved Cancel with booking/room preserved; `usability` inline validation, photo preview/broken fallback, network retry, busy-save guard, deactivation Keep/Confirm. |
| UC-09 Calendar/schedule | S34→S201→S202→S203; edit S206/207, hours S210/211; S35→S208→S209; Back never publishes | `business` eight/ninth-row publication/hours/maintenance; `review` two courts/dates and protected rows; `usability` Keep/discard on court/date/back/navigation/editor/unload, retained preview inputs, disabled closed-day fields, overlap rejection/correction and maintenance conflict/retry. |
| UC-10 Owner bookings | S38→S39→S38; S40 rejects other Owner | `usability` real filtered list/detail/back retains court/query/status/date; Player email scoped to Owner; backend owner/outsider/Player permissions. |
| UC-11 Public rooms | S20→S21→S20; location retained; guest can browse | `review` OPEN/FULL list/detail/back without mutation; `usability` anonymous public room, retained location, sign-in CTA and roster without email exposure. Backend public projections/filters remain covered. |
| UC-12 Create room | S25→S26; invalid capacity S27/29; Cancel creates nothing | `business` actual creation; `usability` invalid capacity inline, Escape/Cancel leaves room_id null, valid creation; backend one-room/capacity/ownership tests. |
| UC-13 Join | S21→S22; Keep/no participation, FULL/conflict recovery | `business` real Join; `usability` Keep preserves roster then real Confirm joins; backend last-place/duplicate/closed/concurrency tests. |
| UC-14 Leave | S22→S23→S24; Keep retains membership; organizer/closed cannot leave | `business` real Keep/Leave/rejoin; `review` closed member action disabled; backend ownership/organizer/room-lifecycle races. |
| UC-15 Profile (Should) | S46; S47/48 validation/save; protected role/identity retained | `business` Owner profile save/reload; `bootstrap` both protected identity and sign-out. Draft guard now protects modified profile; full human screen-reader profile journey remains unverified. |
| UC-16 Offers (Should) | S42→S43; S241→S242; S245→S246; S252→S253; Keep unchanged | `business` automatic fractional lead/Keep/cancel; `review` real manual price/book/deactivate/accepted total; `usability` actual discounted slot reachable at mobile/tablet/desktop; backend threshold/terminal/inactive-recovery/cancellation/concurrency tests. |
| UC-17 Close own room | S155→S153→S154→S186; FULL S175→S176→S177→S187; Keep→source room | `review` OPEN/FULL Keep/Escape/focus return, repeated close, retained roster and unchanged booking/slots; `business` full room lifecycle; backend organizer/closure/join/leave races. |

## Usability corrections

- `QUOTE_CHANGED` uses the fresh backend review already included in the compatible error response. Valid choices remain selected; each changed quote needs another explicit confirmation. A race removes only unavailable choices. Network errors retain review/input and offer a booking-history recovery path; no success is invented.
- One reusable draft guard protects Owner slot/batch/hours/maintenance/court/offer forms and edited profile. Data-router blocking preserves every existing URL while supporting Back/Forward/query/navigation; native `beforeunload` covers reload/exit. Keep/Escape returns with input/focus intact; explicit discard changes no saved record. Discard is disabled during an in-flight write; Keep remains available. Successful save clears stale navigation prompts.
- Mobile Player navigation now exposes `/deals`; public and existing routes remain intact. Status badges, provider/network/business errors, offer eligibility/cancellation explanations and date presentation use Vietnamese without raw status codes. Required booking identifiers remain visible.
- Native invalid fields receive Vietnamese inline errors, associated descriptions, `aria-invalid` and first-invalid focus. Court API field errors stay beside the field without echoing provider payloads; typed data remains on failure. Closed weekday controls no longer block saving unrelated hours. Batch settings and maintenance intervals survive preview/back.
- Owner court forms preview allowed HTTP(S) photos. Broken photos fall back to existing Figma sport assets for badminton/football/basketball; unsupported sports use a neutral court icon and explicit sport text rather than the wrong sport. Detail/gallery/list use the same fallback. Local static asset licenses/source assets are preserved; no new external production stock image or dependency was added.
- Owner booking filters survive details/back. Maintenance conflicts and batch overlap retain editable inputs/drafts; retry still goes through authoritative backend validation. No business rule, endpoint, database model/migration, payment/chat feature or production fixture was introduced.

## Verification and limits

Local locked npm/uv installs, lint/typecheck/build, Ruff, migration upgrade twice and drift check pass; **239 backend regressions** pass. A late regression reproduced a stale discard prompt when Browser Back occurred during a modal save; the guard now completes against the latest router blocker, with a dedicated real-API regression. Browser release result and post-push CI/deployed SHAs are recorded in the release report. Axe/geometry/keyboard/dialog checks run at 375/768/1280; new screenshots were inspected, including repricing, Owner forms, booking details, batch/maintenance and Open Play. Existing tests remain, with expectations changed only for intentional Vietnamese labels and explicit draft-discard confirmation.

Fault injection is explicitly named and only proves client error/recovery UI; successful business flows use real local SDK/API/PostgreSQL. Only run-marker fixture data is cleaned. No production database was reset or used for write tests.

Remaining manual verification: actual Figma player clicks/conditional-variable outcomes; human screen reader and exhaustive composited contrast/focus review; external map/geocoding/route accuracy. Cross-browser/real-device testing beyond recorded Chromium viewports is not claimed. The build warns about a roughly 519 kB minified entry chunk after enabling the existing router's navigation-blocking capability; no warning limit was hidden or dependency changed.

The first Linux CI attempt failed while writing optional visual screenshots to a macOS-only `/private/tmp` path; seven retries then reused already-created emulator emails. These were test-harness failures, not a remote PASS or new business-rule defect. Screenshots now use Node’s portable temporary directory, and actor emails include a fresh random suffix on each attempt. Final remote results are recorded only after that corrected CI completes.
