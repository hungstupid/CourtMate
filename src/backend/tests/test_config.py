from pathlib import Path

import pytest

from app.core.config import get_cors_origins


def test_custom_origins(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", " http://localhost:6000/,http://127.0.0.1:6000 ")
    assert get_cors_origins() == ["http://localhost:6000", "http://127.0.0.1:6000"]


def test_reject_wildcard(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "*")
    with pytest.raises(ValueError, match="explicit origins"):
        get_cors_origins()


def test_dotenv_loading(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    from app.core import config

    fake_module = tmp_path / "app" / "core" / "config.py"
    fake_module.parent.mkdir(parents=True)
    (tmp_path / ".env").write_text("CORS_ORIGINS=http://localhost:7000\n")
    monkeypatch.setattr(config, "__file__", str(fake_module))
    # Register the original environment value before dotenv mutates os.environ.
    monkeypatch.setenv("CORS_ORIGINS", "")
    monkeypatch.delenv("CORS_ORIGINS")
    assert get_cors_origins() == ["http://localhost:7000"]
