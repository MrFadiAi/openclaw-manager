import { useState } from 'react';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import {
  CheckCircle,
  XCircle,
  Play,
  Loader2,
  Stethoscope,
} from 'lucide-react';
import clsx from 'clsx';
import { testingLogger } from '../../lib/logger';

interface DiagnosticResult {
  name: string;
  passed: boolean;
  message: string;
  suggestion: string | null;
}

export function Testing() {
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    testingLogger.action('Run system diagnostics');
    testingLogger.info('Starting system diagnostics...');
    setLoading(true);
    setDiagnosticResults([]);
    try {
      const results = await invoke<DiagnosticResult[]>('run_doctor');
      testingLogger.info(`Diagnostics completed, ${results.length} checks total`);
      const passed = results.filter(r => r.passed).length;
      testingLogger.state('Diagnostic results', { total: results.length, passed, failed: results.length - passed });
      setDiagnosticResults(results);
    } catch (e) {
      testingLogger.error('Diagnostics execution failed', e);
      setDiagnosticResults([{
        name: 'Diagnostics Execution',
        passed: false,
        message: String(e),
        suggestion: 'Please check if OpenClaw is properly installed',
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Count results
  const passedCount = diagnosticResults.filter(r => r.passed).length;
  const failedCount = diagnosticResults.filter(r => !r.passed).length;

  return (
    <div className="h-full overflow-y-auto scroll-container pr-2">
      <div className="max-w-4xl space-y-6">
        {/* Diagnostic test */}
        <div className="bg-dark-700 rounded-2xl p-6 border border-dark-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Stethoscope size={20} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">System Diagnostics</h3>
                <p className="text-xs text-gray-500">
                  Check OpenClaw installation and configuration status
                </p>
              </div>
            </div>
            <button
              onClick={runDiagnostics}
              disabled={loading}
              className="btn-primary flex items-center gap-2"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} />
              )}
              Run Diagnostics
            </button>
          </div>

          {/* Diagnostic results summary */}
          {diagnosticResults.length > 0 && (
            <div className="flex gap-4 mb-4 p-3 bg-dark-600 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-400" />
                <span className="text-sm text-green-400">{passedCount} passed</span>
              </div>
              {failedCount > 0 && (
                <div className="flex items-center gap-2">
                  <XCircle size={16} className="text-red-400" />
                  <span className="text-sm text-red-400">{failedCount} failed</span>
                </div>
              )}
            </div>
          )}

          {/* Diagnostic results list */}
          {diagnosticResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              {diagnosticResults.map((result, index) => (
                <div
                  key={index}
                  className={clsx(
                    'flex items-start gap-3 p-3 rounded-lg',
                    result.passed ? 'bg-green-500/10' : 'bg-red-500/10'
                  )}
                >
                  {result.passed ? (
                    <CheckCircle size={18} className="text-green-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={clsx(
                        'text-sm font-medium',
                        result.passed ? 'text-green-400' : 'text-red-400'
                      )}
                    >
                      {result.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap break-words">{result.message}</p>
                    {result.suggestion && (
                      <p className="text-xs text-amber-400 mt-1">
                        💡 {result.suggestion}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Empty state */}
          {diagnosticResults.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              <Stethoscope size={48} className="mx-auto mb-3 opacity-30" />
              <p>Click "Run Diagnostics" button to start checking system status</p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-500">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Diagnostic Instructions</h4>
          <ul className="text-sm text-gray-500 space-y-1">
            <li>• System diagnostics checks Node.js, OpenClaw installation, config files and other status</li>
            <li>• For AI connection testing, go to <span className="text-claw-400">AI Configuration</span> page</li>
            <li>• For channel testing, go to <span className="text-claw-400">Message Channels</span> page</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
