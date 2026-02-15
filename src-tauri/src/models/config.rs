use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// OpenClaw complete configuration - corresponds to openclaw.json structure
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OpenClawConfig {
    /// Agent configuration
    #[serde(default)]
    pub agents: AgentsConfig,
    /// Model configuration
    #[serde(default)]
    pub models: ModelsConfig,
    /// Gateway configuration
    #[serde(default)]
    pub gateway: GatewayConfig,
    /// Channel configuration
    #[serde(default)]
    pub channels: HashMap<String, serde_json::Value>,
    /// Plugin configuration
    #[serde(default)]
    pub plugins: PluginsConfig,
    /// MCP configuration
    #[serde(default)]
    pub mcp: HashMap<String, MCPConfig>,
    /// Metadata
    #[serde(default)]
    pub meta: MetaConfig,
}

/// Agent configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AgentsConfig {
    /// Default configuration
    #[serde(default)]
    pub defaults: AgentDefaults,
}

/// Agent default configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AgentDefaults {
    /// Model configuration
    #[serde(default)]
    pub model: AgentModelConfig,
    /// Available model list (provider/model -> {})
    #[serde(default)]
    pub models: HashMap<String, serde_json::Value>,
    /// Compression configuration
    #[serde(default)]
    pub compaction: Option<serde_json::Value>,
    /// Context pruning
    #[serde(rename = "contextPruning", default)]
    pub context_pruning: Option<serde_json::Value>,
    /// Heartbeat configuration
    #[serde(default)]
    pub heartbeat: Option<serde_json::Value>,
    /// Maximum concurrency
    #[serde(rename = "maxConcurrent", default)]
    pub max_concurrent: Option<u32>,
    /// Sub-agent configuration
    #[serde(default)]
    pub subagents: Option<serde_json::Value>,
}

/// Agent model configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AgentModelConfig {
    /// Primary model (format: provider/model-id)
    #[serde(default)]
    pub primary: Option<String>,
}

/// Model configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModelsConfig {
    /// Provider configuration mapping
    #[serde(default)]
    pub providers: HashMap<String, ProviderConfig>,
}

/// Provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    /// API URL
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    /// API Key
    #[serde(rename = "apiKey")]
    pub api_key: Option<String>,
    /// Model list
    #[serde(default)]
    pub models: Vec<ModelConfig>,
}

/// Model configuration details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    /// Model ID
    pub id: String,
    /// Display name
    pub name: String,
    /// API type (anthropic-messages / openai-completions)
    #[serde(default)]
    pub api: Option<String>,
    /// Supported input types
    #[serde(default)]
    pub input: Vec<String>,
    /// Context window size
    #[serde(rename = "contextWindow", default)]
    pub context_window: Option<u32>,
    /// Maximum output tokens
    #[serde(rename = "maxTokens", default)]
    pub max_tokens: Option<u32>,
    /// Whether reasoning mode is supported
    #[serde(default)]
    pub reasoning: Option<bool>,
    /// Cost configuration
    #[serde(default)]
    pub cost: Option<ModelCostConfig>,
}

/// Model cost configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModelCostConfig {
    #[serde(default)]
    pub input: f64,
    #[serde(default)]
    pub output: f64,
    #[serde(rename = "cacheRead", default)]
    pub cache_read: f64,
    #[serde(rename = "cacheWrite", default)]
    pub cache_write: f64,
}

/// Gateway configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GatewayConfig {
    /// Mode: local or cloud
    #[serde(default)]
    pub mode: Option<String>,
    /// Authentication configuration
    #[serde(default)]
    pub auth: Option<GatewayAuthConfig>,
}

/// Gateway authentication configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GatewayAuthConfig {
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub token: Option<String>,
}

/// Plugin configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PluginsConfig {
    #[serde(default)]
    pub allow: Vec<String>,
    #[serde(default)]
    pub entries: HashMap<String, serde_json::Value>,
    #[serde(default)]
    pub installs: HashMap<String, serde_json::Value>,
}

/// MCP configuration (supports both stdio and HTTP modes)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPConfig {
    /// Command to run (for stdio servers)
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub command: String,
    /// Arguments (for stdio servers)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub args: Vec<String>,
    /// Environment variables
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub env: HashMap<String, String>,
    /// URL (for HTTP/remote MCP servers)
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub url: String,
    /// Whether enabled
    #[serde(default = "default_mcp_enabled")]
    pub enabled: bool,
}

fn default_mcp_enabled() -> bool {
    true
}

/// Metadata configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MetaConfig {
    #[serde(rename = "lastTouchedAt", default)]
    pub last_touched_at: Option<String>,
    #[serde(rename = "lastTouchedVersion", default)]
    pub last_touched_version: Option<String>,
}

// ============ Data structures for frontend display ============

/// Official Provider preset (for frontend display)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfficialProvider {
    /// Provider ID (used in configuration)
    pub id: String,
    /// Display name
    pub name: String,
    /// Icon (emoji)
    pub icon: String,
    /// Official API URL
    pub default_base_url: Option<String>,
    /// API type
    pub api_type: String,
    /// Recommended model list
    pub suggested_models: Vec<SuggestedModel>,
    /// Whether API Key is required
    pub requires_api_key: bool,
    /// Documentation URL
    pub docs_url: Option<String>,
}

/// Recommended model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestedModel {
    /// Model ID
    pub id: String,
    /// Display name
    pub name: String,
    /// Description
    pub description: Option<String>,
    /// Context window
    pub context_window: Option<u32>,
    /// Maximum output
    pub max_tokens: Option<u32>,
    /// Whether recommended
    pub recommended: bool,
}

/// Configured Provider (read from configuration file)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfiguredProvider {
    /// Provider name (key in configuration)
    pub name: String,
    /// API URL
    pub base_url: String,
    /// API Key (masked for display)
    pub api_key_masked: Option<String>,
    /// Whether API Key exists
    pub has_api_key: bool,
    /// Configured model list
    pub models: Vec<ConfiguredModel>,
}

/// Configured model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfiguredModel {
    /// Full model ID (provider/model-id)
    pub full_id: String,
    /// Model ID
    pub id: String,
    /// Display name
    pub name: String,
    /// API type
    pub api_type: Option<String>,
    /// Context window
    pub context_window: Option<u32>,
    /// Maximum output
    pub max_tokens: Option<u32>,
    /// Whether it is the primary model
    pub is_primary: bool,
}

/// AI configuration overview (returned to frontend)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfigOverview {
    /// Primary model
    pub primary_model: Option<String>,
    /// Configured provider list
    pub configured_providers: Vec<ConfiguredProvider>,
    /// Available model list
    pub available_models: Vec<String>,
}

// ============ Legacy data structures for compatibility ============

/// AI Provider option (for frontend display) - legacy compatibility
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIProviderOption {
    /// Provider ID
    pub id: String,
    /// Display name
    pub name: String,
    /// Icon (emoji)
    pub icon: String,
    /// Official API URL
    pub default_base_url: Option<String>,
    /// Recommended model list
    pub models: Vec<AIModelOption>,
    /// Whether API Key is required
    pub requires_api_key: bool,
}

/// AI model option - legacy compatibility
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIModelOption {
    /// Model ID
    pub id: String,
    /// Display name
    pub name: String,
    /// Description
    pub description: Option<String>,
    /// Whether recommended
    pub recommended: bool,
}

/// Channel configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelConfig {
    /// Channel ID
    pub id: String,
    /// Channel type
    pub channel_type: String,
    /// Whether enabled
    pub enabled: bool,
    /// Configuration details
    pub config: HashMap<String, serde_json::Value>,
}

/// Environment variable configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvConfig {
    pub key: String,
    pub value: String,
}
