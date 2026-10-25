# Frontend

Holds CourtMate's **browser application code**: pages, UI components, assets and frontend tests. The development bootstrap uses React + TypeScript + Vite. Business features remain outside this bootstrap.

The commands below have been verified locally. The development page checks the real backend `/health` endpoint and shows connecting, connected or error states, with a retry button.

**Not for:** PA PDFs, requirements/design/test reports, contributor logs or secrets. The official assignment documentation is submitted within `pa/PAx/`; team work is tracked with GitHub Issues/Projects.

Use a feature branch and Pull Request for changes.

## Requirements and setup

Use **Node.js 24.x** and npm. `.nvmrc` selects Node 24 for members using nvm. Commit `package-lock.json`; use `npm ci` for reproducible installs.

From the repository root:

```bash
cd src/frontend
npm ci
cp .env.example .env
npm run dev
```

Open **http://localhost:5173**. The server uses a strict port: if 5173 is occupied, stop the relevant server or choose another port and update backend CORS explicitly. Start the backend in a separate terminal using [its guide](../backend/README.md). Stop your server with Ctrl+C.

## Configuration

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

Copy `.env.example` only for initial setup; keep existing local values when updating the project. The same URL is used by default if the variable is absent or empty. Restart Vite after changing `.env`. API configuration lives in `src/lib/api.ts`; `/health` requests time out after eight seconds.

`VITE_*` values are public and can enter the browser bundle. Never put passwords, tokens or Firebase Admin credentials there. Local `.env` files are ignored; `.env.example` is tracked and contains no credentials.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run build
npm run preview
```

`typecheck` runs TypeScript project checks with strict settings. `lint` runs ESLint and the React Hooks rules. `build` checks types and produces `dist/`; `preview` serves that build at **http://localhost:4173**. To check the API from preview, add `http://localhost:4173` to the backend's `CORS_ORIGINS` and restart the backend. `dist/` and `node_modules/` are ignored.

No frontend unit-test runner is installed in this bootstrap. Integration was checked with real HTTP requests and Chrome; loading, successful connection, backend unavailable and retry behavior were exercised.

## Source layout

| Path | Purpose |
| --- | --- |
| `src/main.tsx` | React entry point |
| `src/app/` | Application composition and base styles |
| `src/pages/` | Development landing page |
| `src/components/` | Backend connection status and retry UI |
| `src/lib/` | Shared API URL and health request |
| `src/assets/` | CourtMate favicon |

Add `src/features/` when the first approved business feature is implemented in PA5. No feature placeholders or mock business data are included.
