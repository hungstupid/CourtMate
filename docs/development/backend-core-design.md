# Backend core implementation draft — 28 October 2026

This is an implementation draft for PA3–PA5 review, not evidence that the team
approved PA3/PA4 or that all product AC/NFRs passed. The current SRS was fetched
directly from Google Docs on 28 October; PA documents and Figma are unchanged.

## Model and invariants

- Keep `users` and server-controlled Player/Owner roles. Add `courts` (Owner FK,
  name, sport, address, area, description, public venue contact, supplied photo
  URLs, integer positive base_price_vnd, max_players 2..30, active).
- `operating_hours`: one local-day window per court/weekday, minute offsets
  0..1440; omitted weekdays are closed. Overnight windows are represented on
  separate days. This initial window representation is a PA3 design decision.
- `slots`: court, playing_date, timezone-aware start/end, positive integer VND
  quote, version, published, blocked. Every individual slot lasts 60..240 minutes
  on the 30-minute grid. No overlapping published slots per court. Slots are
  soft-unpublished, never deleted out of booking history.
- `maintenance_blocks`: court and a positive timezone-aware interval.
- `bookings`: Player, court, combined interval, CONFIRMED/CANCELLED, accepted
  total, created/cancelled timestamps. `booking_slots` retains ordered immutable
  interval/price/version snapshots. `slot_claims` has slot_id as primary key and
  booking FK: it represents only active occupancy, so cancellation can release
  slots without deleting history or blocking a later booking.
- Phase B, only after A passes: `rooms` has a unique booking FK, organizer,
  capacity, closed flag; `room_members` has composite room/player PK. Organizer
  counts as member one. OPEN/FULL derive from active membership count; CLOSED
  derives irreversibly from booking cancellation/first start or the closed flag.

PostgreSQL checks/FKs/unique keys enforce scalar bounds, links and active claims.
All operations affecting a court lock its row, including publish/edit, review,
confirm, cancellation, maintenance, hours and capacity changes. This deliberately
coarse lock is simple and works across workers; no process-local locks are used.
The tradeoff is serialized writes per court; performance NFRs remain unverified.

## Transactions, clock and quotes

One request uses one Session/transaction, including identity provisioning. Auth
flushes without committing business work. The session dependency commits before
a successful response and rolls back on failure; business services use the
existing autobegin transaction rather than nested `session.begin()`.

Stable lock order: Court → Booking → Room → selected Slots ordered by UUID.
Lookups to identify the parent court happen before locking but eligibility and
ownership are checked again under its lock. Backend time is read after locks via
PostgreSQL `clock_timestamp()`; tests inject a clock function, never change the
machine clock. Store UTC instants; playing_date/grid/hours use Asia/Ho_Chi_Minh.
Intervals are half-open; an ending midnight belongs to the prior playing day.

Review only reads/validates; it creates no hold. It returns ordered per-slot
quotes, interval, minutes, integer total and a SHA-256 quote fingerprint covering
the player, court version, ordered slot IDs/versions/intervals/prices. Confirm
recomputes everything under the court lock, checks the accepted fingerprint, and
atomically inserts ONE booking, its snapshots and ALL active claims. A mismatch
returns 409 with a fresh review when possible; client totals/role fields cannot
set price or privilege. No F09 discount is applied or claimed implemented.

Cancellation locks the same court/booking, rechecks Player ownership and server
time, and requires at least six hours before the first start, including exactly
six hours. Repeated cancel is a deterministic 409. It releases all claims,
retains snapshots and, in B, closes the linked room in the same transaction.
Hours/slot/maintenance changes cannot invalidate a CONFIRMED booking. Court
deactivation leaves existing booking status unchanged. Capacity reduction must
preserve every future OPEN/FULL room's configured capacity.

## API contract

JSON request models reject unknown fields; money/capacity/minute values are
strict integers. Errors use HTTP 401 identity, 403 role/ownership, 404 unknown
resource, 409 state/quote/booking conflict and 422 invalid input.

| Endpoints | Purpose |
| --- | --- |
| GET /api/courts, /api/courts/{id} | Public active court listing/details |
| GET /api/courts/{id}/availability?date=YYYY-MM-DD | Slots with effective state and maintenance |
| POST/GET /api/owner/courts; GET/PATCH /api/owner/courts/{id} | Owned court CRUD without destructive delete |
| PUT /api/owner/courts/{id}/hours | Replace weekly hours atomically |
| POST /api/owner/courts/{id}/slots; PATCH /api/owner/slots/{id} | Publish/edit/unpublish/block |
| POST /api/owner/courts/{id}/maintenance; DELETE /api/owner/maintenance/{id} | Maintenance management |
| POST /api/bookings/review | `{slot_ids: [UUID, ...]}` → ordered review/quote |
| POST /api/bookings | `{slot_ids: [...], quote: fingerprint}` → one booking |
| GET /api/bookings, /api/bookings/{id}; POST /api/bookings/{id}/cancel | Player's ten newest/history/cancellation |
| GET /api/owner/bookings, /api/owner/bookings/{id} | Own courts' booking metadata only |
| POST /api/bookings/{id}/room | B: create room with integer capacity |
| GET /api/rooms, /api/rooms/{id} | B: public effective status/history/estimate |
| POST /api/rooms/{id}/join, /leave | B: Player membership mutation |

SRS FR-029 does not enumerate approved Player contact fields, so the Owner
booking response excludes Firebase UID/email/phone and other unapproved personal
data. PA3 must approve that privacy subset before adding fields. SRS nearest-VND
estimate ties are unspecified; B uses integer round-half-up and documents it.

## Traceability and verification

| Requirements | Implementation and planned database-backed evidence |
| --- | --- |
| FR-003..005, BR-09; AC-F01-06..08, AC-F04-06 | Existing Firebase verification; explicit Player/Owner and ownership guards; API denial/no writes |
| FR-010..012, FR-023..027; BR-01/03/05 | Court/hours/slots/maintenance; bounds, overlaps, ownership, protected-booking preservation |
| FR-014..018; BR-10; AC-F04-01..10 | Review/quote/atomic confirm; single/multi-slot, 60/240, grid/date/gaps/stale quote, independent-session races |
| FR-019..022; BR-02; AC-F05-01..07 | Ten newest records, whole cancellation, exact-six-hour boundary, rebooking and retained history |
| FR-028..030 | Own-court booking metadata; cross-owner denial and privacy exclusion |
| FR-031..038; BR-04..06/08; AC-F10-01..14 | B only after A: unique room, membership/capacity/join/cancel/start races, estimates |
| NFR-02/03 integrity aspects | Real PostgreSQL, independent transactions, synchronized contention and final-state assertions; includes ten overlapping confirmation attempts |

Migrations are additive and preserve identity rows. Test empty schema and a
populated 0001 identity schema before push. Old live identity endpoints can use
the additive schema, but their exact-head readiness becomes false during the
revision transition: a brief rollout interruption is possible. Never downgrade
demo; rollback must use code that understands the new head or a forward fix.
No performance/accessibility/product completion claim follows from these tests.
