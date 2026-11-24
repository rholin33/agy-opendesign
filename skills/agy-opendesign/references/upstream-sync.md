# Upstream Remote Sync & OpenDesign Upgrade Reference

Read this reference when running Step 5 (Upstream Remote Sync Mode) of `agy-opendesign`.

## 1. Inspect Git State Before Syncing

Always inspect git status, remotes, and tracking branches before integrating upstream changes:

```bash
git status -sb
git remote -v
git branch -vv
```

- Never discard uncommitted user work; ask before mutating git history or pushing to a remote.
- Prefer keeping OpenDesign redesign commits cleanly separated on a feature branch (or concise commits) so `git merge <upstream>` or `git rebase <upstream>` stays predictable.

## 2. Thin-Adapter Conflict Resolution Rules

When merging or rebasing upstream changes into thin-adapter seam files (e.g. `pages/index/*`, shell components, root `app.scss`):

1. **Always keep upstream business logic**: state hooks, API calls, error handling, analytics, routing, and frozen copy contracts.
2. **Preserve the isolated `redesign/` layer**: never drop `components/redesign/*` or `tokens.{css,scss}` during conflict resolution.
3. **Re-bind minimal props**: pass any newly added upstream state/callbacks cleanly into the `redesign/*` presentation component.

## 3. Automated Post-Sync Drift Audit

Immediately after upstream integration, execute the bundled internal auditor transparently (never make the user run it manually):

```bash
node "${AGY_OPENDESIGN_HOME:-$HOME/.local/share/agy-opendesign}/scripts/od-sync-audit.mjs" \
  --root . \
  --base origin/main \
  --json
```

*(Pass `--base <ref>` matching the integrated remote branch, or omit `--base` to auto-detect `@{upstream}` → `origin/main` → `origin/master` → `upstream/main` → `HEAD`.)*

Act on the report by tier:
- **`upstream_ui`**: inspect newly added or edited pages/components for raw hexes, `!important`, broken token usage, or visual drift; migrate to CSS variables from `tokens.*` and isolate structural layout upgrades into `components/redesign/`.
- **`thin_adapter_seam`**: confirm minimal prop wiring and clean responsive behavior across mobile (`390x844`) and desktop (`>=1280px`).
- **`upstream_logic_config`**: verify no visual regression or broken unit test was introduced; do not alter business logic.
- **`redesign_isolated`**: confirm zero P0/P1 violations remain.

## 4. Reconciling New Upstream Surfaces via OpenDesign MCP

For brand-new upstream pages or major components:
1. Read `DESIGN.md` and the project's token stylesheet.
2. Use `read_resource` on the `open-design` MCP server (`od://design-systems/<id>/DESIGN.md`, `od://skills/od-code-migration/SKILL.md`, `od://skills/frontend-design/SKILL.md`) to ensure visual consistency.
3. Apply localized token/redesign patches, run `od-sync-audit.mjs --root . --strict`, run the project's typecheck/unit tests/production builds, and perform a 5-dimensional visual critique pass.

## 5. Upgrading OpenDesign Itself

Because `open-design-mcp` and `open-design-cli` resolve live bundle paths inside `${OPEN_DESIGN_APP:-/Applications/Open Design.app}` and dynamically compute `@open-design/sidecar` sockets, upgrading OpenDesign requires no MCP re-registration:

```bash
brew upgrade --cask open-design
```

If macOS applies a fresh quarantine attribute on the upgraded app bundle, instruct the user to run `open "/Applications/Open Design.app"` interactively once (never bypass Gatekeeper), then verify via `agy mcp list` and `list_resources` on `open-design`.
