# Architecture Reference — Solution B (`agy` CLI + OpenDesign MCP + Global Skill)

## 1. Why Solution B?

Running Google Antigravity (`agy`) *inside* a third-party desktop app risks violating consumer OAuth terms of service (third-party wrapping of an official client). **Solution B** inverts the control plane:

- **Official `agy` CLI** remains the sole primary coding, design-migration, and repository-editing client.
- **OpenDesign** (`Open Design.app`) runs strictly as a downstream **MCP server** (`open-design`) and read-only local asset catalog (`design-systems/`, `skills/`, `craft/`, `plugins/_official/scenarios/`).
- **Hard ToS Rule**: Never invoke OpenDesign MCP's `start_run` tool with `agent: "antigravity"`, and never configure `agy` as an inner runtime spawned by OpenDesign.

```text
+----------------------------------------------------------------------+
|  Google Antigravity CLI (`agy`, official primary client)             |
+----------------+----------------------------------+------------------+
                 |                                  |
                 v                                  v
+----------------------------------+  +----------------------------------+
| (A) Global Skill Layer           |  | (B) MCP Stdio Layer              |
| ~/.gemini/config/skills/         |  | ~/.gemini/config/mcp_config.json |
|   agy-opendesign/                |  |   -> $HOME/.local/bin/           |
|   ├── SKILL.md                   |  |      open-design-mcp             |
|   └── references/                |  |      (Open Design Helper.app +   |
| (Auto-discovered in ALL repos;   |  |       ELECTRON_RUN_AS_NODE=1 +   |
|  calls internal audit script in  |  |       dynamic sidecar IPC)       |
|  ~/.local/share/agy-opendesign/) |  +----------------+-----------------+
+----------------------------------+                   |
                                                       v
                                      +----------------------------------+
                                      | OpenDesign Local Daemon          |
                                      | (GUI desktop or `--headless`)    |
                                      | 22 MCP tools + od:// resources   |
                                      +----------------------------------+
```

## 2. Zero-Script Global Skill Installation (`install.sh`)

Running the single-line installer installs four coordinated artifacts on the host machine:

| Target Path | Role |
| :--- | :--- |
| `${AGY_OPENDESIGN_HOME:-$HOME/.local/share/agy-opendesign}/` | Internal runtime payload (`bin/`, `scripts/od-sync-audit.mjs`, `scripts/init-project.sh`, `skills/`, `templates/`). |
| `${BIN_DIR:-$HOME/.local/bin}/open-design-{mcp,cli}` | Portable macOS wrappers that avoid `/usr/bin/od` shadowing. |
| `${SKILLS_DIR:-$HOME/.gemini/config/skills}/agy-opendesign/` | Canonical `agy` global skill directory — automatically discovered across **every** workspace without running any per-project bootstrap script. |
| `~/.gemini/config/mcp_config.json` | Registers the `open-design` stdio MCP server via `agy mcp add`. |

When the user invokes `agy-opendesign` inside any repository, `agy` transparently runs:
```bash
node "${AGY_OPENDESIGN_HOME:-$HOME/.local/share/agy-opendesign}/scripts/od-sync-audit.mjs" --root . --strict
```
Because `od-sync-audit.mjs` detects when it is invoked from `AGY_OPENDESIGN_HOME`, it defaults `repoRoot` to `process.cwd()` (or `--root <dir>`) and checks global Solution B readiness without requiring per-project script copies.

## 3. Key macOS Implementation Details

### 3.1 Avoiding `/usr/bin/od` Shadowing
macOS ships `/usr/bin/od` (POSIX octal dump) on default `PATH`. Using bare `od` in MCP configs or shell scripts collides with the OS binary. This toolkit installs non-colliding wrappers:
- `open-design-mcp` — stdio MCP launcher (`daemon-cli.mjs mcp`)
- `open-design-cli` — general OpenDesign CLI wrapper (`daemon-cli.mjs "$@"`)

### 3.2 Bundled Electron Helper vs System Node
Packaged `Open Design.app` ships native Node addons (`better-sqlite3`, `node-pty`, `sharp`) compiled against its bundled Electron Node ABI, which frequently differs from Homebrew/nvm system Node. Running:
```text
ELECTRON_RUN_AS_NODE=1 \
  "$OPEN_DESIGN_APP/Contents/Frameworks/Open Design Helper.app/Contents/MacOS/Open Design Helper" \
  "$OPEN_DESIGN_APP/Contents/Resources/app/prebundled/daemon/daemon-cli.mjs" mcp
```
provides:
1. Exact ABI parity with bundled native modules.
2. Zero dependency on shell `PATH` or `nvm`.
3. `LSUIElement=true` in `Open Design Helper.app/Contents/Info.plist`, preventing macOS Dock icon bounce.

### 3.3 Why `agy mcp add` Instead of `od mcp install antigravity`
OpenDesign's built-in installer targets a legacy path (`~/.gemini/antigravity/mcp_config.json`), whereas modern `agy` CLI reads **`~/.gemini/config/mcp_config.json`**. `install.sh` registers the server directly using `agy mcp add open-design ...`.

### 3.4 Dynamic Sidecar IPC Discovery & Headless Auto-Bootstrap
Packaged `Open Design.app` binds its local daemon to an **ephemeral loopback port** (`OD_PORT=0`) and exposes its live URL over per-UID Unix domain sockets computed by `@open-design/sidecar` (`$TMPDIR/od-sidecar-<uid>/<sha256[:32]>.sock`).

`bin/open-design-mcp` computes `OD_MCP_DISCOVERY` dynamically at launch for both `runtime` (GUI) and `headless` modes and sets:
- `OD_MCP_BOOTSTRAP_COMMAND="/usr/bin/open"`
- `OD_MCP_BOOTSTRAP_ARGS=["-g","-j","<app-path>","--args","--headless","--od-mcp-managed"]`
- `OD_MCP_STDIO_IDLE_EXIT_MS=0` (prevents 30-minute idle exits during long `agy` sessions)

If the caller explicitly sets `OD_DAEMON_URL` or passes `--daemon-url <url>`, managed sidecar bootstrap is skipped and calls route directly to that URL.

### 3.5 OpenDesign MCP Surface
The stdio server (`open-design`) exposes **22 tools** and **4 resource families** (all readable natively by `agy`):
- **Brief (local-only, no daemon required)**: `collect_brief`, `confirm_brief`, and resource `ui://open-design/artifact-card-v8.html`
- **Project inspection & files**: `list_projects`, `get_active_context`, `get_project`, `list_files`, `get_file`, `search_files`, `get_artifact`, `create_project`, `create_artifact`, `write_file`, `delete_file`, `delete_project`
- **Catalog discovery**: `list_skills`, `list_plugins`, `list_agents`
- **Cloud auth & runs**: `start_vela_login`, `get_vela_login_status`, `start_run` *(ToS rule: never pass `agent: "antigravity"`)*, `get_run`, `cancel_run`
- **MCP Resources**: `od://focus/active`, `od://skills/<id>/SKILL.md`, `od://design-systems/<id>/DESIGN.md`, `ui://open-design/artifact-card-v8.html`

## 4. Thin-Adapter Upstream-Sync Pattern

To apply OpenDesign redesigns to an active frontend repository without fighting merge conflicts on every `git pull`:

| Layer | Paths | Ownership & Sync Behavior |
| :--- | :--- | :--- |
| **Isolated Redesign Layer** | `components/redesign/**`, `tokens.{css,scss}`, `DESIGN.md`, `.agents/rules/open-design.md` | Owned by the design layer; rarely touched by upstream feature PRs. |
| **Thin-Adapter Seams** | Page shells / entry files mounting `components/redesign/*` via concise props | Minimal diff footprint; on merge conflict, keep upstream logic and preserve the thin mount. |
| **Upstream UI Surfaces** | Remaining pages and shared UI components | Styled strictly with `var(--...)` tokens; audited post-merge via the skill's internal `od-sync-audit.mjs`. |
| **Upstream Business Logic** | `services/`, `api/`, `hooks/`, `store/`, backend, copy contracts | Untouched during visual redesigns. |
