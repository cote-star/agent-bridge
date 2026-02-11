# Context Pack: Start Here

This context pack is the first-stop index for agent work in this repository.

## Snapshot
- Repo: `agent-bridge`
- Branch at generation: `main`
- HEAD commit: `6ac675f00b894dc9c9bee5a20d1bbdb71226bc97`
- Node package version: `0.6.2`
- Rust crate version: `0.6.2`
- Generated at: `2026-02-11T11:10:06.703Z`

## Read Order (Token-Efficient)
1. Read this file.
2. Read `10_SYSTEM_OVERVIEW.md` for architecture and execution paths.
3. Read `30_BEHAVIORAL_INVARIANTS.md` before changing behavior.
4. Use `20_CODE_MAP.md` to deep dive only relevant files.
5. Use `40_OPERATIONS_AND_RELEASE.md` for tests, release, and maintenance.

## Fast Facts
- Product: Local-first cross-agent session bridge CLI.
- Implementations: Node (`scripts/read_session.cjs`) and Rust (`cli/src/main.rs`).
- Quality gate: Node/Rust parity + schema validation + edge-case checks.
- Core risk: behavior drift between Node and Rust command/output contracts.

## Last Change Range Input
- README.md
- RELEASE_NOTES.md
- cli/Cargo.lock
- cli/Cargo.toml
- package-lock.json
- package.json

## Scope Rule
For "understand this repo end-to-end" requests:
- Start with this pack only.
- Open source files only after this pack identifies a precise target.
- Treat this pack as the source of navigation and invariants.
