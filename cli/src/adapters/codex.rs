use super::AgentAdapter;
use crate::agents::{self, Session};
use anyhow::Result;
use serde_json::Value;
use std::path::{Path, PathBuf};

pub struct CodexAdapter;

impl AgentAdapter for CodexAdapter {
    fn name(&self) -> &'static str {
        "codex"
    }

    fn resolve(&self, id: Option<&str>, cwd: &str) -> Result<PathBuf> {
        // Delegate to existing agents module which handles resolution internally
        let session = agents::read_codex_session(id, cwd)?;
        Ok(PathBuf::from(&session.source))
    }

    fn read(&self, _path: &Path, _last_n: usize) -> Result<Session> {
        // The agents module resolves and reads in one step.
        // For the adapter pattern, we pass through to the existing implementation.
        // In a future refactor, this could be split.
        Err(anyhow::anyhow!("Use read_codex_session_with_last directly"))
    }

    fn list(&self, cwd: &str, limit: usize) -> Result<Vec<Value>> {
        agents::list_codex_sessions(cwd, limit)
    }
}
