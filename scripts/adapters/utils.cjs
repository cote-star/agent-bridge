/**
 * Shared utility functions for agent adapters.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

function expandHome(filepath) {
  if (!filepath) return filepath;
  if (filepath === '~') return os.homedir();
  if (filepath.startsWith('~/')) {
    return path.join(os.homedir(), filepath.slice(2));
  }
  return filepath;
}

function normalizePath(filepath) {
  return path.resolve(expandHome(filepath));
}

function hashPath(filepath) {
  return crypto.createHash('sha256').update(normalizePath(filepath)).digest('hex');
}

function collectMatchingFiles(dirPath, predicate, recursive = false) {
  if (!dirPath || !fs.existsSync(dirPath)) return [];

  const matches = [];

  function search(currentDir) {
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (error) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (recursive) search(fullPath);
        continue;
      }

      if (!predicate(fullPath, entry.name)) continue;

      try {
        // Prefer nanosecond precision to keep "latest" selection stable
        // across runtimes and filesystems.
        let mtimeNs;
        try {
          const statBig = fs.statSync(fullPath, { bigint: true });
          mtimeNs = statBig.mtimeNs;
        } catch (_error) {
          const stat = fs.statSync(fullPath);
          mtimeNs = BigInt(Math.trunc(stat.mtimeMs * 1e6));
        }
        matches.push({ path: fullPath, mtimeNs });
      } catch (error) {
        // Ignore entries that disappear while scanning.
      }
    }
  }

  search(dirPath);
  matches.sort((a, b) => {
    if (b.mtimeNs !== a.mtimeNs) {
      return b.mtimeNs > a.mtimeNs ? 1 : -1;
    }
    return String(a.path).localeCompare(String(b.path));
  });
  return matches;
}

function readJsonlLines(filePath) {
  return fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
}

function findLatestByCwd(files, cwdExtractor, expectedCwd) {
  for (const file of files) {
    const fileCwd = cwdExtractor(file.path);
    if (fileCwd && fileCwd === expectedCwd) {
      return file.path;
    }
  }
  return null;
}

function getFileTimestamp(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.mtime.toISOString();
  } catch (error) {
    return null;
  }
}

function extractText(value) {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';

  return value
    .map(part => {
      if (typeof part === 'string') return part;
      if (part && typeof part.text === 'string') return part.text;
      return '';
    })
    .join('');
}

function extractClaudeText(value) {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';

  return value
    .filter(part => part && part.type === 'text')
    .map(part => part.text || '')
    .join('');
}

function redactSensitiveText(input) {
  let output = String(input || '');
  output = output.replace(/\bsk-[A-Za-z0-9]{20,}\b/g, 'sk-[REDACTED]');
  output = output.replace(/\bAKIA[0-9A-Z]{16}\b/g, 'AKIA[REDACTED]');
  output = output.replace(/\bBearer\s+[A-Za-z0-9._-]{10,}\b/gi, 'Bearer [REDACTED]');
  output = output.replace(
    /\b(api[_-]?key|token|secret|password)\b\s*[:=]\s*["']?[^"'\s]+["']?/gi,
    (_, key) => `${key}=[REDACTED]`
  );
  return output;
}

module.exports = {
  expandHome,
  normalizePath,
  hashPath,
  collectMatchingFiles,
  readJsonlLines,
  findLatestByCwd,
  getFileTimestamp,
  extractText,
  extractClaudeText,
  redactSensitiveText,
};
