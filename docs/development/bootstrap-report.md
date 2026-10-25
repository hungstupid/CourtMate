# CourtMate bootstrap — kết quả nghiệm thu

Ngày thực hiện: **24/10/2026**, múi giờ Asia/Ho_Chi_Minh. Phạm vi: môi trường phát triển, repository, React + TypeScript + Vite và FastAPI + uv. Các acceptance checks bắt buộc đã đạt. Chưa triển khai chức năng nghiệp vụ.

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
- Kết quả cuối: **31 file mới, 3 file tracked được sửa; chưa stage, commit hoặc push**. Không mở PR hoặc merge.
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

Các lệnh sau **chỉ để chủ repo thực hiện sau khi review**, chưa được chạy bởi agent. Chạy tại root repository:

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
