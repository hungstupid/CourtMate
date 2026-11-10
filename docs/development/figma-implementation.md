# Current Figma implementation mapping

Read directly on 10 November 2026 from the original [CourtMate design](https://www.figma.com/design/2EFad23oucNwIjREtvVUPE/SE_FE_Design_Court-Mate?node-id=23-561). Starter access initially failed; the Education-enabled retry succeeded. Page metadata was extracted once; the following screen contexts and reference screenshots were then fetched. The Figma file was not edited.

| Source node | Screen | Live implementation |
|---|---|---|
| 27:2; 44:2478 | S01 search; S56 mobile | `CourtsPage.tsx`, `SportSelect.tsx` |
| 27:242; 27:134 | S03 register; S02 sign-in | `AuthPage.tsx`; SRS email-only authentication takes precedence over obsolete prototype username copy |
| 27:310; 221:3452; 221:3508 | Details, published slots, review | `CourtPage.tsx`; actual quotes, selection and one confirmation |
| 44:122 | My bookings | `BookingsPage.tsx` |
| 44:445; 182:2012 | Room discovery; organizer room | `RoomsPage.tsx` |
| 44:857; 44:921 | Owned courts; court form | `OwnerPage.tsx` |
| 44:1070; 221:2554 | Daily calendar; batch preview | `SchedulePage.tsx` |
| 221:2938; 221:3066 | Maintenance impact; hours | `SchedulePage.tsx` |
| 44:1281 | Owner booking details | `BookingsPage.tsx` owner mode; current SRS-approved email/name replaces the prototype's older unspecified-contact note |
| 44:1538 | Profile | `ProfilePage.tsx` |
| 44:1393; 284:4249 | Offer overview; automatic offer | `OffersPage.tsx` |

Design tokens are preserved in `src/frontend/src/app/styles.css`: canvas `#f5f7f2`, ink `#162d25`, muted `#52665b`, green `#176341`, forest `#103c2a`, soft `#eaf3e7`, line `#d7e0d6`; Inter 400/500/600/700, 48 px controls, desktop content width 1120, 12/16/20/24 px radii. Inter Latin/Vietnamese WOFF2 subsets are hosted locally with the upstream SIL OFL license. No UI library was added.

| Static source layer | Local asset | Intrinsic size |
|---|---|---|
| S01 43:143 | `/images/hero-court.svg` | 376×236 |
| S01 241:3284 | `/images/chevron.svg` | 20×20 |
| S01 43:183 | `/images/court-badminton.svg` | 360×150 |
| S01 43:205 | `/images/court-football.svg` | 360×150 |
| S01 43:229 | `/images/court-basketball.svg` | 360×150 |
| S06 source Frame | `/images/court-detail.svg` | 680×300 |
| S56 source Frame | `/images/court-mobile.svg` | 335×150 |
| S02 43:272 | `/images/login-court.svg` | 480×240 |

Assets were downloaded from the exact design-context URLs using `curl -L`; SVG root dimensions/path contents were not changed. No expiring Figma URL is used at runtime. Actual Owner photo URLs remain dynamic. No prototype example court, booking, room, price, date, member or availability is presented as real data.

Desktop/mobile search, Owner calendar and booking-review screenshots were inspected locally; Playwright checks 375/768/1280 widths, keyboard operation, dialog focus return and Axe. Dialog confirmations/review and the seven-day hours editor adapt prototype screens to the existing API. This is source-grounded implementation, not a claim of pixel-perfect comparison for every prototype frame. External map behavior, human screen-reader evaluation and remaining exact AC variants are listed in the audit.

## Follow-up review — 10–11 November 2026

Read high-fidelity contexts and screenshots again for `44:1974` (S69 denied GPS/manual origin), `44:979` (S32 edit), `44:2478` (S56 mobile search) and `284:4429` (S247 pending automatic offer). No Figma edits. The S69 origin requirement exposed an actionable directions link before an origin existed; the local application now disables that action until a trimmed explicit origin is supplied. Real court edit round-trips, sport-prefix search and pending/active offer states were exercised using API data. Live desktop/mobile screenshots were inspected; long-name F09 overflow at 375 px was reproduced and corrected through text wrapping. Design tokens/local static source assets were retained; dynamic Owner photos remain data supplied.

New screenshot/Lighthouse review includes local authenticated Owner edit/calendar/F09, Player slots/review/booking and organizer room/close dialog. See `evidence/review-accessibility.json` for exact viewport/mode/score boundaries. The external map frame remained blank, and a human screen-reader/full pixel-comparison session remains pending; neither is presented as verified.
