# agy-opendesign

**One-line, ToS-compliant OpenDesign integration & upstream-safe frontend redesign Skill for Google Antigravity CLI (`agy`) on macOS.**

[English](./README.md) | [简体中文](./README.zh-CN.md)

---

## One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/rholin33/agy-opendesign/main/install.sh | sh
```

That's it. **No per-project setup scripts to run.** Open **any** frontend repository in `agy` and talk to the global **`agy-opendesign`** skill directly:

- *"Use `agy-opendesign` to curate `DESIGN.md` and redesign our Home and Workflow pages with an upstream-safe `redesign/` layer."*
- *"Use `agy-opendesign` to polish the Settings screen and run the 5-dimensional visual critique."*
- *"Use `agy-opendesign` to sync remote `origin/main` updates and reconcile any new upstream UI with `DESIGN.md`."*

---

## Why Solution B?

Launching Google Antigravity (`agy`) *inside* a third-party desktop wrapper risks violating consumer OAuth terms of service. **Solution B** flips the control direction cleanly:

- **Official `agy` CLI stays your sole primary client** for all coding, design migration, and git workflows.
- **OpenDesign (`Open Design.app`)** runs strictly as a downstream **MCP server** (`open-design`, 22 tools + `od://` design-system & skill resources) and read-only local design-asset library.
- **Hard ToS Guardrail**: The global skill and rules strictly forbid calling OpenDesign MCP `start_run(agent: "antigravity")` or letting OpenDesign wrap `agy`.
- **Zero-Friction Global Skill**: Installed to `~/.gemini/config/skills/agy-opendesign/`, auto-discovered by `agy` in every workspace. Helper utilities (`od-sync-audit.mjs`, templates) live internally under `~/.local/share/agy-opendesign/` and are invoked transparently by the skill — users never need to run `init-project.sh` or `od-sync-audit.mjs` manually.
- **macOS-Native Hardening**:
  - Avoids macOS `/usr/bin/od` collision via `open-design-mcp` / `open-design-cli` wrappers.
  - Uses `Open Design Helper.app` + `ELECTRON_RUN_AS_NODE=1` (`LSUIElement=true` — no Dock icon bounce, exact native Node ABI parity, zero `nvm`/`PATH` fragility).
  - Registers directly into `~/.gemini/config/mcp_config.json` via `agy mcp add` (avoiding OpenDesign's legacy `~/.gemini/antigravity/mcp_config.json` path mismatch).
  - Dynamically computes `@open-design/sidecar` Unix IPC sockets for seamless headless auto-bootstrap across OpenDesign upgrades.

---

## Architecture

```text
Google Antigravity CLI (`agy`, official primary client)
 ├── Global Skill Layer (~/.gemini/config/skills/agy-opendesign/)
 │    ├── SKILL.md                          (All-in-one: preflight, MCP curation, thin-adapter refactor, critique, upstream sync)
 │    └── references/                       (upstream-sync.md, critique-checklist.md, design-md-template.md)
 ├── MCP Layer (~/.gemini/config/mcp_config.json)
 │    └── $HOME/.local/bin/open-design-mcp
 │         ├── Open Design Helper.app (ELECTRON_RUN_AS_NODE=1, LSUIElement=true)
 │         ├── Dynamic @open-design/sidecar IPC discovery (OD_MCP_DISCOVERY)
 │         └── Connects to / auto-bootstraps Open Design.app --headless
 └── Internal Toolkit Payload (~/.local/share/agy-opendesign/)
      ├── scripts/od-sync-audit.mjs         (Zero-dep drift & anti-AI-slop auditor, run transparently by the skill)
      ├── templates/                        (Reference templates used by the skill)
      └── bin/                              (Wrapper sources)
```

See [docs/architecture.md](./docs/architecture.md) for technical details on sidecar IPC discovery, MCP resources, and the thin-adapter upstream-sync model.

---

## Prerequisites

- **macOS** with [Open Design](https://open-design.ai/) at `/Applications/Open Design.app` (install via `brew install --cask open-design`, or pass `--app-path`)
- **Google Antigravity CLI (`agy`)** installed and authenticated
- **Node.js** `>= 18`

### First-Launch macOS Gatekeeper / TCC Note (Important)

If you installed Open Design via Homebrew Cask and have never opened it before, launch it interactively **once**:

```bash
open "/Applications/Open Design.app"
```

> On first launch, `Open Design.app` checks download attribution in `~/Downloads`, triggering a one-time macOS privacy prompt. In background `--headless` mode, macOS holds that call until answered. Completing this prompt once interactively (Allow or Don't Allow) permanently unblocks silent headless auto-bootstrap. Never strip `com.apple.quarantine` or bypass Gatekeeper.

---

## Installer Options, Upgrading & Uninstalling

### Preview or Customize Install
```bash
# Dry-run preview (no files written)
curl -fsSL https://raw.githubusercontent.com/rholin33/agy-opendesign/main/install.sh | sh -s -- --dry-run

# Pin a specific branch or tag
curl -fsSL https://raw.githubusercontent.com/rholin33/agy-opendesign/main/install.sh | AGY_OPENDESIGN_REF=main sh

# Custom paths or local clone
./install.sh --bin-dir "$HOME/.local/bin" --share-dir "$HOME/.local/share/agy-opendesign" --skills-dir "$HOME/.gemini/config/skills" --app-path "/Applications/Open Design.app"
```

Flags: `--uninstall`, `--dry-run`, `--bin-dir <dir>`, `--share-dir <dir>`, `--skills-dir <dir>`, `--app-path <path>`, `--agy-bin <path>`, `--no-mcp`.

### Upgrade OpenDesign & Local Upstream Verification
```bash
# Check upstream nexu-io/open-design releases, local app/brew/agy versions, and MCP compatibility
node "${AGY_OPENDESIGN_HOME:-$HOME/.local/share/agy-opendesign}/scripts/check-upstream.mjs"
# (or from a local clone: node scripts/check-upstream.mjs)

# Upgrade OpenDesign when a new release is available
brew upgrade --cask open-design
```
Wrappers and dynamic sidecar discovery target stable paths inside `Open Design.app`, so OpenDesign upgrades work immediately with no MCP re-registration. If macOS sets a fresh quarantine flag on the updated bundle, run `open "/Applications/Open Design.app"` interactively once.

**Periodic local check & release workflow (no CI/GitHub Actions required)**:
- Use `agy`'s `/schedule` command to run `node scripts/check-upstream.mjs` periodically on your macOS machine (`UP_TO_DATE`, `UPSTREAM_UPDATE_AVAILABLE`, or `COMPAT_DRIFT`).
- Optional email alerts on updates or drift (SMTP SSL/STARTTLS or Resend API; configure `~/.config/agy-opendesign/notify.env` with mode `0600`, e.g. `NOTIFY_TO=you@example.com`):
  ```bash
  node "${AGY_OPENDESIGN_HOME:-$HOME/.local/share/agy-opendesign}/scripts/check-upstream.mjs" --json \
    | python3 "${AGY_OPENDESIGN_HOME:-$HOME/.local/share/agy-opendesign}/scripts/notify-email.py" --only-on-change
  ```
- When upgrading `agy-opendesign` for a new OpenDesign version:
  1. `brew upgrade --cask open-design`
  2. `node scripts/check-upstream.mjs` & `node --test tests/smoke.test.mjs`
  3. Update `upstream-lock.json`, commit, and tag/release (`git tag vX.Y.Z && git push origin main --tags` or `gh release create vX.Y.Z`).

### One-Line Uninstall
```bash
curl -fsSL https://raw.githubusercontent.com/rholin33/agy-opendesign/main/install.sh | sh -s -- --uninstall
```
Removes `~/.local/bin/open-design-{mcp,cli}`, `~/.gemini/config/skills/agy-opendesign/`, `~/.local/share/agy-opendesign/`, and unregisters `open-design` from `agy`.

---

## Troubleshooting & Advanced Helpers

- **MCP initialization times out on first run**: Launch `open "/Applications/Open Design.app"` once interactively to clear the macOS Gatekeeper / Downloads TCC dialog, then retry.
- **Pause OpenDesign MCP in non-design sessions**: Run `agy mcp disable open-design` (re-enable with `agy mcp enable open-design`).
- **Standalone fixed-port daemon (without Electron GUI)**:
  ```bash
  "$HOME/.local/bin/open-design-cli" daemon start --headless --port 7456
  OD_DAEMON_URL=http://127.0.0.1:7456 "$HOME/.local/bin/open-design-mcp"
  ```
- **Running bare `od` prints octal bytes**: That is macOS `/usr/bin/od`. Always use `open-design-cli` or `open-design-mcp`.
- **Internal helpers**: `scripts/od-sync-audit.mjs` (zero-dep compliance & drift auditor) and `scripts/init-project.sh` (optional project file copier) remain available inside `~/.local/share/agy-opendesign/scripts/` for CI pipelines, though interactive users never need to invoke them manually.

---

## Running Smoke Tests

```bash
node --test tests/smoke.test.mjs
```

---

## License

[Apache-2.0](./LICENSE)
