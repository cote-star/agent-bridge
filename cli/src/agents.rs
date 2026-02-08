use crate::utils::{expand_home, hash_path, normalize_path};
use anyhow::{anyhow, Context, Result};
use serde_json::Value;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Debug)]
pub struct Session {
    pub agent: &'static str,
    pub content: String,
    pub source: String,
    pub warnings: Vec<String>,
}

#[derive(Clone)]
struct FileEntry {
    path: PathBuf,
    mtime_ms: u128,
}

pub fn read_codex_session(id: Option<&str>, cwd: &str) -> Result<Session> {
    let base_dir = codex_base_dir();
    if !base_dir.exists() {
        return Err(anyhow!("No Codex session found."));
    }

    let mut warnings = Vec::new();
    let target_file = if let Some(id_value) = id {
        let files = collect_matching_files(&base_dir, true, &|file_path| {
            has_extension(file_path, "jsonl") && path_contains(file_path, id_value)
        })?;
        files
            .first()
            .map(|f| f.path.clone())
            .context("No Codex session found.")?
    } else {
        let files = collect_matching_files(&base_dir, true, &|file_path| has_extension(file_path, "jsonl"))?;
        if files.is_empty() {
            return Err(anyhow!("No Codex session found."));
        }

        let expected_cwd = normalize_path(cwd)?;
        if let Some(scoped) = find_latest_by_cwd(&files, &expected_cwd, get_codex_session_cwd) {
            scoped
        } else {
            warnings.push(format!(
                "Warning: no Codex session matched cwd {}; falling back to latest session.",
                expected_cwd.display()
            ));
            files[0].path.clone()
        }
    };

    let parsed = parse_codex_jsonl(&target_file)?;
    warnings.extend(parsed.warnings);

    Ok(Session {
        agent: "codex",
        content: parsed.content,
        source: target_file.to_string_lossy().to_string(),
        warnings,
    })
}

pub fn read_claude_session(id: Option<&str>, cwd: &str) -> Result<Session> {
    let base_dir = claude_base_dir();
    if !base_dir.exists() {
        return Err(anyhow!("Claude projects directory not found: {}", base_dir.display()));
    }

    let mut warnings = Vec::new();
    let target_file = if let Some(id_value) = id {
        let files = collect_matching_files(&base_dir, true, &|file_path| {
            has_extension(file_path, "jsonl") && path_contains(file_path, id_value)
        })?;
        files
            .first()
            .map(|f| f.path.clone())
            .context("No Claude session found.")?
    } else {
        let files = collect_matching_files(&base_dir, true, &|file_path| has_extension(file_path, "jsonl"))?;
        if files.is_empty() {
            return Err(anyhow!("No Claude session found."));
        }

        let expected_cwd = normalize_path(cwd)?;
        if let Some(scoped) = find_latest_by_cwd(&files, &expected_cwd, get_claude_session_cwd) {
            scoped
        } else {
            warnings.push(format!(
                "Warning: no Claude session matched cwd {}; falling back to latest session.",
                expected_cwd.display()
            ));
            files[0].path.clone()
        }
    };

    let parsed = parse_claude_jsonl(&target_file)?;
    warnings.extend(parsed.warnings);

    Ok(Session {
        agent: "claude",
        content: parsed.content,
        source: target_file.to_string_lossy().to_string(),
        warnings,
    })
}

pub fn read_gemini_session(id: Option<&str>, cwd: &str, chats_dir: Option<&str>) -> Result<Session> {
    let dirs = resolve_gemini_chat_dirs(chats_dir, cwd)?;
    if dirs.is_empty() {
        return Err(anyhow!("No Gemini session found. Searched chats directories:"));
    }

    let target_file = if let Some(id_value) = id {
        let mut candidates = Vec::new();
        for dir in &dirs {
            let mut files = collect_matching_files(dir, false, &|file_path| {
                has_extension(file_path, "json") && path_contains(file_path, id_value)
            })?;
            candidates.append(&mut files);
        }
        sort_files_by_mtime_desc(&mut candidates);
        candidates
            .first()
            .map(|f| f.path.clone())
            .context("No Gemini session found.")?
    } else {
        let mut candidates = Vec::new();
        for dir in &dirs {
            let mut files = collect_matching_files(dir, false, &|file_path| {
                has_extension(file_path, "json")
                    && file_path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|name| name.starts_with("session-"))
                        .unwrap_or(false)
            })?;
            candidates.append(&mut files);
        }
        sort_files_by_mtime_desc(&mut candidates);
        candidates
            .first()
            .map(|f| f.path.clone())
            .context("No Gemini session found.")?
    };

    let parsed = parse_gemini_json(&target_file)?;

    Ok(Session {
        agent: "gemini",
        content: parsed.content,
        source: target_file.to_string_lossy().to_string(),
        warnings: parsed.warnings,
    })
}

struct ParsedContent {
    content: String,
    warnings: Vec<String>,
}

fn parse_codex_jsonl(path: &Path) -> Result<ParsedContent> {
    let lines = read_jsonl_lines(path)?;
    let mut messages: Vec<Value> = Vec::new();
    let mut skipped = 0usize;

    for line in &lines {
        match serde_json::from_str::<Value>(line) {
            Ok(json) => {
                if json["type"] == "response_item" && json["payload"]["type"] == "message" {
                    messages.push(json["payload"].clone());
                } else if json["type"] == "event_msg" && json["payload"]["type"] == "agent_message" {
                    let payload = &json["payload"];
                    messages.push(serde_json::json!({
                        "role": "assistant",
                        "content": payload["message"].clone()
                    }));
                }
            }
            Err(_) => skipped += 1,
        }
    }

    let mut warnings = Vec::new();
    if skipped > 0 {
        warnings.push(format!(
            "Warning: skipped {} unparseable line(s) in {}",
            skipped,
            path.display()
        ));
    }

    if !messages.is_empty() {
        let mut selected = messages.last().cloned();
        for message in messages.iter().rev() {
            if message["role"].as_str().unwrap_or("").eq_ignore_ascii_case("assistant") {
                selected = Some(message.clone());
                break;
            }
        }

        if let Some(message) = selected {
            let text = extract_text(&message["content"]);
            return Ok(ParsedContent {
                content: if text.is_empty() {
                    "[No text content]".to_string()
                } else {
                    redact_sensitive_text(&text)
                },
                warnings,
            });
        }
    }

    Ok(ParsedContent {
        content: redact_sensitive_text(&format!(
            "Could not extract structured messages. Showing last 20 raw lines:\n{}",
            lines
                .iter()
                .rev()
                .take(20)
                .cloned()
                .collect::<Vec<String>>()
                .into_iter()
                .rev()
                .collect::<Vec<String>>()
                .join("\n")
        )),
        warnings,
    })
}

fn parse_claude_jsonl(path: &Path) -> Result<ParsedContent> {
    let lines = read_jsonl_lines(path)?;
    let mut messages: Vec<String> = Vec::new();
    let mut skipped = 0usize;

    for line in &lines {
        match serde_json::from_str::<Value>(line) {
            Ok(json) => {
                let message = if json.get("message").is_some() {
                    &json["message"]
                } else {
                    &json
                };

                let is_assistant = json["type"] == "assistant"
                    || message["role"]
                        .as_str()
                        .map(|role| role.eq_ignore_ascii_case("assistant"))
                        .unwrap_or(false);

                if !is_assistant {
                    continue;
                }

                let content_field = if message.get("content").is_some() {
                    &message["content"]
                } else {
                    &json["content"]
                };
                let text = extract_claude_text(content_field);
                if !text.is_empty() {
                    messages.push(text);
                }
            }
            Err(_) => skipped += 1,
        }
    }

    let mut warnings = Vec::new();
    if skipped > 0 {
        warnings.push(format!(
            "Warning: skipped {} unparseable line(s) in {}",
            skipped,
            path.display()
        ));
    }

    if let Some(last) = messages.last() {
        return Ok(ParsedContent {
            content: redact_sensitive_text(last),
            warnings,
        });
    }

    Ok(ParsedContent {
        content: redact_sensitive_text(&format!(
            "Could not extract assistant messages. Showing last 20 raw lines:\n{}",
            lines
                .iter()
                .rev()
                .take(20)
                .cloned()
                .collect::<Vec<String>>()
                .into_iter()
                .rev()
                .collect::<Vec<String>>()
                .join("\n")
        )),
        warnings,
    })
}

fn parse_gemini_json(path: &Path) -> Result<ParsedContent> {
    let content = fs::read_to_string(path)?;
    let session: Value = serde_json::from_str(&content)
        .map_err(|e| anyhow!("Failed to parse Gemini JSON: {}", e))?;

    if let Some(messages) = session["messages"].as_array() {
        let selected = messages
            .iter()
            .rev()
            .find(|message| {
                message["type"]
                    .as_str()
                    .map(|t| {
                        let lower = t.to_ascii_lowercase();
                        lower == "gemini" || lower == "assistant" || lower == "model"
                    })
                    .unwrap_or(false)
            })
            .or_else(|| messages.last());

        if let Some(message) = selected {
            return Ok(ParsedContent {
                content: {
                    let text = extract_text(&message["content"]);
                    if text.is_empty() {
                        "[No text content]".to_string()
                    } else {
                        redact_sensitive_text(&text)
                    }
                },
                warnings: Vec::new(),
            });
        }
        return Err(anyhow!("Gemini session has no messages."));
    }

    if let Some(history) = session["history"].as_array() {
        let selected = history
            .iter()
            .rev()
            .find(|turn| {
                !turn["role"]
                    .as_str()
                    .map(|role| role.eq_ignore_ascii_case("user"))
                    .unwrap_or(false)
            })
            .or_else(|| history.last());

        if let Some(turn) = selected {
            let parts = &turn["parts"];
            let text = if let Some(arr) = parts.as_array() {
                arr.iter()
                    .map(|part| part["text"].as_str().unwrap_or(""))
                    .collect::<Vec<&str>>()
                    .join("\n")
            } else if let Some(raw) = parts.as_str() {
                raw.to_string()
            } else {
                "[No text content]".to_string()
            };

            return Ok(ParsedContent {
                content: redact_sensitive_text(&text),
                warnings: Vec::new(),
            });
        }

        return Err(anyhow!("Gemini history is empty."));
    }

    Err(anyhow!(
        "Unknown Gemini session schema. Supported fields: messages, history."
    ))
}

fn extract_text(value: &Value) -> String {
    if let Some(raw) = value.as_str() {
        return raw.to_string();
    }

    if let Some(parts) = value.as_array() {
        return parts
            .iter()
            .map(|part| {
                if let Some(raw) = part.as_str() {
                    raw.to_string()
                } else {
                    part["text"].as_str().unwrap_or("").to_string()
                }
            })
            .collect::<Vec<String>>()
            .join("");
    }

    String::new()
}

fn extract_claude_text(value: &Value) -> String {
    if let Some(raw) = value.as_str() {
        return raw.to_string();
    }

    if let Some(parts) = value.as_array() {
        return parts
            .iter()
            .filter_map(|part| {
                if part["type"].as_str().unwrap_or("") == "text" {
                    Some(part["text"].as_str().unwrap_or(""))
                } else {
                    None
                }
            })
            .collect::<Vec<&str>>()
            .join("");
    }

    String::new()
}

fn read_jsonl_lines(path: &Path) -> Result<Vec<String>> {
    let file = fs::File::open(path)?;
    let reader = BufReader::new(file);
    Ok(reader.lines().map_while(Result::ok).collect())
}

fn find_latest_by_cwd(
    files: &[FileEntry],
    expected_cwd: &Path,
    cwd_extractor: fn(&Path) -> Option<PathBuf>,
) -> Option<PathBuf> {
    for file in files {
        if let Some(file_cwd) = cwd_extractor(&file.path) {
            if file_cwd == expected_cwd {
                return Some(file.path.clone());
            }
        }
    }
    None
}

fn get_codex_session_cwd(file_path: &Path) -> Option<PathBuf> {
    let lines = read_jsonl_lines(file_path).ok()?;
    let first = lines.first()?;
    let json: Value = serde_json::from_str(first).ok()?;
    let cwd = json["payload"]["cwd"].as_str()?;
    normalize_path(cwd).ok()
}

fn get_claude_session_cwd(file_path: &Path) -> Option<PathBuf> {
    let lines = read_jsonl_lines(file_path).ok()?;
    for line in lines {
        let json: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if let Some(cwd) = json["cwd"].as_str() {
            if let Ok(path) = normalize_path(cwd) {
                return Some(path);
            }
        }
    }
    None
}

fn resolve_gemini_chat_dirs(chats_dir: Option<&str>, cwd: &str) -> Result<Vec<PathBuf>> {
    if let Some(dir) = chats_dir {
        let expanded = expand_home(dir).context("Invalid Gemini chats directory")?;
        return if expanded.exists() {
            Ok(vec![expanded])
        } else {
            Ok(Vec::new())
        };
    }

    let mut ordered = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let add_dir = |dir: PathBuf, ordered_dirs: &mut Vec<PathBuf>, seen_dirs: &mut std::collections::HashSet<PathBuf>| {
        if !dir.exists() {
            return;
        }
        if seen_dirs.insert(dir.clone()) {
            ordered_dirs.push(dir);
        }
    };

    let normalized_cwd = normalize_path(cwd)?;
    let scoped_hash = hash_path(&normalized_cwd);

    let tmp_base = gemini_tmp_base_dir();
    add_dir(
        tmp_base.join(&scoped_hash).join("chats"),
        &mut ordered,
        &mut seen,
    );

    if let Ok(entries) = fs::read_dir(&tmp_base) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                add_dir(path.join("chats"), &mut ordered, &mut seen);
            }
        }
    }

    Ok(ordered)
}

fn collect_matching_files<F>(dir: &Path, recursive: bool, predicate: &F) -> Result<Vec<FileEntry>>
where
    F: Fn(&Path) -> bool,
{
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut matches = Vec::new();
    let mut stack = vec![dir.to_path_buf()];

    while let Some(current) = stack.pop() {
        let entries = match fs::read_dir(&current) {
            Ok(v) => v,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if recursive {
                    stack.push(path);
                }
                continue;
            }

            if !predicate(&path) {
                continue;
            }

            let mtime = fs::metadata(&path)
                .and_then(|m| m.modified())
                .unwrap_or(SystemTime::UNIX_EPOCH);
            let mtime_ms = mtime
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis();

            matches.push(FileEntry { path, mtime_ms });
        }
    }

    sort_files_by_mtime_desc(&mut matches);
    Ok(matches)
}

fn sort_files_by_mtime_desc(files: &mut [FileEntry]) {
    files.sort_by(|a, b| b.mtime_ms.cmp(&a.mtime_ms));
}

fn has_extension(path: &Path, ext: &str) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case(ext))
        .unwrap_or(false)
}

fn path_contains(path: &Path, needle: &str) -> bool {
    path.to_string_lossy().contains(needle)
}

fn redact_sensitive_text(input: &str) -> String {
    let step1 = redact_openai_like_keys(input);
    let step2 = redact_aws_access_keys(&step1);
    let step3 = redact_bearer_tokens(&step2);
    redact_secret_assignments(&step3)
}

fn redact_openai_like_keys(input: &str) -> String {
    let mut output = String::new();
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0usize;

    while i < chars.len() {
        if i + 3 <= chars.len() && chars[i] == 's' && chars[i + 1] == 'k' && chars[i + 2] == '-' {
            let mut j = i + 3;
            while j < chars.len() && chars[j].is_ascii_alphanumeric() {
                j += 1;
            }
            if j.saturating_sub(i + 3) >= 20 {
                output.push_str("sk-[REDACTED]");
                i = j;
                continue;
            }
        }
        output.push(chars[i]);
        i += 1;
    }

    output
}

fn redact_aws_access_keys(input: &str) -> String {
    let mut output = String::new();
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0usize;

    while i < chars.len() {
        if i + 20 <= chars.len()
            && chars[i] == 'A'
            && chars[i + 1] == 'K'
            && chars[i + 2] == 'I'
            && chars[i + 3] == 'A'
        {
            let mut valid = true;
            for ch in chars.iter().take(i + 20).skip(i + 4) {
                if !ch.is_ascii_uppercase() && !ch.is_ascii_digit() {
                    valid = false;
                    break;
                }
            }
            if valid {
                output.push_str("AKIA[REDACTED]");
                i += 20;
                continue;
            }
        }
        output.push(chars[i]);
        i += 1;
    }

    output
}

fn redact_bearer_tokens(input: &str) -> String {
    let mut out = input.to_string();
    loop {
        let lower = out.to_ascii_lowercase();
        let Some(start) = lower.find("bearer ") else {
            break;
        };
        let token_start = start + "bearer ".len();
        let mut token_end = token_start;
        let bytes = out.as_bytes();
        while token_end < bytes.len() {
            let ch = bytes[token_end] as char;
            if ch.is_ascii_alphanumeric() || ch == '.' || ch == '_' || ch == '-' {
                token_end += 1;
            } else {
                break;
            }
        }
        if token_end.saturating_sub(token_start) < 10 {
            break;
        }
        out.replace_range(start..token_end, "Bearer [REDACTED]");
    }
    out
}

fn redact_secret_assignments(input: &str) -> String {
    let keywords = ["api_key", "apikey", "token", "secret", "password"];
    let mut output = input.to_string();

    for key in keywords {
        output = redact_assignment_for_key(&output, key);
    }

    output
}

fn redact_assignment_for_key(input: &str, keyword: &str) -> String {
    let mut out = input.to_string();
    let mut search_from = 0usize;

    while search_from < out.len() {
        let lower = out.to_ascii_lowercase();
        let Some(relative) = lower[search_from..].find(keyword) else {
            break;
        };
        let start = search_from + relative;

        let mut idx = start + keyword.len();
        while idx < out.len() && out.as_bytes()[idx].is_ascii_whitespace() {
            idx += 1;
        }
        if idx >= out.len() {
            break;
        }

        let separator = out.as_bytes()[idx] as char;
        if separator != ':' && separator != '=' {
            search_from = start + keyword.len();
            continue;
        }

        idx += 1;
        while idx < out.len() && out.as_bytes()[idx].is_ascii_whitespace() {
            idx += 1;
        }
        if idx >= out.len() {
            break;
        }

        let quote = out.as_bytes()[idx] as char;
        let quoted = quote == '"' || quote == '\'';
        if quoted {
            idx += 1;
        }

        let value_start = idx;
        while idx < out.len() {
            let ch = out.as_bytes()[idx] as char;
            if quoted {
                if ch == quote {
                    break;
                }
            } else if ch.is_ascii_whitespace() || ch == ',' || ch == ';' {
                break;
            }
            idx += 1;
        }

        if idx > value_start {
            out.replace_range(value_start..idx, "[REDACTED]");
            search_from = value_start + "[REDACTED]".len();
        } else {
            search_from = idx.saturating_add(1);
        }
    }

    out
}

fn codex_base_dir() -> PathBuf {
    std::env::var("BRIDGE_CODEX_SESSIONS_DIR")
        .ok()
        .and_then(|value| expand_home(&value))
        .unwrap_or_else(|| expand_home("~/.codex/sessions").unwrap_or_else(|| PathBuf::from("~/.codex/sessions")))
}

fn claude_base_dir() -> PathBuf {
    std::env::var("BRIDGE_CLAUDE_PROJECTS_DIR")
        .ok()
        .and_then(|value| expand_home(&value))
        .unwrap_or_else(|| expand_home("~/.claude/projects").unwrap_or_else(|| PathBuf::from("~/.claude/projects")))
}

fn gemini_tmp_base_dir() -> PathBuf {
    std::env::var("BRIDGE_GEMINI_TMP_DIR")
        .ok()
        .and_then(|value| expand_home(&value))
        .unwrap_or_else(|| expand_home("~/.gemini/tmp").unwrap_or_else(|| PathBuf::from("~/.gemini/tmp")))
}
