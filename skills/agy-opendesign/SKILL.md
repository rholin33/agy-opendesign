---
name: agy-opendesign
description: >-
  End-to-end OpenDesign workflow for Google Antigravity CLI (agy): automatically
  verifies OpenDesign MCP & project setup, curates DESIGN.md and WCAG AA tokens
  from OpenDesign resources, executes upstream-safe thin-adapter frontend
  redesigns (Home, Workflow, layouts, components), runs automated anti-AI-slop
  audits and 5-dimensional visual critique, and reconciles remote upstream git
  updates. Activate whenever the user asks to use OpenDesign, redesign or polish
  a frontend UI, create/update DESIGN.md, or sync upstream repo changes with an
  OpenDesign layer.
---

# OpenDesign All-in-One Workflow (`agy-opendesign`)

Operate the **entire** OpenDesign lifecycle directly inside `agy` — **never ask the user to run `init-project.sh` or `od-sync-audit.mjs` manually**. Handle preflight checks, MCP curation, isolated refactoring, automated audits, visual verification, and upstream git reconciliation transparently.

## Hard Rules (Always Enforce)

1. **ToS Compliance (Solution B)**: Official `agy` CLI stays the sole primary agent editing the repository. Consume OpenDesign strictly via the `open-design` MCP server and local read-only OpenDesign assets. **NEVER** call OpenDesign MCP `start_run` with `agent: "antigravity"`, and **NEVER** configure `agy` as an inner runtime spawned by OpenDesign.
2. **macOS `/usr/bin/od` Shadow**: Never invoke bare `od`. Always use `"$HOME/.local/bin/open-design-cli"` and `"$HOME/.local/bin/open-design-mcp"`.
3. **Preserve Upstream Contracts**: Keep all uncommitted user work, business logic (`services/`, `api/`, `hooks/`, `store/`), routing, and frozen copy/test invariants intact.
4. **Never Bypass OS Security**: Never strip `com.apple.quarantine` or bypass Gatekeeper/TCC. If a fresh Open Design install pauses on a first-launch macOS dialog, ask the user to run `open "/Applications/Open Design.app"` interactively once.

---

## Step 1 — Automatic Preflight & Silent Project Setup

1. Verify MCP and local bundle readiness:
   - Call `list_resources` on the `open-design` MCP server (or inspect `"${OPEN_DESIGN_APP:-/Applications/Open Design.app}/Contents/Resources/open-design"` if needed).
   - Run the bundled internal audit helper transparently from the global toolkit share directory:
     ```bash
     node "${AGY_OPENDESIGN_HOME:-$HOME/.local/share/agy-opendesign}/scripts/od-sync-audit.mjs" --root .
     ```
2. Ensure project-local guardrails exist (create silently if missing, without clobbering existing files):
   - If `.agents/rules/open-design.md` is missing, create it with the ToS boundary and `redesign/` thin-adapter isolation rule (use `"${AGY_OPENDESIGN_HOME:-$HOME/.local/share/agy-opendesign}/templates/agents/rules/open-design.md"` as reference).
   - If `DESIGN.md` is missing, proceed to Step 2 to author a tailored `DESIGN.md` (reference template in [references/design-md-template.md](./references/design-md-template.md)).

---

## Step 2 — Frontend Audit & OpenDesign Curation

1. Inspect the repository's frontend stack, styling system, existing tests, build commands, and `git status` before making any edits.
2. Curate design direction directly from OpenDesign MCP resources:
   - Use `list_resources` / `read_resource` on `open-design` to inspect candidate design systems (`od://design-systems/<id>/DESIGN.md`) and official skills (`od://skills/od-code-migration/SKILL.md`, `od://skills/frontend-design/SKILL.md`).
   - Optionally inspect built-in directions offline via `"$HOME/.local/bin/open-design-cli" tools directions --json`.
3. Author or update `DESIGN.md` at the repo root with:
   - Visual philosophy and single primary accent (WCAG 2.2 AA `>= 4.5:1` for body text, `>= 3:1` for UI/large text).
   - Complete CSS custom property token sheet (`--bg`, `--surface`, `--fg`, `--muted`, `--border`, `--accent`, semantic states, spacing, radii, elevation, typography).
   - Typography rules (including CJK `line-height: 1.3–1.4` and `letter-spacing: 0` when Chinese/Japanese/Korean copy is present, plus `tabular-nums` for metrics).
   - Platform-specific constraints (responsive breakpoints, glass `backdrop-filter` solid fallbacks, `prefers-reduced-motion`, mini-program / CSS compatibility).

---

## Step 3 — Upstream-Safe Thin-Adapter Refactoring

Structure edits so future remote `git pull` / `git merge` / `git rebase` updates apply cleanly with minimal conflicts:

1. **Centralize Tokens First**: Create or update a dedicated token stylesheet (`tokens.css` / `tokens.scss`) as the sole place raw hex literals live.
2. **Isolate Structural Redesigns**: Put new or structurally redesigned presentation components and stylesheets inside a dedicated `redesign/` directory (e.g. `src/components/redesign/`).
3. **Use Thin-Adapter Seams**: Keep existing upstream page entrypoints (`pages/index/*`, shell components, routes) focused on state, hooks, API handlers, and copy keys, passing clean props into `redesign/*`.
4. **Eliminate Anti-AI-Slop & Specificity Wars**:
   - Zero AI indigo hexes (`#6366f1`, `#4f46e5`, `#4338ca`, `#8b5cf6`, `#7c3aed`) outside explicit user-requested brand specs.
   - Zero unguarded `color-mix()` (wrap in `@supports` or use pre-blended solid tokens).
   - Zero rounded cards decorated with thick colored `border-left` accent bars.
   - Zero raw hex drift outside token files and zero unnecessary `!important` declarations.

---

## Step 4 — Automated Audit, Build & 5-Dimensional Visual Polish

After implementing changes:

1. Run the internal bundled compliance auditor in strict mode:
   ```bash
   node "${AGY_OPENDESIGN_HOME:-$HOME/.local/share/agy-opendesign}/scripts/od-sync-audit.mjs" --root . --strict
   ```
2. Run the project's typecheck, unit tests, and production build(s). Never suppress failures by weakening test assertions.
3. Inspect live rendered views (mobile `390x844` + desktop `>=1280px`) whenever a local preview can be started, checking zero console/page errors, zero broken images, zero horizontal overflow, and clean responsive controls.
4. Execute the **Five-Dimensional Critique & Surgical Polish Loop** in [references/critique-checklist.md](./references/critique-checklist.md) (target `>= 4/5` on every axis, max 3 focused polish passes).

---

## Step 5 — Upstream Remote Sync Mode

When the user asks to pull, merge, rebase, or reconcile upstream remote repository updates:

- Follow the complete step-by-step playbook in [references/upstream-sync.md](./references/upstream-sync.md).
- Run `node "${AGY_OPENDESIGN_HOME:-$HOME/.local/share/agy-opendesign}/scripts/od-sync-audit.mjs" --root . --base <upstream-ref> --json` transparently under the hood to classify drift (`redesign_isolated`, `thin_adapter_seam`, `upstream_ui`, `upstream_logic_config`).
- Preserve upstream business logic on every seam conflict, align newly added upstream UI surfaces with `DESIGN.md` and `tokens.*`, and re-verify before handoff.
