#!/usr/bin/env bash
# Warns (non-blocking) if a PR touches context-relevant paths but the context
# pack was not updated in the same changeset. Uses the same relevance rules as
# sync_main.cjs (see isContextRelevant).
set -euo pipefail

base="${1:-origin/main}"

changed_files="$(git diff --name-only "$base"...HEAD 2>/dev/null || git diff --name-only HEAD~1)"

relevant=()
pack_touched=false

for f in $changed_files; do
  # Skip non-relevant paths (mirrors isContextRelevant in sync_main.cjs)
  case "$f" in
    blog/*|notes/*|drafts/*|scratch/*|tmp/*|.agent-context/*|docs/demo-*) continue ;;
  esac

  # Check if context pack was updated
  if [[ "$f" == .agent-context/current/* ]]; then
    pack_touched=true
    continue
  fi

  # Check if file is context-relevant
  case "$f" in
    README.md|PROTOCOL.md|CONTRIBUTING.md|SKILL.md|AGENTS.md) relevant+=("$f") ;;
    package.json|package-lock.json|cli/Cargo.toml|cli/Cargo.lock) relevant+=("$f") ;;
    docs/architecture.svg|docs/silo-tax-before-after.webp) relevant+=("$f") ;;
    scripts/*|cli/src/*|schemas/*|fixtures/golden/*|fixtures/session-store/*|.github/workflows/*) relevant+=("$f") ;;
  esac
done

if [ ${#relevant[@]} -eq 0 ]; then
  echo "PASS context-pack-freshness (no context-relevant files changed)"
  exit 0
fi

if [ "$pack_touched" = true ]; then
  echo "PASS context-pack-freshness (context pack was updated)"
  exit 0
fi

echo "WARNING: ${#relevant[@]} context-relevant file(s) changed but .agent-context/current/ was not updated:"
for f in "${relevant[@]}"; do
  echo "  - $f"
done
echo ""
echo "Consider running: npm run context-pack:build"
# Non-blocking — exit 0 so CI doesn't fail
exit 0
