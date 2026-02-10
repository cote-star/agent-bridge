# Code Map

## High-Impact Paths
| Path | What | Why It Matters | Change Risk |
| --- | --- | --- | --- |
| `scripts/read_session.cjs` | Node CLI command parser + execution engine | Defines behavior for all user-facing commands in Node distribution | High |
| `scripts/adapters/*.cjs` | Node agent-specific session adapters | Session discovery, parsing, and metadata quality for each provider | High |
| `cli/src/main.rs` | Rust CLI command/arg handling | Entry-point parity with Node and release binary behavior | High |
| `cli/src/agents.rs` | Rust session parsing + redaction + read/list/search | Largest behavioral surface and most error-code paths | High |
| `cli/src/report.rs` | Rust compare/report logic | Cross-agent divergence logic and report markdown/json structure | High |
| `schemas/*.json` | JSON contract definitions | External compatibility for `--json` users and tests | High |
| `PROTOCOL.md` | Versioned protocol contract | Human contract that aligns Node, Rust, and tests | High |
| `README.md` | Public command docs and examples | User expectations and documentation-driven behavior | Medium |
| `scripts/conformance.sh` | Parity checks across implementations | Prevents silent behavior drift before release | High |
| `scripts/test_edge_cases.sh` | Edge and error-path checks | Guards hard-to-debug regressions in parse/error handling | High |
| `.github/workflows/ci.yml` | Mandatory validation workflow | Ensures checks run on push/PR | Medium |
| `.github/workflows/release.yml` | Release pipeline | Controls publish safety and artifact generation | Medium |

## Extension Recipe (New Agent)
1. Implement adapter in Rust: `cli/src/adapters/<agent>.rs` and register in `cli/src/adapters/mod.rs`.
2. Implement adapter in Node: `scripts/adapters/<agent>.cjs` and register in `scripts/adapters/registry.cjs`.
3. Add schema enum coverage in `schemas/*.json`.
4. Add fixtures and golden expectations under `fixtures/`.
5. Validate parity and edge cases through test scripts.
