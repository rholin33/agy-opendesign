#!/bin/sh
set -eu

# Bootstrap any frontend git repository with Solution B OpenDesign skills, rules,
# upstream-sync audit script, and optional DESIGN.md starter.

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"

TARGET_DIR=""
APP_PATH="${OPEN_DESIGN_APP:-/Applications/Open Design.app}"
NO_EXCLUDE=0
NO_DESIGN_MD=0
FORCE=0
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: ./scripts/init-project.sh [options] [target-repo]

Bootstraps a target frontend repository with:
  - .agents/skills.json                         (curated OpenDesign skills mount)
  - .agents/rules/open-design.md                (ToS guardrails + thin-adapter rules)
  - .agents/skills/od-design-refine/SKILL.md    (5-step surgical design polish loop)
  - .agents/skills/od-upstream-sync/SKILL.md    (upstream git sync & audit playbook)
  - scripts/od-sync-audit.mjs                   (zero-dep OpenDesign compliance auditor)
  - DESIGN.md                                   (starter spec, created only if missing)
  - .git/info/exclude entry for .agents/skills.json (keeps local macOS path untracked)

Options:
  --app-path <path>   Path to Open Design.app (default: /Applications/Open Design.app)
  --no-exclude        Do not add `.agents/skills.json` to `.git/info/exclude`
  --no-design-md      Do not create starter `DESIGN.md`
  --force             Overwrite existing files (including DESIGN.md unless --no-design-md)
  --dry-run           Print planned actions without writing files
  -h, --help          Show this help message
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --app-path)
      [ $# -ge 2 ] || { printf 'Error: --app-path requires a value\n' >&2; exit 2; }
      APP_PATH="$2"; shift 2 ;;
    --app-path=*)
      APP_PATH="${1#*=}"; shift ;;
    --no-exclude)
      NO_EXCLUDE=1; shift ;;
    --no-design-md)
      NO_DESIGN_MD=1; shift ;;
    --force)
      FORCE=1; shift ;;
    --dry-run)
      DRY_RUN=1; shift ;;
    -h|--help)
      usage; exit 0 ;;
    -*)
      printf 'Error: unknown option: %s\n' "$1" >&2
      usage >&2
      exit 2 ;;
    *)
      if [ -n "$TARGET_DIR" ]; then
        printf 'Error: unexpected extra argument: %s\n' "$1" >&2
        exit 2
      fi
      TARGET_DIR="$1"; shift ;;
  esac
done

if [ -z "$TARGET_DIR" ]; then
  TARGET_DIR="."
fi

if [ ! -d "$TARGET_DIR" ]; then
  printf 'Error: target directory does not exist: %s\n' "$TARGET_DIR" >&2
  exit 1
fi

TARGET_ABS="$(CDPATH= cd -- "$TARGET_DIR" && pwd)"
OD_RESOURCES="$APP_PATH/Contents/Resources/open-design"

copy_file() {
  SRC="$1"
  DST="$2"
  MODE="$3"
  if [ -e "$DST" ] && [ "$FORCE" -eq 0 ]; then
    printf 'Skip (exists, pass --force to overwrite): %s\n' "$DST"
    return 0
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] write (%s) %s <- %s\n' "$MODE" "$DST" "$SRC"
    return 0
  fi
  mkdir -p "$(dirname -- "$DST")"
  cp "$SRC" "$DST"
  chmod "$MODE" "$DST"
  printf 'Wrote %s\n' "$DST"
}

render_skills_json() {
  TMPL="$REPO_ROOT/templates/agents/skills.json.tmpl"
  DST="$TARGET_ABS/.agents/skills.json"
  if [ -e "$DST" ] && [ "$FORCE" -eq 0 ]; then
    printf 'Skip (exists, pass --force to overwrite): %s\n' "$DST"
    return 0
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] render %s (OPEN_DESIGN_RESOURCES="%s")\n' "$DST" "$OD_RESOURCES"
    return 0
  fi
  mkdir -p "$(dirname -- "$DST")"
  if command -v node >/dev/null 2>&1; then
    node -e '
      const fs = require("node:fs");
      const [tmplPath, dstPath, resRoot] = process.argv.slice(1);
      const raw = fs.readFileSync(tmplPath, "utf8");
      const escaped = JSON.stringify(resRoot).slice(1, -1);
      const rendered = raw.replaceAll("{{OPEN_DESIGN_RESOURCES}}", escaped);
      JSON.parse(rendered);
      fs.writeFileSync(dstPath, rendered, "utf8");
    ' "$TMPL" "$DST" "$OD_RESOURCES"
  else
    ESCAPED_RES="$(printf '%s' "$OD_RESOURCES" | sed 's/[&|\\]/\\&/g')"
    sed "s|{{OPEN_DESIGN_RESOURCES}}|$ESCAPED_RES|g" "$TMPL" > "$DST"
  fi
  chmod 0644 "$DST"
  printf 'Wrote %s\n' "$DST"
}

render_skills_json
copy_file "$REPO_ROOT/templates/agents/rules/open-design.md" "$TARGET_ABS/.agents/rules/open-design.md" 0644
copy_file "$REPO_ROOT/templates/agents/skills/od-design-refine/SKILL.md" "$TARGET_ABS/.agents/skills/od-design-refine/SKILL.md" 0644
copy_file "$REPO_ROOT/templates/agents/skills/od-upstream-sync/SKILL.md" "$TARGET_ABS/.agents/skills/od-upstream-sync/SKILL.md" 0644
copy_file "$REPO_ROOT/scripts/od-sync-audit.mjs" "$TARGET_ABS/scripts/od-sync-audit.mjs" 0755

if [ "$NO_DESIGN_MD" -eq 0 ]; then
  copy_file "$REPO_ROOT/templates/DESIGN.md.example" "$TARGET_ABS/DESIGN.md" 0644
fi

if [ "$NO_EXCLUDE" -eq 0 ]; then
  EXCLUDE_FILE="$TARGET_ABS/.git/info/exclude"
  if [ -d "$TARGET_ABS/.git" ]; then
    if [ "$DRY_RUN" -eq 1 ]; then
      printf '[dry-run] ensure ".agents/skills.json" in %s\n' "$EXCLUDE_FILE"
    else
      mkdir -p "$TARGET_ABS/.git/info"
      touch "$EXCLUDE_FILE"
      if ! grep -Fxq ".agents/skills.json" "$EXCLUDE_FILE"; then
        printf '\n# Machine-local OpenDesign bundle path (added by agy-opendesign)\n.agents/skills.json\n' >> "$EXCLUDE_FILE"
        printf 'Added .agents/skills.json to %s\n' "$EXCLUDE_FILE"
      else
        printf 'Already excluded in %s: .agents/skills.json\n' "$EXCLUDE_FILE"
      fi
    fi
  else
    printf 'Note: %s is not a git repository; skipped .git/info/exclude.\n' "$TARGET_ABS"
  fi
fi

if [ "$DRY_RUN" -eq 0 ]; then
  printf '\nBootstrap complete. Next step:\n  cd "%s" && node scripts/od-sync-audit.mjs\n' "$TARGET_ABS"
fi
