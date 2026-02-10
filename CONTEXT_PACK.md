# Context Pack

This repo includes a context-pack system for token-efficient agent onboarding.

## Goals
- Keep "understand the repo end-to-end" requests cheap in tokens.
- Give agents a dense, stable index before they open source files.
- Update context only when `main` changes are context-relevant.
- Keep context history recoverable without publishing it to npm or OSS.

## Storage Model
- Active pack: `.agent-context/current/` — **tracked in git** so all contributors share the same context.
- Snapshots: `.agent-context/snapshots/<timestamp>_<sha>/` — git-ignored, local-only recovery.
- Build history: `.agent-context/history.jsonl` — git-ignored, local-only audit log.

Only `current/` is committed. Snapshots and history stay local.

## Naming Convention
Inside `.agent-context/current/`:
- `00_START_HERE.md`: compact index and read order
- `10_SYSTEM_OVERVIEW.md`: architecture and command surface
- `20_CODE_MAP.md`: high-impact files and extension paths
- `30_BEHAVIORAL_INVARIANTS.md`: contract-level constraints
- `40_OPERATIONS_AND_RELEASE.md`: tests, CI, release, maintenance
- `manifest.json`: machine-readable metadata, hashes, and checksums

Numeric prefixes keep deterministic read order for agents.

## Commands
```bash
# Build/update context pack manually
npm run context-pack:build

# Install branch-aware pre-push hook
npm run context-pack:install-hooks

# Sync context pack for a main push event (used by pre-push hook)
npm run context-pack:sync-main -- --local-ref refs/heads/main --local-sha <local> --remote-ref refs/heads/main --remote-sha <remote>

# Restore latest snapshot
npm run context-pack:rollback
```

## Update Policy
- For pushes that do not target `main`: no sync.
- For pushes to `main` with non-relevant file changes: no update.
- For pushes to `main` with relevant changes: regenerate pack + snapshot.

Relevant paths include:
- command/runtime sources (`scripts/`, `cli/src/`)
- contracts (`schemas/`, `PROTOCOL.md`)
- docs that define behavior (`README.md`, `CONTRIBUTING.md`, `SKILL.md`)
- release/CI wiring (`.github/workflows/`, package metadata, Cargo metadata)
- fixture/golden data used by behavior tests
