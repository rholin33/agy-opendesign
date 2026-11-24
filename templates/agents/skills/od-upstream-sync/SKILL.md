---
name: od-upstream-sync
description: Repeatable local agy CLI playbook for syncing a frontend repository with upstream remote git updates while preserving an isolated OpenDesign redesign layer (components/redesign/, tokens stylesheet, DESIGN.md), auditing newly introduced UI/styles via scripts/od-sync-audit.mjs, reconciling via OpenDesign MCP resources, and upgrading OpenDesign safely on macOS.
---

# OpenDesign Upstream-Sync Playbook (`od-upstream-sync`)

Use this skill whenever syncing a repository with upstream remote git changes, reconciling newly added upstream UI surfaces with `DESIGN.md`, or upgrading OpenDesign on macOS while keeping official Google Antigravity CLI (`agy`) as the primary ToS-compliant client.

## Hard Boundaries

- **ToS Compliance**: Official `agy` CLI stays the primary coding and design-migration agent. Consume OpenDesign strictly via MCP (`open-design`) and local assets. **NEVER** call OpenDesign MCP `start_run` with `agent: "antigravity"`.
- **macOS `/usr/bin/od` Shadow**: Never run bare `od`. Always invoke `$HOME/.local/bin/open-design-cli` and `$HOME/.local/bin/open-design-mcp`.
- **Thin-Adapter Isolation**:
  - **OpenDesign isolated layer**: `components/redesign/**`, token stylesheet (`tokens.css` / `tokens.scss`), `DESIGN.md`, `scripts/od-sync-audit.mjs`, `.agents/`.
  - **Thin-adapter seams**: page entrypoints and shell wrappers that bind upstream state/handlers to `components/redesign/*` via clean props.
  - **Upstream business contracts**: services, API clients, routing, tests, and copy invariants — always preserve upstream behavior verbatim.

## Step 1 — Inspect & Sync with Upstream

1. Check local git state before pulling or rebasing:
   ```bash
   git status -sb && git remote -v && git branch -vv
   ```
2. Commit or stash local changes cleanly before integrating upstream updates:
   ```bash
   git fetch origin
   git merge origin/main
   # (or `git rebase origin/main` if maintaining a linear local redesign branch)
   ```
3. **Conflict resolution rule on thin-adapter seams**:
   - Accept upstream changes for business logic, state, hooks, API payloads, and routing.
   - Re-apply only the thin prop bindings mounting `components/redesign/*` and token imports.
   - Never drop `components/redesign/*` or let raw hardcoded colors overwrite token variables.

## Step 2 — Audit Frontend Drift & OpenDesign Compliance

Run the zero-dependency sync auditor right after every merge/rebase:

```bash
node scripts/od-sync-audit.mjs --base origin/main
# Machine-readable JSON output:
node scripts/od-sync-audit.mjs --base origin/main --json
# Strict gate (also fails on P1 raw hex literals or !important):
node scripts/od-sync-audit.mjs --base origin/main --strict
```

Review all four report sections:
1. **Frontend Drift Classification**: separates `redesign_isolated`, `thin_adapter_seam`, `upstream_ui`, and `upstream_logic_config`.
2. **Stylesheet Compliance**: flags P0 violations (AI indigo hexes, unguarded `color-mix()`, left-border rounded cards) and P1 hygiene warnings (raw hexes outside token files, `!important` declarations).
3. **Solution B Readiness**: confirms `open-design-mcp`, `~/.gemini/config/mcp_config.json`, `DESIGN.md`, `.agents/skills.json`, rules, and skills.
4. **Actionable Checklist**: work through every `[P0]`, `[P1]`, and `[Sync]` item in order.

## Step 3 — Reconcile New Upstream UI with OpenDesign MCP + `DESIGN.md`

For every new or visually changed file under `upstream_ui`:
1. Read `DESIGN.md` and your token stylesheet first so new surfaces reuse existing semantic tokens.
2. Consult OpenDesign MCP resources directly from `agy` when designing layout/component upgrades:
   - `list_resources` / `read_resource` on `open-design`:
     - `od://design-systems/<id>/DESIGN.md`
     - `od://skills/od-code-migration/SKILL.md`
     - `od://skills/frontend-design/SKILL.md`
   - Offline direction helper:
     ```bash
     "$HOME/.local/bin/open-design-cli" tools directions --json
     ```
3. Place structural presentation components inside `components/redesign/` and mount them via thin props.
4. Run `od-design-refine` for a focused visual polish pass (`>=4/5` on all five dimensions), then run final verification:
   ```bash
   node scripts/od-sync-audit.mjs --strict
   # Plus your repository's typecheck, unit tests, and production build commands
   ```

## Step 4 — Upgrading OpenDesign on macOS

Because `open-design-mcp`, `open-design-cli`, and `.agents/skills.json` resolve live paths inside `${OPEN_DESIGN_APP:-/Applications/Open Design.app}`, upgrading OpenDesign refreshes bundled skills, design systems, and the MCP runtime automatically:

```bash
brew upgrade --cask open-design
```

After upgrading:
1. If macOS sets `com.apple.quarantine` on the updated app bundle, launch it interactively once (`open "/Applications/Open Design.app"`) to approve any first-launch OS/Downloads TCC prompt (never strip quarantine attributes or bypass Gatekeeper).
2. Re-verify readiness:
   ```bash
   agy mcp list
   node scripts/od-sync-audit.mjs
   "$HOME/.local/bin/open-design-cli" tools directions --json
   ```
