#!/usr/bin/env node
'use strict';

const path = require('path');
const { execFileSync } = require('child_process');

const ZERO_SHA_RE = /^0{40}$/;

function parseArgs(argv) {
  const out = {
    localRef: null,
    localSha: null,
    remoteRef: null,
    remoteSha: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const [name, inlineValue] = token.startsWith('--') ? token.split('=', 2) : [token, null];
    const next = inlineValue != null ? inlineValue : argv[i + 1];

    switch (name) {
      case '--local-ref':
        out.localRef = next || null;
        if (inlineValue == null) i += 1;
        break;
      case '--local-sha':
        out.localSha = next || null;
        if (inlineValue == null) i += 1;
        break;
      case '--remote-ref':
        out.remoteRef = next || null;
        if (inlineValue == null) i += 1;
        break;
      case '--remote-sha':
        out.remoteSha = next || null;
        if (inlineValue == null) i += 1;
        break;
      default:
        break;
    }
  }

  return out;
}

function runGit(args, cwd, allowFailure = false) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    if (allowFailure) return '';
    throw error;
  }
}

function isMainPush(localRef, remoteRef) {
  return localRef === 'refs/heads/main' || remoteRef === 'refs/heads/main';
}

function getChangedFiles(repoRoot, baseSha, headSha) {
  if (!headSha || ZERO_SHA_RE.test(headSha)) return [];

  let output = '';
  if (!baseSha || ZERO_SHA_RE.test(baseSha)) {
    output = runGit(['show', '--pretty=format:', '--name-only', headSha], repoRoot, true);
  } else {
    output = runGit(['diff', '--name-only', `${baseSha}..${headSha}`], repoRoot, true);
  }

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function isContextRelevant(filePath) {
  const normalized = filePath.replace(/\\/g, '/');

  if (
    normalized.startsWith('blog/') ||
    normalized.startsWith('notes/') ||
    normalized.startsWith('drafts/') ||
    normalized.startsWith('scratch/') ||
    normalized.startsWith('tmp/') ||
    normalized.startsWith('.agent-context/') ||
    normalized.startsWith('docs/demo-')
  ) {
    return false;
  }

  if (
    normalized === 'README.md' ||
    normalized === 'PROTOCOL.md' ||
    normalized === 'CONTRIBUTING.md' ||
    normalized === 'SKILL.md' ||
    normalized === 'AGENTS.md' ||
    normalized === 'package.json' ||
    normalized === 'package-lock.json' ||
    normalized === 'cli/Cargo.toml' ||
    normalized === 'cli/Cargo.lock' ||
    normalized === 'docs/architecture.svg' ||
    normalized === 'docs/silo-tax-before-after.webp'
  ) {
    return true;
  }

  return (
    normalized.startsWith('scripts/') ||
    normalized.startsWith('cli/src/') ||
    normalized.startsWith('schemas/') ||
    normalized.startsWith('fixtures/golden/') ||
    normalized.startsWith('fixtures/session-store/') ||
    normalized.startsWith('.github/workflows/')
  );
}

function shortSha(sha) {
  if (!sha || ZERO_SHA_RE.test(sha)) return 'none';
  return sha.slice(0, 12);
}

function main() {
  const args = parseArgs(process.argv);
  const repoRoot = runGit(['rev-parse', '--show-toplevel'], process.cwd(), true) || process.cwd();

  if (!isMainPush(args.localRef, args.remoteRef)) {
    process.stdout.write('[context-pack] skipped (push is not targeting main)\n');
    return;
  }

  if (!args.localSha || ZERO_SHA_RE.test(args.localSha)) {
    process.stdout.write('[context-pack] skipped (main deletion or empty local sha)\n');
    return;
  }

  const changedFiles = getChangedFiles(repoRoot, args.remoteSha, args.localSha);
  const relevant = changedFiles.filter(isContextRelevant);

  if (relevant.length === 0) {
    process.stdout.write('[context-pack] skipped (no context-relevant file changes)\n');
    return;
  }

  const buildScript = path.join(repoRoot, 'scripts', 'context_pack', 'build.cjs');
  const buildArgs = [
    buildScript,
    '--reason',
    `main-push:${shortSha(args.remoteSha)}..${shortSha(args.localSha)}`,
    '--base',
    args.remoteSha || '',
    '--head',
    args.localSha,
  ];

  for (const filePath of changedFiles) {
    buildArgs.push('--changed-file', filePath);
  }

  execFileSync('node', buildArgs, { cwd: repoRoot, stdio: 'inherit' });
}

main();
