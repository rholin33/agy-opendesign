#!/usr/bin/env node
/**
 * Generic OpenDesign <-> Frontend Upstream-Sync & Compliance Auditor (Solution B)
 * Zero external dependencies. Read-only on git history and source files.
 *
 * Usage:
 *   node scripts/od-sync-audit.mjs [options]
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AI_INDIGO_HEXES = new Set([
  "#6366f1",
  "#4f46e5",
  "#4338ca",
  "#3730a3",
  "#8b5cf6",
  "#7c3aed",
  "#a855f7",
  "#e0e7ff"
]);

const STYLE_EXTENSIONS = new Set([".css", ".scss", ".sass", ".less"]);
const FRONTEND_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte", ".css", ".scss", ".sass", ".less"]);

function parseArgs(argv) {
  const opts = {
    root: null,
    src: [],
    tokens: [],
    redesignDir: null,
    base: null,
    json: false,
    strict: false,
    skipSolutionB: false,
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
    if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--strict") {
      opts.strict = true;
    } else if (arg === "--skip-solution-b") {
      opts.skipSolutionB = true;
    } else if (arg === "-h" || arg === "--help") {
      opts.help = true;
    } else if (arg === "--root") {
      opts.root = requireValue("--root", i);
      i += 1;
    } else if (arg.startsWith("--root=")) {
      opts.root = arg.slice("--root=".length);
    } else if (arg === "--src") {
      opts.src.push(requireValue("--src", i));
      i += 1;
    } else if (arg.startsWith("--src=")) {
      opts.src.push(arg.slice("--src=".length));
    } else if (arg === "--tokens") {
      opts.tokens.push(requireValue("--tokens", i));
      i += 1;
    } else if (arg.startsWith("--tokens=")) {
      opts.tokens.push(arg.slice("--tokens=".length));
    } else if (arg === "--redesign-dir") {
      opts.redesignDir = requireValue("--redesign-dir", i);
      i += 1;
    } else if (arg.startsWith("--redesign-dir=")) {
      opts.redesignDir = arg.slice("--redesign-dir=".length);
    } else if (arg === "--base") {
      opts.base = requireValue("--base", i);
      i += 1;
    } else if (arg.startsWith("--base=")) {
      opts.base = arg.slice("--base=".length);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return opts;
}

function printHelp() {
  process.stdout.write(`Usage: node scripts/od-sync-audit.mjs [options]

Audits upstream/local frontend drift, OpenDesign stylesheet compliance (P0/P1),
and local Solution B (agy CLI + OpenDesign MCP) readiness.

Options:
  --root <dir>          Repository root (default: parent of scripts/ or cwd)
  --src <dir>           Frontend source dir to scan (repeatable; auto-detects
                        src, apps/*/src, packages/*/src, frontend/src, web/src, client/src)
  --tokens <path>       Token stylesheet path excluded from raw-hex check (repeatable;
                        auto-detects **/tokens.{css,scss,less} & **/design-tokens.{css,scss})
  --redesign-dir <path> Isolated redesign layer path relative to root (default:
                        auto-matches **/components/redesign/**)
  --base <ref>          Git ref to diff against (default: @{upstream} -> origin/main
                        -> origin/master -> upstream/main -> HEAD)
  --strict              Also fail (exit 1) on P1 hygiene warnings (raw hexes or !important)
  --skip-solution-b     Skip local agy/OpenDesign installation checks (for headless CI)
  --json                Emit structured JSON report
  -h, --help            Show this help message
`);
}

function resolveRepoRoot(explicitRoot) {
  if (explicitRoot) return path.resolve(explicitRoot);
  if (path.basename(__dirname) === "scripts") {
    return path.resolve(__dirname, "..");
  }
  return process.cwd();
}

function normalizeRel(repoRoot, targetPath) {
  const abs = path.isAbsolute(targetPath) ? targetPath : path.resolve(repoRoot, targetPath);
  return path.relative(repoRoot, abs).replace(/\\/g, "/").replace(/\/+$/, "");
}

function discoverSrcDirs(repoRoot, explicitSrc) {
  if (explicitSrc.length > 0) {
    return explicitSrc.map((entry) => {
      const abs = path.isAbsolute(entry) ? entry : path.resolve(repoRoot, entry);
      if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
        throw new Error(`--src directory does not exist: ${entry}`);
      }
      return normalizeRel(repoRoot, abs);
    });
  }

  const found = [];
  for (const simple of ["src", "frontend/src", "web/src", "client/src"]) {
    const abs = path.join(repoRoot, simple);
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      found.push(simple);
    }
  }
  for (const container of ["apps", "packages"]) {
    const base = path.join(repoRoot, container);
    if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) continue;
    for (const child of fs.readdirSync(base, { withFileTypes: true })) {
      if (!child.isDirectory()) continue;
      const candidate = path.join(base, child.name, "src");
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        found.push(`${container}/${child.name}/src`);
      }
    }
  }
  return [...new Set(found)].sort();
}

function runGit(repoRoot, args) {
  try {
    return {
      ok: true,
      stdout: execFileSync("git", args, {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }).trim()
    };
  } catch (err) {
    return {
      ok: false,
      stdout: "",
      stderr: (err?.stderr ? String(err.stderr) : String(err?.message ?? err)).trim()
    };
  }
}

function resolveBaseRef(repoRoot, explicitBase) {
  if (explicitBase) {
    const verified = runGit(repoRoot, ["rev-parse", "--verify", "--quiet", `${explicitBase}^{commit}`]);
    if (!verified.ok) {
      throw new Error(`Invalid --base git ref: "${explicitBase}"`);
    }
    return { ref: explicitBase, sha: verified.stdout.slice(0, 12), source: "explicit" };
  }

  const candidates = [
    { ref: "@{upstream}", source: "tracking-upstream" },
    { ref: "origin/main", source: "remote-origin-main" },
    { ref: "origin/master", source: "remote-origin-master" },
    { ref: "upstream/main", source: "remote-upstream-main" },
    { ref: "HEAD", source: "head-fallback" }
  ];

  for (const candidate of candidates) {
    const verified = runGit(repoRoot, ["rev-parse", "--verify", "--quiet", `${candidate.ref}^{commit}`]);
    if (verified.ok) {
      return { ref: candidate.ref, sha: verified.stdout.slice(0, 12), source: candidate.source };
    }
  }
  return { ref: null, sha: null, source: "no-commits" };
}

function isTokenFile(relPath, explicitTokenSet) {
  if (explicitTokenSet.size > 0) {
    return explicitTokenSet.has(relPath);
  }
  return /(?:^|\/)(?:design-)?tokens\.(?:css|scss|sass|less)$/i.test(relPath);
}

function classifyFrontendPath(relPath, redesignDirRel, explicitTokenSet) {
  if (isTokenFile(relPath, explicitTokenSet)) {
    return "redesign_isolated";
  }
  if (redesignDirRel) {
    if (relPath === redesignDirRel || relPath.startsWith(`${redesignDirRel}/`)) {
      return "redesign_isolated";
    }
  } else if (/(?:^|\/)components\/redesign\//.test(relPath)) {
    return "redesign_isolated";
  }

  if (/(?:^|\/)(?:services|api|hooks|store|stores|utils|lib|config)\//.test(relPath)) {
    return "upstream_logic_config";
  }
  if (/(?:^|\/)(?:app|main|index)\.(?:css|scss|less|tsx|jsx|ts|js)$/.test(relPath)) {
    return "thin_adapter_seam";
  }
  return "upstream_ui";
}

function collectGitDrift(repoRoot, srcDirs, redesignDirRel, explicitTokenSet, explicitBase) {
  const insideWorkTree = runGit(repoRoot, ["rev-parse", "--is-inside-work-tree"]);
  if (!insideWorkTree.ok || insideWorkTree.stdout !== "true") {
    return {
      isGitRepo: false,
      branch: null,
      head: null,
      baseRef: null,
      baseSha: null,
      baseSource: "not-a-git-repo",
      remotes: [],
      changedFrontendTotal: 0,
      countsByLayer: {
        redesign_isolated: 0,
        thin_adapter_seam: 0,
        upstream_ui: 0,
        upstream_logic_config: 0
      },
      changedFiles: []
    };
  }

  const branchRes = runGit(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const headRes = runGit(repoRoot, ["rev-parse", "--short", "HEAD"]);
  const remotesRes = runGit(repoRoot, ["remote", "-v"]);
  const base = resolveBaseRef(repoRoot, explicitBase);

  const remotes = remotesRes.ok && remotesRes.stdout
    ? remotesRes.stdout.split("\n").filter(Boolean)
    : [];

  const fileMap = new Map();
  const pathSpecs = srcDirs.length > 0 ? ["--", ...srcDirs] : [];

  if (base.ref) {
    const diffRes = runGit(repoRoot, ["diff", "--name-status", base.ref, ...pathSpecs]);
    if (diffRes.ok && diffRes.stdout) {
      for (const line of diffRes.stdout.split("\n")) {
        if (!line.trim()) continue;
        const parts = line.split("\t");
        const status = parts[0];
        const filePath = (parts.length >= 3 ? parts[2] : parts[1])?.replace(/\\/g, "/");
        if (!filePath || !FRONTEND_EXTENSIONS.has(path.extname(filePath).toLowerCase())) continue;
        fileMap.set(filePath, {
          path: filePath,
          status,
          layer: classifyFrontendPath(filePath, redesignDirRel, explicitTokenSet)
        });
      }
    }
  }

  const untrackedRes = runGit(repoRoot, ["ls-files", "--others", "--exclude-standard", ...pathSpecs]);
  if (untrackedRes.ok && untrackedRes.stdout) {
    for (const rawPath of untrackedRes.stdout.split("\n")) {
      const filePath = rawPath.trim().replace(/\\/g, "/");
      if (!filePath || !FRONTEND_EXTENSIONS.has(path.extname(filePath).toLowerCase())) continue;
      if (!fileMap.has(filePath)) {
        fileMap.set(filePath, {
          path: filePath,
          status: "??",
          layer: classifyFrontendPath(filePath, redesignDirRel, explicitTokenSet)
        });
      }
    }
  }

  const changedFiles = [...fileMap.values()].sort((a, b) => a.path.localeCompare(b.path));
  const countsByLayer = {
    redesign_isolated: 0,
    thin_adapter_seam: 0,
    upstream_ui: 0,
    upstream_logic_config: 0
  };
  for (const item of changedFiles) {
    countsByLayer[item.layer] = (countsByLayer[item.layer] ?? 0) + 1;
  }

  return {
    isGitRepo: true,
    branch: branchRes.ok ? branchRes.stdout : "unborn",
    head: headRes.ok ? headRes.stdout : "unborn",
    baseRef: base.ref,
    baseSha: base.sha,
    baseSource: base.source,
    remotes,
    changedFrontendTotal: changedFiles.length,
    countsByLayer,
    changedFiles
  };
}

function walkStyleFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkStyleFiles(full, out);
    } else if (entry.isFile() && STYLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

function stripCssCommentsPreserveLines(source) {
  let out = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inBlock = false;
  let inLine = false;

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (inBlock) {
      if (ch === "*" && next === "/") {
        inBlock = false;
        out += "  ";
        i += 2;
      } else {
        out += ch === "\n" ? "\n" : " ";
        i += 1;
      }
      continue;
    }

    if (inLine) {
      if (ch === "\n") {
        inLine = false;
        out += "\n";
      } else {
        out += " ";
      }
      i += 1;
      continue;
    }

    if (inSingle) {
      out += ch;
      if (ch === "\\" && i + 1 < source.length) {
        out += next;
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      i += 1;
      continue;
    }

    if (inDouble) {
      out += ch;
      if (ch === "\\" && i + 1 < source.length) {
        out += next;
        i += 2;
        continue;
      }
      if (ch === '"') inDouble = false;
      i += 1;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlock = true;
      out += "  ";
      i += 2;
      continue;
    }
    if (ch === "/" && next === "/") {
      const prev = i > 0 ? source[i - 1] : "";
      if (prev !== ":") {
        inLine = true;
        out += "  ";
        i += 2;
        continue;
      }
    }

    out += ch;
    i += 1;
  }

  return out;
}

function findLeftBorderRoundedCards(relPath, strippedCss) {
  const hits = [];
  const blockRe = /([^{};@][^{}]*)\{([^{}]+)\}/g;
  let match;
  while ((match = blockRe.exec(strippedCss)) !== null) {
    const selector = match[1].trim().replace(/\s+/g, " ");
    const body = match[2];
    const hasRadius = /\bborder-radius\s*:\s*(?!0(?:\s|;|px|PX|rpx|rem|em|%|$))[^;]+/i.test(body);
    if (!hasRadius) continue;
    const leftBorderMatch = /\bborder-left\s*:\s*([0-9.]+)\s*(px|PX|rpx)\s+solid\b/i.exec(body);
    if (!leftBorderMatch) continue;
    const widthVal = Number(leftBorderMatch[1]);
    const unit = leftBorderMatch[2];
    const isThickAccentBar =
      (unit === "PX" && widthVal >= 3) ||
      (unit === "px" && widthVal >= 3) ||
      (unit === "rpx" && widthVal >= 4);
    if (!isThickAccentBar) continue;
    const line = strippedCss.slice(0, match.index).split("\n").length;
    hits.push({ file: relPath, line, selector, match: leftBorderMatch[0] });
  }
  return hits;
}

function auditStyles(repoRoot, srcDirs, explicitTokenSet) {
  const styleFiles = [];
  for (const relDir of srcDirs) {
    walkStyleFiles(path.join(repoRoot, relDir), styleFiles);
  }
  styleFiles.sort();

  const tokenFiles = [];
  const aiIndigoHits = [];
  const colorMixHits = [];
  const leftBorderCardHits = [];
  const rawHexHits = [];
  const importantHits = [];

  for (const absPath of styleFiles) {
    const relPath = path.relative(repoRoot, absPath).replace(/\\/g, "/");
    const tokenFile = isTokenFile(relPath, explicitTokenSet);
    if (tokenFile) tokenFiles.push(relPath);

    const raw = fs.readFileSync(absPath, "utf8");
    const stripped = stripCssCommentsPreserveLines(raw);
    const lines = stripped.split("\n");

    let supportsColorMixDepth = 0;
    let braceDepth = 0;
    let guardExitDepth = -1;

    for (let idx = 0; idx < lines.length; idx += 1) {
      const lineNo = idx + 1;
      const line = lines[idx];

      if (/@supports\b[^{]*color-mix\s*\(/i.test(line)) {
        supportsColorMixDepth += 1;
        guardExitDepth = braceDepth;
      }

      if (/\bcolor-mix\s*\(/i.test(line) && !/@supports\b/i.test(line) && supportsColorMixDepth === 0) {
        colorMixHits.push({ file: relPath, line: lineNo, snippet: line.trim() });
      }

      for (const ch of line) {
        if (ch === "{") braceDepth += 1;
        else if (ch === "}") {
          braceDepth = Math.max(0, braceDepth - 1);
          if (supportsColorMixDepth > 0 && braceDepth <= guardExitDepth) {
            supportsColorMixDepth = 0;
            guardExitDepth = -1;
          }
        }
      }

      if (/!important\b/.test(line)) {
        importantHits.push({ file: relPath, line: lineNo, snippet: line.trim() });
      }

      if (tokenFile) continue;

      const scanLine = line.replace(/url\(\s*['"]?data:[^)]+\)/gi, "url(data-omitted)");
      const hexMatches = scanLine.match(/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g);
      if (hexMatches) {
        for (const rawHex of hexMatches) {
          const normalized = rawHex.toLowerCase();
          const hit = { file: relPath, line: lineNo, hex: normalized, snippet: line.trim() };
          rawHexHits.push(hit);
          if (AI_INDIGO_HEXES.has(normalized)) {
            aiIndigoHits.push(hit);
          }
        }
      }
    }

    if (!tokenFile) {
      leftBorderCardHits.push(...findLeftBorderRoundedCards(relPath, stripped));
    }
  }

  return {
    scannedSrcDirs: srcDirs,
    scannedStyleFiles: styleFiles.length,
    tokenFiles,
    p0: {
      aiIndigo: aiIndigoHits,
      unguardedColorMix: colorMixHits,
      leftBorderRoundedCards: leftBorderCardHits
    },
    p1: {
      rawHexOutsideTokens: rawHexHits,
      importantDeclarations: importantHits
    }
  };
}

function checkFile(absPath, { executable = false, jsonCheck = null, frontmatterName = null } = {}) {
  if (!fs.existsSync(absPath)) {
    return { ok: false, path: absPath, reason: "missing" };
  }
  try {
    const stat = fs.statSync(absPath);
    if (!stat.isFile() || stat.size === 0) {
      return { ok: false, path: absPath, reason: "empty-or-not-file" };
    }
    if (executable) {
      fs.accessSync(absPath, fs.constants.X_OK);
    }
    if (jsonCheck) {
      const parsed = JSON.parse(fs.readFileSync(absPath, "utf8"));
      const msg = jsonCheck(parsed);
      if (msg) return { ok: false, path: absPath, reason: msg };
    }
    if (frontmatterName) {
      const head = fs.readFileSync(absPath, "utf8").slice(0, 600);
      const hasFm = new RegExp(
        `^---\\r?\\n[\\s\\S]*?\\bname:\\s*${frontmatterName}\\b[\\s\\S]*?\\bdescription:\\s*\\S+`,
        "m"
      ).test(head);
      if (!hasFm) {
        return { ok: false, path: absPath, reason: `invalid-frontmatter(expected name: ${frontmatterName})` };
      }
    }
    return { ok: true, path: absPath, bytes: stat.size };
  } catch (err) {
    return { ok: false, path: absPath, reason: err?.message ?? String(err) };
  }
}

function auditSolutionBReadiness(repoRoot, skipSolutionB) {
  if (skipSolutionB) {
    return { skipped: true, ready: true, missingRequired: [], checks: {} };
  }

  const home = os.homedir();
  const appPath = process.env.OPEN_DESIGN_APP || "/Applications/Open Design.app";
  const binDir = process.env.BIN_DIR || path.join(home, ".local/bin");

  const checks = {
    openDesignMcpWrapper: checkFile(path.join(binDir, "open-design-mcp"), { executable: true }),
    openDesignCliWrapper: checkFile(path.join(binDir, "open-design-cli"), { executable: true }),
    agyMcpConfig: checkFile(path.join(home, ".gemini/config/mcp_config.json"), {
      jsonCheck: (cfg) => {
        const srv = cfg?.mcpServers?.["open-design"];
        if (!srv || typeof srv.command !== "string") return "open-design server missing in mcp_config.json";
        if (srv.disabled === true) return "open-design MCP server is disabled";
        return null;
      }
    }),
    designMd: checkFile(path.join(repoRoot, "DESIGN.md")),
    skillsJson: checkFile(path.join(repoRoot, ".agents/skills.json"), {
      jsonCheck: (cfg) => (Array.isArray(cfg?.entries) && cfg.entries.length > 0 ? null : "entries array empty")
    }),
    openDesignRule: checkFile(path.join(repoRoot, ".agents/rules/open-design.md")),
    upstreamSyncSkill: checkFile(path.join(repoRoot, ".agents/skills/od-upstream-sync/SKILL.md"), {
      frontmatterName: "od-upstream-sync"
    }),
    designRefineSkill: checkFile(path.join(repoRoot, ".agents/skills/od-design-refine/SKILL.md"), {
      frontmatterName: "od-design-refine"
    })
  };

  const bundleEntry = path.join(appPath, "Contents/Resources/app/prebundled/daemon/daemon-cli.mjs");
  const openDesignBundle = process.platform === "darwin"
    ? checkFile(bundleEntry)
    : { ok: true, path: bundleEntry, skipped: "non-macos" };

  const requiredKeys = [
    "openDesignMcpWrapper",
    "agyMcpConfig",
    "designMd",
    "skillsJson",
    "openDesignRule",
    "upstreamSyncSkill"
  ];
  const missingRequired = requiredKeys.filter((k) => !checks[k].ok);

  return {
    skipped: false,
    ready: missingRequired.length === 0 && openDesignBundle.ok,
    missingRequired,
    openDesignBundle,
    checks
  };
}

function buildChecklist(drift, styles, solutionB) {
  const actions = [];

  if (!solutionB.skipped && !solutionB.ready) {
    for (const key of solutionB.missingRequired) {
      const item = solutionB.checks[key];
      actions.push(`[P0] Restore Solution B artifact (${key}): ${item.path} (${item.reason})`);
    }
    if (solutionB.openDesignBundle && !solutionB.openDesignBundle.ok) {
      actions.push(`[P0] Install Open Design.app or set OPEN_DESIGN_APP: ${solutionB.openDesignBundle.path}`);
    }
  }

  if (styles.p0.aiIndigo.length > 0) {
    actions.push(`[P0] Replace ${styles.p0.aiIndigo.length} AI indigo hex hit(s) with semantic tokens from your token stylesheet.`);
  }
  if (styles.p0.unguardedColorMix.length > 0) {
    actions.push(`[P0] Guard or replace ${styles.p0.unguardedColorMix.length} unguarded color-mix() call(s) with pre-blended tokens.`);
  }
  if (styles.p0.leftBorderRoundedCards.length > 0) {
    actions.push(`[P0] Remove ${styles.p0.leftBorderRoundedCards.length} rounded-card + thick border-left anti-pattern(s).`);
  }

  if (styles.p1.rawHexOutsideTokens.length > 0) {
    actions.push(`[P1] Migrate ${styles.p1.rawHexOutsideTokens.length} raw hex literal(s) outside token files to CSS custom properties.`);
  }
  if (styles.p1.importantDeclarations.length > 0) {
    actions.push(`[P1] Audit ${styles.p1.importantDeclarations.length} !important declaration(s) and eliminate specificity wars.`);
  }

  if (drift.countsByLayer.upstream_ui > 0) {
    actions.push(
      `[Sync] ${drift.countsByLayer.upstream_ui} upstream UI file(s) changed vs ${drift.baseRef ?? "working tree"}: align against DESIGN.md and run $od-design-refine if new surfaces were added.`
    );
  }
  if (drift.countsByLayer.thin_adapter_seam > 0) {
    actions.push(
      `[Sync] ${drift.countsByLayer.thin_adapter_seam} thin-adapter seam file(s) changed: confirm minimal prop wiring into your isolated redesign layer.`
    );
  }

  if (actions.length === 0) {
    actions.push("[OK] Zero P0/P1 violations and Solution B is ready.");
  } else {
    actions.push("[Verify] Re-run `node scripts/od-sync-audit.mjs --strict` plus your project typecheck, unit tests, and production build.");
  }
  return actions;
}

function renderHumanReport(report) {
  const lines = [];
  lines.push(`OpenDesign Sync Audit [${report.ok ? "PASS" : "FAIL"}]`);
  lines.push(`Root: ${report.repoRoot}`);
  if (report.drift.isGitRepo) {
    lines.push(
      `Git: branch=${report.drift.branch} HEAD=${report.drift.head} base=${report.drift.baseRef ?? "none"} (${report.drift.baseSha ?? "n/a"}, ${report.drift.baseSource})`
    );
  } else {
    lines.push("Git: not a git repository (drift scan skipped)");
  }
  lines.push(`Scanned src dirs: ${report.styles.scannedSrcDirs.length ? report.styles.scannedSrcDirs.join(", ") : "(none detected)"}`);
  lines.push("");

  lines.push("1. Frontend Drift Classification:");
  lines.push(
    `   total=${report.drift.changedFrontendTotal} | redesign_isolated=${report.drift.countsByLayer.redesign_isolated} | thin_adapter_seam=${report.drift.countsByLayer.thin_adapter_seam} | upstream_ui=${report.drift.countsByLayer.upstream_ui} | upstream_logic_config=${report.drift.countsByLayer.upstream_logic_config}`
  );
  lines.push("");

  lines.push(`2. OpenDesign Stylesheet Compliance (${report.styles.scannedStyleFiles} files, token files: ${report.styles.tokenFiles.length}):`);
  lines.push(
    `   P0: ai_indigo=${report.styles.p0.aiIndigo.length} | color_mix=${report.styles.p0.unguardedColorMix.length} | left_border_cards=${report.styles.p0.leftBorderRoundedCards.length}`
  );
  lines.push(
    `   P1: raw_hex_outside_tokens=${report.styles.p1.rawHexOutsideTokens.length} | important=${report.styles.p1.importantDeclarations.length}`
  );
  for (const [label, list] of [
    ["P0 AI Indigo", report.styles.p0.aiIndigo],
    ["P0 color-mix()", report.styles.p0.unguardedColorMix],
    ["P0 Left-border card", report.styles.p0.leftBorderRoundedCards],
    ["P1 Raw hex", report.styles.p1.rawHexOutsideTokens],
    ["P1 !important", report.styles.p1.importantDeclarations]
  ]) {
    if (list.length > 0) {
      lines.push(`   ${label}:`);
      for (const hit of list.slice(0, 10)) {
        lines.push(`     - ${hit.file}:${hit.line} ${hit.hex ?? hit.match ?? hit.snippet}`);
      }
      if (list.length > 10) lines.push(`     ... (+${list.length - 10} more)`);
    }
  }
  lines.push("");

  if (report.solutionB.skipped) {
    lines.push("3. Solution B Readiness: SKIPPED (--skip-solution-b)");
  } else {
    lines.push(`3. Solution B Readiness (${report.solutionB.ready ? "READY" : "INCOMPLETE"}):`);
    for (const [key, res] of Object.entries(report.solutionB.checks)) {
      lines.push(`   - [${res.ok ? "OK" : "FAIL"}] ${key}: ${res.path}${res.ok ? "" : ` (${res.reason})`}`);
    }
    const b = report.solutionB.openDesignBundle;
    lines.push(`   - [${b.ok ? "OK" : "FAIL"}] openDesignBundle: ${b.path}${b.ok ? "" : ` (${b.reason})`}`);
  }
  lines.push("");

  lines.push("4. Actionable Checklist for local `agy` CLI:");
  for (const item of report.checklist) {
    lines.push(`   * ${item}`);
  }
  return `${lines.join("\n")}\n`;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(2);
  }
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const repoRoot = resolveRepoRoot(opts.root);
  if (!fs.existsSync(repoRoot) || !fs.statSync(repoRoot).isDirectory()) {
    process.stderr.write(`Error: root directory does not exist: ${repoRoot}\n`);
    process.exit(2);
  }

  let srcDirs;
  let drift;
  try {
    srcDirs = discoverSrcDirs(repoRoot, opts.src);
    const explicitTokenSet = new Set(opts.tokens.map((t) => normalizeRel(repoRoot, t)));
    const redesignDirRel = opts.redesignDir ? normalizeRel(repoRoot, opts.redesignDir) : null;
    drift = collectGitDrift(repoRoot, srcDirs, redesignDirRel, explicitTokenSet, opts.base);
    const styles = auditStyles(repoRoot, srcDirs, explicitTokenSet);
    const solutionB = auditSolutionBReadiness(repoRoot, opts.skipSolutionB);

    const p0ViolationCount =
      styles.p0.aiIndigo.length +
      styles.p0.unguardedColorMix.length +
      styles.p0.leftBorderRoundedCards.length;

    const p1WarningCount =
      styles.p1.rawHexOutsideTokens.length +
      styles.p1.importantDeclarations.length;

    const ok = p0ViolationCount === 0 && solutionB.ready && (!opts.strict || p1WarningCount === 0);
    const checklist = buildChecklist(drift, styles, solutionB);

    const report = {
      ok,
      strict: opts.strict,
      repoRoot,
      summary: {
        p0ViolationCount,
        p1WarningCount,
        solutionBReady: solutionB.ready
      },
      drift,
      styles,
      solutionB,
      checklist
    };

    if (opts.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(renderHumanReport(report));
    }
    process.exit(ok ? 0 : 1);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(2);
  }
}

main();
