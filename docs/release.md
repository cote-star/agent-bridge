# Release and Publishing Guide

## Prerequisites
- Tag format: `vX.Y.Z`
- GitHub Actions secrets configured:
  - `NPM_TOKEN` for npm publish
  - `CARGO_REGISTRY_TOKEN` for crates.io publish
- Version sync check:
  - `bash scripts/release/verify_versions.sh <tag>`

## What Release Workflow Does
Triggered by pushing a version tag.

1. Runs verification:
- `scripts/conformance.sh`
- `scripts/validate_schemas.sh`
- `scripts/release/verify_versions.sh`

2. Packages Node CLI:
- Runs `npm pack`
- Uploads `.tgz` artifact
- Publishes to npm when `NPM_TOKEN` is present

3. Packages Rust CLI:
- Builds release binaries for Linux and macOS
- Uploads binaries as artifacts

4. Publishes crate:
- Runs `cargo publish --manifest-path cli/Cargo.toml` when `CARGO_REGISTRY_TOKEN` is present

## Manual Publish Commands
Version parity check:
```bash
bash scripts/release/verify_versions.sh v0.3.0
```

Node:
```bash
npm publish --access public
```

Rust crate:
```bash
cargo publish --manifest-path cli/Cargo.toml
```

## First Release Plan
Follow `docs/first-release-checklist.md` for the v0.3.0 public launch sequence.

## Install Commands
Node CLI from npm:
```bash
npm install -g agent-bridge
bridge-node read --agent=codex --json
```

Rust CLI from crates.io:
```bash
cargo install agent-bridge
bridge read --agent codex --json
```
