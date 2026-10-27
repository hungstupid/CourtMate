# CourtMate bootstrap — kết quả nghiệm thu

Ngày thực hiện ban đầu: **24/10/2026**, múi giờ Asia/Ho_Chi_Minh. Mục 1–8 dưới đây lưu bằng chứng lịch sử của bootstrap React/Vite + FastAPI. Xem phần cập nhật ngày 27/10 ở cuối file cho trạng thái database/Auth/CI/deployment hiện tại; không dùng kết quả lịch sử để suy ra các tích hợp mới đã READY.

Quy ước: **PASS** = đã chạy kiểm tra thành công; **FIXED** = phát hiện và sửa; **BLOCKED** = chưa hoàn thành; **SKIPPED** = không cần trong phạm vi này. Không còn blocker cho bootstrap.

## 1. System environment

Phiên bản “trước” lấy từ audit đầu phiên, không lấy từ snapshot trong yêu cầu. “Không đo riêng” nghĩa là chưa lấy phiên bản trước thay đổi; không suy đoán.

| Tool / kiểm tra | Trước | Sau | Trạng thái | Lệnh kiểm tra |
| --- | --- | --- | --- | --- |
| CPU | arm64 | arm64, Apple Silicon | PASS | `uname -m` |
| macOS | 14.6.1 (23G93) | Không đổi | PASS | `sw_vers` |
| Shell | zsh; chưa đo phiên bản | zsh 5.9 | PASS | `zsh --version` |
| PATH / Node manager | Node/npm từ nvm v24.18.0 | Không đổi; các entry lặp không trỏ sang Node khác | PASS | `type -a node npm python3` |
| Xcode CLT | `/Library/Developer/CommandLineTools`; chưa đo phiên bản | 16.2.0.0.1.1733547573 | PASS | `xcode-select -p`; `pkgutil --pkg-info=com.apple.pkg.CLTools_Executables` |
| Homebrew | 7.0.10 | 7.0.10 | PASS | `brew --version` |
| Git | 2.39.5 (Apple Git-154) | Không đổi | PASS | `git --version` |
| Git identity | Đã cấu hình tên và email | Giữ nguyên | PASS | `git config user.name`; `git config user.email` |
| GitHub CLI | 2.103.2; chưa đăng nhập | 2.103.2; đăng nhập `hungstupid`, HTTPS, keyring | FIXED | `gh --version`; `gh auth status` |
| GitHub repo access | Git đọc được public remote | `viewerPermission=ADMIN`, default branch `main` | PASS | `gh repo view hungstupid/CourtMate --json nameWithOwner,defaultBranchRef,viewerPermission` |
| Node.js | 24.18.0 qua nvm | Không đổi | PASS | `node --version` |
| npm | 11.16.0 | Không đổi | PASS | `npm --version` |
| Python hệ thống | 3.14.0 | 3.14.0, không thay thế | PASS | `python3 --version` |
| uv | Chưa có | 0.13.5 tại `~/.local/bin/uv` | FIXED | `uv --version`; `command -v uv` |
| Python dự án | Chưa có runtime uv được chuẩn hóa | CPython 3.12.15 qua uv | FIXED | `uv python install 3.12`; `uv python find 3.12`; `uv run python --version` |
| Docker CLI | 29.4.3 | Không đổi | PASS | `docker --version` |
| Docker Compose | 5.1.4 | Không đổi | PASS | `docker compose version` |
| Docker Desktop / daemon | App có sẵn; daemon không kết nối được | Server 29.4.3, `desktop-linux`, aarch64 | FIXED | `open -a Docker`; `docker context ls`; `docker info` |
| VS Code CLI | 1.136.1 arm64 | Không đổi | PASS | `code --version` |
| VS Code extensions | Python, Pylance, Prettier có sẵn; Ruff/ESLint/Docker thiếu | Ruff 2026.90.0, ESLint 3.0.34, Docker 2.0.0 đã thêm | FIXED | `code --list-extensions --show-versions` |
| PostgreSQL container | Chưa tạo trong nhiệm vụ | Không tạo | SKIPPED | Ngoài phạm vi bootstrap |

Đã thử `brew install uv`. Homebrew trên macOS 14 yêu cầu build từ source cùng nhiều dependency, nên đã dừng đúng tiến trình cài do phiên này tạo trước khi tiếp tục build toàn bộ toolchain. Sau đó dùng [standalone installer chính thức của uv](https://docs.astral.sh/uv/getting-started/installation/) với `UV_NO_MODIFY_PATH=1`; PATH đã có `~/.local/bin`, không cần sửa shell profile. Không cài lại gh, Node, Git, VS Code hoặc Docker. Không dùng global pip, không thay thế Python 3.14, không xóa container/volume/image của dự án khác.

## 2. Repository

- Local: `/Users/nguyenduchung/CourtMate`.
- Remote: `https://github.com/hungstupid/CourtMate.git`.
- Working tree ban đầu sạch, branch `main`.
- Đã `git fetch origin`, kiểm tra remote HEAD và fast-forward an toàn; kết quả `Already up to date`.
- Base: `main` tại `36f4e30263d2f69e8f7e599fe0bc09abe2ddd2fa`.
- Working branch: `chore/project-bootstrap`.
- `main` vẫn ở nguyên commit trên. Không có nested Git repository.
- Kết quả đợt 24/10: **31 file mới, 3 file tracked được sửa**, đã commit `b7a393b38f4ce7165244656e7354685a9991797b` và push lên `origin/chore/project-bootstrap` theo yêu cầu tiếp theo của chủ repo. Không merge vào main.
- `CONTRIBUTING.md` tiếp tục là nguồn quy ước branch/commit/review. Không tạo quy trình quản trị trùng lặp.
- Root README, workflow, toàn bộ tài liệu PA và báo cáo nhóm được bảo toàn. Danh sách chính xác ở mục 6.

## 3. Frontend

Khởi tạo từ official `create-vite@9.3.1`, template `react-ts`, trong vùng scaffold tạm; chỉ chuyển các cấu hình cần thiết vào `src/frontend/`. Nội dung README hữu ích được giữ và cập nhật với lệnh đã kiểm chứng. Tham khảo [Vite Getting Started](https://vite.dev/guide/).

Dependency trực tiếp đã resolve:

| Nhóm | Packages |
| --- | --- |
| Runtime | `react@19.3.1`, `react-dom@19.3.1` |
| Build/types | `vite@8.3.5`, `@vitejs/plugin-react@6.1.2`, `typescript@6.0.3`, `@types/node@24.19.2`, `@types/react@19.3.0`, `@types/react-dom@19.3.0` |
| Lint | `eslint@10.13.0`, `@eslint/js@10.0.1`, `typescript-eslint@8.72.0`, `globals@17.13.0`, `eslint-plugin-react-hooks@7.1.1`, `eslint-plugin-react-refresh@0.5.7` |

Scripts: `dev`, `build`, `lint`, `typecheck`, `preview`. TypeScript strict bật cho cả application và Vite config. Có `.nvmrc` chọn Node 24, `engines` giới hạn Node 24.x và `package-lock.json`.

Trang CourtMate hiển thị development environment, loading, connected, error và retry. API URL tập trung tại `src/lib/api.ts`, lấy `VITE_API_BASE_URL` hoặc mặc định `http://localhost:8000`. Chỉ hiển thị Connected sau khi nhận HTTP thành công cùng JSON health đúng; request timeout sau 8 giây và được hủy khi unmount.

Cấu trúc thực tế: `src/app/`, `src/components/`, `src/pages/`, `src/lib/`, `src/assets/`. `src/features/` được dành cho feature thật ở PA5, không thêm file rỗng hoặc business mock data.

| Kiểm tra đã chạy | Kết quả |
| --- | --- |
| `npm ci` | PASS; lockfile cài được, audit 0 vulnerabilities tại thời điểm chạy |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, max warnings 0 |
| `npm run build` | PASS; sinh production assets và favicon |
| `npm run dev` | PASS; http://localhost:5173 trả HTTP 200 |
| `npm run preview -- --port 4173 --strictPort` | PASS; http://localhost:4173 trả HTTP 200 |
| Chrome loading / connected / mobile | PASS; 375px không overflow ngang |
| Chrome khi backend dừng và thử lại | PASS; error rõ ràng, React không crash |

Không cài frontend unit-test framework hoặc formatter bổ sung; ESLint và kiểm tra trình duyệt đủ cho phạm vi bootstrap. Prettier extension có sẵn được đề xuất trong repo. Browser smoke dùng Playwright cài riêng trong thư mục tạm, không thêm dependency vào sản phẩm.

## 4. Backend

Python **3.12.15**, `.python-version=3.12`, `requires-python >=3.12,<3.13`. Dependencies được thêm bằng `uv add` / `uv add --dev`; môi trường riêng `.venv/`, lockfile `uv.lock`.

| Nhóm | Packages trực tiếp đã resolve |
| --- | --- |
| Runtime | `fastapi@0.162.0`, `uvicorn@0.54.0`, `python-dotenv@1.2.4` |
| Development | `pytest@9.1.1`, `httpx@0.28.1`, `ruff@0.17.2` |

`app/main.py` có metadata, middleware và health router. `app/api/health.py` khai báo response model. `app/core/config.py` đọc đúng `src/backend/.env` và tôn trọng biến môi trường đã export. CORS mặc định chỉ cho `http://localhost:5173` và `http://127.0.0.1:5173`, có thể mở rộng bằng `CORS_ORIGINS`; wildcard bị từ chối. Không bật credentials hoặc thêm business endpoint. Cấu hình theo [hướng dẫn CORS của FastAPI](https://fastapi.tiangolo.com/tutorial/cors/).

| Kiểm tra đã chạy | Kết quả |
| --- | --- |
| `uv sync` và `uv sync --locked` | PASS |
| `uv lock --check` | PASS |
| `uv run pytest` | **8 passed**, một deprecation warning của thư viện |
| `uv run ruff check .` | PASS |
| `uv run ruff format --check .` | PASS; 9 Python files |
| Import `app.main:app` | PASS |
| Uvicorn `--reload --host 127.0.0.1 --port 8000` | PASS; startup hoàn tất |
| HTTP `GET /health` | **200** |
| HTTP `/docs` và TestClient `/openapi.json` | **200** |

Response thật từ http://localhost:8000/health:

```json
{"status":"ok","service":"courtmate-api"}
```

Docs: http://localhost:8000/docs. Tests không cần database hoặc credentials; bao phủ health, OpenAPI/docs, CORS preflight và origins, custom config, từ chối wildcard và đọc `.env`.

## 5. Integration và reproducibility

- HTTP thật từ frontend và backend thành công. Response health có `Access-Control-Allow-Origin: http://localhost:5173`.
- Chrome headless dùng Google Chrome đã có trên máy. Đã trì hoãn health request để quan sát loading, sau đó cho request tiếp tục tới backend thật và xác nhận UI Connected cùng HTTP 200. Không mock response thành công.
- Khi backend bị dừng thật, trình duyệt ghi nhận `ERR_CONNECTION_REFUSED`; UI hiện Connection error và Retry. Không có uncaught JavaScript error.
- Kiểm tra retry recovery riêng: chủ động abort request đầu trong browser, sau đó cho request sau Retry tới backend thật; UI chuyển sang Connected với HTTP 200.
- Luồng Connected không có console error. Các request `ERR_ABORTED` trong development đến từ cleanup/React StrictMode; khi cố ý làm backend unavailable có console/network error tương ứng như mong đợi.
- Đã kiểm tra desktop 1280px và mobile 375px, xem ảnh chụp kết quả.
- Đã sao chép source sang thư mục tạm, loại `.env`, `node_modules`, `.venv`, build outputs và caches; chạy lại `npm ci`, typecheck, lint, build và `uv sync --locked`, pytest, Ruff. **Tất cả PASS**, chứng minh bootstrap không phụ thuộc local `.env` hoặc môi trường cài sẵn. Đây là source copy sạch, không phải clone mới từ remote vì thay đổi chưa push.
- Logic kiểm tra của workflow `.github/workflows/repo-check.yml` đã được chạy local: **20 guides found; no common secret filenames tracked**. Không tuyên bố đã chạy GitHub-hosted CI.
- Đã dừng đúng các phiên Uvicorn, Vite dev và preview do mình tạo. Xác minh cả IPv4/IPv6 không còn listener trên 8000, 5173, 4173. Docker Desktop tiếp tục chạy để dùng về sau.

Bằng chứng tạm, không đưa vào commit: `/private/tmp/courtmate-loading.png`, `/private/tmp/courtmate-connected.png`, `/private/tmp/courtmate-mobile.png`, `/private/tmp/courtmate-error.png`; browser result JSON và script trong `/private/tmp/courtmate-browser-check/` cùng các file `/private/tmp/courtmate-*-result.json`. Những artifact này có thể bị hệ điều hành dọn.

Chưa chạy deploy, CI trên GitHub, PostgreSQL integration hoặc test business features vì nằm ngoài phạm vi và chưa triển khai. Không còn test nghiệm thu bootstrap bắt buộc chưa chạy.

## 6. Files changed

### Created — 31 files

```text
.vscode/extensions.json
docs/development/bootstrap-report.md
src/backend/.env.example
src/backend/.python-version
src/backend/app/__init__.py
src/backend/app/api/__init__.py
src/backend/app/api/health.py
src/backend/app/core/__init__.py
src/backend/app/core/config.py
src/backend/app/main.py
src/backend/pyproject.toml
src/backend/tests/test_config.py
src/backend/tests/test_health.py
src/backend/uv.lock
src/frontend/.env.example
src/frontend/.nvmrc
src/frontend/eslint.config.js
src/frontend/index.html
src/frontend/package-lock.json
src/frontend/package.json
src/frontend/src/app/App.tsx
src/frontend/src/app/styles.css
src/frontend/src/assets/courtmate.svg
src/frontend/src/components/BackendStatus.tsx
src/frontend/src/lib/api.ts
src/frontend/src/main.tsx
src/frontend/src/pages/DevelopmentPage.tsx
src/frontend/tsconfig.app.json
src/frontend/tsconfig.json
src/frontend/tsconfig.node.json
src/frontend/vite.config.ts
```

### Modified — 3 files

- `.gitignore`: thêm tên private keys `id_rsa`, `id_ed25519`; các ignore hiện có đủ cho `.env`, dependencies, caches, coverage, build outputs và logs. Không ignore hai lockfiles hoặc `.env.example`.
- `src/frontend/README.md`: cập nhật trạng thái bootstrap, giữ phạm vi sử dụng/contribution, thêm setup/config/checks/layout đã xác minh.
- `src/backend/README.md`: giữ cảnh báo về quy tắc nghiệp vụ và tài liệu, thêm setup/config/checks/layout đã xác minh.

### Preserved — toàn bộ 38 tracked files còn lại

```text
.github/ISSUE_TEMPLATE/bug_report.yml
.github/ISSUE_TEMPLATE/work_package.yml
.github/PULL_REQUEST_TEMPLATE.md
.github/workflows/repo-check.yml
CONTRIBUTING.md
README.md
docs/README.md
docs/ai-usage/PA1_AIUsageLog_Hieu.docx
docs/ai-usage/PA1_AIUsageLog_Hung.docx
docs/ai-usage/PA1_AIUsageLog_Quang.md
docs/ai-usage/README.md
docs/design/PA1-proposed_solution.docx
docs/design/README.md
docs/management/Huong_dan_lam_viec_nhom_CourtMate.docx
docs/management/PA1-project-plan.docx
docs/management/PA1-risk_management.docx
docs/management/PA1-tools-collaboration.docx
docs/management/README.md
docs/management/weekly/README.md
docs/management/weekly/W02-status.docx
docs/management/weekly/W03-status.docx
docs/requirements/PA1-vision.md
docs/requirements/PA2-hung-requirements.docx
docs/requirements/PA2-nonfunctional-requirements.docx
docs/requirements/README.md
docs/test/README.md
pa/Final/README.md
pa/PA0/README.md
pa/PA0/T05-PA0.docx
pa/PA0/T05-PA0.pdf
pa/PA1/README.md
pa/PA1/T05-PA1-Source.zip
pa/PA1/T05-PA1.pdf
pa/PA2/README.md
pa/PA3/README.md
pa/PA4/README.md
pa/PA5/README.md
pa/README.md
```

### Intentionally excluded

Local `.env` được tạo từ example để test và giữ ở máy, không chứa credential. `.venv/`, `node_modules/`, `dist/`, Python/test/Ruff caches và build info trong `node_modules/.tmp/` không được stage/commit. Source scaffold, Playwright và fresh-install source copy ở thư mục tạm ngoài repo. Không lưu token, password hoặc private key vào source/report.

Đã kiểm tra Git visibility của lockfiles/examples, ignore của artifacts/local env/private key names, nested `.git`, các filename nhạy cảm và pattern token/private key phổ biến trong file thay đổi. Không phát hiện secret theo các kiểm tra này. `git diff --check` đạt; nội dung file mới cũng đã được kiểm tra whitespace riêng vì chưa stage.

## 7. Outstanding issues

| Vấn đề | Mức độ | Hướng xử lý | Chặn bước tiếp theo? |
| --- | --- | --- | --- |
| Starlette TestClient cảnh báo dùng HTTPX bị deprecate, gợi ý HTTPX2 | Thấp; 8 tests vẫn pass | Xem migration tương thích khi nâng test stack; hiện giữ HTTPX đúng yêu cầu bootstrap, không che warning | Không |
| npm cảnh báo install script của dependency tùy chọn `fsevents@2.3.3` chưa có allowScripts | Thấp; cài đặt, dev server, build vẫn pass | Chỉ review/cho phép riêng package này nếu cần native filesystem watcher; không bật tất cả lifecycle scripts | Không |
| Homebrew không có bottle phù hợp cho lần cài uv trên macOS 14 | Đã xử lý bằng installer chính thức | uv đã hoạt động; có thể xem xét nâng macOS theo kế hoạch cá nhân sau này | Không |

Không còn vấn đề authentication hoặc Docker daemon. Không thay đổi cấu hình cá nhân/editor settings ngoài các extension được phép cài.

## 8. Next steps

Sau khi nhóm review và chấp nhận bootstrap: PostgreSQL + Docker Compose; database schema và Alembic; Firebase Authentication; lint/build/tests trong CI/CD; deployment. Các phần này chưa được triển khai trong nhiệm vụ này.

Các lệnh sau là hướng dẫn lịch sử của đợt 24/10. Commit/push bootstrap đã được chủ repo yêu cầu và thực hiện sau đó; trạng thái hiện tại được ghi ở phần cập nhật cuối file. Không chạy lại lệnh tạo commit cũ một cách máy móc. Chạy tại root repository:

```bash
git status --short --branch
git diff --check
git diff
git ls-files --others --exclude-standard
git add .gitignore .vscode/extensions.json src/frontend/ src/backend/ docs/development/bootstrap-report.md
git diff --cached --check
git diff --cached
git commit -m "chore: bootstrap CourtMate frontend and backend"
git push -u origin chore/project-bootstrap
gh pr create --base main --head chore/project-bootstrap --fill
```

Làm theo review độc lập trong `CONTRIBUTING.md` trước khi merge. Không có lệnh merge hoặc force push trong quy trình trên.

## Cập nhật 27/10/2026 — nền tảng local và cloud

Phạm vi mới được chủ repo cho phép: Docker PostgreSQL, SQLAlchemy/psycopg, Alembic, Firebase Auth, Neon, Render, Vercel và GitHub Actions. Trạng thái tại commit nền tảng đầu tiên của đợt này: **PARTIAL — local đã kiểm chứng; cloud deployment và GitHub CI đang chờ nghiệm thu sau push**. Bằng chứng lịch sử phía trên được giữ nguyên.

- Đã fetch và merge `origin/main` (`246a92b`) vào `chore/project-bootstrap` bằng merge commit `95d996e`. Không reset/rebase/force-push và không merge vào main. Hai tài liệu requirements mới từ main được giữ nguyên.
- Đã đọc SRS hiện hành `1zL3Ra_0LceKOF_2pZa9iWpq7HIbRtALB`; chỉ triển khai identity/role foundation, không sửa SRS/Figma/PA và không triển khai booking/court/room.
- Tạo local Compose `courtmate-db-1`, PostgreSQL 17, volume riêng `courtmate_postgres_data`, healthcheck và port loopback 5433. `make setup` sinh local password ngẫu nhiên, không ghi đè giá trị có sẵn.
- Neon: project `courtmate` / `divine-sun-63104113`, organization `org-patient-bonus-12684769` (free), Singapore; demo branch `br-small-glitter-aomatkd1`, development branch `br-wild-bread-ao8ejarx`. Project không rõ mục đích đã có từ trước được giữ nguyên.
- Migration `0001_identity` chỉ có bảng users với Firebase UID unique, UUID nội bộ, role `player`/`owner` có check constraint và timestamp có timezone. Đã migrate hai lần liên tiếp trên local trống, Neon demo và development. Direct connection cho migration, pooled connection cho runtime; kiểm tra TLS `verify-full` tại libpq và timezone UTC thành công. `pg_stat_ssl` trên server sau Neon proxy không phản ánh TLS client nên không dùng làm bằng chứng TLS.
- Firebase project `courtmate-t05-nexora` (project number `1025822356886`), Web App `1:1025822356886:web:690e2d75083929893c19b7`; Email/Password đã deploy thật qua Firebase CLI. Runtime service account `courtmate-runtime` chỉ có `roles/firebaseauth.viewer`; credential runtime riêng, không sử dụng phiên CLI như credential FastAPI.
- Vercel project `courtmate` / `prj_M5RVrPKXbHI7AvHwtNEb7CELAIsw`, Node 24, root `src/frontend`, GitHub integration đã cấp cho CourtMate. Render CLI và MCP xác minh đúng workspace `tea-dbg8buh42hec73dt859g` / My Workspace / `hungkydau2@gmail.com`.
- Role không nhận từ client/custom claims; Firebase UID mới luôn là Player. Owner chỉ cấp bằng `python -m app.scripts.grant_owner UID --confirm UID`. Có helper kiểm tra ownership phía server; chưa có court/booking resource để tuyên bố kiểm thử AC nghiệp vụ.
- Đã chạy lại `npm ci`, lint, typecheck, build; tất cả PASS. SDK chỉ dùng Firebase App/Auth, không dùng Firestore. `npm audit`: 0 vulnerabilities tại thời điểm chạy.
- `uv sync --locked`, Ruff lint/format và **15 pytest tests PASS**, không skip. Tests dùng database `courtmate_test` riêng và Auth Emulator `demo-courtmate`, kiểm tra token thật của emulator, token sai, Player/Owner, role injection, ownership rejection, constraint role, UTC và migration idempotence.
- **3 Playwright tests PASS** trên Chrome: browser → real API; Firebase Emulator signup → token → backend → database → Player; axe WCAG 2/2.1 AA check trên trang development. Không gán kết quả này cho các màn hình nghiệp vụ chưa triển khai.
- Local seed chạy hai lần thành công. Export bằng pg_dump trong Docker và restore chỉ vào local database `_test` đã kiểm chứng. Các lệnh reset/restore từ chối database demo/cloud và không yêu cầu cài PostgreSQL global.
- Render Blueprint đã validate bằng CLI: `valid: true`. Free plan không hỗ trợ pre-deploy command, nên startup chạy Alembic dưới PostgreSQL advisory lock rồi exec Uvicorn; migration lỗi thì không khởi động API. Cloud emulator bị từ chối; URL/credential bắt buộc thiếu phải báo lỗi.
- CI mới dùng service PostgreSQL riêng, Auth Emulator demo, lockfiles, Ruff/pytest/migration, Playwright và accessibility; không cần credential cloud/cá nhân. Chưa coi CI đạt cho tới khi có GitHub run thật.
- Hướng dẫn vận hành hiện tại: [setup.md](setup.md). Các thông tin deploy/CI/commit sau push sẽ được bổ sung theo kết quả thực tế; không ghi READY trước khi kiểm chứng các URL và luồng cloud.


## Nghiệm thu cuối 27/10/2026 — READY cho nền tảng development/demo

Các điều kiện nghiệm thu hạ tầng đã đạt. READY ở đây dành cho nền tảng, không phải sản phẩm nghiệp vụ, các AC booking/room hay NFR hiệu năng.

### Git và PR

- Nhánh: `chore/project-bootstrap`, remote `hungstupid/CourtMate`; không sửa/merge vào main, không reset/rebase/force-push.
- Merge đồng bộ: `95d996e` từ `origin/main@246a92b`.
- Code foundation: `85d90d203603a030821912db869e9e82d1f26ccf`.
- Sửa CI thực tế: `5087bfc13fc8052b125cdbb832a9eb36ca1adf55`. Run đầu dùng alias setup-uv `v10` không tồn tại nên thất bại trước integration; đã sửa thành release tag tồn tại `v10.3.2`, không đổi dependency ứng dụng để chữa lỗi này.
- Sửa readiness để từ chối database có bảng alembic_version nhưng chưa có revision: `67ed48ee34740be359228e4789026af72b78a4da`, có regression test thật trên PostgreSQL.
- Commit được nghiệm thu trên cloud/CI: `f1d6a38a1fab6ac4d69cf428da4589e726ebb94c`; các cập nhật tài liệu bàn giao sau đó nằm cùng nhánh, xem `git log -1` / HEAD của PR để lấy commit tài liệu mới nhất.
- [Draft PR #73](https://github.com/hungstupid/CourtMate/pull/73) đã mở. Cần team review trước khi merge; không agent nào merge tự động.

### Cloud đã xác minh

| Thành phần | Tài nguyên / URL | Bằng chứng |
| --- | --- | --- |
| Frontend | https://courtmate-court-mate.vercel.app ; alias https://courtmate-virid.vercel.app | HTTPS 200, không yêu cầu đăng nhập dashboard; Chrome sign-in/verification và axe pass |
| Vercel | `courtmate` / `prj_M5RVrPKXbHI7AvHwtNEb7CELAIsw` | Deployment `dpl_7R6153QvmHmDz9d1N8TTt8qoWRb7` READY, target production, Git source `85d90d2`; frontend source không đổi ở các commit CI/readiness/docs sau |
| Backend | https://courtmate-api-cs7b.onrender.com | `/health` 200, `/ready` 200, CORS đúng origin frontend; token thật được xác minh |
| Render | `courtmate-api` / `srv-dbg8tmu7bikc73fdlb7g`, Free, Singapore, root `src/backend` | Auto deployment `dep-dbg9317b9u1s73822rdg`, source `f1d6a38`, trigger `new_commit`, LIVE sau CI |
| Neon | `courtmate` / `divine-sun-63104113`, Free, Singapore | Runtime pooled, migration direct, TLS verify-full tại client; demo có 2 identity fixtures, development có 0 identity rows và revision riêng |
| Firebase | `courtmate-t05-nexora`, Web App `1:1025822356886:web:690e2d75083929893c19b7` | Email/Password thật, authorized domains khớp các alias frontend đã quan sát; runtime service-account credential riêng |

Render ban đầu deploy từ setup branch để nghiệm thu. Đã bật `checksPass`, push một commit setup, quan sát CI pass rồi Render tự tạo deployment `new_commit` và đạt LIVE. Sau đó đã **đặt và đọc lại** service thành `branch=main`, `autoDeployTrigger=checksPass`, plan Free; đổi cấu hình không tự deploy mã main cũ. Bản setup đã xác minh tiếp tục live. Merge main sau review sẽ dùng đường triển khai đã cấu hình, không cần sửa dashboard vào PA5.

Vercel đã build/deploy production từ Git source thật; main Git deployment bật, setup Git deployment tắt để tránh một push tạo thêm preview ngoài bản acceptance chủ động. Chưa tạo sự kiện merge main vì không được phép merge. Không gán bằng chứng deploy setup thành bằng chứng đã merge/main deploy.

### CI thực tế

| Run | Commit / sự kiện | Kết quả |
| --- | --- | --- |
| [40498733550](https://github.com/hungstupid/CourtMate/actions/runs/40498733550) | `5087bfc`, push | Frontend + integration PASS |
| [40499095148](https://github.com/hungstupid/CourtMate/actions/runs/40499095148) | `67ed48e`, push | Frontend + integration PASS |
| [40499671930](https://github.com/hungstupid/CourtMate/actions/runs/40499671930) | `f1d6a38`, push | Frontend + integration PASS |
| [40499762439](https://github.com/hungstupid/CourtMate/actions/runs/40499762439) | `f1d6a38`, pull_request | Frontend + integration PASS; **16 pytest tests**, **3 browser tests** |
| [40499761175](https://github.com/hungstupid/CourtMate/actions/runs/40499761175) | PR #73 repository check | PASS, folder guides / sensitive filenames |

CI clone sạch, cài từ npm/uv lockfiles, chạy frontend lint/typecheck/build, Ruff lint/format, migration hai lần, PostgreSQL test riêng, Firebase Auth Emulator demo, pytest, Playwright/axe và 20-request liveness probe. Không dùng credential cá nhân, Neon demo, Firebase cloud hoặc secret từ máy để chạy CI.

### Lệnh/check đã chạy và kết quả

- Frontend: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm audit` — PASS, audit 0 vulnerabilities tại thời điểm nghiệm thu.
- Backend: `uv sync --locked`, `uv run pytest` — **16 passed, 0 skipped**; `uv run ruff check .`, `uv run ruff format --check .` — PASS.
- `make setup`, `make db-up`, `make migrate` hai lần, local seed hai lần — PASS. `make setup` giữ các giá trị đã có, thêm key thiếu, không log password.
- Clone thật từ remote vào thư mục tạm sạch, Compose project `courtmate-repro` riêng trên port 5434: setup/install, migrations hai lần, 16 tests, seed, frontend checks và API chạy thật tại port 8010/health/ready đều PASS; API và database repro được dừng đúng sau test, volume không bị xóa.
- Local E2E: **3 passed**; Firebase Emulator signup qua browser → token → backend → PostgreSQL → Player, cùng axe trên trang development.
- Cloud API: sign-in bằng Firebase Email/Password thật, `/api/me` lưu UID, role mặc định Player; script Owner grant xác minh UID tồn tại/enabled; Owner được phép, Player bị 403; không token / token sai / token unsigned của emulator bị 401; client `role=owner` không nâng quyền. Giá trị role trong Neon đã đối chiếu lại.
- Cloud browser: cùng suite Playwright chạy với Player và Owner, **3 passed + 3 passed** sau auto-deploy Render; gồm HTTPS/CORS/backend identity và axe. Không mock response thành công hoặc tắt token verification.
- `uv run python -m app.scripts.database_backup export` / `restore-test`: PASS, dùng pg_dump/pg_restore trong Docker, chỉ restore vào localhost `_test` riêng; không reset demo.
- Neon demo và development: migration hai lần, UTC, verify-full TLS PASS; pooled runtime cũng đã truy vấn được schema. Không coi pg_stat_ssl sau Neon proxy là TLS client evidence.
- `render blueprints validate render.yaml --output json`: `valid: true`; cấu hình live cũng được áp dụng/đọc lại, không chỉ viết file IaC.
- `git diff --check`, kiểm tra staged filenames/artifacts, pattern secret thông dụng, lockfiles và bảo toàn tài liệu PA: PASS. Không có nested repo hoặc credential trong source.

Không kiểm thử AC booking/cancellation/capacity/room/deal hoặc NFR concurrency vì chưa có business implementation. Load probe không phải chứng nhận hiệu năng. Không sửa SRS, Figma hoặc tài liệu PA; hai tài liệu requirements đi vào nhánh bằng merge main được bảo toàn.

### Secrets, tài khoản thử và bàn giao

- Runtime secrets chỉ nằm trong Render environment storage và local `.env`/`.secrets` được ignore. Không đưa service-account key, connection URL có password hoặc token vào báo cáo/source/screenshot.
- Hai cloud identity fixtures (Player và Owner) cùng thông tin đăng nhập nằm trong `src/backend/.secrets/cloud-accounts.json` trên máy chủ repo, permission 0600; không ghi credential vào PR/report/chat. Dùng đăng ký Player công khai hoặc chia sẻ tài khoản demo riêng qua kênh phù hợp khi cần đánh giá Owner.
- Source/lockfiles/examples và docs đã được commit/push trên branch setup theo quyền được cấp. SRS/Figma/PA và các tài nguyên không thuộc CourtMate không bị thay đổi.
- Hướng dẫn PA5: [setup.md](setup.md). Cần review/merge như quy trình nhóm; sau đó chỉ thêm migration/code/test vào repo, CI và deployment source main đã sẵn. Các migration tiếp theo phải tương thích với bản API cũ đang live; không rollback database bằng cách tự chạy downgrade/reset demo.
- Bằng chứng ảnh public landing không có credential: `/private/tmp/courtmate-cloud-landing.png`. Artifact tạm và one-time operator scripts không phải source bàn giao; project/service IDs và cách tái xác thực CLI/provider đã được ghi trong setup.md.

### Giới hạn / outstanding

Không còn blocker cho nền tảng. Render Free ngủ sau 15 phút idle, cold start khoảng một phút, 750 instance-hours/workspace/tháng và hạn mức build/bandwidth; frontend có timeout/retry phù hợp. Neon Free có scale-to-zero, compute/storage/history quotas; project đang dùng 0.25 CU và history retention 6 giờ theo metadata đã quan sát. Vercel Hobby/Firebase Spark có quota; không bật trả phí hoặc cam kết NFR production.

npm vẫn có thông báo install-script chưa duyệt cho dependency tùy chọn/support (`fsevents`, Firebase util); install/dev/build/CI đều thành công. Không bật hàng loạt lifecycle scripts. Warning HTTPX/TestClient cũ đã được xử lý bằng HTTPX2 cho TestClient; HTTPX vẫn dùng cho tooling.

Tài liệu giới hạn hiện hành: [Render Free](https://render.com/docs/free), [Render deploy/CI](https://render.com/docs/deploys), [Neon pooling](https://neon.com/docs/connect/connection-pooling), [Firebase emulator isolation](https://firebase.google.com/docs/emulator-suite/connect_auth). Không thực hiện nâng gói hoặc triển khai thêm worker/queue/AI/image-storage provider.

### File manifest của đợt setup mở rộng

So với merge base `95d996e` (đã chứa các cập nhật main), danh sách chính xác dưới đây gồm STATUS A = tạo mới, M = sửa; không tính lại các file bootstrap 24/10. Hai file requirements được đưa vào bằng merge main không nằm trong phần thay đổi do agent tạo:

```text
A	.env.example
A	.github/workflows/quality.yml
M	.gitignore
A	Makefile
M	README.md
A	compose.yaml
M	docs/development/bootstrap-report.md
A	docs/development/setup.md
A	firebase.json
A	render.yaml
A	scripts/ci-integration.sh
A	scripts/setup_local.py
A	src/backend/.env.cloud.example
M	src/backend/.env.example
M	src/backend/README.md
A	src/backend/alembic.ini
M	src/backend/app/api/health.py
A	src/backend/app/api/identity.py
A	src/backend/app/core/auth.py
A	src/backend/app/core/settings.py
A	src/backend/app/db/__init__.py
A	src/backend/app/db/models.py
A	src/backend/app/db/session.py
M	src/backend/app/main.py
A	src/backend/app/scripts/__init__.py
A	src/backend/app/scripts/database_backup.py
A	src/backend/app/scripts/grant_owner.py
A	src/backend/app/scripts/load_smoke.py
A	src/backend/app/scripts/reset_test.py
A	src/backend/app/scripts/seed.py
A	src/backend/app/scripts/start.py
A	src/backend/migrations/env.py
A	src/backend/migrations/script.py.mako
A	src/backend/migrations/versions/0001_identity.py
M	src/backend/pyproject.toml
A	src/backend/tests/conftest.py
A	src/backend/tests/test_identity.py
A	src/backend/tests/test_readiness.py
M	src/backend/uv.lock
A	src/frontend/.env.cloud.example
M	src/frontend/.env.example
M	src/frontend/README.md
A	src/frontend/e2e/bootstrap.spec.ts
M	src/frontend/package-lock.json
M	src/frontend/package.json
A	src/frontend/playwright.config.ts
M	src/frontend/src/app/styles.css
M	src/frontend/src/components/BackendStatus.tsx
A	src/frontend/src/components/IdentitySmoke.tsx
A	src/frontend/src/lib/firebase.ts
M	src/frontend/src/pages/DevelopmentPage.tsx
A	src/frontend/vercel.json
```

Tổng đợt mở rộng: 52 files (A: 36, M: 16).
