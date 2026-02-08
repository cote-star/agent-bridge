use super::AgentAdapter;
use crate::agents::{self, Session};
use anyhow::Result;
use serde_json::Value;

pub struct GeminiAdapter;

impl AgentAdapter for GeminiAdapter {
    fn read_session(
        &self,
        id: Option<&str>,
        cwd: &str,
        chats_dir: Option<&str>,
        last_n: usize,
    ) -> Result<Session> {
        agents::read_gemini_session_with_last(id, cwd, chats_dir, last_n)
    }

    fn list_sessions(&self, cwd: Option<&str>, limit: usize) -> Result<Vec<Value>> {
        agents::list_gemini_sessions(cwd, limit)
    }

    fn search_sessions(&self, query: &str, cwd: Option<&str>, limit: usize) -> Result<Vec<Value>> {
        agents::search_gemini_sessions(query, cwd, limit)
    }
}
