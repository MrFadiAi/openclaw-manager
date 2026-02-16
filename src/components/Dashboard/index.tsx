import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { StatusCard } from './StatusCard';
import { QuickActions } from './QuickActions';
import { SystemInfo } from './SystemInfo';
import { Setup } from '../Setup';
import { api, ServiceStatus, isTauri } from '../../lib/tauri';
import { Terminal, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Wrench, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { EnvironmentStatus } from '../../App';

interface DashboardProps {
  envStatus: EnvironmentStatus | null;
  onSetupComplete: () => void;
}

export function Dashboard({ envStatus, onSetupComplete }: DashboardProps) {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(true);
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [tokenMismatch, setTokenMismatch] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repairDismissed, setRepairDismissed] = useState(false);

  const fetchStatus = async () => {
    if (!isTauri()) {
      setLoading(false);
      return;
    }
    try {
      const result = await api.getServiceStatus();
      setStatus(result);
    } catch {
      // Handle silently
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    if (!isTauri()) return;
    try {
      const result = await invoke<string[]>('get_logs', { lines: 50 });
      setLogs(result);
    } catch {
      // Handle silently
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchLogs();
    if (!isTauri()) return;

    const statusInterval = setInterval(fetchStatus, 3000);
    const logsInterval = autoRefreshLogs ? setInterval(fetchLogs, 2000) : null;

    return () => {
      clearInterval(statusInterval);
      if (logsInterval) clearInterval(logsInterval);
    };
  }, [autoRefreshLogs]);

  // Detect device_token_mismatch from logs
  useEffect(() => {
    if (repairDismissed) return;
    const hasMismatch = logs.some(line => line.includes('device_token_mismatch'));
    setTokenMismatch(hasMismatch);
  }, [logs, repairDismissed]);

  // Auto scroll to bottom of logs
  useEffect(() => {
    if (logsExpanded && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, logsExpanded]);

  const handleStart = async () => {
    if (!isTauri()) return;
    setActionLoading(true);
    try {
      await api.startService();
      await fetchStatus();
      await fetchLogs();
    } catch (e) {
      console.error('Start failed:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    if (!isTauri()) return;
    setActionLoading(true);
    try {
      await api.stopService();
      await fetchStatus();
      await fetchLogs();
    } catch (e) {
      console.error('Stop failed:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestart = async () => {
    if (!isTauri()) return;
    setActionLoading(true);
    try {
      await api.restartService();
      await fetchStatus();
      await fetchLogs();
    } catch (e) {
      console.error('Restart failed:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleKillAll = async () => {
    if (!isTauri()) return;
    setActionLoading(true);
    try {
      await invoke<string>('kill_all_port_processes');
      await fetchStatus();
      await fetchLogs();
    } catch (e) {
      console.error('Kill All failed:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRepairDeviceToken = async () => {
    if (!isTauri()) return;
    setRepairing(true);
    try {
      await invoke<string>('repair_device_token');
      await api.restartService();
      setRepairDismissed(true);
      setTokenMismatch(false);
      await fetchStatus();
      await fetchLogs();
    } catch (e) {
      console.error('Device token repair failed:', e);
      alert(`Repair failed: ${e}`);
    } finally {
      setRepairing(false);
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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  // Check if environment is ready
  const needsSetup = envStatus && !envStatus.ready;

  return (
    <div className="h-full overflow-y-auto scroll-container pr-2">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* Environment setup wizard (only shown when needed) */}
        {needsSetup && (
          <motion.div variants={itemVariants}>
            <Setup onComplete={onSetupComplete} embedded />
          </motion.div>
        )}

        {/* Device token mismatch warning banner */}
        {tokenMismatch && !repairDismissed && (
          <motion.div variants={itemVariants}>
            <div className="bg-amber-500/10 rounded-2xl p-5 border border-amber-500/30">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-amber-500/20 rounded-lg shrink-0 mt-0.5">
                  <AlertTriangle size={20} className="text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-amber-300 mb-1">
                    Device Token Mismatch Detected
                  </h3>
                  <p className="text-xs text-amber-200/70 leading-relaxed">
                    The gateway is rejecting connections because the device identity is out of sync.
                    This usually happens after a reinstall or config migration. Click the button below
                    to reset the device identity and restart the service.
                  </p>
                </div>
                <button
                  onClick={handleRepairDeviceToken}
                  disabled={repairing}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0',
                    'bg-amber-500/20 text-amber-300 border border-amber-500/40',
                    'hover:bg-amber-500/30 disabled:opacity-50'
                  )}
                >
                  {repairing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Wrench size={14} />
                  )}
                  {repairing ? 'Fixing...' : 'Fix & Restart'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Service status card */}
        <motion.div variants={itemVariants}>
          <StatusCard status={status} loading={loading} />
        </motion.div>

        {/* Quick actions */}
        <motion.div variants={itemVariants}>
          <QuickActions
            status={status}
            loading={actionLoading}
            onStart={handleStart}
            onStop={handleStop}
            onRestart={handleRestart}
            onKillAll={handleKillAll}
          />
        </motion.div>

        {/* Real-time logs */}
        <motion.div variants={itemVariants}>
          <div className="bg-dark-700 rounded-2xl border border-dark-500 overflow-hidden">
            {/* Log title bar */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-dark-600/50 cursor-pointer"
              onClick={() => setLogsExpanded(!logsExpanded)}
            >
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-white">Real-time Logs</span>
                <span className="text-xs text-gray-500">
                  ({logs.length} lines)
                </span>
              </div>
              <div className="flex items-center gap-3">
                {logsExpanded && (
                  <>
                    <label
                      className="flex items-center gap-2 text-xs text-gray-400"
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={autoRefreshLogs}
                        onChange={(e) => setAutoRefreshLogs(e.target.checked)}
                        className="w-3 h-3 rounded border-dark-500 bg-dark-600 text-claw-500"
                      />
                      Auto Refresh
                    </label>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchLogs();
                      }}
                      className="text-gray-500 hover:text-white"
                      title="Refresh logs"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </>
                )}
                {logsExpanded ? (
                  <ChevronUp size={16} className="text-gray-500" />
                ) : (
                  <ChevronDown size={16} className="text-gray-500" />
                )}
              </div>
            </div>

            {/* Log content */}
            {logsExpanded && (
              <div className="h-64 overflow-y-auto p-4 font-mono text-xs leading-relaxed bg-dark-800">
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    <p>No logs yet, please start the service first</p>
                  </div>
                ) : (
                  <>
                    {logs.map((line, index) => (
                      <div
                        key={index}
                        className={clsx('py-0.5 whitespace-pre-wrap break-all', getLogLineClass(line))}
                      >
                        {line}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* System info */}
        <motion.div variants={itemVariants}>
          <SystemInfo />
        </motion.div>
      </motion.div>
    </div>
  );
}
