#!/usr/bin/env node

const fs = require('fs');

const [leftPath, rightPath, label] = process.argv.slice(2);
if (!leftPath || !rightPath) {
  console.error('Usage: compare_read_output.cjs <left.json> <right.json> [label]');
  process.exit(1);
}

const leftJson = JSON.parse(fs.readFileSync(leftPath, 'utf-8'));
const rightJson = JSON.parse(fs.readFileSync(rightPath, 'utf-8'));

const path = require('path');

function normalizeSourcePath(str) {
  // Replace full paths with just basename: "[tag] /full/path/file.ext" -> "[tag] file.ext"
  return str.replace(/ \/[^ ]*\/([^ ]+)$/g, ' $1').replace(/ \/([^ ]+)$/g, ' $1');
}

function canonicalize(value, key) {
  // Normalize sources_used paths to basenames (must check before Array.isArray)
  if (key === 'sources_used' && Array.isArray(value)) {
    return value.map(v => typeof v === 'string' ? normalizeSourcePath(v) : canonicalize(v));
  }

  if (Array.isArray(value)) {
    return value.map((v) => canonicalize(v));
  }

  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      out[k] = canonicalize(value[k], k);
    }
    return out;
  }

  // Normalize source paths to basenames to avoid absolute-path mismatches
  if (key === 'source' && typeof value === 'string') {
    return path.basename(value);
  }

  // Strip timestamp for golden file comparison (varies by env)
  if (key === 'timestamp') {
    return null;
  }

  // Strip modified_at precision differences between runtimes
  if (key === 'modified_at') {
    return null;
  }

  // Strip file_path for golden file comparison
  if (key === 'file_path' && typeof value === 'string') {
    return path.basename(value);
  }

  return value;
}

const leftCanonical = canonicalize(leftJson);
const rightCanonical = canonicalize(rightJson);

if (JSON.stringify(leftCanonical) !== JSON.stringify(rightCanonical)) {
  console.error(`Mismatch${label ? ` (${label})` : ''}`);
  console.error('Left:', JSON.stringify(leftCanonical, null, 2));
  console.error('Right:', JSON.stringify(rightCanonical, null, 2));
  process.exit(1);
}

console.log(`PASS${label ? ` ${label}` : ''}`);
