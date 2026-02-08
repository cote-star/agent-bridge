# Video Demo Script (4-5 min)

## Audience
Engineering leads and developer-tooling users evaluating multi-agent coordination workflows.

## Goal
Show that Node and Rust implementations are interchangeable, conformant, and lightweight.

## Run of Show

### 0:00-0:30 Intro
- Show repo and one-line value proposition.
- Say: "Inter-Agent Bridge is a protocol-first toolkit for comparing agent session outputs with traceable evidence tags."

### 0:30-1:30 Read Command (Parity)
- Run Node:
```bash
bridge-node read --agent=codex --json
```
- Run Rust:
```bash
bridge read --agent codex --json
```
- Highlight equal JSON shape: `agent`, `source`, `content`, `warnings`.

### 1:30-2:30 Compare Command
- Run Node compare:
```bash
bridge-node compare --source=codex --source=gemini --source=claude --json
```
- Show findings and evidence tags.

### 2:30-3:30 Report Command from Handoff
- Run:
```bash
bridge-node report --handoff=fixtures/handoff-report.json --json
bridge report --handoff fixtures/handoff-report.json --json
```
- Explain verdict semantics and recommended actions.

### 3:30-4:15 Safety and Quality Gates
- Mention redaction behavior for tokens/keys.
- Run parity check:
```bash
bash scripts/conformance.sh
```
- Mention schema check:
```bash
bash scripts/validate_schemas.sh
```

### 4:15-5:00 Close
- Emphasize install choices:
  - Node for rapid scripting/extensibility
  - Rust for single-binary operational use
- Call to action: open issue with new agent formats and add fixtures.
