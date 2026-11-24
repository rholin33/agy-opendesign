# agy-opendesign

**面向 macOS 上 Google Antigravity CLI（`agy`）的一行安装、完全合规的 OpenDesign MCP 与全局 Skill 工具包（Solution B）。**

[English](./README.md) | [简体中文](./README.zh-CN.md)

---

## 一行安装

```bash
curl -fsSL https://raw.githubusercontent.com/rholin33/agy-opendesign/main/install.sh | sh
```

安装完成后，**无需在项目里手动运行任何初始化或审计脚本**。直接用 `agy` 打开**任意**前端项目，对话调用全局 **`agy-opendesign`** Skill 即可完成全流程：

- *“使用 `agy-opendesign` 结合 OpenDesign 生成 `DESIGN.md`，并用上游隔离的 `redesign/` 分层重构首页和工作流布局。”*
- *“使用 `agy-opendesign` 打磨当前页面并完成五维视觉评审。”*
- *“使用 `agy-opendesign` 同步远程 `origin/main` 更新，并将新增的上游页面对齐到 `DESIGN.md`。”*

---

## 为什么采用 Solution B？

在第三方桌面应用中反向包裹调用 `agy` 存在违反消费者 OAuth 服务条款（ToS）的风险。**Solution B** 将控制方向彻底反转：

- **官方 `agy` CLI 始终作为唯一主客户端**，负责所有代码分析、设计迁移与仓库修改，完全合规。
- **OpenDesign（`Open Design.app`）** 仅作为下游 **MCP 服务器**（`open-design`，22 个工具 + `od://` 设计系统/技能资源）和本地只读设计资产库使用。
- **内置 ToS 硬约束**：全局 Skill 与规则明确禁止通过 MCP 调用 `start_run(agent: "antigravity")`，禁止由 OpenDesign 反向拉起 `agy`。
- **零脚本全局 Skill 体验**：安装器自动将 `agy-opendesign` Skill 写入 `~/.gemini/config/skills/agy-opendesign/`，在机器上的每一个工作区自动生效；底层审计脚本与模板沉淀在 `~/.local/share/agy-opendesign/`，由 Skill 在后台透明调用，用户无需手工运行 `init-project.sh` 或 `od-sync-audit.mjs`。
- **macOS 工程化加固**：
  - 提供不冲突的 `open-design-mcp` / `open-design-cli` 包装脚本，规避 macOS `/usr/bin/od` 同名覆盖问题。
  - 使用 `Open Design Helper.app` + `ELECTRON_RUN_AS_NODE=1`（`LSUIElement=true` 无 Dock 图标跳动、原生 Node ABI 一致、不依赖 `nvm`/`PATH`）。
  - 通过官方 `agy mcp add` 写入 `~/.gemini/config/mcp_config.json`（绕开 OpenDesign 内置安装器误写旧路径 `~/.gemini/antigravity/mcp_config.json` 的缺陷）。
  - 运行时动态通过 `@open-design/sidecar` 计算 Unix IPC 发现套接字，支持无窗口 `--headless` 自动拉起与动态端口重连。

---

## 架构概览

```text
Google Antigravity CLI（`agy`，官方合规主客户端）
 ├── 全局 Skill 层（~/.gemini/config/skills/agy-opendesign/）
 │    ├── SKILL.md                          （全流程编排：预检、MCP 选型、薄适配重构、五维评审、上游同步）
 │    └── references/                       （upstream-sync.md、critique-checklist.md、design-md-template.md）
 ├── MCP 工具与资源层（~/.gemini/config/mcp_config.json）
 │    └── $HOME/.local/bin/open-design-mcp
 │         ├── Open Design Helper.app（ELECTRON_RUN_AS_NODE=1，LSUIElement=true）
 │         ├── 动态计算 @open-design/sidecar IPC 套接字（OD_MCP_DISCOVERY）
 │         └── 连接或无窗口自动拉起 Open Design.app --headless
 └── 内部工具载荷层（~/.local/share/agy-opendesign/）
      ├── scripts/od-sync-audit.mjs         （零依赖漂移与反 AI 套路审计器，由 Skill 透明调用）
      ├── templates/                        （Skill 参考模板）
      └── bin/                              （包装脚本源）
```

完整技术原理见 [docs/architecture.md](./docs/architecture.md)。

---

## 环境要求

- **macOS**，已安装 [Open Design](https://open-design.ai/) 到 `/Applications/Open Design.app`（可通过 `brew install --cask open-design` 安装，或使用 `--app-path`）
- 已安装并完成认证的 **Google Antigravity CLI（`agy`）**
- **Node.js** `>= 18`

### 首次运行的 macOS Gatekeeper / TCC 权限提示（重要）

如果刚通过 Homebrew Cask 安装了 Open Design 且从未打开过，请先交互式启动**一次**：

```bash
open "/Applications/Open Design.app"
```

> 首次启动时，`Open Design.app` 会读取 `~/Downloads` 下的下载来源元数据，触发一次 macOS 隐私弹窗（请求访问“下载”文件夹）。在隐藏的 `--headless` 后台启动模式下，系统会阻塞该调用直到确认。交互式完成这一次确认（允许或不允许均可）后，后续静默 headless 自动拉起即可秒级生效。**切勿移除 `com.apple.quarantine` 或绕过 Gatekeeper。**

---

## 安装选项、升级与卸载

### 预览或自定义安装
```bash
# 演练预览（不修改本机文件）
curl -fsSL https://raw.githubusercontent.com/rholin33/agy-opendesign/main/install.sh | sh -s -- --dry-run

# 指定分支或标签
curl -fsSL https://raw.githubusercontent.com/rholin33/agy-opendesign/main/install.sh | AGY_OPENDESIGN_REF=main sh

# 本地克隆或自定义路径
./install.sh --bin-dir "$HOME/.local/bin" --share-dir "$HOME/.local/share/agy-opendesign" --skills-dir "$HOME/.gemini/config/skills" --app-path "/Applications/Open Design.app"
```

支持参数：`--uninstall`、`--dry-run`、`--bin-dir <dir>`、`--share-dir <dir>`、`--skills-dir <dir>`、`--app-path <path>`、`--agy-bin <path>`、`--no-mcp`。

### 升级 OpenDesign
```bash
brew upgrade --cask open-design
```
包装脚本和动态 sidecar 发现均指向 `Open Design.app` 内的稳定路径，升级后无需重新注册 `agy mcp`。若新版带有新的隔离属性，交互式运行一次 `open "/Applications/Open Design.app"` 即可。

### 一行卸载
```bash
curl -fsSL https://raw.githubusercontent.com/rholin33/agy-opendesign/main/install.sh | sh -s -- --uninstall
```
将清理 `~/.local/bin/open-design-{mcp,cli}`、`~/.gemini/config/skills/agy-opendesign/`、`~/.local/share/agy-opendesign/` 并从 `agy` 注销 `open-design` MCP。

---

## 常见问题排查与高级用法

- **首次连接 MCP 超时**：先执行 `open "/Applications/Open Design.app"` 完成一次性 macOS Gatekeeper / 下载目录权限确认，再重试。
- **非设计任务期间临时关闭 OpenDesign MCP**：执行 `agy mcp disable open-design`（需要时用 `agy mcp enable open-design` 恢复）。
- **独立固定端口守护进程模式（不启动 Electron 界面）**：
  ```bash
  "$HOME/.local/bin/open-design-cli" daemon start --headless --port 7456
  OD_DAEMON_URL=http://127.0.0.1:7456 "$HOME/.local/bin/open-design-mcp"
  ```
- **直接运行 `od` 输出八进制字节**：这是 macOS 自带的 `/usr/bin/od`，请始终改用 `open-design-cli` 或 `open-design-mcp`。
- **内部工具说明**：`scripts/od-sync-audit.mjs` 与 `scripts/init-project.sh` 保留在 `~/.local/share/agy-opendesign/scripts/` 下供 Skill 透明调用或 CI 集成，日常交互无需用户手动执行。

---

## 运行自检测试

```bash
node --test tests/smoke.test.mjs
```

---

## 许可证

[Apache-2.0](./LICENSE)
