---
name: inter-agent-bridge
description: Bridge CLI session context across Codex, Gemini, and Claude for verification, steering, analysis, and feedback. Trigger for prompts like "what's Claude doing", "what did Gemini/Codex say", "check other window output", "read previous session", "compare agent outputs", or when a session UUID is provided.
---

# Inter-Agent Bridge

This skill helps one agent evaluate and steer other agents by sharing CLI session context and enforcing a common review protocol.

## Trigger Examples

Use this skill immediately when the user asks things like:

- "What's Claude doing?"
- "What did Gemini say in the other window?"
- "Show me Codex output from previous session."
- "Compare Claude and Codex outputs."

For "what is X doing now?" requests, first read the latest session for that agent (scoped by `cwd` when available) before answering.

## Universal Protocol First

Before reading any session logs, load:

- `references/universal-coordinator.md` for the canonical instruction and output contract.
- `references/test-prompts.md` for scenario prompts that pressure-test verify/steer/analyze/feedback modes.

Use that protocol as the default response behavior, even when only one source is available.

## Mode Contract

Always require or infer:

- `mode`: `verify` | `steer` | `analyze` | `feedback`
- `task`: objective and success criteria
- `sources`: one or more agents with `session_id` or `current_session=true`
- `constraints`: optional guardrails (tests required, API compatibility, risk tolerance, deadlines)

If any critical field is missing, ask only for missing fields and keep the request minimal.

## Usage

### Reading Codex Sessions

To retrieve output from Codex (Node reference implementation):

1.  **Latest Session Scoped To Current CWD (default)**:
    ```bash
    node scripts/read_session.cjs --agent=codex
    ```
2.  **Latest Session For Explicit Project Path**:
    ```bash
    node scripts/read_session.cjs --agent=codex --cwd=<project_path>
    ```
3.  **Specific Session (by ID/UUID)**:
    ```bash
    node scripts/read_session.cjs --agent=codex --id=<session_uuid>
    ```

### Reading Gemini Sessions

To retrieve the history of a Gemini session (Node reference implementation):

1.  **Latest Session Scoped To Current CWD (default)**:
    ```bash
    node scripts/read_session.cjs --agent=gemini
    ```
2.  **Specific Session By ID (auto-discovered from known chat dirs)**:
    ```bash
    node scripts/read_session.cjs --agent=gemini --id=<session_id>
    ```
3.  **Explicit Chats Directory**:
    ```bash
    node scripts/read_session.cjs --agent=gemini --chats-dir=<path_to_chats_dir>
    ```
4.  **Specific Session In Explicit Directory**:
    ```bash
    node scripts/read_session.cjs --agent=gemini --chats-dir=<path_to_chats_dir> --id=<session_id>
    ```
5.  **Scope To Explicit Project Path**:
    ```bash
    node scripts/read_session.cjs --agent=gemini --cwd=<project_path>
    ```

Gemini project chat folders are auto-resolved from `sha256(<cwd>)` at `~/.gemini/tmp/<project_hash>/chats`.

### Reading Claude Sessions

To retrieve output from Claude Code (Node reference implementation):

1.  **Latest Session Scoped To Current CWD (default)**:
    ```bash
    node scripts/read_session.cjs --agent=claude
    ```
2.  **Latest Session For Explicit Project Path**:
    ```bash
    node scripts/read_session.cjs --agent=claude --cwd=<project_path>
    ```
3.  **Specific Session (by ID/UUID)**:
    ```bash
    node scripts/read_session.cjs --agent=claude --id=<session_uuid>
    ```

Claude sessions are stored as JSONL files under `~/.claude/projects/<project-hash>/`. The parser finds the most recently modified `.jsonl` file and extracts the last assistant message.

### Alternative Rust CLI

The Rust reference implementation (`cli/`) supports the same `read` objective and JSON contract:

```bash
cargo run --manifest-path cli/Cargo.toml -- read --agent codex --json
```

## Output

The parser script outputs the last assistant turn (or a fallback summary) to `stdout`.
For hard failures (missing sessions, parse errors, unsupported schema), it exits non-zero.
Your final response should follow the structured format in `references/universal-coordinator.md`, with evidence tags per source and actionable next actions.
