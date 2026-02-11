#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

TAG="${1:-}"
if [[ -z "$TAG" && "${GITHUB_REF_TYPE:-}" == "tag" ]]; then
  TAG="${GITHUB_REF_NAME:-}"
fi
NODE_VERSION="$(node -p "require('./package.json').version")"
RUST_VERSION="$(sed -n 's/^version = "\([^"]*\)"/\1/p' cli/Cargo.toml | head -n1)"

if [[ -z "$NODE_VERSION" || -z "$RUST_VERSION" ]]; then
  echo "Failed to resolve versions from package.json or cli/Cargo.toml" >&2
  exit 1
fi

if [[ "$NODE_VERSION" != "$RUST_VERSION" ]]; then
  echo "Version mismatch: package.json=$NODE_VERSION cli/Cargo.toml=$RUST_VERSION" >&2
  exit 1
fi

if [[ -n "$TAG" ]]; then
  EXPECTED_TAG="v$NODE_VERSION"
  if [[ "$TAG" != "$EXPECTED_TAG" ]]; then
    echo "Tag/version mismatch: tag=$TAG expected=$EXPECTED_TAG" >&2
    exit 1
  fi
fi

echo "Version check passed: $NODE_VERSION"
