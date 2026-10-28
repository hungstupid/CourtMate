import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "courtmate-api"}


def test_local_frontend_cors() -> None:
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_preflight() -> None:
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_unlisted_origin_is_not_allowed() -> None:
    response = client.get("/health", headers={"Origin": "https://unlisted.example"})
    assert "access-control-allow-origin" not in response.headers


def test_openapi_documents_health() -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    assert "/health" in response.json()["paths"]
    assert client.get("/docs").status_code == 200


@pytest.mark.parametrize("method", ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
def test_mutation_preflights(method):
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": method,
        "Access-Control-Request-Headers": "authorization,content-type",
    }
    response = client.options("/api/me", headers=headers)
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == headers["Origin"]
    headers["Origin"] = "https://unlisted.example"
    response = client.options("/api/me", headers=headers)
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
