.PHONY: setup db-up db-stop dev-api dev-web auth-emulator migrate seed test test-api test-web e2e a11y load export-demo restore-test reset-test
setup:
	python3 scripts/setup_local.py
	cd src/backend && uv sync --locked
	cd src/frontend && npm ci
db-up:
	docker compose up -d --wait db
db-stop:
	docker compose stop db
auth-emulator:
	env -u DEBUG firebase emulators:start --only auth --project demo-courtmate
dev-api:
	cd src/backend && uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
dev-web:
	cd src/frontend && npm run dev
migrate:
	cd src/backend && uv run alembic upgrade head
seed:
	cd src/backend && uv run python -m app.scripts.seed
test: test-api test-web
test-api:
	cd src/backend && uv run ruff check . && uv run ruff format --check . && uv run pytest
test-web:
	cd src/frontend && npm run lint && npm run typecheck && npm run build
e2e:
	cd src/frontend && npm run test:e2e
a11y:
	cd src/frontend && npm run test:a11y
load:
	cd src/backend && uv run python -m app.scripts.load_smoke
export-demo:
	cd src/backend && uv run python -m app.scripts.database_backup export
restore-test:
	cd src/backend && uv run python -m app.scripts.database_backup restore-test
reset-test:
	cd src/backend && uv run python -m app.scripts.reset_test
