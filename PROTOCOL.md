# Inter-Agent Bridge Protocol v0.2.0

## Purpose
Define a lightweight, local-first standard for reading and coordinating cross-agent session evidence across Codex, Gemini, and Claude.

## Tenets
1. Local-first: read local session logs only by default.
2. Evidence-based: every claim must map to source sessions.
3. Context-light: return concise structured output first.
4. Dual implementation parity: Node and Rust must follow the same command and JSON contract.

## Canonical Modes
- `verify`
- `steer`
- `analyze`
- `feedback`

## CLI Contract (v0.2)
Both implementations must support:

```bash
bridge read --agent <codex|gemini|claude> [--id=<substring>] [--cwd=<path>] [--chats-dir=<path>] [--json]
bridge compare --source <agent[:session-substring]>... [--cwd=<path>] [--json]
bridge report --handoff <path-to-handoff.json> [--cwd=<path>] [--json]
```

Rules:
1. `--cwd` defaults to current working directory when not provided.
2. If `--id` is provided, select the most recently modified session file whose path contains the substring.
3. If `--id` is not provided, select newest session scoped by cwd when possible.
4. If cwd-scoped session is missing for Codex/Claude, warn and fall back to latest global session.
5. Hard failures must exit non-zero and print a concise error.

## JSON Output Contract (`bridge read --json`)

```json
{
  "agent": "codex",
  "source": "/absolute/path/to/session-file",
  "content": "last assistant/model turn or fallback text",
  "warnings": [
    "Warning: no Codex session matched cwd /path; falling back to latest session."
  ]
}
```

Schema is defined in `schemas/read-output.schema.json`.

`bridge report --json` outputs the coordinator report object defined by `schemas/report.schema.json`.
`bridge report --handoff` consumes packets defined by `schemas/handoff.schema.json`.

## Redaction Rules
Implementations must redact likely secrets from returned content before printing:
- `sk-...` style API keys
- `AKIA...` style AWS access key IDs
- `Bearer <token>` headers
- `api_key|token|secret|password` key-value pairs

## Environment Overrides (for testing and controlled installs)
- `BRIDGE_CODEX_SESSIONS_DIR`
- `BRIDGE_GEMINI_TMP_DIR`
- `BRIDGE_CLAUDE_PROJECTS_DIR`

## Conformance
Any release must pass `scripts/conformance.sh`, which runs both implementations against shared fixtures and verifies equivalent JSON output.
