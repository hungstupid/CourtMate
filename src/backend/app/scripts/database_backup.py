"""Export through pg_dump; restore only to an explicitly isolated local test DB."""

import argparse
import os
import subprocess
from pathlib import Path

from sqlalchemy.engine import make_url

from app.core.database_urls import local_host
from app.core.settings import get_settings
from app.scripts.reset_test import ensure_test_database

REPO_ROOT = Path(__file__).resolve().parents[4]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["export", "restore-test"])
    parser.add_argument("--file", type=Path, default=Path(".secrets/demo.dump"))
    args = parser.parse_args()
    settings = get_settings()
    value = (
        (
            settings.migration_database_url.get_secret_value()
            or settings.database_url.get_secret_value()
        )
        if args.action == "export"
        else ensure_test_database()
    )
    url = make_url(value)
    # Use env vars, not credentials in process arguments or output.
    env = dict(
        os.environ,
        PGHOST=url.host or "localhost",
        PGPORT=str(url.port or 5432),
        PGUSER=url.username or "",
        PGPASSWORD=url.password or "",
        PGDATABASE=url.database or "",
        PGSSLMODE=str(url.query.get("sslmode", "prefer")),
    )
    args.file.parent.mkdir(parents=True, exist_ok=True)
    if local_host(url.host or ""):
        # Docker exec targets this Compose server. Never silently redirect a
        # guarded destination on another port into the Compose runtime server.
        from dotenv import dotenv_values

        compose_env = dotenv_values(REPO_ROOT / ".env")
        compose_port = int(
            os.getenv("POSTGRES_PORT") or compose_env.get("POSTGRES_PORT") or 5433
        )
        if (url.port or 5432) != compose_port:
            raise SystemExit(
                "Local backup/restore URL must target this Compose server port."
            )
        env.update(PGHOST="127.0.0.1", PGPORT="5432")
    command = ["docker", "compose", "exec", "-T"]
    for key in ("PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSSLMODE"):
        command.extend(["-e", key])
    command.append("db")
    if args.action == "export":
        descriptor = os.open(args.file, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(descriptor, "wb") as output:
            result = subprocess.run(
                [*command, "pg_dump", "--format=custom", "--no-owner", "--no-acl"],
                env=env,
                cwd=REPO_ROOT,
                stdout=output,
                stderr=subprocess.PIPE,
            )
        args.file.chmod(0o600)
    else:
        with args.file.open("rb") as source:
            result = subprocess.run(
                [
                    *command,
                    "pg_restore",
                    "--clean",
                    "--if-exists",
                    "--no-owner",
                    "--no-acl",
                    "--dbname",
                    url.database or "",
                ],
                env=env,
                cwd=REPO_ROOT,
                stdin=source,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )
    if result.returncode:
        raise SystemExit(
            "Database tool failed. Check pg_dump/pg_restore, direct connection "
            "and server version. No credentials logged."
        )
    print(f"{args.action}: PASS (credential values not logged).")


if __name__ == "__main__":
    main()
