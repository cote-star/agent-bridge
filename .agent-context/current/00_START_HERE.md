# Context Pack: Start Here

This context pack is the first-stop index for agent work in this repository.

## Snapshot
- Repo: `agent-bridge`
- Branch at generation: `main`
- HEAD commit: `53314bf457a313522eb8e5663601658dfa574cf8`
- Node package version: `0.6.1`
- Rust crate version: `0.6.1`
- Generated at: `2026-02-11T09:25:21.665Z`

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
- .agent-context/current/00_START_HERE.md
- .agent-context/current/10_SYSTEM_OVERVIEW.md
- .agent-context/current/manifest.json
- .github/workflows/release.yml
- PROTOCOL.md
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
