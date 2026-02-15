/**
 * Frontend Logger Utility
 * Centralized management for all frontend log output for easy debugging and tracing
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Log entry
export interface LogEntry {
  id: number;
  timestamp: Date;
  level: LogLevel;
  module: string;
  message: string;
  args: unknown[];
}

// Log level weights
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Log storage
class LogStore {
  private logs: LogEntry[] = [];
  private maxLogs = 500;
  private idCounter = 0;
  private listeners: Set<() => void> = new Set();

  add(entry: Omit<LogEntry, 'id'>) {
    const newEntry: LogEntry = {
      ...entry,
      id: ++this.idCounter,
    };
    this.logs.push(newEntry);

    // Limit log count
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener());
  }

  getAll(): LogEntry[] {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

// Global log store instance
export const logStore = new LogStore();

// Current log level (configurable via localStorage)
const getCurrentLevel = (): LogLevel => {
  if (typeof window !== 'undefined') {
    const level = localStorage.getItem('LOG_LEVEL') as LogLevel;
    if (level && LOG_LEVELS[level] !== undefined) {
      return level;
    }
  }
  // Default to debug level (show all logs during development)
  return 'debug';
};

// Log styles
const STYLES: Record<LogLevel, string> = {
  debug: 'color: #888; font-weight: normal',
  info: 'color: #4ade80; font-weight: normal',
  warn: 'color: #facc15; font-weight: bold',
  error: 'color: #f87171; font-weight: bold',
};

// Module colors (assign different colors to different modules)
const MODULE_COLORS: Record<string, string> = {
  App: '#a78bfa',
  Service: '#60a5fa',
  Config: '#34d399',
  AI: '#f472b6',
  Channel: '#fb923c',
  Setup: '#22d3ee',
  Dashboard: '#a3e635',
  Testing: '#e879f9',
  API: '#fbbf24',
};

const getModuleColor = (module: string): string => {
  return MODULE_COLORS[module] || '#94a3b8';
};

class Logger {
  private module: string;

  constructor(module: string) {
    this.module = module;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[getCurrentLevel()];
  }

  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return;

    const now = new Date();
    const timestamp = now.toLocaleTimeString('zh-CN', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
    
    const moduleColor = getModuleColor(this.module);
    const prefix = `%c${timestamp} %c[${this.module}]%c`;
    
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    
    console[consoleMethod](
      prefix + ` %c${message}`,
      'color: #666',
      `color: ${moduleColor}; font-weight: bold`,
      '',
      STYLES[level],
      ...args
    );

    // Store log
    logStore.add({
      timestamp: now,
      level,
      module: this.module,
      message,
      args,
    });
  }

  debug(message: string, ...args: unknown[]): void {
    this.formatMessage('debug', message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.formatMessage('info', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.formatMessage('warn', message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.formatMessage('error', message, ...args);
  }

  // Log API call
  apiCall(method: string, ...args: unknown[]): void {
    this.debug(`📡 API Call: ${method}`, ...args);
  }

  // Log API response
  apiResponse(method: string, result: unknown): void {
    this.debug(`✅ API Response: ${method}`, result);
  }

  // Log API error
  apiError(method: string, error: unknown): void {
    this.error(`❌ API Error: ${method}`, error);
  }

  // Log user action
  action(action: string, ...args: unknown[]): void {
    this.info(`👆 User Action: ${action}`, ...args);
  }

  // Log state change
  state(description: string, state: unknown): void {
    this.debug(`📊 State Change: ${description}`, state);
  }
}

// Factory function to create module logger
export function createLogger(module: string): Logger {
  return new Logger(module);
}

// Global function to set log level
export function setLogLevel(level: LogLevel): void {
  localStorage.setItem('LOG_LEVEL', level);
  console.log(`%cLog level set to: ${level}`, 'color: #4ade80; font-weight: bold');
}

// Export pre-created common loggers
export const appLogger = createLogger('App');
export const serviceLogger = createLogger('Service');
export const configLogger = createLogger('Config');
export const aiLogger = createLogger('AI');
export const channelLogger = createLogger('Channel');
export const setupLogger = createLogger('Setup');
export const dashboardLogger = createLogger('Dashboard');
export const testingLogger = createLogger('Testing');
export const apiLogger = createLogger('API');

// Expose log control functions in console
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).setLogLevel = setLogLevel;
  (window as unknown as Record<string, unknown>).logStore = logStore;
  console.log(
    '%c🦞 OpenClaw Manager logging enabled\n' +
    '%cUse setLogLevel("debug"|"info"|"warn"|"error") to set log level',
    'color: #a78bfa; font-weight: bold; font-size: 14px',
    'color: #888; font-size: 12px'
  );
}
