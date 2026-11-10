"""Prepare one disposable local k6 fixture through real Firebase/API requests."""

import json
import os
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src/backend"))
from app.scripts.reset_test import ensure_test_database


def main():
    ensure_test_database()
    marker = "e2e-" + uuid.uuid4().hex
    base = os.environ.get("BENCH_API_URL", "http://localhost:8017")
    if not base.startswith(("http://localhost:", "http://127.0.0.1:")):
        raise SystemExit("Local API only.")
    tokens = []
    with (
        httpx.Client(base_url=base, timeout=20) as api,
        httpx.Client(base_url="http://127.0.0.1:9099", timeout=20) as emulator,
    ):
        assert api.get("/health").json()["service"] == "courtmate-api"
        for index in range(31):
            signup = emulator.post(
                "/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
                json={
                    "email": f"{marker}-bench-{index}@courtmate.test",
                    "password": uuid.uuid4().hex,
                    "returnSecureToken": True,
                },
            )
            assert signup.status_code == 200
            token = signup.json()["idToken"]
            assert (
                api.post(
                    "/api/register",
                    headers={"Authorization": f"Bearer {token}"},
                    json={"role": "owner" if index == 0 else "player"},
                ).status_code
                == 201
            )
            tokens.append(token)
        owner = {"Authorization": f"Bearer {tokens[0]}"}
        created = api.post(
            "/api/owner/courts",
            headers=owner,
            json={
                "name": f"Benchmark {marker}",
                "sport": "Cầu lông",
                "address": "Local benchmark only",
                "area": marker,
                "description": "Disposable NFR fixture",
                "base_price_vnd": 120000,
                "max_players": 8,
            },
        )
        assert created.status_code == 201
        court = created.json()["id"]
        assert (
            api.put(
                f"/api/owner/courts/{court}/hours",
                headers=owner,
                json={
                    "windows": [
                        {"weekday": i, "opens_minute": 0, "closes_minute": 1440}
                        for i in range(7)
                    ]
                },
            ).status_code
            == 200
        )
        start = (datetime.now(UTC) + timedelta(days=2)).replace(
            hour=1, minute=0, second=0, microsecond=0
        )
        result = api.post(
            f"/api/owner/courts/{court}/slots/batch",
            headers=owner,
            json={
                "slots": [
                    {
                        "start_at": (start + timedelta(hours=i)).isoformat(),
                        "end_at": (start + timedelta(hours=i + 1)).isoformat(),
                        "price_vnd": 120000,
                    }
                    for i in range(8)
                ]
            },
        )
        assert result.status_code == 201
        fixture = {
            "marker": marker,
            "court": court,
            "date": start.date().isoformat(),
            "slots": [row["id"] for row in result.json()],
            "tokens": tokens[1:],
        }
    path = Path("/tmp/courtmate-nfr-fixture.json")
    path.write_text(json.dumps(fixture))
    path.chmod(0o600)
    Path("/tmp/courtmate-nfr-marker.txt").write_text(marker)
    print(
        "Prepared 30 Players, 1 Owner, 1 court and 8 slots in the guarded local "
        "test database; credentials not logged."
    )


if __name__ == "__main__":
    main()
