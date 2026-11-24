"""Read-only invariants and state counts scoped to the seeded venue IDs."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

REPORT = """
WITH demo_slots AS (
    SELECT * FROM slots WHERE court_id = ANY(:ids)
),
demo_bookings AS (
    SELECT * FROM bookings WHERE court_id = ANY(:ids)
),
demo_rooms AS (
    SELECT r.*, b.status AS booking_status, b.start_at, b.player_id AS booked_by,
           c.max_players, COUNT(m.player_id) AS members,
           COUNT(m.player_id) FILTER (WHERE m.player_id = r.organizer_id) AS organizers
    FROM rooms r JOIN demo_bookings b ON b.id = r.booking_id
    JOIN courts c ON c.id = b.court_id LEFT JOIN room_members m ON m.room_id = r.id
    GROUP BY r.id, b.status, b.start_at, b.player_id, c.max_players
),
snapshots AS (
    SELECT bs.*, b.court_id, b.status, s.court_id AS slot_court,
           sc.booking_id AS claimed_by,
           LAG(bs.end_at) OVER (PARTITION BY bs.booking_id ORDER BY bs.position)
               AS previous_end
    FROM booking_slots bs JOIN demo_bookings b ON b.id = bs.booking_id
    JOIN slots s ON s.id = bs.slot_id
    LEFT JOIN slot_claims sc ON sc.slot_id = bs.slot_id
),
demo_offers AS (
    SELECT o.*, s.start_at, s.price_vnd AS regular
    FROM slot_offers o JOIN demo_slots s ON s.id = o.slot_id
)
SELECT
    (SELECT COUNT(*) FROM users
        WHERE firebase_uid LIKE 'courtmate-catalog-%' AND role = 'owner') AS owners,
    (SELECT COUNT(*) FROM users
        WHERE firebase_uid LIKE 'courtmate-catalog-%' AND role = 'player') AS players,
    (SELECT COUNT(*) FROM courts WHERE id = ANY(:ids)) AS courts,
    (SELECT COUNT(*) FROM demo_slots WHERE published) AS published_slots,
    (SELECT COUNT(*) FROM demo_slots WHERE published
        AND start_at > CURRENT_TIMESTAMP) AS future_slots,
    (SELECT COUNT(*) FROM demo_bookings) AS bookings,
    (SELECT COUNT(*) FROM demo_bookings WHERE status = 'CANCELLED')
        AS cancelled_bookings,
    (SELECT COUNT(*) FROM demo_rooms) AS rooms,
    (SELECT COUNT(*) FROM demo_rooms WHERE closed_reason IS NULL
        AND booking_status = 'CONFIRMED' AND start_at > CURRENT_TIMESTAMP
        AND members < capacity) AS open_rooms,
    (SELECT COUNT(*) FROM demo_rooms WHERE closed_reason IS NULL
        AND booking_status = 'CONFIRMED' AND start_at > CURRENT_TIMESTAMP
        AND members = capacity) AS full_rooms,
    (SELECT COALESCE(SUM(members), 0)::bigint FROM demo_rooms) AS memberships,
    (SELECT COUNT(*) FROM demo_offers) AS offers,
    (SELECT COUNT(*) FROM demo_offers WHERE status = 'ACTIVE'
        AND start_at > CURRENT_TIMESTAMP) AS active_offers,
    (SELECT COUNT(*) FROM demo_offers WHERE status = 'SCHEDULED'
        AND start_at > CURRENT_TIMESTAMP) AS scheduled_offers,
    (SELECT COUNT(*) FROM demo_offers WHERE status = 'EXPIRED') AS expired_offers,
    (SELECT COUNT(*) FROM maintenance_blocks WHERE court_id = ANY(:ids)) AS maintenance,
    (SELECT COUNT(*) FROM demo_slots s JOIN demo_slots o ON s.court_id = o.court_id
        AND s.id < o.id AND s.start_at < o.end_at AND s.end_at > o.start_at
        WHERE s.published AND o.published) AS overlapping_slots,
    (SELECT COUNT(*) FROM demo_bookings b
        JOIN demo_bookings o ON b.court_id = o.court_id
        AND b.id < o.id AND b.start_at < o.end_at AND b.end_at > o.start_at
        WHERE b.status = 'CONFIRMED' AND o.status = 'CONFIRMED')
        AS overlapping_bookings,
    (SELECT COUNT(*) FROM demo_bookings b LEFT JOIN LATERAL (
        SELECT COUNT(*) AS size, MIN(start_at) AS starts,
               MAX(end_at) AS ends, SUM(price_vnd) AS total
        FROM snapshots WHERE booking_id = b.id
    ) s ON true WHERE s.size NOT BETWEEN 1 AND 4 OR s.starts <> b.start_at
        OR s.ends <> b.end_at OR s.total <> b.total_price_vnd)
        AS booking_snapshot_mismatch,
    (SELECT COUNT(*) FROM snapshots WHERE court_id <> slot_court
        OR (previous_end IS NOT NULL AND previous_end <> start_at)
        OR (status = 'CONFIRMED' AND claimed_by IS DISTINCT FROM booking_id)
        OR (status = 'CANCELLED' AND claimed_by = booking_id))
        AS claims_or_contiguity_mismatch,
    (SELECT COUNT(*) FROM demo_rooms WHERE organizers <> 1 OR booked_by <> organizer_id
        OR members > capacity OR capacity > 2 * max_players) AS invalid_room_roster,
    (SELECT COUNT(*) FROM demo_offers WHERE price_vnd >= regular) AS invalid_offer_price
"""

INVARIANTS = (
    "overlapping_slots",
    "overlapping_bookings",
    "booking_snapshot_mismatch",
    "claims_or_contiguity_mismatch",
    "invalid_room_roster",
    "invalid_offer_price",
)


def verify_catalog(session: Session, court_ids: list[UUID]) -> dict:
    row = dict(session.execute(text(REPORT), {"ids": court_ids}).mappings().one())
    violations = {name: row.pop(name) for name in INVARIANTS}
    return {
        **row,
        "closed_rooms": row["rooms"] - row["open_rooms"] - row["full_rooms"],
        "violations": {name: count for name, count in violations.items() if count},
    }
