/**
 * Cursor agent adapter.
 */

const fs = require('fs');
const path = require('path');
const {
  normalizePath, collectMatchingFiles, getFileTimestamp, redactSensitiveText,
} = require('./utils.cjs');

const cursorDataBase = normalizePath(process.env.BRIDGE_CURSOR_DATA_DIR || (
  process.platform === 'darwin'
    ? '~/Library/Application Support/Cursor'
    : '~/.cursor'
));

function getWorkspacesDir() {
  return path.join(cursorDataBase, 'User', 'workspaceStorage');
}

function isCursorFile(name) {
  return (name.endsWith('.json') || name.endsWith('.jsonl'))
    && (name.includes('chat') || name.includes('composer') || name.includes('conversation'));
}

function resolve(id, cwd, opts) {
  if (!fs.existsSync(cursorDataBase)) return null;
  const workspacesDir = getWorkspacesDir();
  if (!fs.existsSync(workspacesDir)) return null;

  const files = collectMatchingFiles(workspacesDir, (fullPath, name) => {
    if (!isCursorFile(name)) return false;
    if (id) return fullPath.includes(id);
    return true;
  }, true);

  return files.length > 0 ? { path: files[0].path, warnings: [] } : null;
}

function read(filePath, lastN) {
  lastN = lastN || 1;
  const raw = fs.readFileSync(filePath, 'utf-8');
  let content = '';
  let messageCount = 0;

  try {
    const json = JSON.parse(raw);
    if (Array.isArray(json.messages)) {
      const assistantMsgs = json.messages.filter(m => m.role === 'assistant');
      messageCount = assistantMsgs.length;
      content = assistantMsgs.length > 0
        ? (assistantMsgs[assistantMsgs.length - 1].content || '[No text content]')
        : '[No assistant messages found]';
    } else if (typeof json.content === 'string') {
      content = json.content;
      messageCount = 1;
    } else {
      content = JSON.stringify(json, null, 2);
    }
  } catch (error) {
    const lines = raw.split('\n').filter(Boolean);
    const msgs = [];
    for (const line of lines) {
      try {
        const json = JSON.parse(line);
        if (json.role === 'assistant' && typeof json.content === 'string') {
          msgs.push(json.content);
        }
      } catch (e) { /* skip */ }
    }
    messageCount = msgs.length;
    content = msgs.length > 0 ? msgs[msgs.length - 1] : lines.slice(-20).join('\n');
  }

  const sessionId = path.basename(filePath, path.extname(filePath));

  return {
    agent: 'cursor',
    source: filePath,
    content: redactSensitiveText(content),
    warnings: [],
    session_id: sessionId,
    cwd: null,
    timestamp: getFileTimestamp(filePath),
    message_count: messageCount,
    messages_returned: 1,
  };
}

function list(cwd, limit) {
  limit = limit || 10;
  if (!fs.existsSync(cursorDataBase)) return [];
  const workspacesDir = getWorkspacesDir();
  if (!fs.existsSync(workspacesDir)) return [];

  const files = collectMatchingFiles(workspacesDir, (_fp, name) => isCursorFile(name), true);
  return files.slice(0, limit).map(f => ({
    session_id: path.basename(f.path, path.extname(f.path)),
    agent: 'cursor',
    cwd: null,
    modified_at: getFileTimestamp(f.path),
    file_path: f.path,
  }));
}

module.exports = { resolve, read, list };
