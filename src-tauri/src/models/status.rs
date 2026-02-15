use serde::{Deserialize, Serialize};

/// Service running status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceStatus {
    /// Whether it is running
    pub running: bool,
    /// Process ID
    pub pid: Option<u32>,
    /// Listening port
    pub port: u16,
    /// Uptime (seconds)
    pub uptime_seconds: Option<u64>,
    /// Memory usage (MB)
    pub memory_mb: Option<f64>,
    /// CPU usage percentage
    pub cpu_percent: Option<f64>,
}

impl Default for ServiceStatus {
    fn default() -> Self {
        Self {
            running: false,
            pid: None,
            port: 18789,
            uptime_seconds: None,
            memory_mb: None,
            cpu_percent: None,
        }
    }
}

/// System information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    /// Operating system type
    pub os: String,
    /// Operating system version
    pub os_version: String,
    /// System architecture
    pub arch: String,
    /// Whether OpenClaw is installed
    pub openclaw_installed: bool,
    /// OpenClaw version
    pub openclaw_version: Option<String>,
    /// Node.js version
    pub node_version: Option<String>,
    /// Configuration directory
    pub config_dir: String,
}

/// Diagnostic result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticResult {
    /// Check item name
    pub name: String,
    /// Whether passed
    pub passed: bool,
    /// Detailed information
    pub message: String,
    /// Fix suggestion
    pub suggestion: Option<String>,
}

/// AI connection test result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AITestResult {
    /// Whether successful
    pub success: bool,
    /// Provider name
    pub provider: String,
    /// Model name
    pub model: String,
    /// Response content
    pub response: Option<String>,
    /// Error message
    pub error: Option<String>,
    /// Response time (milliseconds)
    pub latency_ms: Option<u64>,
}

/// Channel test result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelTestResult {
    /// Whether successful
    pub success: bool,
    /// Channel name
    pub channel: String,
    /// Message
    pub message: String,
    /// Error message
    pub error: Option<String>,
}
