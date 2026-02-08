pub mod codex;
pub mod gemini;
pub mod claude;
pub mod cursor;

use crate::agents::Session;
use anyhow::Result;
use serde_json::Value;
use std::path::{Path, PathBuf};

/// Trait for agent adapters. Each agent implementation provides
/// file resolution, session reading, and listing capabilities.
#[allow(dead_code)]
pub trait AgentAdapter {
    fn name(&self) -> &'static str;
    fn resolve(&self, id: Option<&str>, cwd: &str) -> Result<PathBuf>;
    fn read(&self, path: &Path, last_n: usize) -> Result<Session>;
    fn list(&self, cwd: &str, limit: usize) -> Result<Vec<Value>>;
}

/// Returns the adapter for the given agent name.
#[allow(dead_code)]
pub fn get_adapter(agent: &str) -> Option<Box<dyn AgentAdapter>> {
    match agent {
        "codex" => Some(Box::new(codex::CodexAdapter)),
        "gemini" => Some(Box::new(gemini::GeminiAdapter)),
        "claude" => Some(Box::new(claude::ClaudeAdapter)),
        "cursor" => Some(Box::new(cursor::CursorAdapter)),
        _ => None,
    }
}
