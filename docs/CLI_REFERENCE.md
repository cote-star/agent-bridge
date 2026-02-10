# CLI Reference

Use this page for full command syntax, examples, output contracts, and operational flags.

## Command Contract

```bash
bridge read --agent <codex|gemini|claude|cursor> [--id=<substring>] [--cwd=<path>] [--chats-dir=<path>] [--last=<N>] [--json]
bridge compare --source <agent[:session-substring]>... [--cwd=<path>] [--normalize] [--json]
bridge report --handoff <handoff.json> [--cwd=<path>] [--json]
bridge list --agent <codex|gemini|claude|cursor> [--cwd=<path>] [--limit=<N>] [--json]
bridge search <query> --agent <codex|gemini|claude|cursor> [--cwd=<path>] [--limit=<N>] [--json]
bridge setup [--cwd=<path>] [--dry-run] [--force] [--context-pack] [--json]
bridge doctor [--cwd=<path>] [--json]
bridge context-pack <build|sync-main|install-hooks|rollback|check-freshness> [...]
```

## Reading a Session

```bash
# Read from Codex (defaults to latest session, last message)
bridge read --agent codex

# Read from Claude, scoped to current working directory
bridge read --agent claude --cwd /path/to/project

# Read the previous (past) Claude session
bridge list --agent claude --cwd /path/to/project --limit 2 --json
bridge read --agent claude --id "<second-session-id>" --cwd /path/to/project

# Read the last 5 assistant messages from a session
bridge read --agent codex --id "fix-bug" --last 5

# Read from Cursor
bridge read --agent cursor --json

# Get machine-readable JSON output
bridge read --agent gemini --json
```

When `--last N` is greater than 1, multiple messages are separated by `\n---\n` in the `content` field.

**JSON output includes metadata:**

```json
{
  "agent": "codex",
  "source": "/path/to/session.jsonl",
  "content": "The assistant's response...",
  "warnings": [],
  "session_id": "session-abc123",
  "cwd": "/workspace/project",
  "timestamp": "2026-01-15T10:30:00Z",
  "message_count": 12,
  "messages_returned": 1
}
```

## Listing Sessions

```bash
# List the 10 most recent Codex sessions
bridge list --agent codex --json

# Limit results
bridge list --agent claude --limit 5 --json

# Scope to a working directory
bridge list --agent codex --cwd /path/to/project --json
```

**JSON output:**

```json
[
  {
    "session_id": "session-abc123",
    "agent": "codex",
    "cwd": "/workspace/project",
    "modified_at": "2026-01-15T10:30:00Z",
    "file_path": "/home/user/.codex/sessions/2026/01/15/session-abc123.jsonl"
  }
]
```

## Searching Sessions

```bash
# Find sessions mentioning "authentication"
bridge search "authentication" --agent claude --json

# Limit results
bridge search "bug fix" --agent codex --limit 3 --json
```

## Comparing Agents

```bash
# Compare latest sessions across agents
bridge compare --source codex --source gemini --source claude --json

# Compare specific sessions
bridge compare --source codex:fix-bug --source claude:fix-bug --json

# Ignore whitespace differences
bridge compare --source codex --source gemini --normalize --json
```

The `--normalize` flag collapses all whitespace before comparison.

## Reporting

```bash
bridge report --handoff ./handoff_packet.json --json
```

## Context Pack

```bash
# Build or refresh context pack files
bridge context-pack build

# Install pre-push hook to auto-sync context pack for main pushes
bridge context-pack install-hooks

# Restore latest local snapshot
bridge context-pack rollback

# Non-blocking warning check for stale pack updates
bridge context-pack check-freshness --base origin/main
```

You can also bootstrap context-pack from setup:

```bash
bridge setup --context-pack
```

## Error Codes

When `--json` is active, errors are returned as structured JSON:

```json
{
  "error_code": "NOT_FOUND",
  "message": "No Codex session found."
}
```

| Error Code          | Meaning                            |
| :------------------ | :--------------------------------- |
| `NOT_FOUND`         | No matching session found          |
| `PARSE_FAILED`      | Session file could not be parsed   |
| `INVALID_HANDOFF`   | Malformed handoff packet           |
| `UNSUPPORTED_AGENT` | Unknown agent type                 |
| `UNSUPPORTED_MODE`  | Invalid mode in handoff            |
| `EMPTY_SESSION`     | Session exists but has no messages |
| `IO_ERROR`          | General I/O error                  |

## Configuration

Override default paths using environment variables.

| Variable                     | Description               | Default                                |
| :--------------------------- | :------------------------ | :------------------------------------- |
| `BRIDGE_CODEX_SESSIONS_DIR`  | Path to Codex sessions    | `~/.codex/sessions`                    |
| `BRIDGE_GEMINI_TMP_DIR`      | Path to Gemini temp chats | `~/.gemini/tmp`                        |
| `BRIDGE_CLAUDE_PROJECTS_DIR` | Path to Claude projects   | `~/.claude/projects`                   |
| `BRIDGE_CURSOR_DATA_DIR`     | Path to Cursor data       | `~/Library/Application Support/Cursor` |

## Redaction

The bridge automatically redacts sensitive data before output:

| Pattern               | Example Input            | Redacted Output      |
| :-------------------- | :----------------------- | :------------------- |
| OpenAI-style API keys | `sk-abc123...`           | `sk-[REDACTED]`      |
| AWS access key IDs    | `AKIA1234567890ABCDEF`   | `AKIA[REDACTED]`     |
| Bearer tokens         | `Bearer eyJhbG...`       | `Bearer [REDACTED]`  |
| Secret assignments    | `api_key="super-secret"` | `api_key=[REDACTED]` |

Redaction is applied to `api_key`, `apikey`, `token`, `secret`, and `password` assignments with `=` or `:` separators.
