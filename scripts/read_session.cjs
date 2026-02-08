const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Parse arguments
const args = process.argv.slice(2);
const agentArg = args.find(a => a.startsWith('--agent='));
const idArg = args.find(a => a.startsWith('--id='));
const chatsDirArg = args.find(a => a.startsWith('--chats-dir='));
const cwdArg = args.find(a => a.startsWith('--cwd='));

const agent = agentArg ? agentArg.split('=')[1] : 'codex';
const sessionId = idArg ? idArg.split('=')[1] : null;
const geminiChatsDir = chatsDirArg ? chatsDirArg.split('=')[1] : null;
const requestedCwd = normalizePath(cwdArg ? cwdArg.split('=')[1] : process.cwd());

// Helper to expand ~
function expandHome(filepath) {
  if (!filepath) return filepath;
  if (filepath.startsWith('~/')) {
    return path.join(os.homedir(), filepath.slice(2));
  }
  return filepath;
}

function normalizePath(filepath) {
  return path.resolve(expandHome(filepath));
}

// Helper to escape special regex characters in user input
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hashPath(filepath) {
  return crypto.createHash('sha256').update(normalizePath(filepath)).digest('hex');
}

function readJsonlLines(filePath) {
  return fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
}

function collectMatchingFiles(dirPath, pattern, recursive = false) {
    const expandedDir = expandHome(dirPath);
    if (!expandedDir || !fs.existsSync(expandedDir)) return [];

    const matches = [];
    function search(currentDir) {
        let entries = [];
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch (e) {
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                if (recursive) search(fullPath);
                continue;
            }

            if (!entry.name.match(pattern)) continue;
            try {
                const stat = fs.statSync(fullPath);
                matches.push({ path: fullPath, mtimeMs: stat.mtimeMs });
            } catch (e) {
                // Ignore files that disappear while scanning.
            }
        }
    }
    search(expandedDir);
    matches.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return matches;
}

function findLatestFile(dirPath, pattern, recursive = false) {
    const files = collectMatchingFiles(dirPath, pattern, recursive);
    return files.length > 0 ? files[0].path : null;
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
    } catch (e) {
        return null;
    }
    return null;
}

function getClaudeSessionCwd(filePath) {
    try {
        const lines = readJsonlLines(filePath);
        for (const line of lines) {
            let json = null;
            try {
                json = JSON.parse(line);
            } catch (e) {
                continue;
            }
            if (typeof json.cwd === 'string') {
                return normalizePath(json.cwd);
            }
        }
    } catch (e) {
        return null;
    }
    return null;
}

function resolveCodexTargetFile(id, cwd) {
    const baseDir = expandHome('~/.codex/sessions');
    if (!fs.existsSync(baseDir)) return null;

    if (id) {
        const escaped = escapeRegex(id);
        return findLatestFile(baseDir, new RegExp(`.*${escaped}.*\\.jsonl`), true);
    }

    const allFiles = collectMatchingFiles(baseDir, /.*\.jsonl$/, true);
    if (allFiles.length === 0) return null;

    const scoped = findLatestByCwd(allFiles, getCodexSessionCwd, cwd);
    if (scoped) return scoped;

    console.error(`Warning: no Codex session matched cwd ${cwd}; falling back to latest session.`);
    return allFiles[0].path;
}

function listGeminiChatDirs() {
    const tmpBase = expandHome('~/.gemini/tmp');
    if (!fs.existsSync(tmpBase)) return [];

    let entries = [];
    try {
        entries = fs.readdirSync(tmpBase, { withFileTypes: true });
    } catch (e) {
        return [];
    }

    const dirs = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const chatsDir = path.join(tmpBase, entry.name, 'chats');
        if (fs.existsSync(chatsDir)) {
            dirs.push(chatsDir);
        }
    }
    return dirs;
}

function resolveGeminiChatDirs(chatsDir, cwd) {
    if (chatsDir) {
        const expanded = expandHome(chatsDir);
        return fs.existsSync(expanded) ? [expanded] : [];
    }

    const ordered = [];
    const seen = new Set();
    function addDir(dirPath) {
        if (!dirPath) return;
        if (seen.has(dirPath)) return;
        if (!fs.existsSync(dirPath)) return;
        ordered.push(dirPath);
        seen.add(dirPath);
    }

    const scopedHash = hashPath(cwd);
    const scopedDir = expandHome(`~/.gemini/tmp/${scopedHash}/chats`);
    addDir(scopedDir);

    for (const dir of listGeminiChatDirs()) {
        addDir(dir);
    }
    return ordered;
}

function resolveGeminiTargetFile(id, chatsDir, cwd) {
    const dirs = resolveGeminiChatDirs(chatsDir, cwd);
    if (dirs.length === 0) return { targetFile: null, searchedDirs: [] };

    const pattern = id
        ? new RegExp(`.*${escapeRegex(id)}.*\\.json`)
        : /session-.*\.json$/;

    const candidates = [];
    for (const dir of dirs) {
        const files = collectMatchingFiles(dir, pattern, false);
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

function resolveClaudeTargetFile(id, cwd) {
    const baseDir = expandHome('~/.claude/projects');
    if (!fs.existsSync(baseDir)) return null;

    if (id) {
        const escaped = escapeRegex(id);
        return findLatestFile(baseDir, new RegExp(`.*${escaped}.*\\.jsonl`), true);
    }

    const allFiles = collectMatchingFiles(baseDir, /.*\.jsonl$/, true);
    if (allFiles.length === 0) return null;

    const scoped = findLatestByCwd(allFiles, getClaudeSessionCwd, cwd);
    if (scoped) return scoped;

    console.error(`Warning: no Claude session matched cwd ${cwd}; falling back to latest session.`);
    return allFiles[0].path;
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

// Read Codex Session
function readCodexSession(id, cwd) {
    const targetFile = resolveCodexTargetFile(id, cwd);
    if (!targetFile) {
        console.error('No Codex session found.');
        process.exit(1);
    }

    const lines = readJsonlLines(targetFile);
    const messages = [];
    let skipped = 0;

    lines.forEach(line => {
        try {
            const json = JSON.parse(line);
            if (json.type === 'response_item' && json.payload.type === 'message') {
                messages.push(json.payload);
            } else if (json.type === 'event_msg' && json.payload.type === 'agent_message') {
                messages.push({ role: 'assistant', content: json.payload.message });
            }
        } catch (e) {
            skipped++;
        }
    });

    if (skipped > 0) {
        console.error(`Warning: skipped ${skipped} unparseable line(s) in ${targetFile}`);
    }

    console.log(`SOURCE: Codex Session (${targetFile})`);
    console.log('---');

    if (messages.length > 0) {
        const assistantMsgs = messages.filter(m => (m.role || '').toLowerCase() === 'assistant');
        const msg = assistantMsgs.length > 0 ? assistantMsgs[assistantMsgs.length - 1] : messages[messages.length - 1];
        console.log(extractText(msg.content) || '[No text content]');
    } else {
        console.log("Could not extract structured messages. Showing last 20 raw lines:");
        console.log(lines.slice(-20).join('\n'));
    }
}

// Read Gemini Session
function readGeminiSession(id, chatsDir, cwd) {
    const resolved = resolveGeminiTargetFile(id, chatsDir, cwd);
    const targetFile = resolved.targetFile;
    if (!targetFile) {
        if (chatsDir) {
            console.error('No Gemini session found in ' + expandHome(chatsDir));
        } else {
            console.error('No Gemini session found. Searched chats directories:');
            for (const dir of resolved.searchedDirs) {
                console.error(' - ' + dir);
            }
        }
        process.exit(1);
    }

    const content = fs.readFileSync(targetFile, 'utf-8');
    try {
        const session = JSON.parse(content);
        console.log(`SOURCE: Gemini Session (${targetFile})`);
        console.log('---');

        // Actual Gemini CLI format: { sessionId, messages: [ { type: "user"|"gemini", content: "..." } ] }
        if (Array.isArray(session.messages)) {
            const lastMsg =
                [...session.messages].reverse().find(m => {
                    const type = (m.type || '').toLowerCase();
                    return type === 'gemini' || type === 'assistant' || type === 'model';
                }) || session.messages[session.messages.length - 1];
            if (lastMsg) {
                const role = (lastMsg.type || 'unknown').toUpperCase();
                console.log(`[${role}]`);
                if (typeof lastMsg.content === 'string') {
                    console.log(lastMsg.content);
                } else {
                    console.log(extractText(lastMsg.content) || '[No text content]');
                }
            } else {
                console.error('Gemini session has no messages.');
                process.exit(1);
            }
        } else if (session.history) {
            // Legacy/API format fallback: { history: [ { role, parts: [...] } ] }
            const lastTurn =
                [...session.history].reverse().find(turn => (turn.role || '').toLowerCase() !== 'user') ||
                session.history[session.history.length - 1];
            if (lastTurn) {
                console.log(`[${lastTurn.role.toUpperCase()}]`);
                if (Array.isArray(lastTurn.parts)) {
                    console.log(lastTurn.parts.map(p => p.text || '').join('\n'));
                } else if (typeof lastTurn.parts === 'string') {
                    console.log(lastTurn.parts);
                } else {
                    console.log('[No text content]');
                }
            } else {
                console.error('Gemini history is empty.');
                process.exit(1);
            }
        } else {
             console.error('Unknown Gemini session schema. Supported fields: messages, history.');
             process.exit(1);
        }
    } catch (e) {
        console.error("Failed to parse Gemini JSON:", e.message);
        process.exit(1);
    }
}

// Read Claude Session
function readClaudeSession(id, cwd) {
    const baseDir = expandHome('~/.claude/projects');
    if (!fs.existsSync(baseDir)) {
        console.error('Claude projects directory not found: ' + baseDir);
        process.exit(1);
    }

    const targetFile = resolveClaudeTargetFile(id, cwd);
    if (!targetFile) {
        console.error('No Claude session found.');
        process.exit(1);
    }

    const lines = readJsonlLines(targetFile);
    const messages = [];
    let skipped = 0;

    lines.forEach(line => {
        try {
            const json = JSON.parse(line);
            // Claude JSONL: { type: "assistant", message: { role: "assistant", content: [...] } }
            const msg = json.message || json;
            if (json.type === 'assistant' || msg.role === 'assistant') {
                let text = '';
                const content = msg.content || json.content;
                if (typeof content === 'string') {
                    text = content;
                } else if (Array.isArray(content)) {
                    text = content
                        .filter(c => c.type === 'text')
                        .map(c => c.text)
                        .join('');
                }
                if (text) {
                    messages.push(text);
                }
            }
        } catch (e) {
            skipped++;
        }
    });

    if (skipped > 0) {
        console.error(`Warning: skipped ${skipped} unparseable line(s) in ${targetFile}`);
    }

    console.log(`SOURCE: Claude Session (${targetFile})`);
    console.log('---');

    if (messages.length > 0) {
        // Show the last assistant message
        console.log(messages[messages.length - 1]);
    } else {
        console.log("Could not extract assistant messages. Showing last 20 raw lines:");
        console.log(lines.slice(-20).join('\n'));
    }
}

// Main Dispatch
if (agent === 'codex') {
    readCodexSession(sessionId, requestedCwd);
} else if (agent === 'gemini') {
    readGeminiSession(sessionId, geminiChatsDir, requestedCwd);
} else if (agent === 'claude') {
    readClaudeSession(sessionId, requestedCwd);
} else {
    console.error(`Unknown agent: ${agent}. Supported: codex, gemini, claude`);
    process.exit(1);
}
