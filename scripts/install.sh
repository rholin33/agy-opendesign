#!/bin/sh
set -eu

# Thin wrapper delegating to the root single-source installer (`../install.sh`).
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"

exec "$REPO_ROOT/install.sh" "$@"
