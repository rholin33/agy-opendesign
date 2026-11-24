# OpenDesign Five-Dimensional Critique & Anti-AI-Slop Checklist

Use this reference during Step 4 of `agy-opendesign` (adapted from OpenDesign's `od-design-refine` & `craft/anti-ai-slop.md`).

## Five-Step Surgical Polish Loop

1. **Lock One Direction**: Pick the single highest-leverage improvement (`clarity`, `hierarchy`, `polish`, `accessibility`, `responsiveness`, or `brand-fidelity`).
2. **Apply Minimal Patch**: Edit only the affected files; use semantic tokens from `tokens.{css,scss}` and keep structural layout changes inside `redesign/`.
3. **Verify Build & Audit**: Run `od-sync-audit.mjs --root . --strict` plus typecheck, unit tests, and production builds.
4. **Score All Five Dimensions (1–5)** with concrete file/selector/screenshot evidence:
   - **1. Brand & Philosophy Consistency**: Strict adherence to `DESIGN.md` surfaces, neutral ink hierarchy, and restrained primary accent (typically `<= 2` prominent accent uses per viewport).
   - **2. Visual Hierarchy & Craft**: Single clear focal entry point, deliberate typographic scale & rhythm, generous whitespace, balanced multi-line headings, zero text/image collision, zero horizontal overflow.
   - **3. Execution & Restraint (Anti-AI-Slop)**:
     - Zero generic AI indigo/violet hexes (`#6366f1`, `#4f46e5`, `#4338ca`, `#8b5cf6`, `#7c3aed`).
     - Zero unguarded `color-mix()` calls.
     - Zero rounded cards decorated with thick colored `border-left` accent bars.
     - Zero decorative emoji used in place of clean icons or typography.
     - Zero raw hex literals outside the token stylesheet; zero `!important` specificity wars.
   - **4. Accessibility & Responsiveness**:
     - WCAG 2.2 AA contrast (`>= 4.5:1` normal text, `>= 3:1` large text / UI controls).
     - `>= 44px x 44px` interactive touch targets across mobile and desktop.
     - Visible `:focus-visible` outlines.
     - CJK headings use `line-height: 1.3–1.4` and `letter-spacing: 0` (no negative tracking).
     - `font-variant-numeric: tabular-nums` on counts, metrics, prices, and step counters.
     - Solid fallback via `@supports not (backdrop-filter: blur(1px))` and `@media (prefers-reduced-motion: reduce)`.
   - **5. Copy Specificity & State Coverage**: Authentic domain copy across Loading, Empty, Error, Populated, and Edge states; zero fabricated metrics or placeholder filler.
5. **Convergence Rule**:
   - Every dimension must score **`>= 4/5`** (any score `< 3/5` is a hard block).
   - Cap surgical polish at **3 passes** or stop once further passes stop producing meaningful visual gains.
   - Do not leave temporary critique JSON or scratch screenshots inside the repository.
