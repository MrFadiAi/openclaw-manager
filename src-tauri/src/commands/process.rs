use crate::utils::shell;
use tauri::command;
use log::{info, debug};

/// Check if OpenClaw is installed
#[command]
pub async fn check_openclaw_installed() -> Result<bool, String> {
    info!("[Process Check] Checking if OpenClaw is installed...");
    // Use get_openclaw_path to check, because command_exists may be unreliable on Windows
    let installed = shell::get_openclaw_path().is_some();
    info!("[Process Check] OpenClaw installation status: {}", if installed { "installed" } else { "not installed" });
    Ok(installed)
}

/// Get OpenClaw version
#[command]
pub async fn get_openclaw_version() -> Result<Option<String>, String> {
    info!("[Process Check] Getting OpenClaw version...");
    // Use run_openclaw to get the version
    match shell::run_openclaw(&["--version"]) {
        Ok(version) => {
            let v = version.trim().to_string();
            info!("[Process Check] OpenClaw version: {}", v);
            Ok(Some(v))
        },
        Err(e) => {
            debug!("[Process Check] Failed to get version: {}", e);
            Ok(None)
        },
    }
}

/// Check if port is in use (by attempting to connect to openclaw gateway)
#[command]
pub async fn check_port_in_use(port: u16) -> Result<bool, String> {
    info!("[Process Check] Checking if port {} is in use...", port);

    // Use openclaw health to check if gateway is running
    // If port is the default 18789, use openclaw health directly
    if port == 18789 {
        debug!("[Process Check] Using openclaw health to check port 18789...");
        let result = shell::run_openclaw(&["health", "--timeout", "2000"]);
        // If health command succeeds, the port is occupied by gateway
        let in_use = result.is_ok();
        info!("[Process Check] Port 18789 status: {}", if in_use { "in use" } else { "available" });
        return Ok(in_use);
    }

    // For non-default ports, try using TCP connection check
    debug!("[Process Check] Using TCP connection to check port {}...", port);
    use std::net::TcpStream;
    use std::time::Duration;

    let addr = format!("127.0.0.1:{}", port);
    match TcpStream::connect_timeout(&addr.parse().unwrap(), Duration::from_millis(500)) {
        Ok(_) => {
            info!("[Process Check] Port {} is in use", port);
            Ok(true)
        },
        Err(_) => {
            info!("[Process Check] Port {} is available", port);
            Ok(false)
        },
    }
}

/// Get Node.js version
#[command]
pub async fn get_node_version() -> Result<Option<String>, String> {
    info!("[Process Check] Getting Node.js version...");
    if !shell::command_exists("node") {
        info!("[Process Check] Node.js is not installed");
        return Ok(None);
    }

    match shell::run_command_output("node", &["--version"]) {
        Ok(version) => {
            info!("[Process Check] Node.js version: {}", version);
            Ok(Some(version))
        },
        Err(e) => {
            debug!("[Process Check] Failed to get Node.js version: {}", e);
            Ok(None)
        },
    }
}
