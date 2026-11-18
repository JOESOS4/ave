use serde::{Deserialize, Serialize};
use tauri::command;

/// Minimal placeholder command.
/// Accepts the payload the frontend already builds but does not persist yet.
/// Returns a structured result so the UI can show success/fallback messaging.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddLocalMcpRequest {
    pub name: String,
    pub r#type: String, // "stdio" | "streamable_http"
    pub description: Option<String>,
    pub cmd: Option<String>,
    pub args: Option<Vec<String>>,
    pub uri: Option<String>,
    pub envs: Option<std::collections::HashMap<String, String>>,
    pub timeout: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddLocalMcpResult {
    pub accepted: bool,
    pub message: String,
}

#[command]
pub async fn add_local_mcp(request: AddLocalMcpRequest) -> Result<AddLocalMcpResult, String> {
    // TODO: implement real persistence into goose config.yaml / harness JSON files.
    // For now we just acknowledge the request so the UI flow is complete.
    let transport = &request.r#type;
    let ident = request
        .uri
        .clone()
        .or_else(|| request.cmd.clone())
        .unwrap_or_else(|| request.name.clone());

    Ok(AddLocalMcpResult {
        accepted: true,
        message: format!(
            "Received {transport} request for '{name}' ({ident}). Persistence not yet implemented — will route to agent fallback in UI.",
            name = request.name
        ),
    })
}