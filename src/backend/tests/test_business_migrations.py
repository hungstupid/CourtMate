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
