mod agents;
mod report;
mod utils;

use anyhow::{Context, Result};
use clap::{Parser, Subcommand, ValueEnum};
use serde_json::json;

#[derive(Parser)]
#[command(name = "bridge")]
#[command(about = "Inter-Agent Bridge CLI", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Read a session from an agent
    Read {
        /// Agent to read from
        #[arg(long, value_enum)]
        agent: AgentType,

        /// Session ID or UUID (substring match supported)
        #[arg(long)]
        id: Option<String>,

        /// Working directory to scope search (defaults to current directory)
        #[arg(long)]
        cwd: Option<String>,

        /// Explicit path to chats directory (Gemini only)
        #[arg(long)]
        chats_dir: Option<String>,

        /// Emit structured JSON instead of text
        #[arg(long)]
        json: bool,
    },

    /// Compare sources and return an analyze-mode report
    Compare {
        /// Source spec: <agent> or <agent>:<session-substring>
        #[arg(long = "source", required = true)]
        sources: Vec<String>,

        /// Working directory to scope current-session lookups
        #[arg(long)]
        cwd: Option<String>,

        /// Emit structured JSON instead of markdown
        #[arg(long)]
        json: bool,
    },

    /// Build a report from a handoff packet JSON file
    Report {
        /// Path to handoff JSON file
        #[arg(long)]
        handoff: String,

        /// Working directory fallback for source lookups
        #[arg(long)]
        cwd: Option<String>,

        /// Emit structured JSON instead of markdown
        #[arg(long)]
        json: bool,
    },
}

#[derive(Copy, Clone, PartialEq, Eq, PartialOrd, Ord, ValueEnum, Debug)]
enum AgentType {
    Codex,
    Gemini,
    Claude,
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Read {
            agent,
            id,
            cwd,
            chats_dir,
            json,
        } => {
            let effective_cwd = effective_cwd(cwd);
            let session = match agent {
                AgentType::Codex => agents::read_codex_session(id.as_deref(), &effective_cwd)?,
                AgentType::Gemini => {
                    agents::read_gemini_session(id.as_deref(), &effective_cwd, chats_dir.as_deref())?
                }
                AgentType::Claude => agents::read_claude_session(id.as_deref(), &effective_cwd)?,
            };

            if json {
                let report = json!({
                    "agent": session.agent,
                    "source": session.source,
                    "content": session.content,
                    "warnings": session.warnings,
                });
                println!("{}", serde_json::to_string_pretty(&report)?);
            } else {
                for warning in &session.warnings {
                    eprintln!("{}", warning);
                }
                println!("SOURCE: {} Session ({})", format_agent_name(session.agent), session.source);
                println!("---");
                println!("{}", session.content);
            }
        }
        Commands::Compare { sources, cwd, json } => {
            let effective_cwd = effective_cwd(cwd);
            let source_specs = sources
                .iter()
                .map(|raw| report::parse_source_arg(raw))
                .collect::<Result<Vec<report::SourceSpec>>>()?;

            let request = report::ReportRequest {
                mode: "analyze".to_string(),
                task: "Compare agent outputs".to_string(),
                success_criteria: vec![
                    "Identify agreements and contradictions".to_string(),
                    "Highlight unavailable sources".to_string(),
                ],
                sources: source_specs,
                constraints: Vec::new(),
            };

            let result = report::build_report(&request, &effective_cwd);
            emit_report_output(&result, json)?;
        }
        Commands::Report { handoff, cwd, json } => {
            let effective_cwd = effective_cwd(cwd);
            let request = report::load_handoff(&handoff)
                .with_context(|| format!("Failed to load handoff packet from {}", handoff))?;
            let result = report::build_report(&request, &effective_cwd);
            emit_report_output(&result, json)?;
        }
    }

    Ok(())
}

fn emit_report_output(report_value: &serde_json::Value, json_output: bool) -> Result<()> {
    if json_output {
        println!("{}", serde_json::to_string_pretty(report_value)?);
    } else {
        println!("{}", report::report_to_markdown(report_value));
    }
    Ok(())
}

fn effective_cwd(cwd: Option<String>) -> String {
    cwd.unwrap_or_else(|| {
        std::env::current_dir()
            .map(|path| path.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    })
}

fn format_agent_name(agent: &str) -> &'static str {
    match agent {
        "codex" => "Codex",
        "gemini" => "Gemini",
        "claude" => "Claude",
        _ => "Unknown",
    }
}
