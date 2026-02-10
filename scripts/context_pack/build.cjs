#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ZERO_SHA_RE = /^0{40}$/;

function parseArgs(argv) {
  const options = {
    reason: 'manual-build',
    base: null,
    head: null,
    packDir: process.env.BRIDGE_CONTEXT_PACK_DIR || '.agent-context',
    changedFiles: [],
    forceSnapshot: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const [name, inlineValue] = token.startsWith('--') ? token.split('=', 2) : [token, null];
    const next = inlineValue != null ? inlineValue : argv[i + 1];

    switch (name) {
      case '--reason':
        options.reason = next || options.reason;
        if (inlineValue == null) i += 1;
        break;
      case '--base':
        options.base = next || null;
        if (inlineValue == null) i += 1;
        break;
      case '--head':
        options.head = next || null;
        if (inlineValue == null) i += 1;
        break;
      case '--pack-dir':
        options.packDir = next || options.packDir;
        if (inlineValue == null) i += 1;
        break;
      case '--changed-file':
        if (next) options.changedFiles.push(next);
        if (inlineValue == null) i += 1;
        break;
      case '--force-snapshot':
        options.forceSnapshot = true;
        break;
      default:
        break;
    }
  }

  return options;
}

function runGit(args, cwd, allowFailure = false) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    if (allowFailure) return '';
    throw error;
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text, 'utf8');
}

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function wordCount(text) {
  const matches = text.match(/\S+/g);
  return matches ? matches.length : 0;
}

function bytesForFile(filePath) {
  return fs.statSync(filePath).size;
}

function asShortSha(sha) {
  if (!sha || ZERO_SHA_RE.test(sha)) return 'none';
  return sha.slice(0, 12);
}

function parseCargoVersion(cargoTomlText) {
  const match = cargoTomlText.match(/^version\s*=\s*"([^"]+)"/m);
  return match ? match[1] : 'unknown';
}

function computeChangedFiles(repoRoot, base, head) {
  if (!head) return [];
  if (!base || ZERO_SHA_RE.test(base)) {
    const output = runGit(['show', '--pretty=format:', '--name-only', head], repoRoot, true);
    return output.split('\n').map((line) => line.trim()).filter(Boolean);
  }
  const output = runGit(['diff', '--name-only', `${base}..${head}`], repoRoot, true);
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

function summarizePathCounts(paths) {
  const buckets = [
    { key: 'scripts/', name: 'scripts', count: 0 },
    { key: 'cli/src/', name: 'cli/src', count: 0 },
    { key: 'schemas/', name: 'schemas', count: 0 },
    { key: 'fixtures/', name: 'fixtures', count: 0 },
    { key: '.github/workflows/', name: '.github/workflows', count: 0 },
    { key: 'docs/', name: 'docs', count: 0 },
  ];

  for (const filePath of paths) {
    const bucket = buckets.find((item) => filePath.startsWith(item.key));
    if (bucket) bucket.count += 1;
  }

  return buckets.filter((item) => item.count > 0);
}

function normalizeChangedFiles(files) {
  return [...new Set(files.map((filePath) => filePath.replace(/\\/g, '/').trim()).filter(Boolean))].sort();
}

function nowStamp() {
  return new Date().toISOString();
}

function compactTimestamp(iso) {
  return iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

function buildStartHere({
  repoName,
  branch,
  headSha,
  packageVersion,
  cargoVersion,
  generatedAt,
  changedFiles,
}) {
  const changedSummary =
    changedFiles.length === 0
      ? '- No explicit change range provided (manual build).'
      : changedFiles.slice(0, 12).map((filePath) => `- ${filePath}`).join('\n');

  return `# Context Pack: Start Here

This context pack is the first-stop index for agent work in this repository.

## Snapshot
- Repo: \`${repoName}\`
- Branch at generation: \`${branch}\`
- HEAD commit: \`${headSha || 'unknown'}\`
- Node package version: \`${packageVersion}\`
- Rust crate version: \`${cargoVersion}\`
- Generated at: \`${generatedAt}\`

## Read Order (Token-Efficient)
1. Read this file.
2. Read \`10_SYSTEM_OVERVIEW.md\` for architecture and execution paths.
3. Read \`30_BEHAVIORAL_INVARIANTS.md\` before changing behavior.
4. Use \`20_CODE_MAP.md\` to deep dive only relevant files.
5. Use \`40_OPERATIONS_AND_RELEASE.md\` for tests, release, and maintenance.

## Fast Facts
- Product: Local-first cross-agent session bridge CLI.
- Implementations: Node (\`scripts/read_session.cjs\`) and Rust (\`cli/src/main.rs\`).
- Quality gate: Node/Rust parity + schema validation + edge-case checks.
- Core risk: behavior drift between Node and Rust command/output contracts.

## Last Change Range Input
${changedSummary}

## Scope Rule
For "understand this repo end-to-end" requests:
- Start with this pack only.
- Open source files only after this pack identifies a precise target.
- Treat this pack as the source of navigation and invariants.
`;
}

function buildSystemOverview({
  packageVersion,
  cargoVersion,
  commandSurface,
  trackedFileCount,
  pathCounts,
}) {
  const commandRows = commandSurface
    .map((item) => `| \`${item.command}\` | ${item.intent} | ${item.primaryPaths.map((p) => `\`${p}\``).join(', ')} |`)
    .join('\n');

  const pathCountLines =
    pathCounts.length === 0
      ? '- No tracked path counts available.'
      : pathCounts.map((item) => `- ${item.name}: ${item.count} tracked files`).join('\n');

  return `# System Overview

## Product Shape
- Package version: \`${packageVersion}\`
- Crate version: \`${cargoVersion}\`
- Tracked files: \`${trackedFileCount}\`
- Delivery: npm package (\`bridge\`) + Rust binary (\`bridge\`).

## Runtime Architecture
1. User asks a provider agent for cross-agent status.
2. Agent invokes bridge command (\`read\`, \`list\`, \`search\`, \`compare\`, \`report\`, \`setup\`, \`doctor\`, \`trash-talk\`).
3. Bridge resolves session stores (Codex/Claude/Gemini/Cursor), applies redaction, and returns terminal text or JSON.
4. Agent answers user with evidence from bridge output.

## Dual-Implementation Contract
- Node path: \`scripts/read_session.cjs\` + \`scripts/adapters/*.cjs\`.
- Rust path: \`cli/src/main.rs\`, \`cli/src/agents.rs\`, \`cli/src/report.rs\`, \`cli/src/adapters/*.rs\`.
- Protocol authority: \`PROTOCOL.md\` and \`schemas/*.json\`.
- Parity guard: \`scripts/conformance.sh\`.

## Command Surface
| Command | Intent | Primary Paths |
| --- | --- | --- |
${commandRows}

## Tracked Path Density
${pathCountLines}
`;
}

function buildCodeMap() {
  return `# Code Map

## High-Impact Paths
| Path | What | Why It Matters | Change Risk |
| --- | --- | --- | --- |
| \`scripts/read_session.cjs\` | Node CLI command parser + execution engine | Defines behavior for all user-facing commands in Node distribution | High |
| \`scripts/adapters/*.cjs\` | Node agent-specific session adapters | Session discovery, parsing, and metadata quality for each provider | High |
| \`cli/src/main.rs\` | Rust CLI command/arg handling | Entry-point parity with Node and release binary behavior | High |
| \`cli/src/agents.rs\` | Rust session parsing + redaction + read/list/search | Largest behavioral surface and most error-code paths | High |
| \`cli/src/report.rs\` | Rust compare/report logic | Cross-agent divergence logic and report markdown/json structure | High |
| \`schemas/*.json\` | JSON contract definitions | External compatibility for \`--json\` users and tests | High |
| \`PROTOCOL.md\` | Versioned protocol contract | Human contract that aligns Node, Rust, and tests | High |
| \`README.md\` | Public command docs and examples | User expectations and documentation-driven behavior | Medium |
| \`scripts/conformance.sh\` | Parity checks across implementations | Prevents silent behavior drift before release | High |
| \`scripts/test_edge_cases.sh\` | Edge and error-path checks | Guards hard-to-debug regressions in parse/error handling | High |
| \`.github/workflows/ci.yml\` | Mandatory validation workflow | Ensures checks run on push/PR | Medium |
| \`.github/workflows/release.yml\` | Release pipeline | Controls publish safety and artifact generation | Medium |

## Extension Recipe (New Agent)
1. Implement adapter in Rust: \`cli/src/adapters/<agent>.rs\` and register in \`cli/src/adapters/mod.rs\`.
2. Implement adapter in Node: \`scripts/adapters/<agent>.cjs\` and register in \`scripts/adapters/registry.cjs\`.
3. Add schema enum coverage in \`schemas/*.json\`.
4. Add fixtures and golden expectations under \`fixtures/\`.
5. Validate parity and edge cases through test scripts.
`;
}

function buildInvariants() {
  return `# Behavioral Invariants

These constraints are contract-level and must be preserved unless intentionally versioned.

## Core Protocol Invariants
1. \`read\`, \`list\`, \`search\`, \`compare\`, and \`report\` must align with \`PROTOCOL.md\`.
2. Node and Rust outputs must remain behaviorally equivalent for shared commands.
3. \`--json\` failures must emit structured error JSON with stable error codes.
4. Secret-like tokens must be redacted before output.
5. Session selection defaults: latest scoped session first, then documented fallback behavior.

## Session Semantics
1. "current/latest" means newest session.
2. "past/previous session" means one session before newest.
3. \`read --last N\` returns last N assistant messages joined by \`\\n---\\n\`.
4. CWD scoping applies where provider data supports it.

## Update Checklist Before Merging Behavior Changes
1. Update code in both Node and Rust paths when command semantics change.
2. Update schema files for JSON shape changes.
3. Update \`README.md\` and \`PROTOCOL.md\` for public contract changes.
4. Update fixtures/golden outputs.
5. Run conformance, edge-case, and schema validation scripts.
`;
}

function buildOperations() {
  return `# Operations And Release

## Standard Validation
\`\`\`bash
npm run check
cargo test --manifest-path cli/Cargo.toml
\`\`\`

## Main CI Checks
- \`scripts/conformance.sh\`
- \`scripts/test_edge_cases.sh\`
- \`scripts/check_readme_examples.sh\`
- \`scripts/check_package_contents.sh\`
- \`scripts/validate_schemas.sh\`

## Release Flow
1. Push tag \`v*\` to trigger \`.github/workflows/release.yml\`.
2. Verify phase runs conformance/docs/schema/version checks.
3. Package/publish Node artifact.
4. Build/upload Rust binaries and publish crate when tokens are configured.

## Context Pack Maintenance Contract
1. Build pack manually: \`npm run context-pack:build\`.
2. Install branch-aware pre-push hook: \`npm run context-pack:install-hooks\`.
3. On \`main\` push, hook runs \`context-pack:sync-main\`.
4. Sync updates the pack only when changed files are context-relevant.
5. Snapshots are saved under \`.agent-context/snapshots/\` for rollback/recovery.

## Rollback/Recovery
- Restore latest snapshot: \`npm run context-pack:rollback\`
- Restore named snapshot: \`npm run context-pack:rollback -- --snapshot <snapshot_id>\`
`;
}

function copyDir(source, destination) {
  ensureDir(path.dirname(destination));
  fs.cpSync(source, destination, { recursive: true });
}

function appendHistory(historyPath, entry) {
  ensureDir(path.dirname(historyPath));
  fs.appendFileSync(historyPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

function buildManifest({
  generatedAt,
  repoRoot,
  repoName,
  branch,
  headSha,
  packageVersion,
  cargoVersion,
  reason,
  baseSha,
  changedFiles,
  filesMeta,
}) {
  const packChecksum = sha256(
    filesMeta.map((meta) => `${meta.path}:${meta.sha256}`).join('\n')
  );

  const wordsTotal = filesMeta.reduce((sum, item) => sum + item.words, 0);
  const bytesTotal = filesMeta.reduce((sum, item) => sum + item.bytes, 0);

  return {
    schema_version: 1,
    generated_at: generatedAt,
    repo_name: repoName,
    repo_root: repoRoot,
    branch,
    head_sha: headSha || null,
    package_version: packageVersion,
    cargo_version: cargoVersion,
    build_reason: reason,
    base_sha: baseSha || null,
    changed_files: changedFiles,
    files_count: filesMeta.length,
    words_total: wordsTotal,
    bytes_total: bytesTotal,
    pack_checksum: packChecksum,
    files: filesMeta,
  };
}

function collectFilesMeta(currentDir, relativePaths) {
  return relativePaths.map((relativePath) => {
    const absolutePath = path.join(currentDir, relativePath);
    const content = fs.readFileSync(absolutePath, 'utf8');
    return {
      path: relativePath,
      sha256: sha256(content),
      bytes: bytesForFile(absolutePath),
      words: wordCount(content),
    };
  });
}

function main() {
  const options = parseArgs(process.argv);
  const repoRoot = runGit(['rev-parse', '--show-toplevel'], process.cwd(), true) || process.cwd();
  const repoName = path.basename(repoRoot);
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const cargoTomlPath = path.join(repoRoot, 'cli', 'Cargo.toml');

  const packageJson = readJson(packageJsonPath) || { version: 'unknown' };
  const cargoTomlText = fs.existsSync(cargoTomlPath) ? fs.readFileSync(cargoTomlPath, 'utf8') : '';

  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot, true) || 'unknown';
  const headSha = options.head || runGit(['rev-parse', 'HEAD'], repoRoot, true) || null;
  const generatedAt = nowStamp();

  let changedFiles = normalizeChangedFiles(options.changedFiles);
  if (changedFiles.length === 0 && options.head) {
    changedFiles = normalizeChangedFiles(computeChangedFiles(repoRoot, options.base, options.head));
  }

  const trackedFiles = runGit(['ls-files'], repoRoot, true)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const pathCounts = summarizePathCounts(trackedFiles);

  const commandSurface = [
    { command: 'read', intent: 'Read latest or selected session content', primaryPaths: ['scripts/read_session.cjs', 'cli/src/main.rs', 'cli/src/agents.rs'] },
    { command: 'list', intent: 'List recent sessions by agent', primaryPaths: ['scripts/read_session.cjs', 'cli/src/agents.rs'] },
    { command: 'search', intent: 'Find sessions containing text', primaryPaths: ['scripts/read_session.cjs', 'cli/src/agents.rs'] },
    { command: 'compare', intent: 'Compare multiple agent outputs', primaryPaths: ['scripts/read_session.cjs', 'cli/src/report.rs'] },
    { command: 'report', intent: 'Build coordinator report from handoff JSON', primaryPaths: ['scripts/read_session.cjs', 'cli/src/report.rs'] },
    { command: 'setup', intent: 'Write provider instruction wiring files', primaryPaths: ['scripts/read_session.cjs'] },
    { command: 'doctor', intent: 'Check setup and path wiring', primaryPaths: ['scripts/read_session.cjs'] },
    { command: 'trash-talk', intent: 'Roast active agents from session content', primaryPaths: ['scripts/read_session.cjs', 'cli/src/agents.rs'] },
  ];

  const packRoot = path.resolve(repoRoot, options.packDir);
  const currentDir = path.join(packRoot, 'current');
  const snapshotsDir = path.join(packRoot, 'snapshots');
  const historyPath = path.join(packRoot, 'history.jsonl');
  const manifestPath = path.join(currentDir, 'manifest.json');
  const previousManifest = readJson(manifestPath);

  ensureDir(currentDir);
  ensureDir(snapshotsDir);

  const outputs = [
    {
      path: '00_START_HERE.md',
      content: buildStartHere({
        repoName,
        branch,
        headSha,
        packageVersion: packageJson.version || 'unknown',
        cargoVersion: parseCargoVersion(cargoTomlText),
        generatedAt,
        changedFiles,
      }),
    },
    {
      path: '10_SYSTEM_OVERVIEW.md',
      content: buildSystemOverview({
        packageVersion: packageJson.version || 'unknown',
        cargoVersion: parseCargoVersion(cargoTomlText),
        commandSurface,
        trackedFileCount: trackedFiles.length,
        pathCounts,
      }),
    },
    { path: '20_CODE_MAP.md', content: buildCodeMap() },
    { path: '30_BEHAVIORAL_INVARIANTS.md', content: buildInvariants() },
    { path: '40_OPERATIONS_AND_RELEASE.md', content: buildOperations() },
  ];

  for (const output of outputs) {
    writeText(path.join(currentDir, output.path), output.content);
  }

  const filesMeta = collectFilesMeta(
    currentDir,
    outputs.map((item) => item.path)
  );

  const manifest = buildManifest({
    generatedAt,
    repoRoot,
    repoName,
    branch,
    headSha,
    packageVersion: packageJson.version || 'unknown',
    cargoVersion: parseCargoVersion(cargoTomlText),
    reason: options.reason,
    baseSha: options.base,
    changedFiles,
    filesMeta,
  });

  writeText(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const changed =
    options.forceSnapshot ||
    !previousManifest ||
    previousManifest.pack_checksum !== manifest.pack_checksum ||
    previousManifest.head_sha !== manifest.head_sha;

  if (changed) {
    const snapshotId = `${compactTimestamp(generatedAt)}_${asShortSha(headSha)}`;
    const snapshotDir = path.join(snapshotsDir, snapshotId);
    copyDir(currentDir, snapshotDir);

    appendHistory(historyPath, {
      snapshot_id: snapshotId,
      generated_at: generatedAt,
      branch,
      head_sha: headSha || null,
      base_sha: options.base || null,
      reason: options.reason,
      changed_files: changedFiles,
      pack_checksum: manifest.pack_checksum,
    });

    process.stdout.write(
      `[context-pack] updated: ${path.relative(repoRoot, packRoot)} (snapshot ${snapshotId})\n`
    );
  } else {
    process.stdout.write('[context-pack] unchanged; no new snapshot created\n');
  }
}

main();
