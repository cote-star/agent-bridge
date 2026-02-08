---
name: agent-bridge
description: Bridge CLI session context across Codex, Gemini, Claude, and Cursor for verification, steering, analysis, and feedback.
---

# Agent Bridge Skill

Use this skill when the user asks to inspect, compare, or summarize activity across agents.

## Trigger Phrases

- "What is Claude doing?"
- "What did Gemini say?"
- "Compare Codex and Claude outputs."
- "Read session <id> from Cursor."

## Intent Contract

When this skill is triggered:

1. Prefer direct evidence from `bridge` commands.
2. Scope reads to the current project (`--cwd`) unless user asks otherwise.
3. If evidence is missing, report exactly what is missing.
4. Do not infer hidden context from partial data.

## Command Flow

Primary:

```bash
bridge read --agent <codex|gemini|claude|cursor> --cwd <project-path> --json
```

Support:

```bash
bridge list --agent <agent> --cwd <project-path> --json
bridge search "<query>" --agent <agent> --cwd <project-path> --json
bridge compare --source codex --source gemini --source claude --json
bridge report --handoff <handoff.json> --json
```

## Setup for New Projects

```bash
bridge setup
bridge doctor
```

- `bridge setup` writes provider snippets and managed instruction blocks.
- `bridge doctor` verifies session paths and provider instruction wiring.

## Output Quality Bar

Every cross-agent claim should include:

1. Which source session was read.
2. What evidence supports the claim.
3. Any uncertainty, missing source, or scope mismatch.
