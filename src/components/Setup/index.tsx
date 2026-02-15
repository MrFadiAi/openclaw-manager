import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import {
  CheckCircle2,
  Loader2,
  Download,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Cpu,
  Package
} from 'lucide-react';
import { setupLogger } from '../../lib/logger';

interface EnvironmentStatus {
  node_installed: boolean;
  node_version: string | null;
  node_version_ok: boolean;
  git_installed: boolean;
  git_version: string | null;
  openclaw_installed: boolean;
  openclaw_version: string | null;
  config_dir_exists: boolean;
  ready: boolean;
  os: string;
}

interface InstallResult {
  success: boolean;
  message: string;
  error: string | null;
}

interface SetupProps {
  onComplete: () => void;
  /** Embedded mode (display within Dashboard) */
  embedded?: boolean;
}

export function Setup({ onComplete, embedded = false }: SetupProps) {
  const [envStatus, setEnvStatus] = useState<EnvironmentStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [installing, setInstalling] = useState<'nodejs' | 'openclaw' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'check' | 'install' | 'complete'>('check');

  const checkEnvironment = async () => {
    setupLogger.info('Checking system environment...');
    setChecking(true);
    setError(null);
    try {
      const status = await invoke<EnvironmentStatus>('check_environment');
      setupLogger.state('Environment status', status);
      setEnvStatus(status);

      if (status.ready) {
        setupLogger.info('✅ Environment ready');
        setStep('complete');
        // Delay before transition to let user see success status
        setTimeout(() => onComplete(), 1500);
      } else {
        setupLogger.warn('Environment not ready, dependencies need to be installed');
        setStep('install');
      }
    } catch (e) {
      setupLogger.error('Environment check failed', e);
      setError(`Environment check failed: ${e}`);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    setupLogger.info('Setup component initialized');
    checkEnvironment();
  }, []);

  const handleInstallNodejs = async () => {
    setupLogger.action('Install Node.js');
    setupLogger.info('Starting Node.js installation...');
    setInstalling('nodejs');
    setError(null);

    try {
      // Try direct installation first
      const result = await invoke<InstallResult>('install_nodejs');

      if (result.success) {
        setupLogger.info('✅ Node.js installed successfully');
        // Re-check environment
        await checkEnvironment();
      } else if (result.message.includes('restart') || result.message.includes('重启')) {
        // Need to restart application
        setError('Node.js installation complete, please restart the application for environment variables to take effect');
      } else {
        // Open terminal for manual installation
        await invoke<string>('open_install_terminal', { installType: 'nodejs' });
        setError('Installation terminal opened, please complete the installation in the terminal then click "Re-check"');
      }
    } catch (e) {
      // If automatic installation fails, open terminal
      try {
        await invoke<string>('open_install_terminal', { installType: 'nodejs' });
        setError('Installation terminal opened, please complete the installation in the terminal then click "Re-check"');
      } catch (termErr) {
        setError(`Installation failed: ${e}. ${termErr}`);
      }
    } finally {
      setInstalling(null);
    }
  };

  const handleInstallOpenclaw = async () => {
    setupLogger.action('Install OpenClaw');
    setupLogger.info('Starting OpenClaw installation...');
    setInstalling('openclaw');
    setError(null);

    try {
      const result = await invoke<InstallResult>('install_openclaw');

      if (result.success) {
        setupLogger.info('✅ OpenClaw installed successfully, initializing config...');
        // Initialize config
        await invoke<InstallResult>('init_openclaw_config');
        setupLogger.info('✅ Config initialization complete');
        // Re-check environment
        await checkEnvironment();
      } else {
        setupLogger.warn('Automatic installation failed, opening terminal for manual installation');
        // Open terminal for manual installation
        await invoke<string>('open_install_terminal', { installType: 'openclaw' });
        setError('Installation terminal opened, please complete the installation in the terminal then click "Re-check"');
      }
    } catch (e) {
      setupLogger.error('Installation failed, trying to open terminal', e);
      try {
        await invoke<string>('open_install_terminal', { installType: 'openclaw' });
        setError('Installation terminal opened, please complete the installation in the terminal then click "Re-check"');
      } catch (termErr) {
        setError(`Installation failed: ${e}. ${termErr}`);
      }
    } finally {
      setInstalling(null);
    }
  };

  const getOsName = (os: string) => {
    switch (os) {
      case 'windows': return 'Windows';
      case 'macos': return 'macOS';
      case 'linux': return 'Linux';
      default: return os;
    }
  };

  // Render installation content (reusable in embedded and fullscreen modes)
  const renderContent = () => {
    return (
      <AnimatePresence mode="wait">
        {/* Checking state */}
        {checking && (
          <motion.div
            key="checking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-6"
          >
            <Loader2 className="w-10 h-10 text-brand-500 animate-spin mx-auto mb-3" />
            <p className="text-dark-300">Detecting system environment...</p>
          </motion.div>
        )}

        {/* Installation step */}
        {!checking && step === 'install' && envStatus && (
          <motion.div
            key="install"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* System info (non-embedded mode only) */}
            {!embedded && (
              <div className="flex items-center justify-between text-sm text-dark-400 pb-4 border-b border-dark-700">
                <span>Operating System</span>
                <span className="text-dark-200">{getOsName(envStatus.os)}</span>
              </div>
            )}

            {/* Node.js status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${envStatus.node_installed && envStatus.node_version_ok
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                  }`}>
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white font-medium">Node.js</p>
                  <p className="text-sm text-dark-400">
                    {envStatus.node_version
                      ? `${envStatus.node_version} ${envStatus.node_version_ok ? '✓' : '(requires v22+)'}`
                      : 'Not installed'}
                  </p>
                </div>
              </div>

              {envStatus.node_installed && envStatus.node_version_ok ? (
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              ) : (
                <button
                  onClick={handleInstallNodejs}
                  disabled={installing !== null}
                  className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
                >
                  {installing === 'nodejs' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Install
                    </>
                  )}
                </button>
              )}
            </div>

            {/* OpenClaw status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${envStatus.openclaw_installed
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                  }`}>
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-white font-medium">OpenClaw</p>
                  <p className="text-sm text-dark-400">
                    {envStatus.openclaw_version || 'Not installed'}
                  </p>
                </div>
              </div>

              {envStatus.openclaw_installed ? (
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              ) : (
                <button
                  onClick={handleInstallOpenclaw}
                  disabled={installing !== null || !envStatus.node_version_ok}
                  className={`btn-primary text-sm px-4 py-2 flex items-center gap-2 ${!envStatus.node_version_ok ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  title={!envStatus.node_version_ok ? 'Please install Node.js first' : ''}
                >
                  {installing === 'openclaw' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Install
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
              >
                <p className="text-yellow-400 text-sm">{error}</p>
              </motion.div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-4 border-t border-dark-700/50">
              <button
                onClick={checkEnvironment}
                disabled={checking || installing !== null}
                className="flex-1 btn-secondary py-2.5 flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                Re-check
              </button>

              {envStatus.ready && (
                <button
                  onClick={onComplete}
                  className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Help link */}
            <div className="text-center pt-1">
              <a
                href="https://nodejs.org/en/download"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-dark-400 hover:text-brand-400 transition-colors inline-flex items-center gap-1"
              >
                Manually download Node.js
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </motion.div>
        )}

        {/* Complete state */}
        {!checking && step === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 10, delay: 0.1 }}
            >
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
            </motion.div>
            <h3 className="text-lg font-bold text-white mb-1">Environment Ready!</h3>
            <p className="text-dark-400 text-sm">
              Node.js and OpenClaw are properly installed
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  // Embedded mode: display as a card in Dashboard
  if (embedded) {
    return (
      <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-2xl p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Environment Setup</h2>
            <p className="text-dark-400 text-sm">Missing dependencies detected, please complete the following installations</p>
          </div>
        </div>

        {renderContent()}
      </div>
    );
  }

  // Fullscreen mode (kept for special cases)
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-8">
      {/* Background decoration */}
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-lg"
      >
        {/* Logo and title */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 mb-4 shadow-lg shadow-brand-500/25"
          >
            <span className="text-4xl">🦞</span>
          </motion.div>
          <h1 className="text-2xl font-bold text-white mb-2">OpenClaw Manager</h1>
          <p className="text-dark-400">Environment Detection & Setup Wizard</p>
        </div>

        {/* Main card */}
        <motion.div
          layout
          className="glass-card rounded-2xl p-6 shadow-xl"
        >
          {renderContent()}
        </motion.div>

        {/* Version info */}
        <p className="text-center text-dark-500 text-xs mt-6">
          OpenClaw Manager v0.0.5
        </p>
      </motion.div>
    </div>
  );
}
