pub mod codex;
pub mod gemini;
pub mod claude;
pub mod cursor;

use crate::agents::Session;
use anyhow::Result;
use serde_json::Value;

/// Trait for agent adapters. Each agent implementation provides
/// file resolution, session reading, and listing capabilities.
pub trait AgentAdapter {
    fn read_session(
        &self,
        id: Option<&str>,
        cwd: &str,
        chats_dir: Option<&str>,
        last_n: usize,
    ) -> Result<Session>;
    fn list_sessions(&self, cwd: Option<&str>, limit: usize) -> Result<Vec<Value>>;
    fn search_sessions(&self, query: &str, cwd: Option<&str>, limit: usize) -> Result<Vec<Value>>;
}

/// Returns the adapter for the given agent name.
pub fn get_adapter(agent: &str) -> Option<Box<dyn AgentAdapter>> {
    match agent {
        "codex" => Some(Box::new(codex::CodexAdapter)),
        "gemini" => Some(Box::new(gemini::GeminiAdapter)),
        "claude" => Some(Box::new(claude::ClaudeAdapter)),
        "cursor" => Some(Box::new(cursor::CursorAdapter)),
        _ => None,
    }
}
