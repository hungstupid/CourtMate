import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from firebase_admin import auth

from app.core import auth as identity


@pytest.mark.parametrize(
    "error",
    [
        ValueError("invalid"),
        auth.InvalidIdTokenError("invalid"),
        auth.ExpiredIdTokenError("expired", None),
        auth.RevokedIdTokenError("revoked"),
        auth.UserDisabledError("disabled"),
        auth.UserNotFoundError("deleted"),
    ],
)
def test_invalid_identities_are_unauthorized(monkeypatch, error):
    monkeypatch.setattr(identity, "firebase_app", lambda: object())

    def verify(*args, **kwargs):
        assert kwargs["check_revoked"] is True
        raise error

    monkeypatch.setattr(auth, "verify_id_token", verify)
    with pytest.raises(HTTPException) as result:
        identity.verified_identity(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials="unit-test-only")
        )
    assert result.value.status_code == 401


def test_provider_failure_is_unavailable(monkeypatch):
    monkeypatch.setattr(identity, "firebase_app", lambda: object())

    def verify(*args, **kwargs):
        raise auth.CertificateFetchError("temporary network failure", None)

    monkeypatch.setattr(auth, "verify_id_token", verify)
    with pytest.raises(HTTPException) as result:
        identity.verified_identity(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials="unit-test-only")
        )
    assert result.value.status_code == 503
