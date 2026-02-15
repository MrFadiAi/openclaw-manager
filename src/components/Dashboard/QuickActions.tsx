import { Play, Square, RotateCcw, Stethoscope, Skull } from 'lucide-react';
import clsx from 'clsx';

interface ServiceStatus {
  running: boolean;
  pid: number | null;
  port: number;
}

interface QuickActionsProps {
  status: ServiceStatus | null;
  loading: boolean;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onKillAll: () => void;
}

export function QuickActions({
  status,
  loading,
  onStart,
  onStop,
  onRestart,
  onKillAll,
}: QuickActionsProps) {
  const isRunning = status?.running || false;

  return (
    <div className="bg-dark-700 rounded-2xl p-6 border border-dark-500">
      <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Start button */}
        <button
          onClick={onStart}
          disabled={loading || isRunning}
          className={clsx(
            'flex flex-col items-center gap-3 p-4 rounded-xl transition-all',
            'border border-dark-500',
            isRunning
              ? 'bg-dark-600 opacity-50 cursor-not-allowed'
              : 'bg-dark-600 hover:bg-green-500/20 hover:border-green-500/50'
          )}
        >
          <div
            className={clsx(
              'w-12 h-12 rounded-full flex items-center justify-center',
              isRunning ? 'bg-dark-500' : 'bg-green-500/20'
            )}
          >
            <Play
              size={20}
              className={isRunning ? 'text-gray-500' : 'text-green-400'}
            />
          </div>
          <span
            className={clsx(
              'text-sm font-medium',
              isRunning ? 'text-gray-500' : 'text-gray-300'
            )}
          >
            Start
          </span>
        </button>

        {/* Stop button */}
        <button
          onClick={onStop}
          disabled={loading || !isRunning}
          className={clsx(
            'flex flex-col items-center gap-3 p-4 rounded-xl transition-all',
            'border border-dark-500',
            !isRunning
              ? 'bg-dark-600 opacity-50 cursor-not-allowed'
              : 'bg-dark-600 hover:bg-red-500/20 hover:border-red-500/50'
          )}
        >
          <div
            className={clsx(
              'w-12 h-12 rounded-full flex items-center justify-center',
              !isRunning ? 'bg-dark-500' : 'bg-red-500/20'
            )}
          >
            <Square
              size={20}
              className={!isRunning ? 'text-gray-500' : 'text-red-400'}
            />
          </div>
          <span
            className={clsx(
              'text-sm font-medium',
              !isRunning ? 'text-gray-500' : 'text-gray-300'
            )}
          >
            Stop
          </span>
        </button>

        {/* Restart button */}
        <button
          onClick={onRestart}
          disabled={loading}
          className={clsx(
            'flex flex-col items-center gap-3 p-4 rounded-xl transition-all',
            'border border-dark-500',
            'bg-dark-600 hover:bg-amber-500/20 hover:border-amber-500/50'
          )}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-amber-500/20">
            <RotateCcw
              size={20}
              className={clsx('text-amber-400', loading && 'animate-spin')}
            />
          </div>
          <span className="text-sm font-medium text-gray-300">Restart</span>
        </button>

        {/* Kill All button */}
        <button
          onClick={onKillAll}
          disabled={loading}
          className={clsx(
            'flex flex-col items-center gap-3 p-4 rounded-xl transition-all',
            'border border-dark-500',
            'bg-dark-600 hover:bg-rose-500/20 hover:border-rose-500/50'
          )}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-rose-500/20">
            <Skull size={20} className="text-rose-400" />
          </div>
          <span className="text-sm font-medium text-gray-300">Kill All</span>
        </button>

        {/* Diagnostics button */}
        <button
          disabled={loading}
          className={clsx(
            'flex flex-col items-center gap-3 p-4 rounded-xl transition-all',
            'border border-dark-500',
            'bg-dark-600 hover:bg-purple-500/20 hover:border-purple-500/50'
          )}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-purple-500/20">
            <Stethoscope size={20} className="text-purple-400" />
          </div>
          <span className="text-sm font-medium text-gray-300">Diagnostics</span>
        </button>
      </div>
    </div>
  );
}
