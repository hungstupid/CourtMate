from functools import lru_cache
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy.engine import Connection


@lru_cache
def required_heads() -> frozenset[str]:
    migrations = Path(__file__).resolve().parents[2] / "migrations"
    return frozenset(ScriptDirectory(str(migrations)).get_heads())


def check_schema(connection: Connection) -> None:
    expected = required_heads()
    current = frozenset(MigrationContext.configure(connection).get_current_heads())
    if not expected or current != expected:
        raise RuntimeError(
            "Database revision does not match this application's migration heads."
        )
