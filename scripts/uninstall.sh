#!/bin/sh
set -eu

# Remove open-design-mcp and open-design-cli wrappers and unregister OpenDesign MCP from `agy`.

BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"
SERVER_NAME="open-design"
DRY_RUN=0
NO_MCP=0
AGY_BIN="${AGY_BIN:-}"

usage() {
  cat <<'EOF'
Usage: ./scripts/uninstall.sh [options]

Unregisters the `open-design` MCP server from `agy` and removes
`open-design-mcp` and `open-design-cli` from the target bin directory.

Options:
  --bin-dir <dir>     Directory where wrappers were installed (default: $HOME/.local/bin)
  --agy-bin <path>    Explicit path to `agy` executable
  --no-mcp            Remove wrapper binaries only; skip `agy mcp remove`
  --dry-run           Print planned actions without removing files or modifying config
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

if [ "$NO_MCP" -eq 0 ]; then
  if RESOLVED_AGY="$(resolve_agy_bin)"; then
    if [ "$DRY_RUN" -eq 1 ]; then
      printf '[dry-run] "%s" mcp remove "%s"\n' "$RESOLVED_AGY" "$SERVER_NAME"
    else
      "$RESOLVED_AGY" mcp remove "$SERVER_NAME" || printf 'Note: MCP server "%s" was not registered.\n' "$SERVER_NAME"
    fi
  else
    if [ "$DRY_RUN" -eq 1 ]; then
      printf '[dry-run] agy mcp remove "%s"\n' "$SERVER_NAME"
    else
      printf 'Note: `agy` CLI not found; skipped MCP unregistration.\n' >&2
    fi
  fi
fi

for name in open-design-mcp open-design-cli; do
  TARGET="$BIN_DIR/$name"
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] rm -f "%s"\n' "$TARGET"
  else
    if [ -e "$TARGET" ] || [ -L "$TARGET" ]; then
      rm -f "$TARGET"
      printf 'Removed %s\n' "$TARGET"
    else
      printf 'Not present: %s\n' "$TARGET"
    fi
  fi
done
