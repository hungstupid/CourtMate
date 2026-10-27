"""Generate local-only configuration without replacing any existing file."""

import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
password = secrets.token_urlsafe(24)
root_env = root / ".env"
if root_env.exists():
    values = dict(
        line.split("=", 1)
        for line in root_env.read_text().splitlines()
        if "=" in line and not line.startswith("#")
    )
    password = values.get("POSTGRES_PASSWORD", "")
    if not password:
        raise SystemExit("Existing root .env needs POSTGRES_PASSWORD; nothing overwritten.")
    port = values.get("POSTGRES_PORT", "5433")
else:
    port = "5433"
    root_env.write_text(f"POSTGRES_PASSWORD={password}\nPOSTGRES_PORT={port}\n")
    root_env.chmod(0o600)

files = {
    root / "src/backend/.env": (
        f"DATABASE_URL=postgresql+psycopg://courtmate:{password}@127.0.0.1:{port}/courtmate\n"
        f"MIGRATION_DATABASE_URL=postgresql+psycopg://courtmate:{password}@127.0.0.1:{port}/courtmate\n"
        f"TEST_DATABASE_URL=postgresql+psycopg://courtmate:{password}@127.0.0.1:{port}/courtmate_test\n"
        "APP_ENV=local\nFIREBASE_PROJECT_ID=demo-courtmate\n"
        "FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099\n"
        "CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173\n"
    ),
    root / "src/frontend/.env": (
        "VITE_API_BASE_URL=http://localhost:8000\n"
        "VITE_FIREBASE_PROJECT_ID=demo-courtmate\n"
        "VITE_FIREBASE_API_KEY=demo-key\n"
        "VITE_FIREBASE_AUTH_DOMAIN=demo-courtmate.firebaseapp.com\n"
        "VITE_FIREBASE_APP_ID=demo-courtmate-web\n"
        "VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099\n"
    ),
}
for path, content in files.items():
    if path.exists():
        existing = path.read_text()
        keys = {line.split("=", 1)[0] for line in existing.splitlines() if "=" in line}
        missing = [line for line in content.splitlines() if line.split("=", 1)[0] not in keys]
        if missing:
            path.write_text(existing.rstrip() + "\n" + "\n".join(missing) + "\n")
        path.chmod(0o600)
        print(f"Preserved existing values; added {len(missing)} missing local keys to {path.relative_to(root)}.")
    else:
        path.write_text(content)
        path.chmod(0o600)
        print(f"Created {path.relative_to(root)} with local configuration (values not logged).")
