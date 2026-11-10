#!/usr/bin/env bash
set -euo pipefail
cd src/backend
uv run pytest
uv run python -c 'import os; from app.scripts.reset_test import ensure_test_database; from app.core.settings import get_settings; url=ensure_test_database(); os.environ["DATABASE_URL"]=url; os.environ["MIGRATION_DATABASE_URL"]=url; get_settings.cache_clear(); import uvicorn; uvicorn.run("app.main:app", host="127.0.0.1", port=8000)' > /tmp/courtmate-api-ci.log 2>&1 &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true' EXIT
for attempt in {1..30}; do
  if curl --fail --silent http://localhost:8000/ready > /dev/null; then break; fi
  sleep 1
done
curl --fail --silent http://localhost:8000/ready
uv run python -m app.scripts.load_smoke
cd ../frontend
npm run test:e2e
