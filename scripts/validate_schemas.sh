#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STORE="$ROOT/fixtures/session-store"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

read_node_json="$TMP_DIR/read-node.json"
read_rust_json="$TMP_DIR/read-rust.json"
report_node_json="$TMP_DIR/report-node.json"
report_rust_json="$TMP_DIR/report-rust.json"
compare_node_json="$TMP_DIR/compare-node.json"
compare_rust_json="$TMP_DIR/compare-rust.json"

BRIDGE_CODEX_SESSIONS_DIR="$STORE/codex/sessions" \
BRIDGE_GEMINI_TMP_DIR="$STORE/gemini/tmp" \
BRIDGE_CLAUDE_PROJECTS_DIR="$STORE/claude/projects" \
node "$ROOT/scripts/read_session.cjs" read --agent=codex --id=codex-fixture --json > "$read_node_json"

BRIDGE_CODEX_SESSIONS_DIR="$STORE/codex/sessions" \
BRIDGE_GEMINI_TMP_DIR="$STORE/gemini/tmp" \
BRIDGE_CLAUDE_PROJECTS_DIR="$STORE/claude/projects" \
cargo run --quiet --manifest-path "$ROOT/cli/Cargo.toml" -- read --agent codex --id codex-fixture --json > "$read_rust_json"

BRIDGE_CODEX_SESSIONS_DIR="$STORE/codex/sessions" \
BRIDGE_GEMINI_TMP_DIR="$STORE/gemini/tmp" \
BRIDGE_CLAUDE_PROJECTS_DIR="$STORE/claude/projects" \
node "$ROOT/scripts/read_session.cjs" report --handoff="$ROOT/fixtures/handoff-report.json" --json > "$report_node_json"

BRIDGE_CODEX_SESSIONS_DIR="$STORE/codex/sessions" \
BRIDGE_GEMINI_TMP_DIR="$STORE/gemini/tmp" \
BRIDGE_CLAUDE_PROJECTS_DIR="$STORE/claude/projects" \
cargo run --quiet --manifest-path "$ROOT/cli/Cargo.toml" -- report --handoff "$ROOT/fixtures/handoff-report.json" --json > "$report_rust_json"

BRIDGE_CODEX_SESSIONS_DIR="$STORE/codex/sessions" \
BRIDGE_GEMINI_TMP_DIR="$STORE/gemini/tmp" \
BRIDGE_CLAUDE_PROJECTS_DIR="$STORE/claude/projects" \
node "$ROOT/scripts/read_session.cjs" compare \
  --source=codex:codex-fixture \
  --source=gemini:gemini-fixture \
  --source=claude:claude-fixture \
  --json > "$compare_node_json"

BRIDGE_CODEX_SESSIONS_DIR="$STORE/codex/sessions" \
BRIDGE_GEMINI_TMP_DIR="$STORE/gemini/tmp" \
BRIDGE_CLAUDE_PROJECTS_DIR="$STORE/claude/projects" \
cargo run --quiet --manifest-path "$ROOT/cli/Cargo.toml" -- compare \
  --source codex:codex-fixture \
  --source gemini:gemini-fixture \
  --source claude:claude-fixture \
  --json > "$compare_rust_json"

if [[ "${BRIDGE_SKIP_AJV:-0}" == "1" ]]; then
  node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));" "$read_node_json"
  node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));" "$read_rust_json"
  node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));" "$report_node_json"
  node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));" "$report_rust_json"
  node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));" "$compare_node_json"
  node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));" "$compare_rust_json"
  echo "Schema validation skipped (BRIDGE_SKIP_AJV=1); JSON parse sanity checks passed."
  exit 0
fi

AJV_CMD=(npx --yes ajv-cli@5 validate --spec=draft2020)

"${AJV_CMD[@]}" -s "$ROOT/schemas/handoff.schema.json" -d "$ROOT/fixtures/handoff-report.json"

"${AJV_CMD[@]}" -s "$ROOT/schemas/read-output.schema.json" -d "$read_node_json"
"${AJV_CMD[@]}" -s "$ROOT/schemas/read-output.schema.json" -d "$read_rust_json"

"${AJV_CMD[@]}" -s "$ROOT/schemas/report.schema.json" -d "$report_node_json"
"${AJV_CMD[@]}" -s "$ROOT/schemas/report.schema.json" -d "$report_rust_json"
"${AJV_CMD[@]}" -s "$ROOT/schemas/report.schema.json" -d "$compare_node_json"
"${AJV_CMD[@]}" -s "$ROOT/schemas/report.schema.json" -d "$compare_rust_json"

echo "Schema validation complete for handoff/read/report outputs."
