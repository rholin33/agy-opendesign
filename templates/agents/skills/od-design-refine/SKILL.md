---
name: od-design-refine
description: Surgical post-implementation UI refinement workflow adapted from OpenDesign — lock one refinement direction, apply the smallest high-leverage patch against DESIGN.md, run five-dimensional critique + anti-AI-slop checks until every axis scores >=4/5 (max 3 passes), and hand off with build/test verification.
---

# OpenDesign Design Refine (`od-design-refine`)

Use this skill when polishing or refining existing frontend surfaces rather than creating a greenfield prototype. It wraps OpenDesign's 5-step critique-and-polish loop with valid Antigravity (`agy`) frontmatter and project-agnostic guardrails.

## Inputs to Read First

1. Read `DESIGN.md` at the repository root (token contract, typography rules, spacing/radii, accessibility floor, and anti-AI-slop constraints).
2. Inspect the exact target source files and, whenever possible, render the live UI at both mobile (`390x844`) and desktop (`>=1280px`) viewports before editing.

## Five-Step Refinement Loop

1. **Diagnose & Lock One Direction (`direction-picker`)**
   - Identify the single highest-leverage visual or ergonomic defect.
   - Commit to **one** direction per pass: `clarity`, `hierarchy`, `polish`, `accessibility`, `responsiveness`, or `brand-fidelity`.
2. **Apply a Minimal Surgical Patch (`patch-edit`)**
   - Keep edits localized to the target surface; prefer `components/redesign/` for structural presentation upgrades.
   - Replace raw hex colors and `!important` specificity wars with semantic CSS variables from your token stylesheet.
   - Preserve existing business logic, API hooks, routing, and user-facing copy contracts.
3. **Verify Build, Audit & Tests (`build-test`)**
   - Run `node scripts/od-sync-audit.mjs --strict` alongside the repository's typecheck, unit tests, and production build.
   - Never hide failures by weakening test assertions.
4. **Five-Dimensional Critique & Anti-AI-Slop Gate (`critique-theater`)**
   - Score `1–5` on every dimension with concrete file/selector/screenshot evidence:
     1. **Brand & Philosophy Consistency** — adheres to `DESIGN.md` tokens, palette restraint, and surface hierarchy.
     2. **Visual Hierarchy & Craft** — clear focal point, deliberate typography/spacing rhythm, zero clipping or overflow.
     3. **Execution & Restraint** — zero AI-slop indigo (`#6366f1` / `#4f46e5` / `#4338ca`), zero unguarded `color-mix()`, zero rounded cards with thick colored left borders, zero decorative emoji icons.
     4. **Accessibility & Responsiveness** — WCAG 2.2 AA contrast (`>=4.5:1` body, `>=3:1` UI/large), `>=44px` touch targets, `:focus-visible`, `prefers-reduced-motion`, solid fallback for `backdrop-filter`.
     5. **Copy Specificity & Functional Parity** — honest domain copy across Loading / Empty / Error / Populated / Edge states.
   - Repeat steps 2–4 if any axis scores `< 4/5` (any `< 3/5` blocks handoff). Stop after **3 passes** or when changes plateau.
5. **Concise Handoff (`handoff`)**
   - Report exact files modified, critique improvements verified, command outputs, and any intentionally deferred items. Do not leave temporary scratch artifacts in the repository.
