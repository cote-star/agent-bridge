# Inter-Agent Bridge

![CI Status](https://github.com/cote-star/agent-bridge/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.2.0-green.svg)

**Inter-Agent Bridge** is a lightweight local protocol and reference implementation for reading cross-agent session context. It enables AI agents (Codex, Gemini, Claude) to read each other's recent session outputs from local storage, facilitating coordination, verification, and steering without a centralized cloud service.

## 🌟 Key Tenets

1.  **Local-First**: Reads directly from local session logs (`~/.codex/sessions`, etc.) by default and does not call external services for `read`, `compare`, or `report`.
2.  **Evidence-Based**: Every claim or summary must track back to a specific source session file.
3.  **Privacy-Focused**: Automatically redacts sensitive keys (API keys, AWS tokens) before output.
4.  **Dual Parity**: Ships with both **Node.js** and **Rust** CLIs that are conformance-tested against the same output contract.

## 🎥 Demo

![Inter-Agent Bridge Demo](docs/demo.webp)

## 🏗️ Architecture

The bridge acts as a universal translator for agent session formats.

```mermaid
sequenceDiagram
    participant User
    participant BridgeCLI
    participant Codex as ~/.codex/sessions
    participant Gemini as ~/.gemini/tmp
    participant Claude as ~/.claude/projects

    User->>BridgeCLI: bridge read --agent codex --id "fix-bug"
    BridgeCLI->>Codex: Scan & Parse JSONL
    Codex-->>BridgeCLI: Raw Session Data
    BridgeCLI->>BridgeCLI: Redact Secrets (sk-..., AKIA...)
    BridgeCLI->>BridgeCLI: Format via Schema
    BridgeCLI-->>User: Structured JSON Output
```

## 🚀 Feature Matrix

| Feature            | Codex | Gemini | Claude |
| :----------------- | :---: | :----: | :----: |
| **Read Content**   |  ✅   |   ✅   |   ✅   |
| **Auto-Discovery** |  ✅   |   ✅   |   ✅   |
| **CWD Scoping**    |  ✅   |   ⚠️   |   ✅   |
| **Comparisons**    |  ✅   |   ✅   |   ✅   |

> ⚠️ Gemini resolves sessions by hashing the working directory path (SHA256) to locate chat files, rather than extracting CWD metadata from session content like Codex and Claude.

## 📦 Installation

### Consumers (After Release)

> Available after v0.2.0 is published to npm / crates.io.

**Node.js**:

```bash
npm install -g inter-agent-bridge-cli
bridge-node read --agent=codex --json
```

**Rust**:

```bash
cargo install bridge-cli
bridge read --agent codex --json
```

### Contributors (Developers)

Clone the repository to build from source.

**Node**:

```bash
npm install
node scripts/read_session.cjs read --agent=codex
```

**Rust**:

```bash
cargo run --manifest-path cli/Cargo.toml -- read --agent codex
```

## 📖 Usage

> **Note**: The examples below use the `bridge` command. If you installed via Node.js (`npm`), use `bridge-node` instead.

### Reading a Session

Get the last assistant/model output from a specific agent context.

```bash
# Read from Codex (defaults to latest session)
bridge read --agent codex

# Read from Claude, scoped to current working directory
bridge read --agent claude --cwd /path/to/project

# Get machine-readable JSON output
bridge read --agent gemini --json
```

### Comparing Agents (`analyze` mode)

Compare outputs from multiple agents to detect divergence.

```bash
bridge compare --source codex --source gemini --source claude --json
```

### Reporting

Generate a full coordination report from a handoff packet.

```bash
bridge report --handoff ./handoff_packet.json --json
```

### Protocol-Accurate Command Contract

```bash
bridge read --agent <codex|gemini|claude> [--id=<substring>] [--cwd=<path>] [--chats-dir=<path>] [--json]
bridge compare --source <agent[:session-substring]>... [--cwd=<path>] [--json]
bridge report --handoff <handoff.json> [--cwd=<path>] [--json]
```

- `read` returns the latest assistant/model output found in the selected session (or fallback raw lines when structured extraction fails).
- `compare` parses each `--source` as `<agent>` (current session) or `<agent>:<session-substring>`.
- `report` consumes a handoff packet and emits structured findings/recommendations.

## ⚙️ Configuration

Override default paths using environment variables.

| Variable                     | Description               | Default              |
| :--------------------------- | :------------------------ | :------------------- |
| `BRIDGE_CODEX_SESSIONS_DIR`  | Path to Codex sessions    | `~/.codex/sessions`  |
| `BRIDGE_GEMINI_TMP_DIR`      | Path to Gemini temp chats | `~/.gemini/tmp`      |
| `BRIDGE_CLAUDE_PROJECTS_DIR` | Path to Claude projects   | `~/.claude/projects` |

## 🛠️ Development

- **Protocol**: See [PROTOCOL.md](./PROTOCOL.md) for the CLI and JSON specification.
- **Skills**: See [SKILL.md](./SKILL.md) for agentic capabilities.
- **Release**: See [docs/release.md](./docs/release.md) for publishing workflows.

### Conformance Testing

Ensure both Node and Rust implementations return identical output for the same fixtures.

```bash
bash scripts/conformance.sh
```

### README Command Checks

Run fixture-backed checks for command examples documented in this README.

```bash
bash scripts/check_readme_examples.sh
```

### Schema Validation

Validate that generated reports match the JSON schema.

```bash
bash scripts/validate_schemas.sh
```

If your environment is offline, use:

```bash
BRIDGE_SKIP_AJV=1 bash scripts/validate_schemas.sh
```

---

_Maintained by the Agent Bridge Team._
