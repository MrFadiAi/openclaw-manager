import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Play,
  Square,
  RotateCcw,
  FileText,
  RefreshCw,
  Terminal,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import { serviceLogger } from '../../lib/logger';

export function ServiceManager() {
  const [logs, setLogs] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  serviceLogger.debug('ServiceManager component rendered');

  const fetchLogs = async () => {
    try {
      const result = await invoke<string[]>('get_logs', { lines: 100 });
      setLogs(result);
      serviceLogger.debug(`Fetched ${result.length} log lines`);
    } catch (e) {
      serviceLogger.error('Failed to fetch logs', e);
    }
  };

  useEffect(() => {
    serviceLogger.info('ServiceManager component mounted');
    fetchLogs();
    if (autoRefresh) {
      serviceLogger.debug('Starting auto refresh (interval: 2s)');
      const interval = setInterval(fetchLogs, 2000);
      return () => {
        serviceLogger.debug('Stopping auto refresh');
        clearInterval(interval);
      };
    }
  }, [autoRefresh]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    serviceLogger.action(`Service action: ${action}`);
    serviceLogger.info(`Executing: ${action}_service`);
    setActionLoading(action);
    try {
      const result = await invoke(`${action}_service`);
      serviceLogger.info(`✅ ${action} succeeded`, result);
      await fetchLogs();
    } catch (e) {
      serviceLogger.error(`❌ ${action} failed`, e);
      alert(`Operation failed: ${e}`);
    } finally {
      setActionLoading(null);
    }
  };

  const getLogLineClass = (line: string) => {
    if (line.includes('error') || line.includes('Error') || line.includes('ERROR')) {
      return 'text-red-400';
    }
    if (line.includes('warn') || line.includes('Warn') || line.includes('WARN')) {
      return 'text-yellow-400';
    }
    if (line.includes('info') || line.includes('Info') || line.includes('INFO')) {
      return 'text-green-400';
    }
    return 'text-gray-400';
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Action buttons bar */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAction('start')}
            disabled={actionLoading !== null}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
              'bg-green-500/20 text-green-400 border border-green-500/30',
              'hover:bg-green-500/30 disabled:opacity-50'
            )}
          >
            {actionLoading === 'start' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Play size={16} />
            )}
            Start
          </button>

          <button
            onClick={() => handleAction('stop')}
            disabled={actionLoading !== null}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
              'bg-red-500/20 text-red-400 border border-red-500/30',
              'hover:bg-red-500/30 disabled:opacity-50'
            )}
          >
            {actionLoading === 'stop' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Square size={16} />
            )}
            Stop
          </button>

          <button
            onClick={() => handleAction('restart')}
            disabled={actionLoading !== null}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
              'bg-amber-500/20 text-amber-400 border border-amber-500/30',
              'hover:bg-amber-500/30 disabled:opacity-50'
            )}
          >
            {actionLoading === 'restart' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RotateCcw size={16} />
            )}
            Restart
          </button>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded border-dark-500 bg-dark-600 text-claw-500 focus:ring-claw-500"
            />
            Auto refresh
          </label>

          <button
            onClick={fetchLogs}
            className="icon-button text-gray-400 hover:text-white"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Log viewer */}
      <div className="flex-1 bg-dark-800 rounded-xl border border-dark-600 overflow-hidden flex flex-col">
        {/* Log title bar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-dark-700 border-b border-dark-600">
          <Terminal size={14} className="text-gray-500" />
          <span className="text-xs text-gray-400 font-medium">
            /tmp/openclaw-gateway.log
          </span>
          <div className="flex-1" />
          <span className="text-xs text-gray-500">
            {logs.length} lines
          </span>
        </div>

        {/* Log content */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <FileText size={32} className="mx-auto mb-2 opacity-50" />
                <p>No logs available</p>
              </div>
            </div>
          ) : (
            <>
              {logs.map((line, index) => (
                <div
                  key={index}
                  className={clsx('py-0.5', getLogLineClass(line))}
                >
                  <span className="text-gray-600 mr-3 select-none">
                    {String(index + 1).padStart(4, ' ')}
                  </span>
                  {line}
                </div>
              ))}
              <div ref={logsEndRef} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
