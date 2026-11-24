import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

function runSync(cmd, args, opts = {}) {
  try {
    const stdout = execFileSync(cmd, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...opts
    });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return {
      status: typeof err.status === "number" ? err.status : 1,
      stdout: err.stdout ? String(err.stdout) : "",
      stderr: err.stderr ? String(err.stderr) : String(err.message)
    };
  }
}

test("POSIX shell syntax check (`sh -n`) passes on root install.sh, bin wrappers, and scripts", () => {
  const shellFiles = [
    "install.sh",
    "bin/open-design-mcp",
    "bin/open-design-cli",
    "scripts/install.sh",
    "scripts/uninstall.sh",
    "scripts/init-project.sh"
  ];
  for (const rel of shellFiles) {
    const abs = path.join(REPO_ROOT, rel);
    assert.equal(fs.existsSync(abs), true, `missing ${rel}`);
    const res = runSync("sh", ["-n", abs]);
    assert.equal(res.status, 0, `sh -n failed for ${rel}: ${res.stderr}`);
  }
});

test("unified global skill `skills/agy-opendesign/SKILL.md` has valid YAML frontmatter and references", () => {
  const skillDir = path.join(REPO_ROOT, "skills/agy-opendesign");
  const skillMd = fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
  assert.match(skillMd, /^---\r?\n[\s\S]*?\bname:\s*agy-opendesign\b[\s\S]*?\bdescription:/m);
  for (const ref of [
    "references/upstream-sync.md",
    "references/critique-checklist.md",
    "references/design-md-template.md"
  ]) {
    assert.equal(fs.existsSync(path.join(skillDir, ref)), true, `missing ${ref}`);
  }
});

test("install.sh --dry-run (direct & piped) and --uninstall --dry-run do not mutate filesystem", () => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "agy-od-dryrun-"));
  try {
    const env = { ...process.env, HOME: tmpHome };
    const inst = runSync("sh", [path.join(REPO_ROOT, "install.sh"), "--dry-run"], { env });
    assert.equal(inst.status, 0, inst.stderr);
    assert.match(inst.stdout, /\[dry-run\] install payload/);
    assert.match(inst.stdout, /\[dry-run\] install global skill/);
    assert.match(inst.stdout, /\[dry-run\] .*mcp add/);

    // Simulate `curl ... | sh -s -- --dry-run`
    const installScript = fs.readFileSync(path.join(REPO_ROOT, "install.sh"), "utf8");
    const pipedOut = execFileSync("sh", ["-s", "--", "--dry-run"], {
      input: installScript,
      encoding: "utf8",
      env
    });
    assert.match(pipedOut, /\[dry-run\] download https:\/\/github\.com\/rholin33\/agy-opendesign\/archive\/refs\/heads\/main\.tar\.gz/);

    const uninst = runSync("sh", [path.join(REPO_ROOT, "install.sh"), "--uninstall", "--dry-run"], { env });
    assert.equal(uninst.status, 0, uninst.stderr);
    assert.match(uninst.stdout, /\[dry-run\] rm -rf .*agy-opendesign/);
    assert.equal(fs.readdirSync(tmpHome).length, 0, "dry-run must not write anything into HOME");
  } finally {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});

test("real install.sh + global od-sync-audit.mjs + install.sh --uninstall work end-to-end in isolated HOME", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agy-od-e2e-"));
  const tmpHome = path.join(tmpRoot, "home");
  const tmpProj = path.join(tmpRoot, "sample-project");
  fs.mkdirSync(tmpHome, { recursive: true });
  fs.mkdirSync(tmpProj, { recursive: true });

  try {
    const env = { ...process.env, HOME: tmpHome };
    delete env.BIN_DIR;
    delete env.AGY_OPENDESIGN_HOME;
    delete env.SKILLS_DIR;

    // 1. Run real install.sh with --no-mcp into isolated HOME
    const inst = runSync("sh", [path.join(REPO_ROOT, "install.sh"), "--no-mcp"], { env });
    assert.equal(inst.status, 0, `install failed: ${inst.stderr}\n${inst.stdout}`);

    const shareDir = path.join(tmpHome, ".local/share/agy-opendesign");
    const binDir = path.join(tmpHome, ".local/bin");
    const skillDir = path.join(tmpHome, ".gemini/config/skills/agy-opendesign");

    for (const expected of [
      path.join(binDir, "open-design-mcp"),
      path.join(binDir, "open-design-cli"),
      path.join(shareDir, "install.sh"),
      path.join(shareDir, "upstream-lock.json"),
      path.join(shareDir, "scripts/install.sh"),
      path.join(shareDir, "scripts/uninstall.sh"),
      path.join(shareDir, "scripts/od-sync-audit.mjs"),
      path.join(shareDir, "scripts/check-upstream.mjs"),
      path.join(shareDir, "scripts/init-project.sh"),
      path.join(shareDir, "templates/agents/rules/open-design.md"),
      path.join(skillDir, "SKILL.md"),
      path.join(skillDir, "references/upstream-sync.md"),
      path.join(skillDir, "references/critique-checklist.md"),
      path.join(skillDir, "references/design-md-template.md")
    ]) {
      assert.equal(fs.existsSync(expected), true, `missing installed file: ${expected}`);
    }
    // Check executable bits
    fs.accessSync(path.join(binDir, "open-design-mcp"), fs.constants.X_OK);
    fs.accessSync(path.join(binDir, "open-design-cli"), fs.constants.X_OK);
    fs.accessSync(path.join(shareDir, "install.sh"), fs.constants.X_OK);
    fs.accessSync(path.join(shareDir, "scripts/od-sync-audit.mjs"), fs.constants.X_OK);
    fs.accessSync(path.join(shareDir, "scripts/check-upstream.mjs"), fs.constants.X_OK);

    // 1b. Re-running installed $SHARE_DIR/scripts/install.sh must be idempotent (must not wipe its own source)
    const reinstall = runSync("sh", [path.join(shareDir, "scripts/install.sh"), "--no-mcp"], { env });
    assert.equal(reinstall.status, 0, `reinstall from shareDir failed: ${reinstall.stderr}\n${reinstall.stdout}`);
    assert.equal(fs.existsSync(path.join(shareDir, "scripts/od-sync-audit.mjs")), true);

    // 2. Simulate an arbitrary frontend repo with NO local scripts; invoke global od-sync-audit.mjs from cwd
    fs.mkdirSync(path.join(tmpProj, "src/styles"), { recursive: true });
    fs.writeFileSync(path.join(tmpProj, "src/styles/tokens.css"), ":root { --bg: #f8f7f4; --fg: #1c1f22; }\n");
    fs.writeFileSync(path.join(tmpProj, "src/app.css"), ".page { background: var(--bg); color: var(--fg); }\n");
    fs.writeFileSync(path.join(tmpProj, "DESIGN.md"), "# Sample Design System\n");

    // Seed fake mcp_config.json in isolated HOME so full Solution B readiness passes
    fs.mkdirSync(path.join(tmpHome, ".gemini/config"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpHome, ".gemini/config/mcp_config.json"),
      JSON.stringify({ mcpServers: { "open-design": { command: path.join(binDir, "open-design-mcp"), disabled: false } } })
    );

    const globalAudit = runSync("node", [path.join(shareDir, "scripts/od-sync-audit.mjs"), "--strict", "--json"], {
      cwd: tmpProj,
      env
    });
    assert.equal(globalAudit.status, 0, `global audit failed: ${globalAudit.stdout}\n${globalAudit.stderr}`);
    const report = JSON.parse(globalAudit.stdout);
    assert.equal(fs.realpathSync(report.repoRoot), fs.realpathSync(tmpProj), "global audit must default repoRoot to cwd");
    assert.equal(report.ok, true);
    assert.equal(report.solutionB.ready, true);
    assert.equal(report.solutionB.checks.globalSkill.ok, true);

    // 3. Run real uninstall via installed $SHARE_DIR/scripts/uninstall.sh --no-mcp and verify clean removal
    const uninst = runSync("sh", [path.join(shareDir, "scripts/uninstall.sh"), "--no-mcp"], { env });
    assert.equal(uninst.status, 0, `uninstall failed: ${uninst.stderr}\n${uninst.stdout}`);

    for (const removed of [
      path.join(binDir, "open-design-mcp"),
      path.join(binDir, "open-design-cli"),
      skillDir,
      shareDir
    ]) {
      assert.equal(fs.existsSync(removed), false, `expected removed by uninstall: ${removed}`);
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test("init-project.sh + od-sync-audit.mjs detect clean vs dirty styles in a scratch git repo", () => {
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), "agy-od-init-"));
  try {
    assert.equal(runSync("git", ["init", "-b", "main"], { cwd: tmpRepo }).status, 0);
    assert.equal(runSync("git", ["config", "user.name", "Test User"], { cwd: tmpRepo }).status, 0);
    assert.equal(runSync("git", ["config", "user.email", "test@example.com"], { cwd: tmpRepo }).status, 0);

    fs.mkdirSync(path.join(tmpRepo, "src/styles"), { recursive: true });
    fs.mkdirSync(path.join(tmpRepo, "src/components/redesign"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRepo, "src/styles/tokens.css"),
      ":root {\n  --bg: #f8f7f4;\n  --fg: #1c1f22;\n  --accent: #b84d39;\n}\n"
    );
    fs.writeFileSync(
      path.join(tmpRepo, "src/components/redesign/Hero.css"),
      "/* Comment mentioning #6366f1 and !important must be ignored */\n.hero {\n  background: var(--bg);\n  color: var(--fg);\n}\n"
    );
    assert.equal(runSync("git", ["add", "."], { cwd: tmpRepo }).status, 0);
    assert.equal(runSync("git", ["commit", "-m", "init"], { cwd: tmpRepo }).status, 0);

    const initRes = runSync("sh", [path.join(REPO_ROOT, "scripts/init-project.sh"), tmpRepo]);
    assert.equal(initRes.status, 0, initRes.stderr);

    const cleanAudit = runSync("node", [
      path.join(tmpRepo, "scripts/od-sync-audit.mjs"),
      "--root",
      tmpRepo,
      "--strict",
      "--skip-solution-b",
      "--json"
    ]);
    assert.equal(cleanAudit.status, 0, cleanAudit.stdout);
    const cleanReport = JSON.parse(cleanAudit.stdout);
    assert.equal(cleanReport.ok, true);
    assert.equal(cleanReport.summary.p0ViolationCount, 0);
    assert.equal(cleanReport.summary.p1WarningCount, 0);

    fs.writeFileSync(
      path.join(tmpRepo, "src/dirty.css"),
      [
        ".slop-card {",
        "  color: #6366f1 !important;",
        "  background: color-mix(in srgb, #123456 50%, white);",
        "  border-radius: 12px;",
        "  border-left: 4px solid #b84d39;",
        "}"
      ].join("\n")
    );

    const dirtyAudit = runSync("node", [
      path.join(tmpRepo, "scripts/od-sync-audit.mjs"),
      "--root",
      tmpRepo,
      "--skip-solution-b",
      "--json"
    ]);
    assert.equal(dirtyAudit.status, 1, "expected P0 violation to exit 1");
    const dirtyReport = JSON.parse(dirtyAudit.stdout);
    assert.equal(dirtyReport.ok, false);
    assert.equal(dirtyReport.styles.p0.aiIndigo.length, 1);
    assert.equal(dirtyReport.styles.p0.unguardedColorMix.length, 1);
    assert.equal(dirtyReport.styles.p0.leftBorderRoundedCards.length, 1);
    assert.ok(dirtyReport.styles.p1.rawHexOutsideTokens.length >= 3);
    assert.equal(dirtyReport.styles.p1.importantDeclarations.length, 1);
    assert.equal(dirtyReport.drift.countsByLayer.upstream_ui, 1);
  } finally {
    fs.rmSync(tmpRepo, { recursive: true, force: true });
  }
});

test("bin/open-design-mcp responds to JSON-RPC initialize + tools/list (22 tools)", async (t) => {
  const odApp = process.env.OPEN_DESIGN_APP || "/Applications/Open Design.app";
  const helper = path.join(
    odApp,
    "Contents/Frameworks/Open Design Helper.app/Contents/MacOS/Open Design Helper"
  );
  if (process.platform !== "darwin" || !fs.existsSync(helper)) {
    t.skip("Open Design.app not installed on this host");
    return;
  }

  const wrapper = path.join(REPO_ROOT, "bin/open-design-mcp");
  const child = spawn("sh", [wrapper], {
    env: { ...process.env, OD_DAEMON_URL: "http://127.0.0.1:19999" },
    stdio: ["pipe", "pipe", "pipe"]
  });

  const responses = await new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`MCP handshake timed out. stdout=${stdout} stderr=${stderr}`));
    }, 10000);

    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.stdout.on("data", (d) => {
      stdout += d.toString();
      const lines = stdout.split("\n").filter(Boolean);
      if (lines.length >= 2) {
        clearTimeout(timer);
        child.stdin.end();
        child.kill("SIGTERM");
        try {
          resolve(lines.map((line) => JSON.parse(line)));
        } catch (err) {
          reject(err);
        }
      }
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "agy-opendesign-smoke", version: "1.0.0" }
        }
      })}\n`
    );
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);
  });

  assert.equal(responses[0].result.serverInfo.name, "open-design");
  assert.equal(responses[0].result.protocolVersion, "2025-03-26");
  assert.equal(Array.isArray(responses[1].result.tools), true);
  assert.equal(responses[1].result.tools.length, 22);
});

test("scripts/check-upstream.mjs passes syntax check and --offline --json compatibility check", () => {
  const scriptPath = path.join(REPO_ROOT, "scripts/check-upstream.mjs");
  const syntax = runSync("node", ["--check", scriptPath]);
  assert.equal(syntax.status, 0, syntax.stderr);

  const invalid = runSync("node", [scriptPath, "--unknown-flag"]);
  assert.equal(invalid.status, 2);

  const odApp = process.env.OPEN_DESIGN_APP || "/Applications/Open Design.app";
  if (process.platform !== "darwin" || !fs.existsSync(odApp)) {
    return;
  }

  const res = runSync("node", [scriptPath, "--offline", "--json"]);
  assert.equal(res.status, 0, `check-upstream failed: ${res.stdout}\n${res.stderr}`);
  const report = JSON.parse(res.stdout);
  assert.ok(
    report.status === "UP_TO_DATE" || report.status === "UPSTREAM_UPDATE_AVAILABLE",
    `unexpected status: ${report.status}`
  );
  assert.equal(report.remote.skipped, true);
  assert.equal(report.compat.mcp.ok, true);
  assert.equal(report.compat.mcp.toolCount, 22);
  assert.equal(report.compat.cliDirections.ok, true);
});

test("scripts/notify-email.py syntax, --dry-run, --only-on-change, and missing-creds behavior", () => {
  const notifyScript = path.join(REPO_ROOT, "scripts/notify-email.py");
  assert.equal(fs.existsSync(notifyScript), true);

  // AST syntax check (writes zero __pycache__ artifacts)
  const astCheck = runSync("python3", [
    "-c",
    "import ast, pathlib, sys; ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))",
    notifyScript
  ]);
  assert.equal(astCheck.status, 0, astCheck.stderr);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-od-notify-"));
  try {
    const emptyEnv = path.join(tmpDir, "notify.env");
    fs.writeFileSync(emptyEnv, "NOTIFY_TO=you@example.com\nSMTP_HOST=smtp.example.com\nSMTP_USER=you@example.com\nSMTP_PASS=\n");

    const updateReportPath = path.join(tmpDir, "update-report.json");
    fs.writeFileSync(
      updateReportPath,
      JSON.stringify({
        status: "UPSTREAM_UPDATE_AVAILABLE",
        checkedAt: "2026-01-01T00:00:00Z",
        lock: { upstream: { repo: "nexu-io/open-design", releaseTag: "open-design-v0.27.2", appVersion: "0.27.2", mcpServerVersion: "0.2.0", expectedMcpToolCount: 22 } },
        remote: { latestTag: "open-design-v0.28.0", watchedChanges: ["apps/daemon/src/mcp/index.ts"] },
        local: { app: { installed: true, version: "0.27.2" } },
        compat: { mcp: { ok: true, serverName: "open-design", serverVersion: "0.2.0", toolCount: 22 }, driftReasons: [] },
        checklist: ["Upgrade local Open Design"]
      })
    );

    const dry = runSync("python3", [
      notifyScript,
      "--env-file",
      emptyEnv,
      "--report-json",
      updateReportPath,
      "--dry-run"
    ]);
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /To: you@example\.com/);
    assert.match(dry.stdout, /Subject: \[agy-opendesign\] UPSTREAM_UPDATE_AVAILABLE/);
    assert.match(dry.stdout, /apps\/daemon\/src\/mcp\/index\.ts/);

    // Missing credentials without --dry-run must exit non-zero cleanly
    const noCreds = runSync("python3", [
      notifyScript,
      "--env-file",
      emptyEnv,
      "--report-json",
      updateReportPath
    ]);
    assert.equal(noCreds.status, 1);
    assert.match(noCreds.stderr, /no email transport credentials configured/i);

    // --only-on-change with UP_TO_DATE must exit 0 without sending
    const upToDatePath = path.join(tmpDir, "ok-report.json");
    fs.writeFileSync(upToDatePath, JSON.stringify({ status: "UP_TO_DATE" }));
    const skipped = runSync("python3", [
      notifyScript,
      "--env-file",
      emptyEnv,
      "--report-json",
      upToDatePath,
      "--only-on-change"
    ]);
    assert.equal(skipped.status, 0, skipped.stderr);
    assert.match(skipped.stdout, /skipping email notification/i);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});


