import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  User,
  Shield,
  Save,
  Loader2,
  FolderOpen,
  FileCode,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react';

interface InstallResult {
  success: boolean;
  message: string;
  error?: string;
}

interface SettingsProps {
  onEnvironmentChange?: () => void;
}

export function Settings({ onEnvironmentChange }: SettingsProps) {
  const [identity, setIdentity] = useState({
    botName: 'Clawd',
    userName: 'Master',
    timezone: 'Asia/Shanghai',
  });
  const [saving, setSaving] = useState(false);
  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const [uninstallResult, setUninstallResult] = useState<InstallResult | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: Save identity configuration
      await new Promise((resolve) => setTimeout(resolve, 500));
      alert('Settings saved!');
    } catch (e) {
      console.error('Failed to save:', e);
    } finally {
      setSaving(false);
    }
  };

  const openConfigDir = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      const home = await invoke<{ config_dir: string }>('get_system_info');
      // Try to open the config directory
      await open(home.config_dir);
    } catch (e) {
      console.error('Failed to open directory:', e);
    }
  };

  const handleUninstall = async () => {
    setUninstalling(true);
    setUninstallResult(null);
    try {
      const result = await invoke<InstallResult>('uninstall_openclaw');
      setUninstallResult(result);
      if (result.success) {
        // Notify environment status change to trigger re-check
        onEnvironmentChange?.();
        // Close confirmation dialog after successful uninstall
        setTimeout(() => {
          setShowUninstallConfirm(false);
        }, 2000);
      }
    } catch (e) {
      setUninstallResult({
        success: false,
        message: 'An error occurred during uninstallation',
        error: String(e),
      });
    } finally {
      setUninstalling(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto scroll-container pr-2">
      <div className="max-w-2xl space-y-6">
        {/* Identity Configuration */}
        <div className="bg-dark-700 rounded-2xl p-6 border border-dark-500">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-claw-500/20 flex items-center justify-center">
              <User size={20} className="text-claw-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Identity Configuration</h3>
              <p className="text-xs text-gray-500">Set the AI assistant's name and how it addresses you</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                AI Assistant Name
              </label>
              <input
                type="text"
                value={identity.botName}
                onChange={(e) =>
                  setIdentity({ ...identity, botName: e.target.value })
                }
                placeholder="Clawd"
                className="input-base"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={identity.userName}
                onChange={(e) =>
                  setIdentity({ ...identity, userName: e.target.value })
                }
                placeholder="Master"
                className="input-base"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Timezone</label>
              <select
                value={identity.timezone}
                onChange={(e) =>
                  setIdentity({ ...identity, timezone: e.target.value })
                }
                className="input-base"
              >
                <option value="Asia/Shanghai">Asia/Shanghai (Beijing Time)</option>
                <option value="Asia/Hong_Kong">Asia/Hong_Kong (Hong Kong Time)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (Tokyo Time)</option>
                <option value="America/New_York">
                  America/New_York (New York Time)
                </option>
                <option value="America/Los_Angeles">
                  America/Los_Angeles (Los Angeles Time)
                </option>
                <option value="Europe/London">Europe/London (London Time)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-dark-700 rounded-2xl p-6 border border-dark-500">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Shield size={20} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Security Settings</h3>
              <p className="text-xs text-gray-500">Permissions and access control</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-dark-600 rounded-lg">
              <div>
                <p className="text-sm text-white">Enable Whitelist</p>
                <p className="text-xs text-gray-500">Only allow whitelisted users to access</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-dark-500 peer-focus:ring-2 peer-focus:ring-claw-500/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-claw-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-dark-600 rounded-lg">
              <div>
                <p className="text-sm text-white">File Access Permission</p>
                <p className="text-xs text-gray-500">Allow AI to read and write local files</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-dark-500 peer-focus:ring-2 peer-focus:ring-claw-500/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-claw-500"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="bg-dark-700 rounded-2xl p-6 border border-dark-500">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <FileCode size={20} className="text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Advanced Settings</h3>
              <p className="text-xs text-gray-500">Configuration files and directories</p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={openConfigDir}
              className="w-full flex items-center gap-3 p-4 bg-dark-600 rounded-lg hover:bg-dark-500 transition-colors text-left"
            >
              <FolderOpen size={18} className="text-gray-400" />
              <div className="flex-1">
                <p className="text-sm text-white">Open Configuration Directory</p>
                <p className="text-xs text-gray-500">~/.openclaw</p>
              </div>
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-dark-700 rounded-2xl p-6 border border-red-900/30">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Danger Zone</h3>
              <p className="text-xs text-gray-500">The following actions are irreversible, please proceed with caution</p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setShowUninstallConfirm(true)}
              className="w-full flex items-center gap-3 p-4 bg-red-950/30 rounded-lg hover:bg-red-900/40 transition-colors text-left border border-red-900/30"
            >
              <Trash2 size={18} className="text-red-400" />
              <div className="flex-1">
                <p className="text-sm text-red-300">Uninstall OpenClaw</p>
                <p className="text-xs text-red-400/70">Remove OpenClaw CLI tool from the system</p>
              </div>
            </button>
          </div>
        </div>

        {/* Uninstall Confirmation Dialog */}
        {showUninstallConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-dark-700 rounded-2xl p-6 border border-dark-500 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                    <AlertTriangle size={20} className="text-red-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Confirm Uninstall</h3>
                </div>
                <button
                  onClick={() => {
                    setShowUninstallConfirm(false);
                    setUninstallResult(null);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {!uninstallResult ? (
                <>
                  <p className="text-gray-300 mb-4">
                    Are you sure you want to uninstall OpenClaw? This action will:
                  </p>
                  <ul className="text-sm text-gray-400 mb-6 space-y-2">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                      Stop any running services
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                      Remove the OpenClaw CLI tool
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></span>
                      Configuration files will be preserved in ~/.openclaw
                    </li>
                  </ul>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowUninstallConfirm(false)}
                      className="flex-1 px-4 py-2.5 bg-dark-600 hover:bg-dark-500 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUninstall}
                      disabled={uninstalling}
                      className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {uninstalling ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Uninstalling...
                        </>
                      ) : (
                        <>
                          <Trash2 size={16} />
                          Confirm Uninstall
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className={`p-4 rounded-lg ${uninstallResult.success ? 'bg-green-900/30 border border-green-800' : 'bg-red-900/30 border border-red-800'}`}>
                  <p className={`text-sm ${uninstallResult.success ? 'text-green-300' : 'text-red-300'}`}>
                    {uninstallResult.message}
                  </p>
                  {uninstallResult.error && (
                    <p className="text-xs text-red-400 mt-2 font-mono">
                      {uninstallResult.error}
                    </p>
                  )}
                  {uninstallResult.success && (
                    <p className="text-xs text-gray-400 mt-3">
                      Dialog will close automatically...
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
