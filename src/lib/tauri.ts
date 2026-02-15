import { invoke } from '@tauri-apps/api/core';
import { apiLogger } from './logger';

// Check if running in Tauri environment
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// invoke wrapper with logging (auto checks Tauri environment)
async function invokeWithLog<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error('Not running in Tauri environment, please start via Tauri application');
  }
  apiLogger.apiCall(cmd, args);
  try {
    const result = await invoke<T>(cmd, args);
    apiLogger.apiResponse(cmd, result);
    return result;
  } catch (error) {
    apiLogger.apiError(cmd, error);
    throw error;
  }
}

// Service status
export interface ServiceStatus {
  running: boolean;
  pid: number | null;
  port: number;
  uptime_seconds: number | null;
  memory_mb: number | null;
  cpu_percent: number | null;
}

// System information
export interface SystemInfo {
  os: string;
  os_version: string;
  arch: string;
  openclaw_installed: boolean;
  openclaw_version: string | null;
  node_version: string | null;
  config_dir: string;
}

// AI Provider option (legacy compatibility)
export interface AIProviderOption {
  id: string;
  name: string;
  icon: string;
  default_base_url: string | null;
  models: AIModelOption[];
  requires_api_key: boolean;
}

export interface AIModelOption {
  id: string;
  name: string;
  description: string | null;
  recommended: boolean;
}

// Official Provider preset
export interface OfficialProvider {
  id: string;
  name: string;
  icon: string;
  default_base_url: string | null;
  api_type: string;
  suggested_models: SuggestedModel[];
  requires_api_key: boolean;
  docs_url: string | null;
}

export interface SuggestedModel {
  id: string;
  name: string;
  description: string | null;
  context_window: number | null;
  max_tokens: number | null;
  recommended: boolean;
}

// Configured Provider
export interface ConfiguredProvider {
  name: string;
  base_url: string;
  api_key_masked: string | null;
  has_api_key: boolean;
  models: ConfiguredModel[];
}

export interface ConfiguredModel {
  full_id: string;
  id: string;
  name: string;
  api_type: string | null;
  context_window: number | null;
  max_tokens: number | null;
  is_primary: boolean;
}

// AI configuration overview
export interface AIConfigOverview {
  primary_model: string | null;
  configured_providers: ConfiguredProvider[];
  available_models: string[];
}

// Model configuration
export interface ModelConfig {
  id: string;
  name: string;
  api: string | null;
  input: string[];
  context_window: number | null;
  max_tokens: number | null;
  reasoning: boolean | null;
  cost: { input: number; output: number; cache_read: number; cache_write: number } | null;
}

// Channel configuration
export interface ChannelConfig {
  id: string;
  channel_type: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

// Diagnostic result
export interface DiagnosticResult {
  name: string;
  passed: boolean;
  message: string;
  suggestion: string | null;
}

// AI test result
export interface AITestResult {
  success: boolean;
  provider: string;
  model: string;
  response: string | null;
  error: string | null;
  latency_ms: number | null;
}

// MCP Configuration
export interface MCPConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled: boolean;
}

// Skill
export interface Skill {
  id: string;
  name: string;
  description: string | null;
  path: string;
}

// API wrapper (with logging)
export const api = {
  // Service management
  getServiceStatus: () => invokeWithLog<ServiceStatus>('get_service_status'),
  startService: () => invokeWithLog<string>('start_service'),
  stopService: () => invokeWithLog<string>('stop_service'),
  restartService: () => invokeWithLog<string>('restart_service'),
  getLogs: (lines?: number) => invokeWithLog<string[]>('get_logs', { lines }),

  // System information
  getSystemInfo: () => invokeWithLog<SystemInfo>('get_system_info'),
  checkOpenclawInstalled: () => invokeWithLog<boolean>('check_openclaw_installed'),
  getOpenclawVersion: () => invokeWithLog<string | null>('get_openclaw_version'),

  // Configuration management
  getConfig: () => invokeWithLog<unknown>('get_config'),
  saveConfig: (config: unknown) => invokeWithLog<string>('save_config', { config }),
  getEnvValue: (key: string) => invokeWithLog<string | null>('get_env_value', { key }),
  saveEnvValue: (key: string, value: string) =>
    invokeWithLog<string>('save_env_value', { key, value }),

  // AI Provider (legacy compatibility)
  getAIProviders: () => invokeWithLog<AIProviderOption[]>('get_ai_providers'),

  // AI Configuration (new version)
  getOfficialProviders: () => invokeWithLog<OfficialProvider[]>('get_official_providers'),
  getAIConfig: () => invokeWithLog<AIConfigOverview>('get_ai_config'),
  saveProvider: (
    providerName: string,
    baseUrl: string,
    apiKey: string | null,
    apiType: string,
    models: ModelConfig[]
  ) =>
    invokeWithLog<string>('save_provider', {
      providerName,
      baseUrl,
      apiKey,
      apiType,
      models,
    }),
  deleteProvider: (providerName: string) =>
    invokeWithLog<string>('delete_provider', { providerName }),
  setPrimaryModel: (modelId: string) =>
    invokeWithLog<string>('set_primary_model', { modelId }),
  addAvailableModel: (modelId: string) =>
    invokeWithLog<string>('add_available_model', { modelId }),
  removeAvailableModel: (modelId: string) =>
    invokeWithLog<string>('remove_available_model', { modelId }),

  // Channels
  getChannelsConfig: () => invokeWithLog<ChannelConfig[]>('get_channels_config'),
  saveChannelConfig: (channel: ChannelConfig) =>
    invokeWithLog<string>('save_channel_config', { channel }),

  // MCP
  getMCPConfig: () => invokeWithLog<Record<string, MCPConfig>>('get_mcp_config'),
  saveMCPConfig: (name: string, config: MCPConfig | null) =>
    invokeWithLog<string>('save_mcp_config', { name, config }),
  installMCPFromGit: (url: string) =>
    invokeWithLog<string>('install_mcp_from_git', { url }),
  uninstallMCP: (name: string) =>
    invokeWithLog<string>('uninstall_mcp', { name }),
  checkMcporterInstalled: () =>
    invokeWithLog<boolean>('check_mcporter_installed'),
  installMcporter: () =>
    invokeWithLog<string>('install_mcporter'),
  uninstallMcporter: () =>
    invokeWithLog<string>('uninstall_mcporter'),
  installMCPPlugin: (url: string) =>
    invokeWithLog<string>('install_mcp_plugin', { url }),
  openclawConfigSet: (key: string, value: string) =>
    invokeWithLog<string>('openclaw_config_set', { key, value }),
  testMCPServer: (serverType: string, target: string, command?: string, args?: string[]) =>
    invokeWithLog<string>('test_mcp_server', { serverType, target, command: command || null, args: args || null }),

  // Skills
  getSkills: () => invokeWithLog<Skill[]>('get_skills'),
  checkClawhubInstalled: () => invokeWithLog<boolean>('check_clawhub_installed'),
  installClawhub: () => invokeWithLog<string>('install_clawhub'),
  uninstallClawhub: () => invokeWithLog<string>('uninstall_clawhub'),
  installSkill: (name: string) => invokeWithLog<string>('install_skill', { skillName: name }),
  uninstallSkill: (id: string) => invokeWithLog<string>('uninstall_skill', { skillId: id }),

  // Diagnostics and testing
  runDoctor: () => invokeWithLog<DiagnosticResult[]>('run_doctor'),
  testAIConnection: () => invokeWithLog<AITestResult>('test_ai_connection'),
  testChannel: (channelType: string) =>
    invokeWithLog<unknown>('test_channel', { channelType }),
};
