"""Upgrade only disposable schemas in the already guarded local test database."""

import uuid

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text


@pytest.mark.parametrize("populated_identity", [False, True])
def test_business_upgrade_from_empty_or_populated_identity(
    database_engine, populated_identity
):
    schema = "migration_test_" + uuid.uuid4().hex
    marker_id = uuid.uuid4()
    marker_uid = "migration-preserved-" + uuid.uuid4().hex
    config = Config("alembic.ini")
    head = ScriptDirectory.from_config(config).get_current_head()
    with database_engine.connect() as connection:
        quoted = connection.dialect.identifier_preparer.quote(schema)
        connection.exec_driver_sql(f"CREATE SCHEMA {quoted}")
        connection.commit()
        try:
            # Do not include public: its alembic_version could hide an empty schema.
            connection.exec_driver_sql(f"SET search_path TO {quoted}")
            connection.commit()
            config.attributes["connection"] = connection
            if populated_identity:
                command.upgrade(config, "0001_identity")
                connection.execute(
                    text(
                        "INSERT INTO users (id, firebase_uid, role) "
                        "VALUES (:id, :uid, 'owner')"
                    ),
                    {"id": marker_id, "uid": marker_uid},
                )
                connection.commit()
            command.upgrade(config, "head")
            command.upgrade(config, "head")
            assert (
                connection.scalar(text("SELECT version_num FROM alembic_version"))
                == head
            )
            tables = set(inspect(connection).get_table_names(schema=schema))
            assert {
                "users",
                "courts",
                "operating_hours",
                "slots",
                "maintenance_blocks",
                "bookings",
                "booking_slots",
                "slot_claims",
                "rooms",
                "room_members",
            } <= tables
            if populated_identity:
                assert connection.execute(
                    text("SELECT id, role FROM users WHERE firebase_uid=:uid"),
                    {"uid": marker_uid},
                ).one() == (marker_id, "owner")
            else:
                assert connection.scalar(text("SELECT COUNT(*) FROM users")) == 0
        finally:
            connection.rollback()
            connection.exec_driver_sql("SET search_path TO public")
            connection.commit()
            # The schema name was generated here; no runtime/demo schema is touched.
            connection.exec_driver_sql(f"DROP SCHEMA {quoted} CASCADE")
            connection.commit()


@pytest.mark.parametrize("reason", ["ORGANIZER_CLOSED", None])
def test_pa3_upgrade_preserves_legacy_room_and_slot_or_blocks_ambiguity(
    database_engine, reason
):
    config = Config("alembic.ini")
    schema = "migration_test_" + uuid.uuid4().hex
    with database_engine.connect() as connection:
        connection.exec_driver_sql(f"CREATE SCHEMA {schema}")
        connection.exec_driver_sql(f"SET search_path TO {schema}")
        connection.commit()
        config.attributes["connection"] = connection
        try:
            old_head = "0006_room_closure_reason"
            command.upgrade(config, old_head)
            connection.execute(
                text(
                    """
                    INSERT INTO users(id,firebase_uid,role)
                    VALUES ('00000000-0000-0000-0000-000000000001','legacy','player');
                    INSERT INTO courts(id,owner_id,name,sport,address,area,description,
                                       base_price_vnd,max_players)
                    SELECT id,id,'Legacy court','Tennis','Address','Area','Court',
                           100000,8 FROM users;
                    INSERT INTO slots(id,court_id,playing_date,start_at,end_at,
                                      price_vnd)
                    SELECT id,id,'2035-01-01','2035-01-01 23:00+07',
                           '2035-01-02 00:00+07',100000 FROM courts;
                    INSERT INTO bookings(id,court_id,player_id,start_at,end_at,
                                         total_price_vnd)
                    SELECT id,court_id,court_id,start_at,end_at,price_vnd FROM slots;
                    INSERT INTO booking_slots(booking_id,slot_id,position,start_at,
                                              end_at,price_vnd,slot_version)
                    SELECT id,id,0,start_at,end_at,price_vnd,version FROM slots;
                    INSERT INTO slot_claims(slot_id,booking_id) SELECT id,id FROM slots;
                    """
                )
            )
            connection.execute(
                text(
                    "INSERT INTO rooms(id,booking_id,organizer_id,capacity,closed,"
                    "closed_reason) SELECT id,id,player_id,8,true,:reason FROM bookings"
                ),
                {"reason": reason},
            )
            connection.execute(
                text(
                    "INSERT INTO room_members(room_id,player_id) "
                    "SELECT id,id FROM rooms"
                )
            )
            connection.commit()
            if reason is None:
                with pytest.raises(RuntimeError, match="ambiguous or invalid"):
                    command.upgrade(config, "head")
                connection.rollback()
                assert (
                    connection.scalar(text("SELECT version_num FROM alembic_version"))
                    == old_head
                )
                assert connection.execute(
                    text("SELECT closed,closed_reason FROM rooms")
                ).one() == (True, None)
                assert connection.scalar(text("SELECT count(*) FROM slot_claims")) == 1
                return

            command.upgrade(config, "head")
            columns = inspect(connection)
            assert "playing_date" not in {
                r["name"] for r in columns.get_columns("slots")
            }
            assert "closed" not in {r["name"] for r in columns.get_columns("rooms")}
            assert connection.scalar(text("SELECT closed_reason FROM rooms")) == reason
            assert connection.scalar(text("SELECT count(*) FROM room_members")) == 1
            assert connection.scalar(text("SELECT count(*) FROM slot_claims")) == 1
            assert (
                connection.scalar(text("SELECT price_vnd FROM booking_slots"))
                == 100_000
            )
            connection.commit()
            command.downgrade(config, old_head)
            assert (
                connection.scalar(text("SELECT CAST(playing_date AS text) FROM slots"))
                == "2035-01-01"
            )
            assert connection.scalar(text("SELECT closed FROM rooms")) is True
            connection.commit()
            command.upgrade(config, "head")
        finally:
            connection.rollback()
            connection.exec_driver_sql("SET search_path TO public")
            connection.exec_driver_sql(f"DROP SCHEMA {schema} CASCADE")
            connection.commit()
