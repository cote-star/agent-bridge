---
name: inter-agent-bridge
description: Bridge CLI session context across Codex, Gemini, and Claude for verification, steering, analysis, and feedback. Use when users refer to another agent's output, prior sessions, or cross-agent handoff.
---

# Inter-Agent Bridge

This skill helps one agent evaluate and steer other agents by sharing CLI session context and enforcing a common review protocol.

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

To retrieve the latest output or a specific session from Codex:

1.  **Latest Session**:
    ```bash
    node scripts/read_session.cjs --agent=codex
    ```
2.  **Specific Session (by ID/UUID)**:
    ```bash
    node scripts/read_session.cjs --agent=codex --id=<session_uuid>
    ```

### Reading Gemini Sessions

To retrieve the history of a Gemini session (including the current one or previous ones in the same project):

1.  **Identify Chats Directory**:
    - Locate the **Project Temporary Directory** provided in your system prompt (e.g., `/Users/user/.gemini/tmp/<hash>`).
    - Append `/chats` to this path.
    
2.  **Latest Session**:
    ```bash
    node scripts/read_session.cjs --agent=gemini --chats-dir=<path_to_chats_dir>
    ```
3.  **Specific Session**:
    ```bash
    node scripts/read_session.cjs --agent=gemini --chats-dir=<path_to_chats_dir> --id=<session_id>
    ```

### Reading Claude Sessions

To retrieve the latest output or a specific session from Claude Code:

1.  **Latest Session**:
    ```bash
    node scripts/read_session.cjs --agent=claude
    ```
2.  **Specific Session (by ID/UUID)**:
    ```bash
    node scripts/read_session.cjs --agent=claude --id=<session_uuid>
    ```

Claude sessions are stored as JSONL files under `~/.claude/projects/<project-hash>/`. The parser finds the most recently modified `.jsonl` file and extracts the last assistant message.

## Output

The parser script outputs the last assistant turn (or a fallback summary) to `stdout`.
Your final response should follow the structured format in `references/universal-coordinator.md`, with evidence tags per source and actionable next actions.
