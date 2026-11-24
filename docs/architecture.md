# Architecture Reference — Solution B (`agy` CLI + OpenDesign MCP)

## 1. Why Solution B?

Running Google Antigravity (`agy`) *inside* a third-party desktop app risks violating consumer OAuth terms of service (third-party wrapping of an official client). **Solution B** inverts the control plane:

- **Official `agy` CLI** remains the sole primary coding, design-migration, and repository-editing client.
- **OpenDesign** (`Open Design.app`) runs strictly as a downstream **MCP server** (`open-design`) and read-only local asset catalog (`design-systems/`, `skills/`, `craft/`, `plugins/_official/scenarios/`).
- **Hard ToS Rule**: Never invoke OpenDesign MCP's `start_run` tool with `agent: "antigravity"`, and never configure `agy` as an inner runtime spawned by OpenDesign.

```text
+----------------------------------------------------------------------+
|  Google Antigravity CLI (`agy`, official primary client)             |
+---------------------------------+------------------------------------+
                                  |
         +------------------------+------------------------+
         | (A) MCP Stdio Layer                             | (B) Local Workspace Layer
         | ~/.gemini/config/mcp_config.json                | <repo>/.agents/skills.json
         |                                                 | <repo>/.agents/rules/open-design.md
         |                                                 | <repo>/DESIGN.md
         v                                                 v
+--------------------------------------+     +------------------------------------------+
| $HOME/.local/bin/open-design-mcp     |     | /Applications/Open Design.app/           |
|  - Invokes Open Design Helper.app    |     |   Contents/Resources/open-design/        |
|    with ELECTRON_RUN_AS_NODE=1       |     |   - skills/ (valid YAML frontmatter)     |
|  - Node ABI matches packaged addons  |     |   - plugins/_official/scenarios/         |
|  - LSUIElement=true (no Dock bounce) |     |   - design-systems/                      |
|  - Computes OD_MCP_DISCOVERY via     |     |   - craft/                               |
|    @open-design/sidecar              |     +------------------------------------------+
+------------------+-------------------+
                   | Unix IPC socket discovery + 127.0.0.1 loopback HTTP
                   v
+--------------------------------------+
| OpenDesign Local Daemon              |
| (GUI desktop or `--headless` mode)   |
| 22 MCP tools + od:// MCP resources   |
+--------------------------------------+
```

## 2. Key macOS Implementation Details

### 2.1 Avoiding `/usr/bin/od` Shadowing
macOS ships `/usr/bin/od` (POSIX octal dump) on default `PATH`. Using bare `od` in MCP configs or shell scripts collides with the OS binary. This toolkit installs non-colliding wrappers:
- `open-design-mcp` — stdio MCP launcher (`daemon-cli.mjs mcp`)
- `open-design-cli` — general OpenDesign CLI wrapper (`daemon-cli.mjs "$@"`)

### 2.2 Bundled Electron Helper vs System Node
Packaged `Open Design.app` ships native Node addons (`better-sqlite3`, `node-pty`, `sharp`) compiled against its bundled Electron Node ABI (e.g. Node v24 / ABI 145), which frequently differs from Homebrew/nvm system Node. Running:
```text
ELECTRON_RUN_AS_NODE=1 \
  "$OPEN_DESIGN_APP/Contents/Frameworks/Open Design Helper.app/Contents/MacOS/Open Design Helper" \
  "$OPEN_DESIGN_APP/Contents/Resources/app/prebundled/daemon/daemon-cli.mjs" mcp
```
provides:
1. Exact ABI parity with bundled native modules.
2. Zero dependency on shell `PATH` or `nvm`.
3. `LSUIElement=true` in `Open Design Helper.app/Contents/Info.plist`, preventing macOS Dock icon bounce.

### 2.3 Why `agy mcp add` Instead of `od mcp install antigravity`
OpenDesign's built-in installer targets a legacy path (`~/.gemini/antigravity/mcp_config.json`), whereas modern `agy` CLI reads **`~/.gemini/config/mcp_config.json`**. `scripts/install.sh` registers the server using `agy mcp add open-design ...` directly so `agy mcp list`, `enable`, `disable`, and `remove` manage it natively.

### 2.4 Dynamic Sidecar IPC Discovery & Headless Auto-Bootstrap
Packaged `Open Design.app` binds its local daemon to an **ephemeral loopback port** (`OD_PORT=0`) and exposes its live URL over per-UID Unix domain sockets computed by `@open-design/sidecar` (`$TMPDIR/od-sidecar-<uid>/<sha256[:32]>.sock`).

`bin/open-design-mcp` computes `OD_MCP_DISCOVERY` dynamically at launch for both `runtime` (GUI) and `headless` modes and configures:
- `OD_MCP_BOOTSTRAP_COMMAND="/usr/bin/open"`
- `OD_MCP_BOOTSTRAP_ARGS=["-g","-j","<app-path>","--args","--headless","--od-mcp-managed"]`
- `OD_MCP_STDIO_IDLE_EXIT_MS=0` (prevents 30-minute idle exits during long `agy` sessions)

If the caller explicitly sets `OD_DAEMON_URL` or passes `--daemon-url <url>`, managed sidecar bootstrap is skipped and calls route directly to that URL (useful for deterministic CI/smoke tests or standalone `open-design-cli daemon start --headless --port 7456`).

### 2.5 OpenDesign MCP Surface
The stdio server (`open-design`) exposes **22 tools** and **4 resource families** (all readable natively by `agy`):
- **Brief (local-only, no daemon required)**: `collect_brief`, `confirm_brief`, and resource `ui://open-design/artifact-card-v8.html`
- **Project inspection & files**: `list_projects`, `get_active_context`, `get_project`, `list_files`, `get_file`, `search_files`, `get_artifact`, `create_project`, `create_artifact`, `write_file`, `delete_file`, `delete_project`
- **Catalog discovery**: `list_skills`, `list_plugins`, `list_agents`
- **Cloud auth & runs**: `start_vela_login`, `get_vela_login_status`, `start_run` *(ToS rule: never pass `agent: "antigravity"`)*, `get_run`, `cancel_run`
- **MCP Resources**: `od://focus/active`, `od://skills/<id>/SKILL.md`, `od://design-systems/<id>/DESIGN.md`, `ui://open-design/artifact-card-v8.html`

## 3. Thin-Adapter Upstream-Sync Pattern

To apply OpenDesign redesigns to an active frontend repository without fighting merge conflicts on every `git pull`:

| Layer | Paths | Ownership & Sync Behavior |
| :--- | :--- | :--- |
| **Isolated Redesign Layer** | `components/redesign/**`, `tokens.{css,scss}`, `DESIGN.md`, `scripts/od-sync-audit.mjs`, `.agents/` | Owned by the design layer; rarely touched by upstream feature PRs. |
| **Thin-Adapter Seams** | Page shells / entry files mounting `components/redesign/*` via concise props | Minimal diff footprint; on merge conflict, keep upstream logic and preserve the thin mount. |
| **Upstream UI Surfaces** | Remaining pages and shared UI components | Styled strictly with `var(--...)` tokens; audited post-merge via `od-sync-audit.mjs`. |
| **Upstream Business Logic** | `services/`, `api/`, `hooks/`, `store/`, backend, copy contracts | Untouched during visual redesigns. |

`.agents/skills.json` embeds a machine-local macOS path (`/Applications/Open Design.app/...`), so `scripts/init-project.sh` adds `.agents/skills.json` to `.git/info/exclude` by default while keeping `DESIGN.md`, `scripts/od-sync-audit.mjs`, rules, and local skills portable across contributors.
