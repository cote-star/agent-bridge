#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STORE="$ROOT/fixtures/session-store"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

run_read_case() {
  local agent="$1"
  local session_id="$2"
  local label="$3"

  local node_out="$TMP_DIR/read-${agent}-node.json"
  local rust_out="$TMP_DIR/read-${agent}-rust.json"

  local node_cmd=(node "$ROOT/scripts/read_session.cjs" read "--agent=${agent}" "--id=${session_id}" --json)
  local rust_cmd=(cargo run --quiet --manifest-path "$ROOT/cli/Cargo.toml" -- read --agent "$agent" --id "$session_id" --json)

  if [[ "$agent" == "gemini" ]]; then
    node_cmd+=("--chats-dir=$STORE/gemini/tmp/demo/chats")
    rust_cmd+=(--chats-dir "$STORE/gemini/tmp/demo/chats")
  fi

  BRIDGE_CODEX_SESSIONS_DIR="$STORE/codex/sessions" \
  BRIDGE_GEMINI_TMP_DIR="$STORE/gemini/tmp" \
  BRIDGE_CLAUDE_PROJECTS_DIR="$STORE/claude/projects" \
  "${node_cmd[@]}" > "$node_out"

  BRIDGE_CODEX_SESSIONS_DIR="$STORE/codex/sessions" \
  BRIDGE_GEMINI_TMP_DIR="$STORE/gemini/tmp" \
  BRIDGE_CLAUDE_PROJECTS_DIR="$STORE/claude/projects" \
  "${rust_cmd[@]}" > "$rust_out"

  node "$ROOT/scripts/compare_read_output.cjs" "$node_out" "$rust_out" "read-${label}"
}

run_compare_case() {
  local node_out="$TMP_DIR/compare-node.json"
  local rust_out="$TMP_DIR/compare-rust.json"

  BRIDGE_CODEX_SESSIONS_DIR="$STORE/codex/sessions" \
  BRIDGE_GEMINI_TMP_DIR="$STORE/gemini/tmp" \
  BRIDGE_CLAUDE_PROJECTS_DIR="$STORE/claude/projects" \
  node "$ROOT/scripts/read_session.cjs" compare \
    --source=codex:codex-fixture \
    --source=gemini:gemini-fixture \
    --source=claude:claude-fixture \
    --json > "$node_out"

  BRIDGE_CODEX_SESSIONS_DIR="$STORE/codex/sessions" \
  BRIDGE_GEMINI_TMP_DIR="$STORE/gemini/tmp" \
  BRIDGE_CLAUDE_PROJECTS_DIR="$STORE/claude/projects" \
  cargo run --quiet --manifest-path "$ROOT/cli/Cargo.toml" -- compare \
    --source codex:codex-fixture \
    --source gemini:gemini-fixture \
    --source claude:claude-fixture \
    --json > "$rust_out"

  node "$ROOT/scripts/compare_read_output.cjs" "$node_out" "$rust_out" "compare"
}

run_report_case() {
  local handoff="$ROOT/fixtures/handoff-report.json"
  local node_out="$TMP_DIR/report-node.json"
  local rust_out="$TMP_DIR/report-rust.json"

  BRIDGE_CODEX_SESSIONS_DIR="$STORE/codex/sessions" \
  BRIDGE_GEMINI_TMP_DIR="$STORE/gemini/tmp" \
  BRIDGE_CLAUDE_PROJECTS_DIR="$STORE/claude/projects" \
  node "$ROOT/scripts/read_session.cjs" report --handoff="$handoff" --json > "$node_out"

  BRIDGE_CODEX_SESSIONS_DIR="$STORE/codex/sessions" \
  BRIDGE_GEMINI_TMP_DIR="$STORE/gemini/tmp" \
  BRIDGE_CLAUDE_PROJECTS_DIR="$STORE/claude/projects" \
  cargo run --quiet --manifest-path "$ROOT/cli/Cargo.toml" -- report --handoff "$handoff" --json > "$rust_out"

  node "$ROOT/scripts/compare_read_output.cjs" "$node_out" "$rust_out" "report"
}

run_read_case codex codex-fixture Codex
run_read_case gemini gemini-fixture Gemini
run_read_case claude claude-fixture Claude
run_compare_case
run_report_case

echo "Conformance complete: Node and Rust outputs match for read/compare/report."
