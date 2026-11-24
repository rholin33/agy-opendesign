#!/bin/sh
set -eu

# Install open-design-mcp and open-design-cli wrappers and register OpenDesign MCP in `agy`.

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"

BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"
APP_PATH="${OPEN_DESIGN_APP:-/Applications/Open Design.app}"
SERVER_NAME="open-design"
DRY_RUN=0
NO_MCP=0
AGY_BIN="${AGY_BIN:-}"

usage() {
  cat <<'EOF'
Usage: ./scripts/install.sh [options]

Installs portable macOS wrappers (`open-design-mcp`, `open-design-cli`) and
registers the `open-design` MCP server with Google Antigravity CLI (`agy`).

Options:
  --bin-dir <dir>     Destination directory for wrappers (default: $HOME/.local/bin)
  --app-path <path>   Path to Open Design.app (default: /Applications/Open Design.app)
  --agy-bin <path>    Explicit path to `agy` executable
  --no-mcp            Install wrapper binaries only; skip `agy mcp add`
  --dry-run           Print planned actions without writing files or modifying config
  -h, --help          Show this help message
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --bin-dir)
      [ $# -ge 2 ] || { printf 'Error: --bin-dir requires a value\n' >&2; exit 2; }
      BIN_DIR="$2"; shift 2 ;;
    --bin-dir=*)
      BIN_DIR="${1#*=}"; shift ;;
    --app-path)
      [ $# -ge 2 ] || { printf 'Error: --app-path requires a value\n' >&2; exit 2; }
      APP_PATH="$2"; shift 2 ;;
    --app-path=*)
      APP_PATH="${1#*=}"; shift ;;
    --agy-bin)
      [ $# -ge 2 ] || { printf 'Error: --agy-bin requires a value\n' >&2; exit 2; }
      AGY_BIN="$2"; shift 2 ;;
    --agy-bin=*)
      AGY_BIN="${1#*=}"; shift ;;
    --no-mcp)
      NO_MCP=1; shift ;;
    --dry-run)
      DRY_RUN=1; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      printf 'Error: unknown option: %s\n' "$1" >&2
      usage >&2
      exit 2 ;;
  esac
done

resolve_agy_bin() {
  if [ -n "$AGY_BIN" ]; then
    printf '%s\n' "$AGY_BIN"
    return 0
  fi
  if command -v agy >/dev/null 2>&1; then
    command -v agy
    return 0
  fi
  if [ -x "$HOME/.local/bin/agy" ]; then
    printf '%s\n' "$HOME/.local/bin/agy"
    return 0
  fi
  return 1
}

MCP_SRC="$REPO_ROOT/bin/open-design-mcp"
CLI_SRC="$REPO_ROOT/bin/open-design-cli"
MCP_DST="$BIN_DIR/open-design-mcp"
CLI_DST="$BIN_DIR/open-design-cli"

if [ ! -f "$MCP_SRC" ] || [ ! -f "$CLI_SRC" ]; then
  printf 'Error: wrapper sources not found under %s/bin\n' "$REPO_ROOT" >&2
  exit 1
fi

if [ ! -d "$APP_PATH" ]; then
  printf 'Warning: Open Design.app not found at "%s". Install with: brew install --cask open-design\n' "$APP_PATH" >&2
fi

if [ "$DRY_RUN" -eq 1 ]; then
  printf '[dry-run] mkdir -p "%s"\n' "$BIN_DIR"
  printf '[dry-run] install -m 0755 "%s" "%s"\n' "$MCP_SRC" "$MCP_DST"
  printf '[dry-run] install -m 0755 "%s" "%s"\n' "$CLI_SRC" "$CLI_DST"
else
  mkdir -p "$BIN_DIR"
  cp "$MCP_SRC" "$MCP_DST"
  cp "$CLI_SRC" "$CLI_DST"
  chmod 0755 "$MCP_DST" "$CLI_DST"
  printf 'Installed %s\n' "$MCP_DST"
  printf 'Installed %s\n' "$CLI_DST"
fi

if [ "$NO_MCP" -eq 1 ]; then
  printf 'Skipped `agy mcp add` (--no-mcp).\n'
  exit 0
fi

RESOLVED_AGY=""
if RESOLVED_AGY="$(resolve_agy_bin)"; then
  :
else
  if [ "$DRY_RUN" -eq 1 ]; then
    RESOLVED_AGY="agy"
  else
    printf 'Error: `agy` CLI not found on PATH or at $HOME/.local/bin/agy. Pass --agy-bin or --no-mcp.\n' >&2
    exit 1
  fi
fi

if [ "$APP_PATH" != "/Applications/Open Design.app" ]; then
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] "%s" mcp add --env "OPEN_DESIGN_APP=%s" "%s" "%s"\n' "$RESOLVED_AGY" "$APP_PATH" "$SERVER_NAME" "$MCP_DST"
  else
    "$RESOLVED_AGY" mcp add --env "OPEN_DESIGN_APP=$APP_PATH" "$SERVER_NAME" "$MCP_DST"
  fi
else
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] "%s" mcp add "%s" "%s"\n' "$RESOLVED_AGY" "$SERVER_NAME" "$MCP_DST"
  else
    "$RESOLVED_AGY" mcp add "$SERVER_NAME" "$MCP_DST"
  fi
fi

if [ "$DRY_RUN" -eq 0 ]; then
  printf '\nVerify registration:\n  %s mcp list\n' "$RESOLVED_AGY"
  printf 'Note: On a fresh Homebrew Cask install, launch Open Design.app interactively once\n'
  printf '(`open "%s"`) to clear macOS Gatekeeper / Downloads TCC prompts.\n' "$APP_PATH"
fi
