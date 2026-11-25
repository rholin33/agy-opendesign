/**
 * OpenDesign Interactive Local Design Studio WebUI Renderer
 *
 * Pure ESM, zero external dependencies, zero CDN links.
 * Contract: export function renderStudioHtml(data) -> UTF-8 HTML document string.
 */

const BLANK_GIF =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJsonEmbed(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function renderStudioHtml(rawData = {}) {
  const data = {
    liveMode: Boolean(rawData.liveMode),
    projectName: rawData.projectName || 'OpenDesign Project',
    root: rawData.root || '.',
    port: rawData.port ?? null,
    generatedAt: rawData.generatedAt || new Date().toISOString(),
    audit: rawData.audit || {
      pass: true,
      p0: {},
      p1: {},
      totalFiles: 0,
      rawOutput: '',
      timestamp: '',
    },
    buildSummary: rawData.buildSummary || {},
    tokenFile: rawData.tokenFile || 'tokens.scss',
    tokens: Array.isArray(rawData.tokens) ? rawData.tokens : [],
    designMd: rawData.designMd || { path: 'DESIGN.md', content: '' },
    brief: {
      directionId: '',
      designSystemId: '',
      templateId: '',
      palette: '',
      typography: '',
      layout: '',
      vibe: '',
      density: '',
      constraints: '',
      targetPages: '',
      notes: '',
      ...(rawData.brief || {}),
    },
    directions: Array.isArray(rawData.directions) ? rawData.directions : [],
    designSystems: Array.isArray(rawData.designSystems) ? rawData.designSystems : [],
    designTemplates: Array.isArray(rawData.designTemplates) ? rawData.designTemplates : [],
    screenshots: Array.isArray(rawData.screenshots) ? rawData.screenshots : [],
    annotations: Array.isArray(rawData.annotations) ? rawData.annotations : [],
    critique: rawData.critique || { axes: [] },
    rules: Array.isArray(rawData.rules) ? rawData.rules : [],
    hasPreview: Boolean(rawData.hasPreview ?? rawData.hasH5Dist),
    hasH5Dist: Boolean(rawData.hasPreview ?? rawData.hasH5Dist),
    previewUrl: rawData.previewUrl || '/preview/',
  };

  const pageTitle = `${escHtml(data.projectName)} — OpenDesign 本地设计工作台`;
  const embeddedState = safeJsonEmbed(data);
  const clientScript = getStudioClientScript();

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${pageTitle}</title>
  <style>
    :root {
      /* Warm Linen & Deep Pine Editorial Studio Palette */
      --studio-bg: #FBF7F0;
      --studio-surface: #FFFDF9;
      --studio-surface-muted: #F3EDE3;
      --studio-surface-subtle: #F7F2E9;
      --studio-ink: #161D1B;
      --studio-ink-2: #2D3835;
      --studio-muted: #5A6460;
      --studio-meta: #6E7773;
      --studio-border: #DCD4C7;
      --studio-border-soft: #E9E2D7;
      --studio-accent: #B85A3A;
      --studio-accent-hover: #A24C2F;
      --studio-accent-active: #8E4127;
      --studio-accent-soft: #F7E6DF;
      --studio-accent-on: #FFFDF9;
      --studio-success: #2B5C51;
      --studio-success-soft: #E4F0EB;
      --studio-warn: #85521D;
      --studio-warn-soft: #F9EED8;
      --studio-danger: #9E3530;
      --studio-danger-soft: #FBEAE6;
      --studio-danger-border: #D9AAA0;
      --studio-dark: #161D1B;
      --studio-dark-elev: #222C29;
      --studio-dark-ink: #FFFDF9;

      --font-display: "Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", "STSong", Georgia, serif;
      --font-body: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      --font-mono: ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace;

      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 16px;
      --radius-pill: 999px;
      --shadow-soft: 0 4px 18px rgba(22, 29, 27, 0.06);
      --shadow-dock: 0 8px 24px rgba(22, 29, 27, 0.12);
      --focus-outline: 2px solid var(--studio-accent);
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    [hidden] {
      display: none !important;
    }

    html {
      font-size: 16px;
      -webkit-text-size-adjust: 100%;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    body {
      margin: 0;
      background: var(--studio-bg);
      color: var(--studio-ink);
      font-family: var(--font-body);
      font-size: 14px;
      line-height: 1.55;
      letter-spacing: 0;
      overflow-x: clip;
      min-height: 100vh;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    * {
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    html::-webkit-scrollbar,
    body::-webkit-scrollbar,
    *::-webkit-scrollbar {
      display: none;
      width: 0;
      height: 0;
    }

    h1, h2, h3, h4 {
      margin: 0;
      font-family: var(--font-display);
      font-weight: 600;
      line-height: 1.4;
      letter-spacing: 0;
      color: var(--studio-ink);
    }

    p {
      margin: 0;
    }

    code, pre, kbd {
      font-family: var(--font-mono);
    }

    button, input, textarea, select {
      font-family: inherit;
      font-size: inherit;
      color: inherit;
    }

    :focus-visible {
      outline: var(--focus-outline);
      outline-offset: 2px;
    }

    .tabular {
      font-variant-numeric: tabular-nums;
    }

    /* Layout Shell */
    .studio-header {
      position: sticky;
      top: 0;
      z-index: 40;
      background: rgba(251, 247, 240, 0.94);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--studio-border);
    }

    @supports not (backdrop-filter: blur(12px)) {
      .studio-header {
        background: var(--studio-bg);
      }
    }

    .studio-header-inner {
      max-width: 1240px;
      margin: 0 auto;
      padding: 14px 16px 0;
    }

    .header-top {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px 16px;
      padding-bottom: 12px;
    }

    .brand-block {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 8px 12px;
      min-width: 0;
    }

    .brand-title {
      font-size: 20px;
      line-height: 1.4;
    }

    .brand-sub {
      font-size: 13px;
      color: var(--studio-muted);
      font-weight: 500;
    }

    .header-meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    /* Badges / Pills */
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      font-size: 12px;
      font-weight: 500;
      line-height: 1.3;
      border: 1px solid var(--studio-border);
      background: var(--studio-surface);
      color: var(--studio-ink-2);
      white-space: nowrap;
    }

    .pill--live {
      background: var(--studio-success-soft);
      border-color: var(--studio-success);
      color: var(--studio-success);
    }

    .pill--static {
      background: var(--studio-warn-soft);
      border-color: var(--studio-warn);
      color: var(--studio-warn);
    }

    .pill--pass {
      background: var(--studio-success-soft);
      border-color: #B4D1C5;
      color: var(--studio-success);
    }

    .pill--fail, .pill--p0 {
      background: var(--studio-danger-soft);
      border-color: var(--studio-danger-border);
      color: var(--studio-danger);
    }

    .pill--warn, .pill--p1 {
      background: var(--studio-warn-soft);
      border-color: #DFC496;
      color: var(--studio-warn);
    }

    .pill--accent {
      background: var(--studio-accent-soft);
      border-color: #E2B7A8;
      color: var(--studio-accent-active);
    }

    .pill--p2 {
      background: var(--studio-surface-muted);
      border-color: var(--studio-border);
      color: var(--studio-ink-2);
    }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
      flex: 0 0 auto;
    }

    /* Primary Tab Bar */
    .tab-nav {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      max-width: 100%;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }

    .tab-nav::-webkit-scrollbar {
      display: none;
    }

    .tab-btn {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 44px;
      padding: 8px 14px;
      border: none;
      border-bottom: 2px solid transparent;
      background: transparent;
      color: var(--studio-muted);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: color 150ms ease, border-color 150ms ease;
    }

    .tab-btn:hover {
      color: var(--studio-ink);
    }

    .tab-btn[aria-selected="true"] {
      color: var(--studio-accent-active);
      border-bottom-color: var(--studio-accent);
      font-weight: 600;
    }

    .tab-count {
      font-size: 11px;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: var(--studio-surface-muted);
      color: var(--studio-muted);
      font-variant-numeric: tabular-nums;
    }

    .tab-btn[aria-selected="true"] .tab-count {
      background: var(--studio-accent-soft);
      color: var(--studio-accent-active);
    }

    /* Main Container */
    .studio-main {
      max-width: 1240px;
      margin: 0 auto;
      padding: 20px 16px 64px;
    }

    .mode-banner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px 16px;
      padding: 12px 16px;
      margin-bottom: 20px;
      border-radius: var(--radius-md);
      background: var(--studio-warn-soft);
      border: 1px solid #E2C79B;
      color: var(--studio-warn);
      font-size: 13px;
    }

    .mode-banner code {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 6px;
      background: rgba(255, 253, 249, 0.78);
      color: var(--studio-ink);
      font-size: 12px;
      word-break: break-all;
    }

    .tab-panel {
      display: none;
    }

    .tab-panel.is-active {
      display: block;
    }

    /* Cards & Sections */
    .card {
      background: var(--studio-surface);
      border: 1px solid var(--studio-border);
      border-radius: var(--radius-md);
      padding: 18px;
      min-width: 0;
    }

    .tab-panel > .card + .card,
    .section-gap {
      margin-top: 18px;
    }

    .card-header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px 16px;
      margin-bottom: 14px;
    }

    .card-title {
      font-size: 17px;
      line-height: 1.4;
    }

    .card-desc {
      font-size: 13px;
      color: var(--studio-muted);
      margin-top: 2px;
    }

    .actions-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 38px;
      padding: 7px 14px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--studio-border);
      background: var(--studio-surface);
      color: var(--studio-ink);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      text-decoration: none;
      transition: background 150ms ease, border-color 150ms ease, opacity 150ms ease;
    }

    .btn:hover:not(:disabled) {
      background: var(--studio-surface-subtle);
    }

    .btn:active:not(:disabled) {
      opacity: 0.84;
    }

    .btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .btn--primary {
      background: var(--studio-accent);
      border-color: var(--studio-accent);
      color: var(--studio-accent-on);
      font-weight: 600;
    }

    .btn--primary:hover:not(:disabled) {
      background: var(--studio-accent-hover);
      border-color: var(--studio-accent-hover);
    }

    .btn--danger {
      background: transparent;
      border-color: var(--studio-danger-border);
      color: var(--studio-danger);
    }

    .btn--danger:hover:not(:disabled) {
      background: var(--studio-danger-soft);
    }

    .btn--chip {
      min-height: 34px;
      padding: 5px 12px;
      font-size: 12px;
    }

    .btn--chip.is-active,
    .btn--chip[aria-pressed="true"] {
      background: var(--studio-success-soft);
      border-color: var(--studio-success);
      color: var(--studio-success);
      font-weight: 600;
    }

    .btn--sm {
      min-height: 32px;
      padding: 4px 10px;
      font-size: 12px;
    }

    /* Form Controls */
    .input, .textarea, .select {
      width: 100%;
      min-width: 0;
      padding: 8px 11px;
      border: 1px solid var(--studio-border);
      border-radius: var(--radius-sm);
      background: var(--studio-surface);
      color: var(--studio-ink);
      font-size: 13px;
      line-height: 1.5;
    }

    .textarea {
      resize: vertical;
      min-height: 84px;
    }

    .field-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--studio-ink-2);
      margin-bottom: 5px;
    }

    .field-hint {
      font-size: 12px;
      color: var(--studio-muted);
      margin-top: 4px;
    }

    /* Brief 8-Dim Preset Chips */
    .brief-field-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 14px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--studio-border-soft);
      background: var(--studio-surface-subtle);
      min-width: 0;
    }

    .brief-field-card .field-label {
      margin-bottom: 0;
    }

    .brief-field-card .textarea {
      flex: 1 1 auto;
      min-height: 78px;
    }

    .preset-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-width: 0;
    }

    .preset-chip {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      min-height: 28px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--studio-border);
      background: var(--studio-surface);
      color: var(--studio-ink-2);
      font-size: 12px;
      font-weight: 500;
      line-height: 1.3;
      cursor: pointer;
      text-align: left;
      max-width: 100%;
      transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
    }

    .preset-chip:hover {
      background: var(--studio-surface-muted);
    }

    .preset-chip.is-active,
    .preset-chip[aria-pressed="true"] {
      background: var(--studio-accent-soft);
      border-color: var(--studio-accent);
      color: var(--studio-accent-active);
      font-weight: 600;
    }

    /* Grids */
    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      align-items: stretch;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      align-items: stretch;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      align-items: stretch;
    }

    .grid-2 > .card,
    .grid-3 > .card,
    .grid-4 > .card {
      margin-top: 0;
    }

    /* KPI Cards */
    .kpi-card {
      background: var(--studio-surface);
      border: 1px solid var(--studio-border);
      border-radius: var(--radius-md);
      padding: 14px 16px;
      min-width: 0;
    }

    .kpi-label {
      font-size: 12px;
      color: var(--studio-muted);
      font-weight: 500;
    }

    .kpi-value {
      margin-top: 6px;
      font-family: var(--font-display);
      font-size: 26px;
      font-weight: 600;
      line-height: 1.25;
      color: var(--studio-ink);
      font-variant-numeric: tabular-nums;
    }

    .kpi-sub {
      margin-top: 4px;
      font-size: 12px;
      color: var(--studio-meta);
    }

    /* Key-Value List */
    .kv-list {
      display: grid;
      gap: 8px;
    }

    .kv-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 10px;
      border-radius: var(--radius-sm);
      background: var(--studio-surface-subtle);
      border: 1px solid var(--studio-border-soft);
      font-size: 13px;
      min-width: 0;
    }

    .kv-key {
      color: var(--studio-ink-2);
      overflow-wrap: anywhere;
      min-width: 0;
    }

    .audit-metric-main {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    .audit-metric-title {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: var(--studio-ink);
    }

    .audit-metric-key {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 500;
      padding: 1px 6px;
      border-radius: 6px;
      background: var(--studio-surface);
      border: 1px solid var(--studio-border-soft);
      color: var(--studio-muted);
    }

    .audit-metric-desc {
      font-size: 12px;
      color: var(--studio-muted);
      line-height: 1.45;
    }

    .kv-val {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      flex: 0 0 auto;
    }

    /* Collapsible Log */
    details.log-box {
      border: 1px solid var(--studio-border);
      border-radius: var(--radius-sm);
      background: var(--studio-surface-subtle);
    }

    details.log-box summary {
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      color: var(--studio-ink-2);
    }

    .log-pre {
      margin: 0;
      padding: 12px 14px;
      border-top: 1px solid var(--studio-border-soft);
      background: var(--studio-dark);
      color: var(--studio-dark-ink);
      font-size: 12px;
      line-height: 1.5;
      overflow-x: auto;
      max-height: 360px;
      white-space: pre-wrap;
      word-break: break-word;
      border-radius: 0 0 var(--radius-sm) var(--radius-sm);
    }

    /* Direction & Design System Cards */
    .dir-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 12px;
      align-items: stretch;
    }

    .select-card {
      text-align: left;
      padding: 12px;
      margin-top: 0;
      height: 100%;
      border-radius: var(--radius-sm);
      border: 1px solid var(--studio-border);
      background: var(--studio-surface);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
      transition: border-color 150ms ease, background 150ms ease;
    }

    .select-card:hover {
      background: var(--studio-surface-subtle);
    }

    .select-card.is-selected {
      border-color: var(--studio-accent);
      box-shadow: 0 0 0 1px var(--studio-accent);
      background: var(--studio-accent-soft);
    }

    .select-card-title {
      font-weight: 600;
      font-size: 14px;
      color: var(--studio-ink);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }

    .select-card-desc {
      font-size: 12px;
      color: var(--studio-muted);
      line-height: 1.45;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* Miniature Visual Style Preview Thumbnail */
    .mini-preview {
      width: 100%;
      border-radius: 7px;
      border: 1px solid var(--studio-border);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      pointer-events: none;
    }

    .mini-preview--lg {
      pointer-events: auto;
      border-radius: 10px;
    }

    .mini-preview-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 8px;
      border-bottom: 1px solid transparent;
    }

    .mini-preview-dots {
      display: inline-flex;
      gap: 4px;
      align-items: center;
    }

    .mini-preview-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      opacity: 0.5;
    }

    .mini-preview-body {
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .mini-preview--lg .mini-preview-body {
      padding: 14px;
      gap: 10px;
    }

    .mini-preview-card {
      padding: 7px 8px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .mini-preview--lg .mini-preview-card {
      padding: 12px 14px;
      gap: 8px;
    }

    .mini-preview-head {
      font-size: 11px;
      font-weight: 600;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mini-preview--lg .mini-preview-head {
      font-size: 14px;
    }

    .mini-preview-line {
      height: 4px;
      width: 72%;
      border-radius: 999px;
      opacity: 0.42;
    }

    .mini-preview-cta-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 2px;
    }

    .mini-preview-cta {
      height: 12px;
      width: 42px;
      display: inline-block;
    }

    .mini-preview--lg .mini-preview-cta {
      height: 22px;
      width: auto;
      padding: 0 10px;
      font-size: 11px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      color: #FFFDF9;
    }

    .mini-preview-ghost {
      height: 12px;
      width: 28px;
      opacity: 0.35;
      display: inline-block;
    }

    .mini-swatch-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 5px 8px;
      background: rgba(255, 253, 249, 0.72);
      border-top: 1px solid rgba(22, 29, 27, 0.08);
    }

    .mini-swatch-dots {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .mini-swatch-dot {
      width: 11px;
      height: 11px;
      border-radius: 50%;
      border: 1px solid rgba(22, 29, 27, 0.22);
      flex: 0 0 auto;
    }

    /* Fast Cached Image Thumbnails & Full-Width Interactive Showcase */
    @keyframes thumbPulse {
      0%, 100% { opacity: 0.55; }
      50% { opacity: 0.9; }
    }

    .web-thumb {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 10;
      overflow: hidden;
      border-radius: 7px;
      border: 1px solid var(--studio-border);
      background: var(--studio-surface-muted);
    }

    .web-thumb-skeleton {
      position: absolute;
      inset: 0;
      background: var(--studio-surface-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      color: var(--studio-muted);
      animation: thumbPulse 1.4s ease-in-out infinite;
    }

    .web-thumb.is-loaded .web-thumb-skeleton {
      display: none;
    }

    .web-thumb-img {
      position: relative;
      z-index: 1;
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
      opacity: 0;
      transition: opacity 200ms ease;
    }

    .web-thumb.is-loaded .web-thumb-img {
      opacity: 1;
    }

    .web-thumb-fallback {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 10px;
    }

    .web-thumb-hint {
      font-size: 11px;
      font-weight: 500;
      padding: 3px 7px;
      border-radius: 6px;
      background: rgba(255, 253, 249, 0.86);
      color: var(--studio-ink-2);
      border: 1px solid rgba(22, 29, 27, 0.12);
      align-self: flex-start;
    }

    .gallery-grid {
      display: block;
      column-count: 3;
      column-gap: 16px;
      width: 100%;
      overflow: visible;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .gallery-grid::-webkit-scrollbar,
    .dir-grid::-webkit-scrollbar,
    .subview-tabs::-webkit-scrollbar,
    #ds-category-chips::-webkit-scrollbar,
    #library-mode-tabs::-webkit-scrollbar {
      display: none;
    }

    .dir-grid,
    .subview-tabs,
    #ds-category-chips,
    #library-mode-tabs {
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .gallery-grid > .select-card {
      display: inline-flex;
      flex-direction: column;
      width: 100%;
      height: auto;
      margin: 0 0 16px;
      break-inside: avoid;
      -webkit-column-break-inside: avoid;
      page-break-inside: avoid;
      vertical-align: top;
    }

    .gallery-grid > .select-card .select-card-desc {
      -webkit-line-clamp: 3;
    }

    .gallery-grid > .empty-box {
      column-span: all;
      width: 100%;
    }

    .waterfall-sentinel {
      display: block;
      width: 100%;
      height: 1px;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      pointer-events: none;
    }

    @media (max-width: 1079px) {
      .gallery-grid {
        column-count: 2;
        column-gap: 14px;
      }
    }

    @media (max-width: 639px) {
      .gallery-grid {
        column-count: 1;
        column-gap: 0;
      }
    }

    .showcase-loading {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(251, 247, 240, 0.86);
      color: var(--studio-ink-2);
      font-size: 13px;
      font-weight: 500;
    }

    .showcase-loading[hidden] {
      display: none !important;
    }

    .subview-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px 14px;
      padding: 10px 14px;
      margin-bottom: 16px;
      border-radius: var(--radius-md);
      background: var(--studio-surface);
      border: 1px solid var(--studio-border);
    }

    .subview-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .floating-brief-pill {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 45;
      max-width: calc(100vw - 32px);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 44px;
      padding: 10px 18px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--studio-accent);
      background: var(--studio-accent);
      color: var(--studio-accent-on);
      font-size: 13px;
      font-weight: 600;
      box-shadow: var(--shadow-dock);
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: background 150ms ease, transform 150ms ease;
    }

    .floating-brief-pill:hover {
      background: var(--studio-accent-hover);
      transform: translateY(-1px);
    }

    .swarm-toggle-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 32px;
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--studio-border);
      background: var(--studio-surface);
      color: var(--studio-ink-2);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      user-select: none;
      transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
    }

    .swarm-toggle-pill input {
      width: 14px;
      height: 14px;
      margin: 0;
      accent-color: var(--studio-accent);
      cursor: pointer;
    }

    .swarm-toggle-pill.is-on {
      background: var(--studio-accent-soft);
      border-color: #E2B7A8;
      color: var(--studio-accent-active);
      font-weight: 600;
    }

    .swarm-toggle-pill:focus-within {
      outline: var(--focus-outline);
      outline-offset: 2px;
    }

    .handoff-checklist {
      display: grid;
      gap: 6px;
      padding: 12px 14px;
      border-radius: var(--radius-sm);
      background: var(--studio-success-soft);
      border: 1px solid #B4D1C5;
      color: var(--studio-success);
      font-size: 13px;
    }

    .handoff-steps {
      display: grid;
      gap: 8px;
      padding: 14px;
      border-radius: var(--radius-sm);
      background: var(--studio-surface-subtle);
      border: 1px solid var(--studio-border);
      font-size: 13px;
      color: var(--studio-ink-2);
    }

    .handoff-prompt-pre {
      margin: 0;
      padding: 12px;
      max-height: 300px;
      overflow: auto;
      border-radius: var(--radius-sm);
      background: var(--studio-dark);
      color: var(--studio-dark-ink);
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .showcase-modal {
      position: fixed;
      inset: 0;
      z-index: 80;
      background: rgba(22, 29, 27, 0.72);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .showcase-modal-dialog {
      width: min(1160px, 100%);
      max-height: 92vh;
      overflow-y: auto;
      background: var(--studio-surface);
      border: 1px solid var(--studio-border);
      border-radius: var(--radius-lg);
      padding: 18px;
      box-shadow: var(--shadow-dock);
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
    }

    .showcase-modal-footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding-top: 12px;
      border-top: 1px solid var(--studio-border-soft);
    }

    .showcase-panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
    }

    .showcase-stage-wrap {
      width: 100%;
      border: 1px solid var(--studio-border);
      border-radius: 10px;
      background: var(--studio-surface-muted);
      overflow: hidden;
      display: flex;
      justify-content: center;
      padding: 10px;
    }

    .showcase-viewport {
      position: relative;
      max-width: 100%;
      height: 640px;
      overflow: hidden;
      border-radius: 8px;
      border: 1px solid var(--studio-border);
      background: #FFFFFF;
      box-shadow: var(--shadow-soft);
    }

    .showcase-viewport--desktop {
      width: 100%;
    }

    .showcase-viewport--mobile {
      width: 390px;
    }

    .showcase-iframe {
      display: block;
      border: 0;
      background: #FFFFFF;
    }

    .showcase-iframe--desktop {
      position: absolute;
      top: 0;
      left: 0;
      width: 1280px;
      height: calc(640px / var(--stage-scale, 1));
      transform-origin: top left;
      transform: scale(var(--stage-scale, 1));
    }

    .showcase-iframe--mobile {
      width: 100%;
      height: 100%;
    }

    .ds-preview-body {
      max-height: 520px;
      overflow-y: auto;
      font-size: 12px;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
      background: var(--studio-surface);
      border: 1px solid var(--studio-border-soft);
      border-radius: 6px;
      padding: 12px;
      color: var(--studio-ink-2);
    }

    .swatch-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 8px;
    }

    .swatch-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid var(--studio-border-soft);
      background: var(--studio-surface);
      font-size: 11px;
      cursor: pointer;
      text-align: left;
    }

    .swatch-chip-dot {
      width: 18px;
      height: 18px;
      border-radius: 4px;
      border: 1px solid rgba(22, 29, 27, 0.2);
      flex: 0 0 auto;
    }

    /* Token Studio */
    .sample-sandbox {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      padding: 14px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--studio-border);
      background: var(--bg, #f4f7f3);
      color: var(--fg, #17342e);
      margin-bottom: 14px;
    }

    .sandbox-card {
      background: var(--surface, #fffefa);
      border: 1px solid var(--border, #ccd8d1);
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }

    .sandbox-title {
      font-family: var(--font-display);
      font-size: 15px;
      font-weight: 600;
      color: var(--fg, #17342e);
      line-height: 1.35;
    }

    .sandbox-body {
      font-size: 12px;
      color: var(--muted, #4d5f58);
    }

    .sandbox-cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 12px;
      border-radius: 999px;
      background: var(--accent, #b84d39);
      color: var(--accent-on, #fffefa);
      font-size: 12px;
      font-weight: 600;
      border: none;
    }

    .sandbox-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 12px;
      border-radius: 999px;
      background: var(--surface-warm, #e6eee9);
      color: var(--fg, #17342e);
      font-size: 12px;
      font-weight: 500;
      border: 1px solid var(--border, #ccd8d1);
    }

    .sandbox-scrim-demo {
      position: relative;
      border-radius: 8px;
      overflow: hidden;
      min-height: 82px;
      background: var(--surface-dark, #161d1b);
      color: var(--fg-inverse, #fffefa);
      padding: 10px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 4px;
    }

    .sandbox-scrim-layer {
      position: absolute;
      inset: 0;
      background: var(--scrim-media, rgba(22, 29, 27, 0.72));
      pointer-events: none;
    }

    .sandbox-scrim-content {
      position: relative;
      z-index: 1;
      font-size: 12px;
    }

    .token-list {
      display: grid;
      gap: 8px;
      max-height: 460px;
      overflow-y: auto;
      padding-right: 4px;
    }

    .token-row {
      display: grid;
      grid-template-columns: minmax(150px, 1.1fr) auto minmax(180px, 1.4fr) auto;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border: 1px solid var(--studio-border-soft);
      border-radius: var(--radius-sm);
      background: var(--studio-surface-subtle);
      min-width: 0;
    }

    .token-row.is-dirty {
      border-color: var(--studio-accent);
      background: var(--studio-accent-soft);
    }

    .token-name-btn {
      text-align: left;
      border: none;
      background: transparent;
      padding: 2px 0;
      cursor: pointer;
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 600;
      color: var(--studio-ink);
      overflow-wrap: anywhere;
    }

    .token-name-btn:hover {
      color: var(--studio-accent-active);
      text-decoration: underline;
    }

    .swatch-box {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: 1px solid var(--studio-border);
      background-image:
        linear-gradient(45deg, #dcd6cc 25%, transparent 25%),
        linear-gradient(-45deg, #dcd6cc 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #dcd6cc 75%),
        linear-gradient(-45deg, transparent 75%, #dcd6cc 75%);
      background-size: 8px 8px;
      background-position: 0 0, 0 4px, 4px -4px, -4px 0;
      overflow: hidden;
      flex: 0 0 auto;
    }

    .swatch-fill {
      width: 100%;
      height: 100%;
    }

    .token-controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .color-input {
      width: 34px;
      height: 30px;
      padding: 2px;
      border: 1px solid var(--studio-border);
      border-radius: 6px;
      background: var(--studio-surface);
      cursor: pointer;
      flex: 0 0 auto;
    }

    .alpha-wrap {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: var(--studio-muted);
      font-variant-numeric: tabular-nums;
    }

    .alpha-slider {
      width: 68px;
      accent-color: var(--studio-accent);
    }

    .token-text-input {
      flex: 1 1 130px;
      min-width: 110px;
      padding: 5px 8px;
      font-family: var(--font-mono);
      font-size: 12px;
    }

    .confirm-strip {
      margin-top: 12px;
      padding: 12px 14px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--studio-accent);
      background: var(--studio-accent-soft);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    /* DESIGN.md Editor & Line Diff */
    .editor-split {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px;
    }

    .md-textarea {
      min-height: 380px;
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.55;
      white-space: pre;
      overflow: auto;
    }

    .diff-viewer {
      min-height: 380px;
      max-height: 460px;
      overflow: auto;
      border: 1px solid var(--studio-border);
      border-radius: var(--radius-sm);
      background: var(--studio-surface-subtle);
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.5;
    }

    .diff-line {
      display: grid;
      grid-template-columns: 38px 18px minmax(0, 1fr);
      padding: 1px 8px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .diff-line--add {
      background: #E2F1E8;
      color: #1A4738;
    }

    .diff-line--del {
      background: #FBE6E2;
      color: #842520;
    }

    .diff-line--ctx {
      color: var(--studio-muted);
    }

    .diff-ln {
      color: var(--studio-meta);
      user-select: none;
      font-variant-numeric: tabular-nums;
    }

    /* Tab 4: Canvas Pinboard, Slider & H5 Preview */
    .pinboard-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }

    .canvas-stage-wrap {
      background: var(--studio-surface-muted);
      border: 1px solid var(--studio-border);
      border-radius: var(--radius-sm);
      padding: 12px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      overflow: hidden;
    }

    .canvas-stage {
      position: relative;
      display: inline-block;
      max-width: 100%;
      line-height: 0;
      cursor: crosshair;
      user-select: none;
    }

    .canvas-img {
      display: block;
      max-width: 100%;
      max-height: 540px;
      width: auto;
      height: auto;
      border-radius: 6px;
      border: 1px solid var(--studio-border);
    }

    .pin-marker {
      position: absolute;
      transform: translate(-50%, -50%);
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 2px solid #FFFDF9;
      color: #FFFDF9;
      font-size: 11px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(22, 29, 27, 0.28);
      padding: 0;
      line-height: 1;
    }

    .pin-marker--p0 { background: var(--studio-danger); }
    .pin-marker--p1 { background: var(--studio-accent); }
    .pin-marker--p2 { background: var(--studio-success); }
    .pin-marker--resolved {
      background: var(--studio-muted);
      opacity: 0.72;
    }

    .pin-marker.is-selected {
      box-shadow: 0 0 0 3px var(--studio-ink), 0 2px 10px rgba(22, 29, 27, 0.35);
      z-index: 5;
    }

    .pin-list {
      display: grid;
      gap: 8px;
      max-height: 300px;
      overflow-y: auto;
    }

    .pin-item {
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--studio-border);
      background: var(--studio-surface-subtle);
      cursor: pointer;
      display: grid;
      gap: 4px;
    }

    .pin-item.is-selected {
      border-color: var(--studio-accent);
      background: var(--studio-accent-soft);
    }

    /* Before/After Comparison Slider */
    .ba-stage-wrap {
      display: flex;
      justify-content: center;
      background: var(--studio-surface-muted);
      border: 1px solid var(--studio-border);
      border-radius: var(--radius-sm);
      padding: 12px;
    }

    .ba-stage {
      position: relative;
      display: inline-block;
      max-width: 100%;
      overflow: hidden;
      border-radius: 8px;
      border: 1px solid var(--studio-border);
      line-height: 0;
      touch-action: pan-y;
      cursor: ew-resize;
    }

    .ba-img-post {
      display: block;
      max-width: 100%;
      max-height: 520px;
      width: auto;
      height: auto;
    }

    .ba-img-base {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      clip-path: inset(0 calc(100% - var(--split, 50%)) 0 0);
      pointer-events: none;
    }

    .ba-divider {
      position: absolute;
      top: 0;
      bottom: 0;
      left: var(--split, 50%);
      width: 2px;
      background: #FFFDF9;
      box-shadow: 0 0 0 1px rgba(22, 29, 27, 0.35);
      pointer-events: none;
    }

    .ba-knob {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: var(--studio-ink);
      color: #FFFDF9;
      border: 2px solid #FFFDF9;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
    }

    .ba-badge {
      position: absolute;
      top: 10px;
      padding: 4px 9px;
      border-radius: var(--radius-pill);
      background: rgba(22, 29, 27, 0.78);
      color: #FFFDF9;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.2;
      pointer-events: none;
    }

    .ba-badge--left { left: 10px; }
    .ba-badge--right { right: 10px; }

    .ba-controls {
      margin-top: 12px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    .ba-range {
      flex: 1 1 200px;
      accent-color: var(--studio-accent);
    }

    /* H5 Live Preview */
    .preview-shell {
      display: flex;
      justify-content: center;
      background: var(--studio-surface-muted);
      border: 1px solid var(--studio-border);
      border-radius: var(--radius-sm);
      padding: 14px;
      overflow: hidden;
    }

    .preview-frame-box {
      max-width: 100%;
      border: 1px solid var(--studio-border);
      border-radius: 12px;
      overflow: hidden;
      background: #FFFDF9;
      box-shadow: var(--shadow-soft);
      transition: width 200ms ease, height 200ms ease;
    }

    .preview-iframe {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
      background: #FFFDF9;
    }

    /* Tab 5: Critique & Rules */
    .axis-card {
      padding: 14px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--studio-border);
      background: var(--studio-surface-subtle);
      display: grid;
      gap: 10px;
    }

    .axis-top {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .axis-score {
      font-family: var(--font-display);
      font-size: 20px;
      font-weight: 600;
      color: var(--studio-ink);
      font-variant-numeric: tabular-nums;
    }

    .rule-item {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--studio-border);
      background: var(--studio-surface-subtle);
    }

    /* Tab 6: Guide */
    .cmd-block {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      background: var(--studio-dark);
      color: var(--studio-dark-ink);
      font-family: var(--font-mono);
      font-size: 12px;
      overflow-x: auto;
    }

    .cmd-block code {
      white-space: pre-wrap;
      word-break: break-all;
    }

    /* Lightbox */
    .lightbox {
      position: fixed;
      inset: 0;
      z-index: 90;
      background: rgba(22, 29, 27, 0.84);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .lightbox[hidden] {
      display: none;
    }

    .lightbox-inner {
      position: relative;
      max-width: min(1100px, 100%);
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: center;
    }

    .lightbox-img {
      max-width: 100%;
      max-height: calc(90vh - 56px);
      border-radius: 8px;
      border: 1px solid rgba(255, 253, 249, 0.2);
      background: var(--studio-dark);
    }

    .lightbox-bar {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      color: #FFFDF9;
      font-size: 13px;
    }

    /* Toast */
    .toast {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 100;
      max-width: min(400px, calc(100vw - 32px));
      padding: 10px 14px;
      border-radius: var(--radius-sm);
      background: var(--studio-dark);
      color: var(--studio-dark-ink);
      font-size: 13px;
      box-shadow: var(--shadow-dock);
      border: 1px solid rgba(255, 253, 249, 0.14);
      opacity: 0;
      transform: translateY(8px);
      pointer-events: none;
      transition: opacity 160ms ease, transform 160ms ease;
    }

    .toast.is-visible {
      opacity: 1;
      transform: translateY(0);
    }

    .empty-box {
      padding: 24px 16px;
      text-align: center;
      border-radius: var(--radius-sm);
      border: 1px dashed var(--studio-border);
      background: var(--studio-surface-subtle);
      color: var(--studio-muted);
      font-size: 13px;
    }

    /* Responsive Breakpoints */
    @media (max-width: 960px) {
      .grid-4 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .grid-3, .sample-sandbox {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .ds-layout, .editor-split, .pinboard-layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    @media (max-width: 640px) {
      .studio-header-inner {
        padding: 12px 12px 0;
      }
      .studio-main {
        padding: 14px 12px 56px;
      }
      .card {
        padding: 14px;
      }
      .grid-4, .grid-3, .grid-2, .sample-sandbox {
        grid-template-columns: minmax(0, 1fr);
      }
      .token-row {
        grid-template-columns: minmax(0, 1fr);
        gap: 8px;
      }
      .brand-title {
        font-size: 18px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        transition-duration: 0.01ms !important;
        animation-duration: 0.01ms !important;
      }
    }
  </style>
</head>
<body>
  <header class="studio-header">
    <div class="studio-header-inner">
      <div class="header-top">
        <div class="brand-block">
          <h1 class="brand-title">${escHtml(data.projectName)}</h1>
          <span class="brand-sub">OpenDesign 本地设计工作台</span>
        </div>
        <div class="header-meta">
          <div class="header-meta" id="header-meta"></div>
          <label class="swarm-toggle-pill is-on" id="use-swarm-pill" title="开启多代理并行重构 + 独立验收 + Alt+S 看板时间线；单文件微调可关闭以节省 Token">
            <input type="checkbox" id="use-swarm-toggle" checked />
            <span>开启 /swarm</span>
          </label>
          <button type="button" class="btn btn--primary btn--sm" id="start-optimize-btn">开始实施优化</button>
        </div>
      </div>
      <nav class="tab-nav" role="tablist" aria-label="设计工作台功能区" id="studio-tabs">
        <button class="tab-btn" role="tab" id="tab-btn-overview" aria-controls="panel-overview" aria-selected="true" data-tab="overview">总览与实时审计 <span class="tab-count" id="badge-audit"></span></button>
        <button class="tab-btn" role="tab" id="tab-btn-brief" aria-controls="panel-brief" aria-selected="false" data-tab="brief">Brief 与设计体系 <span class="tab-count" id="badge-systems"></span></button>
        <button class="tab-btn" role="tab" id="tab-btn-tokens" aria-controls="panel-tokens" aria-selected="false" data-tab="tokens">Token 与 DESIGN.md <span class="tab-count" id="badge-tokens"></span></button>
        <button class="tab-btn" role="tab" id="tab-btn-canvas" aria-controls="panel-canvas" aria-selected="false" data-tab="canvas">打点批注与实机对比 <span class="tab-count" id="badge-pins"></span></button>
        <button class="tab-btn" role="tab" id="tab-btn-critique" aria-controls="panel-critique" aria-selected="false" data-tab="critique">五维评审与规则记忆 <span class="tab-count" id="badge-rules"></span></button>
        <button class="tab-btn" role="tab" id="tab-btn-guide" aria-controls="panel-guide" aria-selected="false" data-tab="guide">边做边学指南</button>
      </nav>
    </div>
  </header>

  <main class="studio-main">
    <div id="static-mode-banner" class="mode-banner" hidden>
      <div>
        <strong>静态只读归档模式</strong>：可浏览全部数据、本地预览调色并复制 Prompt；如需实时重跑审计、写回源码与内嵌实时项目预览，请启动 Live 工作台：
        <code id="live-cmd-code">node ~/.local/share/agy-opendesign/scripts/od-review-ui.mjs --root . --serve --open</code>
      </div>
      <button type="button" class="btn btn--sm" id="copy-live-cmd-btn">复制启动命令</button>
    </div>

    <!-- TAB 1: Overview & Live Audit -->
    <section class="tab-panel is-active" id="panel-overview" role="tabpanel" aria-labelledby="tab-btn-overview">
      <div class="grid-4" id="overview-kpis"></div>

      <div class="card section-gap">
        <div class="card-header">
          <div>
            <h2 class="card-title">合规审计明细</h2>
            <p class="card-desc">实时核查 Anti-AI-Slop P0 阻断项与 P1 卫生项，确保每次改动符合 DESIGN.md 契约。</p>
          </div>
          <div class="actions-row">
            <button type="button" class="btn btn--primary" id="run-audit-btn">实时重跑合规审计</button>
          </div>
        </div>
        <div class="grid-2" id="audit-breakdown"></div>
        <details class="log-box section-gap" id="audit-log-details">
          <summary>查看原始审计输出日志</summary>
          <pre class="log-pre" id="audit-raw-output"></pre>
        </details>
      </div>

      <div class="card section-gap">
        <div class="card-header">
          <div>
            <h2 class="card-title">项目工程与验证摘要</h2>
            <p class="card-desc">检测到的项目脚本、构建状态、Token 文件及 DESIGN.md 路径。</p>
          </div>
        </div>
        <div class="grid-2" id="build-summary-grid"></div>
      </div>
    </section>

    <!-- TAB 2: Brief & Design Library (2 Sub-Views + Floating Pill + Modal Showcase) -->
    <section class="tab-panel" id="panel-brief" role="tabpanel" aria-labelledby="tab-btn-brief">
      <div class="subview-bar">
        <div class="subview-tabs" id="brief-subview-tabs" role="tablist" aria-label="Brief 工作流步骤">
          <button type="button" class="btn btn--chip is-active" role="tab" aria-selected="true" data-brief-view="browse" id="brief-view-btn-browse">① 挑风格模板（全宽瀑布流）</button>
          <button type="button" class="btn btn--chip" role="tab" aria-selected="false" data-brief-view="compose" id="brief-view-btn-compose">② 制定 8 维 Brief 与导出 Prompt</button>
        </div>
        <div class="actions-row" id="brief-topbar-status"></div>
      </div>

      <!-- Sub-view 1: Full-width Gallery Waterfall ONLY (zero forms below) -->
      <div id="brief-view-browse">
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">内置 5 大视觉方向</h2>
              <p class="card-desc">点击选择一个基准美学方向，作为后续 Brief 与 Prompt 的主基调。</p>
            </div>
          </div>
          <div class="dir-grid" id="directions-grid"></div>
        </div>

        <div class="card section-gap">
          <div class="card-header">
            <div>
              <h2 class="card-title">真实视觉风格与整页模板库</h2>
              <p class="card-desc" id="ds-count-desc">浏览真实网页缩略图，点击任意卡片弹出全尺寸交互式实景预览。</p>
            </div>
            <div class="actions-row" style="min-width: 240px; flex: 0 1 360px;">
              <input type="search" class="input" id="ds-search-input" placeholder="按名称、风格或关键词搜索..." aria-label="搜索设计体系或模板" />
            </div>
          </div>
          <div class="actions-row" style="justify-content: space-between; margin-bottom: 10px;">
            <div class="actions-row" id="library-mode-tabs" role="tablist" aria-label="切换整页模板与设计体系">
              <button type="button" class="btn btn--chip is-active" data-lib-mode="templates" id="lib-mode-templates">整页真实模板</button>
              <button type="button" class="btn btn--chip" data-lib-mode="systems" id="lib-mode-systems">配色与组件体系</button>
            </div>
          </div>
          <div class="actions-row" id="ds-category-chips" style="margin-bottom: 12px;"></div>
          <div class="gallery-grid" id="ds-list"></div>
          <div class="waterfall-sentinel" id="ds-waterfall-sentinel" aria-hidden="true"></div>
        </div>
      </div>

      <!-- Sub-view 2: 8-Dim Brief Composer & Prompt Export -->
      <div id="brief-view-compose" hidden>
        <div class="card">
          <div class="card-header">
            <div>
              <h2 class="card-title">8 维 Design Brief 编写器</h2>
              <p class="card-desc">沉淀色板、字体、布局、氛围、密度、禁区、目标页面与补充约束，随时保存或导出启动 Prompt。</p>
            </div>
            <div class="actions-row">
              <button type="button" class="btn" id="back-to-gallery-btn">← 返回重选风格</button>
              <button type="button" class="btn" id="brief-fill-defaults-btn">一键填入常用默认组合</button>
              <button type="button" class="btn btn--danger" id="brief-clear-btn">清空表单</button>
              <button type="button" class="btn" id="copy-brief-prompt-btn">一键复制启动 Prompt</button>
              <button type="button" class="btn btn--primary" id="save-brief-btn">保存 Brief</button>
            </div>
          </div>
          <div class="actions-row" id="brief-selection-pills" style="margin-bottom: 12px;"></div>
          <div class="grid-2" id="brief-form-grid"></div>
        </div>
      </div>
    </section>

    <!-- TAB 3: Token Studio & DESIGN.md Editor -->
    <section class="tab-panel" id="panel-tokens" role="tabpanel" aria-labelledby="tab-btn-tokens">
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Live Token 调色工作台</h2>
            <p class="card-desc" id="token-file-desc"></p>
          </div>
          <div class="actions-row">
            <span class="pill pill--accent tabular" id="token-dirty-pill" hidden>已修改 0 项</span>
            <button type="button" class="btn" id="token-reset-btn">重置预览</button>
            <button type="button" class="btn btn--primary" id="token-save-trigger-btn">写回 tokens.scss</button>
          </div>
        </div>

        <div class="sample-sandbox" id="token-sandbox" aria-label="Token 实时样例预览">
          <div class="sandbox-card">
            <div class="sandbox-title">${escHtml(data.projectName)} · 卡片样例</div>
            <div class="sandbox-body">实时预览表面色、主字色、细线边框与品牌主按钮的对比度与视觉层次。</div>
            <div class="actions-row">
              <button type="button" class="sandbox-cta">主要操作 CTA</button>
              <button type="button" class="sandbox-secondary">次要操作</button>
            </div>
          </div>
          <div class="sandbox-card" style="background: var(--surface-subtle, #edf3ef);">
            <div class="sandbox-title">语义状态与提示条</div>
            <div class="sandbox-body">核验成功、警示与危险色在浅底上的可读性。</div>
            <div class="actions-row">
              <span class="pill" style="background: var(--success-soft, #e3efe9); color: var(--success, #2b5c51); border-color: var(--border, #ccd8d1);">已完成 12 项</span>
              <span class="pill" style="background: var(--warn-soft, #f9eed8); color: var(--warn, #85521d); border-color: var(--border, #ccd8d1);">待确认</span>
              <span class="pill" style="background: var(--danger-soft, #fbeae6); color: var(--danger, #9e3530); border-color: var(--danger-border, #d9aaa0);">需处理</span>
            </div>
          </div>
          <div class="sandbox-scrim-demo">
            <div class="sandbox-scrim-layer"></div>
            <div class="sandbox-scrim-content">
              <div style="font-weight: 600;">暗色表面与 Scrim 遮罩层</div>
              <div style="opacity: 0.86;">验证深色表面与遮罩层上反白字体的清晰度与对比度。</div>
            </div>
          </div>
        </div>

        <div class="actions-row" style="justify-content: space-between; margin-bottom: 12px;">
          <div class="actions-row" id="token-filter-chips">
            <button type="button" class="btn btn--chip is-active" data-token-filter="all">全部</button>
            <button type="button" class="btn btn--chip" data-token-filter="scrim">Scrim / 遮罩</button>
            <button type="button" class="btn btn--chip" data-token-filter="color">色彩</button>
            <button type="button" class="btn btn--chip" data-token-filter="dirty">已修改</button>
          </div>
          <div style="min-width: 210px; flex: 0 1 280px;">
            <input type="search" class="input" id="token-search-input" placeholder="过滤变量名或色值..." aria-label="过滤 Token" />
          </div>
        </div>

        <div id="token-confirm-strip" class="confirm-strip" hidden>
          <div id="token-confirm-text" style="font-size: 13px;"></div>
          <div class="actions-row">
            <button type="button" class="btn btn--sm" id="token-confirm-cancel">取消</button>
            <button type="button" class="btn btn--primary btn--sm" id="token-confirm-apply">确认写回磁盘</button>
          </div>
        </div>

        <div class="token-list" id="token-list" style="margin-top: 10px;"></div>
      </div>

      <div class="card section-gap">
        <div class="card-header">
          <div>
            <h2 class="card-title">DESIGN.md 规范编辑器</h2>
            <p class="card-desc" id="design-md-desc"></p>
          </div>
          <div class="actions-row">
            <span class="pill tabular" id="design-md-diff-pill">无未保存改动</span>
            <button type="button" class="btn" id="design-md-reset-btn">恢复原内容</button>
            <button type="button" class="btn btn--primary" id="design-md-save-btn">保存 DESIGN.md</button>
          </div>
        </div>
        <div class="editor-split">
          <div>
            <label class="field-label" for="design-md-textarea">Markdown 源码编辑</label>
            <textarea class="textarea md-textarea" id="design-md-textarea" spellcheck="false"></textarea>
          </div>
          <div>
            <div class="field-label">实时行级 Diff 预览（对比已保存基线）</div>
            <div class="diff-viewer" id="design-md-diff"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 4: Canvas Pinboard, Before/After Slider & H5 Live Preview -->
    <section class="tab-panel" id="panel-canvas" role="tabpanel" aria-labelledby="tab-btn-canvas">
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">画布打点批注（Pinboard）</h2>
            <p class="card-desc">在截图任意位置点击即可落点编号，标记 P0/P1/P2 问题并一键导出 $od-design-refine 修改指令。</p>
          </div>
          <div class="actions-row">
            <button type="button" class="btn" id="export-pins-prompt-btn">一键导出 $od-design-refine 修改指令</button>
            <button type="button" class="btn" id="save-pins-btn">保存批注</button>
            <button type="button" class="btn btn--primary" id="canvas-start-optimize-btn">开始实施优化</button>
          </div>
        </div>

        <div class="actions-row" style="justify-content: space-between; margin-bottom: 10px;">
          <div class="actions-row" id="pin-viewport-filters">
            <button type="button" class="btn btn--chip is-active" data-vp="all">全部视口</button>
            <button type="button" class="btn btn--chip" data-vp="mobile">390×844 手机</button>
            <button type="button" class="btn btn--chip" data-vp="desktop">1280×800 桌面</button>
          </div>
          <button type="button" class="btn btn--sm" id="open-lightbox-btn">放大原图</button>
        </div>

        <div class="actions-row" id="screenshot-selector" style="margin-bottom: 12px;"></div>

        <div class="pinboard-layout">
          <div class="canvas-stage-wrap" id="pinboard-stage-wrap"></div>
          <div style="display: grid; gap: 12px; min-width: 0;">
            <div class="card" style="padding: 14px;" id="pin-editor-box"></div>
            <div>
              <div class="field-label" id="pin-list-title">当前截图批注</div>
              <div class="pin-list" id="pin-list"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="card section-gap">
        <div class="card-header">
          <div>
            <h2 class="card-title">Before / After 卷帘对比</h2>
            <p class="card-desc">自动匹配相同 pairKey 的基准（Baseline）与优化后（Post）截图，拖动滑块直观核验改动。</p>
          </div>
          <div class="actions-row" id="ba-pair-selector"></div>
        </div>
        <div id="ba-container"></div>
      </div>

      <div class="card section-gap">
        <div class="card-header">
          <div>
            <h2 class="card-title">实时项目预览</h2>
            <p class="card-desc">在 Live 模式下直接加载本地构建产物或开发服务，并实时注入 Token 调色工作台的临时变量覆盖。</p>
          </div>
          <div class="actions-row" id="h5-preview-toolbar">
            <span class="pill pill--accent tabular" id="h5-override-badge">使用当前 tokens</span>
            <button type="button" class="btn btn--chip is-active" data-h5-vp="mobile">手机 390×844</button>
            <button type="button" class="btn btn--chip" data-h5-vp="tablet">平板 768×1024</button>
            <button type="button" class="btn btn--chip" data-h5-vp="desktop">桌面 1280×800</button>
            <button type="button" class="btn btn--sm" id="h5-reload-btn">刷新预览</button>
          </div>
        </div>
        <div id="h5-preview-container"></div>
      </div>
    </section>

    <!-- TAB 5: Five-Dimensional Critique & Rules Memory -->
    <section class="tab-panel" id="panel-critique" role="tabpanel" aria-labelledby="tab-btn-critique">
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">人工五维评审打分卡</h2>
            <p class="card-desc">依据 DESIGN.md 门禁标准逐项打分（每维 ≥ 4.0 通过，任一维 &lt; 3.0 阻断交付）。</p>
          </div>
          <div class="actions-row">
            <span class="pill tabular" id="critique-avg-pill"></span>
            <button type="button" class="btn" id="copy-rules-prompt-btn">复制规则约束给 agy</button>
            <button type="button" class="btn btn--primary" id="save-critique-btn">保存评审与规则</button>
          </div>
        </div>
        <div class="grid-2" id="critique-axes-grid"></div>
      </div>

      <div class="card section-gap">
        <div class="card-header">
          <div>
            <h2 class="card-title">项目级规则记忆（Do / Don't）</h2>
            <p class="card-desc">沉淀可复用的设计规范与禁区约束，持久化保存到仓库供后续重构与精修直接引用。</p>
          </div>
        </div>
        <div class="actions-row" style="margin-bottom: 14px;">
          <select class="select" id="rule-kind-select" style="width: 150px;" aria-label="规则类型">
            <option value="do">Do · 必须遵循</option>
            <option value="dont">Don't · 严格禁止</option>
          </select>
          <input type="text" class="input" id="rule-scope-input" placeholder="适用范围（可选，如 全局 / Home）" style="width: 210px;" aria-label="规则范围" />
          <input type="text" class="input" id="rule-text-input" placeholder="输入具体规则描述，例如：品牌主色每屏可见使用不超过 2 处" style="flex: 1 1 260px;" aria-label="规则内容" />
          <button type="button" class="btn btn--primary" id="add-rule-btn">添加规则</button>
        </div>
        <div class="grid-2" id="rules-columns"></div>
      </div>
    </section>

    <!-- TAB 6: Interactive Guide -->
    <section class="tab-panel" id="panel-guide" role="tabpanel" aria-labelledby="tab-btn-guide">
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">边做边学：OpenDesign + /swarm 工作流指南</h2>
            <p class="card-desc">常用本地启动、并行精修与 Step 5 上游仓库同步命令，点击即可复制。</p>
          </div>
        </div>
        <div class="grid-2" id="guide-cards"></div>
      </div>
    </section>
  </main>

  <!-- Floating Bottom-Right Pill (Tab 2 Browse Sub-view only) -->
  <button type="button" class="floating-brief-pill" id="brief-floating-pill" hidden>去制定 8 维 Brief →</button>

  <!-- Launch Optimization Handoff Modal -->
  <div class="showcase-modal" id="handoff-modal" role="dialog" aria-modal="true" aria-label="开始实施优化引导弹窗" hidden>
    <div class="showcase-modal-dialog" style="width: min(760px, 100%);" id="handoff-modal-body"></div>
  </div>

  <!-- Centered Interactive Style Showcase Modal -->
  <div class="showcase-modal" id="showcase-modal" role="dialog" aria-modal="true" aria-label="风格实景预览弹窗" hidden>
    <div class="showcase-modal-dialog" id="ds-preview"></div>
  </div>

  <!-- Lightbox Modal (uses transparent 1x1 gif placeholder when closed) -->
  <div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="截图原图预览" hidden>
    <div class="lightbox-inner">
      <div class="lightbox-bar">
        <span id="lightbox-caption"></span>
        <button type="button" class="btn btn--sm" id="lightbox-close-btn">关闭 (Esc)</button>
      </div>
      <img class="lightbox-img" id="lightbox-img" src="${BLANK_GIF}" alt="截图放大预览" />
    </div>
  </div>

  <div class="toast" id="studio-toast" role="status" aria-live="polite"></div>

  <script id="studio-initial-state" type="application/json">${embeddedState}</script>
  <script>
  (function () {
    'use strict';
    const BLANK_GIF = ${JSON.stringify(BLANK_GIF)};
${clientScript}
  })();
  </script>
</body>
</html>`;
}

function getStudioClientScript() {
  return String.raw`
    const AUDIT_KEY_META = {
      aiIndigo: {
        title: 'AI 模板紫蓝禁区',
        desc: '禁止滥用 #6366f1 / #4f46e5 等 AI 默认紫蓝色，避免廉价模板感'
      },
      coldApple: {
        title: '冷调系统蓝禁区',
        desc: '禁止偏离项目 DESIGN.md 设计基调的冷灰或默认系统蓝'
      },
      unguardedColorMix: {
        title: '无保护 color-mix()',
        desc: '须包在 @supports 内或改用预混实色 token，避免旧内核/跨端失效'
      },
      leftBorderRoundedCards: {
        title: '圆角卡片左侧粗彩条',
        desc: '反 AI-Slop 规范，禁止圆角卡片加左侧装饰性粗色条'
      },
      rawHexOutsideTokens: {
        title: 'Token 外裸写色值',
        desc: '所有原始 #hex 必须集中在 tokens.scss，页面样式统一引用 var(--...)'
      },
      unexpectedImportant: {
        title: '非锁定 !important',
        desc: '禁止新增 !important 暴力覆盖，防止样式权重失控'
      },
      pinnedImportant: {
        title: '测试锁定 !important 基线',
        desc: '上游单测锁定的历史豁免项（仅观察，不计入 P1 违规）',
        informational: true
      },
      buttonDisabledProp: {
        title: '按钮禁用态属性规范',
        desc: '检查按钮禁用态声明与跨端样式一致性'
      },
      total: {
        title: '本类违规总计',
        desc: '当前分类下需处理的违规项总数（0 为通过）'
      }
    };

    const TOKEN_CAT_LABELS = {
      surface: '表面色',
      fg: '前景色',
      border: '边框',
      accent: '主色',
      semantic: '语义色',
      scrim: '遮罩 Scrim',
      domain: '业务扩展',
      typography: '排版',
      spacing: '间距',
      elevation: '层级动效',
      legacy: '兼容别名',
      color: '色彩',
      other: '其他'
    };

    const DEFAULT_AXES = [
      { id: 'brand', name: '品牌与美学一致性', score: 4.5, status: 'pass', note: '' },
      { id: 'hierarchy', name: '视觉层级与版式工艺', score: 4.5, status: 'pass', note: '' },
      { id: 'restraint', name: '克制执行与 Token 卫生', score: 4.5, status: 'pass', note: '' },
      { id: 'a11y', name: '无障碍与功能等价性', score: 4.5, status: 'pass', note: '' },
      { id: 'copy', name: '文案准确性与诚实披露', score: 4.5, status: 'pass', note: '' }
    ];

    const SCENE_CATEGORIES = [
      { key: 'mobile-app', label: '移动端 / App' },
      { key: 'editorial-gallery', label: '画廊 / 作品集 / 杂志' },
      { key: 'dashboard-workspace', label: '仪表盘 / 工作台 / SaaS' },
      { key: 'landing-brand', label: '官网 / 品牌落地页' },
      { key: 'docs-report', label: '报告 / 文档 / 演示' },
      { key: 'marketing-widget', label: '邮件 / 海报 / 挂件 / 其他' }
    ];

    const BRIEF_FIELDS = [
      {
        key: 'palette',
        label: '1. 色板与明暗层次',
        placeholder: '点选上方预置项，或手动补充画布背景色、表面层级与主强调色...',
        presets: [
          '浅色暖纸 + 单一主强调色',
          '纯白极简 + 高对比黑字',
          '深色暗房 / 专业工作台',
          '低饱和中性灰 + 品牌强调色',
          'WCAG AA 对比度（正文 >=4.5:1）',
          '支持浅/深双主题'
        ],
        defaults: ['浅色暖纸 + 单一主强调色', 'WCAG AA 对比度（正文 >=4.5:1）']
      },
      {
        key: 'typography',
        label: '2. 字体与 CJK 排版',
        placeholder: '点选上方预置项，或手动补充标题/正文字体、中文行高与字号层级...',
        presets: [
          '现代无衬线（中文行高 1.4 / 字距 0）',
          '衬线标题 + 无衬线正文（杂志感）',
          '数值等宽 tabular-nums',
          '清晰 4 级字号层级',
          '代码与参数使用等宽字体'
        ],
        defaults: ['现代无衬线（中文行高 1.4 / 字距 0）', '数值等宽 tabular-nums']
      },
      {
        key: 'layout',
        label: '3. 布局与栅格结构',
        placeholder: '点选上方预置项，或手动补充移动端/桌面端断点、导航与容器结构...',
        presets: [
          '移动端优先（390px）+ 桌面自适应（>=1280px）',
          '左侧导航栏 + 主工作区',
          'Bento 模块化卡片网格',
          '瀑布流画廊 + 弹窗详情',
          '单列聚焦流（最大宽 960–1120px）',
          '顶部粘性工具条 / 底部固定操作栏'
        ],
        defaults: ['移动端优先（390px）+ 桌面自适应（>=1280px）', '单列聚焦流（最大宽 960–1120px）']
      },
      {
        key: 'vibe',
        label: '4. 整体氛围与语气',
        placeholder: '点选上方预置项，或手动补充产品视觉气质、动效节制程度与界面语气...',
        presets: [
          '克制专业 / 工具效率感',
          '温暖人文 / 杂志策展感',
          '极简瑞士网格 / 冷静克制',
          '轻盈现代 / 消费级友好感',
          '微动效节制（尊重 reduced-motion）'
        ],
        defaults: ['克制专业 / 工具效率感', '微动效节制（尊重 reduced-motion）']
      },
      {
        key: 'density',
        label: '5. 信息密度与留白',
        placeholder: '点选上方预置项，或手动补充展示页留白与工作台高密度平衡...',
        presets: [
          '宽松呼吸感（首页/展示大留白）',
          '均衡密度（通用 Web/App）',
          '高密度紧凑（数据/专业工作台）',
          '首屏单一焦点 CTA（不堆砌按钮）'
        ],
        defaults: ['均衡密度（通用 Web/App）', '首屏单一焦点 CTA（不堆砌按钮）']
      },
      {
        key: 'constraints',
        label: '6. 禁区与硬约束',
        placeholder: '点选上方预置项，或手动补充禁止项、单测红线与 Git 分支规范...',
        presets: [
          '零 AI 紫蓝（禁 #6366f1/#4f46e5）',
          '零装饰性渐变',
          '零圆角卡片左侧粗彩条',
          '零裸写色值（收口至 tokens）',
          '保留既有业务逻辑与单测',
          '新建独立 Git 分支修改代码'
        ],
        defaults: ['零 AI 紫蓝（禁 #6366f1/#4f46e5）', '零装饰性渐变', '保留既有业务逻辑与单测', '新建独立 Git 分支修改代码']
      },
      {
        key: 'targetPages',
        label: '7. 目标页面与范围',
        placeholder: '点选上方预置项，或手动填写本次需要改造的具体路由与页面名称...',
        presets: [
          '全局 Tokens 与基础壳层',
          '首页 / 入口页',
          '列表 / 画廊 / 筛选页',
          '核心工作台 / 编辑器',
          '详情 / 预览与分享页',
          '弹窗 / 表单与空态'
        ],
        defaults: ['全局 Tokens 与基础壳层', '首页 / 入口页']
      },
      {
        key: 'notes',
        label: '8. 补充备注与参考',
        placeholder: '点选上方预置项，或手动补充验收口径、兼容要求与上游同步约束...',
        presets: [
          '先出 2–3 套方向确认后再落地',
          '双视口（390×844 & 1280×800）实机验收',
          'Thin-Adapter 薄适配便于上游同步',
          '不改动后端接口与数据契约'
        ],
        defaults: ['双视口（390×844 & 1280×800）实机验收', 'Thin-Adapter 薄适配便于上游同步']
      }
    ];

    const initialData = JSON.parse(document.getElementById('studio-initial-state').textContent || '{}');

    const state = {
      data: initialData,
      activeTab: 'overview',
      briefSubView: 'browse', // 'browse' | 'compose'
      libMode: 'templates', // 'templates' (default) | 'systems'
      showcaseOpen: false,
      useSwarm: (function () {
        try {
          const saved = localStorage.getItem('od_studio_use_swarm');
          return saved === null ? true : saved === '1';
        } catch (e) {
          return true;
        }
      })(),
      dsSearch: '',
      dsCategory: 'all',
      dsVisibleCount: 12,
      dsBatchSize: 12,
      dsFilteredItems: [],
      dsPreviewId: initialData.brief && initialData.brief.designSystemId ? initialData.brief.designSystemId : '',
      dsPreviewTab: 'landing',
      dsPaletteSub: 'colors',
      dsStageViewport: 'desktop', // 'desktop' | 'mobile'
      dsCache: {},
      tplPreviewId: initialData.brief && initialData.brief.templateId ? initialData.brief.templateId : '',
      tplPreviewTab: 'example',
      tplCache: {},
      tokenFilter: 'all',
      tokenSearch: '',
      tokenDrafts: {}, // name -> edited value
      designMdBaseline: (initialData.designMd && initialData.designMd.content) || '',
      designMdDraft: (initialData.designMd && initialData.designMd.content) || '',
      pinViewport: 'all',
      activeScreenshotId: (initialData.screenshots && initialData.screenshots[0] && initialData.screenshots[0].id) || '',
      selectedPinId: '',
      activePairKey: '',
      baSplit: 50,
      h5Viewport: 'mobile'
    };

    if (!state.data.critique || !Array.isArray(state.data.critique.axes) || state.data.critique.axes.length === 0) {
      state.data.critique = { axes: DEFAULT_AXES.map(function (a) { return Object.assign({}, a); }) };
    }

    // ---------- Helpers ----------
    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    let toastTimer = null;
    function showToast(msg) {
      const el = document.getElementById('studio-toast');
      el.textContent = msg;
      el.classList.add('is-visible');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        el.classList.remove('is-visible');
      }, 2800);
    }

    function copyText(text, label) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          showToast('已复制' + (label ? '：' + label : '到剪贴板'));
        }).catch(function () {
          fallbackCopy(text, label);
        });
      } else {
        fallbackCopy(text, label);
      }
    }

    function fallbackCopy(text, label) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        showToast('已复制' + (label ? '：' + label : '到剪贴板'));
      } catch (err) {
        showToast('复制失败，请手动选中复制');
      }
      document.body.removeChild(ta);
    }

    async function apiJson(url, options) {
      const res = await fetch(url, Object.assign({
        headers: { 'Content-Type': 'application/json' }
      }, options || {}));
      const payload = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        throw new Error(payload.error || ('请求失败 (' + res.status + ')'));
      }
      return payload;
    }

    function requireLive(actionName) {
      if (state.data.liveMode) return true;
      showToast('静态只读模式不支持「' + actionName + '」，请使用 --serve 启动 Live 工作台');
      return false;
    }

    function sumCounts(obj) {
      if (!obj || typeof obj !== 'object') return 0;
      if (Object.prototype.hasOwnProperty.call(obj, 'total')) {
        return Number(obj.total) || 0;
      }
      return Object.values(obj).reduce(function (acc, n) {
        return acc + (Number(n) || 0);
      }, 0);
    }

    // ---------- Color / Alpha Parsing ----------
    function parseColorValue(val) {
      const v = String(val || '').trim();
      const hexMatch = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3) {
          hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        return { kind: 'hex', hex: '#' + hex.toLowerCase(), alpha: 1 };
      }
      const rgbaMatch = v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([0-9.]+))?\s*\)$/i);
      if (rgbaMatch) {
        const r = Math.min(255, Number(rgbaMatch[1]));
        const g = Math.min(255, Number(rgbaMatch[2]));
        const b = Math.min(255, Number(rgbaMatch[3]));
        const a = rgbaMatch[4] !== undefined ? Math.max(0, Math.min(1, Number(rgbaMatch[4]))) : 1;
        const hex = '#' + [r, g, b].map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
        return { kind: 'rgba', hex: hex, alpha: a };
      }
      return null;
    }

    function hexToRgba(hex, alpha) {
      const clean = hex.replace('#', '');
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      const a = Math.round(alpha * 100) / 100;
      return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
    }

    // ---------- Header & Tab Switching ----------
    function renderHeaderMeta() {
      const el = document.getElementById('header-meta');
      const livePill = state.data.liveMode
        ? '<span class="pill pill--live"><span class="dot"></span>实时工作台 · 127.0.0.1:' + esc(state.data.port || 4310) + '</span>'
        : '<span class="pill pill--static"><span class="dot"></span>静态只读归档</span>';
      const p0Count = sumCounts(state.data.audit && state.data.audit.p0);
      const auditPill = state.data.audit && state.data.audit.pass && p0Count === 0
        ? '<span class="pill pill--pass tabular">审计 PASS</span>'
        : '<span class="pill pill--fail tabular">审计待修 · P0 ' + p0Count + '</span>';
      el.innerHTML = livePill + auditPill;

      document.getElementById('static-mode-banner').hidden = Boolean(state.data.liveMode);
      updateTabBadges();
    }

    function updateTabBadges() {
      const p0 = sumCounts(state.data.audit && state.data.audit.p0);
      const p1 = sumCounts(state.data.audit && state.data.audit.p1);
      document.getElementById('badge-audit').textContent = 'P0:' + p0 + '/P1:' + p1;
      document.getElementById('badge-systems').textContent = String((state.data.designSystems || []).length);
      const dirtyTokens = Object.keys(state.tokenDrafts).length;
      document.getElementById('badge-tokens').textContent = dirtyTokens > 0 ? (dirtyTokens + ' 改') : String((state.data.tokens || []).length);
      const openPins = (state.data.annotations || []).filter(function (p) { return p.status !== 'resolved'; }).length;
      document.getElementById('badge-pins').textContent = String(openPins);
      document.getElementById('badge-rules').textContent = String((state.data.rules || []).length);
    }

    function switchTab(tabId) {
      state.activeTab = tabId;
      document.querySelectorAll('.tab-btn').forEach(function (btn) {
        const active = btn.getAttribute('data-tab') === tabId;
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      document.querySelectorAll('.tab-panel').forEach(function (panel) {
        panel.classList.toggle('is-active', panel.id === 'panel-' + tabId);
      });
      if (window.location.hash !== '#tab-' + tabId) {
        try { history.replaceState(null, '', '#tab-' + tabId); } catch (e) {}
      }
      if (tabId === 'brief') {
        requestAnimationFrame(function () {
          syncShowcaseDesktopScale();
        });
      }
      updateFloatingBriefPill();
    }

    function switchBriefSubView(viewName, scrollTop) {
      state.briefSubView = viewName === 'compose' ? 'compose' : 'browse';
      const browseEl = document.getElementById('brief-view-browse');
      const composeEl = document.getElementById('brief-view-compose');
      if (browseEl) browseEl.hidden = state.briefSubView !== 'browse';
      if (composeEl) composeEl.hidden = state.briefSubView !== 'compose';
      document.querySelectorAll('[data-brief-view]').forEach(function (btn) {
        const active = btn.getAttribute('data-brief-view') === state.briefSubView;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      updateFloatingBriefPill();
      if (scrollTop) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }

    function updateFloatingBriefPill() {
      const pill = document.getElementById('brief-floating-pill');
      const topStatus = document.getElementById('brief-topbar-status');
      const b = state.data.brief || {};
      const dir = (state.data.directions || []).find(function (d) { return d.id === b.directionId; });
      const ds = (state.data.designSystems || []).find(function (d) { return d.id === b.designSystemId; });
      const tpl = (state.data.designTemplates || []).find(function (t) { return t.id === b.templateId; });
      const picked = [tpl && tpl.name, ds && ds.name, dir && dir.name].filter(Boolean);

      if (topStatus) {
        topStatus.innerHTML = picked.length
          ? '<span class="pill pill--accent">已选：' + esc(picked.join(' + ')) + '</span>'
          : '<span class="pill">尚未选定参考风格</span>';
      }
      if (!pill) return;
      const shouldShow = state.activeTab === 'brief' && state.briefSubView === 'browse';
      pill.hidden = !shouldShow;
      if (shouldShow) {
        pill.textContent = picked.length
          ? ('已选：' + picked[0] + (picked.length > 1 ? ' 等' + picked.length + '项' : '') + ' · 去填 Brief →')
          : '去制定 8 维 Brief →';
      }
    }

    function openShowcaseModal() {
      state.showcaseOpen = true;
      const modal = document.getElementById('showcase-modal');
      if (modal) modal.hidden = false;
      renderDesignSystemPreview();
    }

    function closeShowcaseModal() {
      state.showcaseOpen = false;
      const modal = document.getElementById('showcase-modal');
      const box = document.getElementById('ds-preview');
      if (modal) modal.hidden = true;
      if (box) box.innerHTML = '';
    }

    // ---------- Tab 1: Overview & Live Audit ----------
    function renderOverview() {
      const audit = state.data.audit || {};
      const p0Total = sumCounts(audit.p0);
      const p1Total = sumCounts(audit.p1);
      const bs = state.data.buildSummary || {};
      const axes = (state.data.critique && state.data.critique.axes) || [];
      const avgScore = axes.length
        ? (axes.reduce(function (s, a) { return s + (Number(a.score) || 0); }, 0) / axes.length).toFixed(1)
        : '—';

      document.getElementById('overview-kpis').innerHTML = [
        {
          label: '合规门禁状态',
          value: audit.pass && p0Total === 0 ? 'PASS' : 'FAIL',
          sub: '已扫描 ' + (audit.totalFiles || 0) + ' 个文件' + (audit.timestamp ? ' · ' + audit.timestamp : '')
        },
        {
          label: 'P0 阻断违规项',
          value: String(p0Total),
          sub: p0Total === 0 ? '零 AI-Slop 阻断项' : '需优先修复全部 P0'
        },
        {
          label: 'P1 卫生建议项',
          value: String(p1Total),
          sub: 'Token 卫生与排版约束检查'
        },
        {
          label: '五维评审均分 / 覆盖',
          value: avgScore + ' / 5.0',
          sub: '已重构 ' + (bs.refactoredFilesCount || 0) + ' 个核心文件'
        }
      ].map(function (k) {
        return '<div class="kpi-card">'
          + '<div class="kpi-label">' + esc(k.label) + '</div>'
          + '<div class="kpi-value tabular">' + esc(k.value) + '</div>'
          + '<div class="kpi-sub">' + esc(k.sub) + '</div>'
          + '</div>';
      }).join('');

      function renderMetricGroup(title, map, pillKind) {
        const entries = Object.entries(map || {});
        if (!entries.length) {
          return '<div class="card" style="padding: 14px;"><h3 style="font-size:15px;margin-bottom:8px;">' + esc(title) + '</h3><div class="empty-box">暂无明细记录</div></div>';
        }
        return '<div class="card" style="padding: 14px;"><h3 style="font-size:15px;margin-bottom:10px;">' + esc(title) + '</h3><div class="kv-list">'
          + entries.map(function (pair) {
            const key = pair[0];
            const count = Number(pair[1]) || 0;
            const meta = AUDIT_KEY_META[key];
            const cls = meta && meta.informational
              ? 'pill--p2'
              : (count === 0 ? 'pill--pass' : pillKind);
            const labelHtml = meta
              ? '<div class="audit-metric-main">'
                + '<div class="audit-metric-title"><span>' + esc(meta.title) + '</span><span class="audit-metric-key">' + esc(key) + '</span></div>'
                + '<div class="audit-metric-desc">' + esc(meta.desc) + '</div>'
                + '</div>'
              : '<span class="kv-key">' + esc(key) + '</span>';
            return '<div class="kv-row" style="align-items:flex-start;">' + labelHtml + '<span class="pill ' + cls + ' tabular" style="margin-top:2px;">' + count + '</span></div>';
          }).join('')
          + '</div></div>';
      }

      document.getElementById('audit-breakdown').innerHTML =
        renderMetricGroup('P0 阻断项明细', audit.p0, 'pill--fail') +
        renderMetricGroup('P1 卫生项明细', audit.p1, 'pill--warn');

      document.getElementById('audit-raw-output').textContent = audit.rawOutput || '（尚无原始审计日志，请在 Live 模式下点击「实时重跑合规审计」）';

      const bsLabels = {
        typecheck: 'Typecheck 类型检查',
        unitTests: '单元测试',
        test: '测试脚本',
        build: '构建脚本',
        h5Build: '前端构建产物',
        preview: '实时预览入口',
        refactoredFilesCount: '扫描/覆盖文件数'
      };
      const summaryRows = [];
      Object.entries(bs).forEach(function (pair) {
        if (pair[1] === undefined || pair[1] === null || pair[1] === '') return;
        const label = bsLabels[pair[0]] || pair[0];
        summaryRows.push([label, String(pair[1])]);
      });
      summaryRows.push(['实时项目预览', state.data.hasPreview ? ('已就绪 (' + (state.data.previewUrl || '/preview/') + ')') : '未挂载（可用 --preview-dir / --preview-url）']);
      summaryRows.push(['Token 源文件', state.data.tokenFile || '—']);
      summaryRows.push(['DESIGN.md 路径', (state.data.designMd && state.data.designMd.path) || 'DESIGN.md']);
      document.getElementById('build-summary-grid').innerHTML = summaryRows.map(function (r) {
        return '<div class="kv-row"><span class="kv-key">' + esc(r[0]) + '</span><span class="kv-val">' + esc(r[1]) + '</span></div>';
      }).join('');
    }

    async function handleRunAudit() {
      if (!requireLive('实时重跑合规审计')) return;
      const btn = document.getElementById('run-audit-btn');
      btn.disabled = true;
      btn.textContent = '正在执行审计...';
      try {
        const freshAudit = await apiJson('/api/audit', { method: 'POST' });
        state.data.audit = freshAudit;
        renderOverview();
        renderHeaderMeta();
        document.getElementById('audit-log-details').open = true;
        showToast('合规审计已完成：' + (freshAudit.pass ? 'PASS' : '发现待修项'));
      } catch (err) {
        showToast('审计失败：' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = '实时重跑合规审计';
      }
    }

    // ---------- Tab 2: Brief & 152+ Design Systems ----------
    function safeCssVal(val, fallback) {
      const s = String(val || '').trim();
      if (!s || /[;{}<>]/.test(s)) return fallback;
      return s;
    }

    function normalizePalette(p) {
      const raw = (p && typeof p === 'object') ? p : {};
      return {
        bg: safeCssVal(raw.bg, '#FBF7F0'),
        surface: safeCssVal(raw.surface, '#FFFDF9'),
        fg: safeCssVal(raw.fg, '#161D1B'),
        muted: safeCssVal(raw.muted, '#5A6460'),
        accent: safeCssVal(raw.accent, '#B85A3A'),
        border: safeCssVal(raw.border, '#DCD4C7'),
        radius: safeCssVal(raw.radius, '8px'),
        fontStyle: String(raw.fontStyle || '')
      };
    }

    function fontFamilyForStyle(fontStyle) {
      const fs = String(fontStyle || '').toLowerCase();
      if (fs.includes('serif')) return 'var(--font-display)';
      if (fs.includes('mono')) return 'var(--font-mono)';
      return 'var(--font-body)';
    }

    function renderMiniPreviewHtml(rawPalette, titleText, large) {
      const p = normalizePalette(rawPalette);
      const ff = fontFamilyForStyle(p.fontStyle);
      const cls = 'mini-preview' + (large ? ' mini-preview--lg' : '');
      const headline = titleText || 'Aa 设计预览';
      return '<div class="' + cls + '" style="background:' + esc(p.bg) + ';border-color:' + esc(p.border) + ';">'
        + '<div class="mini-preview-bar" style="background:' + esc(p.surface) + ';border-bottom-color:' + esc(p.border) + ';">'
        + '<span class="mini-preview-dots">'
        + '<span class="mini-preview-dot" style="background:' + esc(p.accent) + ';opacity:0.85;"></span>'
        + '<span class="mini-preview-dot" style="background:' + esc(p.muted) + ';"></span>'
        + '<span class="mini-preview-dot" style="background:' + esc(p.muted) + ';"></span>'
        + '</span>'
        + '<span style="font-size:10px;color:' + esc(p.muted) + ';font-family:var(--font-mono);">' + esc(p.radius) + '</span>'
        + '</div>'
        + '<div class="mini-preview-body">'
        + '<div class="mini-preview-card" style="background:' + esc(p.surface) + ';border:1px solid ' + esc(p.border) + ';border-radius:' + esc(p.radius) + ';">'
        + '<div class="mini-preview-head" style="color:' + esc(p.fg) + ';font-family:' + ff + ';">' + esc(headline) + '</div>'
        + '<div class="mini-preview-line" style="background:' + esc(p.muted) + ';"></div>'
        + '<div class="mini-preview-cta-row">'
        + '<span class="mini-preview-cta" style="background:' + esc(p.accent) + ';border-radius:' + esc(p.radius) + ';">' + (large ? '主按钮 CTA' : '') + '</span>'
        + '<span class="mini-preview-ghost" style="background:' + esc(p.border) + ';border-radius:' + esc(p.radius) + ';"></span>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '<div class="mini-swatch-strip">'
        + '<span class="mini-swatch-dots">'
        + '<span class="mini-swatch-dot" style="background:' + esc(p.bg) + ';" title="背景 ' + esc(p.bg) + '"></span>'
        + '<span class="mini-swatch-dot" style="background:' + esc(p.surface) + ';" title="表面 ' + esc(p.surface) + '"></span>'
        + '<span class="mini-swatch-dot" style="background:' + esc(p.fg) + ';" title="文字 ' + esc(p.fg) + '"></span>'
        + '<span class="mini-swatch-dot" style="background:' + esc(p.accent) + ';" title="主色 ' + esc(p.accent) + '"></span>'
        + '</span>'
        + '<span style="font-size:10px;color:var(--studio-muted);font-family:var(--font-mono);">' + esc(p.accent) + '</span>'
        + '</div>'
        + '</div>';
    }

    function renderPaletteThumbFallbackHtml(rawPalette, hintText) {
      const p = normalizePalette(rawPalette);
      return '<div class="web-thumb-fallback" style="background:' + esc(p.bg) + ';">'
        + '<span class="web-thumb-hint">' + esc(hintText) + '</span>'
        + '<div class="mini-swatch-strip" style="margin:-10px;border-top:1px solid rgba(22,29,27,0.1);">'
        + '<span class="mini-swatch-dots">'
        + '<span class="mini-swatch-dot" style="background:' + esc(p.bg) + ';"></span>'
        + '<span class="mini-swatch-dot" style="background:' + esc(p.surface) + ';"></span>'
        + '<span class="mini-swatch-dot" style="background:' + esc(p.fg) + ';"></span>'
        + '<span class="mini-swatch-dot" style="background:' + esc(p.accent) + ';"></span>'
        + '</span>'
        + '<span style="font-size:10px;color:var(--studio-muted);font-family:var(--font-mono);">' + esc(p.accent) + '</span>'
        + '</div></div>';
    }

    function renderWebThumbHtml(thumbUrl, rawPalette, titleText) {
      if (state.data.liveMode && thumbUrl) {
        return '<div class="web-thumb" data-fallback-bg="' + esc(normalizePalette(rawPalette).bg) + '" data-fallback-accent="' + esc(normalizePalette(rawPalette).accent) + '">'
          + '<div class="web-thumb-skeleton">缩略图渲染中...</div>'
          + '<img class="web-thumb-img" src="' + esc(thumbUrl) + '" loading="lazy" decoding="async" alt="' + esc(titleText || '风格缩略图') + '" />'
          + '</div>';
      }
      return '<div class="web-thumb">'
        + renderPaletteThumbFallbackHtml(rawPalette, state.data.liveMode ? '暂无缩略图' : '启动 --serve 查看实景缩略图')
        + '</div>';
    }

    function wireThumbImages(rootEl) {
      if (!rootEl) return;
      rootEl.querySelectorAll('img.web-thumb-img').forEach(function (img) {
        const box = img.closest('.web-thumb');
        if (!box) return;
        const markLoaded = function () {
          box.classList.add('is-loaded');
        };
        if (img.complete && img.naturalWidth > 0) {
          markLoaded();
          return;
        }
        img.addEventListener('load', markLoaded, { once: true });
        img.addEventListener('error', function () {
          const bg = box.getAttribute('data-fallback-bg') || '#FBF7F0';
          const accent = box.getAttribute('data-fallback-accent') || '#B85A3A';
          box.classList.add('is-loaded');
          box.innerHTML = renderPaletteThumbFallbackHtml({ bg: bg, accent: accent }, '点击查看实景预览');
        }, { once: true });
      });
    }

    function syncShowcaseDesktopScale() {
      const vp = document.getElementById('showcase-desktop-vp');
      if (!vp) return;
      const w = vp.clientWidth || 1100;
      const scale = Math.min(1, Math.max(0.22, w / 1280));
      vp.style.setProperty('--stage-scale', scale.toFixed(4));
    }

    function renderDirections() {
      const dirs = state.data.directions || [];
      const container = document.getElementById('directions-grid');
      if (!dirs.length) {
        container.innerHTML = '<div class="empty-box">未加载到内置方向列表。</div>';
        return;
      }
      container.innerHTML = dirs.map(function (d) {
        const selected = state.data.brief.directionId === d.id;
        return '<button type="button" class="select-card' + (selected ? ' is-selected' : '') + '" data-dir-id="' + esc(d.id) + '">'
          + renderWebThumbHtml(d.thumbUrl, d.previewPalette, d.name)
          + '<div class="select-card-title"><span>' + esc(d.name) + '</span>' + (selected ? '<span class="pill pill--accent">已选</span>' : '') + '</div>'
          + '<div class="select-card-desc">' + esc(d.summary || '') + '</div>'
          + (Array.isArray(d.tags) && d.tags.length ? '<div class="actions-row" style="margin-top:auto;">' + d.tags.slice(0, 3).map(function (t) { return '<span class="pill">' + esc(t) + '</span>'; }).join('') + '</div>' : '')
          + '</button>';
      }).join('');
      wireThumbImages(container);
    }

    let waterfallObserver = null;

    function cleanSummaryText(raw) {
      const s = String(raw || '').trim();
      if (!s || /^[|>][-+]?$/.test(s)) return '';
      return s;
    }

    function renderGalleryCardHtml(item, isTpl) {
      const desc = cleanSummaryText(item.summary);
      const descHtml = desc ? '<div class="select-card-desc">' + esc(desc) + '</div>' : '';
      if (isTpl) {
        const isChosen = state.data.brief.templateId === item.id;
        const isViewing = state.tplPreviewId === item.id;
        const badgeHtml = item.sceneLabel
          ? '<div class="actions-row" style="margin-top:4px;"><span class="pill">' + esc(item.sceneLabel) + '</span>' + (item.sizeKb ? '<span class="pill tabular">' + esc(item.sizeKb) + 'KB</span>' : '') + '</div>'
          : '';
        return '<button type="button" class="select-card' + (isChosen || isViewing ? ' is-selected' : '') + '" data-tpl-id="' + esc(item.id) + '">'
          + renderWebThumbHtml(item.thumbUrl, null, item.name)
          + '<div class="select-card-title"><span>' + esc(item.name) + '</span>' + (isChosen ? '<span class="pill pill--accent">已选用</span>' : '') + '</div>'
          + descHtml
          + badgeHtml
          + '</button>';
      }
      const isChosen = state.data.brief.designSystemId === item.id;
      const isViewing = state.dsPreviewId === item.id;
      return '<button type="button" class="select-card' + (isChosen || isViewing ? ' is-selected' : '') + '" data-ds-id="' + esc(item.id) + '">'
        + renderWebThumbHtml(item.thumbUrl, item.previewPalette, item.name)
        + '<div class="select-card-title"><span>' + esc(item.name) + '</span>' + (isChosen ? '<span class="pill pill--accent">已选用</span>' : '') + '</div>'
        + descHtml
        + '</button>';
    }

    function updateWaterfallFooter() {
      const sentinel = document.getElementById('ds-waterfall-sentinel');
      if (!sentinel) return;
      const total = state.dsFilteredItems.length;
      sentinel.hidden = total === 0 || state.dsVisibleCount >= total;
    }

    function appendMoreWaterfallCards() {
      const total = state.dsFilteredItems.length;
      if (state.dsVisibleCount >= total) return;
      const prevCount = state.dsVisibleCount;
      const nextCount = Math.min(total, prevCount + state.dsBatchSize);
      state.dsVisibleCount = nextCount;
      const isTpl = state.libMode === 'templates';
      const slice = state.dsFilteredItems.slice(prevCount, nextCount);
      const listEl = document.getElementById('ds-list');
      if (listEl && slice.length) {
        const temp = document.createElement('div');
        temp.innerHTML = slice.map(function (it) { return renderGalleryCardHtml(it, isTpl); }).join('');
        const frag = document.createDocumentFragment();
        const appended = [];
        while (temp.firstChild) {
          appended.push(temp.firstChild);
          frag.appendChild(temp.firstChild);
        }
        listEl.appendChild(frag);
        appended.forEach(function (node) { wireThumbImages(node); });
      }
      updateWaterfallFooter();
    }

    function ensureWaterfallObserver() {
      const sentinel = document.getElementById('ds-waterfall-sentinel');
      if (!sentinel || typeof IntersectionObserver === 'undefined') return;
      if (!waterfallObserver) {
        waterfallObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting && state.activeTab === 'brief' && state.dsVisibleCount < state.dsFilteredItems.length) {
              appendMoreWaterfallCards();
            }
          });
        }, { rootMargin: '320px 0px' });
      }
      waterfallObserver.observe(sentinel);
    }

    function renderDesignSystems() {
      const systems = state.data.designSystems || [];
      const templates = state.data.designTemplates || [];
      const sysTabBtn = document.getElementById('lib-mode-systems');
      const tplTabBtn = document.getElementById('lib-mode-templates');
      if (tplTabBtn) {
        tplTabBtn.textContent = templates.length + ' 套整页真实模板';
        tplTabBtn.classList.toggle('is-active', state.libMode === 'templates');
      }
      if (sysTabBtn) {
        sysTabBtn.textContent = systems.length + ' 套配色与组件体系';
        sysTabBtn.classList.toggle('is-active', state.libMode === 'systems');
      }

      const isTpl = state.libMode === 'templates';
      const all = isTpl ? templates : systems;
      const chipWrap = document.getElementById('ds-category-chips');

      if (isTpl) {
        const counts = {};
        templates.forEach(function (t) {
          const k = t.sceneCategory || 'marketing-widget';
          counts[k] = (counts[k] || 0) + 1;
        });
        chipWrap.innerHTML = '<button type="button" class="btn btn--chip' + (state.dsCategory === 'all' ? ' is-active' : '') + '" data-ds-cat="all">全部 (' + templates.length + ')</button>'
          + SCENE_CATEGORIES.map(function (c) {
            const cnt = counts[c.key] || 0;
            return '<button type="button" class="btn btn--chip' + (state.dsCategory === c.key ? ' is-active' : '') + '" data-ds-cat="' + esc(c.key) + '">' + esc(c.label) + ' (' + cnt + ')</button>';
          }).join('');
      } else {
        const cats = Array.from(new Set(systems.map(function (d) { return d.category || '其他'; }))).slice(0, 8);
        if (cats.length > 1) {
          chipWrap.innerHTML = '<button type="button" class="btn btn--chip' + (state.dsCategory === 'all' ? ' is-active' : '') + '" data-ds-cat="all">全部 (' + systems.length + ')</button>'
            + cats.map(function (c) {
              return '<button type="button" class="btn btn--chip' + (state.dsCategory === c ? ' is-active' : '') + '" data-ds-cat="' + esc(c) + '">' + esc(c) + '</button>';
            }).join('');
        } else {
          chipWrap.innerHTML = '';
        }
      }

      const q = state.dsSearch.trim().toLowerCase();
      const filtered = all.filter(function (d) {
        if (state.dsCategory !== 'all') {
          const catKey = isTpl ? (d.sceneCategory || 'marketing-widget') : (d.category || '其他');
          if (catKey !== state.dsCategory) return false;
        }
        if (!q) return true;
        return (d.name || '').toLowerCase().includes(q)
          || (d.id || '').toLowerCase().includes(q)
          || (d.summary || '').toLowerCase().includes(q)
          || (d.sceneLabel || '').toLowerCase().includes(q)
          || (d.category || '').toLowerCase().includes(q);
      });

      state.dsFilteredItems = filtered;
      const visibleItems = filtered.slice(0, state.dsVisibleCount);

      document.getElementById('ds-count-desc').textContent = isTpl
        ? ('每套模板拥有完全不同的页面布局、排版结构与视觉气质（共 ' + templates.length + ' 套，当前筛选命中 ' + filtered.length + ' 套）。')
        : ('配色与组件体系采用统一对比版式以凸显色彩、字体与 Token 差异（共 ' + systems.length + ' 套，命中 ' + filtered.length + ' 套）；如需不同整页布局，请切换至「整页真实模板」。');

      const listEl = document.getElementById('ds-list');
      if (!visibleItems.length) {
        listEl.innerHTML = '<div class="empty-box">没有匹配的条目，请调整搜索关键词或分类。</div>';
      } else {
        listEl.innerHTML = visibleItems.map(function (item) { return renderGalleryCardHtml(item, isTpl); }).join('');
      }

      updateWaterfallFooter();
      ensureWaterfallObserver();
      wireThumbImages(listEl);
      if (state.showcaseOpen) {
        renderDesignSystemPreview();
      }
    }

    function renderPaletteSwatchesHtml(rawPalette) {
      const p = normalizePalette(rawPalette);
      const items = [
        ['背景 bg', p.bg],
        ['表面 surface', p.surface],
        ['主字 fg', p.fg],
        ['次字 muted', p.muted],
        ['主色 accent', p.accent],
        ['边框 border', p.border]
      ];
      return '<div class="swatch-grid">' + items.map(function (it) {
        return '<button type="button" class="swatch-chip" data-copy-swatch="' + esc(it[1]) + '" title="点击复制 ' + esc(it[1]) + '">'
          + '<span class="swatch-chip-dot" style="background:' + esc(it[1]) + ';"></span>'
          + '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;"><strong>' + esc(it[0]) + '</strong><br><span style="color:var(--studio-muted);font-family:var(--font-mono);">' + esc(it[1]) + '</span></span>'
          + '</button>';
      }).join('') + '</div>';
    }

    function renderShowcaseIframeHtml(url, titleText) {
      const isMobile = state.dsStageViewport === 'mobile';
      const loadingOverlay = '<div class="showcase-loading" id="showcase-loading-overlay">正在加载实景网页预览...</div>';
      if (isMobile) {
        return '<div class="showcase-stage-wrap">'
          + '<div class="showcase-viewport showcase-viewport--mobile">'
          + loadingOverlay
          + '<iframe class="showcase-iframe showcase-iframe--mobile" id="active-showcase-iframe" src="' + esc(url) + '" sandbox="allow-same-origin allow-scripts" loading="lazy" title="' + esc(titleText) + '"></iframe>'
          + '</div></div>';
      }
      return '<div class="showcase-stage-wrap">'
        + '<div class="showcase-viewport showcase-viewport--desktop" id="showcase-desktop-vp">'
        + loadingOverlay
        + '<iframe class="showcase-iframe showcase-iframe--desktop" id="active-showcase-iframe" src="' + esc(url) + '" sandbox="allow-same-origin allow-scripts" loading="lazy" title="' + esc(titleText) + '"></iframe>'
        + '</div></div>';
    }

    function renderDesignSystemPreview() {
      if (!state.showcaseOpen) return;
      const box = document.getElementById('ds-preview');
      if (!box) return;
      if (state.libMode === 'templates') {
        renderTemplateShowcase(box);
        return;
      }

      const id = state.dsPreviewId;
      if (!id) {
        closeShowcaseModal();
        return;
      }
      const sys = (state.data.designSystems || []).find(function (d) { return d.id === id; });
      if (!sys) return;

      const isChosen = state.data.brief.designSystemId === id;
      const cached = state.dsCache[id] || {};
      const urls = Object.assign({}, sys.previewUrls || {}, cached.previewUrls || {});

      const availableTabs = [];
      if (urls.landing) availableTabs.push({ key: 'landing', label: '落地页', url: urls.landing });
      if (urls.kit) availableTabs.push({ key: 'kit', label: '浅色组件库', url: urls.kit });
      if (urls.kitDark) availableTabs.push({ key: 'kitDark', label: '深色组件库', url: urls.kitDark });
      if (urls.form) availableTabs.push({ key: 'form', label: '表单页', url: urls.form });
      if (urls.poster) availableTabs.push({ key: 'poster', label: '海报', url: urls.poster });
      if (urls.components) availableTabs.push({ key: 'components', label: '组件全集', url: urls.components });
      if (urls.colors || urls.typography) availableTabs.push({ key: 'palette', label: '色彩与字体', url: urls.colors || urls.typography });
      availableTabs.push({ key: 'spec', label: '设计规范 (DESIGN.md)', url: '' });

      if (!availableTabs.some(function (t) { return t.key === state.dsPreviewTab; })) {
        state.dsPreviewTab = availableTabs[0].key;
      }
      const activeTabObj = availableTabs.find(function (t) { return t.key === state.dsPreviewTab; }) || availableTabs[0];

      let activeOpenUrl = activeTabObj.url || '';
      if (activeTabObj.key === 'palette') {
        const sub = (state.dsPaletteSub === 'typography' && urls.typography) || !urls.colors ? 'typography' : 'colors';
        activeOpenUrl = sub === 'typography' ? (urls.typography || '') : (urls.colors || '');
      }

      let bodyHtml = '';
      if (activeTabObj.key === 'spec') {
        let bodyText = sys.summary || '（暂无摘要）';
        if (cached.loading) {
          bodyText = '正在加载 ' + id + ' 规范文档...';
        } else if (cached.error) {
          bodyText = '读取失败：' + cached.error + '\n\n摘要：' + (sys.summary || '');
        } else if (cached.content) {
          bodyText = cached.content.slice(0, 6000) + (cached.content.length > 6000 ? '\n\n...（完整内容已截断展示）' : '');
        } else if (!state.data.liveMode) {
          bodyText = (sys.summary || '') + '\n\n（静态归档模式仅显示索引摘要；启动 --serve Live 工作台可查看完整 DESIGN-zh.md / DESIGN.md）';
        }
        bodyHtml = '<div class="ds-preview-body">' + esc(bodyText) + '</div>';
      } else if (!state.data.liveMode) {
        bodyHtml = '<div style="display:grid;gap:12px;">'
          + renderPaletteSwatchesHtml(sys.previewPalette)
          + '<div class="empty-box">当前为静态离线 HTML 归档模式。请通过 <code>--serve</code> 启动本地 Live 工作台以加载官方完整实景网页（landing / kit / components）。</div>'
          + '</div>';
      } else if (activeTabObj.key === 'palette') {
        const hasColors = Boolean(urls.colors);
        const hasTypo = Boolean(urls.typography);
        const activeSub = (state.dsPaletteSub === 'typography' && hasTypo) || !hasColors ? 'typography' : 'colors';
        const subToggle = (hasColors && hasTypo)
          ? '<div class="actions-row">'
            + '<button type="button" class="btn btn--chip btn--sm' + (activeSub === 'colors' ? ' is-active' : '') + '" data-ds-pal-sub="colors">色彩体系 (colors.html)</button>'
            + '<button type="button" class="btn btn--chip btn--sm' + (activeSub === 'typography' ? ' is-active' : '') + '" data-ds-pal-sub="typography">字体排版 (typography.html)</button>'
            + '</div>'
          : '';
        bodyHtml = subToggle + renderShowcaseIframeHtml(activeOpenUrl, sys.name + ' 色彩与字体');
      } else {
        bodyHtml = renderShowcaseIframeHtml(activeOpenUrl, sys.name + ' ' + activeTabObj.label);
      }

      const showViewportControls = state.data.liveMode && activeTabObj.key !== 'spec' && activeOpenUrl;
      box.innerHTML = '<div class="actions-row" style="justify-content: space-between;">'
        + '<div class="actions-row" style="min-width:0;"><strong style="font-size:17px;">' + esc(sys.name) + '</strong> <span class="pill">' + esc(sys.id) + '</span>' + (isChosen ? '<span class="pill pill--accent">当前已选</span>' : '') + '</div>'
        + '<div class="actions-row">'
        + (showViewportControls
          ? '<button type="button" class="btn btn--chip btn--sm' + (state.dsStageViewport === 'desktop' ? ' is-active' : '') + '" data-stage-vp="desktop">桌面 1280px</button>'
            + '<button type="button" class="btn btn--chip btn--sm' + (state.dsStageViewport === 'mobile' ? ' is-active' : '') + '" data-stage-vp="mobile">手机 390px</button>'
            + '<a class="btn btn--sm" href="' + esc(activeOpenUrl) + '" target="_blank" rel="noopener">新窗口全屏查看</a>'
          : '')
        + '<button type="button" class="btn btn--sm" id="showcase-close-btn">关闭 (Esc)</button>'
        + '</div></div>'
        + '<div class="actions-row" role="tablist" aria-label="设计体系实景视图">'
        + availableTabs.map(function (t) {
          return '<button type="button" class="btn btn--chip' + (activeTabObj.key === t.key ? ' is-active' : '') + '" data-ds-tab="' + esc(t.key) + '">' + esc(t.label) + '</button>';
        }).join('')
        + '</div>'
        + bodyHtml
        + '<div class="showcase-modal-footer">'
        + '<span style="font-size:12px;color:var(--studio-muted);">提示：按 Esc 或点击遮罩可关闭弹窗并继续浏览瀑布流。</span>'
        + '<div class="actions-row">'
        + '<button type="button" class="btn" id="use-item-stay-btn">仅选用，继续浏览</button>'
        + '<button type="button" class="btn btn--primary" id="use-item-go-brief-btn">选用并去填 Brief →</button>'
        + '</div></div>';

      wireShowcaseControls(box, sys, false);
      syncShowcaseDesktopScale();
    }

    function renderTemplateShowcase(box) {
      const id = state.tplPreviewId;
      if (!id) {
        closeShowcaseModal();
        return;
      }
      const tpl = (state.data.designTemplates || []).find(function (t) { return t.id === id; });
      if (!tpl) return;

      const isChosen = state.data.brief.templateId === id;
      const cached = state.tplCache[id] || {};
      const tab = state.tplPreviewTab || 'example';
      const exampleUrl = tpl.hasExampleHtml ? tpl.exampleUrl : '';

      let bodyHtml = '';
      if (tab === 'readme') {
        let txt = tpl.summary || '（暂无说明文档）';
        if (cached.loading) txt = '正在加载模板说明...';
        else if (cached.error) txt = '读取失败：' + cached.error;
        else if (cached.readme) txt = cached.readme.slice(0, 6000) + (cached.readme.length > 6000 ? '\n\n...（完整内容已截断展示）' : '');
        else if (!state.data.liveMode) txt = (tpl.summary || '') + '\n\n（启动 --serve Live 工作台可查看完整 README / SKILL 说明）';
        bodyHtml = '<div class="ds-preview-body">' + esc(txt) + '</div>';
      } else if (!state.data.liveMode || !exampleUrl) {
        bodyHtml = '<div class="empty-box">' + (state.data.liveMode ? '该模板未包含 example.html。' : '当前为静态离线归档模式。请通过 --serve 启动本地 Live 工作台以加载完整整页模板实景预览。') + '</div>';
      } else {
        bodyHtml = renderShowcaseIframeHtml(exampleUrl, tpl.name + ' 整页模板实景');
      }

      const showViewportControls = state.data.liveMode && tab === 'example' && exampleUrl;
      box.innerHTML = '<div class="actions-row" style="justify-content: space-between;">'
        + '<div class="actions-row" style="min-width:0;"><strong style="font-size:17px;">' + esc(tpl.name) + '</strong> <span class="pill">' + esc(tpl.id) + '</span>' + (tpl.sceneLabel ? '<span class="pill">' + esc(tpl.sceneLabel) + '</span>' : '') + (isChosen ? '<span class="pill pill--accent">当前已选</span>' : '') + '</div>'
        + '<div class="actions-row">'
        + (showViewportControls
          ? '<button type="button" class="btn btn--chip btn--sm' + (state.dsStageViewport === 'desktop' ? ' is-active' : '') + '" data-stage-vp="desktop">桌面 1280px</button>'
            + '<button type="button" class="btn btn--chip btn--sm' + (state.dsStageViewport === 'mobile' ? ' is-active' : '') + '" data-stage-vp="mobile">手机 390px</button>'
            + '<a class="btn btn--sm" href="' + esc(exampleUrl) + '" target="_blank" rel="noopener">新窗口全屏查看</a>'
          : '')
        + '<button type="button" class="btn btn--sm" id="showcase-close-btn">关闭 (Esc)</button>'
        + '</div></div>'
        + '<div class="actions-row" role="tablist" aria-label="整页模板预览视图">'
        + '<button type="button" class="btn btn--chip' + (tab === 'example' ? ' is-active' : '') + '" data-tpl-tab="example">整页实景预览 (example.html)</button>'
        + '<button type="button" class="btn btn--chip' + (tab === 'readme' ? ' is-active' : '') + '" data-tpl-tab="readme">模板说明</button>'
        + '</div>'
        + bodyHtml
        + '<div class="showcase-modal-footer">'
        + '<span style="font-size:12px;color:var(--studio-muted);">提示：按 Esc 或点击遮罩可关闭弹窗并继续浏览瀑布流。</span>'
        + '<div class="actions-row">'
        + '<button type="button" class="btn" id="use-item-stay-btn">仅选用，继续浏览</button>'
        + '<button type="button" class="btn btn--primary" id="use-item-go-brief-btn">选用并去填 Brief →</button>'
        + '</div></div>';

      wireShowcaseControls(box, tpl, true);
      syncShowcaseDesktopScale();
    }

    function applyPickedShowcaseItem(item, isTpl) {
      if (!isTpl) {
        state.data.brief.designSystemId = item.id;
        if (!state.data.brief.palette && item.previewPalette) {
          const p = normalizePalette(item.previewPalette);
          state.data.brief.palette = '参考 ' + item.name + '：背景 ' + p.bg + '，表面 ' + p.surface + '，主字 ' + p.fg + '，主色 ' + p.accent + '，圆角 ' + p.radius;
          const palTa = document.getElementById('brief-palette');
          if (palTa) palTa.value = state.data.brief.palette;
        }
      } else {
        state.data.brief.templateId = item.id;
        if (!state.data.brief.layout) {
          state.data.brief.layout = '参考整页模板 ' + item.name + ' (' + item.id + ') 的版式结构与节奏';
          const layTa = document.getElementById('brief-layout');
          if (layTa) layTa.value = state.data.brief.layout;
        }
      }
      renderBriefSelectionPills();
      updateFloatingBriefPill();
    }

    function wireShowcaseControls(box, item, isTpl) {
      const closeBtn = document.getElementById('showcase-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', closeShowcaseModal);

      const stayBtn = document.getElementById('use-item-stay-btn');
      if (stayBtn) {
        stayBtn.addEventListener('click', function () {
          applyPickedShowcaseItem(item, isTpl);
          closeShowcaseModal();
          renderDesignSystems();
          showToast('已选用「' + item.name + '」，可继续浏览瀑布流');
        });
      }

      const goBtn = document.getElementById('use-item-go-brief-btn');
      if (goBtn) {
        goBtn.addEventListener('click', function () {
          applyPickedShowcaseItem(item, isTpl);
          closeShowcaseModal();
          renderDesignSystems();
          switchBriefSubView('compose', true);
          showToast('已选用「' + item.name + '」并切换至 8 维 Brief');
        });
      }

      if (!isTpl) {
        box.querySelectorAll('[data-ds-tab]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            state.dsPreviewTab = btn.getAttribute('data-ds-tab');
            renderDesignSystemPreview();
          });
        });
        box.querySelectorAll('[data-ds-pal-sub]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            state.dsPaletteSub = btn.getAttribute('data-ds-pal-sub');
            renderDesignSystemPreview();
          });
        });
      } else {
        box.querySelectorAll('[data-tpl-tab]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            state.tplPreviewTab = btn.getAttribute('data-tpl-tab');
            renderDesignSystemPreview();
          });
        });
      }

      box.querySelectorAll('[data-stage-vp]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.dsStageViewport = btn.getAttribute('data-stage-vp');
          renderDesignSystemPreview();
        });
      });

      box.querySelectorAll('[data-copy-swatch]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const val = btn.getAttribute('data-copy-swatch');
          copyText(val, '色值 ' + val);
        });
      });

      const activeIframe = document.getElementById('active-showcase-iframe');
      const loadingEl = document.getElementById('showcase-loading-overlay');
      if (activeIframe && loadingEl) {
        activeIframe.addEventListener('load', function () {
          loadingEl.hidden = true;
        }, { once: true });
      }
    }

    async function selectDesignSystemForPreview(id) {
      state.dsPreviewId = id;
      const sys = (state.data.designSystems || []).find(function (d) { return d.id === id; });
      const urls = (sys && sys.previewUrls) || {};
      state.dsPreviewTab = urls.landing ? 'landing' : (urls.kit ? 'kit' : (urls.components ? 'components' : 'spec'));
      openShowcaseModal();
      if (state.data.liveMode && !state.dsCache[id]) {
        state.dsCache[id] = { loading: true };
        renderDesignSystemPreview();
        try {
          const res = await apiJson('/api/design-systems/' + encodeURIComponent(id));
          state.dsCache[id] = {
            content: res.content || '',
            previewUrls: res.previewUrls || urls
          };
        } catch (err) {
          state.dsCache[id] = { error: err.message, previewUrls: urls };
        }
        if (state.showcaseOpen) renderDesignSystemPreview();
      }
    }

    async function selectTemplateForPreview(id) {
      state.tplPreviewId = id;
      state.tplPreviewTab = 'example';
      openShowcaseModal();
      if (state.data.liveMode && !state.tplCache[id]) {
        state.tplCache[id] = { loading: true };
        renderDesignSystemPreview();
        try {
          const res = await apiJson('/api/design-templates/' + encodeURIComponent(id));
          state.tplCache[id] = { readme: res.readme || '' };
        } catch (err) {
          state.tplCache[id] = { error: err.message };
        }
        if (state.showcaseOpen) renderDesignSystemPreview();
      }
    }

    function renderBriefSelectionPills() {
      const b = state.data.brief;
      const dir = (state.data.directions || []).find(function (d) { return d.id === b.directionId; });
      const ds = (state.data.designSystems || []).find(function (d) { return d.id === b.designSystemId; });
      const tpl = (state.data.designTemplates || []).find(function (t) { return t.id === b.templateId; });
      document.getElementById('brief-selection-pills').innerHTML =
        '<span class="pill' + (dir ? ' pill--accent' : '') + '">基准方向：' + esc(dir ? dir.name : '未选择') + '</span>' +
        '<span class="pill' + (ds ? ' pill--accent' : '') + '">参考体系：' + esc(ds ? ds.name : '未选择') + '</span>' +
        '<span class="pill' + (tpl ? ' pill--accent' : '') + '">参考整页模板：' + esc(tpl ? tpl.name : '未选择') + '</span>' +
        (b.updatedAt ? '<span class="pill">上次保存：' + esc(b.updatedAt) + '</span>' : '');
    }

    function syncBriefFieldChips(key) {
      const grid = document.getElementById('brief-form-grid');
      if (!grid) return;
      const val = String(state.data.brief[key] || '');
      grid.querySelectorAll('button.preset-chip[data-preset-key="' + CSS.escape(key) + '"]').forEach(function (btn) {
        const phrase = btn.getAttribute('data-preset-val') || '';
        const active = phrase ? val.includes(phrase) : false;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    function toggleBriefPreset(key, phrase) {
      const current = String(state.data.brief[key] || '').trim();
      let next = current;
      if (current.includes(phrase)) {
        const parts = current
          .split(/[；;]/)
          .map(function (s) { return s.trim(); })
          .filter(Boolean);
        const filtered = parts.filter(function (p) { return p !== phrase; });
        if (filtered.length !== parts.length) {
          next = filtered.join('；');
        } else {
          next = current.replace(phrase, '').replace(/[；;]{2,}/g, '；').replace(/^[；;\s]+|[；;\s]+$/g, '');
        }
      } else {
        next = current ? (current.replace(/[；;\s]+$/, '') + '；' + phrase) : phrase;
      }
      state.data.brief[key] = next;
      const ta = document.getElementById('brief-' + key);
      if (ta) ta.value = next;
      syncBriefFieldChips(key);
    }

    function renderBriefForm() {
      renderBriefSelectionPills();
      const grid = document.getElementById('brief-form-grid');
      grid.innerHTML = BRIEF_FIELDS.map(function (f) {
        const val = String(state.data.brief[f.key] || '');
        const chipsHtml = (f.presets || []).map(function (phrase) {
          const active = val.includes(phrase);
          return '<button type="button" class="preset-chip' + (active ? ' is-active' : '') + '" aria-pressed="' + (active ? 'true' : 'false') + '" data-preset-key="' + esc(f.key) + '" data-preset-val="' + esc(phrase) + '">' + esc(phrase) + '</button>';
        }).join('');
        return '<div class="brief-field-card">'
          + '<label class="field-label" for="brief-' + f.key + '">' + esc(f.label) + '</label>'
          + '<div class="preset-chips" role="group" aria-label="' + esc(f.label) + '预置选项">' + chipsHtml + '</div>'
          + '<textarea class="textarea" id="brief-' + f.key + '" data-brief-key="' + f.key + '" placeholder="' + esc(f.placeholder) + '">' + esc(val) + '</textarea>'
          + '</div>';
      }).join('');

      grid.querySelectorAll('textarea[data-brief-key]').forEach(function (ta) {
        ta.addEventListener('input', function () {
          const key = ta.getAttribute('data-brief-key');
          state.data.brief[key] = ta.value;
          syncBriefFieldChips(key);
        });
      });

      grid.querySelectorAll('button.preset-chip').forEach(function (btn) {
        btn.addEventListener('click', function () {
          toggleBriefPreset(btn.getAttribute('data-preset-key'), btn.getAttribute('data-preset-val'));
        });
      });
    }

    async function handleSaveBrief() {
      if (!requireLive('保存 Brief')) return;
      const btn = document.getElementById('save-brief-btn');
      btn.disabled = true;
      try {
        const res = await apiJson('/api/brief/save', {
          method: 'POST',
          body: JSON.stringify(state.data.brief)
        });
        if (res && res.brief) {
          state.data.brief = Object.assign({}, state.data.brief, res.brief);
        } else {
          state.data.brief.updatedAt = new Date().toISOString();
        }
        renderBriefSelectionPills();
        showToast('Brief 已保存到 docs/design/design-brief.json');
      } catch (err) {
        showToast('保存 Brief 失败：' + err.message);
      } finally {
        btn.disabled = false;
      }
    }

    function handleCopyBriefPrompt() {
      const b = state.data.brief;
      const dir = (state.data.directions || []).find(function (d) { return d.id === b.directionId; });
      const ds = (state.data.designSystems || []).find(function (d) { return d.id === b.designSystemId; });
      const tpl = (state.data.designTemplates || []).find(function (t) { return t.id === b.templateId; });
      const lines = [
        '请基于以下 OpenDesign Design Brief 推进「' + state.data.projectName + '」（路径：' + state.data.root + '）的设计与前端实现（严格遵循 DESIGN.md 与项目现有测试门禁）：',
        '',
        '- 基准方向：' + (dir ? dir.name + ' (' + dir.id + ')' : '沿用现有 DESIGN.md'),
        '- 参考设计体系：' + (ds ? ds.name + ' (' + ds.id + ')' : '无额外覆盖'),
        '- 参考整页模板：' + (tpl ? tpl.name + ' (' + tpl.id + ')' : '无额外覆盖'),
        '- 色板：' + (b.palette || '沿用 tokens.scss'),
        '- 字体与 CJK 排版：' + (b.typography || '沿用 DESIGN.md 字体栈'),
        '- 布局与栅格：' + (b.layout || '兼容 390×844 与 1280×800'),
        '- 整体氛围：' + (b.vibe || '克制温润'),
        '- 信息密度：' + (b.density || '内容优先'),
        '- 禁区约束：' + (b.constraints || '零 AI 靛蓝、零装饰渐变、零 Emoji'),
        '- 目标页面：' + (b.targetPages || '按需确认'),
        '- 补充备注：' + (b.notes || '无')
      ];
      const rules = state.data.rules || [];
      if (rules.length) {
        lines.push('', '项目级 Do / Don\'t 规则记忆：');
        rules.forEach(function (r) {
          lines.push('- [' + (r.kind === 'dont' ? 'Don\'t' : 'Do') + (r.scope ? ' / ' + r.scope : '') + '] ' + r.text);
        });
      }
      copyText(lines.join('\n'), '启动 Prompt');
    }

    // ---------- Tab 3: Token Studio & DESIGN.md Editor ----------
    function getEffectiveTokenValue(tok) {
      return Object.prototype.hasOwnProperty.call(state.tokenDrafts, tok.name)
        ? state.tokenDrafts[tok.name]
        : tok.value;
    }

    function applyTokenOverridesToSandboxAndIframe() {
      const sandbox = document.getElementById('token-sandbox');
      const allTokens = state.data.tokens || [];
      if (sandbox) {
        allTokens.forEach(function (tok) {
          sandbox.style.setProperty(tok.name, getEffectiveTokenValue(tok));
        });
      }

      const dirtyEntries = Object.entries(state.tokenDrafts);
      const dirtyPill = document.getElementById('token-dirty-pill');
      if (dirtyPill) {
        dirtyPill.hidden = dirtyEntries.length === 0;
        dirtyPill.textContent = '已修改 ' + dirtyEntries.length + ' 项';
      }

      const h5Badge = document.getElementById('h5-override-badge');
      if (h5Badge) {
        h5Badge.textContent = dirtyEntries.length > 0
          ? ('已注入 ' + dirtyEntries.length + ' 项实时 Token 覆盖')
          : '使用当前 tokens.scss';
      }

      syncOverridesToH5Iframe();
      updateTabBadges();
    }

    function syncOverridesToH5Iframe() {
      const iframe = document.getElementById('h5-preview-iframe');
      if (!iframe || !iframe.contentWindow) return;
      try {
        const docEl = iframe.contentWindow.document && iframe.contentWindow.document.documentElement;
        if (!docEl) return;
        (state.data.tokens || []).forEach(function (tok) {
          if (Object.prototype.hasOwnProperty.call(state.tokenDrafts, tok.name)) {
            docEl.style.setProperty(tok.name, state.tokenDrafts[tok.name]);
          } else {
            docEl.style.removeProperty(tok.name);
          }
        });
      } catch (err) {
        // Ignore cross-origin or unloading frame errors
      }
    }

    function renderTokenStudio() {
      document.getElementById('token-file-desc').textContent =
        '源文件：' + (state.data.tokenFile || 'tokens.scss') + ' · 点击变量名复制 var(--...)；调色会即时同步到样例卡片与内嵌实时项目预览。';

      const tokens = state.data.tokens || [];
      const q = state.tokenSearch.trim().toLowerCase();
      const filtered = tokens.filter(function (t) {
        if (state.tokenFilter === 'scrim' && !t.isNewScrim && !t.isScrim) return false;
        if (state.tokenFilter === 'color' && !t.isColor) return false;
        if (state.tokenFilter === 'dirty' && !Object.prototype.hasOwnProperty.call(state.tokenDrafts, t.name)) return false;
        if (!q) return true;
        return t.name.toLowerCase().includes(q) || String(getEffectiveTokenValue(t)).toLowerCase().includes(q);
      });

      const listEl = document.getElementById('token-list');
      if (!filtered.length) {
        listEl.innerHTML = '<div class="empty-box">当前筛选条件下没有匹配的 Token。</div>';
      } else {
        listEl.innerHTML = filtered.map(function (t) {
          const val = getEffectiveTokenValue(t);
          const isDirty = Object.prototype.hasOwnProperty.call(state.tokenDrafts, t.name);
          const parsed = parseColorValue(val);
          const showAlpha = Boolean(parsed && (parsed.kind === 'rgba' || t.isScrim || t.isNewScrim));
          const swatchHtml = (t.isColor || t.isScrim || parsed)
            ? '<div class="swatch-box"><div class="swatch-fill" style="background:' + esc(val) + ';"></div></div>'
            : '<span class="pill">' + esc(t.category || 'token') + '</span>';

          return '<div class="token-row' + (isDirty ? ' is-dirty' : '') + '" data-token-name="' + esc(t.name) + '">'
            + '<div style="min-width:0;">'
            + '<button type="button" class="token-name-btn" data-copy-token="' + esc(t.name) + '" title="点击复制 var(' + esc(t.name) + ')">' + esc(t.name) + '</button>'
            + '<div class="actions-row" style="margin-top:3px;">'
            + (t.isNewScrim ? '<span class="pill pill--accent">新增 Scrim</span>' : '')
            + (t.category ? '<span class="pill">' + esc(TOKEN_CAT_LABELS[t.category] || t.category) + '</span>' : '')
            + '</div></div>'
            + swatchHtml
            + '<div class="token-controls">'
            + (parsed ? '<input type="color" class="color-input" data-color-for="' + esc(t.name) + '" value="' + esc(parsed.hex) + '" aria-label="选择 ' + esc(t.name) + ' 颜色" />' : '')
            + (showAlpha ? '<label class="alpha-wrap">α <input type="range" class="alpha-slider" data-alpha-for="' + esc(t.name) + '" min="0" max="1" step="0.01" value="' + esc(parsed.alpha) + '" aria-label="' + esc(t.name) + ' 透明度" /><span>' + Math.round(parsed.alpha * 100) + '%</span></label>' : '')
            + '<input type="text" class="input token-text-input" data-text-for="' + esc(t.name) + '" value="' + esc(val) + '" aria-label="' + esc(t.name) + ' 数值" />'
            + '</div>'
            + '<div>' + (isDirty ? '<button type="button" class="btn btn--sm" data-reset-token="' + esc(t.name) + '">还原</button>' : '') + '</div>'
            + '</div>';
        }).join('');
      }

      applyTokenOverridesToSandboxAndIframe();
    }

    function updateSingleTokenDraft(name, newValue, rerenderRowOnly) {
      const orig = (state.data.tokens || []).find(function (t) { return t.name === name; });
      if (orig && orig.value === newValue) {
        delete state.tokenDrafts[name];
      } else {
        state.tokenDrafts[name] = newValue;
      }
      if (rerenderRowOnly) {
        const row = document.querySelector('.token-row[data-token-name="' + CSS.escape(name) + '"]');
        if (row) {
          row.classList.toggle('is-dirty', Object.prototype.hasOwnProperty.call(state.tokenDrafts, name));
          const fill = row.querySelector('.swatch-fill');
          if (fill) fill.style.background = newValue;
          const textInput = row.querySelector('input[data-text-for]');
          if (textInput && document.activeElement !== textInput) textInput.value = newValue;
          const parsed = parseColorValue(newValue);
          const colorInput = row.querySelector('input[data-color-for]');
          if (parsed && colorInput && document.activeElement !== colorInput) colorInput.value = parsed.hex;
          const alphaInput = row.querySelector('input[data-alpha-for]');
          if (parsed && alphaInput) {
            if (document.activeElement !== alphaInput) alphaInput.value = String(parsed.alpha);
            const span = alphaInput.parentElement && alphaInput.parentElement.querySelector('span');
            if (span) span.textContent = Math.round(parsed.alpha * 100) + '%';
          }
        }
        applyTokenOverridesToSandboxAndIframe();
      } else {
        renderTokenStudio();
      }
    }

    // Line-level diff for DESIGN.md
    function computeLineDiff(oldText, newText) {
      const a = oldText.split('\n');
      const b = newText.split('\n');
      const out = [];
      let i = 0;
      let j = 0;
      let adds = 0;
      let dels = 0;

      // Fast prefix/suffix trim + bounded window matching for responsive editing
      while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
          out.push({ type: 'ctx', ln: j + 1, text: b[j] });
          i++; j++;
        } else {
          // Look ahead up to 8 lines to resync
          let foundA = -1;
          let foundB = -1;
          for (let k = 1; k <= 8; k++) {
            if (foundB === -1 && j + k < b.length && a[i] === b[j + k]) foundB = j + k;
            if (foundA === -1 && i + k < a.length && a[i + k] === b[j]) foundA = i + k;
          }
          if (foundB !== -1 && (foundA === -1 || (foundB - j) <= (foundA - i))) {
            while (j < foundB) {
              out.push({ type: 'add', ln: j + 1, text: b[j] });
              adds++; j++;
            }
          } else if (foundA !== -1) {
            while (i < foundA) {
              out.push({ type: 'del', ln: i + 1, text: a[i] });
              dels++; i++;
            }
          } else {
            out.push({ type: 'del', ln: i + 1, text: a[i] });
            out.push({ type: 'add', ln: j + 1, text: b[j] });
            dels++; adds++; i++; j++;
          }
        }
      }
      while (i < a.length) {
        out.push({ type: 'del', ln: i + 1, text: a[i] });
        dels++; i++;
      }
      while (j < b.length) {
        out.push({ type: 'add', ln: j + 1, text: b[j] });
        adds++; j++;
      }
      return { lines: out, adds: adds, dels: dels };
    }

    function renderDesignMdEditor() {
      document.getElementById('design-md-desc').textContent =
        '文件：' + ((state.data.designMd && state.data.designMd.path) || 'DESIGN.md') + ' · 编辑后实时预览行级 Diff，支持一键恢复原内容或写回磁盘。';
      const ta = document.getElementById('design-md-textarea');
      if (ta.value !== state.designMdDraft) {
        ta.value = state.designMdDraft;
      }
      renderDesignMdDiff();
    }

    function renderDesignMdDiff() {
      const diff = computeLineDiff(state.designMdBaseline, state.designMdDraft);
      const pill = document.getElementById('design-md-diff-pill');
      const changed = diff.adds > 0 || diff.dels > 0;
      pill.textContent = changed ? ('+' + diff.adds + ' / -' + diff.dels + ' 行待保存') : '无未保存改动';
      pill.className = 'pill tabular' + (changed ? ' pill--accent' : ' pill--pass');

      const viewer = document.getElementById('design-md-diff');
      if (!changed) {
        viewer.innerHTML = '<div class="empty-box" style="margin:12px;">当前内容与已保存基线完全一致。</div>';
        return;
      }
      // Show changed lines with 2 lines of context around each hunk
      const keep = new Array(diff.lines.length).fill(false);
      diff.lines.forEach(function (l, idx) {
        if (l.type !== 'ctx') {
          for (let c = Math.max(0, idx - 2); c <= Math.min(diff.lines.length - 1, idx + 2); c++) {
            keep[c] = true;
          }
        }
      });
      let html = '';
      let skipped = false;
      diff.lines.forEach(function (l, idx) {
        if (!keep[idx]) {
          if (!skipped) {
            html += '<div class="diff-line diff-line--ctx"><span class="diff-ln">...</span><span> </span><span>（省略未改动行）</span></div>';
            skipped = true;
          }
          return;
        }
        skipped = false;
        const sym = l.type === 'add' ? '+' : (l.type === 'del' ? '-' : ' ');
        html += '<div class="diff-line diff-line--' + l.type + '"><span class="diff-ln">' + l.ln + '</span><span>' + sym + '</span><span>' + esc(l.text) + '</span></div>';
      });
      viewer.innerHTML = html;
    }

    // ---------- Tab 4: Canvas Pinboard, Before/After Slider & H5 Preview ----------
    function getFilteredScreenshots() {
      const all = state.data.screenshots || [];
      if (state.pinViewport === 'all') return all;
      return all.filter(function (s) { return s.viewport === state.pinViewport; });
    }

    function renderPinboard() {
      const list = getFilteredScreenshots();
      if (list.length && !list.some(function (s) { return s.id === state.activeScreenshotId; })) {
        state.activeScreenshotId = list[0].id;
      }
      const activeShot = list.find(function (s) { return s.id === state.activeScreenshotId; }) || null;

      const selectorEl = document.getElementById('screenshot-selector');
      if (!list.length) {
        selectorEl.innerHTML = '<span class="field-hint">当前视口筛选下没有截图。</span>';
      } else {
        selectorEl.innerHTML = list.map(function (s) {
          const count = (state.data.annotations || []).filter(function (p) { return p.screenshotId === s.id && p.status !== 'resolved'; }).length;
          const active = activeShot && activeShot.id === s.id;
          return '<button type="button" class="btn btn--chip' + (active ? ' is-active' : '') + '" data-shot-id="' + esc(s.id) + '">'
            + esc(s.label || s.filename)
            + (count > 0 ? ' (' + count + ')' : '')
            + '</button>';
        }).join('');
      }

      const stageWrap = document.getElementById('pinboard-stage-wrap');
      const openLightboxBtn = document.getElementById('open-lightbox-btn');
      if (!activeShot) {
        stageWrap.innerHTML = '<div class="empty-box">未找到可批注的截图，请通过 --screenshots 传入截图目录。</div>';
        if (openLightboxBtn) openLightboxBtn.disabled = true;
      } else {
        if (openLightboxBtn) openLightboxBtn.disabled = false;
        const pins = (state.data.annotations || []).filter(function (p) { return p.screenshotId === activeShot.id; });
        stageWrap.innerHTML = '<div class="canvas-stage" id="active-canvas-stage" title="点击截图任意位置添加打点批注">'
          + '<img class="canvas-img" id="active-canvas-img" src="' + esc(activeShot.dataUri) + '" loading="lazy" decoding="async" alt="' + esc(activeShot.label || activeShot.filename) + '" />'
          + pins.map(function (p, idx) {
            const cls = 'pin-marker pin-marker--' + (p.status === 'resolved' ? 'resolved' : (p.severity || 'p1')) + (state.selectedPinId === p.id ? ' is-selected' : '');
            return '<button type="button" class="' + cls + '" data-pin-id="' + esc(p.id) + '" style="left:' + p.xPct + '%;top:' + p.yPct + '%;" title="#' + (idx + 1) + ' ' + esc(p.comment || '点击编辑批注') + '">' + (idx + 1) + '</button>';
          }).join('')
          + '</div>';
      }

      renderPinInspectorAndList(activeShot);
      updateTabBadges();
    }

    function renderPinInspectorAndList(activeShot) {
      const editorBox = document.getElementById('pin-editor-box');
      const listEl = document.getElementById('pin-list');
      const pins = activeShot
        ? (state.data.annotations || []).filter(function (p) { return p.screenshotId === activeShot.id; })
        : [];
      const totalOpen = (state.data.annotations || []).filter(function (p) { return p.status !== 'resolved'; }).length;

      document.getElementById('pin-list-title').textContent =
        '当前截图批注（' + pins.length + ' 条 · 全局未解决 ' + totalOpen + ' 条）';

      const selectedPin = pins.find(function (p) { return p.id === state.selectedPinId; }) || null;
      if (!selectedPin) {
        editorBox.innerHTML = '<div class="empty-box">点击左侧截图任意位置落点，或点击已有编号圆点编辑批注。</div>';
      } else {
        const idx = pins.indexOf(selectedPin) + 1;
        editorBox.innerHTML = '<div class="actions-row" style="justify-content:space-between;margin-bottom:8px;">'
          + '<strong class="tabular">批注 #' + idx + ' · X ' + selectedPin.xPct + '%, Y ' + selectedPin.yPct + '%</strong>'
          + '<button type="button" class="btn btn--danger btn--sm" id="delete-pin-btn">删除打点</button>'
          + '</div>'
          + '<div class="grid-2" style="margin-bottom:8px;">'
          + '<div><label class="field-label" for="pin-sev-select">严重级别</label>'
          + '<select class="select" id="pin-sev-select">'
          + '<option value="p0"' + (selectedPin.severity === 'p0' ? ' selected' : '') + '>P0 · 阻断问题</option>'
          + '<option value="p1"' + (selectedPin.severity === 'p1' ? ' selected' : '') + '>P1 · 体验优化</option>'
          + '<option value="p2"' + (selectedPin.severity === 'p2' ? ' selected' : '') + '>P2 · 细节打磨</option>'
          + '</select></div>'
          + '<div><label class="field-label" for="pin-status-select">处理状态</label>'
          + '<select class="select" id="pin-status-select">'
          + '<option value="open"' + (selectedPin.status !== 'resolved' ? ' selected' : '') + '>待处理 (Open)</option>'
          + '<option value="resolved"' + (selectedPin.status === 'resolved' ? ' selected' : '') + '>已解决 (Resolved)</option>'
          + '</select></div>'
          + '</div>'
          + '<div><label class="field-label" for="pin-comment-input">问题描述与修改建议</label>'
          + '<textarea class="textarea" id="pin-comment-input" placeholder="例如：此处按钮文字折行，建议改为单行并加大左右内边距...">' + esc(selectedPin.comment || '') + '</textarea></div>';

        document.getElementById('pin-sev-select').addEventListener('change', function (e) {
          selectedPin.severity = e.target.value;
          renderPinboard();
        });
        document.getElementById('pin-status-select').addEventListener('change', function (e) {
          selectedPin.status = e.target.value;
          renderPinboard();
        });
        document.getElementById('pin-comment-input').addEventListener('input', function (e) {
          selectedPin.comment = e.target.value;
          const item = listEl.querySelector('[data-select-pin="' + CSS.escape(selectedPin.id) + '"] .pin-item-text');
          if (item) item.textContent = selectedPin.comment || '（尚未填写说明）';
        });
        document.getElementById('delete-pin-btn').addEventListener('click', function () {
          state.data.annotations = (state.data.annotations || []).filter(function (p) { return p.id !== selectedPin.id; });
          state.selectedPinId = '';
          renderPinboard();
          showToast('已删除打点（点击「保存批注」写回磁盘）');
        });
      }

      if (!pins.length) {
        listEl.innerHTML = '<div class="empty-box">当前截图暂无打点批注。</div>';
      } else {
        listEl.innerHTML = pins.map(function (p, idx) {
          const sevCls = 'pill--' + (p.severity || 'p1');
          return '<div class="pin-item' + (state.selectedPinId === p.id ? ' is-selected' : '') + '" data-select-pin="' + esc(p.id) + '">'
            + '<div class="actions-row" style="justify-content:space-between;">'
            + '<span class="tabular" style="font-weight:600;font-size:12px;">#' + (idx + 1) + ' (' + p.xPct + '%, ' + p.yPct + '%)</span>'
            + '<div class="actions-row"><span class="pill ' + sevCls + '">' + esc((p.severity || 'p1').toUpperCase()) + '</span>'
            + '<span class="pill' + (p.status === 'resolved' ? ' pill--pass' : '') + '">' + (p.status === 'resolved' ? '已解决' : '待处理') + '</span></div>'
            + '</div>'
            + '<div class="pin-item-text" style="font-size:13px;color:var(--studio-ink-2);">' + esc(p.comment || '（尚未填写说明）') + '</div>'
            + '</div>';
        }).join('');
      }
    }

    function getComparisonPairs() {
      const map = {};
      (state.data.screenshots || []).forEach(function (s) {
        if (!s.pairKey) return;
        if (!map[s.pairKey]) map[s.pairKey] = { pairKey: s.pairKey, baseline: null, post: null };
        if (s.stage === 'baseline' && !map[s.pairKey].baseline) map[s.pairKey].baseline = s;
        if (s.stage === 'post' && !map[s.pairKey].post) map[s.pairKey].post = s;
      });
      return Object.values(map).filter(function (g) { return g.baseline && g.post; });
    }

    function renderBeforeAfter() {
      const pairs = getComparisonPairs();
      const selector = document.getElementById('ba-pair-selector');
      const container = document.getElementById('ba-container');

      if (!pairs.length) {
        selector.innerHTML = '';
        container.innerHTML = '<div class="empty-box">未检测到成对的 baseline 与 post 截图（需具有相同 pairKey）。</div>';
        return;
      }

      if (!pairs.some(function (p) { return p.pairKey === state.activePairKey; })) {
        state.activePairKey = pairs[0].pairKey;
      }
      const active = pairs.find(function (p) { return p.pairKey === state.activePairKey; });

      selector.innerHTML = pairs.map(function (p) {
        return '<button type="button" class="btn btn--chip' + (p.pairKey === active.pairKey ? ' is-active' : '') + '" data-pair-key="' + esc(p.pairKey) + '">' + esc(p.pairKey) + '</button>';
      }).join('');

      container.innerHTML = '<div class="ba-stage-wrap">'
        + '<div class="ba-stage" id="ba-stage" style="--split:' + state.baSplit + '%;">'
        + '<img class="ba-img-post" src="' + esc(active.post.dataUri) + '" loading="lazy" decoding="async" alt="优化后 ' + esc(active.post.label || active.post.filename) + '" />'
        + '<img class="ba-img-base" src="' + esc(active.baseline.dataUri) + '" loading="lazy" decoding="async" alt="基准 ' + esc(active.baseline.label || active.baseline.filename) + '" />'
        + '<span class="ba-badge ba-badge--left">优化前 · Baseline</span>'
        + '<span class="ba-badge ba-badge--right">优化后 · Post</span>'
        + '<div class="ba-divider"><div class="ba-knob">&#8596;</div></div>'
        + '</div></div>'
        + '<div class="ba-controls">'
        + '<label for="ba-range-input" class="field-label" style="margin:0;">卷帘位置</label>'
        + '<input type="range" class="ba-range" id="ba-range-input" min="0" max="100" value="' + state.baSplit + '" aria-label="Before/After 卷帘比例" />'
        + '<span class="pill tabular" id="ba-pct-label">' + state.baSplit + '%</span>'
        + '<button type="button" class="btn btn--sm" data-ba-preset="0">全看优化后</button>'
        + '<button type="button" class="btn btn--sm" data-ba-preset="50">50% 对半</button>'
        + '<button type="button" class="btn btn--sm" data-ba-preset="100">全看基准</button>'
        + '</div>';

      const stage = document.getElementById('ba-stage');
      const range = document.getElementById('ba-range-input');
      const pctLabel = document.getElementById('ba-pct-label');

      function setSplit(val) {
        const clamped = Math.max(0, Math.min(100, Math.round(val)));
        state.baSplit = clamped;
        stage.style.setProperty('--split', clamped + '%');
        range.value = String(clamped);
        pctLabel.textContent = clamped + '%';
      }

      range.addEventListener('input', function () { setSplit(Number(range.value)); });

      let dragging = false;
      function updateFromPointer(clientX) {
        const rect = stage.getBoundingClientRect();
        if (!rect.width) return;
        setSplit(((clientX - rect.left) / rect.width) * 100);
      }
      stage.addEventListener('pointerdown', function (e) {
        dragging = true;
        if (stage.setPointerCapture) stage.setPointerCapture(e.pointerId);
        updateFromPointer(e.clientX);
      });
      stage.addEventListener('pointermove', function (e) {
        if (dragging) updateFromPointer(e.clientX);
      });
      stage.addEventListener('pointerup', function () { dragging = false; });
      stage.addEventListener('pointercancel', function () { dragging = false; });

      container.querySelectorAll('[data-ba-preset]').forEach(function (b) {
        b.addEventListener('click', function () {
          setSplit(Number(b.getAttribute('data-ba-preset')));
        });
      });
    }

    function renderH5Preview() {
      const container = document.getElementById('h5-preview-container');
      const toolbar = document.getElementById('h5-preview-toolbar');
      const hasPreview = Boolean(state.data.hasPreview || state.data.hasH5Dist);
      const previewUrl = state.data.previewUrl || '/preview/';
      if (!state.data.liveMode || !hasPreview) {
        if (toolbar) {
          toolbar.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
        }
        const reason = !state.data.liveMode
          ? '当前为静态 HTML 归档模式。请通过 --serve 启动本地 Live 工作台以启用内嵌实时项目预览与实时 Token 注入。'
          : '未检测到本地前端构建产物。启动工作台时可通过 --preview-dir <构建目录> 或 --preview-url <本地开发服务URL> 挂载实时项目预览。';
        container.innerHTML = '<div class="empty-box">' + esc(reason) + '</div>';
        return;
      }

      const dims = {
        mobile: { w: 390, h: 720 },
        tablet: { w: 768, h: 760 },
        desktop: { w: 1180, h: 740 }
      }[state.h5Viewport] || { w: 390, h: 720 };

      let iframe = document.getElementById('h5-preview-iframe');
      if (!iframe) {
        container.innerHTML = '<div class="preview-shell">'
          + '<div class="preview-frame-box" id="h5-frame-box" style="width:' + dims.w + 'px;height:' + dims.h + 'px;">'
          + '<iframe class="preview-iframe" id="h5-preview-iframe" src="' + esc(previewUrl) + '" title="实时项目预览"></iframe>'
          + '</div></div>';
        iframe = document.getElementById('h5-preview-iframe');
        iframe.addEventListener('load', function () {
          syncOverridesToH5Iframe();
        });
      } else {
        const box = document.getElementById('h5-frame-box');
        if (box) {
          box.style.width = dims.w + 'px';
          box.style.height = dims.h + 'px';
        }
      }

      document.querySelectorAll('[data-h5-vp]').forEach(function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-h5-vp') === state.h5Viewport);
      });
    }

    // ---------- Tab 5: Five-Dimensional Critique & Rules Memory ----------
    function renderCritiqueAndRules() {
      const axes = (state.data.critique && state.data.critique.axes) || [];
      const avg = axes.length
        ? (axes.reduce(function (s, a) { return s + (Number(a.score) || 0); }, 0) / axes.length)
        : 0;
      const minScore = axes.length ? Math.min.apply(null, axes.map(function (a) { return Number(a.score) || 0; })) : 0;
      const passCount = axes.filter(function (a) { return a.status === 'pass' && (Number(a.score) || 0) >= 4; }).length;
      const avgPill = document.getElementById('critique-avg-pill');
      avgPill.textContent = '均分 ' + avg.toFixed(1) + ' · ' + passCount + '/' + axes.length + ' 通过' + (minScore < 3 ? '（存在阻断）' : '');
      avgPill.className = 'pill tabular ' + (minScore < 3 ? 'pill--fail' : (passCount === axes.length ? 'pill--pass' : 'pill--warn'));

      const grid = document.getElementById('critique-axes-grid');
      grid.innerHTML = axes.map(function (a, idx) {
        const score = Number(a.score) || 4.0;
        const isPass = a.status !== 'revise';
        return '<div class="axis-card" data-axis-idx="' + idx + '">'
          + '<div class="axis-top">'
          + '<strong>' + (idx + 1) + '. ' + esc(a.name) + '</strong>'
          + '<span class="axis-score tabular">' + score.toFixed(1) + ' / 5.0</span>'
          + '</div>'
          + '<div class="actions-row" style="justify-content:space-between;">'
          + '<input type="range" min="1" max="5" step="0.5" value="' + score + '" data-axis-range="' + idx + '" style="flex:1 1 160px;accent-color:var(--studio-accent);" aria-label="' + esc(a.name) + '评分" />'
          + '<div class="actions-row">'
          + '<button type="button" class="btn btn--chip' + (isPass ? ' is-active' : '') + '" data-axis-status="' + idx + ':pass">通过</button>'
          + '<button type="button" class="btn btn--chip' + (!isPass ? ' is-active' : '') + '" data-axis-status="' + idx + ':revise">需返工</button>'
          + '</div></div>'
          + '<textarea class="textarea" data-axis-note="' + idx + '" placeholder="记录页面/选择器证据或具体返工建议..." style="min-height:64px;">' + esc(a.note || '') + '</textarea>'
          + '</div>';
      }).join('');

      const rules = state.data.rules || [];
      const doRules = rules.filter(function (r) { return r.kind !== 'dont'; });
      const dontRules = rules.filter(function (r) { return r.kind === 'dont'; });

      function renderRuleCol(title, list, pillCls, label) {
        return '<div class="card" style="padding:14px;">'
          + '<h3 style="font-size:15px;margin-bottom:10px;">' + esc(title) + ' <span class="pill ' + pillCls + ' tabular">' + list.length + '</span></h3>'
          + (list.length ? '<div style="display:grid;gap:8px;">' + list.map(function (r) {
            return '<div class="rule-item">'
              + '<div style="min-width:0;">'
              + '<div class="actions-row" style="margin-bottom:4px;"><span class="pill ' + pillCls + '">' + label + '</span>' + (r.scope ? '<span class="pill">' + esc(r.scope) + '</span>' : '') + '</div>'
              + '<div style="font-size:13px;overflow-wrap:anywhere;">' + esc(r.text) + '</div>'
              + '</div>'
              + '<button type="button" class="btn btn--danger btn--sm" data-del-rule="' + esc(r.id) + '">移除</button>'
              + '</div>';
          }).join('') + '</div>' : '<div class="empty-box">暂无' + esc(title) + '</div>')
          + '</div>';
      }

      document.getElementById('rules-columns').innerHTML =
        renderRuleCol('Do · 必须遵循', doRules, 'pill--pass', 'Do') +
        renderRuleCol('Don\'t · 严格禁止', dontRules, 'pill--fail', 'Don\'t');

      updateTabBadges();
    }

    // ---------- Tab 6: Guide ----------
    function renderGuide() {
      const guides = [
        {
          title: '1. 启动实时本地设计工作台',
          desc: '在任意前端项目根目录运行以下命令，开启本地 HTTP 服务并自动打开浏览器，解锁实时审计、写回源码与实时项目预览（可选 --preview-dir / --preview-url / --tokens）。',
          cmd: 'node ~/.local/share/agy-opendesign/scripts/od-review-ui.mjs --root . --serve --open'
        },
        {
          title: '2. /swarm 并行设计与验收',
          desc: '在 agy 中结合 agy-opendesign 与 /swarm，将页面切片改造、自动化单测与双视口视觉验证并行推进。',
          cmd: '/swarm 按 DESIGN.md 并行推进当前设计切片，完成后运行 od-sync-audit 与双视口截图验收'
        },
        {
          title: '3. 打点精修循环 ($od-design-refine)',
          desc: '在「打点批注」页点击截图落点，导出结构化修改指令粘贴给 agy，执行小步外科手术式精修（≤ 3 轮）。',
          cmd: '$od-design-refine 请按导出的打点批注清单做最小高杠杆精修，并验证 390x844 与 1280x800 无溢出'
        },
        {
          title: '4. Step 5 上游仓库同步与合规复检',
          desc: '拉取上游更新后保留 OpenDesign 薄适配层（DESIGN.md 与 Token 文件），立刻跑合规审计与项目测试。',
          cmd: 'git fetch origin && git merge origin/main && node ~/.local/share/agy-opendesign/scripts/od-sync-audit.mjs --root .'
        }
      ];

      document.getElementById('guide-cards').innerHTML = guides.map(function (g, i) {
        return '<div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px;">'
          + '<h3 style="font-size:15px;">' + esc(g.title) + '</h3>'
          + '<p class="card-desc" style="margin:0;">' + esc(g.desc) + '</p>'
          + '<div class="cmd-block"><code>' + esc(g.cmd) + '</code><button type="button" class="btn btn--sm" data-copy-guide="' + i + '">复制</button></div>'
          + '</div>';
      }).join('');

      document.querySelectorAll('[data-copy-guide]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const item = guides[Number(btn.getAttribute('data-copy-guide'))];
          if (item) copyText(item.cmd, item.title);
        });
      });
    }

    function syncSwarmToggleUi() {
      const cb = document.getElementById('use-swarm-toggle');
      const pill = document.getElementById('use-swarm-pill');
      if (cb) cb.checked = Boolean(state.useSwarm);
      if (pill) pill.classList.toggle('is-on', Boolean(state.useSwarm));
    }

    function compileOfflineHandoffPrompt(useSwarm) {
      const b = state.data.brief || {};
      const dir = (state.data.directions || []).find(function (d) { return d.id === b.directionId; });
      const ds = (state.data.designSystems || []).find(function (d) { return d.id === b.designSystemId; });
      const tpl = (state.data.designTemplates || []).find(function (t) { return t.id === b.templateId; });
      const openPins = (state.data.annotations || []).filter(function (p) { return p.status !== 'resolved'; });
      const rules = state.data.rules || [];
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const BT = String.fromCharCode(96);
      const headerLine = (useSwarm ? '/swarm ' : '') + '# OpenDesign 实施优化指令（' + state.data.projectName + '）';
      const lines = [
        headerLine,
        '',
        '请按以下步骤执行本次前端设计与优化（项目路径：' + BT + state.data.root + BT + '）：',
        '1. 若当前位于默认主分支，先创建独立改造分支：' + BT + 'git checkout -b feat/opendesign-redesign-' + today + BT + '（保留已有未提交改动）。'
      ];
      if (useSwarm) {
        lines.push('   - 执行方式（/swarm 并行）：按不重叠的文件归属拆分给并行 Worker，并指派独立 Verifier 负责构建、审计与 390×844 / 1280×800 双视口截图验收。');
      }
      lines.push(
        '2. 严格落实以下 8 维 Design Brief：',
        '   - 基准方向：' + (dir ? dir.name + ' (' + dir.id + ')' : '沿用现有 DESIGN.md'),
        '   - 参考整页模板：' + (tpl ? tpl.name + ' (' + tpl.id + ')' : '无'),
        '   - 参考设计体系：' + (ds ? ds.name + ' (' + ds.id + ')' : '无'),
        '   - 色板：' + (b.palette || '沿用现有 Token'),
        '   - 字体与 CJK：' + (b.typography || '沿用现有规范'),
        '   - 布局与栅格：' + (b.layout || '响应式 390×844 与 1280×800'),
        '   - 氛围：' + (b.vibe || '克制专业'),
        '   - 密度：' + (b.density || '均衡密度'),
        '   - 禁区约束：' + (b.constraints || '零 AI 紫蓝、零装饰渐变、保留既有单测'),
        '   - 目标页面：' + (b.targetPages || '按项目范围'),
        '   - 补充备注：' + (b.notes || '无')
      );
      if (openPins.length) {
        lines.push('', '3. 逐条修复以下待处理打点批注（共 ' + openPins.length + ' 条）：');
        openPins.forEach(function (p, i) {
          lines.push('   ' + (i + 1) + '. [' + (p.severity || 'p1').toUpperCase() + '] ' + (p.screenshotId || '') + ' (' + (p.viewport || 'unknown') + ', X:' + p.xPct + '%, Y:' + p.yPct + '%) — ' + (p.comment || '待优化'));
        });
      }
      if (rules.length) {
        lines.push('', '4. 严格遵守项目级 Do / Don\'t 规则记忆：');
        rules.forEach(function (r) {
          lines.push('   - [' + (r.kind === 'dont' ? 'Don\'t' : 'Do') + (r.scope ? ' / ' + r.scope : '') + '] ' + r.text);
        });
      }
      lines.push('', '5. 完成后运行 ' + BT + 'od-sync-audit.mjs' + BT + '、类型检查/单元测试/构建，并完成 390×844 与 1280×800 双视口实机验收。');
      return lines.join('\n');
    }

    function closeHandoffModal() {
      const modal = document.getElementById('handoff-modal');
      if (modal) modal.hidden = true;
    }

    function openHandoffModal(result) {
      const modal = document.getElementById('handoff-modal');
      const body = document.getElementById('handoff-modal-body');
      if (!modal || !body) return;
      const savedFiles = Array.isArray(result.savedFiles) ? result.savedFiles : [];
      const filePath = result.filePath || 'docs/design/od-handoff-prompt.md';
      const useSwarm = result.useSwarm !== undefined ? Boolean(result.useSwarm) : Boolean(state.useSwarm);
      const shortCmd = result.shortCommand || ((useSwarm ? '/swarm ' : '') + '按 ' + filePath + ' 开始实施优化');
      const promptText = result.prompt || '';
      const modeBadge = useSwarm
        ? '<span class="pill pill--accent">模式：/swarm 多代理并行</span>'
        : '<span class="pill">模式：单代理轻量执行</span>';

      const checklistHtml = savedFiles.length
        ? '<div class="handoff-checklist"><strong>已自动保存以下本地设计产物（共 ' + savedFiles.length + ' 项）：</strong>'
          + savedFiles.map(function (f) { return '<div>✓ <code>' + esc(f) + '</code></div>'; }).join('')
          + '</div>'
        : '<div class="mode-banner" style="margin:0;">当前为静态只读模式，已在本地编译执行指令并复制到剪贴板（未写入磁盘文件）。</div>';

      body.innerHTML = '<div class="actions-row" style="justify-content:space-between;">'
        + '<div class="actions-row"><strong style="font-size:18px;">已就绪：开始实施优化</strong>' + modeBadge + '<span class="pill pill--pass">执行指令已自动复制</span></div>'
        + '<button type="button" class="btn btn--sm" id="handoff-close-top-btn">关闭 (Esc)</button>'
        + '</div>'
        + checklistHtml
        + '<div class="handoff-steps">'
        + '<div><strong>方式 A（推荐，已自动复制）</strong>：直接切回 <code>agy</code> 对话框，按 <code>Cmd+V</code> 粘贴并回车即可开始实施。</div>'
        + '<div><strong>方式 B（超短口令）</strong>：在 <code>agy</code> 对话框中直接发送：<code>' + esc(shortCmd) + '</code></div>'
        + '</div>'
        + '<details class="log-box" open>'
        + '<summary>查看本次生成的完整执行指令（' + promptText.length + ' 字符）</summary>'
        + '<pre class="handoff-prompt-pre" id="handoff-prompt-preview">' + esc(promptText) + '</pre>'
        + '</details>'
        + '<div class="showcase-modal-footer">'
        + '<span style="font-size:12px;color:var(--studio-muted);">符合本地安全边界：所有设计决策已落盘为标准文件，由你在 agy 中触发执行。</span>'
        + '<div class="actions-row">'
        + '<button type="button" class="btn" id="handoff-copy-short-btn">复制短口令</button>'
        + '<button type="button" class="btn btn--primary" id="handoff-copy-again-btn">再次复制执行指令</button>'
        + '<button type="button" class="btn" id="handoff-close-btn">关闭</button>'
        + '</div></div>';

      modal.hidden = false;
      document.getElementById('handoff-close-top-btn').addEventListener('click', closeHandoffModal);
      document.getElementById('handoff-close-btn').addEventListener('click', closeHandoffModal);
      document.getElementById('handoff-copy-again-btn').addEventListener('click', function () {
        copyText(promptText, '完整执行指令');
      });
      document.getElementById('handoff-copy-short-btn').addEventListener('click', function () {
        copyText(shortCmd, '短口令');
      });
    }

    async function handleStartOptimize() {
      const topBtn = document.getElementById('start-optimize-btn');
      const canvasBtn = document.getElementById('canvas-start-optimize-btn');
      if (topBtn) { topBtn.disabled = true; topBtn.textContent = '正在准备指令...'; }
      if (canvasBtn) canvasBtn.disabled = true;
      try {
        let result;
        if (state.data.liveMode) {
          result = await apiJson('/api/handoff/prepare', {
            method: 'POST',
            body: JSON.stringify({
              brief: state.data.brief,
              annotations: state.data.annotations,
              critique: Object.assign({}, state.data.critique, { updatedAt: new Date().toISOString() }),
              rules: state.data.rules,
              useSwarm: Boolean(state.useSwarm)
            })
          });
        } else {
          result = {
            ok: true,
            filePath: 'docs/design/od-handoff-prompt.md',
            useSwarm: Boolean(state.useSwarm),
            shortCommand: (state.useSwarm ? '/swarm ' : '') + '按 docs/design/od-handoff-prompt.md 开始实施优化',
            prompt: compileOfflineHandoffPrompt(Boolean(state.useSwarm)),
            savedFiles: []
          };
        }
        copyText(result.prompt || '', '实施优化执行指令');
        openHandoffModal(result);
      } catch (err) {
        showToast('准备优化指令失败：' + err.message);
      } finally {
        if (topBtn) { topBtn.disabled = false; topBtn.textContent = '开始实施优化'; }
        if (canvasBtn) canvasBtn.disabled = false;
      }
    }

    // ---------- Lightbox ----------
    function openLightbox(src, caption) {
      const lb = document.getElementById('lightbox');
      const img = document.getElementById('lightbox-img');
      document.getElementById('lightbox-caption').textContent = caption || '';
      img.src = src || BLANK_GIF;
      lb.hidden = false;
    }

    function closeLightbox() {
      const lb = document.getElementById('lightbox');
      const img = document.getElementById('lightbox-img');
      lb.hidden = true;
      img.src = BLANK_GIF;
    }

    // ---------- Event Wiring ----------
    function wireEvents() {
      // Tabs
      document.getElementById('studio-tabs').addEventListener('click', function (e) {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;
        switchTab(btn.getAttribute('data-tab'));
      });

      document.getElementById('copy-live-cmd-btn').addEventListener('click', function () {
        copyText(document.getElementById('live-cmd-code').textContent, '启动命令');
      });

      // Tab 1
      document.getElementById('run-audit-btn').addEventListener('click', handleRunAudit);

      // Tab 2: Sub-views, floating pill & modal backdrop
      document.getElementById('brief-subview-tabs').addEventListener('click', function (e) {
        const btn = e.target.closest('[data-brief-view]');
        if (!btn) return;
        switchBriefSubView(btn.getAttribute('data-brief-view'), false);
      });

      document.getElementById('brief-floating-pill').addEventListener('click', function () {
        switchBriefSubView('compose', true);
      });

      document.getElementById('back-to-gallery-btn').addEventListener('click', function () {
        switchBriefSubView('browse', true);
      });

      document.getElementById('showcase-modal').addEventListener('click', function (e) {
        if (e.target === e.currentTarget) closeShowcaseModal();
      });

      document.getElementById('directions-grid').addEventListener('click', function (e) {
        const card = e.target.closest('[data-dir-id]');
        if (!card) return;
        state.data.brief.directionId = card.getAttribute('data-dir-id');
        renderDirections();
        renderBriefSelectionPills();
        updateFloatingBriefPill();
      });

      document.getElementById('library-mode-tabs').addEventListener('click', function (e) {
        const btn = e.target.closest('[data-lib-mode]');
        if (!btn) return;
        state.libMode = btn.getAttribute('data-lib-mode');
        state.dsCategory = 'all';
        state.dsVisibleCount = state.dsBatchSize;
        renderDesignSystems();
      });

      document.getElementById('ds-search-input').addEventListener('input', function (e) {
        state.dsSearch = e.target.value;
        state.dsVisibleCount = state.dsBatchSize;
        renderDesignSystems();
      });

      document.getElementById('ds-category-chips').addEventListener('click', function (e) {
        const btn = e.target.closest('[data-ds-cat]');
        if (!btn) return;
        state.dsCategory = btn.getAttribute('data-ds-cat');
        state.dsVisibleCount = state.dsBatchSize;
        renderDesignSystems();
      });

      document.getElementById('ds-list').addEventListener('click', function (e) {
        const dsCard = e.target.closest('[data-ds-id]');
        if (dsCard) {
          selectDesignSystemForPreview(dsCard.getAttribute('data-ds-id'));
          return;
        }
        const tplCard = e.target.closest('[data-tpl-id]');
        if (tplCard) {
          selectTemplateForPreview(tplCard.getAttribute('data-tpl-id'));
        }
      });

      window.addEventListener('resize', function () {
        syncShowcaseDesktopScale();
      });

      document.getElementById('brief-fill-defaults-btn').addEventListener('click', function () {
        let filled = 0;
        BRIEF_FIELDS.forEach(function (f) {
          const cur = String(state.data.brief[f.key] || '').trim();
          if (!cur && Array.isArray(f.defaults) && f.defaults.length) {
            state.data.brief[f.key] = f.defaults.join('；');
            filled++;
          }
        });
        renderBriefForm();
        showToast(filled > 0 ? ('已为 ' + filled + ' 个空白维度填入常用默认组合') : '所有维度均已有内容，未覆盖你的手动填写');
      });

      document.getElementById('brief-clear-btn').addEventListener('click', function () {
        BRIEF_FIELDS.forEach(function (f) {
          state.data.brief[f.key] = '';
        });
        renderBriefForm();
        showToast('已清空 8 维 Brief 表单内容');
      });

      document.getElementById('save-brief-btn').addEventListener('click', handleSaveBrief);
      document.getElementById('copy-brief-prompt-btn').addEventListener('click', handleCopyBriefPrompt);

      // Tab 3: Token Studio
      document.getElementById('token-filter-chips').addEventListener('click', function (e) {
        const btn = e.target.closest('[data-token-filter]');
        if (!btn) return;
        state.tokenFilter = btn.getAttribute('data-token-filter');
        document.querySelectorAll('[data-token-filter]').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        renderTokenStudio();
      });

      document.getElementById('token-search-input').addEventListener('input', function (e) {
        state.tokenSearch = e.target.value;
        renderTokenStudio();
      });

      document.getElementById('token-list').addEventListener('click', function (e) {
        const copyBtn = e.target.closest('[data-copy-token]');
        if (copyBtn) {
          const name = copyBtn.getAttribute('data-copy-token');
          copyText('var(' + name + ')', 'var(' + name + ')');
          return;
        }
        const resetBtn = e.target.closest('[data-reset-token]');
        if (resetBtn) {
          delete state.tokenDrafts[resetBtn.getAttribute('data-reset-token')];
          renderTokenStudio();
        }
      });

      document.getElementById('token-list').addEventListener('input', function (e) {
        const colorName = e.target.getAttribute('data-color-for');
        if (colorName) {
          const row = e.target.closest('.token-row');
          const alphaInput = row && row.querySelector('input[data-alpha-for]');
          const newVal = alphaInput ? hexToRgba(e.target.value, Number(alphaInput.value)) : e.target.value;
          updateSingleTokenDraft(colorName, newVal, true);
          return;
        }
        const alphaName = e.target.getAttribute('data-alpha-for');
        if (alphaName) {
          const row = e.target.closest('.token-row');
          const colorInput = row && row.querySelector('input[data-color-for]');
          const hex = colorInput ? colorInput.value : '#161d1b';
          updateSingleTokenDraft(alphaName, hexToRgba(hex, Number(e.target.value)), true);
          return;
        }
        const textName = e.target.getAttribute('data-text-for');
        if (textName) {
          updateSingleTokenDraft(textName, e.target.value, true);
        }
      });

      document.getElementById('token-reset-btn').addEventListener('click', function () {
        state.tokenDrafts = {};
        document.getElementById('token-confirm-strip').hidden = true;
        renderTokenStudio();
        showToast('已重置全部 Token 预览覆盖');
      });

      document.getElementById('token-save-trigger-btn').addEventListener('click', function () {
        const entries = Object.entries(state.tokenDrafts);
        if (!entries.length) {
          showToast('尚未修改任何 Token');
          return;
        }
        if (!requireLive('写回 tokens.scss')) return;
        const previewList = entries.slice(0, 5).map(function (p) { return p[0] + ': ' + p[1]; }).join('；');
        document.getElementById('token-confirm-text').textContent =
          '即将写回 ' + entries.length + ' 项 Token 到 ' + state.data.tokenFile + '：' + previewList + (entries.length > 5 ? ' ...' : '');
        document.getElementById('token-confirm-strip').hidden = false;
      });

      document.getElementById('token-confirm-cancel').addEventListener('click', function () {
        document.getElementById('token-confirm-strip').hidden = true;
      });

      document.getElementById('token-confirm-apply').addEventListener('click', async function () {
        const updates = Object.entries(state.tokenDrafts).map(function (p) { return { name: p[0], value: p[1] }; });
        if (!updates.length) return;
        const btn = document.getElementById('token-confirm-apply');
        btn.disabled = true;
        try {
          const res = await apiJson('/api/tokens/save', {
            method: 'POST',
            body: JSON.stringify({ updates: updates })
          });
          if (Array.isArray(res.tokens)) state.data.tokens = res.tokens;
          if (res.audit) state.data.audit = res.audit;
          state.tokenDrafts = {};
          document.getElementById('token-confirm-strip').hidden = true;
          renderTokenStudio();
          renderOverview();
          renderHeaderMeta();
          showToast('已写回 ' + updates.length + ' 项 Token 并刷新审计');
        } catch (err) {
          showToast('写回 Token 失败：' + err.message);
        } finally {
          btn.disabled = false;
        }
      });

      // Tab 3: DESIGN.md
      document.getElementById('design-md-textarea').addEventListener('input', function (e) {
        state.designMdDraft = e.target.value;
        renderDesignMdDiff();
      });

      document.getElementById('design-md-reset-btn').addEventListener('click', function () {
        state.designMdDraft = state.designMdBaseline;
        renderDesignMdEditor();
        showToast('已恢复 DESIGN.md 原内容');
      });

      document.getElementById('design-md-save-btn').addEventListener('click', async function () {
        if (!requireLive('保存 DESIGN.md')) return;
        const btn = document.getElementById('design-md-save-btn');
        btn.disabled = true;
        try {
          await apiJson('/api/design-md/save', {
            method: 'POST',
            body: JSON.stringify({ content: state.designMdDraft })
          });
          state.designMdBaseline = state.designMdDraft;
          if (state.data.designMd) state.data.designMd.content = state.designMdDraft;
          renderDesignMdDiff();
          showToast('DESIGN.md 已保存到磁盘');
        } catch (err) {
          showToast('保存 DESIGN.md 失败：' + err.message);
        } finally {
          btn.disabled = false;
        }
      });

      // Tab 4: Pinboard
      document.getElementById('pin-viewport-filters').addEventListener('click', function (e) {
        const btn = e.target.closest('[data-vp]');
        if (!btn) return;
        state.pinViewport = btn.getAttribute('data-vp');
        document.querySelectorAll('[data-vp]').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        state.selectedPinId = '';
        renderPinboard();
      });

      document.getElementById('screenshot-selector').addEventListener('click', function (e) {
        const btn = e.target.closest('[data-shot-id]');
        if (!btn) return;
        state.activeScreenshotId = btn.getAttribute('data-shot-id');
        state.selectedPinId = '';
        renderPinboard();
      });

      document.getElementById('pinboard-stage-wrap').addEventListener('click', function (e) {
        const pinBtn = e.target.closest('[data-pin-id]');
        if (pinBtn) {
          e.stopPropagation();
          state.selectedPinId = pinBtn.getAttribute('data-pin-id');
          renderPinboard();
          return;
        }
        const img = e.target.closest('#active-canvas-img');
        if (!img) return;
        const rect = img.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const xPct = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10));
        const yPct = Math.max(0, Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10));
        const activeShot = (state.data.screenshots || []).find(function (s) { return s.id === state.activeScreenshotId; });
        if (!activeShot) return;
        const newPin = {
          id: 'pin-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          screenshotId: activeShot.id,
          viewport: activeShot.viewport || 'other',
          xPct: xPct,
          yPct: yPct,
          severity: 'p1',
          comment: '',
          status: 'open',
          createdAt: new Date().toISOString()
        };
        state.data.annotations.push(newPin);
        state.selectedPinId = newPin.id;
        renderPinboard();
        const ta = document.getElementById('pin-comment-input');
        if (ta) ta.focus();
      });

      document.getElementById('pin-list').addEventListener('click', function (e) {
        const item = e.target.closest('[data-select-pin]');
        if (!item) return;
        state.selectedPinId = item.getAttribute('data-select-pin');
        renderPinboard();
      });

      document.getElementById('open-lightbox-btn').addEventListener('click', function () {
        const activeShot = (state.data.screenshots || []).find(function (s) { return s.id === state.activeScreenshotId; });
        if (activeShot) openLightbox(activeShot.dataUri, activeShot.label || activeShot.filename);
      });

      document.getElementById('save-pins-btn').addEventListener('click', async function () {
        if (!requireLive('保存批注')) return;
        const btn = document.getElementById('save-pins-btn');
        btn.disabled = true;
        try {
          await apiJson('/api/annotations/save', {
            method: 'POST',
            body: JSON.stringify({ annotations: state.data.annotations })
          });
          showToast('批注已保存到 docs/design/od-annotations.json');
        } catch (err) {
          showToast('保存批注失败：' + err.message);
        } finally {
          btn.disabled = false;
        }
      });

      document.getElementById('export-pins-prompt-btn').addEventListener('click', function () {
        const openPins = (state.data.annotations || []).filter(function (p) { return p.status !== 'resolved'; });
        if (!openPins.length) {
          showToast('当前没有待处理 (Open) 的打点批注');
          return;
        }
        const shotsById = {};
        (state.data.screenshots || []).forEach(function (s) { shotsById[s.id] = s; });
        const lines = [
          '$od-design-refine 请根据以下画布打点批注对「' + state.data.projectName + '」执行小步精修（严格遵循 DESIGN.md 与既有测试门禁）：',
          ''
        ];
        openPins.forEach(function (p, i) {
          const shot = shotsById[p.screenshotId];
          const shotName = shot ? (shot.filename || shot.label) : p.screenshotId;
          lines.push((i + 1) + '. [' + (p.severity || 'p1').toUpperCase() + '] ' + shotName + ' (' + (p.viewport || 'unknown') + ', 坐标 X:' + p.xPct + '%, Y:' + p.yPct + '%) — ' + (p.comment || '待补充细节'));
        });
        lines.push('', '完成后请运行合规审计与单元测试，并确认 390×844 与 1280×800 均无水平溢出。');
        copyText(lines.join('\n'), '$od-design-refine 修改指令（' + openPins.length + ' 条）');
      });

      // Tab 4: Before/After pair selector
      document.getElementById('ba-pair-selector').addEventListener('click', function (e) {
        const btn = e.target.closest('[data-pair-key]');
        if (!btn) return;
        state.activePairKey = btn.getAttribute('data-pair-key');
        renderBeforeAfter();
      });

      // Tab 4: H5 Preview toolbar
      document.getElementById('h5-preview-toolbar').addEventListener('click', function (e) {
        const vpBtn = e.target.closest('[data-h5-vp]');
        if (vpBtn) {
          state.h5Viewport = vpBtn.getAttribute('data-h5-vp');
          renderH5Preview();
          return;
        }
      });

      document.getElementById('h5-reload-btn').addEventListener('click', function () {
        const iframe = document.getElementById('h5-preview-iframe');
        if (iframe) {
          const base = state.data.previewUrl || '/preview/';
          const sep = base.includes('?') ? '&' : '?';
          iframe.src = base + sep + 't=' + Date.now();
          showToast('已刷新实时项目预览');
        }
      });

      // Tab 5: Critique & Rules
      document.getElementById('critique-axes-grid').addEventListener('input', function (e) {
        const rIdx = e.target.getAttribute('data-axis-range');
        if (rIdx !== null) {
          const axis = state.data.critique.axes[Number(rIdx)];
          if (axis) {
            axis.score = Number(e.target.value);
            if (axis.score < 4) axis.status = 'revise';
            renderCritiqueAndRules();
            renderOverview();
          }
          return;
        }
        const nIdx = e.target.getAttribute('data-axis-note');
        if (nIdx !== null) {
          const axis = state.data.critique.axes[Number(nIdx)];
          if (axis) axis.note = e.target.value;
        }
      });

      document.getElementById('critique-axes-grid').addEventListener('click', function (e) {
        const stBtn = e.target.closest('[data-axis-status]');
        if (!stBtn) return;
        const parts = stBtn.getAttribute('data-axis-status').split(':');
        const axis = state.data.critique.axes[Number(parts[0])];
        if (axis) {
          axis.status = parts[1];
          renderCritiqueAndRules();
        }
      });

      document.getElementById('add-rule-btn').addEventListener('click', function () {
        const textEl = document.getElementById('rule-text-input');
        const text = textEl.value.trim();
        if (!text) {
          showToast('请输入规则内容');
          textEl.focus();
          return;
        }
        const kind = document.getElementById('rule-kind-select').value;
        const scope = document.getElementById('rule-scope-input').value.trim();
        state.data.rules.push({
          id: 'rule-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          kind: kind === 'dont' ? 'dont' : 'do',
          text: text,
          scope: scope || undefined,
          createdAt: new Date().toISOString()
        });
        textEl.value = '';
        renderCritiqueAndRules();
        showToast('已添加规则（点击「保存评审与规则」写回磁盘）');
      });

      document.getElementById('rules-columns').addEventListener('click', function (e) {
        const delBtn = e.target.closest('[data-del-rule]');
        if (!delBtn) return;
        const id = delBtn.getAttribute('data-del-rule');
        state.data.rules = (state.data.rules || []).filter(function (r) { return r.id !== id; });
        renderCritiqueAndRules();
      });

      document.getElementById('save-critique-btn').addEventListener('click', async function () {
        if (!requireLive('保存评审与规则')) return;
        const btn = document.getElementById('save-critique-btn');
        btn.disabled = true;
        try {
          await apiJson('/api/critique/save', {
            method: 'POST',
            body: JSON.stringify({
              critique: Object.assign({}, state.data.critique, { updatedAt: new Date().toISOString() }),
              rules: state.data.rules
            })
          });
          showToast('评审结果与规则记忆已保存到磁盘');
        } catch (err) {
          showToast('保存失败：' + err.message);
        } finally {
          btn.disabled = false;
        }
      });

      document.getElementById('copy-rules-prompt-btn').addEventListener('click', function () {
        const lines = ['以下是「' + state.data.projectName + '」的长期设计规则约束与当前评审返工项，请在后续修改中严格遵守：', ''];
        const doList = (state.data.rules || []).filter(function (r) { return r.kind !== 'dont'; });
        const dontList = (state.data.rules || []).filter(function (r) { return r.kind === 'dont'; });
        if (doList.length) {
          lines.push('【Do · 必须遵循】');
          doList.forEach(function (r) { lines.push('- ' + (r.scope ? '[' + r.scope + '] ' : '') + r.text); });
          lines.push('');
        }
        if (dontList.length) {
          lines.push('【Don\'t · 严格禁止】');
          dontList.forEach(function (r) { lines.push('- ' + (r.scope ? '[' + r.scope + '] ' : '') + r.text); });
          lines.push('');
        }
        const reviseAxes = ((state.data.critique && state.data.critique.axes) || []).filter(function (a) { return a.status === 'revise'; });
        if (reviseAxes.length) {
          lines.push('【需返工评审维度】');
          reviseAxes.forEach(function (a) { lines.push('- ' + a.name + ' (' + Number(a.score).toFixed(1) + '/5.0)：' + (a.note || '需进一步优化')); });
        }
        copyText(lines.join('\n'), '规则约束与返工清单');
      });

      // Global Start Optimization CTA, /swarm Toggle & Handoff Modal
      syncSwarmToggleUi();
      document.getElementById('use-swarm-toggle').addEventListener('change', function (e) {
        state.useSwarm = Boolean(e.target.checked);
        try { localStorage.setItem('od_studio_use_swarm', state.useSwarm ? '1' : '0'); } catch (err) {}
        syncSwarmToggleUi();
      });
      document.getElementById('start-optimize-btn').addEventListener('click', handleStartOptimize);
      document.getElementById('canvas-start-optimize-btn').addEventListener('click', handleStartOptimize);
      document.getElementById('handoff-modal').addEventListener('click', function (e) {
        if (e.target === e.currentTarget) closeHandoffModal();
      });

      // Lightbox close
      document.getElementById('lightbox-close-btn').addEventListener('click', closeLightbox);
      document.getElementById('lightbox').addEventListener('click', function (e) {
        if (e.target === e.currentTarget) closeLightbox();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          if (!document.getElementById('handoff-modal').hidden) closeHandoffModal();
          if (state.showcaseOpen) closeShowcaseModal();
          if (!document.getElementById('lightbox').hidden) closeLightbox();
        }
      });
    }

    // ---------- Initial Render ----------
    renderHeaderMeta();
    renderOverview();
    renderDirections();
    renderDesignSystems();
    renderBriefForm();
    updateFloatingBriefPill();
    renderTokenStudio();
    renderDesignMdEditor();
    renderPinboard();
    renderBeforeAfter();
    renderH5Preview();
    renderCritiqueAndRules();
    renderGuide();
    wireEvents();

    // Restore hash tab if present
    const hashTab = (window.location.hash || '').replace('#tab-', '');
    if (['overview', 'brief', 'tokens', 'canvas', 'critique', 'guide'].includes(hashTab)) {
      switchTab(hashTab);
    }
`;
}
