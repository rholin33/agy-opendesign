#!/usr/bin/env node
/**
 * Local macOS upstream compatibility & update checker for agy-opendesign.
 * Zero external dependencies. No GitHub Actions required — designed for manual
 * runs or recurring `/schedule` checks in `agy`.
 *
 * Usage:
 *   node scripts/check-upstream.mjs [--json] [--offline] [--app-path <path>] [--help]
 *
 * Exit codes:
 *   0  UP_TO_DATE or UPSTREAM_UPDATE_AVAILABLE (compatible)
 *   1  COMPAT_DRIFT (wrapper/MCP/CLI contract broke or drifted from upstream-lock.json)
 *   2  Invalid arguments or missing lock file
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const opts = {
    json: false,
    offline: false,
    appPath: process.env.OPEN_DESIGN_APP || "/Applications/Open Design.app",
    lockPath: path.join(REPO_ROOT, "upstream-lock.json"),
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--offline") {
      opts.offline = true;
    } else if (arg === "-h" || arg === "--help") {
      opts.help = true;
    } else if (arg === "--app-path") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) throw new Error("--app-path requires a value");
      opts.appPath = next;
      i += 1;
    } else if (arg.startsWith("--app-path=")) {
      opts.appPath = arg.slice("--app-path=".length);
    } else if (arg === "--lock") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) throw new Error("--lock requires a value");
      opts.lockPath = path.resolve(next);
      i += 1;
    } else if (arg.startsWith("--lock=")) {
      opts.lockPath = path.resolve(arg.slice("--lock=".length));
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return opts;
}

function printHelp() {
  process.stdout.write(`Usage: node scripts/check-upstream.mjs [options]

Checks upstream nexu-io/open-design releases, local Open Design.app / brew /
agy versions, and live open-design-mcp + open-design-cli compatibility against
upstream-lock.json.

Options:
  --offline           Skip network requests (GitHub API & brew outdated)
  --app-path <path>   Path to Open Design.app (default: $OPEN_DESIGN_APP or /Applications/Open Design.app)
  --lock <path>       Path to upstream-lock.json (default: <toolkit>/upstream-lock.json)
  --json              Output structured JSON report
  -h, --help          Show this help message

Exit codes:
  0  UP_TO_DATE or UPSTREAM_UPDATE_AVAILABLE
  1  COMPAT_DRIFT (broken or drifted MCP/CLI contract)
  2  Invalid CLI usage or unreadable lock file
`);
}

function runCmd(cmd, args, opts = {}) {
  try {
    const stdout = execFileSync(cmd, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10000,
      ...opts
    }).trim();
    return { ok: true, status: 0, stdout, stderr: "" };
  } catch (err) {
    return {
      ok: false,
      status: typeof err.status === "number" ? err.status : 1,
      stdout: err.stdout ? String(err.stdout).trim() : "",
      stderr: err.stderr ? String(err.stderr).trim() : String(err.message)
    };
  }
}

function readLocalAppInfo(appPath) {
  const plistPath = path.join(appPath, "Contents/Info.plist");
  const helperPath = path.join(
    appPath,
    "Contents/Frameworks/Open Design Helper.app/Contents/MacOS/Open Design Helper"
  );
  const daemonCliPath = path.join(
    appPath,
    "Contents/Resources/app/prebundled/daemon/daemon-cli.mjs"
  );

  if (!fs.existsSync(appPath)) {
    return { installed: false, appPath, version: null, helperExists: false, daemonCliExists: false };
  }

  let version = null;
  if (fs.existsSync(plistPath)) {
    const plutilRes = runCmd("plutil", ["-convert", "json", "-o", "-", plistPath]);
    if (plutilRes.ok && plutilRes.stdout) {
      try {
        const parsed = JSON.parse(plutilRes.stdout);
        version = parsed.CFBundleShortVersionString || parsed.CFBundleVersion || null;
      } catch {
        version = null;
      }
    }
    if (!version) {
      const xml = fs.readFileSync(plistPath, "utf8");
      const m = /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/.exec(xml);
      if (m) version = m[1].trim();
    }
  }

  return {
    installed: true,
    appPath,
    version,
    helperExists: fs.existsSync(helperPath),
    daemonCliExists: fs.existsSync(daemonCliPath)
  };
}

function checkBrewCask(offline) {
  const whichBrew = runCmd("sh", ["-c", "command -v brew"]);
  if (!whichBrew.ok || !whichBrew.stdout) {
    return { available: false, outdated: false, raw: null };
  }
  if (offline) {
    const installed = runCmd("brew", ["list", "--cask", "--versions", "open-design"]);
    return {
      available: true,
      offlineSkipped: true,
      outdated: false,
      installedVersion: installed.ok ? installed.stdout : null
    };
  }
  const outdatedRes = runCmd("brew", ["outdated", "--cask", "open-design"], { timeout: 20000 });
  const lines = (outdatedRes.stdout || "").split("\n").map((l) => l.trim()).filter(Boolean);
  return {
    available: true,
    offlineSkipped: false,
    outdated: lines.some((l) => l.includes("open-design")),
    raw: outdatedRes.stdout || null
  };
}

function checkAgyEnvironment() {
  const candidates = [];
  const whichRes = runCmd("sh", ["-c", "command -v agy"]);
  if (whichRes.ok && whichRes.stdout) candidates.push(whichRes.stdout);
  const defaultBin = path.join(os.homedir(), ".local/bin/agy");
  if (fs.existsSync(defaultBin) && !candidates.includes(defaultBin)) candidates.push(defaultBin);

  const agyBin = candidates[0] || null;
  if (!agyBin) {
    return { available: false, version: null, mcpRegistered: false, mcpOutput: null };
  }
  const verRes = runCmd(agyBin, ["--version"]);
  const listRes = runCmd(agyBin, ["mcp", "list"]);
  const mcpRegistered = listRes.ok && /\bopen-design\b/.test(listRes.stdout);
  return {
    available: true,
    version: verRes.ok ? verRes.stdout.split("\n")[0].trim() : null,
    mcpRegistered,
    mcpOutput: listRes.ok ? listRes.stdout : listRes.stderr
  };
}

async function checkRemoteGitHub(lock, offline) {
  if (offline) {
    return { skipped: true, ok: true, latestTag: null, updateAvailable: false, watchedChanges: [] };
  }
  const repo = lock.upstream?.repo || "nexu-io/open-design";
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "agy-opendesign-check-upstream"
  };
  const authToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  try {
    const relResp = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers,
      signal: AbortSignal.timeout(8000)
    });
    if (!relResp.ok) {
      return {
        skipped: false,
        ok: false,
        reason: `GitHub releases API returned HTTP ${relResp.status}`,
        latestTag: null,
        updateAvailable: false,
        watchedChanges: []
      };
    }
    const rel = await relResp.json();
    const latestTag = typeof rel.tag_name === "string" ? rel.tag_name : null;
    const updateAvailable = Boolean(latestTag && latestTag !== lock.upstream.releaseTag);

    let watchedChanges = [];
    let compareNote = null;
    if (updateAvailable && lock.upstream.releaseTag && latestTag) {
      try {
        const cmpResp = await fetch(
          `https://api.github.com/repos/${repo}/compare/${encodeURIComponent(lock.upstream.releaseTag)}...${encodeURIComponent(latestTag)}`,
          { headers, signal: AbortSignal.timeout(8000) }
        );
        if (cmpResp.ok) {
          const cmp = await cmpResp.json();
          const files = Array.isArray(cmp.files) ? cmp.files : [];
          const watched = Array.isArray(lock.upstream.watchedPaths) ? lock.upstream.watchedPaths : [];
          watchedChanges = files
            .map((f) => f.filename)
            .filter((name) => typeof name === "string" && watched.some((prefix) => name.startsWith(prefix)));
        } else {
          compareNote = `GitHub compare API returned HTTP ${cmpResp.status}`;
        }
      } catch (cmpErr) {
        compareNote = cmpErr?.message ?? String(cmpErr);
      }
    }

    return {
      skipped: false,
      ok: true,
      repo,
      latestTag,
      publishedAt: rel.published_at || null,
      htmlUrl: rel.html_url || null,
      updateAvailable,
      watchedChanges,
      compareNote
    };
  } catch (err) {
    return {
      skipped: false,
      ok: false,
      reason: err?.message ?? String(err),
      latestTag: null,
      updateAvailable: false,
      watchedChanges: []
    };
  }
}

async function checkLiveMcpWrapper(appPath) {
  const wrapper = path.join(REPO_ROOT, "bin/open-design-mcp");
  if (!fs.existsSync(wrapper)) {
    return { ok: false, reason: `wrapper missing: ${wrapper}` };
  }

  return await new Promise((resolve) => {
    const child = spawn("sh", [wrapper], {
      env: {
        ...process.env,
        OPEN_DESIGN_APP: appPath,
        OD_DAEMON_URL: "http://127.0.0.1:19999"
      },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { child.stdin.end(); } catch {}
      try { child.kill("SIGTERM"); } catch {}
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({ ok: false, reason: `MCP handshake timed out (10s). stderr=${stderr.slice(0, 300)}` });
    }, 10000);

    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.stdout.on("data", (d) => {
      stdout += d.toString();
      const lines = stdout.split("\n").filter(Boolean);
      if (lines.length >= 2) {
        try {
          const initResp = JSON.parse(lines[0]);
          const listResp = JSON.parse(lines[1]);
          const serverInfo = initResp?.result?.serverInfo || {};
          const tools = Array.isArray(listResp?.result?.tools) ? listResp.result.tools : [];
          finish({
            ok: true,
            protocolVersion: initResp?.result?.protocolVersion || null,
            serverName: serverInfo.name || null,
            serverVersion: serverInfo.version || null,
            toolCount: tools.length
          });
        } catch (err) {
          finish({ ok: false, reason: `Invalid JSON-RPC output: ${err.message}` });
        }
      }
    });
    child.on("error", (err) => finish({ ok: false, reason: err.message }));
    child.on("close", (code) => {
      if (!settled) {
        finish({ ok: false, reason: `MCP exited (${code}) before responding. stderr=${stderr.slice(0, 300)}` });
      }
    });

    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "agy-opendesign-check", version: "1.0.0" }
        }
      })}\n`
    );
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);
  });
}

function checkLiveCliDirections(appPath) {
  const cli = path.join(REPO_ROOT, "bin/open-design-cli");
  if (!fs.existsSync(cli)) {
    return { ok: false, reason: `cli wrapper missing: ${cli}`, count: 0 };
  }
  const res = runCmd("sh", [cli, "tools", "directions", "--json"], {
    env: { ...process.env, OPEN_DESIGN_APP: appPath }
  });
  if (!res.ok) {
    return { ok: false, reason: res.stderr || `exit ${res.status}`, count: 0 };
  }
  try {
    const arr = JSON.parse(res.stdout);
    if (!Array.isArray(arr) || arr.length === 0) {
      return { ok: false, reason: "directions returned empty/non-array JSON", count: 0 };
    }
    return { ok: true, count: arr.length };
  } catch (err) {
    return { ok: false, reason: `invalid JSON from directions: ${err.message}`, count: 0 };
  }
}

function renderHuman(report) {
  const lines = [];
  lines.push(`agy-opendesign Upstream Check [${report.status}]`);
  lines.push(`Lock: ${report.lock.upstream.repo} @ ${report.lock.upstream.releaseTag} (app ${report.lock.upstream.appVersion}, MCP ${report.lock.upstream.mcpServerVersion}, ${report.lock.upstream.expectedMcpToolCount} tools, agy ${report.lock.client.verifiedAgyVersion})`);
  lines.push("");

  lines.push("1. Upstream Release (GitHub):");
  if (report.remote.skipped) {
    lines.push("   - Skipped (--offline)");
  } else if (!report.remote.ok) {
    lines.push(`   - Unavailable (${report.remote.reason})`);
  } else {
    lines.push(`   - Latest tag: ${report.remote.latestTag} (updateAvailable=${report.remote.updateAvailable})`);
    if (report.remote.watchedChanges.length > 0) {
      lines.push(`   - Watched path changes (${report.remote.watchedChanges.length}):`);
      for (const f of report.remote.watchedChanges.slice(0, 10)) {
        lines.push(`       * ${f}`);
      }
      if (report.remote.watchedChanges.length > 10) {
        lines.push(`       ... (+${report.remote.watchedChanges.length - 10} more)`);
      }
    }
  }
  lines.push("");

  lines.push("2. Local Environment:");
  lines.push(`   - Open Design.app: installed=${report.local.app.installed} version=${report.local.app.version ?? "n/a"} helper=${report.local.app.helperExists} daemonCli=${report.local.app.daemonCliExists}`);
  lines.push(`   - Homebrew cask: available=${report.local.brew.available} outdated=${report.local.brew.outdated}${report.local.brew.offlineSkipped ? " (offline)" : ""}`);
  lines.push(`   - agy CLI: available=${report.local.agy.available} version=${report.local.agy.version ?? "n/a"} mcpRegistered=${report.local.agy.mcpRegistered}`);
  lines.push("");

  lines.push("3. Live Compatibility Checks:");
  lines.push(`   - bin/open-design-mcp: ok=${report.compat.mcp.ok} server=${report.compat.mcp.serverName ?? "n/a"}@${report.compat.mcp.serverVersion ?? "n/a"} tools=${report.compat.mcp.toolCount ?? "n/a"}${report.compat.mcp.reason ? ` (${report.compat.mcp.reason})` : ""}`);
  lines.push(`   - bin/open-design-cli directions: ok=${report.compat.cliDirections.ok} count=${report.compat.cliDirections.count}${report.compat.cliDirections.reason ? ` (${report.compat.cliDirections.reason})` : ""}`);
  if (report.compat.driftReasons.length > 0) {
    lines.push("   - Drift reasons:");
    for (const r of report.compat.driftReasons) lines.push(`       * ${r}`);
  }
  lines.push("");

  lines.push("4. Next-Step Checklist:");
  for (const step of report.checklist) {
    lines.push(`   * ${step}`);
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
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

  let lock;
  try {
    lock = JSON.parse(fs.readFileSync(opts.lockPath, "utf8"));
  } catch (err) {
    process.stderr.write(`Error: cannot read upstream lock file ${opts.lockPath}: ${err.message}\n`);
    process.exit(2);
  }

  const [remote, app, brew, agy] = await Promise.all([
    checkRemoteGitHub(lock, opts.offline),
    Promise.resolve(readLocalAppInfo(opts.appPath)),
    Promise.resolve(checkBrewCask(opts.offline)),
    Promise.resolve(checkAgyEnvironment())
  ]);

  let mcp;
  let cliDirections;
  if (process.platform === "darwin" && app.installed) {
    mcp = await checkLiveMcpWrapper(opts.appPath);
    cliDirections = checkLiveCliDirections(opts.appPath);
  } else {
    mcp = { ok: false, skipped: process.platform !== "darwin", reason: app.installed ? "non-macos" : `Open Design.app not found at ${opts.appPath}` };
    cliDirections = { ok: false, skipped: process.platform !== "darwin", count: 0, reason: app.installed ? "non-macos" : `Open Design.app not found at ${opts.appPath}` };
  }

  const driftReasons = [];
  if (process.platform === "darwin") {
    if (!app.installed || !app.helperExists || !app.daemonCliExists) {
      driftReasons.push(`Open Design.app bundle incomplete or missing at ${opts.appPath}`);
    } else {
      if (!mcp.ok) {
        driftReasons.push(`open-design-mcp handshake failed: ${mcp.reason}`);
      } else {
        if (mcp.serverName !== lock.upstream.mcpServerName) {
          driftReasons.push(`MCP server name drifted: expected "${lock.upstream.mcpServerName}", got "${mcp.serverName}"`);
        }
        if (mcp.serverVersion !== lock.upstream.mcpServerVersion) {
          driftReasons.push(`MCP server version drifted: lock="${lock.upstream.mcpServerVersion}", live="${mcp.serverVersion}"`);
        }
        if (mcp.toolCount !== lock.upstream.expectedMcpToolCount) {
          driftReasons.push(`MCP tool count drifted: lock=${lock.upstream.expectedMcpToolCount}, live=${mcp.toolCount}`);
        }
      }
      if (!cliDirections.ok) {
        driftReasons.push(`open-design-cli tools directions failed: ${cliDirections.reason}`);
      }
    }
  }

  const updateAvailable = Boolean(
    remote.updateAvailable ||
    brew.outdated ||
    (app.installed && app.version && app.version !== lock.upstream.appVersion)
  );

  const status = driftReasons.length > 0
    ? "COMPAT_DRIFT"
    : updateAvailable
      ? "UPSTREAM_UPDATE_AVAILABLE"
      : "UP_TO_DATE";

  const checklist = [];
  if (status === "COMPAT_DRIFT") {
    checklist.push("Inspect drift reasons above and update bin/open-design-{mcp,cli} or skills/agy-opendesign/ if upstream MCP/sidecar contracts changed.");
    checklist.push("Run `node --test tests/smoke.test.mjs` until all checks pass.");
    checklist.push("Update `upstream-lock.json` to the newly verified versions/tool count, commit, tag `vX.Y.Z`, and push (`git push origin main --tags` / `gh release create`).");
  } else if (status === "UPSTREAM_UPDATE_AVAILABLE") {
    if (remote.updateAvailable || brew.outdated) {
      checklist.push("Upgrade local Open Design: `brew upgrade --cask open-design` (launch `open \"/Applications/Open Design.app\"` once if quarantined).");
    }
    if (remote.watchedChanges.length > 0) {
      checklist.push(`Review ${remote.watchedChanges.length} upstream change(s) under watched MCP/sidecar/desktop/scenario paths.`);
    }
    checklist.push("Re-run `node scripts/check-upstream.mjs` and `node --test tests/smoke.test.mjs`.");
    checklist.push("Update `upstream-lock.json`, commit, and cut a release (`git tag vX.Y.Z && git push origin main --tags`).");
  } else {
    checklist.push("All upstream and local compatibility checks match upstream-lock.json.");
    if (agy.available && !agy.mcpRegistered) {
      checklist.push("Note: `open-design` MCP server is not registered in `agy` — run `./install.sh` to register.");
    }
  }

  const report = {
    status,
    checkedAt: new Date().toISOString(),
    offline: opts.offline,
    lock,
    remote,
    local: { app, brew, agy },
    compat: { mcp, cliDirections, driftReasons },
    checklist
  };

  if (opts.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(renderHuman(report));
  }

  process.exit(status === "COMPAT_DRIFT" ? 1 : 0);
}

main();
