use super::AgentAdapter;
use crate::agents::{self, Session};
use anyhow::Result;
use serde_json::Value;

pub struct CodexAdapter;

impl AgentAdapter for CodexAdapter {
    fn read_session(
        &self,
        id: Option<&str>,
        cwd: &str,
        _chats_dir: Option<&str>,
        last_n: usize,
    ) -> Result<Session> {
        agents::read_codex_session_with_last(id, cwd, last_n)
    }

    fn list_sessions(&self, cwd: Option<&str>, limit: usize) -> Result<Vec<Value>> {
        agents::list_codex_sessions(cwd, limit)
    }

    fn search_sessions(&self, query: &str, cwd: Option<&str>, limit: usize) -> Result<Vec<Value>> {
        agents::search_codex_sessions(query, cwd, limit)
    }
}
