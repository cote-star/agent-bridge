#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

existing="$(git config --get core.hooksPath 2>/dev/null || true)"
if [ -n "$existing" ] && [ "$existing" != ".githooks" ]; then
  echo "[context-pack] WARNING: core.hooksPath is already set to '$existing'"
  echo "[context-pack] Overriding to .githooks — your previous hooks path will be replaced."
fi

git config core.hooksPath .githooks
chmod +x .githooks/pre-push

echo "[context-pack] git hooks path set to .githooks"
echo "[context-pack] pre-push hook is active"
