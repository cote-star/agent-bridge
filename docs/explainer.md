# Agent Bridge Explainer

Agent Bridge standardizes how one agent reads and evaluates outputs from other agents. It separates concerns into:

1. Protocol: contract for modes, evidence tags, and report structure.
2. Implementations: Node and Rust CLIs that follow the same behavior.
3. Quality gates: conformance and schema validation over shared fixtures.

## Why this matters
Without a protocol, cross-agent reviews drift into ad hoc summaries. This project enforces structured outputs so verification, steering, and analysis are reproducible.

## Design Principles
- Local-first: reads local session stores.
- Lightweight: no daemon, no telemetry, small command surface.
- Dual implementation parity: users choose runtime, not behavior.
- Evidence-first: findings tie back to source tags.

## Command Surface
- `read`: pull the latest or targeted source turn.
- `compare`: generate an analyze-mode report across sources.
- `report`: generate mode-specific report from a handoff packet.
- `list`: enumerate recent sessions for an agent (with optional cwd scoping).
- `search`: find sessions containing a keyword (with optional cwd scoping).

## Safety
Returned content is redacted for likely secrets (API keys, bearer tokens, key-value credentials).

## Validation
- `scripts/conformance.sh`: Node vs Rust output parity.
- `scripts/validate_schemas.sh`: schema validation for handoff and generated outputs.
