# agy-opendesign

**面向 macOS 上 Google Antigravity CLI（`agy`）的合规 OpenDesign MCP 集成与上游同步前端重构工具包（Solution B）。**

[English](./README.md) | [简体中文](./README.zh-CN.md)

---

## 为什么采用 Solution B？

在第三方桌面应用中反向包裹调用 `agy` 存在违反消费者 OAuth 服务条款（ToS）的风险。**Solution B** 将控制方向彻底反转：

- **官方 `agy` CLI 始终作为唯一主客户端**，负责所有代码阅读、设计迁移与仓库修改，完全合规。
- **OpenDesign**（`Open Design.app`）仅作为下游 **MCP 服务器**（`open-design`，22 个工具 + `od://` 设计系统/技能资源）和本地只读设计资产库使用。
- **内置 ToS 硬约束**：项目规则明确禁止通过 MCP 调用 `start_run(agent: "antigravity")`，禁止由 OpenDesign 反向拉起 `agy`。
- **针对 macOS 的工程化加固**：
  - 提供不冲突的 `open-design-mcp` / `open-design-cli` 包装脚本，彻底规避 macOS 自带 `/usr/bin/od`（八进制转储命令）同名覆盖问题。
  - 直接使用 `Open Design Helper.app` + `ELECTRON_RUN_AS_NODE=1`（`LSUIElement=true` 无 Dock 图标跳动、与内置原生模块 ABI 完全一致、不依赖 `nvm`/`PATH`）。
  - 通过官方 `agy mcp add` 写入 `~/.gemini/config/mcp_config.json`（绕开 OpenDesign 内置安装器误写旧路径 `~/.gemini/antigravity/mcp_config.json` 的缺陷）。
  - 运行时动态通过 `@open-design/sidecar` 计算 Unix IPC 发现套接字，支持无窗口 `--headless` 自动拉起与动态端口重连。

---

## 架构概览

```text
Google Antigravity CLI（`agy`，官方合规主客户端）
 ├── MCP 工具与资源层（~/.gemini/config/mcp_config.json）
 │    └── $HOME/.local/bin/open-design-mcp
 │         ├── Open Design Helper.app（ELECTRON_RUN_AS_NODE=1，LSUIElement=true）
 │         ├── 动态计算 @open-design/sidecar IPC 套接字（OD_MCP_DISCOVERY）
 │         └── 连接或无窗口自动拉起 Open Design.app --headless
 └── 项目资产与上游同步层（按仓库初始化）
      ├── DESIGN.md                               （项目设计规范真源）
      ├── .agents/skills.json                     （按需 include_only 挂载 OpenDesign 技能，本地排除提交）
      ├── .agents/rules/open-design.md            （ToS 合规护栏 + 薄适配隔离边界）
      ├── .agents/skills/od-design-refine/        （五步微调与五维评审闭环）
      ├── .agents/skills/od-upstream-sync/        （上游 git 同步与合规巡检手册）
      └── scripts/od-sync-audit.mjs               （零依赖前端漂移与反 AI 套路审计脚本）
```

完整技术原理见 [docs/architecture.md](./docs/architecture.md)。

---

## 环境要求

- **macOS**，已安装 [Open Design](https://open-design.ai/) 到 `/Applications/Open Design.app`（可通过 `brew install --cask open-design` 安装，或设置 `OPEN_DESIGN_APP` 环境变量）
- 已安装并完成认证的 **Google Antigravity CLI（`agy`）**
- **Node.js** `>= 18`（用于运行 `scripts/od-sync-audit.mjs` 与 `tests/smoke.test.mjs`）

---

## 快速开始

### 1. 首次运行的 macOS Gatekeeper / TCC 权限提示（重要）

如果刚通过 Homebrew Cask 安装了 Open Design 且从未打开过，请先交互式启动**一次**：

```bash
open "/Applications/Open Design.app"
```

> **原因**：首次启动时，`Open Design.app` 会读取 `~/Downloads` 下的下载来源元数据，从而触发一次 macOS 系统 TCC 弹窗（请求访问“下载”文件夹）。在隐藏的 `--headless` 后台启动模式下，系统会阻塞该调用直到用户点击“允许”或“不允许”。交互式完成这一次确认后，后续静默 headless 自动拉起即可秒级生效。**切勿移除 `com.apple.quarantine` 或绕过 Gatekeeper。**

### 2. 安装包装命令并注册 `agy` MCP

```bash
git clone https://github.com/rholin33/agy-opendesign.git
cd agy-opendesign

# 先演练预览（不修改本机文件）
./scripts/install.sh --dry-run

# 安装 ~/.local/bin/open-design-{mcp,cli} 并执行 `agy mcp add open-design ...`
./scripts/install.sh

# 验证安装
agy mcp list
"$HOME/.local/bin/open-design-cli" tools directions --json
```

`install.sh` 支持参数：`--bin-dir <dir>`、`--app-path <path>`、`--agy-bin <path>`、`--no-mcp`、`--dry-run`。

### 3. 一键初始化任意前端仓库

```bash
./scripts/init-project.sh /path/to/your-frontend-repo
```

将在目标仓库中生成：
- `.agents/skills.json`（使用 `include_only` 按需挂载精选 OpenDesign 技能，默认写入 `.git/info/exclude` 避免将本机 macOS 路径提交到公共仓库）
- `.agents/rules/open-design.md`（ToS 合规边界与薄适配层约定）
- `.agents/skills/od-design-refine/SKILL.md`（5 步手术式视觉打磨闭环）
- `.agents/skills/od-upstream-sync/SKILL.md`（上游同步与对齐操作手册）
- `scripts/od-sync-audit.mjs`（零依赖漂移与样式规范审计脚本）
- `DESIGN.md`（仅在目标仓库不存在时生成的入门规范模板）

`init-project.sh` 支持参数：`--app-path <path>`、`--no-exclude`、`--no-design-md`、`--force`、`--dry-run`。

### 4. 上游同步与持续合规审计流程

推荐采用**薄适配隔离模式**：将结构性 UI 重构组件沉淀在 `components/redesign/`，将原始色值统一收口到独立令牌文件（`tokens.css` / `tokens.scss`），业务页面仅通过薄 props 挂载。每次执行 `git pull` / `git merge` / `git rebase` 后运行：

```bash
cd /path/to/your-frontend-repo
node scripts/od-sync-audit.mjs --strict
```

常用参数：
- `--root <dir>`：指定仓库根目录
- `--src <dir>`：指定前端源码目录（可重复；默认自动探测 `src`、`apps/*/src`、`packages/*/src`、`frontend/src`、`web/src`、`client/src`）
- `--tokens <path>`：指定令牌样式文件（默认自动识别 `**/tokens.{css,scss,less}`）
- `--redesign-dir <path>`：指定隔离重构目录（默认匹配 `**/components/redesign/**`）
- `--base <ref>`：指定 git 对比基准（默认依次探测 `@{upstream}` → `origin/main` → `origin/master` → `upstream/main` → `HEAD`）
- `--strict`：除 P0 阻断项（AI 靛蓝、未受 `@supports` 保护的 `color-mix()`、圆角卡片粗左边框、Solution B 缺失）外，对 P1 警告（令牌外原始十六进制色值、`!important`）也返回非零退出码
- `--skip-solution-b`：跳过本机 `agy`/macOS 检查（适合无头 CI）
- `--json`：输出结构化 JSON 报告

随后在仓库目录中启动本地 `agy`，调用 `$od-upstream-sync` 或 `$od-design-refine` 即可将新增上游页面无缝对齐到 `DESIGN.md`。

---

## 升级与卸载

### 升级 OpenDesign
```bash
brew upgrade --cask open-design
```
包装脚本和 `.agents/skills.json` 均动态解析 `/Applications/Open Design.app` 内稳定路径，升级后无需重新注册 `agy mcp`。若新版带有新的隔离属性，交互式运行一次 `open "/Applications/Open Design.app"` 即可。

### 卸载
```bash
./scripts/uninstall.sh --dry-run
./scripts/uninstall.sh
```

---

## 运行自检测试

```bash
node --test tests/smoke.test.mjs
```

---

## 常见问题排查

- **首次连接 MCP 超时**：先执行 `open "/Applications/Open Design.app"` 完成一次性 macOS Gatekeeper / 下载目录权限确认，再重试。
- **不启动 Electron 界面、以独立端口运行本地守护进程**：
  ```bash
  "$HOME/.local/bin/open-design-cli" daemon start --headless --port 7456
  OD_DAEMON_URL=http://127.0.0.1:7456 "$HOME/.local/bin/open-design-mcp"
  ```
- **非设计任务期间临时关闭 OpenDesign MCP**：执行 `agy mcp disable open-design`（需要时 `agy mcp enable open-design` 恢复）。
- **直接执行 `od` 出现八进制输出**：这是 macOS 系统自带的 `/usr/bin/od`，请始终改用 `open-design-cli` 或 `open-design-mcp`。

---

## 许可证

[Apache-2.0](./LICENSE)
