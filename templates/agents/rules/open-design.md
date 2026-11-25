# OpenDesign Integration Rules (Solution B)

## Primary Client & ToS Boundary
- Official Google Antigravity CLI (`agy`) stays the primary coding and design-migration agent.
- Consume OpenDesign strictly as a downstream MCP server (`open-design`) and local design-asset library.
- **HARD RULE**: NEVER call OpenDesign MCP `start_run` with `agent: "antigravity"`, and NEVER configure `agy` as an inner agent spawned by OpenDesign.

## Design Specification & Skills
- Follow `DESIGN.md` at the repository root as the single source of truth for visual tokens, typography, layout rhythm, accessibility, and anti-AI-slop rules.
- Use the mounted OpenDesign skills (`od-code-migration`, `od-design-refine`, `od-upstream-sync`, `frontend-design`, `design-md`, `design-review`, `impeccable-design-polish`, `redesign-skill`, `web-design-guidelines`, `ui-skills`) when planning, migrating, or polishing UI changes.
- Reference design systems and craft guidelines are also readable via OpenDesign MCP resources (`od://design-systems/<id>/DESIGN.md`, `od://skills/<id>/SKILL.md`).

## macOS CLI Invocation
- Do NOT run bare `od` (shadowed by macOS `/usr/bin/od`).
- Use `$HOME/.local/bin/open-design-cli` for OpenDesign CLI commands (e.g. `tools directions --json`, `lint`) and `$HOME/.local/bin/open-design-mcp` for MCP stdio.

## Upstream-Sync & Redesign Isolation
- **Dedicated Refactor Branch by Default**: Before making frontend refactoring edits on a git repository, automatically create and switch to a dedicated feature branch via `git checkout -b feat/opendesign-redesign-<YYYYMMDD>` (or `feat/opendesign-<topic>`) rather than editing directly on `main`/`master`/the default branch (skip only if already on a dedicated `opendesign` branch or the user explicitly instructs staying on the current branch). Preserve uncommitted changes without rewriting history, and never push to a remote unless explicitly asked.
- Keep structural UI redesign components isolated under `components/redesign/` (and design tokens in a dedicated `tokens.css` / `tokens.scss`), mounted via thin prop adapters in upstream pages so remote git updates merge cleanly.
- After any upstream `git pull` / `git merge` / `git rebase`, run `node scripts/od-sync-audit.mjs --strict` to detect frontend drift and OpenDesign P0/P1 regressions.
- Follow the `od-upstream-sync` skill (`.agents/skills/od-upstream-sync/SKILL.md`) for repeatable upstream reconciliation and OpenDesign upgrades.
