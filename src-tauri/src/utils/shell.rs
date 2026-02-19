use std::process::{Command, Output};
use std::io;
use std::collections::HashMap;
use crate::utils::platform;
use crate::utils::file;
use log::{info, debug, warn};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Windows CREATE_NO_WINDOW flag, used to hide console window
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Get extended PATH environment variable
/// GUI applications may not inherit user shell's PATH on startup, need to manually add common paths
pub fn get_extended_path() -> String {
    let mut paths = Vec::new();
    
    // Add common executable paths
    paths.push("/opt/homebrew/bin".to_string());  // Homebrew on Apple Silicon
    paths.push("/usr/local/bin".to_string());      // Homebrew on Intel / regular installation
    paths.push("/usr/bin".to_string());
    paths.push("/bin".to_string());
    
    if let Some(home) = dirs::home_dir() {
        let home_str = home.display().to_string();
        
        // nvm path (try to get current version)
        let nvm_default = format!("{}/.nvm/alias/default", home_str);
        if let Ok(version) = std::fs::read_to_string(&nvm_default) {
            let version = version.trim();
            if !version.is_empty() {
                paths.insert(0, format!("{}/.nvm/versions/node/v{}/bin", home_str, version));
            }
        }
        // Also add common nvm version paths
        for version in ["v22.22.0", "v22.12.0", "v22.11.0", "v22.0.0", "v23.0.0"] {
            let nvm_bin = format!("{}/.nvm/versions/node/{}/bin", home_str, version);
            if std::path::Path::new(&nvm_bin).exists() {
                paths.insert(0, nvm_bin);
                break; // Only add the first existing one
            }
        }
        
        // fnm
        paths.push(format!("{}/.fnm/aliases/default/bin", home_str));
        
        // volta
        paths.push(format!("{}/.volta/bin", home_str));
        
        // asdf
        paths.push(format!("{}/.asdf/shims", home_str));
        
        // mise
        paths.push(format!("{}/.local/share/mise/shims", home_str));
    }
    
    // Get current PATH and merge
    let current_path = std::env::var("PATH").unwrap_or_default();
    if !current_path.is_empty() {
        paths.push(current_path);
    }
    
    paths.join(":")
}

/// Execute shell command (with extended PATH)
pub fn run_command(cmd: &str, args: &[&str]) -> io::Result<Output> {
    let mut command = Command::new(cmd);
    command.args(args);
    
    // Use extended PATH on non-Windows systems
    #[cfg(not(windows))]
    {
        let extended_path = get_extended_path();
        command.env("PATH", extended_path);
    }
    
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    
    command.output()
}

/// Execute shell command and get output string
pub fn run_command_output(cmd: &str, args: &[&str]) -> Result<String, String> {
    match run_command(cmd, args) {
        Ok(output) => {
            if output.status.success() {
                Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
            }
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Execute bash command (with extended PATH)
pub fn run_bash(script: &str) -> io::Result<Output> {
    let mut command = Command::new("bash");
    command.arg("-c").arg(script);
    
    // Use extended PATH on non-Windows systems
    #[cfg(not(windows))]
    {
        let extended_path = get_extended_path();
        command.env("PATH", extended_path);
    }
    
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    
    command.output()
}

/// Execute bash command and get output
pub fn run_bash_output(script: &str) -> Result<String, String> {
    match run_bash(script) {
        Ok(output) => {
            if output.status.success() {
                Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                if stderr.is_empty() {
                    Err(format!("Command failed with exit code: {:?}", output.status.code()))
                } else {
                    Err(stderr)
                }
            }
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Execute cmd.exe command (Windows) - avoid PowerShell execution policy issues
pub fn run_cmd(script: &str) -> io::Result<Output> {
    let mut cmd = Command::new("cmd");
    cmd.args(["/c", script]);
    
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    
    cmd.output()
}

/// Execute cmd.exe command and get output (Windows)
pub fn run_cmd_output(script: &str) -> Result<String, String> {
    match run_cmd(script) {
        Ok(output) => {
            if output.status.success() {
                Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                if stderr.is_empty() {
                    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if stdout.is_empty() {
                        Err(format!("Command failed with exit code: {:?}", output.status.code()))
                    } else {
                        Err(stdout)
                    }
                } else {
                    Err(stderr)
                }
            }
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Execute PowerShell command (Windows) - use only when PowerShell-specific features are needed
/// Note: PowerShell execution policy on some Windows systems may prohibit running scripts
pub fn run_powershell(script: &str) -> io::Result<Output> {
    let mut cmd = Command::new("powershell");
    // Use -ExecutionPolicy Bypass to bypass execution policy restrictions
    cmd.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script]);
    
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    
    cmd.output()
}

/// Execute PowerShell command and get output (Windows)
pub fn run_powershell_output(script: &str) -> Result<String, String> {
    match run_powershell(script) {
        Ok(output) => {
            if output.status.success() {
                Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                if stderr.is_empty() {
                    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if stdout.is_empty() {
                        Err(format!("Command failed with exit code: {:?}", output.status.code()))
                    } else {
                        Err(stdout)
                    }
                } else {
                    Err(stderr)
                }
            }
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Cross-platform script command execution
/// Uses cmd.exe on Windows (avoid PowerShell execution policy issues)
pub fn run_script_output(script: &str) -> Result<String, String> {
    if platform::is_windows() {
        run_cmd_output(script)
    } else {
        run_bash_output(script)
    }
}

/// Execute command in background (do not wait for result)
pub fn spawn_background(script: &str) -> io::Result<()> {
    if platform::is_windows() {
        let mut cmd = Command::new("cmd");
        cmd.args(["/c", script]);
        
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);
        
        cmd.spawn()?;
    } else {
        Command::new("bash")
            .arg("-c")
            .arg(script)
            .spawn()?;
    }
    Ok(())
}

/// Get openclaw executable path
/// Detects multiple possible installation paths, since GUI apps don't inherit user shell's PATH
pub fn get_openclaw_path() -> Option<String> {
    // Windows: check common npm global installation paths
    if platform::is_windows() {
        let possible_paths = get_windows_openclaw_paths();
        for path in possible_paths {
            if std::path::Path::new(&path).exists() {
                info!("[Shell] Found openclaw at {}", path);
                return Some(path);
            }
        }
    } else {
        // Unix: check common npm global installation paths
        let possible_paths = get_unix_openclaw_paths();
        for path in possible_paths {
            if std::path::Path::new(&path).exists() {
                info!("[Shell] Found openclaw at {}", path);
                return Some(path);
            }
        }
    }
    
    // Fallback: check if it's in PATH
    if command_exists("openclaw") {
        return Some("openclaw".to_string());
    }
    
    // Last resort: search via user shell
    if !platform::is_windows() {
        if let Ok(path) = run_bash_output("source ~/.zshrc 2>/dev/null || source ~/.bashrc 2>/dev/null; which openclaw 2>/dev/null") {
            if !path.is_empty() && std::path::Path::new(&path).exists() {
                info!("[Shell] Found openclaw via user shell: {}", path);
                return Some(path);
            }
        }
    }
    
    None
}

/// Get possible openclaw installation paths on Unix systems
fn get_unix_openclaw_paths() -> Vec<String> {
    let mut paths = Vec::new();
    
    // npm global installation paths
    paths.push("/usr/local/bin/openclaw".to_string());
    paths.push("/opt/homebrew/bin/openclaw".to_string()); // Homebrew on Apple Silicon
    paths.push("/usr/bin/openclaw".to_string());
    
    if let Some(home) = dirs::home_dir() {
        let home_str = home.display().to_string();
        
        // npm global installation to user directory
        paths.push(format!("{}/.npm-global/bin/openclaw", home_str));

        // npm global packages installed via nvm (need to find correct node version directory)
        // First check common versions
        for version in ["v22.0.0", "v22.1.0", "v22.2.0", "v22.11.0", "v22.12.0", "v23.0.0"] {
            paths.push(format!("{}/.nvm/versions/node/{}/bin/openclaw", home_str, version));
        }
        
        // Check nvm current (try reading .nvmrc or default)
        let nvm_default = format!("{}/.nvm/alias/default", home_str);
        if let Ok(version) = std::fs::read_to_string(&nvm_default) {
            let version = version.trim();
            if !version.is_empty() {
                paths.insert(0, format!("{}/.nvm/versions/node/v{}/bin/openclaw", home_str, version));
            }
        }
        
        // fnm
        paths.push(format!("{}/.fnm/aliases/default/bin/openclaw", home_str));
        
        // volta
        paths.push(format!("{}/.volta/bin/openclaw", home_str));
        
        // pnpm global installation
        paths.push(format!("{}/.pnpm/bin/openclaw", home_str));
        paths.push(format!("{}/Library/pnpm/openclaw", home_str)); // macOS pnpm default path
        
        // asdf
        paths.push(format!("{}/.asdf/shims/openclaw", home_str));
        
        // mise (formerly rtx)
        paths.push(format!("{}/.local/share/mise/shims/openclaw", home_str));
        
        // yarn global installation
        paths.push(format!("{}/.yarn/bin/openclaw", home_str));
        paths.push(format!("{}/.config/yarn/global/node_modules/.bin/openclaw", home_str));
    }
    
    paths
}

/// Get possible openclaw installation paths on Windows
fn get_windows_openclaw_paths() -> Vec<String> {
    let mut paths = Vec::new();
    
    // 1. nvm4w installation path
    paths.push("C:\\nvm4w\\nodejs\\openclaw.cmd".to_string());
    
    // 2. npm global path in user directory
    if let Some(home) = dirs::home_dir() {
        let npm_path = format!("{}\\AppData\\Roaming\\npm\\openclaw.cmd", home.display());
        paths.push(npm_path);
    }
    
    // 3. nodejs in Program Files
    paths.push("C:\\Program Files\\nodejs\\openclaw.cmd".to_string());
    
    paths
}

/// Execute openclaw command and get output
pub fn run_openclaw(args: &[&str]) -> Result<String, String> {
    debug!("[Shell] Executing openclaw command: {:?}", args);
    
    let openclaw_path = get_openclaw_path().ok_or_else(|| {
        warn!("[Shell] Cannot find openclaw command");
        "Cannot find openclaw command, please ensure it is installed via npm install -g openclaw".to_string()
    })?;
    
    debug!("[Shell] openclaw path: {}", openclaw_path);
    
    // Get extended PATH to ensure node can be found
    let extended_path = get_extended_path();
    debug!("[Shell] Extended PATH: {}", extended_path);
    
    let output = if platform::is_windows() && openclaw_path.ends_with(".cmd") {
        // Windows: .cmd files can be executed directly
        let mut cmd = Command::new(&openclaw_path);
        let gw_token = get_gateway_token_from_config();
        cmd.args(args)
            .env("OPENCLAW_GATEWAY_TOKEN", &gw_token)
            .env("PATH", &extended_path);
        
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);
        
        cmd.output()
    } else {
        let mut cmd = Command::new(&openclaw_path);
        let gw_token = get_gateway_token_from_config();
        cmd.args(args)
            .env("OPENCLAW_GATEWAY_TOKEN", &gw_token)
            .env("PATH", &extended_path);
        
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);
        
        cmd.output()
    };
    
    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            debug!("[Shell] Command exit code: {:?}", out.status.code());
            if out.status.success() {
                debug!("[Shell] Command executed successfully, stdout length: {}", stdout.len());
                Ok(stdout)
            } else {
                debug!("[Shell] Command execution failed, stderr: {}", stderr);
                Err(format!("{}\n{}", stdout, stderr).trim().to_string())
            }
        }
        Err(e) => {
            warn!("[Shell] Failed to execute openclaw: {}", e);
            Err(format!("Failed to execute openclaw: {}", e))
        }
    }
}

/// Default Gateway Token (fallback only)
pub const DEFAULT_GATEWAY_TOKEN: &str = "openclaw-manager-local-token";

/// Read the actual gateway auth token from openclaw.json config.
/// If no token exists (fresh install), generates one and saves it to config.
/// Falls back to DEFAULT_GATEWAY_TOKEN only if config is completely unreadable.
fn get_gateway_token_from_config() -> String {
    let config_path = platform::get_config_file_path();

    // Try to read existing config
    let mut config = if let Ok(content) = file::read_file(&config_path) {
        let content = content.strip_prefix('\u{FEFF}').unwrap_or(&content);
        match serde_json::from_str::<serde_json::Value>(content) {
            Ok(c) => c,
            Err(_) => serde_json::json!({}),
        }
    } else {
        serde_json::json!({})
    };

    // Check if token already exists
    let existing_token = config
        .pointer("/gateway/auth/token")
        .and_then(|v| v.as_str())
        .filter(|t| !t.is_empty())
        .map(|t| t.to_string());

    if let Some(token) = existing_token {
        // Ensure controlUi.allowInsecureAuth is set (may be missing on older configs)
        let needs_update = config
            .pointer("/gateway/controlUi/allowInsecureAuth")
            .and_then(|v| v.as_bool())
            != Some(true);
        if needs_update {
            info!("[Shell] Setting gateway.controlUi.allowInsecureAuth = true");
            if config["gateway"].get("controlUi").is_none() {
                config["gateway"]["controlUi"] = serde_json::json!({});
            }
            config["gateway"]["controlUi"]["allowInsecureAuth"] = serde_json::json!(true);
            if let Ok(content) = serde_json::to_string_pretty(&config) {
                let _ = file::write_file(&config_path, &content);
            }
        }
        info!("[Shell] Using gateway token from config");
        return token;
    }

    // No token found — generate one and save it to config
    info!("[Shell] No gateway token found, generating new token...");
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let random_part: u64 = (timestamp as u64) ^ 0x5DEECE66Du64;
    let new_token = format!(
        "{:016x}{:016x}{:016x}",
        random_part,
        random_part.wrapping_mul(0x5DEECE66Du64),
        timestamp as u64
    );

    // Ensure gateway.auth path exists in config
    if config.get("gateway").is_none() {
        config["gateway"] = serde_json::json!({});
    }
    if config["gateway"].get("auth").is_none() {
        config["gateway"]["auth"] = serde_json::json!({});
    }
    config["gateway"]["auth"]["token"] = serde_json::json!(&new_token);
    config["gateway"]["auth"]["mode"] = serde_json::json!("token");
    if config["gateway"].get("mode").is_none() {
        config["gateway"]["mode"] = serde_json::json!("local");
    }
    // Allow Control UI to connect with token-only auth (skip device pairing for local manager)
    if config["gateway"].get("controlUi").is_none() {
        config["gateway"]["controlUi"] = serde_json::json!({});
    }
    config["gateway"]["controlUi"]["allowInsecureAuth"] = serde_json::json!(true);

    // Save config
    if let Ok(content) = serde_json::to_string_pretty(&config) {
        if let Err(e) = file::write_file(&config_path, &content) {
            warn!("[Shell] Failed to save generated token to config: {}", e);
            return DEFAULT_GATEWAY_TOKEN.to_string();
        }
    }

    info!("[Shell] Generated and saved new gateway token: {}...", &new_token[..8]);
    new_token
}

/// Read all environment variables from ~/.openclaw/env file
/// Consistent with shell script `source ~/.openclaw/env` behavior
fn load_openclaw_env_vars() -> HashMap<String, String> {
    let mut env_vars = HashMap::new();
    let env_path = platform::get_env_file_path();
    
    if let Ok(content) = file::read_file(&env_path) {
        for line in content.lines() {
            let line = line.trim();
            // Skip comments and empty lines
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            // Parse export KEY=VALUE or KEY=VALUE format
            let line = line.strip_prefix("export ").unwrap_or(line);
            if let Some((key, value)) = line.split_once('=') {
                let key = key.trim();
                // Remove quotes around the value
                let value = value.trim()
                    .trim_matches('"')
                    .trim_matches('\'');
                env_vars.insert(key.to_string(), value.to_string());
            }
        }
    }
    
    env_vars
}

/// Start openclaw gateway in background
/// Consistent with shell script behavior: load env file first, then start gateway
pub fn spawn_openclaw_gateway() -> io::Result<()> {
    info!("[Shell] Starting openclaw gateway in background...");
    
    let openclaw_path = get_openclaw_path().ok_or_else(|| {
        warn!("[Shell] Cannot find openclaw command");
        io::Error::new(
            io::ErrorKind::NotFound,
            "Cannot find openclaw command, please ensure it is installed via npm install -g openclaw"
        )
    })?;

    info!("[Shell] openclaw path: {}", openclaw_path);
    
    // Load user's env file environment variables (consistent with shell script source ~/.openclaw/env)
    info!("[Shell] Loading user environment variables...");
    let user_env_vars = load_openclaw_env_vars();
    info!("[Shell] Loaded {} environment variables", user_env_vars.len());
    for key in user_env_vars.keys() {
        debug!("[Shell] - Environment variable: {}", key);
    }
    
    // Get extended PATH to ensure node can be found
    let extended_path = get_extended_path();
    info!("[Shell] Extended PATH: {}", extended_path);
    
    // On Windows, .cmd files can be executed directly by Command::new
    // Set environment variable OPENCLAW_GATEWAY_TOKEN so all subcommands can use it automatically
    let mut cmd = if platform::is_windows() && openclaw_path.ends_with(".cmd") {
        info!("[Shell] Windows mode: executing .cmd directly");
        let mut c = Command::new(&openclaw_path);
        c.args(["gateway", "--port", "18789"]);
        c
    } else {
        info!("[Shell] Unix/Direct mode: executing directly");
        let mut c = Command::new(&openclaw_path);
        c.args(["gateway", "--port", "18789"]);
        c
    };
    
    // Inject user's environment variables (such as ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)
    for (key, value) in &user_env_vars {
        cmd.env(key, value);
    }
    
    // Set PATH and gateway token (read from config to avoid mismatch)
    let gateway_token = get_gateway_token_from_config();
    cmd.env("PATH", &extended_path);
    cmd.env("OPENCLAW_GATEWAY_TOKEN", &gateway_token);
    info!("[Shell] Gateway token: {}...", &gateway_token[..8.min(gateway_token.len())]);
    
    // Windows: hide console window
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    
    info!("[Shell] Starting gateway process...");
    let child = cmd.spawn();
    
    match child {
        Ok(c) => {
            info!("[Shell] ✓ Gateway process started, PID: {}", c.id());
            Ok(())
        }
        Err(e) => {
            warn!("[Shell] ✗ Gateway startup failed: {}", e);
            Err(io::Error::new(
                e.kind(),
                format!("Startup failed (path: {}): {}", openclaw_path, e)
            ))
        }
    }
}

/// Check if command exists
pub fn command_exists(cmd: &str) -> bool {
    if platform::is_windows() {
        // Windows: use where command
        let mut command = Command::new("where");
        command.arg(cmd);
        
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
        
        command.output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    } else {
        // Unix: use which command
        Command::new("which")
            .arg(cmd)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}
