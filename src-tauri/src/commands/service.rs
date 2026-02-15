use crate::models::ServiceStatus;
use crate::utils::shell;
use tauri::command;
use std::process::Command;
use log::{info, warn, debug};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Windows CREATE_NO_WINDOW flag to hide console window
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const SERVICE_PORT: u16 = 18789;

/// Check if a service is listening on the port, return PID
/// Simple and direct: port in use = service running
fn check_port_listening(port: u16) -> Option<u32> {
    #[cfg(unix)]
    {
        let output = Command::new("lsof")
            .args(["-ti", &format!(":{}", port)])
            .output()
            .ok()?;
        
        if output.status.success() {
            String::from_utf8_lossy(&output.stdout)
                .lines()
                .next()
                .and_then(|line| line.trim().parse::<u32>().ok())
        } else {
            None
        }
    }
    
    #[cfg(windows)]
    {
        let mut cmd = Command::new("netstat");
        cmd.args(["-ano"]);
        cmd.creation_flags(CREATE_NO_WINDOW);
        
        let output = cmd.output().ok()?;
        
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if line.contains(&format!(":{}", port)) && line.contains("LISTENING") {
                    if let Some(pid_str) = line.split_whitespace().last() {
                        if let Ok(pid) = pid_str.parse::<u32>() {
                            return Some(pid);
                        }
                    }
                }
            }
        }
        None
    }
}

/// Find ALL PIDs using a given port (not just the first one)
fn find_all_port_pids(port: u16) -> Vec<u32> {
    let mut pids = Vec::new();

    #[cfg(unix)]
    {
        if let Ok(output) = Command::new("lsof")
            .args(["-ti", &format!(":{}", port)])
            .output()
        {
            if output.status.success() {
                for line in String::from_utf8_lossy(&output.stdout).lines() {
                    if let Ok(pid) = line.trim().parse::<u32>() {
                        if pid > 0 && !pids.contains(&pid) {
                            pids.push(pid);
                        }
                    }
                }
            }
        }
    }

    #[cfg(windows)]
    {
        let mut cmd = Command::new("netstat");
        cmd.args(["-ano"]);
        cmd.creation_flags(CREATE_NO_WINDOW);

        if let Ok(output) = cmd.output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    if line.contains(&format!(":{}", port)) {
                        if let Some(pid_str) = line.split_whitespace().last() {
                            if let Ok(pid) = pid_str.parse::<u32>() {
                                if pid > 0 && !pids.contains(&pid) {
                                    pids.push(pid);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    pids
}

/// Get service status (simple version: directly check port usage)
#[command]
pub async fn get_service_status() -> Result<ServiceStatus, String> {
    // Simple and direct: check if port is in use
    let pid = check_port_listening(SERVICE_PORT);
    let running = pid.is_some();
    
    Ok(ServiceStatus {
        running,
        pid,
        port: SERVICE_PORT,
        uptime_seconds: None,
        memory_mb: None,
        cpu_percent: None,
    })
}

/// Start service
#[command]
pub async fn start_service() -> Result<String, String> {
    info!("[Service] Starting service...");

    // Check if already running
    let status = get_service_status().await?;
    if status.running {
        info!("[Service] Service is already running");
        return Err("Service is already running".to_string());
    }

    // Check if openclaw command exists
    let openclaw_path = shell::get_openclaw_path();
    if openclaw_path.is_none() {
        info!("[Service] openclaw command not found");
        return Err("openclaw command not found, please install it via npm install -g openclaw".to_string());
    }
    info!("[Service] openclaw path: {:?}", openclaw_path);

    // Start gateway in background directly (do not wait for doctor, avoid blocking)
    info!("[Service] Starting gateway in background...");
    shell::spawn_openclaw_gateway()
        .map_err(|e| format!("Failed to start service: {}", e))?;

    // Poll and wait for port to start listening (max 15 seconds)
    info!("[Service] Waiting for port {} to start listening...", SERVICE_PORT);
    for i in 1..=15 {
        std::thread::sleep(std::time::Duration::from_secs(1));
        if let Some(pid) = check_port_listening(SERVICE_PORT) {
            info!("[Service] Successfully started ({}s), PID: {}", i, pid);
            return Ok(format!("Service started, PID: {}", pid));
        }
        if i % 3 == 0 {
            debug!("[Service] Waiting... ({}s)", i);
        }
    }

    info!("[Service] Wait timeout, port still not listening");
    Err("Service start timeout (15s), please check openclaw logs".to_string())
}

/// Stop service
#[command]
pub async fn stop_service() -> Result<String, String> {
    info!("[Service] Stopping service...");

    let _ = shell::run_openclaw(&["gateway", "stop"]);
    std::thread::sleep(std::time::Duration::from_millis(500));

    let status = get_service_status().await?;
    if !status.running {
        info!("[Service] Successfully stopped");
        return Ok("Service stopped".to_string());
    }

    // Try force stop
    let _ = shell::run_openclaw(&["gateway", "stop", "--force"]);
    std::thread::sleep(std::time::Duration::from_millis(500));

    let status = get_service_status().await?;
    if status.running {
        Err(format!("Unable to stop service, PID: {:?}", status.pid))
    } else {
        info!("[Service] Successfully stopped");
        Ok("Service stopped".to_string())
    }
}

/// Restart service
#[command]
pub async fn restart_service() -> Result<String, String> {
    info!("[Service] Restarting service...");

    // Step 1: Stop the service if it's running
    let status = get_service_status().await?;
    if status.running {
        info!("[Service] Service is running, stopping first...");
        let _ = shell::run_openclaw(&["gateway", "stop"]);
        std::thread::sleep(std::time::Duration::from_millis(500));

        // Check if stopped
        let status = get_service_status().await?;
        if status.running {
            info!("[Service] Service still running, trying force stop...");
            let _ = shell::run_openclaw(&["gateway", "stop", "--force"]);
            std::thread::sleep(std::time::Duration::from_millis(500));
        }

        // Wait for port to be freed (max 5 seconds)
        for i in 1..=10 {
            if check_port_listening(SERVICE_PORT).is_none() {
                info!("[Service] Port {} freed after {}ms", SERVICE_PORT, i * 500);
                break;
            }
            if i == 10 {
                return Err(format!(
                    "Failed to stop service: port {} still in use after 5s",
                    SERVICE_PORT
                ));
            }
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
    } else {
        info!("[Service] Service was not running");
    }

    // Step 2: Start the service
    info!("[Service] Starting gateway in background...");
    shell::spawn_openclaw_gateway()
        .map_err(|e| format!("Failed to start service: {}", e))?;

    // Step 3: Poll and wait for port to start listening (max 15 seconds)
    info!("[Service] Waiting for port {} to start listening...", SERVICE_PORT);
    for i in 1..=15 {
        std::thread::sleep(std::time::Duration::from_secs(1));
        if let Some(pid) = check_port_listening(SERVICE_PORT) {
            info!("[Service] Successfully restarted ({}s), PID: {}", i, pid);
            return Ok(format!("Service restarted, PID: {}", pid));
        }
        if i % 3 == 0 {
            debug!("[Service] Waiting... ({}s)", i);
        }
    }

    info!("[Service] Restart timeout, port still not listening");
    Err("Service restart timeout (15s), please check openclaw logs".to_string())
}

/// Get logs
#[command]
pub async fn get_logs(lines: Option<u32>) -> Result<Vec<String>, String> {
    let n = lines.unwrap_or(100);

    match shell::run_openclaw(&["logs", "--lines", &n.to_string()]) {
        Ok(output) => {
            Ok(output.lines().map(|s| s.to_string()).collect())
        }
        Err(e) => Err(format!("Failed to read logs: {}", e))
    }
}

/// Kill ALL processes using port 18789
#[command]
pub async fn kill_all_port_processes() -> Result<String, String> {
    info!("[Service] Kill All: Finding all processes on port {}...", SERVICE_PORT);

    let pids = find_all_port_pids(SERVICE_PORT);

    if pids.is_empty() {
        info!("[Service] Kill All: No processes found on port {}", SERVICE_PORT);
        return Ok("No processes found on port 18789".to_string());
    }

    info!("[Service] Kill All: Found {} process(es): {:?}", pids.len(), pids);

    let mut killed = 0u32;
    let mut failed = 0u32;

    for pid in &pids {
        info!("[Service] Kill All: Killing PID {}...", pid);

        #[cfg(windows)]
        {
            let mut cmd = Command::new("taskkill");
            cmd.args(["/F", "/PID", &pid.to_string()]);
            cmd.creation_flags(CREATE_NO_WINDOW);

            match cmd.output() {
                Ok(output) if output.status.success() => {
                    info!("[Service] Kill All: Successfully killed PID {}", pid);
                    killed += 1;
                }
                Ok(output) => {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    warn!("[Service] Kill All: Failed to kill PID {}: {}", pid, stderr.trim());
                    failed += 1;
                }
                Err(e) => {
                    warn!("[Service] Kill All: Error killing PID {}: {}", pid, e);
                    failed += 1;
                }
            }
        }

        #[cfg(unix)]
        {
            match Command::new("kill").args(["-9", &pid.to_string()]).output() {
                Ok(output) if output.status.success() => {
                    info!("[Service] Kill All: Successfully killed PID {}", pid);
                    killed += 1;
                }
                Ok(output) => {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    warn!("[Service] Kill All: Failed to kill PID {}: {}", pid, stderr.trim());
                    failed += 1;
                }
                Err(e) => {
                    warn!("[Service] Kill All: Error killing PID {}: {}", pid, e);
                    failed += 1;
                }
            }
        }
    }

    let msg = if failed == 0 {
        format!("Killed {} process(es) on port 18789", killed)
    } else {
        format!("Killed {}, failed to kill {} process(es) on port 18789", killed, failed)
    };

    info!("[Service] Kill All: {}", msg);
    Ok(msg)
}
