# Behavioral Invariants

These constraints are contract-level and must be preserved unless intentionally versioned.

## Core Protocol Invariants
1. `read`, `list`, `search`, `compare`, and `report` must align with `PROTOCOL.md`.
2. Node and Rust outputs must remain behaviorally equivalent for shared commands.
3. `--json` failures must emit structured error JSON with stable error codes.
4. Secret-like tokens must be redacted before output.
5. Session selection defaults: latest scoped session first, then documented fallback behavior.

## Session Semantics
1. "current/latest" means newest session.
2. "past/previous session" means one session before newest.
3. `read --last N` returns last N assistant messages joined by `\n---\n`.
4. CWD scoping applies where provider data supports it.

## Update Checklist Before Merging Behavior Changes
1. Update code in both Node and Rust paths when command semantics change.
2. Update schema files for JSON shape changes.
3. Update `README.md` and `PROTOCOL.md` for public contract changes.
4. Update fixtures/golden outputs.
5. Run conformance, edge-case, and schema validation scripts.
