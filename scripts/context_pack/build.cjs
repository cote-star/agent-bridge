#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseArgs(argv) {
  const opts = {
    passthrough: [],
  };
  for (let i = 2; i < argv.length; i += 1) {
    opts.passthrough.push(argv[i]);
  }
  return opts;
}

function runSubcommand(script, args, cwd) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  const opts = parseArgs(process.argv);
  const cwd = process.cwd();
  const repoRoot =
    spawnSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).stdout?.trim() || cwd;
  const packDir =
    opts.passthrough.find((t, idx) => t === '--pack-dir' && opts.passthrough[idx + 1]) ||
    process.env.BRIDGE_CONTEXT_PACK_DIR ||
    '.agent-context';
  const currentDir = path.join(path.isAbsolute(packDir) ? packDir : path.join(repoRoot, packDir), 'current');

  const stateIsMissing =
    !fs.existsSync(currentDir) ||
    (fs.existsSync(currentDir) && fs.readdirSync(currentDir).length === 0);

  if (stateIsMissing) {
    runSubcommand(path.join(__dirname, 'init.cjs'), opts.passthrough, repoRoot);
  } else {
    runSubcommand(path.join(__dirname, 'seal.cjs'), opts.passthrough, repoRoot);
  }
}

main();
