#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

git config core.hooksPath .githooks
chmod +x .githooks/pre-push

echo "[context-pack] git hooks path set to .githooks"
echo "[context-pack] pre-push hook is active"
