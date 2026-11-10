# Current application contracts — 10 November 2026

This section supersedes the October draft descriptions below. Current SRS and executed evidence: [audit](srs-implementation-audit.md), [release report](frontend-release-report.md). All protected calls use a verified Firebase Bearer ID token; JSON mutations reject extra/protected fields.

| API | Current behavior |
|---|---|
| `POST /api/register` `{role:"player"|"owner"}` | After successful Firebase email/password registration, assign exactly one initial backend role. Same-role retry is safe; existing-role changes conflict. Unregistered identities cannot use protected actions. |
| `GET /api/me`; `GET/PATCH /api/profile` | Profile PATCH accepts only `display_name` (≤100), `contact_preferences` (≤500); role and registration email are read-only. |
| `GET /api/courts?q=&sport=&area=&start=&end=` | AND filters; trimmed case-insensitive literal name/address/area substring; start/end optional independently, aware instants. Any supplied time bound requires a future AVAILABLE published slot fully inside it. Invalid ranges reject. |
| `GET /api/courts/{id}`; `/availability?date=YYYY-MM-DD`; `/preview?start=&end=` | Full details/day states or nearest/matching AVAILABLE preview. No two-slot cap. Slot `price_vnd` is effective; `regular_price_vnd` and `offer` preserve pricing context. |
| `POST /api/owner/courts/{id}/slots/batch` `{slots:[{start_at,end_at,price_vnd}]}` | One selected court/day; validate every draft row and all mutual/existing overlaps before publication. Any invalid row rolls back the whole request. Draft generation/edit/preview is client-local until this request. |
| `POST /api/bookings/review`; `POST /api/bookings` | `{slot_ids}` → ordered per-slot/current offer quotes, combined interval/duration/total and `quote`. Confirm `{slot_ids,quote}` revalidates atomically; stale quote conflicts and requires explicit fresh review. |
| `GET /api/bookings`; `GET /api/bookings/{id}`; `POST /api/bookings/{id}/cancel` | Ten newest whole-booking records. Cancellation uses backend HTTP receipt time for the six-hour boundary, rechecks ownership/status under locks, releases the whole selection and closes linked rooms. `can_cancel`, `can_create_room`, `room_id`, court name/capacity support live UI. |
| `GET /api/owner/bookings[/{id}]` | Owner-scoped records and ordered slot snapshots; only Player registration email/display name are disclosed. Legacy email recovery reads trusted Firebase identity; provider outages show unavailable contact without fabricating data. |
| `GET /api/rooms?location=`; `GET /api/rooms/{id}` | Public case-insensitive linked-court address/area filter and room details; effective lifecycle, member display names/organizer relation, accepted-total share estimate. No private contact/token/preferences/member IDs. |
| `GET /api/rooms/{id}/membership` | Player-only projection adding current-user membership/organizer and roster `is_self`; never authorizes via client fields. |
| `POST /api/bookings/{id}/room` `{capacity}`; `POST /api/rooms/{id}/join|leave|close` | Existing Player/capacity rules; organizer-only close is idempotent and irreversible, retains members and booking. Closure reason records organizer/cancellation/start. |
| `GET/POST /api/owner/slots/{id}/offers` | Create `{mode:"manual"|"automatic",price_vnd,lead_hours}`. Positive integer offer below regular quote; one SCHEDULED/ACTIVE config per slot; manual ≤24h, automatic 0<h≤24 including fractions and configuration earlier than 24h. |
| `POST /api/owner/offers/{id}/cancel|deactivate` | Explicit confirmed pending cancellation versus active deactivation; state is recomputed before mutation. A 409 state-change response retains current derived lifecycle; terminal states never revive. |
| `GET /api/deals` | Public currently eligible effective slot offers; no mocked deals. |

Existing Owner court GET/POST/PATCH, hours GET/PUT, slot GET/POST/PATCH and maintenance GET/POST/DELETE routes remain available. Every writer takes the existing parent Court lock; regular slot quotes and accepted booking snapshots remain separate. Automatic quotes evaluate current server time/availability on reads and confirmation, without requiring a cron job.

---

# Historical October API notes

The following records describe the earlier draft and must not override the current contracts above.

# Backend API draft for frontend integration

This is an implementation draft for PA3–PA5 review, not a completed business UI
or a claim that all product acceptance/performance requirements have passed.
Run `make db-up`, `make migrate`, `make auth-emulator`, and `make dev-api` using
[setup.md](setup.md). Swagger: `http://localhost:8000/docs`; current contract:
`/openapi.json`. Existing public cloud API: https://courtmate-api-cs7b.onrender.com.

Use the existing frontend `apiRequest<T>` helper. Protected calls attach the
current Firebase ID token. Public calls set `authenticated: false`. Never send
an Owner role/owner ID/Player ID or client-calculated accepted price in payloads.
Public registration makes Player; Owner remains internally provisioned.

All IDs are UUID strings. Instants use ISO8601 with an explicit UTC offset;
responses are timezone-aware. Playing dates and weekly hours use
`Asia/Ho_Chi_Minh`; Monday is weekday 0. Interval ends are exclusive. Amounts
are integer VND, never floating point. Integer storage is PostgreSQL BIGINT;
a combined total exceeding that technical bound is rejected.

## Owner court/schedule flow

`POST /api/owner/courts` → 201. Required example body:

```json
{
  "name": "Example court", "sport": "badminton", "address": "Venue address",
  "area": "Area", "description": "Court description", "contact": "Public venue contact",
  "base_price_vnd": 100000, "max_players": 8
}
```

Optional `photo_urls` contains at most 20 supplied HTTP(S) URLs, without embedded
credentials. No upload/storage service is added. `active` defaults true.
`GET /api/owner/courts` and `GET/PATCH /api/owner/courts/{id}` operate only on the
Owner's courts. PATCH accepts supplied editable fields and rejects empty/null
or unknown fields. Set `active: false` to deactivate without deleting bookings.

`PUT /api/owner/courts/{id}/hours` replaces the weekly schedule atomically;
`GET` at the same path reads it. An omitted weekday is closed. Example:

```json
{"windows": [{"weekday": 1, "opens_minute": 480, "closes_minute": 1320}]}
```

One window per weekday, 0 <= opens_minute < closes_minute <= 1440. Opening
minutes need not be on the slot grid. Overnight hours use separate days.
Changing hours cannot invalidate an existing published future slot or a
CONFIRMED booking. Unpublish/edit unbooked slots first where necessary.

`POST /api/owner/courts/{id}/slots` → 201:

```json
{"start_at": "2035-01-02T18:00:00+07:00", "end_at": "2035-01-02T19:00:00+07:00", "price_vnd": 100000}
```

Every individual slot lasts 60–240 minutes and starts/ends on the local
30-minute grid. It stays within one playing day (ending midnight is allowed),
fits hours and avoids published overlap/maintenance/confirmed reservations.
`published` defaults true and `blocked` false. `PATCH /api/owner/slots/{slot_id}`
accepts interval/price/flags. A currently confirmed slot cannot be edited;
cancelled booking snapshots remain unchanged when later quotes change.

`GET /api/owner/courts/{id}/slots?date=2035-01-02` reads all owned slots,
including unpublished/blocked slots and those of inactive courts. Date is
optional. This supports reload of the Owner editor.

`POST /api/owner/courts/{id}/maintenance` accepts aware `start_at`/`end_at`.
It blocks availability but rejects overlap with CONFIRMED bookings.
`GET` at that path lists blocks (optional local `date` filter);
`DELETE /api/owner/maintenance/{block_id}` removes only an owned block (204).
No force cancellation is provided.

## Public availability and Player booking

`GET /api/courts?q=...&sport=...&area=...` lists active courts; filters are
optional. `GET /api/courts/{id}` returns active court details. These are the
minimal read paths needed by this backend flow, not a complete F02 frontend.
`GET /api/courts/{id}/availability?date=2035-01-02` returns court/date/timezone,
server_now, published slots with AVAILABLE/BOOKED/BLOCKED/UNAVAILABLE status,
and maintenance intervals. Selection/review never reserves a slot.

1. `POST /api/bookings/review` with `{ "slot_ids": ["uuid-1", "uuid-2"] }`.
2. Display returned ordered `slots` with price/version/interval,
   `start_at`, `end_at`, `duration_minutes`, `total_price_vnd` and `quote`.
3. After explicit acceptance, `POST /api/bookings` with the same slot IDs and
   exactly the returned `quote` string. Success is 201 with ONE booking.

Selections contain 1–4 distinct slots, same court/local playing date, strictly
consecutive and 60–240 minutes TOTAL. Submit no total/role fields. The backend
recomputes all eligibility/prices under a PostgreSQL court lock. A stale quote
returns 409 `QUOTE_CHANGED` with `detail.review` when the whole selection is
still eligible; render that new review for explicit acceptance. An unavailable
slot returns 409 and leaves no partial booking/claim. Do not blindly retry a
mutation. A successful confirm/cancel increments the quote version; an old
confirmation retry after cancellation cannot silently rebook.

`GET /api/bookings` returns the signed-in Player's ten newest bookings (one
record per whole booking). `GET /api/bookings/{id}` reads only their booking.
Responses include status, total, ordered immutable slot snapshots,
`can_cancel` and `cancellation_reason`. Do not treat the displayed eligibility
as a hold: `POST /api/bookings/{id}/cancel` rechecks backend time after locks.
At least six hours before the first start is required, inclusive at exactly
six hours. It cancels the WHOLE booking, releases all claims, preserves history
and closes any linked room atomically. Repeat cancel returns 409.

`GET /api/owner/bookings` and `GET /api/owner/bookings/{id}` expose only the
Owner's courts' booking metadata. Approved Player contact fields are not defined
in current SRS FR-029, so no Firebase UID/email/phone is exposed by assumption.
PA3 privacy review must approve any future contact projection.

## Open Play

`POST /api/bookings/{id}/room` with `{ "capacity": 16 }` → 201. Only the Player
owning a future CONFIRMED booking may create its single linked room. Capacity
must be an integer 2..2×court.max_players; the organizer is member one. A closed
room still occupies the unique booking link. Court deactivation alone does not
cancel an existing booking or prevent its otherwise eligible room.

`GET /api/rooms` and `GET /api/rooms/{id}` are public, including closed history.
Fields include room/booking/court/organizer IDs, full interval, capacity,
member_count, remaining_places, OPEN/FULL/CLOSED status, created_at,
estimated_share_vnd and estimate_status. No membership list or Firebase/contact
information is exposed. These drafts expose linked booking UUID/interval but no
Player booking details; PA3 must review public-history/privacy policy.

`POST /api/rooms/{id}/join` and `/leave` require Player. Duplicate join,
FULL/CLOSED join, non-member leave and organizer leave return 409. A permitted
leave reopens a FULL room. Reads and mutations derive closure from source
cancellation/first start without cron. The closed flag is sticky, including a
rejected start-time membership call; no membership change commits on that path.
Owner court-capacity edits cannot invalidate any future OPEN/FULL room.

Estimate is accepted WHOLE booking price / current members, integer round-half-up
to nearest VND. Invalid/incomplete snapshots return
`estimate_status: "unavailable"` and `estimated_share_vnd: null`. Display
"Estimate unavailable" instead of inventing a price. There is no payment/deposit.

## Errors and implementation limits

Business failures use `{ "detail": { "code": "...", "message": "..." } }`;
FastAPI input validation uses its normal 422 detail list, and existing Auth
failures may use a detail string. Use status plus typed detail checks, not a
single assumed shape. Statuses: 401 invalid/missing identity, 403 role/ownership,
404 unknown/unlisted resource, 409 state/quote/conflict, 422 invalid input,
503 actual dependency outage. The existing API client handles these statuses.

No F09 discount is applied. No profile, payment, chat, waitlist, cron, worker or
new service is delivered. Court-row locking deliberately serializes writes per
court; correctness tests do not establish throughput or product NFR targets.
