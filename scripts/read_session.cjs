const fs = require('fs');
const path = require('path');
const os = require('os');

// Parse arguments
const args = process.argv.slice(2);
const agentArg = args.find(a => a.startsWith('--agent='));
const idArg = args.find(a => a.startsWith('--id='));
const chatsDirArg = args.find(a => a.startsWith('--chats-dir='));

const agent = agentArg ? agentArg.split('=')[1] : 'codex';
const sessionId = idArg ? idArg.split('=')[1] : null;
const geminiChatsDir = chatsDirArg ? chatsDirArg.split('=')[1] : null;

// Helper to expand ~
function expandHome(filepath) {
  if (filepath.startsWith('~/')) {
    return path.join(os.homedir(), filepath.slice(2));
  }
  return filepath;
}

// Helper to escape special regex characters in user input
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper to find latest file in directory recursively or flat
function findLatestFile(dirPath, pattern, recursive = false) {
    if (!fs.existsSync(dirPath)) return null;

    let latestFile = null;
    let latestMtime = 0;

    function search(currentDir) {
        const files = fs.readdirSync(currentDir);
        for (const file of files) {
            const fullPath = path.join(currentDir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                if (recursive) search(fullPath);
            } else if (file.match(pattern)) {
                if (stat.mtimeMs > latestMtime) {
                    latestMtime = stat.mtimeMs;
                    latestFile = fullPath;
                }
            }
        }
    }
    search(dirPath);
    return latestFile;
}

// Read Codex Session
function readCodexSession(id) {
    const baseDir = expandHome('~/.codex/sessions');
    let targetFile = null;

    if (id) {
        const escaped = escapeRegex(id);
        targetFile = findLatestFile(baseDir, new RegExp(`.*${escaped}.*\\.jsonl`), true);
    } else {
        const date = new Date();
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');

        const todayDir = path.join(baseDir, `${y}/${m}/${d}`);
        targetFile = findLatestFile(todayDir, /.*\.jsonl$/);

        if (!targetFile) {
            targetFile = findLatestFile(baseDir, /.*\.jsonl$/, true);
        }
    }

    if (!targetFile) {
        console.error('No Codex session found.');
        process.exit(1);
    }

    const content = fs.readFileSync(targetFile, 'utf-8');
    const lines = content.trim().split('\n');
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
        const lastMsg = messages[messages.length - 1];
        if (Array.isArray(lastMsg.content)) {
             console.log(lastMsg.content.map(c => c.text || '').join(''));
        } else {
             console.log(lastMsg.content);
        }
    } else {
        console.log("Could not extract structured messages. Showing last 20 raw lines:");
        console.log(lines.slice(-20).join('\n'));
    }
}

// Read Gemini Session
function readGeminiSession(id, chatsDir) {
    if (!chatsDir) {
        console.error('Gemini chats directory not provided (--chats-dir).');
        process.exit(1);
    }

    const expandedDir = expandHome(chatsDir);
    let targetFile = null;
    if (id) {
        const escaped = escapeRegex(id);
        targetFile = findLatestFile(expandedDir, new RegExp(`.*${escaped}.*\\.json`), false);
    } else {
        targetFile = findLatestFile(expandedDir, /session-.*\.json$/);
    }

    if (!targetFile) {
        console.error('No Gemini session found in ' + expandedDir);
        process.exit(1);
    }

    const content = fs.readFileSync(targetFile, 'utf-8');
    try {
        const session = JSON.parse(content);
        console.log(`SOURCE: Gemini Session (${targetFile})`);
        console.log('---');

        // Actual Gemini CLI format: { sessionId, messages: [ { type: "user"|"gemini", content: "..." } ] }
        if (Array.isArray(session.messages)) {
            const lastMsg = session.messages[session.messages.length - 1];
            if (lastMsg) {
                const role = (lastMsg.type || 'unknown').toUpperCase();
                console.log(`[${role}]`);
                console.log(lastMsg.content || '');
            }
        } else if (session.history) {
            // Legacy/API format fallback: { history: [ { role, parts: [...] } ] }
            const lastTurn = session.history[session.history.length - 1];
            if (lastTurn) {
                console.log(`[${lastTurn.role.toUpperCase()}]`);
                if (Array.isArray(lastTurn.parts)) {
                    console.log(lastTurn.parts.map(p => p.text).join('\n'));
                } else if (typeof lastTurn.parts === 'string') {
                    console.log(lastTurn.parts);
                }
            }
        } else {
             console.log("Unknown JSON structure. Dumping summary:");
             console.log(JSON.stringify(session, null, 2).slice(0, 1000) + "...");
        }
    } catch (e) {
        console.error("Failed to parse Gemini JSON:", e.message);
    }
}

// Read Claude Session
function readClaudeSession(id) {
    const baseDir = expandHome('~/.claude/projects');
    if (!fs.existsSync(baseDir)) {
        console.error('Claude projects directory not found: ' + baseDir);
        process.exit(1);
    }

    let targetFile = null;

    if (id) {
        const escaped = escapeRegex(id);
        targetFile = findLatestFile(baseDir, new RegExp(`.*${escaped}.*\\.jsonl`), true);
    } else {
        targetFile = findLatestFile(baseDir, /.*\.jsonl$/, true);
    }

    if (!targetFile) {
        console.error('No Claude session found.');
        process.exit(1);
    }

    const content = fs.readFileSync(targetFile, 'utf-8');
    const lines = content.trim().split('\n');
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
    readCodexSession(sessionId);
} else if (agent === 'gemini') {
    readGeminiSession(sessionId, geminiChatsDir);
} else if (agent === 'claude') {
    readClaudeSession(sessionId);
} else {
    console.error(`Unknown agent: ${agent}. Supported: codex, gemini, claude`);
    process.exit(1);
}
