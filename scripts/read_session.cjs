#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const rawArgs = process.argv.slice(2);
const commandNames = new Set(['read', 'compare', 'report', 'list']);
const command = commandNames.has(rawArgs[0]) ? rawArgs[0] : 'read';
const args = commandNames.has(rawArgs[0]) ? rawArgs.slice(1) : rawArgs;

const codexSessionsBase = normalizePath(process.env.BRIDGE_CODEX_SESSIONS_DIR || '~/.codex/sessions');
const claudeProjectsBase = normalizePath(process.env.BRIDGE_CLAUDE_PROJECTS_DIR || '~/.claude/projects');
const geminiTmpBase = normalizePath(process.env.BRIDGE_GEMINI_TMP_DIR || '~/.gemini/tmp');

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

function getOptionValues(inputArgs, name) {
  const values = [];
  for (let i = 0; i < inputArgs.length; i += 1) {
    const arg = inputArgs[i];
    if (arg === name && i + 1 < inputArgs.length) {
      values.push(inputArgs[i + 1]);
      i += 1;
      continue;
    }

    const prefix = `${name}=`;
    if (arg.startsWith(prefix)) {
      values.push(arg.slice(prefix.length));
    }
  }
  return values;
}

function getOptionValue(inputArgs, name, fallback = null) {
  const values = getOptionValues(inputArgs, name);
  return values.length > 0 ? values[values.length - 1] : fallback;
}

function hasFlag(inputArgs, name) {
  return inputArgs.includes(name);
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
        const stat = fs.statSync(fullPath);
        matches.push({ path: fullPath, mtimeMs: stat.mtimeMs });
      } catch (error) {
        // Ignore entries that disappear while scanning.
      }
    }
  }

  search(dirPath);
  matches.sort((a, b) => b.mtimeMs - a.mtimeMs);
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

function getCodexSessionCwd(filePath) {
  try {
    const firstLine = readJsonlLines(filePath)[0];
    if (!firstLine) return null;

    const json = JSON.parse(firstLine);
    if (json.type === 'session_meta' && json.payload && typeof json.payload.cwd === 'string') {
      return normalizePath(json.payload.cwd);
    }
  } catch (error) {
    return null;
  }
  return null;
}

function getClaudeSessionCwd(filePath) {
  try {
    const lines = readJsonlLines(filePath);
    for (const line of lines) {
      try {
        const json = JSON.parse(line);
        if (typeof json.cwd === 'string') {
          return normalizePath(json.cwd);
        }
      } catch (error) {
        // Ignore unparseable line.
      }
    }
  } catch (error) {
    return null;
  }
  return null;
}

function listGeminiChatDirs() {
  if (!fs.existsSync(geminiTmpBase)) return [];

  let entries = [];
  try {
    entries = fs.readdirSync(geminiTmpBase, { withFileTypes: true });
  } catch (error) {
    return [];
  }

  const dirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const chatsDir = path.join(geminiTmpBase, entry.name, 'chats');
    if (fs.existsSync(chatsDir)) {
      dirs.push(chatsDir);
    }
  }
  return dirs;
}

function resolveGeminiChatDirs(chatsDir, cwd) {
  if (chatsDir) {
    const expanded = normalizePath(chatsDir);
    return fs.existsSync(expanded) ? [expanded] : [];
  }

  const ordered = [];
  const seen = new Set();

  function addDir(dirPath) {
    if (!dirPath || seen.has(dirPath) || !fs.existsSync(dirPath)) return;
    ordered.push(dirPath);
    seen.add(dirPath);
  }

  const scopedHash = hashPath(cwd);
  addDir(path.join(geminiTmpBase, scopedHash, 'chats'));

  for (const dir of listGeminiChatDirs()) {
    addDir(dir);
  }

  return ordered;
}

function resolveCodexTargetFile(id, cwd, warnings) {
  if (!fs.existsSync(codexSessionsBase)) return null;

  if (id) {
    const files = collectMatchingFiles(
      codexSessionsBase,
      (fullPath, name) => name.endsWith('.jsonl') && fullPath.includes(id),
      true
    );
    return files.length > 0 ? files[0].path : null;
  }

  const files = collectMatchingFiles(codexSessionsBase, (fullPath, name) => name.endsWith('.jsonl'), true);
  if (files.length === 0) return null;

  const scoped = findLatestByCwd(files, getCodexSessionCwd, cwd);
  if (scoped) return scoped;

  warnings.push(`Warning: no Codex session matched cwd ${cwd}; falling back to latest session.`);
  return files[0].path;
}

function resolveClaudeTargetFile(id, cwd, warnings) {
  if (!fs.existsSync(claudeProjectsBase)) return null;

  if (id) {
    const files = collectMatchingFiles(
      claudeProjectsBase,
      (fullPath, name) => name.endsWith('.jsonl') && fullPath.includes(id),
      true
    );
    return files.length > 0 ? files[0].path : null;
  }

  const files = collectMatchingFiles(claudeProjectsBase, (fullPath, name) => name.endsWith('.jsonl'), true);
  if (files.length === 0) return null;

  const scoped = findLatestByCwd(files, getClaudeSessionCwd, cwd);
  if (scoped) return scoped;

  warnings.push(`Warning: no Claude session matched cwd ${cwd}; falling back to latest session.`);
  return files[0].path;
}

function resolveGeminiTargetFile(id, chatsDir, cwd) {
  const dirs = resolveGeminiChatDirs(chatsDir, cwd);
  if (dirs.length === 0) return { targetFile: null, searchedDirs: [] };

  const candidates = [];
  for (const dir of dirs) {
    const files = collectMatchingFiles(
      dir,
      (fullPath, name) => {
        if (!name.endsWith('.json')) return false;
        if (id) return fullPath.includes(id);
        return name.startsWith('session-');
      },
      false
    );

    for (const file of files) {
      candidates.push(file);
    }
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return {
    targetFile: candidates.length > 0 ? candidates[0].path : null,
    searchedDirs: dirs,
  };
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

function classifyError(message) {
  if (/unsupported agent/i.test(message)) return 'UNSUPPORTED_AGENT';
  if (/unsupported mode/i.test(message)) return 'UNSUPPORTED_MODE';
  if (/no .* session found/i.test(message)) return 'NOT_FOUND';
  if (/not found/i.test(message)) return 'NOT_FOUND';
  if (/failed to parse/i.test(message) || /failed to read/i.test(message)) return 'PARSE_FAILED';
  if (/missing required/i.test(message) || /invalid handoff/i.test(message) || /must provide session_id/i.test(message)) return 'INVALID_HANDOFF';
  if (/has no messages/i.test(message) || /history is empty/i.test(message)) return 'EMPTY_SESSION';
  return 'IO_ERROR';
}

function getFileTimestamp(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.mtime.toISOString();
  } catch (error) {
    return null;
  }
}

function readCodexSession(id, cwd, lastN) {
  lastN = lastN || 1;
  const warnings = [];
  const targetFile = resolveCodexTargetFile(id, cwd, warnings);
  if (!targetFile) {
    throw new Error('No Codex session found.');
  }

  const lines = readJsonlLines(targetFile);
  const messages = [];
  let skipped = 0;
  let sessionCwd = null;
  let sessionId = null;

  for (const line of lines) {
    try {
      const json = JSON.parse(line);
      if (json.type === 'session_meta' && json.payload) {
        if (typeof json.payload.cwd === 'string') sessionCwd = json.payload.cwd;
        if (typeof json.payload.session_id === 'string') sessionId = json.payload.session_id;
      }
      if (json.type === 'response_item' && json.payload && json.payload.type === 'message') {
        messages.push(json.payload);
      } else if (json.type === 'event_msg' && json.payload && json.payload.type === 'agent_message') {
        messages.push({ role: 'assistant', content: json.payload.message });
      }
    } catch (error) {
      skipped += 1;
    }
  }

  if (skipped > 0) {
    warnings.push(`Warning: skipped ${skipped} unparseable line(s) in ${targetFile}`);
  }

  const assistantMsgs = messages.filter(message => (message.role || '').toLowerCase() === 'assistant');
  const messageCount = assistantMsgs.length;

  if (!sessionId) {
    sessionId = path.basename(targetFile, path.extname(targetFile));
  }

  let content = '';
  if (messages.length > 0) {
    if (lastN > 1 && assistantMsgs.length > 0) {
      const selected = assistantMsgs.slice(-lastN);
      content = selected.map(m => extractText(m.content) || '[No text content]').join('\n---\n');
    } else {
      const selected = assistantMsgs.length > 0 ? assistantMsgs[assistantMsgs.length - 1] : messages[messages.length - 1];
      content = extractText(selected.content) || '[No text content]';
    }
  } else {
    content = `Could not extract structured messages. Showing last 20 raw lines:\n${lines.slice(-20).join('\n')}`;
  }

  const messagesReturned = lastN > 1 ? Math.min(lastN, assistantMsgs.length) : 1;

  return {
    agent: 'codex',
    source: targetFile,
    content: redactSensitiveText(content),
    warnings,
    session_id: sessionId,
    cwd: sessionCwd,
    timestamp: getFileTimestamp(targetFile),
    message_count: messageCount,
    messages_returned: messagesReturned,
  };
}

function readGeminiSession(id, chatsDir, cwd, lastN) {
  lastN = lastN || 1;
  const resolved = resolveGeminiTargetFile(id, chatsDir, cwd);
  const targetFile = resolved.targetFile;
  if (!targetFile) {
    if (chatsDir) {
      throw new Error(`No Gemini session found in ${normalizePath(chatsDir)}`);
    }

    const lines = ['No Gemini session found. Searched chats directories:'];
    for (const dir of resolved.searchedDirs) {
      lines.push(` - ${dir}`);
    }
    throw new Error(lines.join('\n'));
  }

  let session;
  try {
    session = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
  } catch (error) {
    throw new Error(`Failed to parse Gemini JSON: ${error.message}`);
  }

  const sessionId = session.sessionId || path.basename(targetFile, path.extname(targetFile));

  let content = '';
  let messageCount = 0;
  let messagesReturned = 1;
  if (Array.isArray(session.messages)) {
    const assistantMsgs = session.messages.filter(message => {
      const type = (message.type || '').toLowerCase();
      return type === 'gemini' || type === 'assistant' || type === 'model';
    });
    messageCount = assistantMsgs.length;

    if (lastN > 1 && assistantMsgs.length > 0) {
      const selected = assistantMsgs.slice(-lastN);
      messagesReturned = selected.length;
      content = selected.map(m => {
        return typeof m.content === 'string' ? m.content : extractText(m.content) || '[No text content]';
      }).join('\n---\n');
    } else {
      const selected =
        [...session.messages].reverse().find(message => {
          const type = (message.type || '').toLowerCase();
          return type === 'gemini' || type === 'assistant' || type === 'model';
        }) || session.messages[session.messages.length - 1];

      if (!selected) {
        throw new Error('Gemini session has no messages.');
      }

      content = typeof selected.content === 'string'
        ? selected.content
        : extractText(selected.content) || '[No text content]';
    }
  } else if (Array.isArray(session.history)) {
    const assistantTurns = session.history.filter(turn => (turn.role || '').toLowerCase() !== 'user');
    messageCount = assistantTurns.length;

    if (lastN > 1 && assistantTurns.length > 0) {
      const selected = assistantTurns.slice(-lastN);
      messagesReturned = selected.length;
      content = selected.map(turn => {
        if (Array.isArray(turn.parts)) {
          return turn.parts.map(part => part.text || '').join('\n');
        } else if (typeof turn.parts === 'string') {
          return turn.parts;
        }
        return '[No text content]';
      }).join('\n---\n');
    } else {
      const selected =
        [...session.history].reverse().find(turn => (turn.role || '').toLowerCase() !== 'user') ||
        session.history[session.history.length - 1];

      if (!selected) {
        throw new Error('Gemini history is empty.');
      }

      if (Array.isArray(selected.parts)) {
        content = selected.parts.map(part => part.text || '').join('\n');
      } else if (typeof selected.parts === 'string') {
        content = selected.parts;
      } else {
        content = '[No text content]';
      }
    }
  } else {
    throw new Error('Unknown Gemini session schema. Supported fields: messages, history.');
  }

  return {
    agent: 'gemini',
    source: targetFile,
    content: redactSensitiveText(content),
    warnings: [],
    session_id: sessionId,
    cwd: null,
    timestamp: getFileTimestamp(targetFile),
    message_count: messageCount,
    messages_returned: messagesReturned,
  };
}

function readClaudeSession(id, cwd, lastN) {
  lastN = lastN || 1;
  if (!fs.existsSync(claudeProjectsBase)) {
    throw new Error(`Claude projects directory not found: ${claudeProjectsBase}`);
  }

  const warnings = [];
  const targetFile = resolveClaudeTargetFile(id, cwd, warnings);
  if (!targetFile) {
    throw new Error('No Claude session found.');
  }

  const lines = readJsonlLines(targetFile);
  const messages = [];
  let skipped = 0;
  let sessionCwd = null;

  for (const line of lines) {
    try {
      const json = JSON.parse(line);
      if (typeof json.cwd === 'string' && !sessionCwd) {
        sessionCwd = json.cwd;
      }
      const message = json.message || json;
      if (json.type === 'assistant' || message.role === 'assistant') {
        const content = message.content !== undefined ? message.content : json.content;
        const text = extractClaudeText(content);
        if (text) {
          messages.push(text);
        }
      }
    } catch (error) {
      skipped += 1;
    }
  }

  if (skipped > 0) {
    warnings.push(`Warning: skipped ${skipped} unparseable line(s) in ${targetFile}`);
  }

  const messageCount = messages.length;
  const sessionId = path.basename(targetFile, path.extname(targetFile));
  let content;
  let messagesReturned = 1;

  if (messages.length > 0) {
    if (lastN > 1) {
      const selected = messages.slice(-lastN);
      messagesReturned = selected.length;
      content = selected.join('\n---\n');
    } else {
      content = messages[messages.length - 1];
    }
  } else {
    content = `Could not extract assistant messages. Showing last 20 raw lines:\n${lines.slice(-20).join('\n')}`;
    messagesReturned = 0;
  }

  return {
    agent: 'claude',
    source: targetFile,
    content: redactSensitiveText(content),
    warnings,
    session_id: sessionId,
    cwd: sessionCwd,
    timestamp: getFileTimestamp(targetFile),
    message_count: messageCount,
    messages_returned: messagesReturned,
  };
}

function readSource(sourceSpec, defaultCwd) {
  const effectiveCwd = normalizePath(sourceSpec.cwd || defaultCwd);
  if (sourceSpec.agent === 'codex') {
    return readCodexSession(sourceSpec.session_id || null, effectiveCwd);
  }
  if (sourceSpec.agent === 'gemini') {
    return readGeminiSession(sourceSpec.session_id || null, sourceSpec.chats_dir || null, effectiveCwd);
  }
  if (sourceSpec.agent === 'claude') {
    return readClaudeSession(sourceSpec.session_id || null, effectiveCwd);
  }
  if (sourceSpec.agent === 'cursor') {
    return readCursorSession(sourceSpec.session_id || null, effectiveCwd);
  }

  throw new Error(`Unsupported agent: ${sourceSpec.agent}`);
}

function parseSourceArg(raw) {
  const firstColon = raw.indexOf(':');
  const agent = (firstColon === -1 ? raw : raw.slice(0, firstColon)).trim().toLowerCase();
  const session = firstColon === -1 ? null : raw.slice(firstColon + 1).trim();

  if (!['codex', 'gemini', 'claude', 'cursor'].includes(agent)) {
    throw new Error(`Unsupported agent: ${agent}`);
  }

  return {
    agent,
    session_id: session ? session : null,
    current_session: !session,
    cwd: null,
    chats_dir: null,
  };
}

function evidenceTag(sourceSpec) {
  const id = sourceSpec.session_id ? sourceSpec.session_id.slice(0, 8) : 'latest';
  return `[${sourceSpec.agent}:${id}]`;
}

function computeVerdict(mode, missingCount, uniqueCount, successCount) {
  if (successCount === 0) return 'INCOMPLETE';

  if (mode === 'verify') {
    if (missingCount === 0 && uniqueCount <= 1) return 'PASS';
    return 'FAIL';
  }

  if (mode === 'steer') return 'STEERING_PLAN_READY';
  if (mode === 'analyze') return 'ANALYSIS_COMPLETE';
  if (mode === 'feedback') return 'FEEDBACK_COMPLETE';
  return 'INCOMPLETE';
}

function buildReport(request, defaultCwd) {
  const successful = [];
  const missing = [];

  for (const sourceSpec of request.sources) {
    const evidence = evidenceTag(sourceSpec);
    try {
      const session = readSource(sourceSpec, defaultCwd);
      successful.push({ sourceSpec, session, evidence });
    } catch (error) {
      missing.push({ sourceSpec, error: error.message || String(error), evidence });
    }
  }

  const findings = [];

  for (const item of missing) {
    findings.push({
      severity: 'P1',
      summary: `Source unavailable: ${item.sourceSpec.agent} (${item.error})`,
      evidence: [item.evidence],
      confidence: 0.9,
    });
  }

  for (const item of successful) {
    for (const warning of item.session.warnings || []) {
      findings.push({
        severity: 'P2',
        summary: `Source warning: ${warning}`,
        evidence: [item.evidence],
        confidence: 0.75,
      });
    }
  }

  const shouldNormalize = request.normalize === true;
  const uniqueContents = new Set(successful.map(item => {
    const text = (item.session.content || '').trim();
    return shouldNormalize ? normalizeContent(text) : text;
  }));

  if (successful.length >= 2) {
    if (uniqueContents.size > 1) {
      findings.push({
        severity: 'P1',
        summary: 'Divergent agent outputs detected',
        evidence: successful.map(item => item.evidence),
        confidence: 0.75,
      });
    } else {
      findings.push({
        severity: 'P3',
        summary: 'All available agent outputs are aligned',
        evidence: successful.map(item => item.evidence),
        confidence: 0.9,
      });
    }
  } else {
    findings.push({
      severity: 'P2',
      summary: 'Insufficient comparable sources',
      evidence: successful.map(item => item.evidence),
      confidence: 0.5,
    });
  }

  const recommendedNextActions = [];
  if (missing.length > 0) {
    recommendedNextActions.push('Provide valid session identifiers or cwd values for unavailable sources.');
  }
  if (uniqueContents.size > 1) {
    recommendedNextActions.push('Inspect full transcripts for diverging sources before final decisions.');
  }
  if (Array.isArray(request.constraints) && request.constraints.length > 0) {
    recommendedNextActions.push(`Verify recommendations against constraints: ${request.constraints.join('; ')}.`);
  }
  if (recommendedNextActions.length === 0) {
    recommendedNextActions.push('No immediate action required.');
  }

  const openQuestions = missing.map(item => `Missing source ${item.sourceSpec.agent}: ${item.error}`);

  return {
    mode: request.mode,
    task: request.task,
    success_criteria: request.success_criteria,
    sources_used: successful.map(item => `${item.evidence} ${item.session.source}`),
    verdict: computeVerdict(request.mode, missing.length, uniqueContents.size, successful.length),
    findings: findings,
    recommended_next_actions: recommendedNextActions,
    open_questions: openQuestions,
  };
}

function renderReadResult(result, asJson) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  for (const warning of result.warnings || []) {
    console.error(warning);
  }

  const label = result.agent.charAt(0).toUpperCase() + result.agent.slice(1);
  console.log(`SOURCE: ${label} Session (${result.source})`);
  console.log('---');
  console.log(result.content);
}

function renderReport(result, asJson) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const lines = [];
  lines.push('### Inter-Agent Coordinator Report');
  lines.push('');
  lines.push(`**Mode:** ${result.mode}`);
  lines.push(`**Task:** ${result.task}`);
  lines.push('**Success Criteria:**');
  for (const criterion of result.success_criteria || []) {
    lines.push(`- ${criterion}`);
  }
  lines.push('');
  lines.push('**Sources Used:**');
  for (const source of result.sources_used || []) {
    lines.push(`- ${source}`);
  }
  lines.push('');
  lines.push(`**Verdict:** ${result.verdict}`);
  lines.push('');
  lines.push('**Findings:**');
  for (const finding of result.findings || []) {
    lines.push(
      `- **${finding.severity}:** ${finding.summary} (evidence: ${(finding.evidence || []).join(', ')}; confidence: ${Number(finding.confidence || 0).toFixed(2)})`
    );
  }
  lines.push('');
  lines.push('**Recommended Next Actions:**');
  (result.recommended_next_actions || []).forEach((action, index) => {
    lines.push(`${index + 1}. ${action}`);
  });
  if ((result.open_questions || []).length > 0) {
    lines.push('');
    lines.push('**Open Questions:**');
    for (const question of result.open_questions) {
      lines.push(`- ${question}`);
    }
  }

  console.log(lines.join('\n'));
}

function validateMode(mode) {
  const allowed = new Set(['verify', 'steer', 'analyze', 'feedback']);
  if (!allowed.has(mode)) {
    throw new Error(`Unsupported mode: ${mode}`);
  }
}

function runRead(inputArgs) {
  const agent = getOptionValue(inputArgs, '--agent', 'codex');
  const id = getOptionValue(inputArgs, '--id', null);
  const chatsDir = getOptionValue(inputArgs, '--chats-dir', null);
  const cwd = normalizePath(getOptionValue(inputArgs, '--cwd', process.cwd()));
  const asJson = hasFlag(inputArgs, '--json');
  const lastN = parseInt(getOptionValue(inputArgs, '--last', '1'), 10) || 1;

  let result;
  if (agent === 'codex') {
    result = readCodexSession(id, cwd, lastN);
  } else if (agent === 'gemini') {
    result = readGeminiSession(id, chatsDir, cwd, lastN);
  } else if (agent === 'claude') {
    result = readClaudeSession(id, cwd, lastN);
  } else if (agent === 'cursor') {
    result = readCursorSession(id, cwd, lastN);
  } else {
    throw new Error(`Unknown agent: ${agent}. Supported: codex, gemini, claude, cursor`);
  }

  renderReadResult(result, asJson);
}

function normalizeContent(text) {
  return text.trim().replace(/\s+/g, ' ');
}

function runCompare(inputArgs) {
  const sourcesRaw = getOptionValues(inputArgs, '--source');
  if (sourcesRaw.length === 0) {
    throw new Error('compare requires at least one --source option');
  }

  const cwd = normalizePath(getOptionValue(inputArgs, '--cwd', process.cwd()));
  const asJson = hasFlag(inputArgs, '--json');
  const normalize = hasFlag(inputArgs, '--normalize');
  const sourceSpecs = sourcesRaw.map(parseSourceArg);

  const report = buildReport(
    {
      mode: 'analyze',
      task: 'Compare agent outputs',
      success_criteria: [
        'Identify agreements and contradictions',
        'Highlight unavailable sources',
      ],
      sources: sourceSpecs,
      constraints: [],
      normalize,
    },
    cwd
  );

  renderReport(report, asJson);
}

function runReport(inputArgs) {
  const handoffPath = getOptionValue(inputArgs, '--handoff', null);
  if (!handoffPath) {
    throw new Error('report requires --handoff=<path>');
  }

  const cwd = normalizePath(getOptionValue(inputArgs, '--cwd', process.cwd()));
  const asJson = hasFlag(inputArgs, '--json');

  let handoff;
  try {
    handoff = JSON.parse(fs.readFileSync(normalizePath(handoffPath), 'utf-8'));
  } catch (error) {
    throw new Error(`Failed to read handoff JSON: ${error.message}`);
  }

  const mode = String(handoff.mode || '').toLowerCase();
  validateMode(mode);

  if (typeof handoff.task !== 'string' || !handoff.task.trim()) {
    throw new Error('Handoff is missing required string field: task');
  }
  if (!Array.isArray(handoff.success_criteria) || handoff.success_criteria.length === 0) {
    throw new Error('Handoff is missing required array field: success_criteria');
  }
  if (!Array.isArray(handoff.sources) || handoff.sources.length === 0) {
    throw new Error('Handoff is missing required array field: sources');
  }

  const sourceSpecs = handoff.sources.map(source => {
    const agent = String(source.agent || '').toLowerCase();
    if (!['codex', 'gemini', 'claude', 'cursor'].includes(agent)) {
      throw new Error(`Unsupported agent: ${agent}`);
    }

    const sessionId = typeof source.session_id === 'string' && source.session_id.trim()
      ? source.session_id.trim()
      : null;
    const currentSession = source.current_session === true;

    if (!sessionId && !currentSession) {
      throw new Error('Each source must provide session_id or set current_session=true');
    }

    return {
      agent,
      session_id: sessionId,
      current_session: currentSession,
      cwd: typeof source.cwd === 'string' && source.cwd.trim() ? source.cwd : null,
      chats_dir: null,
    };
  });

  const report = buildReport(
    {
      mode,
      task: handoff.task,
      success_criteria: handoff.success_criteria.map(String),
      sources: sourceSpecs,
      constraints: Array.isArray(handoff.constraints) ? handoff.constraints.map(String) : [],
    },
    cwd
  );

  renderReport(report, asJson);
}

try {
  if (command === 'read') {
    runRead(args);
  } else if (command === 'compare') {
    runCompare(args);
  } else if (command === 'report') {
    runReport(args);
  } else if (command === 'list') {
    runList(args);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  const msg = error.message || String(error);
  if (hasFlag(args, '--json')) {
    console.log(JSON.stringify({ error_code: classifyError(msg), message: msg }, null, 2));
  } else {
    console.error(msg);
  }
  process.exit(1);
}
