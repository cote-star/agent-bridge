use super::AgentAdapter;
use crate::agents::{self, Session};
use anyhow::Result;
use serde_json::Value;
use std::path::{Path, PathBuf};

pub struct CursorAdapter;

impl AgentAdapter for CursorAdapter {
    fn name(&self) -> &'static str {
        "cursor"
    }

    fn resolve(&self, id: Option<&str>, cwd: &str) -> Result<PathBuf> {
        let session = agents::read_cursor_session(id, cwd)?;
        Ok(PathBuf::from(&session.source))
    }

    fn read(&self, _path: &Path, _last_n: usize) -> Result<Session> {
        Err(anyhow::anyhow!("Use read_cursor_session directly"))
    }

    fn list(&self, cwd: &str, limit: usize) -> Result<Vec<Value>> {
        agents::list_cursor_sessions(cwd, limit)
    }
}
