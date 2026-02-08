use anyhow::{Context, Result};
use dirs;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

pub fn expand_home(path_str: &str) -> Option<PathBuf> {
    if path_str == "~" {
        return dirs::home_dir();
    }
    if let Some(stripped) = path_str.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return Some(home.join(stripped));
        }
        return None;
    }
    Some(PathBuf::from(path_str))
}

pub fn normalize_path(path_str: &str) -> Result<PathBuf> {
    let expanded = expand_home(path_str).context("Could not expand home directory")?;
    let absolute = if expanded.is_absolute() {
        expanded
    } else {
        std::env::current_dir()
            .context("Could not resolve current directory")?
            .join(expanded)
    };

    absolute.canonicalize().or_else(|_| Ok(absolute))
}

pub fn hash_path(path: &Path) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.to_string_lossy().as_bytes());
    format!("{:x}", hasher.finalize())
}
