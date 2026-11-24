#!/bin/sh
set -eu

# Single-line installer & uninstaller for agy-opendesign (Solution B).
#
# Install:
#   curl -fsSL https://raw.githubusercontent.com/rholin33/agy-opendesign/main/install.sh | sh
#
# Uninstall:
#   curl -fsSL https://raw.githubusercontent.com/rholin33/agy-opendesign/main/install.sh | sh -s -- --uninstall

REPO="${AGY_OPENDESIGN_REPO:-rholin33/agy-opendesign}"
REF="${AGY_OPENDESIGN_REF:-main}"
BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"
SHARE_DIR="${AGY_OPENDESIGN_HOME:-$HOME/.local/share/agy-opendesign}"
SKILLS_DIR="${SKILLS_DIR:-$HOME/.gemini/config/skills}"
APP_PATH="${OPEN_DESIGN_APP:-/Applications/Open Design.app}"
AGY_BIN="${AGY_BIN:-}"
SERVER_NAME="open-design"
SKILL_NAME="agy-opendesign"

UNINSTALL=0
DRY_RUN=0
NO_MCP=0

usage() {
  cat <<'EOF'
Usage: install.sh [options]

Installs agy-opendesign (Solution B) for Google Antigravity CLI (`agy`) on macOS:
  1. Runtime payload (`bin/`, `scripts/`, `skills/`, `templates/`) -> $HOME/.local/share/agy-opendesign
  2. Portable wrappers (`open-design-mcp`, `open-design-cli`)      -> $HOME/.local/bin
  3. Global `agy-opendesign` skill (`SKILL.md` + `references/`)    -> $HOME/.gemini/config/skills/agy-opendesign
  4. Registers `open-design` MCP server via `agy mcp add`

After installation, open ANY project in `agy` and invoke the `agy-opendesign`
skill directly — no manual per-project scripts required.

Options:
  --uninstall           Remove wrappers, global skill, share dir, and unregister MCP
  --bin-dir <dir>       Wrapper destination (default: $HOME/.local/bin)
  --share-dir <dir>     Toolkit payload dir (default: $HOME/.local/share/agy-opendesign)
  --skills-dir <dir>    Global agy skills dir (default: $HOME/.gemini/config/skills)
  --app-path <path>     Path to Open Design.app (default: /Applications/Open Design.app)
  --agy-bin <path>      Explicit path to `agy` executable
  --no-mcp              Skip `agy mcp add` / `agy mcp remove`
  --dry-run             Print planned actions without writing or deleting anything
  -h, --help            Show this help message

Environment:
  AGY_OPENDESIGN_REF    Git branch or tag to download when piped (default: main)
  AGY_OPENDESIGN_REPO   GitHub owner/repo (default: rholin33/agy-opendesign)
  AGY_OPENDESIGN_HOME   Override default --share-dir
  OPEN_DESIGN_APP       Override default --app-path
EOF
}

require_value() {
  if [ "$#" -lt 2 ] || [ -z "$2" ]; then
    printf 'Error: %s requires a value\n' "$1" >&2
    exit 2
  fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    --uninstall)
      UNINSTALL=1; shift ;;
    --bin-dir)
      require_value "$@"; BIN_DIR="$2"; shift 2 ;;
    --bin-dir=*)
      BIN_DIR="${1#*=}"; shift ;;
    --share-dir)
      require_value "$@"; SHARE_DIR="$2"; shift 2 ;;
    --share-dir=*)
      SHARE_DIR="${1#*=}"; shift ;;
    --skills-dir)
      require_value "$@"; SKILLS_DIR="$2"; shift 2 ;;
    --skills-dir=*)
      SKILLS_DIR="${1#*=}"; shift ;;
    --app-path)
      require_value "$@"; APP_PATH="$2"; shift 2 ;;
    --app-path=*)
      APP_PATH="${1#*=}"; shift ;;
    --agy-bin)
      require_value "$@"; AGY_BIN="$2"; shift 2 ;;
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

assert_safe_rm_dir() {
  TARGET="$1"
  LABEL="$2"
  case "$TARGET" in
    ""|"/"|"$HOME"|"$HOME/")
      printf 'Error: refusing to remove unsafe %s path: "%s"\n' "$LABEL" "$TARGET" >&2
      exit 1 ;;
  esac
}

run_uninstall() {
  SKILL_TARGET="$SKILLS_DIR/$SKILL_NAME"
  assert_safe_rm_dir "$SHARE_DIR" "share-dir"
  assert_safe_rm_dir "$SKILL_TARGET" "skill-dir"

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
    elif [ -e "$TARGET" ] || [ -L "$TARGET" ]; then
      rm -f "$TARGET"
      printf 'Removed %s\n' "$TARGET"
    else
      printf 'Not present: %s\n' "$TARGET"
    fi
  done

  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] rm -rf "%s"\n' "$SKILL_TARGET"
    printf '[dry-run] rm -rf "%s"\n' "$SHARE_DIR"
  else
    if [ -e "$SKILL_TARGET" ]; then
      rm -rf "$SKILL_TARGET"
      printf 'Removed global skill %s\n' "$SKILL_TARGET"
    else
      printf 'Not present: %s\n' "$SKILL_TARGET"
    fi
    if [ -e "$SHARE_DIR" ]; then
      rm -rf "$SHARE_DIR"
      printf 'Removed toolkit payload %s\n' "$SHARE_DIR"
    else
      printf 'Not present: %s\n' "$SHARE_DIR"
    fi
  fi
}

if [ "$UNINSTALL" -eq 1 ]; then
  run_uninstall
  exit 0
fi

# Locate source directory: local clone when run from disk, or GitHub tarball when piped via `curl | sh`.
SOURCE_DIR=""
TMP_DIR=""

cleanup_tmp() {
  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup_tmp EXIT INT TERM

if [ -n "${AGY_OPENDESIGN_SRC:-}" ] && [ -f "$AGY_OPENDESIGN_SRC/bin/open-design-mcp" ]; then
  SOURCE_DIR="$(CDPATH= cd -- "$AGY_OPENDESIGN_SRC" && pwd)"
elif [ -f "$0" ]; then
  CANDIDATE_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
  if [ -f "$CANDIDATE_DIR/bin/open-design-mcp" ] && [ -f "$CANDIDATE_DIR/skills/$SKILL_NAME/SKILL.md" ]; then
    SOURCE_DIR="$CANDIDATE_DIR"
  fi
fi

if [ -z "$SOURCE_DIR" ]; then
  HEAD_URL="https://github.com/$REPO/archive/refs/heads/$REF.tar.gz"
  TAG_URL="https://github.com/$REPO/archive/refs/tags/$REF.tar.gz"
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] download %s (fallback: %s)\n' "$HEAD_URL" "$TAG_URL"
    SOURCE_DIR="<downloaded-archive>"
  else
    if ! command -v curl >/dev/null 2>&1 || ! command -v tar >/dev/null 2>&1; then
      printf 'Error: `curl` and `tar` are required for remote installation.\n' >&2
      exit 1
    fi
    TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/agy-opendesign-install.XXXXXX")"
    ARCHIVE="$TMP_DIR/repo.tar.gz"
    if ! curl -fsSL "$HEAD_URL" -o "$ARCHIVE" 2>/dev/null; then
      if ! curl -fsSL "$TAG_URL" -o "$ARCHIVE"; then
        printf 'Error: failed to download %s (ref: %s)\n' "$REPO" "$REF" >&2
        exit 1
      fi
    fi
    tar -xzf "$ARCHIVE" -C "$TMP_DIR"
    for entry in "$TMP_DIR"/*; do
      if [ -d "$entry" ] && [ -f "$entry/bin/open-design-mcp" ] && [ -f "$entry/skills/$SKILL_NAME/SKILL.md" ]; then
        SOURCE_DIR="$entry"
        break
      fi
    done
    if [ -z "$SOURCE_DIR" ]; then
      printf 'Error: extracted archive did not contain expected agy-opendesign layout.\n' >&2
      exit 1
    fi
  fi
fi

if [ ! -d "$APP_PATH" ]; then
  printf 'Warning: Open Design.app not found at "%s". Install with: brew install --cask open-design\n' "$APP_PATH" >&2
fi

MCP_DST="$BIN_DIR/open-design-mcp"
CLI_DST="$BIN_DIR/open-design-cli"
SKILL_DST="$SKILLS_DIR/$SKILL_NAME"

assert_safe_rm_dir "$SHARE_DIR" "share-dir"
assert_safe_rm_dir "$SKILL_DST" "skill-dir"

if [ "$DRY_RUN" -eq 1 ]; then
  printf '[dry-run] install payload (%s/{install.sh,bin,scripts,skills,templates}) -> "%s"\n' "$SOURCE_DIR" "$SHARE_DIR"
  printf '[dry-run] mkdir -p "%s"\n' "$BIN_DIR"
  printf '[dry-run] install -m 0755 "%s/bin/open-design-mcp" "%s"\n' "$SOURCE_DIR" "$MCP_DST"
  printf '[dry-run] install -m 0755 "%s/bin/open-design-cli" "%s"\n' "$SOURCE_DIR" "$CLI_DST"
  printf '[dry-run] install global skill "%s/skills/%s" -> "%s"\n' "$SOURCE_DIR" "$SKILL_NAME" "$SKILL_DST"
else
  # 1. Toolkit runtime payload
  mkdir -p "$SHARE_DIR"
  SOURCE_ABS="$(CDPATH= cd -- "$SOURCE_DIR" && pwd)"
  SHARE_ABS="$(CDPATH= cd -- "$SHARE_DIR" && pwd)"
  if [ "$SOURCE_ABS" != "$SHARE_ABS" ]; then
    for subdir in bin scripts skills templates; do
      rm -rf "$SHARE_DIR/$subdir"
      cp -R "$SOURCE_DIR/$subdir" "$SHARE_DIR/$subdir"
    done
    if [ -f "$SOURCE_DIR/install.sh" ]; then
      cp "$SOURCE_DIR/install.sh" "$SHARE_DIR/install.sh"
    fi
  fi
  chmod 0755 \
    "$SHARE_DIR/install.sh" \
    "$SHARE_DIR/bin/open-design-mcp" \
    "$SHARE_DIR/bin/open-design-cli" \
    "$SHARE_DIR/scripts/od-sync-audit.mjs" \
    "$SHARE_DIR/scripts/init-project.sh" \
    "$SHARE_DIR/scripts/install.sh" \
    "$SHARE_DIR/scripts/uninstall.sh"
  printf 'Installed toolkit payload -> %s\n' "$SHARE_DIR"

  # 2. Wrappers in BIN_DIR
  mkdir -p "$BIN_DIR"
  cp "$SOURCE_DIR/bin/open-design-mcp" "$MCP_DST"
  cp "$SOURCE_DIR/bin/open-design-cli" "$CLI_DST"
  chmod 0755 "$MCP_DST" "$CLI_DST"
  printf 'Installed wrappers -> %s, %s\n' "$MCP_DST" "$CLI_DST"

  # 3. Global agy skill (~/.gemini/config/skills/agy-opendesign)
  mkdir -p "$SKILLS_DIR"
  rm -rf "$SKILL_DST"
  cp -R "$SOURCE_DIR/skills/$SKILL_NAME" "$SKILL_DST"
  printf 'Installed global agy skill -> %s\n' "$SKILL_DST"
fi

# 4. Register OpenDesign MCP server in agy
if [ "$NO_MCP" -eq 1 ]; then
  printf 'Skipped `agy mcp add` (--no-mcp).\n'
else
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
fi

if [ "$DRY_RUN" -eq 0 ]; then
  printf '\nDone! Open ANY project in `agy` and invoke the `%s` skill directly.\n' "$SKILL_NAME"
  printf 'Note: On a fresh Open Design install, run `open "%s"` interactively once\n' "$APP_PATH"
  printf 'to approve macOS Gatekeeper / Downloads TCC prompts before headless auto-bootstrap.\n'
fi
