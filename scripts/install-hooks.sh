#!/bin/sh
# install-hooks.sh
#
# Configures git to use the project-managed hooks in scripts/git-hooks/.
# Run once after cloning:
#
#   bash scripts/install-hooks.sh

set -e

ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$ROOT/scripts/git-hooks"

if [ ! -d "$HOOKS_DIR" ]; then
  echo "❌  Hooks directory not found: $HOOKS_DIR"
  exit 1
fi

# Make all hook files executable.
chmod +x "$HOOKS_DIR"/*

# Point git at our hooks directory instead of .git/hooks.
git config core.hooksPath "$HOOKS_DIR"

echo "✅  Git hooks installed from $HOOKS_DIR"
echo "    Active hooks:"
ls -1 "$HOOKS_DIR"
