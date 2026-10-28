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
