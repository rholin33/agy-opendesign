#!/usr/bin/env node
/**
 * OpenDesign Interactive Local Design Studio — CLI & Live HTTP Server (Solution B)
 * Zero external npm dependencies. Pure ESM Node.js.
 *
 * Generates a self-contained HTML Studio report and optionally serves a live
 * local Design Studio at http://127.0.0.1:<port> with real-time audit refresh,
 * live token saving, DESIGN.md editing, 154 design-system browsing, visual
 * pinboard annotations, 5-axis critique persistence, and embedded H5 preview.
 *
 * Usage:
 *   node od-review-ui.mjs --root <repo> [--screenshots <dir>] [--tokens <path>]
 *     [--out <html-path>] [--serve] [--port 4310] [--open]
 */

import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { renderStudioHtml } from "./od-review-ui-template.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRIM_TOKEN_PATTERN = /scrim|overlay|backdrop|ring/i;

const SCENE_CATEGORIES = {
  "mobile-app": "移动端 / App",
  "editorial-gallery": "画廊 / 作品集 / 杂志",
  "dashboard-workspace": "仪表盘 / 工作台 / SaaS",
  "landing-brand": "官网 / 品牌落地页",
  "docs-report": "报告 / 文档 / 演示",
  "marketing-widget": "邮件 / 海报 / 挂件 / 其他"
};

const DEFAULT_DESIGN_SYSTEMS_DIR =
  process.env.OPENDESIGN_SYSTEMS_DIR ||
  "/Applications/Open Design.app/Contents/Resources/open-design/design-systems";

const DEFAULT_DESIGN_TEMPLATES_DIR =
  process.env.OPENDESIGN_TEMPLATES_DIR ||
  "/Applications/Open Design.app/Contents/Resources/open-design/design-templates";

const THUMB_CACHE_DIR =
  process.env.AGY_OPENDESIGN_THUMB_CACHE ||
  path.join(os.homedir(), ".cache", "agy-opendesign", "thumbs");

const MAX_THUMB_CACHE_FILES = 300;
const THUMB_CONCURRENCY = 2;
const THUMB_TIMEOUT_MS = 8000;

const SAFE_SHOWCASE_EXTENSIONS = new Set([
  ".html",
  ".css",
  ".js",
  ".json",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".woff2",
  ".md"
]);

const DIRECTION_REPRESENTATIVE_SYSTEMS = {
  "editorial-monocle": ["atelier-zero", "notion", "anthropic"],
  "modern-minimal": ["apple", "vercel", "linear"],
  "human-approachable": ["airbnb"],
  "tech-utility": ["github", "stripe", "vercel"],
  "brutalist-experimental": ["brutalism", "atelier-zero"]
};

const FALLBACK_DIRECTIONS = [
  {
    id: "editorial-monocle",
    name: "Editorial — Monocle / FT magazine",
    summary: "暖纸画布、宋体展示标题、克制留白与高可读性编辑排版。",
    tags: ["编辑画廊", "宋体标题", "克制留白"],
    previewPalette: {
      bg: "#f7f3eb",
      surface: "#fffdf9",
      fg: "#181816",
      muted: "#5c5952",
      accent: "#b84d39",
      border: "#dcd5c9",
      radius: "4px",
      fontStyle: "serif"
    }
  },
  {
    id: "modern-minimal",
    name: "Modern minimal — Linear / Vercel",
    summary: "精密线条、高对比层次、极简工具效率与清晰微交互。",
    tags: ["极简效率", "精密网格", "低噪界面"],
    previewPalette: {
      bg: "#0b0d11",
      surface: "#151921",
      fg: "#f3f5f8",
      muted: "#8c95a6",
      accent: "#3b82f6",
      border: "#262c38",
      radius: "8px",
      fontStyle: "sans"
    }
  },
  {
    id: "human-approachable",
    name: "Human / approachable — Airbnb / Duolingo systems",
    summary: "亲和圆角、摄影与内容优先、温暖清晰的引导节奏。",
    tags: ["亲和体验", "摄影优先", "温和引导"],
    previewPalette: {
      bg: "#ffffff",
      surface: "#f7f7f7",
      fg: "#222222",
      muted: "#717171",
      accent: "#ff385c",
      border: "#dddddd",
      radius: "14px",
      fontStyle: "sans"
    }
  },
  {
    id: "tech-utility",
    name: "Tech / utility — Datadog / GitHub",
    summary: "高信息密度、结构化数据面板、清晰状态语义与工程可读性。",
    tags: ["工程工具", "高密度", "状态明确"],
    previewPalette: {
      bg: "#f6f8fa",
      surface: "#ffffff",
      fg: "#1f2328",
      muted: "#656d76",
      accent: "#0969da",
      border: "#d0d7de",
      radius: "6px",
      fontStyle: "mono"
    }
  },
  {
    id: "brutalist-experimental",
    name: "Brutalist / experimental — Are.na / Yale",
    summary: "强结构边框、档案目录感、先锋排版与高辨识度对比。",
    tags: ["实验排版", "档案结构", "先锋视觉"],
    previewPalette: {
      bg: "#f4f4f0",
      surface: "#ffffff",
      fg: "#111111",
      muted: "#444444",
      accent: "#111111",
      border: "#111111",
      radius: "0px",
      fontStyle: "mono"
    }
  }
];

const DEFAULT_CRITIQUE_AXES = [
  {
    id: "brand",
    name: "品牌与理念一致性",
    score: 4.0,
    status: "pass",
    note: "检查画布底色、卡片层级、主强调色与字体语汇是否与项目 DESIGN.md 保持一致。"
  },
  {
    id: "hierarchy",
    name: "视觉层级与工艺",
    score: 4.0,
    status: "pass",
    note: "检查每屏主焦 CTA 是否唯一、标题与正文层级是否清晰、对齐与留白是否均衡。"
  },
  {
    id: "restraint",
    name: "执行克制与反 AI 味",
    score: 4.0,
    status: "pass",
    note: "检查是否存在未授权的高饱和渐变、硬编码色值、冗余装饰边框或样式覆盖冲突。"
  },
  {
    id: "a11y",
    name: "无障碍与响应式适配",
    score: 4.0,
    status: "pass",
    note: "检查 WCAG AA 对比度、焦点光环、触控目标尺寸及移动端与桌面端响应式表现。"
  },
  {
    id: "copy",
    name: "文案真实度与状态覆盖",
    score: 4.0,
    status: "pass",
    note: "检查空状态、错误状态、加载反馈与界面文案是否真实自然、无占位词或技术术语泄露。"
  }
];

const DEFAULT_RULES = [
  {
    id: "rule-no-ai-slop",
    kind: "dont",
    text: "禁止引入未授权的 AI 靛蓝、装饰性渐变背景或与 DESIGN.md 冲突的硬编码色值。",
    scope: "global",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "rule-use-tokens",
    kind: "do",
    text: "所有新增与修改样式优先复用项目 Design Tokens 语义变量，保持视觉层级克制一致。",
    scope: "styles",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "rule-a11y-focus",
    kind: "do",
    text: "所有可交互控件需具备清晰的 :focus-visible 焦点态、达标对比度与充足触控区域。",
    scope: "a11y",
    createdAt: "2026-01-01T00:00:00.000Z"
  }
];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

let cachedDirections = null;
let cachedDesignSystems = null;
let cachedDesignTemplates = null;

function parseArgs(argv) {
  const opts = {
    root: process.cwd(),
    screenshots: [],
    tokens: null,
    previewDir: null,
    previewUrl: null,
    out: null,
    serve: false,
    port: 4310,
    open: false,
    help: false
  };

  const requireValue = (flag, idx) => {
    const val = argv[idx + 1];
    if (!val || val.startsWith("-")) {
      throw new Error(`${flag} requires a value`);
    }
    return val;
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      opts.help = true;
    } else if (arg === "--serve") {
      opts.serve = true;
    } else if (arg === "--open") {
      opts.open = true;
    } else if (arg === "--root") {
      opts.root = requireValue("--root", i);
      i += 1;
    } else if (arg.startsWith("--root=")) {
      opts.root = arg.slice("--root=".length);
    } else if (arg === "--screenshots") {
      opts.screenshots.push(requireValue("--screenshots", i));
      i += 1;
    } else if (arg.startsWith("--screenshots=")) {
      opts.screenshots.push(arg.slice("--screenshots=".length));
    } else if (arg === "--tokens") {
      opts.tokens = requireValue("--tokens", i);
      i += 1;
    } else if (arg.startsWith("--tokens=")) {
      opts.tokens = arg.slice("--tokens=".length);
    } else if (arg === "--preview-dir") {
      opts.previewDir = requireValue("--preview-dir", i);
      i += 1;
    } else if (arg.startsWith("--preview-dir=")) {
      opts.previewDir = arg.slice("--preview-dir=".length);
    } else if (arg === "--preview-url") {
      opts.previewUrl = requireValue("--preview-url", i);
      i += 1;
    } else if (arg.startsWith("--preview-url=")) {
      opts.previewUrl = arg.slice("--preview-url=".length);
    } else if (arg === "--out") {
      opts.out = requireValue("--out", i);
      i += 1;
    } else if (arg.startsWith("--out=")) {
      opts.out = arg.slice("--out=".length);
    } else if (arg === "--port") {
      const rawPort = requireValue("--port", i);
      opts.port = Number(rawPort);
      i += 1;
    } else if (arg.startsWith("--port=")) {
      opts.port = Number(arg.slice("--port=".length));
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) {
    throw new Error(`Invalid --port value: ${opts.port}`);
  }

  opts.root = path.resolve(opts.root);
  opts.out = opts.out
    ? path.resolve(opts.out)
    : path.join(opts.root, "docs/design/opendesign-review-ui.html");

  return opts;
}

function printHelp() {
  process.stdout.write(`Usage: node od-review-ui.mjs [options]

Generates a self-contained OpenDesign Interactive Local Design Studio HTML file
and optionally serves it live on http://127.0.0.1:<port>.

Options:
  --root <dir>           Target repository root (default: current directory)
  --screenshots <dir>    Directory containing verification PNG/WebP/JPG screenshots (repeatable)
  --tokens <path>        Path to tokens stylesheet (auto-discovered if omitted)
  --preview-dir <dir>    Built static preview directory (auto-discovered if omitted)
  --preview-url <url>    External live dev-server preview URL (e.g. http://127.0.0.1:5173)
  --out <path>           Output HTML path (default: <root>/docs/design/opendesign-review-ui.html)
  --serve                Start live local HTTP server with Studio APIs & /preview/ mount
  --port <num>           Preferred HTTP port for --serve (default: 4310, auto-fallback port..port+20)
  --open                 Open the live Studio URL (or generated HTML) in the default browser
  -h, --help             Show this help message
`);
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  fs.writeFileSync(filePath, serialized, "utf8");
}

function runAudit(repoRoot) {
  const localScript = path.join(repoRoot, "scripts/od-sync-audit.mjs");
  const globalScript = path.join(__dirname, "od-sync-audit.mjs");
  const useLocal = fs.existsSync(localScript);
  const scriptPath = useLocal ? localScript : globalScript;
  const timestamp = new Date().toISOString();

  const emptyAudit = (rawOutput) => ({
    pass: false,
    p0: {
      aiIndigo: 0,
      coldApple: 0,
      unguardedColorMix: 0,
      leftBorderRoundedCards: 0,
      total: 0
    },
    p1: {
      rawHexOutsideTokens: 0,
      unexpectedImportant: 0,
      pinnedImportant: 0,
      buttonDisabledProp: 0,
      total: 0
    },
    totalFiles: 0,
    rawOutput,
    timestamp
  });

  if (!fs.existsSync(scriptPath)) {
    return emptyAudit(`Audit script not found at ${localScript} or ${globalScript}`);
  }

  const args = useLocal ? [scriptPath, "--json"] : [scriptPath, "--root", repoRoot, "--json"];
  let rawStdout = "";
  let rawStderr = "";
  let exitCode = 0;

  try {
    rawStdout = execFileSync(process.execPath, args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024
    });
  } catch (err) {
    exitCode = typeof err?.status === "number" ? err.status : 1;
    rawStdout = err?.stdout ? String(err.stdout) : "";
    rawStderr = err?.stderr ? String(err.stderr) : String(err?.message ?? err);
    if (!rawStdout.trim()) {
      return emptyAudit(rawStderr.trim() || `Audit exited with code ${exitCode}`);
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(rawStdout);
  } catch (err) {
    return emptyAudit(`Failed to parse audit JSON: ${err.message}\n${rawStdout.slice(0, 2000)}`);
  }

  const styleBlock = parsed.scss ?? parsed.styles ?? {};
  const p0Block = styleBlock.p0 ?? {};
  const p1Block = styleBlock.p1 ?? {};
  const baselineBlock = styleBlock.baseline ?? {};

  const aiIndigo = Array.isArray(p0Block.aiIndigo) ? p0Block.aiIndigo.length : 0;
  const coldApple = Array.isArray(p0Block.coldApple) ? p0Block.coldApple.length : 0;
  const unguardedColorMix = Array.isArray(p0Block.unguardedColorMix)
    ? p0Block.unguardedColorMix.length
    : 0;
  const leftBorderRoundedCards = Array.isArray(p0Block.leftBorderRoundedCards)
    ? p0Block.leftBorderRoundedCards.length
    : 0;

  const rawHexOutsideTokens = Array.isArray(p1Block.rawHexOutsideTokens)
    ? p1Block.rawHexOutsideTokens.length
    : 0;
  const unexpectedImportant = Array.isArray(p1Block.unexpectedImportant)
    ? p1Block.unexpectedImportant.length
    : Array.isArray(p1Block.importantDeclarations)
      ? p1Block.importantDeclarations.length
      : 0;
  const pinnedImportant = Array.isArray(baselineBlock.pinnedImportant)
    ? baselineBlock.pinnedImportant.length
    : 0;
  const buttonDisabledProp = Array.isArray(p1Block.buttonDisabledProp)
    ? p1Block.buttonDisabledProp.length
    : 0;

  const totalFiles = styleBlock.scannedScssFiles ?? styleBlock.scannedStyleFiles ?? 0;

  return {
    pass: Boolean(parsed.ok) && exitCode === 0,
    p0: {
      aiIndigo,
      coldApple,
      unguardedColorMix,
      leftBorderRoundedCards,
      total: aiIndigo + coldApple + unguardedColorMix + leftBorderRoundedCards
    },
    p1: {
      rawHexOutsideTokens,
      unexpectedImportant,
      pinnedImportant,
      buttonDisabledProp,
      total: rawHexOutsideTokens + unexpectedImportant + buttonDisabledProp
    },
    totalFiles,
    rawOutput: rawStdout.trim(),
    timestamp
  };
}

function listWorkspaceSubdirs(repoRoot, parentName) {
  const parentDir = path.join(repoRoot, parentName);
  if (!fs.existsSync(parentDir)) return [];
  try {
    return fs
      .readdirSync(parentDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => path.join(parentName, d.name))
      .sort();
  } catch {
    return [];
  }
}

function discoverTokensFile(repoRoot, explicitTokens) {
  if (explicitTokens) {
    const resolved = path.resolve(repoRoot, explicitTokens);
    return fs.existsSync(resolved) ? resolved : null;
  }
  const candidates = [
    "src/styles/tokens.scss",
    "src/styles/tokens.css",
    "styles/tokens.scss",
    "styles/tokens.css",
    "src/tokens.scss",
    "src/tokens.css",
    "src/styles/variables.scss",
    "src/styles/variables.css"
  ];
  for (const ws of [...listWorkspaceSubdirs(repoRoot, "apps"), ...listWorkspaceSubdirs(repoRoot, "packages")]) {
    candidates.push(
      path.join(ws, "src/styles/tokens.scss"),
      path.join(ws, "src/styles/tokens.css"),
      path.join(ws, "src/tokens.scss"),
      path.join(ws, "src/tokens.css"),
      path.join(ws, "src/styles/variables.scss"),
      path.join(ws, "src/styles/variables.css")
    );
  }
  for (const rel of candidates) {
    const abs = path.join(repoRoot, rel);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

function discoverPreviewDir(repoRoot, explicitPreviewDir) {
  if (explicitPreviewDir) {
    const resolved = path.resolve(repoRoot, explicitPreviewDir);
    return fs.existsSync(path.join(resolved, "index.html")) ? resolved : null;
  }
  const candidates = ["dist", "dist-h5", "build"];
  for (const ws of [...listWorkspaceSubdirs(repoRoot, "apps"), ...listWorkspaceSubdirs(repoRoot, "packages")]) {
    candidates.push(path.join(ws, "dist-h5"), path.join(ws, "dist"), path.join(ws, "build"));
  }
  for (const rel of candidates) {
    const abs = path.join(repoRoot, rel);
    if (fs.existsSync(path.join(abs, "index.html"))) return abs;
  }
  return null;
}

function detectProjectBuildSummary(repoRoot, audit, tokenData, previewDirAbs) {
  const pkgPaths = [path.join(repoRoot, "package.json")];
  for (const ws of [...listWorkspaceSubdirs(repoRoot, "apps"), ...listWorkspaceSubdirs(repoRoot, "packages")]) {
    const p = path.join(repoRoot, ws, "package.json");
    if (fs.existsSync(p)) pkgPaths.push(p);
  }

  const foundScripts = new Map();
  for (const pkgPath of pkgPaths) {
    const pkg = readJsonSafe(pkgPath, null);
    if (!pkg || !pkg.scripts || typeof pkg.scripts !== "object") continue;
    for (const [k, v] of Object.entries(pkg.scripts)) {
      if (!foundScripts.has(k)) foundScripts.set(k, String(v));
    }
  }

  const pickScript = (keys) => keys.find((k) => foundScripts.has(k)) || null;
  const typecheckKey = pickScript(["typecheck", "type-check", "tsc", "check:types"]);
  const testKey = pickScript(["test:unit", "test", "vitest", "jest"]);
  const buildKey = pickScript(["build", "build:h5", "build:web", "build:prod"]);
  const extraBuildKey = pickScript(["lint", "build:weapp", "build:app", "check"]);

  const previewRel = previewDirAbs
    ? path.relative(repoRoot, previewDirAbs).replace(/\\/g, "/")
    : "";

  return {
    typecheck: typecheckKey ? `已配置 (npm run ${typecheckKey})` : "未检测到脚本",
    unitTests: testKey ? `已配置 (npm run ${testKey})` : "未检测到脚本",
    h5Build: previewRel
      ? `已就绪 (${previewRel})`
      : buildKey
        ? `已配置 (npm run ${buildKey})`
        : "未检测到构建产物",
    weappBuild: extraBuildKey ? `已配置 (npm run ${extraBuildKey})` : "按项目脚本配置",
    refactoredFilesCount: Math.max(0, (audit.totalFiles || 0) - (tokenData.absPath ? 1 : 0)),
    scripts: Array.from(foundScripts.keys()).slice(0, 12)
  };
}

function isColorValue(val) {
  if (!val) return false;
  const v = val.trim().toLowerCase();
  return (
    /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(v) ||
    /^rgba?\(/.test(v) ||
    /^hsla?\(/.test(v)
  );
}

function classifyTokenCategory(sectionTitle, tokenName, resolvedValue) {
  const lowerSec = String(sectionTitle || "").toLowerCase();
  if (SCRIM_TOKEN_PATTERN.test(tokenName)) return "scrim";
  if (lowerSec.includes("surface") || lowerSec.includes("border")) return "surface";
  if (lowerSec.includes("foreground")) return "ink";
  if (lowerSec.includes("accent")) return "accent";
  if (lowerSec.includes("semantic") || lowerSec.includes("domain") || lowerSec.includes("star")) {
    return "semantic";
  }
  if (lowerSec.includes("legacy")) return "legacy";
  if (
    lowerSec.includes("typography") ||
    lowerSec.includes("spacing") ||
    lowerSec.includes("shape") ||
    lowerSec.includes("elevation") ||
    lowerSec.includes("motion")
  ) {
    return "scale";
  }
  return isColorValue(resolvedValue) ? "surface" : "scale";
}

function parseTokensFile(tokensPath, repoRoot) {
  if (!tokensPath || !fs.existsSync(tokensPath)) {
    return { absPath: null, relPath: "", tokens: [] };
  }
  const raw = fs.readFileSync(tokensPath, "utf8");
  const lines = raw.split(/\r?\n/);
  let currentSection = "General";
  const rawTokens = [];
  const valueMap = new Map();

  for (const line of lines) {
    const secMatch = line.match(/\/\*\s*=*\s*(?:\d+\.\s*)?([^=*]+?)\s*=*\s*\*\//);
    if (secMatch && !line.includes("--")) {
      currentSection = secMatch[1].trim();
      continue;
    }

    const tokenMatch = line.match(
      /^\s*(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);(?:\s*\/\*\s*(.*?)\s*\*\/)?/
    );
    if (tokenMatch) {
      const name = tokenMatch[1].trim();
      const value = tokenMatch[2].trim();
      const comment = tokenMatch[3] ? tokenMatch[3].trim() : "";
      valueMap.set(name, value);
      rawTokens.push({ name, value, comment, section: currentSection });
    }
  }

  const resolveVar = (val, depth = 0) => {
    if (depth > 6) return val;
    const m = val.match(/^var\((--[a-zA-Z0-9_-]+)\)$/);
    if (m && valueMap.has(m[1])) {
      return resolveVar(valueMap.get(m[1]), depth + 1);
    }
    return val;
  };

  const tokens = rawTokens.map((t) => {
    const resolvedValue = resolveVar(t.value);
    const isColor = isColorValue(resolvedValue);
    const isNewScrim = SCRIM_TOKEN_PATTERN.test(t.name);
    const isScrim = isNewScrim || /^rgba\(/i.test(resolvedValue);
    const category = classifyTokenCategory(t.section, t.name, resolvedValue);
    return {
      name: t.name,
      value: t.value,
      resolvedValue,
      comment: t.comment,
      section: t.section,
      category,
      isColor,
      isScrim,
      isNewScrim
    };
  });

  const relPath = path.relative(repoRoot, tokensPath).replace(/\\/g, "/");
  return { absPath: tokensPath, relPath, tokens };
}

function validateTokenUpdate(item) {
  if (!item || typeof item !== "object") {
    return { ok: false, error: "Each update must be an object with { name, value }" };
  }
  const name = typeof item.name === "string" ? item.name.trim() : "";
  const value = typeof item.value === "string" ? item.value.trim() : "";

  if (!/^--[a-z0-9-]+$/i.test(name)) {
    return { ok: false, error: `Invalid CSS token name: ${name}` };
  }
  if (!value || value.length > 240) {
    return { ok: false, error: `Invalid CSS token value length for ${name}` };
  }
  if (
    /[{};<>]/.test(value) ||
    /[\r\n]/.test(value) ||
    /\/\*|\*\//.test(value) ||
    /<\/style>/i.test(value) ||
    /expression\s*\(/i.test(value) ||
    /javascript:/i.test(value)
  ) {
    return { ok: false, error: `Unsafe CSS value rejected for ${name}` };
  }

  return { ok: true, name, value };
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyTokenUpdates(tokensPath, updates) {
  if (!tokensPath || !fs.existsSync(tokensPath)) {
    throw new Error("Token stylesheet file not found");
  }
  const validated = [];
  for (const item of updates) {
    const check = validateTokenUpdate(item);
    if (!check.ok) {
      const err = new Error(check.error);
      err.statusCode = 400;
      throw err;
    }
    validated.push(check);
  }

  const raw = fs.readFileSync(tokensPath, "utf8");
  const lines = raw.split(/\r?\n/);
  const updateMap = new Map(validated.map((u) => [u.name, u.value]));
  const appliedNames = new Set();

  const updatedLines = lines.map((line) => {
    const match = line.match(/^(\s*)(--[a-zA-Z0-9_-]+)(\s*:\s*)([^;]+)(;.*)$/);
    if (!match) return line;
    const [, indent, name, sep, , tail] = match;
    if (!updateMap.has(name)) return line;
    appliedNames.add(name);
    return `${indent}${name}${sep}${updateMap.get(name)}${tail}`;
  });

  if (appliedNames.size === 0) {
    const err = new Error("No matching token declarations found in tokenFile");
    err.statusCode = 404;
    throw err;
  }

  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  fs.writeFileSync(tokensPath, updatedLines.join(eol), "utf8");
  return { updatedCount: appliedNames.size, updatedNames: Array.from(appliedNames) };
}

function loadDirections() {
  if (cachedDirections) return cachedDirections;

  const cliPath = path.join(os.homedir(), ".local/bin/open-design-cli");
  const fallbackById = new Map(FALLBACK_DIRECTIONS.map((d) => [d.id, d]));

  if (fs.existsSync(cliPath)) {
    try {
      const stdout = execFileSync(cliPath, ["tools", "directions", "--json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 5000
      });
      const parsed = JSON.parse(stdout);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedDirections = parsed
          .filter((item) => item && typeof item.id === "string")
          .map((item) => {
            const fb = fallbackById.get(item.id);
            const rawLabel = String(item.label || item.name || item.id);
            const parts = rawLabel.split(/\s+[—–-]\s+/);
            const name = parts[0] ? parts[0].trim() : rawLabel;
            const summary =
              fb?.summary ||
              (parts.length > 1 ? `参考代表：${parts.slice(1).join(" — ").trim()}` : rawLabel);
            const tags =
              fb?.tags ||
              (parts.length > 1
                ? parts
                    .slice(1)
                    .join(" / ")
                    .split("/")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : []);
            return {
              id: item.id,
              name: rawLabel,
              shortName: name,
              summary,
              tags,
              previewPalette: fb?.previewPalette || FALLBACK_DIRECTIONS[0].previewPalette
            };
          });
        if (cachedDirections.length > 0) {
          return cachedDirections;
        }
      }
    } catch {
      // Fall back to curated directions below
    }
  }

  cachedDirections = FALLBACK_DIRECTIONS;
  return cachedDirections;
}

function attachDirectionPreviews(directions, designSystems) {
  const byId = new Map(designSystems.map((s) => [s.id, s]));
  return directions.map((dir) => {
    const candidates = DIRECTION_REPRESENTATIVE_SYSTEMS[dir.id] || [];
    let matched = null;
    for (const cid of candidates) {
      if (byId.has(cid)) {
        matched = byId.get(cid);
        break;
      }
    }
    return {
      ...dir,
      representativeSystemId: matched?.id || null,
      cardPreviewUrl: matched?.cardPreviewUrl || null,
      thumbUrl: matched?.thumbUrl || null,
      previewUrls: matched?.previewUrls || {}
    };
  });
}

function buildDesignSystemPreviewUrls(id, systemDir) {
  const encId = encodeURIComponent(id);
  const candidates = {
    landing: "system/artifacts/landing.html",
    kit: "system/kit.html",
    kitDark: "system/kit.dark.html",
    form: "system/artifacts/form.html",
    poster: "system/artifacts/poster.html",
    components: "components.html",
    colors: "preview/colors.html",
    typography: "preview/typography.html",
    spacing: "preview/spacing.html"
  };

  const urls = {};
  for (const [key, rel] of Object.entries(candidates)) {
    if (fs.existsSync(path.join(systemDir, rel))) {
      urls[key] = `/api/design-systems/${encId}/files/${rel}`;
    }
  }
  return urls;
}

function isSafePreviewColor(val) {
  if (!val || typeof val !== "string") return false;
  const v = val.trim();
  if (!v || v.includes("var(") || v.includes("color-mix(") || /[{};<>]/.test(v)) return false;
  return (
    /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) ||
    /^(?:rgba?|hsla?|oklch)\([^)]+\)$/i.test(v)
  );
}

function isSafeCssRadius(val) {
  if (!val || typeof val !== "string") return false;
  const v = val.trim();
  return /^(?:0|\d+(?:\.\d+)?(?:px|rem|em|%))$/i.test(v);
}

function extractPreviewPalette(systemDir) {
  const defaults = {
    bg: "#fbf7f0",
    surface: "#fffdf9",
    fg: "#161d1b",
    muted: "#5a6460",
    accent: "#b85a3a",
    border: "#d8d2c8",
    radius: "8px"
  };

  const tokenMap = new Map();
  const tokensCssPath = path.join(systemDir, "tokens.css");
  if (fs.existsSync(tokensCssPath)) {
    try {
      const css = fs.readFileSync(tokensCssPath, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      const re = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
      let m;
      while ((m = re.exec(css)) !== null) {
        if (!tokenMap.has(m[1])) {
          tokenMap.set(m[1], m[2].trim());
        }
      }
    } catch {
      // fall through to json/defaults
    }
  }

  if (tokenMap.size === 0) {
    const dtJson = readJsonSafe(path.join(systemDir, "design-tokens.json"), null);
    if (dtJson && Array.isArray(dtJson.tokens)) {
      for (const t of dtJson.tokens) {
        if (t && typeof t.name === "string" && typeof t.value === "string" && !tokenMap.has(t.name)) {
          tokenMap.set(t.name, t.value.trim());
        }
      }
    }
  }

  const resolveToken = (val, depth = 0) => {
    if (!val || depth > 6) return val;
    const m = val.match(/^var\(\s*(--[a-zA-Z0-9_-]+)(?:\s*,\s*([^)]+))?\s*\)$/);
    if (!m) return val;
    if (tokenMap.has(m[1])) return resolveToken(tokenMap.get(m[1]), depth + 1);
    return m[2] ? m[2].trim() : val;
  };

  const pickColor = (keys, fallback) => {
    for (const k of keys) {
      if (!tokenMap.has(k)) continue;
      const resolved = resolveToken(tokenMap.get(k));
      if (isSafePreviewColor(resolved)) return resolved;
    }
    return fallback;
  };

  const pickRadius = (keys, fallback) => {
    for (const k of keys) {
      if (!tokenMap.has(k)) continue;
      const resolved = resolveToken(tokenMap.get(k));
      if (isSafeCssRadius(resolved)) return resolved;
    }
    return fallback;
  };

  return {
    bg: pickColor(["--bg", "--canvas", "--surface"], defaults.bg),
    surface: pickColor(["--surface", "--surface-warm", "--bg"], defaults.surface),
    fg: pickColor(["--fg", "--ink", "--text"], defaults.fg),
    muted: pickColor(["--muted", "--fg-2", "--meta"], defaults.muted),
    accent: pickColor(["--accent", "--primary", "--brand"], defaults.accent),
    border: pickColor(["--border", "--border-soft", "--line"], defaults.border),
    radius: pickRadius(["--radius-md", "--radius-sm", "--radius-lg", "--radius"], defaults.radius)
  };
}

function parseDesignSystemPreview(id, systemDir) {
  const designMdPath = path.join(systemDir, "DESIGN.md");
  const previewUrls = buildDesignSystemPreviewUrls(id, systemDir);
  const cardPreviewUrl = previewUrls.landing || previewUrls.kit || previewUrls.components || null;
  const thumbUrl = cardPreviewUrl ? `/api/thumb/system/${encodeURIComponent(id)}.jpg` : null;

  let headText = "";
  try {
    const fd = fs.openSync(designMdPath, "r");
    try {
      const buf = Buffer.alloc(2048);
      const bytesRead = fs.readSync(fd, buf, 0, buf.length, 0);
      headText = buf.toString("utf8", 0, bytesRead);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return {
      id,
      name: id,
      summary: "",
      category: "General",
      previewPalette: extractPreviewPalette(systemDir),
      previewUrls,
      cardPreviewUrl,
      thumbUrl,
      hasComponentsHtml: Boolean(previewUrls.components),
      hasColorsPreview: Boolean(previewUrls.colors),
      hasTypographyPreview: Boolean(previewUrls.typography)
    };
  }

  const lines = headText.split(/\r?\n/);
  let name = id;
  let category = "General";
  let summary = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("# ") && name === id) {
      name = line
        .slice(2)
        .replace(/^Design System Inspired by\s+/i, "")
        .replace(/^Design System:\s*/i, "")
        .trim();
      continue;
    }
    if (/^>\s*Category:\s*/i.test(line)) {
      category = line.replace(/^>\s*Category:\s*/i, "").trim() || "General";
      continue;
    }
    if (line.startsWith(">") && !summary) {
      const candidate = line.replace(/^>\s*/, "").trim();
      if (candidate && !/^Category:/i.test(candidate)) {
        summary = candidate;
      }
      continue;
    }
    if (!line.startsWith("#") && !line.startsWith(">") && !summary) {
      summary = line.slice(0, 180);
      break;
    }
  }

  return {
    id,
    name: name || id,
    summary,
    category,
    previewPalette: extractPreviewPalette(systemDir),
    previewUrls,
    cardPreviewUrl,
    thumbUrl,
    hasComponentsHtml: Boolean(previewUrls.components),
    hasColorsPreview: Boolean(previewUrls.colors),
    hasTypographyPreview: Boolean(previewUrls.typography)
  };
}

function loadDesignSystems() {
  if (cachedDesignSystems) return cachedDesignSystems;

  const baseDir = DEFAULT_DESIGN_SYSTEMS_DIR;
  if (!fs.existsSync(baseDir)) {
    cachedDesignSystems = [];
    return cachedDesignSystems;
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  const systems = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
    const systemDir = path.join(baseDir, entry.name);
    const mdPath = path.join(systemDir, "DESIGN.md");
    if (!fs.existsSync(mdPath)) continue;
    systems.push(parseDesignSystemPreview(entry.name, systemDir));
  }

  systems.sort((a, b) => a.id.localeCompare(b.id));
  cachedDesignSystems = systems;
  return cachedDesignSystems;
}

function validateScopedId(baseDirPath, id, label) {
  if (typeof id !== "string" || !/^[a-z0-9][a-z0-9._-]*$/i.test(id)) {
    const err = new Error(`Invalid ${label} id`);
    err.statusCode = 400;
    throw err;
  }
  const baseDir = path.resolve(baseDirPath);
  const itemDir = path.resolve(baseDir, id);
  if (!itemDir.startsWith(baseDir + path.sep)) {
    const err = new Error("Path traversal blocked");
    err.statusCode = 400;
    throw err;
  }
  return itemDir;
}

function readConfinedShowcaseFile(itemDir, relPath, label) {
  if (
    typeof relPath !== "string" ||
    !relPath ||
    relPath.includes("\0") ||
    relPath.includes("\\") ||
    relPath.startsWith("/")
  ) {
    const err = new Error(`Invalid ${label} file path`);
    err.statusCode = 400;
    throw err;
  }

  const segments = relPath.split("/");
  if (segments.some((seg) => !seg || seg === "." || seg === "..")) {
    const err = new Error("Path traversal blocked");
    err.statusCode = 400;
    throw err;
  }

  const targetPath = path.resolve(itemDir, relPath);
  if (!targetPath.startsWith(itemDir + path.sep)) {
    const err = new Error("Path traversal blocked");
    err.statusCode = 400;
    throw err;
  }

  const ext = path.extname(targetPath).toLowerCase();
  if (!SAFE_SHOWCASE_EXTENSIONS.has(ext)) {
    const err = new Error(`File extension not allowed: ${ext || "(none)"}`);
    err.statusCode = 400;
    throw err;
  }

  if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
    const err = new Error(`${label} file not found: ${relPath}`);
    err.statusCode = 404;
    throw err;
  }

  return {
    contentType: MIME_TYPES[ext] || "application/octet-stream",
    content: fs.readFileSync(targetPath)
  };
}

function readDesignSystemDetail(id) {
  const systemDir = validateScopedId(DEFAULT_DESIGN_SYSTEMS_DIR, id, "design system");
  const zhPath = path.join(systemDir, "DESIGN-zh.md");
  const enPath = path.join(systemDir, "DESIGN.md");
  const targetPath = fs.existsSync(zhPath) ? zhPath : enPath;

  if (!fs.existsSync(targetPath)) {
    const err = new Error(`Design system not found: ${id}`);
    err.statusCode = 404;
    throw err;
  }

  const previewUrls = buildDesignSystemPreviewUrls(id, systemDir);
  const cardPreviewUrl = previewUrls.landing || previewUrls.kit || previewUrls.components || null;

  return {
    id,
    sourceFile: path.basename(targetPath),
    content: fs.readFileSync(targetPath, "utf8"),
    previewUrls,
    cardPreviewUrl
  };
}

function readDesignSystemAllowlistedFile(id, relPath) {
  const systemDir = validateScopedId(DEFAULT_DESIGN_SYSTEMS_DIR, id, "design system");
  return readConfinedShowcaseFile(systemDir, relPath, "design system");
}

function classifyTemplateScene(id, category, metaJson, summary) {
  const idLower = String(id || "").toLowerCase();
  const text = [
    idLower,
    String(category || ""),
    String(metaJson?.title || ""),
    String(metaJson?.description || ""),
    Array.isArray(metaJson?.tags) ? metaJson.tags.join(" ") : "",
    String(summary || "")
  ]
    .join(" ")
    .toLowerCase();

  let sceneCategory = "marketing-widget";

  if (
    /\b(mobile|gamified|dating|app|wallet|fitness|travel|booking|music|chat|photo|album|camera|shortform)\b/.test(
      idLower
    ) ||
    /mobile-onboarding|wireframe-mobile|social-carousel/.test(idLower)
  ) {
    sceneCategory = "mobile-app";
  } else if (
    /\b(dashboard|kanban|tracker|visualizer|tweaks|wireframe)\b/.test(idLower) ||
    /^orbit-/.test(idLower) ||
    /^web-prototype$/.test(idLower)
  ) {
    sceneCategory = "dashboard-workspace";
  } else if (
    /\b(landing|pricing|waitlist|ecommerce|shop|store)\b/.test(idLower) &&
    !/deck$/.test(idLower)
  ) {
    sceneCategory = "landing-brand";
  } else if (
    /\b(atelier|gallery|portfolio|blog|magazine|editorial|eguide|story|lookbook|museum|journal|zine|webgl|motion-frames)\b/.test(
      idLower
    ) ||
    /xhs-|taste-editorial|taste-soft|taste-brutalist|soft-editorial|editorial-tri-tone|retro-zine|biennale|vellum|studio$|sakura|daisy|grove|pin-and-paper|pink-script/.test(
      idLower
    )
  ) {
    sceneCategory = "editorial-gallery";
  } else if (
    /\b(email|newsletter|poster|flyer|widget|contact|invitation|audio|sprite)\b/.test(idLower)
  ) {
    sceneCategory = "marketing-widget";
  } else if (
    /^html-ppt-/.test(idLower) ||
    /\b(report|docs|runbook|valuation|finance|clinical|case|deck|slides|presentation|critique|whitepaper|resume|invoice|spec|notes|okrs|update|onboarding|pitch)\b/.test(
      idLower
    )
  ) {
    sceneCategory = "docs-report";
  } else if (/dashboard|analytics|admin|saas|workspace|kanban|crm|monitor|console/.test(text)) {
    sceneCategory = "dashboard-workspace";
  } else if (/mobile|ios|android|app|dating|gamified/.test(text)) {
    sceneCategory = "mobile-app";
  } else if (/atelier|gallery|portfolio|editorial|magazine|blog|art|photography/.test(text)) {
    sceneCategory = "editorial-gallery";
  } else if (/landing|brand|agency|startup|product launch|pricing|ecommerce/.test(text)) {
    sceneCategory = "landing-brand";
  } else if (/report|documentation|docs|presentation|deck|slides|finance|spec/.test(text)) {
    sceneCategory = "docs-report";
  }

  return {
    sceneCategory,
    sceneLabel: SCENE_CATEGORIES[sceneCategory]
  };
}

function extractYamlField(text, key) {
  const lines = String(text || "").split(/\r?\n/);
  const re = new RegExp(`^${key}:\\s*(.*)$`);
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(re);
    if (!m) continue;
    const rawVal = m[1].trim();
    if (!rawVal || /^[|>][+-]?$/.test(rawVal)) {
      const collected = [];
      for (let j = i + 1; j < lines.length; j += 1) {
        const nextLine = lines[j];
        if (!nextLine.trim()) {
          if (collected.length > 0) collected.push("");
          continue;
        }
        if (/^\s+/.test(nextLine)) {
          collected.push(nextLine.trim());
        } else {
          break;
        }
      }
      return collected
        .filter((s, idx) => s !== "" || idx > 0)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }
    return rawVal;
  }
  return "";
}

function parseTemplateMeta(id, tplDir) {
  const metaJson = readJsonSafe(path.join(tplDir, "open-design.json"), null);
  const examplePath = path.join(tplDir, "example.html");
  const hasExampleHtml = fs.existsSync(examplePath);
  let sizeKb = 0;
  if (hasExampleHtml) {
    try {
      sizeKb = Math.max(1, Math.round(fs.statSync(examplePath).size / 1024));
    } catch {
      sizeKb = 0;
    }
  }

  let name =
    metaJson?.title_i18n?.["zh-CN"] ||
    metaJson?.title ||
    metaJson?.name ||
    "";
  let summary =
    metaJson?.description_i18n?.["zh-CN"] ||
    metaJson?.description ||
    "";
  let category =
    metaJson?.category ||
    metaJson?.scenario ||
    metaJson?.od?.scenario ||
    (Array.isArray(metaJson?.tags) && metaJson.tags[0]) ||
    "";

  if (!name || !summary || !category) {
    const skillPath = path.join(tplDir, "SKILL.md");
    const readmePath = path.join(tplDir, "README.md");
    const docPath = fs.existsSync(skillPath) ? skillPath : fs.existsSync(readmePath) ? readmePath : null;
    if (docPath) {
      try {
        const fd = fs.openSync(docPath, "r");
        let head = "";
        try {
          const buf = Buffer.alloc(1536);
          const n = fs.readSync(fd, buf, 0, buf.length, 0);
          head = buf.toString("utf8", 0, n);
        } finally {
          fs.closeSync(fd);
        }
        const zhName = extractYamlField(head, "zh_name");
        const enName = extractYamlField(head, "en_name");
        const desc = extractYamlField(head, "description");
        const scenario = head.match(/^\s*scenario:\s*(.+)$/m)?.[1]?.trim();
        const heading = head.match(/^#\s+(.+)$/m)?.[1]?.trim();
        if (!name) name = zhName || enName || heading || id;
        if (!summary) summary = desc || "";
        if (!category) category = scenario || "Template";
      } catch {
        // ignore fallback read errors
      }
    }
  }

  const encId = encodeURIComponent(id);
  const cleanCategory = String(category || "Template").replace(/^["']|["']$/g, "");
  const cleanSummary = String(summary || "").replace(/^["']|["']$/g, "").slice(0, 220);
  const { sceneCategory, sceneLabel } = classifyTemplateScene(
    id,
    cleanCategory,
    metaJson,
    cleanSummary
  );

  return {
    id,
    name: (name || id).replace(/^["']|["']$/g, ""),
    summary: cleanSummary,
    category: cleanCategory,
    sceneCategory,
    sceneLabel,
    sizeKb,
    hasExampleHtml,
    exampleUrl: hasExampleHtml ? `/api/design-templates/${encId}/files/example.html` : null,
    thumbUrl: hasExampleHtml ? `/api/thumb/template/${encId}.jpg` : null
  };
}

function loadDesignTemplates() {
  if (cachedDesignTemplates) return cachedDesignTemplates;

  const baseDir = DEFAULT_DESIGN_TEMPLATES_DIR;
  if (!fs.existsSync(baseDir)) {
    cachedDesignTemplates = [];
    return cachedDesignTemplates;
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  const templates = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
    const tplDir = path.join(baseDir, entry.name);
    if (!fs.existsSync(path.join(tplDir, "example.html"))) continue;
    templates.push(parseTemplateMeta(entry.name, tplDir));
  }

  templates.sort((a, b) => a.id.localeCompare(b.id));
  cachedDesignTemplates = templates;
  return cachedDesignTemplates;
}

function readDesignTemplateDetail(id) {
  const tplDir = validateScopedId(DEFAULT_DESIGN_TEMPLATES_DIR, id, "design template");
  if (!fs.existsSync(tplDir) || !fs.statSync(tplDir).isDirectory()) {
    const err = new Error(`Design template not found: ${id}`);
    err.statusCode = 404;
    throw err;
  }
  const meta = parseTemplateMeta(id, tplDir);
  const readmePath = path.join(tplDir, "README.md");
  const skillPath = path.join(tplDir, "SKILL.md");
  let readme = "";
  if (fs.existsSync(readmePath)) {
    readme = fs.readFileSync(readmePath, "utf8");
  } else if (fs.existsSync(skillPath)) {
    readme = fs.readFileSync(skillPath, "utf8");
  }
  return {
    ...meta,
    readme
  };
}

function readDesignTemplateFile(id, relPath) {
  const tplDir = validateScopedId(DEFAULT_DESIGN_TEMPLATES_DIR, id, "design template");
  return readConfinedShowcaseFile(tplDir, relPath, "design template");
}

function inferScreenshotMeta(fileName) {
  const lower = fileName.toLowerCase();
  const isMobile = lower.includes("390x844") || lower.includes("mobile");
  const isDesktop = lower.includes("1280x800") || lower.includes("desktop");
  const viewport = isMobile ? "mobile" : isDesktop ? "desktop" : "other";
  const viewportTag = isMobile ? "手机" : isDesktop ? "桌面" : "视口";

  let stage = "other";
  let stageTag = "截图";
  if (lower.includes("baseline") || lower.includes("before")) {
    stage = "baseline";
    stageTag = "基线";
  } else if (lower.includes("webui") || lower.includes("review-ui")) {
    stage = "webui";
    stageTag = "看板";
  } else if (lower.includes("post") || lower.includes("after")) {
    stage = "post";
    stageTag = "重构后";
  }

  const base = lower
    .replace(/\.(png|jpe?g|webp)$/i, "")
    .replace(/^(baseline|before|post|after|review)-/, "")
    .replace(/-(mobile|desktop|\d+x\d+)/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const routeName = base || "screen";
  const pairKey = `${routeName}-${viewport}`;
  const label = `${stageTag} · ${routeName} (${viewportTag})`;

  const id = fileName
    .replace(/\.(png|jpe?g|webp)$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-");

  const sortOrder =
    (stage === "post" ? 100 : stage === "baseline" ? 200 : stage === "webui" ? 300 : 400) +
    (viewport === "mobile" ? 1 : viewport === "desktop" ? 2 : 3);

  return {
    id,
    filename: fileName,
    label,
    viewport,
    stage,
    pairKey,
    sortOrder
  };
}

function loadScreenshots(dirs, { inlineBase64 = true } = {}) {
  const mimeMap = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp"
  };

  const results = [];
  const seen = new Set();

  for (const dirInput of dirs) {
    if (!dirInput) continue;
    const resolved = path.resolve(dirInput);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      continue;
    }
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!mimeMap[ext]) continue;
      const absPath = path.join(resolved, entry.name);
      if (seen.has(absPath)) continue;
      seen.add(absPath);

      let dataUri;
      if (inlineBase64) {
        const bytes = fs.readFileSync(absPath);
        dataUri = `data:${mimeMap[ext]};base64,${bytes.toString("base64")}`;
      } else {
        dataUri = `/api/screenshots/${encodeURIComponent(entry.name)}`;
      }
      const meta = inferScreenshotMeta(entry.name);
      results.push({
        id: meta.id,
        filename: meta.filename,
        label: meta.label,
        viewport: meta.viewport,
        stage: meta.stage,
        pairKey: meta.pairKey,
        dataUri,
        _sortOrder: meta.sortOrder
      });
    }
  }

  results.sort((a, b) => a._sortOrder - b._sortOrder || a.filename.localeCompare(b.filename));
  return results.map(({ _sortOrder, ...rest }) => rest);
}

function findScreenshotFile(dirs, filename) {
  if (
    typeof filename !== "string" ||
    !filename ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..") ||
    filename.includes("\0")
  ) {
    return null;
  }
  const ext = path.extname(filename).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return null;

  for (const dirInput of dirs) {
    if (!dirInput) continue;
    const baseDir = path.resolve(dirInput);
    const candidate = path.resolve(baseDir, filename);
    if (!candidate.startsWith(baseDir + path.sep)) continue;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return { absPath: candidate, contentType: MIME_TYPES[ext] || "application/octet-stream" };
    }
  }
  return null;
}

function getDesignDocsPaths(repoRoot) {
  const dir = path.join(repoRoot, "docs/design");
  return {
    dir,
    designMd: path.join(repoRoot, "DESIGN.md"),
    brief: path.join(dir, "design-brief.json"),
    annotations: path.join(dir, "od-annotations.json"),
    critique: path.join(dir, "od-critique.json"),
    rules: path.join(dir, "od-rules.json"),
    handoffPrompt: path.join(dir, "od-handoff-prompt.md")
  };
}

function compileHandoffPrompt({
  projectName,
  root,
  brief,
  annotations,
  critique,
  rules,
  tokenFile,
  audit,
  useSwarm = true
}) {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const openPins = (Array.isArray(annotations) ? annotations : []).filter(
    (a) => a && a.status !== "resolved"
  );
  const doRules = (Array.isArray(rules) ? rules : []).filter((r) => r && r.kind === "do" && r.text);
  const dontRules = (Array.isArray(rules) ? rules : []).filter(
    (r) => r && r.kind === "dont" && r.text
  );
  const reviseAxes = (Array.isArray(critique?.axes) ? critique.axes : []).filter(
    (a) => a && (a.status === "revise" || Number(a.score) < 4)
  );

  const lines = [
    `${useSwarm ? "/swarm " : ""}# OpenDesign 实施优化执行指令 — ${projectName}`,
    "",
    `> 项目目录：\`${root}\``,
    `> 执行模式：${useSwarm ? "/swarm 多代理并行重构 + 独立验收" : "单代理轻量执行"}`,
    `> 生成时间：${now.toISOString()}`,
    `> 参考产物：\`DESIGN.md\`、\`${tokenFile || "tokens stylesheet"}\`、\`docs/design/design-brief.json\`、\`docs/design/od-annotations.json\`、\`docs/design/od-rules.json\``,
    "",
    "请基于以下已保存的设计决策与验收标准，使用 `agy-opendesign` 工作流实施前端优化：",
    ...(useSwarm
      ? [
          "",
          "## 0. Swarm 多代理并行协作策略",
          "- 按互不重叠的文件归属拆分并行 worker（例如：Token/基础样式、页面组件适配、独立验收 `verifier`），避免两个 worker 同时编辑同一文件。",
          "- 由独立 `verifier` 执行 `od-sync-audit.mjs`、类型检查/单测/构建与 `390×844` + `1280×800` 双视口实机截图验收。"
        ]
      : []),
    "",
    "## 1. 独立分支保护（默认必做）",
    `- 在修改任何代码前，先确认当前 git 分支；若仍在 \`main\` / \`master\` / 默认分支，请先创建并切换至独立重构分支：\`git checkout -b feat/opendesign-redesign-${ymd}\`（保留现有未提交改动，切勿强推远程）。`,
    "",
    "## 2. 8 维设计 Brief",
    `- **设计方向 (directionId)**：${brief?.directionId || "（未指定）"}`,
    `- **参考整页模板 (templateId)**：${brief?.templateId || "（未指定）"}`,
    `- **参考设计体系 (designSystemId)**：${brief?.designSystemId || "（未指定）"}`,
    `- **色板与材质**：${brief?.palette || "沿用项目 DESIGN.md 与 tokens"}`,
    `- **字体与排版**：${brief?.typography || "沿用项目 DESIGN.md 字体层级与 CJK 安全行高"}`,
    `- **布局与结构**：${brief?.layout || "响应式移动优先 + 桌面清晰网格"}`,
    `- **气质与氛围**：${brief?.vibe || "克制、高可读性、内容优先"}`,
    `- **信息密度**：${brief?.density || "适中留白，触控目标达标"}`,
    `- **禁区约束**：${brief?.constraints || "禁止未授权 AI 靛蓝、装饰性渐变与硬编码色值"}`,
    `- **目标页面 / 范围**：${brief?.targetPages || "按当前项目核心页面"}`,
    brief?.notes ? `- **补充说明**：${brief.notes}` : null,
    "",
    `## 3. 待修复画布打点批注（共 ${openPins.length} 项未关闭）`
  ].filter((line) => line !== null);

  if (openPins.length === 0) {
    lines.push("- 当前无未关闭的画布打点批注，直接按 Brief 与规则推进优化。");
  } else {
    openPins.forEach((pin, idx) => {
      const sev = String(pin.severity || "p1").toUpperCase();
      const x = typeof pin.xPct === "number" ? `${pin.xPct.toFixed(1)}%` : "-";
      const y = typeof pin.yPct === "number" ? `${pin.yPct.toFixed(1)}%` : "-";
      lines.push(
        `${idx + 1}. **[${sev}]** 截图 \`${pin.screenshotId || "unknown"}\` (${pin.viewport || "viewport"}, 坐标 \`${x}, ${y}\`)：${pin.comment || "（无说明）"}`
      );
    });
  }

  lines.push("", "## 4. 项目 Do / Don't 规则记忆");
  if (doRules.length === 0 && dontRules.length === 0) {
    lines.push("- 严格遵守 `DESIGN.md` 与 `tokens` 语义变量约束，保持业务逻辑与测试完整。");
  } else {
    for (const r of doRules) {
      lines.push(`- **[DO${r.scope ? ` · ${r.scope}` : ""}]** ${r.text}`);
    }
    for (const r of dontRules) {
      lines.push(`- **[DON'T${r.scope ? ` · ${r.scope}` : ""}]** ${r.text}`);
    }
  }

  if (reviseAxes.length > 0) {
    lines.push("", "## 5. 人工五维评审需返工项");
    for (const ax of reviseAxes) {
      lines.push(`- **${ax.name}**（当前评分 ${ax.score}/5.0）：${ax.note || "请重点打磨此维度"}`);
    }
  }

  lines.push(
    "",
    `## ${reviseAxes.length > 0 ? "6" : "5"}. 验证与交付门禁`,
    `- 保留所有既有业务契约与测试行为，所有样式优先通过 \`${tokenFile || "项目 Design Tokens"}\` 变量收敛。`,
    `- 运行 \`od-sync-audit.mjs\` 合规审计（当前基线：${audit?.pass ? "PASS" : "CHECK"}，P0=${audit?.p0?.total ?? 0}，P1=${audit?.p1?.total ?? 0}），确保 P0=0、P1=0。`,
    "- 运行项目的类型检查（typecheck）、单元测试（unit tests）与生产构建（build）。",
    "- 在 `390×844` 移动端与 `1280×800` 桌面端双视口下完成实机渲染验收（0 控制台报错、0 破损图片、0 水平溢出），并刷新 OpenDesign Studio 看板截图。"
  );

  return `${lines.join("\n")}\n`;
}

function loadDesignMd(repoRoot) {
  const p = path.join(repoRoot, "DESIGN.md");
  const content = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  return { path: "DESIGN.md", content };
}

function defaultBrief() {
  return {
    directionId: "editorial-monocle",
    designSystemId: "",
    templateId: "",
    palette: "",
    typography: "",
    layout: "",
    vibe: "",
    density: "",
    constraints: "",
    targetPages: "",
    notes: ""
  };
}

function normalizeBrief(input) {
  const base = defaultBrief();
  const src = input && typeof input === "object" ? input : {};
  const result = {
    directionId: String(src.directionId ?? base.directionId),
    designSystemId: String(src.designSystemId ?? base.designSystemId),
    templateId: String(src.templateId ?? base.templateId),
    palette: String(src.palette ?? base.palette),
    typography: String(src.typography ?? base.typography),
    layout: String(src.layout ?? base.layout),
    vibe: String(src.vibe ?? base.vibe),
    density: String(src.density ?? base.density),
    constraints: String(src.constraints ?? base.constraints),
    targetPages: String(src.targetPages ?? base.targetPages),
    notes: String(src.notes ?? base.notes)
  };
  if (typeof src.updatedAt === "string" && src.updatedAt) {
    result.updatedAt = src.updatedAt;
  }
  return result;
}

function loadBrief(repoRoot) {
  const paths = getDesignDocsPaths(repoRoot);
  const raw = readJsonSafe(paths.brief, null);
  return normalizeBrief(raw);
}

function loadAnnotations(repoRoot) {
  const paths = getDesignDocsPaths(repoRoot);
  const raw = readJsonSafe(paths.annotations, []);
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.annotations)) return raw.annotations;
  return [];
}

function loadCritique(repoRoot) {
  const paths = getDesignDocsPaths(repoRoot);
  const raw = readJsonSafe(paths.critique, null);
  if (raw && Array.isArray(raw.axes) && raw.axes.length > 0) {
    return raw;
  }
  return {
    axes: DEFAULT_CRITIQUE_AXES.map((a) => ({ ...a }))
  };
}

function loadRules(repoRoot) {
  const paths = getDesignDocsPaths(repoRoot);
  const raw = readJsonSafe(paths.rules, null);
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.rules)) return raw.rules;
  return DEFAULT_RULES.map((r) => ({ ...r }));
}

function buildState(opts, { liveMode = false, port = null, cachedAudit = null } = {}) {
  const repoRoot = opts.root;
  const audit = cachedAudit || runAudit(repoRoot);
  const tokensPath = discoverTokensFile(repoRoot, opts.tokens);
  const tokenData = parseTokensFile(tokensPath, repoRoot);
  const screenshots = loadScreenshots(opts.screenshots, { inlineBase64: !liveMode });
  const designMd = loadDesignMd(repoRoot);
  const brief = loadBrief(repoRoot);
  const designSystems = loadDesignSystems();
  const directions = attachDirectionPreviews(loadDirections(), designSystems);
  const designTemplates = loadDesignTemplates();
  const annotations = loadAnnotations(repoRoot);
  const critique = loadCritique(repoRoot);
  const rules = loadRules(repoRoot);

  const previewDirAbs = discoverPreviewDir(repoRoot, opts.previewDir);
  const hasPreview = Boolean(opts.previewUrl || previewDirAbs);
  const previewUrl = opts.previewUrl || (previewDirAbs ? "/preview/" : null);
  const previewDir = previewDirAbs
    ? path.relative(repoRoot, previewDirAbs).replace(/\\/g, "/")
    : "";
  const buildSummary = detectProjectBuildSummary(repoRoot, audit, tokenData, previewDirAbs);

  return {
    liveMode,
    projectName: path.basename(repoRoot),
    root: repoRoot,
    port,
    generatedAt: new Date().toISOString(),
    audit,
    buildSummary,
    tokenFile: tokenData.relPath,
    tokens: tokenData.tokens,
    designMd,
    brief,
    directions,
    designSystems,
    designTemplates,
    screenshots,
    annotations,
    critique,
    rules,
    hasPreview,
    hasH5Dist: hasPreview,
    previewUrl,
    previewDir
  };
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readJsonBody(req, maxBytes = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        const err = new Error("Request body too large");
        err.statusCode = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        const err = new Error("Invalid JSON request body");
        err.statusCode = 400;
        reject(err);
      }
    });

    req.on("error", (err) => reject(err));
  });
}

function servePreviewAsset(reqPathname, previewDir, res) {
  if (!previewDir) {
    sendJson(res, 404, { ok: false, error: "Static preview directory not found (pass --preview-dir <dir>)" });
    return;
  }
  const baseDir = path.resolve(previewDir);
  const indexHtmlPath = path.join(baseDir, "index.html");
  if (!fs.existsSync(indexHtmlPath)) {
    sendJson(res, 404, { ok: false, error: "Static preview index.html not found" });
    return;
  }

  let rel = reqPathname;
  if (rel === "/preview" || rel === "/preview/") {
    rel = "index.html";
  } else if (rel.startsWith("/preview/")) {
    rel = rel.slice("/preview/".length);
  } else {
    rel = rel.replace(/^\/+/, "");
  }

  try {
    rel = decodeURIComponent(rel);
  } catch {
    sendJson(res, 400, { ok: false, error: "Malformed URL encoding" });
    return;
  }

  if (rel.includes("\0")) {
    sendJson(res, 400, { ok: false, error: "Invalid path" });
    return;
  }

  const targetPath = path.resolve(baseDir, rel || "index.html");
  if (targetPath !== baseDir && !targetPath.startsWith(baseDir + path.sep)) {
    sendJson(res, 400, { ok: false, error: "Path traversal blocked" });
    return;
  }

  let fileToServe = targetPath;
  const hasExtension = Boolean(path.extname(rel));
  if (!fs.existsSync(fileToServe) || fs.statSync(fileToServe).isDirectory()) {
    if (hasExtension) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }
    fileToServe = indexHtmlPath;
  }

  const ext = path.extname(fileToServe).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  if (fileToServe === indexHtmlPath) {
    let html = fs.readFileSync(indexHtmlPath, "utf8");
    html = html
      .replace(/(src|href)="\/(?!preview\/)/g, '$1="/preview/')
      .replace(/(src|href)='\/(?!preview\/)/g, "$1='/preview/");
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    });
    res.end(html);
    return;
  }

  const content = fs.readFileSync(fileToServe);
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(content);
}

function openTarget(target) {
  try {
    const cmd =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "cmd"
          : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", target] : [target];
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.unref();
  } catch (err) {
    process.stderr.write(`[od-review-ui] Warning: failed to open ${target}: ${err.message}\n`);
  }
}

function listenWithFallback(server, startPort, maxAttempts = 21) {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    const tryPort = () => {
      const port = startPort + attempt;
      if (port > 65535 || attempt >= maxAttempts) {
        reject(
          new Error(
            `No available port found in range ${startPort}..${Math.min(65535, startPort + maxAttempts - 1)}`
          )
        );
        return;
      }

      const onError = (err) => {
        server.off("listening", onListening);
        if (err && err.code === "EADDRINUSE") {
          attempt += 1;
          tryPort();
        } else {
          reject(err);
        }
      };

      const onListening = () => {
        server.off("error", onError);
        resolve(port);
      };

      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, "127.0.0.1");
    };

    tryPort();
  });
}

function findChromeBinary() {
  const candidates = [
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium"
  ].filter(Boolean);
  for (const bin of candidates) {
    if (fs.existsSync(bin)) return bin;
  }
  return null;
}

function pruneThumbCache() {
  try {
    if (!fs.existsSync(THUMB_CACHE_DIR)) return;
    const files = fs
      .readdirSync(THUMB_CACHE_DIR)
      .filter((f) => f.endsWith(".jpg"))
      .map((f) => {
        const p = path.join(THUMB_CACHE_DIR, f);
        try {
          return { p, mtimeMs: fs.statSync(p).mtimeMs };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    if (files.length <= MAX_THUMB_CACHE_FILES) return;
    files.sort((a, b) => a.mtimeMs - b.mtimeMs);
    const excess = files.length - MAX_THUMB_CACHE_FILES;
    for (let i = 0; i < excess; i += 1) {
      try {
        fs.unlinkSync(files[i].p);
      } catch {
        // ignore prune race
      }
    }
  } catch {
    // ignore cache prune errors
  }
}

function renderFallbackThumbSvg(title, palette) {
  const bg = palette?.bg || "#fbf7f0";
  const surface = palette?.surface || "#fffdf9";
  const fg = palette?.fg || "#161d1b";
  const muted = palette?.muted || "#5a6460";
  const accent = palette?.accent || "#b85a3a";
  const border = palette?.border || "#d8d2c8";
  const safeTitle = String(title || "Preview")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .slice(0, 42);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <rect width="640" height="400" fill="${bg}"/>
  <rect x="28" y="28" width="584" height="48" rx="10" fill="${surface}" stroke="${border}"/>
  <circle cx="52" cy="52" r="6" fill="${accent}"/>
  <rect x="72" y="46" width="140" height="12" rx="6" fill="${fg}" opacity="0.82"/>
  <rect x="510" y="40" width="84" height="24" rx="12" fill="${accent}"/>
  <rect x="28" y="96" width="368" height="276" rx="14" fill="${surface}" stroke="${border}"/>
  <text x="52" y="150" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="24" font-weight="600" fill="${fg}">${safeTitle}</text>
  <rect x="52" y="174" width="290" height="12" rx="6" fill="${muted}" opacity="0.5"/>
  <rect x="52" y="198" width="240" height="12" rx="6" fill="${muted}" opacity="0.35"/>
  <rect x="52" y="236" width="132" height="36" rx="18" fill="${accent}"/>
  <rect x="416" y="96" width="196" height="128" rx="14" fill="${surface}" stroke="${border}"/>
  <rect x="416" y="244" width="196" height="128" rx="14" fill="${surface}" stroke="${border}"/>
</svg>`;
}

class ThumbRenderer {
  constructor() {
    this.chromeProc = null;
    this.profileDir = null;
    this.ws = null;
    this.wsReadyPromise = null;
    this.nextMsgId = 1;
    this.pendingCalls = new Map();
    this.eventListeners = new Set();
    this.activeCount = 0;
    this.queue = [];
    this.inFlight = new Map();
    this.closed = false;
  }

  async ensureConnected() {
    if (this.closed) throw new Error("Renderer closed");
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.wsReadyPromise) return this.wsReadyPromise;

    this.wsReadyPromise = this._launchAndConnect().finally(() => {
      this.wsReadyPromise = null;
    });
    return this.wsReadyPromise;
  }

  async _launchAndConnect() {
    const chromeBin = findChromeBinary();
    if (!chromeBin || typeof WebSocket !== "function") {
      throw new Error("Headless Chrome or WebSocket unavailable");
    }

    if (!this.profileDir) {
      this.profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-od-thumb-chrome-"));
    }

    const proc = spawn(
      chromeBin,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--hide-scrollbars",
        "--mute-audio",
        "--disable-background-networking",
        "--disable-extensions",
        "--remote-debugging-port=0",
        `--user-data-dir=${this.profileDir}`,
        "about:blank"
      ],
      { stdio: ["ignore", "ignore", "pipe"] }
    );
    this.chromeProc = proc;

    const wsUrl = await new Promise((resolve, reject) => {
      let stderrBuf = "";
      const timer = setTimeout(() => {
        reject(new Error("Chrome CDP startup timeout"));
      }, 10000);

      proc.stderr.on("data", (chunk) => {
        stderrBuf += chunk.toString("utf8");
        const m = stderrBuf.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (m) {
          clearTimeout(timer);
          resolve(m[1]);
        }
      });

      proc.once("exit", (code) => {
        clearTimeout(timer);
        if (this.chromeProc === proc) this.chromeProc = null;
        reject(new Error(`Chrome exited prematurely (${code})`));
      });
    });

    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP WebSocket open timeout")), 5000);
      ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
      ws.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("CDP WebSocket open error"));
      });
    });

    ws.addEventListener("message", (ev) => {
      let msg;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (typeof msg.id === "number" && this.pendingCalls.has(msg.id)) {
        const { resolve, reject } = this.pendingCalls.get(msg.id);
        this.pendingCalls.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error.message || "CDP error"));
        } else {
          resolve(msg.result);
        }
        return;
      }
      if (msg.method) {
        for (const fn of this.eventListeners) fn(msg);
      }
    });

    ws.addEventListener("close", () => {
      if (this.ws === ws) this.ws = null;
      for (const { reject } of this.pendingCalls.values()) {
        reject(new Error("CDP connection closed"));
      }
      this.pendingCalls.clear();
    });

    this.ws = ws;
  }

  send(method, params = {}, sessionId = undefined) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("CDP WebSocket not open"));
    }
    const id = this.nextMsgId++;
    const payload = sessionId ? { id, method, params, sessionId } : { id, method, params };
    return new Promise((resolve, reject) => {
      this.pendingCalls.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }

  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._drain();
    });
  }

  _drain() {
    while (this.activeCount < THUMB_CONCURRENCY && this.queue.length > 0) {
      const job = this.queue.shift();
      this.activeCount += 1;
      Promise.resolve()
        .then(job.fn)
        .then(job.resolve, job.reject)
        .finally(() => {
          this.activeCount -= 1;
          this._drain();
        });
    }
  }

  async captureUrlToJpeg(url, cachePath) {
    if (this.inFlight.has(cachePath)) {
      return this.inFlight.get(cachePath);
    }

    const promise = this.enqueue(async () => {
      if (fs.existsSync(cachePath)) {
        return fs.readFileSync(cachePath);
      }
      await this.ensureConnected();

      let targetId = null;
      let loadListener = null;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Thumb capture timeout")), THUMB_TIMEOUT_MS)
      );

      const work = async () => {
        const created = await this.send("Target.createTarget", { url: "about:blank" });
        targetId = created.targetId;
        const attached = await this.send("Target.attachToTarget", {
          targetId,
          flatten: true
        });
        const sessionId = attached.sessionId;

        await this.send("Page.enable", {}, sessionId);
        await this.send(
          "Emulation.setDeviceMetricsOverride",
          { width: 1280, height: 800, deviceScaleFactor: 0.5, mobile: false },
          sessionId
        );

        const loadPromise = new Promise((resolve) => {
          const fallbackTimer = setTimeout(resolve, 3500);
          loadListener = (msg) => {
            if (msg.sessionId === sessionId && msg.method === "Page.loadEventFired") {
              clearTimeout(fallbackTimer);
              resolve();
            }
          };
          this.eventListeners.add(loadListener);
        });

        await this.send("Page.navigate", { url }, sessionId);
        await loadPromise;
        await new Promise((r) => setTimeout(r, 220));

        const shot = await this.send(
          "Page.captureScreenshot",
          { format: "jpeg", quality: 82 },
          sessionId
        );
        const buf = Buffer.from(shot.data, "base64");
        fs.mkdirSync(THUMB_CACHE_DIR, { recursive: true });
        fs.writeFileSync(cachePath, buf);
        pruneThumbCache();
        return buf;
      };

      try {
        return await Promise.race([work(), timeoutPromise]);
      } finally {
        if (loadListener) this.eventListeners.delete(loadListener);
        if (targetId && this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.send("Target.closeTarget", { targetId }).catch(() => {});
        }
      }
    }).finally(() => {
      this.inFlight.delete(cachePath);
    });

    this.inFlight.set(cachePath, promise);
    return promise;
  }

  shutdown() {
    this.closed = true;
    try {
      if (this.ws) this.ws.close();
    } catch {
      // ignore
    }
    this.ws = null;

    if (this.chromeProc) {
      const proc = this.chromeProc;
      this.chromeProc = null;
      try {
        proc.kill("SIGTERM");
        setTimeout(() => {
          try {
            if (!proc.killed) proc.kill("SIGKILL");
          } catch {
            // ignore
          }
        }, 800).unref();
      } catch {
        // ignore
      }
    }

    if (this.profileDir) {
      const dirToRemove = this.profileDir;
      this.profileDir = null;
      try {
        if (dirToRemove.startsWith(os.tmpdir())) {
          fs.rmSync(dirToRemove, { recursive: true, force: true });
        }
      } catch {
        // ignore
      }
    }
  }
}

async function startServer(opts, initialAudit) {
  const repoRoot = opts.root;
  const docPaths = getDesignDocsPaths(repoRoot);
  const previewDir = discoverPreviewDir(repoRoot, opts.previewDir);
  const thumbRenderer = new ThumbRenderer();
  let activePort = opts.port;
  let lastAudit = initialAudit;

  const server = http.createServer(async (req, res) => {
    const method = (req.method || "GET").toUpperCase();
    let parsedUrl;
    try {
      parsedUrl = new URL(req.url || "/", `http://127.0.0.1:${activePort}`);
    } catch {
      sendJson(res, 400, { ok: false, error: "Invalid request URL" });
      return;
    }

    const pathname = parsedUrl.pathname;

    try {
      if (method === "GET" && (pathname === "/" || pathname === "/index.html")) {
        const state = buildState(opts, {
          liveMode: true,
          port: activePort,
          cachedAudit: lastAudit
        });
        const html = renderStudioHtml(state);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        });
        res.end(html);
        return;
      }

      if (method === "GET" && pathname === "/health") {
        sendJson(res, 200, { ok: true, port: activePort });
        return;
      }

      if (method === "GET" && pathname === "/api/state") {
        const state = buildState(opts, {
          liveMode: true,
          port: activePort,
          cachedAudit: lastAudit
        });
        sendJson(res, 200, state);
        return;
      }

      if (method === "POST" && pathname === "/api/audit") {
        lastAudit = runAudit(repoRoot);
        sendJson(res, 200, lastAudit);
        return;
      }

      if (method === "POST" && pathname === "/api/tokens/save") {
        const body = await readJsonBody(req);
        if (!body || !Array.isArray(body.updates) || body.updates.length === 0) {
          sendJson(res, 400, { ok: false, error: "Body must include non-empty updates array" });
          return;
        }
        const tokensPath = discoverTokensFile(repoRoot, opts.tokens);
        const { updatedCount } = applyTokenUpdates(tokensPath, body.updates);
        const tokenData = parseTokensFile(tokensPath, repoRoot);
        lastAudit = runAudit(repoRoot);
        sendJson(res, 200, {
          ok: true,
          updatedCount,
          tokens: tokenData.tokens,
          audit: lastAudit
        });
        return;
      }

      if (method === "GET" && pathname === "/api/design-md") {
        sendJson(res, 200, loadDesignMd(repoRoot));
        return;
      }

      if (method === "POST" && pathname === "/api/design-md/save") {
        const body = await readJsonBody(req);
        if (!body || typeof body.content !== "string") {
          sendJson(res, 400, { ok: false, error: "Body must include string content" });
          return;
        }
        fs.writeFileSync(docPaths.designMd, body.content, "utf8");
        sendJson(res, 200, {
          ok: true,
          path: "DESIGN.md",
          bytes: Buffer.byteLength(body.content, "utf8"),
          updatedAt: new Date().toISOString()
        });
        return;
      }

      if (method === "GET" && pathname.startsWith("/api/design-systems/")) {
        const rest = pathname.slice("/api/design-systems/".length);
        const filesMarker = "/files/";
        const filesIdx = rest.indexOf(filesMarker);

        if (filesIdx !== -1) {
          const rawId = rest.slice(0, filesIdx);
          const rawRel = rest.slice(filesIdx + filesMarker.length);
          let decodedId;
          let decodedRel;
          try {
            decodedId = decodeURIComponent(rawId);
            decodedRel = decodeURIComponent(rawRel);
          } catch {
            sendJson(res, 400, { ok: false, error: "Invalid URL encoding" });
            return;
          }
          if (decodedId.includes("/") || decodedId.includes("\\")) {
            sendJson(res, 400, { ok: false, error: "Invalid design system id" });
            return;
          }
          const filePayload = readDesignSystemAllowlistedFile(decodedId, decodedRel);
          res.writeHead(200, {
            "Content-Type": filePayload.contentType,
            "Cache-Control": "no-store"
          });
          res.end(filePayload.content);
          return;
        }

        let decodedId;
        try {
          decodedId = decodeURIComponent(rest);
        } catch {
          sendJson(res, 400, { ok: false, error: "Invalid design system id encoding" });
          return;
        }
        if (decodedId.includes("/") || decodedId.includes("\\")) {
          sendJson(res, 400, { ok: false, error: "Invalid design system id" });
          return;
        }
        const detail = readDesignSystemDetail(decodedId);
        sendJson(res, 200, detail);
        return;
      }

      if (method === "GET" && pathname.startsWith("/api/design-templates/")) {
        const rest = pathname.slice("/api/design-templates/".length);
        const filesMarker = "/files/";
        const filesIdx = rest.indexOf(filesMarker);

        if (filesIdx !== -1) {
          const rawId = rest.slice(0, filesIdx);
          const rawRel = rest.slice(filesIdx + filesMarker.length);
          let decodedId;
          let decodedRel;
          try {
            decodedId = decodeURIComponent(rawId);
            decodedRel = decodeURIComponent(rawRel);
          } catch {
            sendJson(res, 400, { ok: false, error: "Invalid URL encoding" });
            return;
          }
          if (decodedId.includes("/") || decodedId.includes("\\")) {
            sendJson(res, 400, { ok: false, error: "Invalid design template id" });
            return;
          }
          const filePayload = readDesignTemplateFile(decodedId, decodedRel);
          res.writeHead(200, {
            "Content-Type": filePayload.contentType,
            "Cache-Control": "no-store"
          });
          res.end(filePayload.content);
          return;
        }

        let decodedId;
        try {
          decodedId = decodeURIComponent(rest);
        } catch {
          sendJson(res, 400, { ok: false, error: "Invalid design template id encoding" });
          return;
        }
        if (decodedId.includes("/") || decodedId.includes("\\")) {
          sendJson(res, 400, { ok: false, error: "Invalid design template id" });
          return;
        }
        const detail = readDesignTemplateDetail(decodedId);
        sendJson(res, 200, detail);
        return;
      }

      if (method === "GET" && pathname.startsWith("/api/screenshots/")) {
        let filename;
        try {
          filename = decodeURIComponent(pathname.slice("/api/screenshots/".length));
        } catch {
          sendJson(res, 400, { ok: false, error: "Invalid screenshot filename encoding" });
          return;
        }
        const found = findScreenshotFile(opts.screenshots, filename);
        if (!found) {
          sendJson(res, 404, { ok: false, error: "Screenshot not found" });
          return;
        }
        res.writeHead(200, {
          "Content-Type": found.contentType,
          "Cache-Control": "public, max-age=3600"
        });
        res.end(fs.readFileSync(found.absPath));
        return;
      }

      if (method === "GET" && pathname.startsWith("/api/thumb/")) {
        const rest = pathname.slice("/api/thumb/".length);
        const match = rest.match(/^(template|system)\/([^/]+)\.(?:jpe?g|png)$/i);
        if (!match) {
          sendJson(res, 400, { ok: false, error: "Invalid thumbnail path" });
          return;
        }
        const kind = match[1];
        let id;
        try {
          id = decodeURIComponent(match[2]);
        } catch {
          sendJson(res, 400, { ok: false, error: "Invalid thumbnail id encoding" });
          return;
        }

        const baseDir = kind === "template" ? DEFAULT_DESIGN_TEMPLATES_DIR : DEFAULT_DESIGN_SYSTEMS_DIR;
        validateScopedId(baseDir, id, kind);

        const cacheKey = `${kind === "template" ? "tpl" : "sys"}--${id}.jpg`;
        const cachePath = path.join(THUMB_CACHE_DIR, cacheKey);

        if (fs.existsSync(cachePath)) {
          res.writeHead(200, {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=604800"
          });
          res.end(fs.readFileSync(cachePath));
          return;
        }

        let targetRelUrl = null;
        let fallbackTitle = id;
        let fallbackPalette = null;

        if (kind === "template") {
          const item = loadDesignTemplates().find((t) => t.id === id);
          if (!item || !item.exampleUrl) {
            sendJson(res, 404, { ok: false, error: `Template not found: ${id}` });
            return;
          }
          targetRelUrl = item.exampleUrl;
          fallbackTitle = item.name;
        } else {
          const item = loadDesignSystems().find((s) => s.id === id);
          if (!item || !item.cardPreviewUrl) {
            sendJson(res, 404, { ok: false, error: `Design system not found: ${id}` });
            return;
          }
          targetRelUrl = item.cardPreviewUrl;
          fallbackTitle = item.name;
          fallbackPalette = item.previewPalette;
        }

        try {
          const fullUrl = `http://127.0.0.1:${activePort}${targetRelUrl}`;
          const jpegBuf = await thumbRenderer.captureUrlToJpeg(fullUrl, cachePath);
          res.writeHead(200, {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=604800"
          });
          res.end(jpegBuf);
        } catch {
          const svg = renderFallbackThumbSvg(fallbackTitle, fallbackPalette);
          res.writeHead(200, {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "no-store"
          });
          res.end(svg);
        }
        return;
      }

      if (method === "POST" && pathname === "/api/handoff/prepare") {
        const body = await readJsonBody(req);
        const savedFiles = [];

        if (body && body.brief && typeof body.brief === "object") {
          const briefToSave = normalizeBrief({
            ...body.brief,
            updatedAt: new Date().toISOString()
          });
          writeJsonAtomic(docPaths.brief, briefToSave);
          savedFiles.push("docs/design/design-brief.json");
        }

        if (body && Array.isArray(body.annotations)) {
          writeJsonAtomic(docPaths.annotations, body.annotations);
          savedFiles.push("docs/design/od-annotations.json");
        }

        if (body && body.critique && typeof body.critique === "object") {
          const critiqueToSave = {
            ...body.critique,
            updatedAt: new Date().toISOString()
          };
          writeJsonAtomic(docPaths.critique, critiqueToSave);
          savedFiles.push("docs/design/od-critique.json");
        }

        if (body && Array.isArray(body.rules)) {
          writeJsonAtomic(docPaths.rules, body.rules);
          savedFiles.push("docs/design/od-rules.json");
        }

        const brief = loadBrief(repoRoot);
        const annotations = loadAnnotations(repoRoot);
        const critique = loadCritique(repoRoot);
        const rules = loadRules(repoRoot);
        const tokensPath = discoverTokensFile(repoRoot, opts.tokens);
        const tokenFile = tokensPath ? path.relative(repoRoot, tokensPath).replace(/\\/g, "/") : "";

        const useSwarm = body?.useSwarm !== false;
        const shortCommand = useSwarm
          ? "/swarm 按 docs/design/od-handoff-prompt.md 开始实施优化"
          : "按 docs/design/od-handoff-prompt.md 开始实施优化";

        const prompt = compileHandoffPrompt({
          projectName: path.basename(repoRoot),
          root: repoRoot,
          brief,
          annotations,
          critique,
          rules,
          tokenFile,
          audit: lastAudit,
          useSwarm
        });

        fs.mkdirSync(path.dirname(docPaths.handoffPrompt), { recursive: true });
        fs.writeFileSync(docPaths.handoffPrompt, prompt, "utf8");
        savedFiles.push("docs/design/od-handoff-prompt.md");

        const openAnnotationsCount = annotations.filter((a) => a && a.status !== "resolved").length;
        const hasBrief = Boolean(
          brief.palette ||
            brief.typography ||
            brief.layout ||
            brief.vibe ||
            brief.density ||
            brief.constraints ||
            brief.targetPages ||
            brief.notes ||
            brief.templateId ||
            brief.designSystemId
        );

        sendJson(res, 200, {
          ok: true,
          filePath: "docs/design/od-handoff-prompt.md",
          prompt,
          shortCommand,
          useSwarm,
          savedFiles,
          openAnnotationsCount,
          hasBrief
        });
        return;
      }

      if (method === "GET" && pathname === "/api/brief") {
        sendJson(res, 200, loadBrief(repoRoot));
        return;
      }

      if (method === "POST" && pathname === "/api/brief/save") {
        const body = await readJsonBody(req);
        const rawBrief = body && body.brief && typeof body.brief === "object" ? body.brief : body;
        const brief = normalizeBrief({ ...rawBrief, updatedAt: new Date().toISOString() });
        writeJsonAtomic(docPaths.brief, brief);
        sendJson(res, 200, { ok: true, brief });
        return;
      }

      if (method === "GET" && pathname === "/api/annotations") {
        sendJson(res, 200, { annotations: loadAnnotations(repoRoot) });
        return;
      }

      if (method === "POST" && pathname === "/api/annotations/save") {
        const body = await readJsonBody(req);
        const list = Array.isArray(body) ? body : body?.annotations;
        if (!Array.isArray(list)) {
          sendJson(res, 400, { ok: false, error: "Body must include annotations array" });
          return;
        }
        writeJsonAtomic(docPaths.annotations, list);
        sendJson(res, 200, { ok: true, annotations: list });
        return;
      }

      if (method === "GET" && pathname === "/api/critique") {
        sendJson(res, 200, {
          critique: loadCritique(repoRoot),
          rules: loadRules(repoRoot)
        });
        return;
      }

      if (method === "POST" && pathname === "/api/critique/save") {
        const body = await readJsonBody(req);
        let critique = loadCritique(repoRoot);
        let rules = loadRules(repoRoot);

        if (body && body.critique && typeof body.critique === "object") {
          critique = {
            ...body.critique,
            updatedAt: new Date().toISOString()
          };
          writeJsonAtomic(docPaths.critique, critique);
        }
        if (body && Array.isArray(body.rules)) {
          rules = body.rules;
          writeJsonAtomic(docPaths.rules, rules);
        }

        sendJson(res, 200, { ok: true, critique, rules });
        return;
      }

      if (
        method === "GET" &&
        (pathname === "/preview" ||
          pathname.startsWith("/preview/") ||
          pathname.startsWith("/js/") ||
          pathname.startsWith("/css/") ||
          pathname.startsWith("/chunk/") ||
          pathname.startsWith("/static/"))
      ) {
        servePreviewAsset(pathname, previewDir, res);
        return;
      }

      sendJson(res, 404, { ok: false, error: `Route not found: ${method} ${pathname}` });
    } catch (err) {
      const status = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
      sendJson(res, status, {
        ok: false,
        error: err?.message ? String(err.message) : "Internal server error"
      });
    }
  });

  activePort = await listenWithFallback(server, opts.port, 21);
  const url = `http://127.0.0.1:${activePort}`;
  process.stdout.write(`[od-review-ui] Live Design Studio serving at ${url}\n`);
  process.stdout.write(`[od-review-ui] Press Ctrl+C to stop.\n`);

  if (opts.open) {
    openTarget(url);
  }

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    process.stdout.write(`\n[od-review-ui] Received ${signal}, shutting down cleanly...\n`);
    thumbRenderer.shutdown();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`[od-review-ui] Argument error: ${err.message}\n`);
    printHelp();
    process.exit(2);
  }

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  if (!fs.existsSync(opts.root)) {
    process.stderr.write(`[od-review-ui] Repository root does not exist: ${opts.root}\n`);
    process.exit(1);
  }

  const staticState = buildState(opts, { liveMode: false, port: null });
  const html = renderStudioHtml(staticState);

  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  fs.writeFileSync(opts.out, html, "utf8");

  const sizeMb = (Buffer.byteLength(html, "utf8") / (1024 * 1024)).toFixed(2);
  process.stdout.write(`[od-review-ui] Generated: ${opts.out} (${sizeMb} MB)\n`);
  process.stdout.write(
    `[od-review-ui] Audit: ${staticState.audit.pass ? "PASS" : "CHECK"} (P0=${staticState.audit.p0.total}, P1=${staticState.audit.p1.total}, files=${staticState.audit.totalFiles}) | Tokens: ${staticState.tokens.length} | DesignSystems: ${staticState.designSystems.length} | Screenshots: ${staticState.screenshots.length}\n`
  );

  if (opts.serve) {
    await startServer(opts, staticState.audit);
  } else if (opts.open) {
    openTarget(opts.out);
  }
}

main().catch((err) => {
  process.stderr.write(`[od-review-ui] Fatal error: ${err?.stack || err}\n`);
  process.exit(1);
});
