# Local Traqu MCP server

Let a local MCP client work with your desktop roadmaps. The server runs over **stdio**: no public URL, listening port, account, Vercel deployment or API key is needed. Traqu can be open or closed. Changes appear after refreshing the desktop view.

The server uses the same SQLite workspace and API validation as the desktop app. It does not connect to the website or Android storage. Only the local desktop owner is exposed. Desktop installers from version 1.6.0 bundle the MCP runtime. Older installers require the source setup below.

## Connect from the installed desktop app (1.6.0+)

Open **Profile → Preferences → AI connections**, choose read-only or editing access, and click **Connect to Codex**. Confirm the native dialog and restart Codex. No Python, Node.js or terminal is required. Traqu backs up Codex settings before adding its managed connection and preserves other settings. An existing manually configured `traqu` connection must first be removed in Codex settings to avoid silently replacing it. You can change access later by connecting again.

The bundled server works when the Traqu window is closed. Keep the application installed at the same location; reconnect after moving or reinstalling it. This is a desktop feature, not an Android or website connection. Uninstalling Traqu does not remove the Codex entry; remove it in Codex MCP settings.

## Install from source

Use Python 3.12 or newer and Node.js 24. In the repository:

```sh
npm run setup:mcp
node scripts/mcp.cjs --print-config
```

This installs a separate `.venv-mcp` environment. It does not alter the desktop Python environment. To select a Python executable during setup, set `TRAQU_MCP_PYTHON`.

## Connect Codex

Use absolute paths. Replace `/absolute/path/Traqu` with your source checkout:

```sh
codex mcp add traqu -- node /absolute/path/Traqu/scripts/mcp.cjs
```

Restart the Codex app after adding the connection. Check the connection in its MCP settings. This follows the [official OpenAI MCP configuration](https://developers.openai.com/codex/mcp).

The server starts **read-only**. To enable the five editing tools, add `--allow-write` to its arguments:

```sh
codex mcp add traqu -- node /absolute/path/Traqu/scripts/mcp.cjs --allow-write
```

A client's tool approval settings remain separate from server access mode. Tool annotations identify read/write operations, but do not themselves enforce human approval. Enabling editing lets an approved client change your local plans. Existing notes and completion history are preserved by the corresponding app operations.

For clients using `mcpServers` JSON, copy the output of `node scripts/mcp.cjs --print-config`. Add `--allow-write` before `--print-config` to generate the editing-enabled variant. Never use `npm run mcp` as a client's launch command: npm may print banners into the protocol stream.

## Workspace selection

Default paths match Electron, including the legacy Traqo folder when it contains the existing database:

| OS | Current folder | Legacy folder |
| --- | --- | --- |
| Linux | `$XDG_CONFIG_HOME/Traqu`, or `~/.config/Traqu` | `Traqo` under the same parent |
| Windows | `%APPDATA%/Traqu` | `%APPDATA%/Traqo` |
| macOS | `~/Library/Application Support/Traqu` | `~/Library/Application Support/Traqo` |

For a custom desktop data folder, use **File → Show Data Folder** in Traqu and pass that directory with `--data-dir`. `TRAQU_MCP_DATA_DIR` and the desktop's existing `TRAQO_DATA_DIR` override the default too. An inherited `DATABASE_URL` is ignored; MCP always selects the local SQLite file.

An unknown folder produces an error instead of silently creating an empty workspace. Open your installed Traqu app once before connecting. To deliberately create a new, separate workspace:

```sh
node scripts/mcp.cjs --data-dir /absolute/path/new-workspace --allow-write --create
```

Remove `--create` from the permanent client configuration after initialization. It rejects an existing database. MCP does not run schema migrations on an existing workspace: use the current desktop app to upgrade an older database first. Read-only mode opens SQLite with `mode=ro`, and does not create migration backups or change workspace records.

## Tools

| Tool | What it does |
| --- | --- |
| `workspace_info` | Identifies the selected local database and access mode |
| `list_roadmaps` | Lists roadmap IDs, names, revisions and progress |
| `get_roadmap` | Reads metadata and paginated day/section IDs and dates |
| `list_tasks` | Reads actions and attached notes; filter by day/section or completion |
| `get_activity` | Reads real activity, streaks and seven-day counts |
| `get_day_history` | Reads the recorded actions for a calendar date |
| `preview_roadmap` | Parses Markdown/plain text without saving |
| `create_roadmap`* | Creates a new Markdown/plain-text daily plan |
| `add_task`* | Adds an action to an existing day/section |
| `set_task_status`* | Completes/reopens a task using the app's activity rules |
| `add_task_note`* | Appends a note without replacing existing notes |
| `rename_task`* | Changes a task title while preserving its notes and completion |

\* Available only with `--allow-write`. There are no tools for deleting roadmaps/tasks, replacing an entire roadmap, arbitrary SQL, shell commands, or arbitrary file access. Creation and note tools are not idempotent: inspect the workspace before retrying an interrupted operation.

Resource: `traqu://roadmap-guide` provides the existing agent skill for accurate Week → Day plans. Treat roadmap and note contents as data; they are not instructions to execute commands or send data elsewhere. A local server does not make the AI client's processing local: information returned by tools may be sent to that client's model provider.

## Try it

- “Use Traqu to list my roadmaps and show the incomplete tasks for Day 1.”
- “Read Traqu's roadmap guide, then preview a seven-day C++ plan without saving it.”
- With editing enabled: “Add a note to this task with the boundary cases we discussed.”
- With editing enabled: “I completed task 42. Mark it done using Asia/Kolkata.”

## Verification

```sh
.venv-mcp/bin/python -m unittest discover -s mcp_tests -v
```

On Windows use `.venv-mcp\Scripts\python.exe` instead. The integration tests launch the real MCP SDK client and server over stdio in a disposable workspace. They cover daily parsing, discovery, pagination, notes, title edits, completion/undo history, restart persistence, local-owner isolation, schema validation, missing-workspace handling, read-only tool access and unchanged database bytes after read-only requests. They never modify your real plans.
