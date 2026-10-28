"""Parse database destinations without exposing connection credentials."""

import ipaddress

from sqlalchemy.engine import URL, make_url


def postgres_url(value: str, label: str = "Database URL") -> URL:
    try:
        url = make_url(value)
        if url.drivername not in {"postgresql", "postgresql+psycopg"}:
            raise ValueError
        if not url.host or not url.database or not url.username:
            raise ValueError
        if not 1 <= (5432 if url.port is None else url.port) <= 65535:
            raise ValueError
        # libpq query parameters must not silently override the parsed destination.
        if {key.lower() for key in url.query} & {
            "host",
            "hostaddr",
            "port",
            "dbname",
            "database",
            "service",
            "servicefile",
        }:
            raise ValueError
        if any(char in url.host for char in (",", "/", " ", "\\")):
            raise ValueError
        return url
    except Exception:
        raise RuntimeError(f"{label} must be a valid PostgreSQL URL.") from None


def local_host(host: str) -> bool:
    if host.lower().rstrip(".") == "localhost":
        return True
    try:
        address = ipaddress.ip_address(host)
        if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
            address = address.ipv4_mapped
        return address.is_loopback
    except ValueError:
        return False


def destination(url: URL) -> tuple[str, int, str]:
    host = (url.host or "").lower().rstrip(".")
    if local_host(host):
        host = "loopback"
    elif host.endswith(".neon.tech"):
        # A Neon endpoint's pooled and direct hostnames reach the same database.
        host = host.replace("-pooler.", ".")
    return host, url.port or 5432, url.database or ""


def migration_url(runtime: str, migration: str) -> str:
    runtime_url = postgres_url(runtime, "DATABASE_URL")
    url = postgres_url(migration or runtime, "MIGRATION_DATABASE_URL")
    if "-pooler." in (url.host or ""):
        raise RuntimeError("Migrations require a direct PostgreSQL connection.")
    if destination(runtime_url) != destination(url):
        raise RuntimeError("Runtime and migration URLs must target the same database.")
    return url.set(drivername="postgresql+psycopg").render_as_string(
        hide_password=False
    )
