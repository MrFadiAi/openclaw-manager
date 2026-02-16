use crate::utils::{platform, shell};
use serde::{Deserialize, Serialize};
use tauri::command;
use log::{info, warn, error, debug};

/// Environment check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentStatus {
    /// Whether Node.js is installed
    pub node_installed: bool,
    /// Node.js version
    pub node_version: Option<String>,
    /// Whether Node.js version meets requirement (>=22)
    pub node_version_ok: bool,
    /// Whether Git is installed
    pub git_installed: bool,
    /// Git version
    pub git_version: Option<String>,
    /// Whether OpenClaw is installed
    pub openclaw_installed: bool,
    /// OpenClaw version
    pub openclaw_version: Option<String>,
    /// Whether config directory exists
    pub config_dir_exists: bool,
    /// Whether everything is ready
    pub ready: bool,
    /// Operating system
    pub os: String,
}

/// Installation progress
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallProgress {
    pub step: String,
    pub progress: u8,
    pub message: String,
    pub error: Option<String>,
}

/// Installation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallResult {
    pub success: bool,
    pub message: String,
    pub error: Option<String>,
}

/// Check environment status
#[command]
pub async fn check_environment() -> Result<EnvironmentStatus, String> {
    info!("[Environment Check] Starting system environment check...");

    let os = platform::get_os();
    info!("[Environment Check] Operating system: {}", os);

    // Check Node.js
    info!("[Environment Check] Checking Node.js...");
    let node_version = get_node_version();
    let node_installed = node_version.is_some();
    let node_version_ok = check_node_version_requirement(&node_version);
    info!("[Environment Check] Node.js: installed={}, version={:?}, version_ok={}",
        node_installed, node_version, node_version_ok);

    // Check Git
    info!("[Environment Check] Checking Git...");
    let git_version = get_git_version();
    let git_installed = git_version.is_some();
    info!("[Environment Check] Git: installed={}, version={:?}",
        git_installed, git_version);

    // Check OpenClaw
    info!("[Environment Check] Checking OpenClaw...");
    let openclaw_version = get_openclaw_version();
    let openclaw_installed = openclaw_version.is_some();
    info!("[Environment Check] OpenClaw: installed={}, version={:?}",
        openclaw_installed, openclaw_version);

    // Check config directory
    let config_dir = platform::get_config_dir();
    let config_dir_exists = std::path::Path::new(&config_dir).exists();
    info!("[Environment Check] Config directory: {}, exists={}", config_dir, config_dir_exists);

    let ready = node_installed && node_version_ok && openclaw_installed;
    info!("[Environment Check] Environment ready status: ready={}", ready);
    
    Ok(EnvironmentStatus {
        node_installed,
        node_version,
        node_version_ok,
        git_installed,
        git_version,
        openclaw_installed,
        openclaw_version,
        config_dir_exists,
        ready,
        os,
    })
}

/// Get Node.js version
/// Detects multiple possible installation paths, since GUI apps don't inherit user shell PATH
fn get_node_version() -> Option<String> {
    if platform::is_windows() {
        // Windows: First try direct call (if PATH is updated)
        if let Ok(v) = shell::run_cmd_output("node --version") {
            let version = v.trim().to_string();
            if !version.is_empty() && version.starts_with('v') {
                info!("[Environment Check] Found Node.js via PATH: {}", version);
                return Some(version);
            }
        }

        // Windows: Check common installation paths
        let possible_paths = get_windows_node_paths();
        for path in possible_paths {
            if std::path::Path::new(&path).exists() {
                // Execute using full path
                let cmd = format!("\"{}\" --version", path);
                if let Ok(output) = shell::run_cmd_output(&cmd) {
                    let version = output.trim().to_string();
                    if !version.is_empty() && version.starts_with('v') {
                        info!("[Environment Check] Found Node.js at {}: {}", path, version);
                        return Some(version);
                    }
                }
            }
        }

        None
    } else {
        // First try direct call
        if let Ok(v) = shell::run_command_output("node", &["--version"]) {
            return Some(v.trim().to_string());
        }

        // Detect common Node.js installation paths (macOS/Linux)
        let possible_paths = get_unix_node_paths();
        for path in possible_paths {
            if std::path::Path::new(&path).exists() {
                if let Ok(output) = shell::run_command_output(&path, &["--version"]) {
                    info!("[Environment Check] Found Node.js at {}: {}", path, output.trim());
                    return Some(output.trim().to_string());
                }
            }
        }

        // Try to detect by loading user environment via shell
        if let Ok(output) = shell::run_bash_output("source ~/.zshrc 2>/dev/null || source ~/.bashrc 2>/dev/null; node --version 2>/dev/null") {
            if !output.is_empty() && output.starts_with('v') {
                info!("[Environment Check] Found Node.js via user shell: {}", output.trim());
                return Some(output.trim().to_string());
            }
        }

        None
    }
}

/// Get possible Node.js paths on Unix systems
fn get_unix_node_paths() -> Vec<String> {
    let mut paths = Vec::new();

    // Homebrew (macOS)
    paths.push("/opt/homebrew/bin/node".to_string()); // Apple Silicon
    paths.push("/usr/local/bin/node".to_string());     // Intel Mac

    // System installation
    paths.push("/usr/bin/node".to_string());

    // nvm (check common versions)
    if let Some(home) = dirs::home_dir() {
        let home_str = home.display().to_string();

        // nvm default versions
        paths.push(format!("{}/.nvm/versions/node/v22.0.0/bin/node", home_str));
        paths.push(format!("{}/.nvm/versions/node/v22.1.0/bin/node", home_str));
        paths.push(format!("{}/.nvm/versions/node/v22.2.0/bin/node", home_str));
        paths.push(format!("{}/.nvm/versions/node/v22.11.0/bin/node", home_str));
        paths.push(format!("{}/.nvm/versions/node/v22.12.0/bin/node", home_str));
        paths.push(format!("{}/.nvm/versions/node/v23.0.0/bin/node", home_str));

        // Try nvm alias default (read nvm's default alias)
        let nvm_default = format!("{}/.nvm/alias/default", home_str);
        if let Ok(version) = std::fs::read_to_string(&nvm_default) {
            let version = version.trim();
            if !version.is_empty() {
                paths.insert(0, format!("{}/.nvm/versions/node/v{}/bin/node", home_str, version));
            }
        }

        // fnm
        paths.push(format!("{}/.fnm/aliases/default/bin/node", home_str));

        // volta
        paths.push(format!("{}/.volta/bin/node", home_str));

        // asdf
        paths.push(format!("{}/.asdf/shims/node", home_str));

        // mise (formerly rtx)
        paths.push(format!("{}/.local/share/mise/shims/node", home_str));
    }

    paths
}

/// Get possible Node.js paths on Windows systems
fn get_windows_node_paths() -> Vec<String> {
    let mut paths = Vec::new();

    // 1. Standard installation paths (Program Files)
    paths.push("C:\\Program Files\\nodejs\\node.exe".to_string());
    paths.push("C:\\Program Files (x86)\\nodejs\\node.exe".to_string());

    // 2. nvm for Windows (nvm4w) - common installation location
    paths.push("C:\\nvm4w\\nodejs\\node.exe".to_string());

    // 3. Various installations in user directory
    if let Some(home) = dirs::home_dir() {
        let home_str = home.display().to_string();

        // nvm for Windows user installation
        paths.push(format!("{}\\AppData\\Roaming\\nvm\\current\\node.exe", home_str));

        // fnm (Fast Node Manager) for Windows
        paths.push(format!("{}\\AppData\\Roaming\\fnm\\aliases\\default\\node.exe", home_str));
        paths.push(format!("{}\\AppData\\Local\\fnm\\aliases\\default\\node.exe", home_str));
        paths.push(format!("{}\\.fnm\\aliases\\default\\node.exe", home_str));

        // volta
        paths.push(format!("{}\\AppData\\Local\\Volta\\bin\\node.exe", home_str));
        // volta invokes via shim, just check bin directory

        // scoop installation
        paths.push(format!("{}\\scoop\\apps\\nodejs\\current\\node.exe", home_str));
        paths.push(format!("{}\\scoop\\apps\\nodejs-lts\\current\\node.exe", home_str));

        // chocolatey installation
        paths.push("C:\\ProgramData\\chocolatey\\lib\\nodejs\\tools\\node.exe".to_string());
    }

    // 4. Installation paths from registry (obtained indirectly via environment variables)
    if let Ok(program_files) = std::env::var("ProgramFiles") {
        paths.push(format!("{}\\nodejs\\node.exe", program_files));
    }
    if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
        paths.push(format!("{}\\nodejs\\node.exe", program_files_x86));
    }

    // 5. nvm-windows symlink path (NVM_SYMLINK environment variable)
    if let Ok(nvm_symlink) = std::env::var("NVM_SYMLINK") {
        paths.insert(0, format!("{}\\node.exe", nvm_symlink));
    }

    // 6. Current version under nvm-windows NVM_HOME path
    if let Ok(nvm_home) = std::env::var("NVM_HOME") {
        // Try to read the currently activated version
        let settings_path = format!("{}\\settings.txt", nvm_home);
        if let Ok(content) = std::fs::read_to_string(&settings_path) {
            for line in content.lines() {
                if line.starts_with("current:") {
                    if let Some(version) = line.strip_prefix("current:") {
                        let version = version.trim();
                        if !version.is_empty() {
                            paths.insert(0, format!("{}\\v{}\\node.exe", nvm_home, version));
                        }
                    }
                }
            }
        }
    }

    paths
}

/// Get Git version
fn get_git_version() -> Option<String> {
    if platform::is_windows() {
        if let Ok(v) = shell::run_cmd_output("git --version") {
            let version = v.trim().to_string();
            if !version.is_empty() && version.contains("git version") {
                // "git version 2.43.0.windows.1" -> "2.43.0"
                let ver = version.replace("git version ", "");
                let ver = ver.split('.').take(3).collect::<Vec<_>>().join(".");
                return Some(ver);
            }
        }
        None
    } else {
        if let Ok(v) = shell::run_command_output("git", &["--version"]) {
            let version = v.trim().to_string();
            if !version.is_empty() && version.contains("git version") {
                let ver = version.replace("git version ", "");
                return Some(ver.trim().to_string());
            }
        }
        None
    }
}

/// Get OpenClaw version
fn get_openclaw_version() -> Option<String> {
    // Use run_openclaw to handle all platforms uniformly
    shell::run_openclaw(&["--version"])
        .ok()
        .map(|v| v.trim().to_string())
}

/// Check if Node.js version is >= 22
fn check_node_version_requirement(version: &Option<String>) -> bool {
    if let Some(v) = version {
        // Parse version "v22.1.0" -> 22
        let major = v.trim_start_matches('v')
            .split('.')
            .next()
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(0);
        major >= 22
    } else {
        false
    }
}

/// Install Node.js
#[command]
pub async fn install_nodejs() -> Result<InstallResult, String> {
    info!("[Install Node.js] Starting Node.js installation...");
    let os = platform::get_os();
    info!("[Install Node.js] Detected operating system: {}", os);

    let result = match os.as_str() {
        "windows" => {
            info!("[Install Node.js] Using Windows installation method...");
            install_nodejs_windows().await
        },
        "macos" => {
            info!("[Install Node.js] Using macOS installation method (Homebrew)...");
            install_nodejs_macos().await
        },
        "linux" => {
            info!("[Install Node.js] Using Linux installation method...");
            install_nodejs_linux().await
        },
        _ => {
            error!("[Install Node.js] Unsupported operating system: {}", os);
            Ok(InstallResult {
                success: false,
                message: "Unsupported operating system".to_string(),
                error: Some(format!("Unsupported operating system: {}", os)),
            })
        },
    };

    match &result {
        Ok(r) if r.success => info!("[Install Node.js] Installation successful"),
        Ok(r) => warn!("[Install Node.js] Installation failed: {}", r.message),
        Err(e) => error!("[Install Node.js] Installation error: {}", e),
    }

    result
}

/// Install Node.js on Windows
async fn install_nodejs_windows() -> Result<InstallResult, String> {
    // Use winget to install Node.js (built-in on Windows 10/11)
    let script = r#"
$ErrorActionPreference = 'Stop'

# Check if already installed
$nodeVersion = node --version 2>$null
if ($nodeVersion) {
    Write-Host "Node.js is already installed: $nodeVersion"
    exit 0
}

# Prefer winget
$hasWinget = Get-Command winget -ErrorAction SilentlyContinue
if ($hasWinget) {
    Write-Host "Installing Node.js using winget..."
    winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Node.js installed successfully!"
        exit 0
    }
}

# Fallback: Use fnm (Fast Node Manager)
Write-Host "Attempting to install Node.js using fnm..."
$fnmInstallScript = "irm https://fnm.vercel.app/install.ps1 | iex"
Invoke-Expression $fnmInstallScript

# Configure fnm environment
$env:FNM_DIR = "$env:USERPROFILE\.fnm"
$env:Path = "$env:FNM_DIR;$env:Path"

# Install Node.js 22
fnm install 22
fnm default 22
fnm use 22

# Verify installation
$nodeVersion = node --version 2>$null
if ($nodeVersion) {
    Write-Host "Node.js installed successfully: $nodeVersion"
    exit 0
} else {
    Write-Host "Node.js installation failed"
    exit 1
}
"#;

    match shell::run_powershell_output(script) {
        Ok(output) => {
            // Verify installation
            if get_node_version().is_some() {
                Ok(InstallResult {
                    success: true,
                    message: "Node.js installed successfully! Please restart the application for environment variables to take effect.".to_string(),
                    error: None,
                })
            } else {
                Ok(InstallResult {
                    success: false,
                    message: "Application restart required after installation".to_string(),
                    error: Some(output),
                })
            }
        }
        Err(e) => Ok(InstallResult {
            success: false,
            message: "Node.js installation failed".to_string(),
            error: Some(e),
        }),
    }
}

/// Install Node.js on macOS
async fn install_nodejs_macos() -> Result<InstallResult, String> {
    // Install using Homebrew
    let script = r#"
# Check Homebrew
if ! command -v brew &> /dev/null; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Configure PATH
    if [[ -f /opt/homebrew/bin/brew ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [[ -f /usr/local/bin/brew ]]; then
        eval "$(/usr/local/bin/brew shellenv)"
    fi
fi

echo "Installing Node.js 22..."
brew install node@22
brew link --overwrite node@22

# Verify installation
node --version
"#;

    match shell::run_bash_output(script) {
        Ok(output) => Ok(InstallResult {
            success: true,
            message: format!("Node.js installed successfully! {}", output),
            error: None,
        }),
        Err(e) => Ok(InstallResult {
            success: false,
            message: "Node.js installation failed".to_string(),
            error: Some(e),
        }),
    }
}

/// Install Node.js on Linux
async fn install_nodejs_linux() -> Result<InstallResult, String> {
    // Install using NodeSource repository
    let script = r#"
# Detect package manager
if command -v apt-get &> /dev/null; then
    echo "Detected apt, using NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
elif command -v dnf &> /dev/null; then
    echo "Detected dnf, using NodeSource repository..."
    curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
    sudo dnf install -y nodejs
elif command -v yum &> /dev/null; then
    echo "Detected yum, using NodeSource repository..."
    curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
    sudo yum install -y nodejs
elif command -v pacman &> /dev/null; then
    echo "Detected pacman..."
    sudo pacman -S nodejs npm --noconfirm
else
    echo "Unable to detect a supported package manager"
    exit 1
fi

# Verify installation
node --version
"#;

    match shell::run_bash_output(script) {
        Ok(output) => Ok(InstallResult {
            success: true,
            message: format!("Node.js installed successfully! {}", output),
            error: None,
        }),
        Err(e) => Ok(InstallResult {
            success: false,
            message: "Node.js installation failed".to_string(),
            error: Some(e),
        }),
    }
}

/// Install OpenClaw
#[command]
pub async fn install_openclaw() -> Result<InstallResult, String> {
    info!("[Install OpenClaw] Starting OpenClaw installation...");
    let os = platform::get_os();
    info!("[Install OpenClaw] Detected operating system: {}", os);

    let result = match os.as_str() {
        "windows" => {
            info!("[Install OpenClaw] Using Windows installation method...");
            install_openclaw_windows().await
        },
        _ => {
            info!("[Install OpenClaw] Using Unix installation method (npm)...");
            install_openclaw_unix().await
        },
    };

    match &result {
        Ok(r) if r.success => info!("[Install OpenClaw] Installation successful"),
        Ok(r) => warn!("[Install OpenClaw] Installation failed: {}", r.message),
        Err(e) => error!("[Install OpenClaw] Installation error: {}", e),
    }

    result
}

/// Install OpenClaw on Windows
async fn install_openclaw_windows() -> Result<InstallResult, String> {
    let script = r#"
$ErrorActionPreference = 'Stop'

# Check Node.js
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "Error: Please install Node.js first"
    exit 1
}

Write-Host "Installing OpenClaw using npm..."
npm install -g openclaw@latest --unsafe-perm

# Verify installation
$openclawVersion = openclaw --version 2>$null
if ($openclawVersion) {
    Write-Host "OpenClaw installed successfully: $openclawVersion"
    exit 0
} else {
    Write-Host "OpenClaw installation failed"
    exit 1
}
"#;

    match shell::run_powershell_output(script) {
        Ok(output) => {
            if get_openclaw_version().is_some() {
                Ok(InstallResult {
                    success: true,
                    message: "OpenClaw installed successfully!".to_string(),
                    error: None,
                })
            } else {
                Ok(InstallResult {
                    success: false,
                    message: "Application restart required after installation".to_string(),
                    error: Some(output),
                })
            }
        }
        Err(e) => Ok(InstallResult {
            success: false,
            message: "OpenClaw installation failed".to_string(),
            error: Some(e),
        }),
    }
}

/// Install OpenClaw on Unix systems
async fn install_openclaw_unix() -> Result<InstallResult, String> {
    let script = r#"
# Check Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Please install Node.js first"
    exit 1
fi

echo "Installing OpenClaw using npm..."
npm install -g openclaw@latest --unsafe-perm

# Verify installation
openclaw --version
"#;

    match shell::run_bash_output(script) {
        Ok(output) => Ok(InstallResult {
            success: true,
            message: format!("OpenClaw installed successfully! {}", output),
            error: None,
        }),
        Err(e) => Ok(InstallResult {
            success: false,
            message: "OpenClaw installation failed".to_string(),
            error: Some(e),
        }),
    }
}

/// Initialize OpenClaw configuration
#[command]
pub async fn init_openclaw_config() -> Result<InstallResult, String> {
    info!("[Init Config] Starting OpenClaw configuration initialization...");

    let config_dir = platform::get_config_dir();
    info!("[Init Config] Config directory: {}", config_dir);

    // Create config directory
    info!("[Init Config] Creating config directory...");
    if let Err(e) = std::fs::create_dir_all(&config_dir) {
        error!("[Init Config] Failed to create config directory: {}", e);
        return Ok(InstallResult {
            success: false,
            message: "Failed to create config directory".to_string(),
            error: Some(e.to_string()),
        });
    }

    // Create subdirectories
    let subdirs = ["agents/main/sessions", "agents/main/agent", "credentials"];
    for subdir in subdirs {
        let path = format!("{}/{}", config_dir, subdir);
        info!("[Init Config] Creating subdirectory: {}", subdir);
        if let Err(e) = std::fs::create_dir_all(&path) {
            error!("[Init Config] Failed to create directory: {} - {}", subdir, e);
            return Ok(InstallResult {
                success: false,
                message: format!("Failed to create directory: {}", subdir),
                error: Some(e.to_string()),
            });
        }
    }

    // Set config directory permissions to 700 (consistent with shell script chmod 700)
    // Only execute on Unix systems
    #[cfg(unix)]
    {
        info!("[Init Config] Setting directory permissions to 700...");
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = std::fs::metadata(&config_dir) {
            let mut perms = metadata.permissions();
            perms.set_mode(0o700);
            if let Err(e) = std::fs::set_permissions(&config_dir, perms) {
                warn!("[Init Config] Failed to set permissions: {}", e);
            } else {
                info!("[Init Config] Permissions set successfully");
            }
        }
    }

    // Set gateway mode to local
    info!("[Init Config] Executing: openclaw config set gateway.mode local");
    let result = shell::run_openclaw(&["config", "set", "gateway.mode", "local"]);

    // Also set controlUi.allowInsecureAuth for local manager (skip device pairing)
    info!("[Init Config] Executing: openclaw config set gateway.controlUi.allowInsecureAuth true");
    let _ = shell::run_openclaw(&["config", "set", "gateway.controlUi.allowInsecureAuth", "true"]);

    match result {
        Ok(output) => {
            info!("[Init Config] Configuration initialized successfully");
            debug!("[Init Config] Command output: {}", output);
            Ok(InstallResult {
                success: true,
                message: "Configuration initialized successfully!".to_string(),
                error: None,
            })
        },
        Err(e) => {
            error!("[Init Config] Configuration initialization failed: {}", e);
            Ok(InstallResult {
                success: false,
                message: "Configuration initialization failed".to_string(),
                error: Some(e),
            })
        },
    }
}

/// Open terminal to execute installation script (for scenarios requiring administrator privileges)
#[command]
pub async fn open_install_terminal(install_type: String) -> Result<String, String> {
    match install_type.as_str() {
        "nodejs" => open_nodejs_install_terminal().await,
        "openclaw" => open_openclaw_install_terminal().await,
        _ => Err(format!("Unknown installation type: {}", install_type)),
    }
}

/// Open terminal to install Node.js
async fn open_nodejs_install_terminal() -> Result<String, String> {
    if platform::is_windows() {
        // Windows: Open PowerShell to execute installation
        let script = r#"
Start-Process powershell -ArgumentList '-NoExit', '-Command', '
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    Node.js Installation Wizard" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check winget
$hasWinget = Get-Command winget -ErrorAction SilentlyContinue
if ($hasWinget) {
    Write-Host "Installing Node.js 22 using winget..." -ForegroundColor Yellow
    winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
} else {
    Write-Host "Please download and install Node.js from:" -ForegroundColor Yellow
    Write-Host "https://nodejs.org/en/download" -ForegroundColor Green
    Write-Host ""
    Start-Process "https://nodejs.org/en/download"
}

Write-Host ""
Write-Host "Please restart OpenClaw Manager after installation" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to close this window"
' -Verb RunAs
"#;
        shell::run_powershell_output(script)?;
        Ok("Installation terminal opened".to_string())
    } else if platform::is_macos() {
        // macOS: Open Terminal.app
        let script_content = r#"#!/bin/bash
clear
echo "========================================"
echo "    Node.js Installation Wizard"
echo "========================================"
echo ""

# Check Homebrew
if ! command -v brew &> /dev/null; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    if [[ -f /opt/homebrew/bin/brew ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [[ -f /usr/local/bin/brew ]]; then
        eval "$(/usr/local/bin/brew shellenv)"
    fi
fi

echo "Installing Node.js 22..."
brew install node@22
brew link --overwrite node@22

echo ""
echo "Installation complete!"
node --version
echo ""
read -p "Press Enter to close this window..."
"#;

        let script_path = "/tmp/openclaw_install_nodejs.command";
        std::fs::write(script_path, script_content)
            .map_err(|e| format!("Failed to create script: {}", e))?;

        std::process::Command::new("chmod")
            .args(["+x", script_path])
            .output()
            .map_err(|e| format!("Failed to set permissions: {}", e))?;

        std::process::Command::new("open")
            .arg(script_path)
            .spawn()
            .map_err(|e| format!("Failed to launch terminal: {}", e))?;

        Ok("Installation terminal opened".to_string())
    } else {
        Err("Please install Node.js manually: https://nodejs.org/".to_string())
    }
}

/// Open terminal to install OpenClaw
async fn open_openclaw_install_terminal() -> Result<String, String> {
    if platform::is_windows() {
        let script = r#"
Start-Process powershell -ArgumentList '-NoExit', '-Command', '
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    OpenClaw Installation Wizard" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Installing OpenClaw..." -ForegroundColor Yellow
npm install -g openclaw@latest

Write-Host ""
Write-Host "Initializing configuration..."
openclaw config set gateway.mode local

Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Green
openclaw --version
Write-Host ""
Read-Host "Press Enter to close this window"
'
"#;
        shell::run_powershell_output(script)?;
        Ok("Installation terminal opened".to_string())
    } else if platform::is_macos() {
        let script_content = r#"#!/bin/bash
clear
echo "========================================"
echo "    OpenClaw Installation Wizard"
echo "========================================"
echo ""

echo "Installing OpenClaw..."
npm install -g openclaw@latest

echo ""
echo "Initializing configuration..."
openclaw config set gateway.mode local 2>/dev/null || true

mkdir -p ~/.openclaw/agents/main/sessions
mkdir -p ~/.openclaw/agents/main/agent
mkdir -p ~/.openclaw/credentials

echo ""
echo "Installation complete!"
openclaw --version
echo ""
read -p "Press Enter to close this window..."
"#;

        let script_path = "/tmp/openclaw_install_openclaw.command";
        std::fs::write(script_path, script_content)
            .map_err(|e| format!("Failed to create script: {}", e))?;

        std::process::Command::new("chmod")
            .args(["+x", script_path])
            .output()
            .map_err(|e| format!("Failed to set permissions: {}", e))?;

        std::process::Command::new("open")
            .arg(script_path)
            .spawn()
            .map_err(|e| format!("Failed to launch terminal: {}", e))?;

        Ok("Installation terminal opened".to_string())
    } else {
        // Linux
        let script_content = r#"#!/bin/bash
clear
echo "========================================"
echo "    OpenClaw Installation Wizard"
echo "========================================"
echo ""

echo "Installing OpenClaw..."
npm install -g openclaw@latest

echo ""
echo "Initializing configuration..."
openclaw config set gateway.mode local 2>/dev/null || true

mkdir -p ~/.openclaw/agents/main/sessions
mkdir -p ~/.openclaw/agents/main/agent
mkdir -p ~/.openclaw/credentials

echo ""
echo "Installation complete!"
openclaw --version
echo ""
read -p "Press Enter to close..."
"#;

        let script_path = "/tmp/openclaw_install_openclaw.sh";
        std::fs::write(script_path, script_content)
            .map_err(|e| format!("Failed to create script: {}", e))?;

        std::process::Command::new("chmod")
            .args(["+x", script_path])
            .output()
            .map_err(|e| format!("Failed to set permissions: {}", e))?;

        // Try different terminals
        let terminals = ["gnome-terminal", "xfce4-terminal", "konsole", "xterm"];
        for term in terminals {
            if std::process::Command::new(term)
                .args(["--", script_path])
                .spawn()
                .is_ok()
            {
                return Ok("Installation terminal opened".to_string());
            }
        }

        Err("Unable to launch terminal, please run manually: npm install -g openclaw".to_string())
    }
}

/// Uninstall OpenClaw
#[command]
pub async fn uninstall_openclaw() -> Result<InstallResult, String> {
    info!("[Uninstall OpenClaw] Starting OpenClaw uninstallation...");
    let os = platform::get_os();
    info!("[Uninstall OpenClaw] Detected operating system: {}", os);

    // Stop service first
    info!("[Uninstall OpenClaw] Attempting to stop service...");
    let _ = shell::run_openclaw(&["gateway", "stop"]);
    std::thread::sleep(std::time::Duration::from_millis(500));

    let result = match os.as_str() {
        "windows" => {
            info!("[Uninstall OpenClaw] Using Windows uninstallation method...");
            uninstall_openclaw_windows().await
        },
        _ => {
            info!("[Uninstall OpenClaw] Using Unix uninstallation method (npm)...");
            uninstall_openclaw_unix().await
        },
    };

    // After npm uninstall, delete the .openclaw config directory
    if let Some(home) = dirs::home_dir() {
        let openclaw_dir = home.join(".openclaw");
        if openclaw_dir.exists() {
            info!("[Uninstall OpenClaw] Deleting .openclaw directory: {:?}", openclaw_dir);
            match std::fs::remove_dir_all(&openclaw_dir) {
                Ok(_) => info!("[Uninstall OpenClaw] Successfully deleted .openclaw directory"),
                Err(e) => warn!("[Uninstall OpenClaw] Failed to delete .openclaw directory: {}", e),
            }
        } else {
            info!("[Uninstall OpenClaw] .openclaw directory does not exist, skipping");
        }
    } else {
        warn!("[Uninstall OpenClaw] Could not determine home directory, skipping .openclaw deletion");
    }

    match &result {
        Ok(r) if r.success => info!("[Uninstall OpenClaw] Uninstallation successful"),
        Ok(r) => warn!("[Uninstall OpenClaw] Uninstallation failed: {}", r.message),
        Err(e) => error!("[Uninstall OpenClaw] Uninstallation error: {}", e),
    }

    result
}

/// Uninstall OpenClaw on Windows
async fn uninstall_openclaw_windows() -> Result<InstallResult, String> {
    // Use cmd.exe to execute npm uninstall to avoid PowerShell execution policy issues
    info!("[Uninstall OpenClaw] Executing npm uninstall -g openclaw...");

    match shell::run_cmd_output("npm uninstall -g openclaw") {
        Ok(output) => {
            info!("[Uninstall OpenClaw] npm output: {}", output);

            // Verify uninstallation was successful
            std::thread::sleep(std::time::Duration::from_millis(500));
            if get_openclaw_version().is_none() {
                Ok(InstallResult {
                    success: true,
                    message: "OpenClaw has been successfully uninstalled!".to_string(),
                    error: None,
                })
            } else {
                Ok(InstallResult {
                    success: false,
                    message: "Uninstall command executed but OpenClaw still exists, please try manual uninstallation".to_string(),
                    error: Some(output),
                })
            }
        }
        Err(e) => {
            warn!("[Uninstall OpenClaw] npm uninstall failed: {}", e);
            Ok(InstallResult {
                success: false,
                message: "OpenClaw uninstallation failed".to_string(),
                error: Some(e),
            })
        }
    }
}

/// Uninstall OpenClaw on Unix systems
async fn uninstall_openclaw_unix() -> Result<InstallResult, String> {
    let script = r#"
echo "Uninstalling OpenClaw..."
npm uninstall -g openclaw

# Verify uninstallation
if command -v openclaw &> /dev/null; then
    echo "Warning: openclaw command still exists"
    exit 1
else
    echo "OpenClaw has been successfully uninstalled"
    exit 0
fi
"#;

    match shell::run_bash_output(script) {
        Ok(output) => Ok(InstallResult {
            success: true,
            message: format!("OpenClaw has been successfully uninstalled! {}", output),
            error: None,
        }),
        Err(e) => Ok(InstallResult {
            success: false,
            message: "OpenClaw uninstallation failed".to_string(),
            error: Some(e),
        }),
    }
}

/// Version update information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    /// Whether an update is available
    pub update_available: bool,
    /// Current version
    pub current_version: Option<String>,
    /// Latest version
    pub latest_version: Option<String>,
    /// Error message
    pub error: Option<String>,
}

/// Check for OpenClaw updates
#[command]
pub async fn check_openclaw_update() -> Result<UpdateInfo, String> {
    info!("[Version Check] Starting OpenClaw update check...");

    // Get current version
    let current_version = get_openclaw_version();
    info!("[Version Check] Current version: {:?}", current_version);

    if current_version.is_none() {
        info!("[Version Check] OpenClaw is not installed");
        return Ok(UpdateInfo {
            update_available: false,
            current_version: None,
            latest_version: None,
            error: Some("OpenClaw is not installed".to_string()),
        });
    }

    // Get latest version
    let latest_version = get_latest_openclaw_version();
    info!("[Version Check] Latest version: {:?}", latest_version);

    if latest_version.is_none() {
        return Ok(UpdateInfo {
            update_available: false,
            current_version,
            latest_version: None,
            error: Some("Unable to get latest version information".to_string()),
        });
    }

    // Compare versions
    let current = current_version.clone().unwrap();
    let latest = latest_version.clone().unwrap();
    let update_available = compare_versions(&current, &latest);

    info!("[Version Check] Update available: {}", update_available);

    Ok(UpdateInfo {
        update_available,
        current_version,
        latest_version,
        error: None,
    })
}

/// Get the latest version from npm registry
fn get_latest_openclaw_version() -> Option<String> {
    // Use npm view to get the latest version
    let result = if platform::is_windows() {
        shell::run_cmd_output("npm view openclaw version")
    } else {
        shell::run_bash_output("npm view openclaw version 2>/dev/null")
    };

    match result {
        Ok(version) => {
            let v = version.trim().to_string();
            if v.is_empty() {
                None
            } else {
                Some(v)
            }
        }
        Err(e) => {
            warn!("[Version Check] Failed to get latest version: {}", e);
            None
        }
    }
}

/// Compare version numbers, return whether an update is available
/// current: Current version (e.g. "1.0.0" or "v1.0.0")
/// latest: Latest version (e.g. "1.0.1")
fn compare_versions(current: &str, latest: &str) -> bool {
    // Remove possible 'v' prefix and whitespace
    let current = current.trim().trim_start_matches('v');
    let latest = latest.trim().trim_start_matches('v');

    // Split version numbers
    let current_parts: Vec<u32> = current
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();
    let latest_parts: Vec<u32> = latest
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();

    // Compare each part
    for i in 0..3 {
        let c = current_parts.get(i).unwrap_or(&0);
        let l = latest_parts.get(i).unwrap_or(&0);
        if l > c {
            return true;
        } else if l < c {
            return false;
        }
    }

    false
}

/// Update OpenClaw
#[command]
pub async fn update_openclaw() -> Result<InstallResult, String> {
    info!("[Update OpenClaw] Starting OpenClaw update...");
    let os = platform::get_os();

    // Stop service first
    info!("[Update OpenClaw] Attempting to stop service...");
    let _ = shell::run_openclaw(&["gateway", "stop"]);
    std::thread::sleep(std::time::Duration::from_millis(500));

    let result = match os.as_str() {
        "windows" => {
            info!("[Update OpenClaw] Using Windows update method...");
            update_openclaw_windows().await
        },
        _ => {
            info!("[Update OpenClaw] Using Unix update method (npm)...");
            update_openclaw_unix().await
        },
    };

    match &result {
        Ok(r) if r.success => info!("[Update OpenClaw] Update successful"),
        Ok(r) => warn!("[Update OpenClaw] Update failed: {}", r.message),
        Err(e) => error!("[Update OpenClaw] Update error: {}", e),
    }

    result
}

/// Update OpenClaw on Windows
async fn update_openclaw_windows() -> Result<InstallResult, String> {
    info!("[Update OpenClaw] Executing npm install -g openclaw@latest...");

    match shell::run_cmd_output("npm install -g openclaw@latest") {
        Ok(output) => {
            info!("[Update OpenClaw] npm output: {}", output);

            // Get new version
            let new_version = get_openclaw_version();

            Ok(InstallResult {
                success: true,
                message: format!("OpenClaw has been updated to {}", new_version.unwrap_or("latest version".to_string())),
                error: None,
            })
        }
        Err(e) => {
            warn!("[Update OpenClaw] npm install failed: {}", e);
            Ok(InstallResult {
                success: false,
                message: "OpenClaw update failed".to_string(),
                error: Some(e),
            })
        }
    }
}

/// Update OpenClaw on Unix systems
async fn update_openclaw_unix() -> Result<InstallResult, String> {
    let script = r#"
echo "Updating OpenClaw..."
npm install -g openclaw@latest

# Verify update
openclaw --version
"#;

    match shell::run_bash_output(script) {
        Ok(output) => Ok(InstallResult {
            success: true,
            message: format!("OpenClaw has been updated! {}", output),
            error: None,
        }),
        Err(e) => Ok(InstallResult {
            success: false,
            message: "OpenClaw update failed".to_string(),
            error: Some(e),
        }),
    }
}
