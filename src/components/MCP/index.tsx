import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, MCPConfig, isTauri } from '../../lib/tauri';
import { Plus, Trash2, Edit2, Save, Terminal, Blocks, AlertCircle, GitBranch, Loader2, Download, CheckCircle, Package, Plug, Globe, Zap } from 'lucide-react';
import clsx from 'clsx';

export function MCP() {
    const [configs, setConfigs] = useState<Record<string, MCPConfig>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({});
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isNew, setIsNew] = useState(false);

    // Install state
    const [showInstallDialog, setShowInstallDialog] = useState(false);
    const [gitUrl, setGitUrl] = useState('');
    const [installing, setInstalling] = useState(false);
    const [installProgress, setInstallProgress] = useState('');
    const [installMode, setInstallMode] = useState<'plugin' | 'source'>('source');

    // mcporter state
    const [mcporterInstalled, setMcporterInstalled] = useState<boolean | null>(null);
    const [installingMcporter, setInstallingMcporter] = useState(false);

    // Form state
    const [formData, setFormData] = useState<{
        name: string;
        serverType: 'local' | 'remote';
        command: string;
        args: string;
        env: string;
        url: string;
        enabled: boolean;
    }>({
        name: '',
        serverType: 'local',
        command: '',
        args: '',
        env: '',
        url: '',
        enabled: true,
    });

    const fetchConfigs = async () => {
        if (!isTauri()) {
            setLoading(false);
            return;
        }
        try {
            const result = await api.getMCPConfig();
            setConfigs(result);
            setError(null);
        } catch (e) {
            setError('Failed to load MCP configuration');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const checkMcporter = async () => {
        if (!isTauri()) return;
        try {
            const installed = await api.checkMcporterInstalled();
            setMcporterInstalled(installed);
        } catch (e) {
            console.error('Failed to check mcporter:', e);
        }
    };

    const handleInstallMcporter = async () => {
        setInstallingMcporter(true);
        setError(null);
        try {
            await api.installMcporter();
            setMcporterInstalled(true);
            setSuccess('mcporter installed successfully!');
        } catch (e) {
            setError(`Failed to install mcporter: ${e}`);
        } finally {
            setInstallingMcporter(false);
        }
    };

    useEffect(() => {
        fetchConfigs();
        checkMcporter();
    }, []);

    // Auto-clear success messages
    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    const handleEdit = (id: string) => {
        const config = configs[id];
        const isRemote = !!config.url;
        setEditingId(id);
        setIsNew(false);
        setFormData({
            name: id,
            serverType: isRemote ? 'remote' : 'local',
            command: config.command || '',
            args: (config.args || []).join(' '),
            env: Object.entries(config.env || {}).map(([k, v]) => `${k}=${v}`).join('\n'),
            url: config.url || '',
            enabled: config.enabled,
        });
    };

    const handleAddNew = () => {
        setEditingId('new_mcp');
        setIsNew(true);
        setFormData({
            name: '',
            serverType: 'local',
            command: '',
            args: '',
            env: '',
            url: '',
            enabled: true,
        });
    };

    const handleCancel = () => {
        setEditingId(null);
        setIsNew(false);
        setError(null);
    };

    const handleTest = async (id: string) => {
        const config = configs[id];
        setTestingId(id);
        setTestResult(prev => {
            const copy = { ...prev };
            delete copy[id];
            return copy;
        });
        try {
            if (config.url) {
                // Remote URL test
                const result = await api.testMCPServer('url', config.url);
                setTestResult(prev => ({ ...prev, [id]: { ok: true, msg: result } }));
            } else {
                // Local stdio test — pass command and args separately to preserve paths
                const result = await api.testMCPServer('stdio', id, config.command || '', config.args || []);
                setTestResult(prev => ({ ...prev, [id]: { ok: true, msg: result } }));
            }
        } catch (e) {
            setTestResult(prev => ({ ...prev, [id]: { ok: false, msg: String(e) } }));
        } finally {
            setTestingId(null);
        }
    };

    const handleUninstall = async (id: string) => {
        if (!confirm(`Uninstall MCP "${id}"? This will remove the cloned files and configuration.`)) return;
        try {
            await api.uninstallMCP(id);
            setSuccess(`Successfully uninstalled ${id}`);
            await fetchConfigs();
        } catch (e) {
            setError(`Failed to uninstall MCP: ${e}`);
        }
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            setError('Name is required');
            return;
        }
        if (formData.serverType === 'local' && !formData.command.trim()) {
            setError('Command is required for local servers');
            return;
        }
        if (formData.serverType === 'remote' && !formData.url.trim()) {
            setError('URL is required for remote servers');
            return;
        }

        try {
            let config: MCPConfig;

            if (formData.serverType === 'remote') {
                config = {
                    url: formData.url.trim(),
                    enabled: formData.enabled,
                };
            } else {
                const env: Record<string, string> = {};
                formData.env.split('\n').forEach(line => {
                    const parts = line.split('=');
                    if (parts.length >= 2) {
                        const key = parts[0].trim();
                        const value = parts.slice(1).join('=').trim();
                        if (key) env[key] = value;
                    }
                });

                const args = formData.args.trim()
                    ? formData.args.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(s => s.replace(/^"|"$/g, '')) || []
                    : [];

                config = {
                    command: formData.command,
                    args,
                    env,
                    enabled: formData.enabled,
                };
            }

            await api.saveMCPConfig(formData.name, config);
            setEditingId(null);
            setIsNew(false);
            setError(null);
            setSuccess(`Saved configuration for ${formData.name}`);
            await fetchConfigs();
        } catch (e) {
            setError(`Failed to save: ${e}`);
        }
    };

    const handleInstall = async () => {
        if (!gitUrl.trim()) {
            setError('Please enter a GitHub repository URL');
            return;
        }

        setInstalling(true);
        setError(null);

        try {
            let result: string;
            if (installMode === 'plugin') {
                setInstallProgress('Installing via OpenClaw plugins system...');
                result = await api.installMCPPlugin(gitUrl.trim());
            } else {
                setInstallProgress('Cloning repository and building from source...');
                result = await api.installMCPFromGit(gitUrl.trim());
            }
            setSuccess(result);
            setShowInstallDialog(false);
            setGitUrl('');
            setInstallProgress('');
            await fetchConfigs();
        } catch (e) {
            setError(`Installation failed: ${e}`);
            setInstallProgress('');
        } finally {
            setInstalling(false);
        }
    };

    const handleUninstallMcporter = async () => {
        if (!confirm('Are you sure you want to uninstall mcporter? This will remove the global npm package.')) return;
        setInstallingMcporter(true);
        setError(null);
        try {
            await api.uninstallMcporter();
            setMcporterInstalled(false);
            setSuccess('mcporter uninstalled successfully');
        } catch (e) {
            setError(`Failed to uninstall mcporter: ${e}`);
        } finally {
            setInstallingMcporter(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 },
    };

    return (
        <div className="h-full overflow-y-auto scroll-container pr-2">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Model Context Protocol</h2>
                    <p className="text-gray-400">Manage MCP servers to extend Agent capabilities</p>
                </div>
                {!editingId && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowInstallDialog(true)}
                            disabled={loading || installing}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                        >
                            <GitBranch size={18} />
                            <span>Install from Git</span>
                        </button>
                        <button
                            onClick={handleAddNew}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-claw-500 hover:bg-claw-600 text-white rounded-lg transition-colors"
                        >
                            <Plus size={18} />
                            <span>Add Manual</span>
                        </button>
                    </div>
                )}
            </div>



            {/* mcporter status banner */}
            {mcporterInstalled !== null && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={clsx(
                        'rounded-xl p-4 mb-6 flex items-center justify-between',
                        mcporterInstalled
                            ? 'bg-green-500/5 border border-green-500/20'
                            : 'bg-amber-500/10 border border-amber-500/30'
                    )}
                >
                    <div className="flex items-center gap-3">
                        <div className={clsx(
                            'w-9 h-9 rounded-lg flex items-center justify-center',
                            mcporterInstalled ? 'bg-green-500/20' : 'bg-amber-500/20'
                        )}>
                            <Package size={18} className={mcporterInstalled ? 'text-green-400' : 'text-amber-400'} />
                        </div>
                        <div>
                            <p className={clsx(
                                'text-sm font-medium',
                                mcporterInstalled ? 'text-green-200' : 'text-amber-200'
                            )}>
                                {mcporterInstalled ? 'mcporter is installed' : 'mcporter is required for MCP support'}
                            </p>
                            <p className="text-xs text-gray-500">
                                {mcporterInstalled
                                    ? 'OpenClaw can use MCP servers via the mcporter skill'
                                    : 'Install mcporter to enable MCP server integration with OpenClaw agents'}
                            </p>
                        </div>
                    </div>
                    {mcporterInstalled ? (
                        <button
                            onClick={handleUninstallMcporter}
                            disabled={installingMcporter}
                            className="p-2 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                            title="Uninstall mcporter"
                        >
                            {installingMcporter ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Trash2 size={16} />
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={handleInstallMcporter}
                            disabled={installingMcporter}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors text-sm disabled:opacity-50"
                        >
                            {installingMcporter ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Installing...</span>
                                </>
                            ) : (
                                <>
                                    <Download size={16} />
                                    <span>Install mcporter</span>
                                </>
                            )}
                        </button>
                    )}
                </motion.div>
            )}

            {/* Success message */}
            <AnimatePresence>
                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-green-500/10 border border-green-500/50 rounded-xl p-4 mb-6 flex items-center gap-3"
                    >
                        <CheckCircle className="text-green-400 flex-shrink-0" size={20} />
                        <p className="text-green-200 text-sm">{success}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error message */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 mb-6 flex items-center gap-3"
                >
                    <AlertCircle className="text-red-400 flex-shrink-0" size={20} />
                    <p className="text-red-200 text-sm">{error}</p>
                </motion.div>
            )}

            {/* Install from Git Dialog */}
            <AnimatePresence>
                {showInstallDialog && (
                    <motion.div
                        key="install-dialog"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-dark-700 rounded-2xl border border-purple-500/30 p-6 mb-6"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                <Download size={20} className="text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Install MCP Server</h3>
                                <p className="text-sm text-gray-400">Install from a GitHub repository URL</p>
                            </div>
                        </div>

                        {/* Mode toggle */}
                        <div className="flex items-center gap-1 bg-dark-800 rounded-lg p-1 mb-4">
                            <button
                                onClick={() => setInstallMode('plugin')}
                                disabled={installing}
                                className={clsx(
                                    'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm transition-all',
                                    installMode === 'plugin'
                                        ? 'bg-purple-600 text-white'
                                        : 'text-gray-400 hover:text-white'
                                )}
                            >
                                <Plug size={15} />
                                <span>As Plugin</span>
                            </button>
                            <button
                                onClick={() => setInstallMode('source')}
                                disabled={installing}
                                className={clsx(
                                    'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm transition-all',
                                    installMode === 'source'
                                        ? 'bg-dark-600 text-white'
                                        : 'text-gray-400 hover:text-white'
                                )}
                            >
                                <GitBranch size={15} />
                                <span>From Source</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-dark-500 text-gray-200">Recommended</span>
                            </button>
                        </div>

                        <p className="text-xs text-gray-500 mb-4">
                            {installMode === 'plugin'
                                ? 'Uses OpenClaw\'s native plugin system. Only works for packages with openclaw.extensions in package.json.'
                                : 'Clones the repository, runs npm install & build. Works with any MCP server from GitHub.'}
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Repository URL</label>
                                <div className="relative">
                                    <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                    <input
                                        type="text"
                                        value={gitUrl}
                                        onChange={(e) => setGitUrl(e.target.value)}
                                        placeholder="https://github.com/owner/mcp-server-name"
                                        disabled={installing}
                                        className="w-full bg-dark-800 border border-dark-600 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none font-mono text-sm disabled:opacity-50"
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !installing) handleInstall(); }}
                                    />
                                </div>
                            </div>

                            {installing && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="bg-dark-800 rounded-xl p-4 border border-dark-600"
                                >
                                    <div className="flex items-center gap-3">
                                        <Loader2 size={20} className="text-purple-400 animate-spin" />
                                        <div>
                                            <p className="text-sm text-white font-medium">Installing...</p>
                                            <p className="text-xs text-gray-400">{installProgress}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 h-1 bg-dark-600 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-gradient-to-r from-purple-500 to-claw-500 rounded-full"
                                            initial={{ width: '0%' }}
                                            animate={{ width: '90%' }}
                                            transition={{ duration: 30, ease: 'linear' }}
                                        />
                                    </div>
                                </motion.div>
                            )}

                            <div className="flex items-center justify-end gap-2">
                                <button
                                    onClick={() => { setShowInstallDialog(false); setGitUrl(''); setInstallProgress(''); }}
                                    disabled={installing}
                                    className="px-4 py-2 text-gray-400 hover:text-white hover:bg-dark-600 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleInstall}
                                    disabled={installing || !gitUrl.trim()}
                                    className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {installing ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            <span>Installing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download size={18} />
                                            <span>{installMode === 'plugin' ? 'Install as Plugin' : 'Install from Source'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
                {editingId ? (
                    <motion.div
                        key="editor"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-dark-700 rounded-2xl border border-dark-500 p-6"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-white">
                                {isNew ? 'Add New MCP Server' : `Edit ${formData.name}`}
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCancel}
                                    className="px-4 py-2 text-gray-400 hover:text-white hover:bg-dark-600 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex items-center gap-2 px-4 py-2 bg-claw-500 hover:bg-claw-600 text-white rounded-lg transition-colors"
                                >
                                    <Save size={18} />
                                    <span>Save</span>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Server Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        disabled={!isNew}
                                        placeholder="e.g. filesystem-server"
                                        className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-claw-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">Unique identifier for this server</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
                                    <div className="flex items-center gap-3 py-2.5">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.enabled}
                                                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                                                className="w-5 h-5 rounded border-dark-500 bg-dark-600 text-claw-500 focus:ring-offset-dark-700"
                                            />
                                            <span className="text-white">Enabled</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Server Type Toggle */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Server Type</label>
                                <div className="flex items-center gap-1 bg-dark-800 rounded-lg p-1">
                                    <button
                                        onClick={() => setFormData({ ...formData, serverType: 'local' })}
                                        className={clsx(
                                            'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm transition-all',
                                            formData.serverType === 'local'
                                                ? 'bg-claw-600 text-white'
                                                : 'text-gray-400 hover:text-white'
                                        )}
                                    >
                                        <Terminal size={15} />
                                        <span>Local (stdio)</span>
                                    </button>
                                    <button
                                        onClick={() => setFormData({ ...formData, serverType: 'remote' })}
                                        className={clsx(
                                            'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm transition-all',
                                            formData.serverType === 'remote'
                                                ? 'bg-blue-600 text-white'
                                                : 'text-gray-400 hover:text-white'
                                        )}
                                    >
                                        <Globe size={15} />
                                        <span>Remote (URL)</span>
                                    </button>
                                </div>
                            </div>

                            {formData.serverType === 'remote' ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Server URL</label>
                                    <div className="relative">
                                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                        <input
                                            type="text"
                                            value={formData.url}
                                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                            placeholder="https://mcp.example.com/mcp"
                                            className="w-full bg-dark-800 border border-dark-600 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-sm"
                                        />
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">HTTP/HTTPS endpoint for the remote MCP server</p>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Command</label>
                                        <div className="relative">
                                            <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                            <input
                                                type="text"
                                                value={formData.command}
                                                onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                                                placeholder="e.g. node, python, or absolute path to executable"
                                                className="w-full bg-dark-800 border border-dark-600 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-claw-500 focus:border-transparent outline-none font-mono text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Arguments</label>
                                        <input
                                            type="text"
                                            value={formData.args}
                                            onChange={(e) => setFormData({ ...formData, args: e.target.value })}
                                            placeholder="e.g. index.js --port 3000 (space separated)"
                                            className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-claw-500 focus:border-transparent outline-none font-mono text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Environment Variables</label>
                                        <textarea
                                            value={formData.env}
                                            onChange={(e) => setFormData({ ...formData, env: e.target.value })}
                                            placeholder={'KEY=VALUE\nAPI_TOKEN=xyz'}
                                            rows={5}
                                            className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-claw-500 focus:border-transparent outline-none font-mono text-sm resize-none"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="list"
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                        {Object.entries(configs).length === 0 ? (
                            <motion.div variants={itemVariants} className="col-span-full py-12 text-center text-gray-500">
                                <Blocks size={48} className="mx-auto mb-4 opacity-20" />
                                <p className="text-lg font-medium mb-1">No MCP Servers Configured</p>
                                <p className="text-sm mb-6">Add a server manually or install from GitHub</p>
                                <button
                                    onClick={() => setShowInstallDialog(true)}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                                >
                                    <GitBranch size={18} />
                                    <span>Install from GitHub</span>
                                </button>
                            </motion.div>
                        ) : (
                            Object.entries(configs).map(([id, config]) => (
                                <motion.div
                                    key={id}
                                    variants={itemVariants}
                                    className="bg-dark-700/50 hover:bg-dark-700 border border-dark-600 hover:border-dark-500 rounded-xl p-5 transition-all group"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={clsx(
                                                "w-10 h-10 rounded-lg flex items-center justify-center",
                                                config.enabled ? "bg-claw-500/20 text-claw-400" : "bg-dark-600 text-gray-500"
                                            )}>
                                                <Blocks size={20} />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-white">{id}</h3>
                                                <div className="flex items-center gap-2">
                                                    <span className={clsx(
                                                        "w-2 h-2 rounded-full",
                                                        config.enabled ? "bg-green-500" : "bg-gray-500"
                                                    )} />
                                                    <span className="text-xs text-gray-500">
                                                        {config.enabled ? 'Enabled' : 'Disabled'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleTest(id)}
                                                disabled={testingId === id}
                                                className={clsx(
                                                    "p-2 rounded-lg transition-colors",
                                                    testingId === id
                                                        ? "bg-yellow-500/20 text-yellow-400"
                                                        : "hover:bg-emerald-500/20 text-gray-400 hover:text-emerald-400"
                                                )}
                                                title="Test server"
                                            >
                                                {testingId === id ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                            </button>
                                            <button
                                                onClick={() => handleEdit(id)}
                                                className="p-2 hover:bg-dark-600 text-gray-400 hover:text-white rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleUninstall(id)}
                                                className="p-2 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                                                title="Uninstall"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="bg-dark-800/50 rounded-lg px-3 py-2 border border-dark-600/50 font-mono text-xs text-gray-400 truncate">
                                            {config.url ? (
                                                <><Globe size={12} className="inline mr-1.5 text-blue-400" />{config.url}</>
                                            ) : (
                                                <><span className="text-claw-500">$</span> {config.command} {(config.args || []).join(' ')}</>
                                            )}
                                        </div>
                                        {Object.keys(config.env || {}).length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {Object.keys(config.env || {}).slice(0, 3).map(key => (
                                                    <span key={key} className="px-2 py-0.5 rounded text-[10px] bg-dark-600 text-gray-400 border border-dark-500">
                                                        {key}
                                                    </span>
                                                ))}
                                                {Object.keys(config.env || {}).length > 3 && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] bg-dark-600 text-gray-500 border border-dark-500">
                                                        +{Object.keys(config.env || {}).length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {testResult[id] && (
                                        <div className={clsx(
                                            "mt-2 rounded-lg px-3 py-2 text-xs font-mono border",
                                            testResult[id].ok
                                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                                : "bg-red-500/10 border-red-500/30 text-red-400"
                                        )}>
                                            <pre className="whitespace-pre-wrap">{testResult[id].msg}</pre>
                                        </div>
                                    )}
                                </motion.div>
                            ))
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
