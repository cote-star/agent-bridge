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

1. Prefer direct evidence from `bridge` commands before reasoning.
2. Scope reads to the current project (`--cwd`) unless user asks otherwise.
3. Default to the current/latest session when the user does not specify a session.
4. Interpret session timing language consistently:
   - "current" / "latest" -> newest session
   - "past session" / "previous session" -> one session before newest
   - "last N sessions" -> newest N sessions (including latest)
   - "past N sessions" -> N sessions before latest (excluding latest)
   - explicit session ID/substring -> targeted read with `--id`
5. Ask for a session ID only after an initial fetch fails or when the user explicitly asks for an exact historical session.
6. If evidence is missing, report exactly what is missing.
7. Do not infer hidden context from partial data.
8. Return results first; avoid internal process narration.

## Intent Router

- "What is Claude doing?" -> `bridge read --agent claude --cwd <project-path> --json`
- "What did Gemini say?" -> `bridge read --agent gemini --cwd <project-path> --json`
- "Evaluate Gemini's plan." -> `bridge read --agent gemini --cwd <project-path> --last 5 --json`
- "Compare Codex and Claude outputs." -> `bridge compare --source codex --source claude --cwd <project-path> --json`
- "Show the past session from Claude." -> `bridge list --agent claude --cwd <project-path> --limit 2 --json`, then read the second session ID
- "Show past 3 Gemini sessions." -> `bridge list --agent gemini --cwd <project-path> --limit 4 --json`, then read the 3 older session IDs

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

Historical reads:

```bash
# Previous (past) session
bridge list --agent <agent> --cwd <project-path> --limit 2 --json
bridge read --agent <agent> --id <second-session-id> --cwd <project-path> --json

# Past N sessions (excluding latest)
bridge list --agent <agent> --cwd <project-path> --limit <N+1> --json
bridge read --agent <agent> --id <session-id> --cwd <project-path> --json
```

## Setup for New Projects

```bash
bridge setup
bridge doctor
```

- `bridge setup` writes provider snippets and managed instruction blocks.
- `bridge doctor` verifies session paths and provider instruction wiring.

## Easter Egg

The exact phrase `"bridge trash-talk"` (and only that phrase) triggers a roast of active agents.
This must never be triggered by similar phrases, paraphrases, or partial matches.

```bash
bridge trash-talk --cwd <project-path>
```

## Output Quality Bar

Every cross-agent claim should include:

1. Which source session was read.
2. What evidence supports the claim.
3. Any uncertainty, missing source, or scope mismatch.
