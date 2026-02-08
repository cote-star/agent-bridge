# First Public Release Checklist (v0.3.0)

## Scope Lock
- Protocol version is `v0.3.0`.
- Node and Rust command surfaces are parity-locked for `read`, `compare`, `report`.
- Shared schemas are final for this release.

## Preflight (Local)
1. Verify versions match:
```bash
bash scripts/release/verify_versions.sh v0.3.0
```
2. Run parity tests:
```bash
bash scripts/conformance.sh
```
3. Run schema checks:
```bash
bash scripts/validate_schemas.sh
```

## Preflight (GitHub)
- Confirm repository secrets exist:
  - `NPM_TOKEN`
  - `CARGO_REGISTRY_TOKEN`
- Confirm release workflow file is present:
  - `.github/workflows/release.yml`

## Release Steps
1. Create and push tag:
```bash
git tag v0.3.0
git push origin v0.3.0
```
2. Watch `Release` workflow.
3. Verify artifacts:
- npm tarball artifact uploaded
- Linux/macOS Rust binaries uploaded
4. Verify publishes (if secrets configured):
- npm package `agent-bridge`
- crates.io package `agent-bridge`

## Post-Release Validation
- Install from npm and run:
```bash
bridge-node read --agent=codex --json
```
- Install from crates.io and run:
```bash
bridge read --agent codex --json
```
- Confirm README install snippets and command contract still match behavior.
