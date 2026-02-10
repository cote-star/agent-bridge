#!/usr/bin/env bash
# Non-blocking freshness check for context-pack updates.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
node "$ROOT/scripts/context_pack/check_freshness.cjs" "$@"
