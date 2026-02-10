# Operations And Release

## Standard Validation
```bash
npm run check
cargo test --manifest-path cli/Cargo.toml
```

## Main CI Checks
- `scripts/conformance.sh`
- `scripts/test_edge_cases.sh`
- `scripts/check_readme_examples.sh`
- `scripts/check_package_contents.sh`
- `scripts/validate_schemas.sh`

## Release Flow
1. Push tag `v*` to trigger `.github/workflows/release.yml`.
2. Verify phase runs conformance/docs/schema/version checks.
3. Package/publish Node artifact.
4. Build/upload Rust binaries and publish crate when tokens are configured.

## Context Pack Maintenance Contract
1. Build pack manually: `bridge context-pack build`.
2. Install branch-aware pre-push hook: `bridge context-pack install-hooks`.
3. On `main` push, hook runs `context-pack:sync-main`.
4. Sync updates the pack only when changed files are context-relevant.
5. Snapshots are saved under `.agent-context/snapshots/` for rollback/recovery.

## Rollback/Recovery
- Restore latest snapshot: `bridge context-pack rollback`
- Restore named snapshot: `bridge context-pack rollback --snapshot <snapshot_id>`
