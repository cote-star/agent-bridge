# System Overview

## Product Shape
- Package version: `0.6.2`
- Crate version: `0.6.2`
- Tracked files: `103`
- Delivery: npm package (`bridge`) + Rust binary (`bridge`).

## Runtime Architecture
1. User asks a provider agent for cross-agent status.
2. Agent invokes bridge command (`read`, `list`, `search`, `compare`, `report`, `setup`, `doctor`, `trash-talk`, `context-pack`).
3. Bridge resolves session stores (Codex/Claude/Gemini/Cursor), applies redaction, and returns terminal text or JSON.
4. Agent answers user with evidence from bridge output.

## Dual-Implementation Contract
- Node path: `scripts/read_session.cjs` + `scripts/adapters/*.cjs`.
- Rust path: `cli/src/main.rs`, `cli/src/agents.rs`, `cli/src/report.rs`, `cli/src/adapters/*.rs`.
- Protocol authority: `PROTOCOL.md` and `schemas/*.json`.
- Parity guard: `scripts/conformance.sh`.

## Command Surface
| Command | Intent | Primary Paths |
| --- | --- | --- |
| `read` | Read latest or selected session content | `scripts/read_session.cjs`, `cli/src/main.rs`, `cli/src/agents.rs` |
| `list` | List recent sessions by agent | `scripts/read_session.cjs`, `cli/src/agents.rs` |
| `search` | Find sessions containing text | `scripts/read_session.cjs`, `cli/src/agents.rs` |
| `compare` | Compare multiple agent outputs | `scripts/read_session.cjs`, `cli/src/report.rs` |
| `report` | Build coordinator report from handoff JSON | `scripts/read_session.cjs`, `cli/src/report.rs` |
| `setup` | Write provider instruction wiring files | `scripts/read_session.cjs` |
| `doctor` | Check setup and path wiring | `scripts/read_session.cjs` |
| `trash-talk` | Roast active agents from session content | `scripts/read_session.cjs`, `cli/src/agents.rs` |
| `context-pack` | Build/sync/install context-pack automation | `scripts/read_session.cjs`, `scripts/context_pack` |

## Tracked Path Density
- scripts: 24 tracked files
- cli/src: 10 tracked files
- schemas: 5 tracked files
- fixtures: 31 tracked files
- .github/workflows: 2 tracked files
- docs: 10 tracked files
