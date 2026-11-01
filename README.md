# Traqo

Traqo is a React and FastAPI workspace for importing roadmaps and tracking task progress over time.

**Now a desktop app for Linux, Windows, and macOS.** The desktop edition bundles the interface, Python API, and SQLite storage. Installed apps work offline and do not require Python or Node.js.

![Traqo desktop walkthrough](docs/screenshots/desktop-demo.gif)

### Desktop quick start

For development, install Node.js 24 and Python 3.12, then run from the repository root:

```bash
npm ci
npm run setup
npm start
```

Build an installer for your current OS with `npm run dist`. Output goes to `release/`:

| Platform | Installer |
| --- | --- |
| Linux x64 | AppImage and Debian package |
| Windows x64 | Setup executable with an install-location chooser |
| macOS Apple Silicon / Intel | Separate DMG and ZIP builds |

The [Desktop builds workflow](https://github.com/Gurtejhundal/Traqu/actions/workflows/desktop.yml) builds and tests all four platform/architecture combinations. Download installers from a successful run's **Artifacts** section. Builds are unsigned; public distribution with trusted signatures needs Windows signing and Apple signing/notarization credentials.

The desktop app starts its own private local service, saves your workspace in your OS user-data folder, remembers window size, and offers native menus and PDF/Word save dialogs. Use **File → Show Data Folder** to find your database and **File → Show Logs** for startup diagnostics. Press **Alt** to show the menu on Linux and Windows.

![Roadmap library running in Electron](docs/screenshots/library.png)

<details>
<summary>More desktop screenshots</summary>

![Import a roadmap](docs/screenshots/import.png)

![Track tasks in a focused section](docs/screenshots/roadmap.png)

</details>

See [desktop architecture, data migration, build instructions, and verification](docs/DESKTOP.md). The web setup below remains available.

It supports pasted roadmap text and uploaded roadmap files. PDF import works when the PDF contains selectable text. Scanned image PDFs need OCR before upload.

## About

Traqo is built for personal plans that are too large to manage as plain text. Import a roadmap from ChatGPT, PDF, DOCX, Markdown, or other text-based files, then track it as a structured checklist with sections, subsections, progress, search, and a contents panel for fast navigation.

The app is designed for single-user local use. It removes hosted sign-in friction and focuses on turning messy roadmap documents into something you can actually follow day by day, month by month, or section by section.

## Features

- Import roadmaps from pasted text.
- Import DOCX and text-based files such as TXT, Markdown, JSON, CSV, YAML, RST, and logs.
- Import readable-text PDFs with layout-aware table, heading, callout, list, and code detection.
- Recognize week, phase, daily-checklist, matrix, dependency-tree, level, sprint, backward-plan, 30/60/90, and mixed parallel-track roadmap structures.
- Preserve typed outcomes, milestones, deliverables, projects, KPIs, evidence, prerequisites, cadence, and exit criteria instead of flattening them into generic task text.
- Keep multiple roadmap roots separated when one PDF contains more than one plan.
- Keep supporting PDF material as preserved document blocks instead of turning every line into a task.
- Add notes, checklists, counters, bookmarks, due dates, labels, code snippets, revision counters, and revisit markers from an inline `+` menu.
- Apply a new block to one task, every task in its section, or the entire roadmap, then edit each copy independently.
- Preserve task blocks through reloads and raw-structure edits.
- Parse common ChatGPT roadmap formats into timeframe groups and tasks.
- Navigate large roadmaps with section/subsection contents and current-location context.
- Track task completion per roadmap.
- Show completion progress on roadmap cards and detail pages.
- Edit roadmap task structure after import.
- Export a roadmap to PDF or Word from the roadmap detail page.
- Scope roadmap, task, and timeframe access by a local owner header.

## Tech Stack

- Frontend: React, Vite, React Router, Lucide icons.
- Backend: FastAPI, SQLAlchemy, Pydantic.
- Database: SQLite locally, PostgreSQL-compatible via `DATABASE_URL`.
- Auth: none. The app is configured for single-user local use.
- API ownership: the frontend sends `X-Local-User-Id` so local roadmaps stay scoped to one owner key.

## Setup

### Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe -m uvicorn main:app --reload
```

The API runs at `http://localhost:8000` by default.

### One-click launcher

On Windows, double-click `launcher.bat` or run it from PowerShell:

```bat
launcher.bat
```

The launcher requires Python 3.11+ and Node.js `^20.19.0` or `>=22.12.0`. It creates an isolated backend environment in `backend/.venv`, verifies exact backend packages and the locked frontend dependency tree, installs only when the environment fingerprint changes, starts FastAPI and Vite, verifies Traqo-specific readiness responses, and then opens `http://127.0.0.1:5173`. Runtime logs are stored in `%LOCALAPPDATA%\Traqo\logs`.

To start without opening a browser, use:

```bat
launcher.bat -NoBrowser
```

The launcher runs Traqo in the background. Stop the services with:

```bat
launcher.bat -Stop
```

You can also open the graphical launcher directly:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\launcher.ps1
```

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

The app runs at the Vite URL printed in the terminal, usually `http://127.0.0.1:5173`.

Set `VITE_API_URL` if the backend is not running on `http://127.0.0.1:8000`.

## Checks

```bash
cd backend
.venv\Scripts\python.exe -m pytest

cd ../frontend
npm test
npm run lint
npm run build
```

## Known Limits

- PDF import extracts embedded text only. It reconstructs layout and repeated page chrome, but it does not OCR scanned documents.
- The frontend uses a fixed local owner id. This is deliberate for personal use, not suitable for multi-user deployment.
