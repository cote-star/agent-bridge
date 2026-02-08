# Inter-Agent Bridge

Inter-Agent Bridge is a lightweight protocol and reference implementation for reading cross-agent session context from Codex, Gemini, and Claude.

This repository ships two conformant implementations:
- Node CLI (`bridge-node`)
- Rust CLI (`bridge`)

Both are required to produce the same JSON output contract for `read`.

## Protocol
- Spec: `PROTOCOL.md`
- Schemas: `schemas/`

## Quick Start

### Node (local)
```bash
npm install
node scripts/read_session.cjs --agent=codex
node scripts/read_session.cjs --agent=gemini --json
```

Optional global install:
```bash
npm link
bridge-node read --agent=claude --json
```

### Rust (local)
```bash
cargo run --manifest-path cli/Cargo.toml -- read --agent codex
cargo run --manifest-path cli/Cargo.toml -- read --agent gemini --json
```

Optional install:
```bash
cargo install --path cli
bridge read --agent claude --json
```

### Published Installs
Node package:
```bash
npm install -g inter-agent-bridge-cli
bridge-node read --agent=codex --json
```

Rust crate:
```bash
cargo install bridge-cli
bridge read --agent codex --json
```

## Command Contract
```bash
bridge read --agent <codex|gemini|claude> [--id=<substring>] [--cwd=<path>] [--chats-dir=<path>] [--json]
bridge compare --source <agent[:session-substring]>... [--cwd=<path>] [--json]
bridge report --handoff <handoff.json> [--cwd=<path>] [--json]
```

## JSON Output
```json
{
  "agent": "codex",
  "source": "/absolute/path/to/session",
  "content": "last assistant/model output",
  "warnings": []
}
```

`bridge report --json` returns the schema in `schemas/report.schema.json`.

## Environment Overrides
Useful for tests, sandboxing, and non-default layouts:
- `BRIDGE_CODEX_SESSIONS_DIR`
- `BRIDGE_GEMINI_TMP_DIR`
- `BRIDGE_CLAUDE_PROJECTS_DIR`

## Redaction
Both implementations redact likely secrets in extracted content before output:
- `sk-...` keys
- `AKIA...` keys
- bearer tokens
- key-value secrets (`api_key`, `token`, `secret`, `password`)

## Conformance
Run shared fixture parity checks:
```bash
bash scripts/conformance.sh
```

This verifies Node and Rust return equivalent JSON for the same fixture sessions and commands.

Schema checks (handoff + generated outputs):
```bash
bash scripts/validate_schemas.sh
```

## Repository Layout
- `scripts/read_session.cjs`: Node implementation
- `cli/`: Rust implementation
- `fixtures/session-store/`: shared test fixtures
- `schemas/`: protocol schemas
- `references/`: coordinator behavior guidance

## Release and Media
- Release workflow and publish guide: `docs/release.md`
- First public launch checklist: `docs/first-release-checklist.md`
- Demo storyboard/script: `docs/video-demo.md`
- Product explainer: `docs/explainer.md`
