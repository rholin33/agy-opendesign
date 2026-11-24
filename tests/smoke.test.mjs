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

test("POSIX shell syntax check (`sh -n`) passes on all scripts and bin wrappers", () => {
  const shellFiles = [
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

test("install.sh --dry-run and uninstall.sh --dry-run succeed without mutating filesystem", () => {
  const tmpBin = fs.mkdtempSync(path.join(os.tmpdir(), "agy-od-dryrun-"));
  try {
    const inst = runSync("sh", [
      path.join(REPO_ROOT, "scripts/install.sh"),
      "--dry-run",
      "--bin-dir",
      tmpBin
    ]);
    assert.equal(inst.status, 0, inst.stderr);
    assert.match(inst.stdout, /\[dry-run\] install -m 0755 .*open-design-mcp/);
    assert.match(inst.stdout, /\[dry-run\] .*mcp add/);
    assert.equal(fs.readdirSync(tmpBin).length, 0, "dry-run must not write files");

    const uninst = runSync("sh", [
      path.join(REPO_ROOT, "scripts/uninstall.sh"),
      "--dry-run",
      "--bin-dir",
      tmpBin
    ]);
    assert.equal(uninst.status, 0, uninst.stderr);
    assert.match(uninst.stdout, /\[dry-run\] .*mcp remove/);
    assert.match(uninst.stdout, /\[dry-run\] rm -f .*open-design-mcp/);
  } finally {
    fs.rmSync(tmpBin, { recursive: true, force: true });
  }
});

test("init-project.sh bootstraps a scratch git repo and od-sync-audit.mjs detects clean vs dirty styles", () => {
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), "agy-od-init-"));
  try {
    // Initialize scratch git repo with a clean starter frontend
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

    // Bootstrap via init-project.sh
    const initRes = runSync("sh", [path.join(REPO_ROOT, "scripts/init-project.sh"), tmpRepo]);
    assert.equal(initRes.status, 0, initRes.stderr);

    for (const expected of [
      ".agents/skills.json",
      ".agents/rules/open-design.md",
      ".agents/skills/od-design-refine/SKILL.md",
      ".agents/skills/od-upstream-sync/SKILL.md",
      "scripts/od-sync-audit.mjs",
      "DESIGN.md"
    ]) {
      assert.equal(fs.existsSync(path.join(tmpRepo, expected)), true, `missing bootstrapped ${expected}`);
    }

    // Verify skills.json is valid JSON and excluded in .git/info/exclude
    const skillsJson = JSON.parse(fs.readFileSync(path.join(tmpRepo, ".agents/skills.json"), "utf8"));
    assert.ok(Array.isArray(skillsJson.entries) && skillsJson.entries.length === 2);
    const excludeText = fs.readFileSync(path.join(tmpRepo, ".git/info/exclude"), "utf8");
    assert.match(excludeText, /^\.agents\/skills\.json$/m);

    // Run audit on clean repo (--skip-solution-b keeps test independent of host ~/.gemini config)
    const cleanAudit = runSync("node", [
      path.join(tmpRepo, "scripts/od-sync-audit.mjs"),
      "--root",
      tmpRepo,
      "--strict",
      "--skip-solution-b",
      "--json"
    ]);
    assert.equal(cleanAudit.status, 0, `expected clean audit pass: ${cleanAudit.stdout}\n${cleanAudit.stderr}`);
    const cleanReport = JSON.parse(cleanAudit.stdout);
    assert.equal(cleanReport.ok, true);
    assert.equal(cleanReport.summary.p0ViolationCount, 0);
    assert.equal(cleanReport.summary.p1WarningCount, 0);
    assert.deepEqual(cleanReport.styles.tokenFiles, ["src/styles/tokens.css"]);

    // Inject P0 + P1 violations into a dirty stylesheet and confirm non-zero failure
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
