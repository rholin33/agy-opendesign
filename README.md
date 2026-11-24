# agy-opendesign

**ToS-compliant OpenDesign integration & upstream-safe frontend redesign toolkit for Google Antigravity CLI (`agy`) on macOS.**

[English](./README.md) | [简体中文](./README.zh-CN.md)

---

## Why Solution B?

Launching Google Antigravity (`agy`) *inside* a third-party desktop wrapper risks violating consumer OAuth terms of service. **Solution B** flips the direction cleanly:

- Official **`agy` CLI** remains your primary, ToS-compliant coding and design-migration client.
- **OpenDesign** (`Open Design.app`) runs strictly as a downstream **MCP server** (`open-design`, 22 tools + `od://` design-system & skill resources) and local design-asset library.
- **Hard ToS Guardrail**: Built-in project rules forbid calling OpenDesign MCP `start_run` with `agent: "antigravity"` or letting OpenDesign wrap `agy`.
- **macOS-Native Reliability**:
  - Avoids the macOS `/usr/bin/od` (octal dump) binary collision via non-colliding `open-design-mcp` / `open-design-cli` wrappers.
  - Uses `Open Design Helper.app` with `ELECTRON_RUN_AS_NODE=1` (`LSUIElement=true` — no Dock icon bounce, exact native Node ABI parity, zero `nvm`/`PATH` fragility).
  - Registers directly in `~/.gemini/config/mcp_config.json` via `agy mcp add` (avoiding OpenDesign's legacy `~/.gemini/antigravity/mcp_config.json` path mismatch).
  - Dynamically computes `@open-design/sidecar` Unix IPC discovery sockets at runtime so ephemeral daemon ports and headless auto-bootstrap survive app upgrades.

---

## Architecture

```text
Google Antigravity CLI (`agy`, official primary client)
 ├── MCP Layer (~/.gemini/config/mcp_config.json)
 │    └── $HOME/.local/bin/open-design-mcp
 │         ├── Open Design Helper.app (ELECTRON_RUN_AS_NODE=1, LSUIElement=true)
 │         ├── Dynamic @open-design/sidecar IPC discovery (OD_MCP_DISCOVERY)
 │         └── Connects to / auto-bootstraps Open Design.app --headless
 └── Project Asset & Sync Layer (bootstrapped per repo)
      ├── DESIGN.md                               (Project design specification)
      ├── .agents/skills.json                     (Selective include_only OpenDesign skills; local-excluded)
      ├── .agents/rules/open-design.md            (ToS guardrail + thin-adapter boundary)
      ├── .agents/skills/od-design-refine/        (5-step surgical critique & polish workflow)
      ├── .agents/skills/od-upstream-sync/        (Upstream git sync & audit playbook)
      └── scripts/od-sync-audit.mjs               (Zero-dep drift & anti-AI-slop auditor)
```

See [docs/architecture.md](./docs/architecture.md) for technical details on sidecar discovery, MCP resources, and the thin-adapter isolation model.

---

## Prerequisites

- **macOS** with [Open Design](https://open-design.ai/) installed at `/Applications/Open Design.app` (e.g. `brew install --cask open-design`, or set `OPEN_DESIGN_APP`)
- **Google Antigravity CLI (`agy`)** installed and authenticated
- **Node.js** `>= 18` (for running `scripts/od-sync-audit.mjs` and `tests/smoke.test.mjs`)

---

## Quickstart

### 1. First-Launch macOS Gatekeeper / TCC Check (Important)

If you just installed Open Design via Homebrew Cask and have never opened it before, launch it interactively **once**:

```bash
open "/Applications/Open Design.app"
```

> **Why?** On first launch, `Open Design.app` reads download attribution metadata in `~/Downloads`, which triggers a one-time macOS TCC permission prompt (`"Open Design" would like to access files in your Downloads folder`). In background `--headless` mode, macOS holds that call until answered. Answering Allow or Don't Allow once interactively permanently unblocks silent headless auto-bootstrap. Never strip `com.apple.quarantine` or bypass Gatekeeper.

### 2. Install Wrappers & Register MCP in `agy`

```bash
git clone https://github.com/rholin33/agy-opendesign.git
cd agy-opendesign

# Preview first (no changes written)
./scripts/install.sh --dry-run

# Install ~/.local/bin/open-design-{mcp,cli} and run `agy mcp add open-design ...`
./scripts/install.sh

# Verify
agy mcp list
"$HOME/.local/bin/open-design-cli" tools directions --json
```

Useful `install.sh` flags: `--bin-dir <dir>`, `--app-path <path>`, `--agy-bin <path>`, `--no-mcp`, `--dry-run`.

### 3. Bootstrap Any Frontend Repository

```bash
./scripts/init-project.sh /path/to/your-frontend-repo
```

This adds:
- `.agents/skills.json` (mounted selectively with `include_only` from your local `Open Design.app`, automatically added to `.git/info/exclude` so machine-local macOS paths stay untracked)
- `.agents/rules/open-design.md` (ToS compliance guardrail + thin-adapter boundary)
- `.agents/skills/od-design-refine/SKILL.md` (5-step surgical polish loop)
- `.agents/skills/od-upstream-sync/SKILL.md` (upstream remote sync playbook)
- `scripts/od-sync-audit.mjs` (zero-dependency drift & compliance auditor)
- `DESIGN.md` (starter template, created only if not already present)

Useful `init-project.sh` flags: `--app-path <path>`, `--no-exclude`, `--no-design-md`, `--force`, `--dry-run`.

### 4. Upstream-Sync & Compliance Workflow

Keep structural UI redesign components isolated under `components/redesign/` and raw color values inside a dedicated token stylesheet (`tokens.css` / `tokens.scss`). After every `git pull`, `git merge`, or `git rebase`:

```bash
cd /path/to/your-frontend-repo
node scripts/od-sync-audit.mjs --strict
```

Supported audit flags:
- `--root <dir>` — target repository root
- `--src <dir>` — frontend source dir(s) to scan (auto-detects `src`, `apps/*/src`, `packages/*/src`, `frontend/src`, `web/src`, `client/src`)
- `--tokens <path>` — token file(s) excluded from raw-hex checks (auto-detects `**/tokens.{css,scss,less}`)
- `--redesign-dir <path>` — isolated redesign directory (defaults to `**/components/redesign/**`)
- `--base <ref>` — git ref for drift diff (auto-detects `@{upstream}` → `origin/main` → `origin/master` → `upstream/main` → `HEAD`)
- `--strict` — fail on P1 warnings (raw hex outside token files, `!important`) in addition to P0 violations (AI indigo hexes, unguarded `color-mix()`, left-border rounded cards) and Solution B readiness
- `--skip-solution-b` — skip local `agy` / macOS bundle checks (handy for Linux CI)
- `--json` — machine-readable JSON output

Then open `agy` in the target repo and invoke `$od-upstream-sync` or `$od-design-refine`.

---

## Upgrading & Uninstalling

### Upgrade OpenDesign
```bash
brew upgrade --cask open-design
```
Because the wrappers and `.agents/skills.json` resolve live bundle paths and dynamic sidecar sockets, upgrades take effect immediately with no MCP re-registration. If macOS sets a fresh quarantine flag on the upgraded app, launch `open "/Applications/Open Design.app"` interactively once.

### Uninstall
```bash
./scripts/uninstall.sh --dry-run
./scripts/uninstall.sh
```

---

## Running Smoke Tests

```bash
node --test tests/smoke.test.mjs
```

---

## Troubleshooting

- **MCP initialization times out on first run**: Launch `open "/Applications/Open Design.app"` once interactively to clear the macOS Gatekeeper / Downloads TCC dialog, then retry.
- **Standalone daemon mode (without launching Electron GUI)**:
  ```bash
  "$HOME/.local/bin/open-design-cli" daemon start --headless --port 7456
  OD_DAEMON_URL=http://127.0.0.1:7456 "$HOME/.local/bin/open-design-mcp"
  ```
- **Need to pause OpenDesign auto-bootstrap in non-design sessions**: Run `agy mcp disable open-design` (re-enable anytime with `agy mcp enable open-design`).
- **Running bare `od` prints octal bytes**: That is macOS `/usr/bin/od`. Always use `open-design-cli` or `open-design-mcp`.

---

## License

[Apache-2.0](./LICENSE)
