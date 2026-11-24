## CourtMate

One place to find a court, book consecutive time and organize a game.

T05 Nexora · Introduction to Software Engineering · HCMUS

## How a match falls through

- Players compare inconsistent schedules and prices across messages.
- Owners reconcile changing bookings across separate channels.
- An available time can disappear between a quote and a confirmation.

## Product position

- For local players and court operators who need a shared view of availability.
- CourtMate combines discovery, authoritative booking and Open Play in one workflow.
- Payment and chat remain outside the agreed course scope.

## Plan versus delivery

- PA1 scheduled design, test design and integrated release as consecutive milestones.
- The team preserved a stable PA2 baseline and incorporated PA3 date and Room decisions before release.
- The main risks were concurrent writes, design drift and environment access.

## The release scope

- Thirty-eight Must requirements across authentication, discovery, booking, Owner operations and Open Play.
- Editable profiles and fixed-price offers are available.
- Map and directions are deferred in the current PA3. Address search remains available.

## Seventeen user goals

- Visitors find a venue, see slots and explore rooms.
- Players confirm or cancel bookings, maintain a profile and participate in Open Play.
- Owners publish schedules, manage venues and see bookings only for their own courts.

## Key quality targets

- NFR-01 sets 30-user read and write latency thresholds.
- NFR-02/03 protect slot claims and the last Open Play seat under contention.
- NFR-04 checks account roles and ownership. NFR-05 checks accessibility with automated and manual evidence.

## What the interface communicates

- Slot rows explain available, booked and blocked states in words.
- An updated quote requires a new explicit confirmation.
- Owner draft previews and Keep/Cancel preserve the user's context.

## One layered application

- Vercel delivers the React and TypeScript client.
- Render serves FastAPI application and business services.
- Neon supplies PostgreSQL transactions. Firebase authenticates users.

## Three decisions guide the architecture

- ADR-001 separates web, API, service and persistence responsibilities.
- ADR-002 uses PostgreSQL transactions and ordered locking for shared records.
- ADR-003 keeps Firebase identity separate from the application role and ownership checks.

## Data and state

- Vietnam playing date comes from the slot's start timestamp.
- Booking slots preserve accepted time and price. Claims allocate all selected slots atomically.
- A Room keeps its first authoritative closure reason and its historical membership.

## Release evidence

- Schema 0007 was tested on a fresh DB and existing fixture data, including guarded rollback.
- GitHub Actions runs frontend build and backend/browser integration.
- Runtime SHA and readiness are checked against the reviewed candidate.

## Test design and outcomes

- PA4 maps all 38 Must FR to 20 detailed cases.
- Partitions, boundary values and decision rules cover slot length, cancellation, room capacity and offers.
- PostgreSQL races inspect price snapshots, claims, memberships and rejected writes.

## Demo · Court Owner

- Sign in and open the court dashboard.
- Set hours, review a batch, publish and show maintenance.
- Inspect the booking list after a player reserves a slot.

## Demo · Player

- Filter the catalogue, choose two consecutive slots and read the quote.
- Confirm and reload to check the accepted total.
- Cancel an eligible booking and revisit the released slots.

## Demo · Open Play

- Create a room tied to one confirmed booking.
- A different Player joins, reloads, then leaves.
- The Organizer closes the room while preserving the booking.

## Retrospective and AI use

- Explicit snapshots, locks and reproducible races made correctness easy to demonstrate.
- Late design/document revisions created rework. Iterative acceptance would surface mismatches sooner.
- The team verifies AI-assisted code, test evidence and generated illustrations.

## Questions and product handoff

- [CourtMate live application](https://courtmate-court-mate.vercel.app)
- [Release candidate and CI](https://github.com/hungstupid/CourtMate/pull/98)
- Ask about stale quotes, the exact six-hour cancellation boundary or recovery after a schema rollback.
