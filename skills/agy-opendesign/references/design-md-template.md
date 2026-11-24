# DESIGN.md — Starter Template

Use this structure when authoring a project's `DESIGN.md` in Step 2 of `agy-opendesign`. Tailor every token and rule to the repository's domain and chosen OpenDesign reference system (`od://design-systems/<id>/DESIGN.md`).

```markdown
# DESIGN.md — <Product Name> Design System

## 1. Visual Theme & Philosophy
- **Product Personality**: <concise domain-specific aesthetic direction>
- **Core Restraint**: One primary accent, calm surface hierarchy, content-first layout.
- **Upstream Isolation**: Structural redesign components live under `components/redesign/`; all raw palette values live exclusively in `tokens.{css,scss}`.

## 2. Color Tokens (WCAG 2.2 AA)
- Surfaces: `--bg`, `--surface`, `--surface-subtle`, `--surface-dark`
- Foregrounds: `--fg`, `--fg-secondary`, `--muted`, `--fg-inverse`
- Borders: `--border`, `--border-soft`
- Brand Accent (`>= 4.5:1` with `--accent-on`): `--accent`, `--accent-hover`, `--accent-soft`, `--accent-on`
- Semantic States: `--success` / `--success-soft`, `--warn` / `--warn-soft`, `--danger` / `--danger-soft`

## 3. Typography & Scale
- Display & body font stacks (max 2 families)
- Scale variables (`--text-xs` .. `--text-3xl`)
- CJK leading (`1.3–1.4`) & tracking (`0`), plus `tabular-nums` for counters/metrics

## 4. Layout, Spacing & Elevation
- Spacing tokens (`4px`–`48px`), container max width, responsive breakpoints (`390px` mobile, `>=900px`/`1280px` desktop)
- `44px` minimum interactive touch target
- Hairline borders + subtle ambient shadows; `@supports not (backdrop-filter)` & `prefers-reduced-motion` fallbacks

## 5. Component Primitives & Domain Invariants
- Converged button/card/sheet primitives with `:focus-visible`
- Preserved routes, API hooks, test assertions, and copy constraints

## 6. Quality Gates
- P0 bans: AI indigo hexes, unguarded `color-mix()`, rounded cards with thick `border-left`
- P1 hygiene: zero raw hexes outside `tokens.*`, zero `!important` wars
- 5-dimensional critique score `>= 4/5` on every axis
```
