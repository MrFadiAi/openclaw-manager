import { useState, useEffect } from 'react';
import { api, Skill, isTauri } from '../../lib/tauri';
import { Book, Package, AlertCircle, Loader2, Download, Terminal, CheckCircle, Plus, Trash2 } from 'lucide-react';

export function Skills() {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Clawhub state
    const [clawhubInstalled, setClawhubInstalled] = useState<boolean | null>(null);
    const [installingClawhub, setInstallingClawhub] = useState(false);
    const [uninstallingClawhub, setUninstallingClawhub] = useState(false);

    // Uninstall state
    const [showUninstallConfirm, setShowUninstallConfirm] = useState<string | null>(null);
    const [uninstallingSkill, setUninstallingSkill] = useState(false);

    // Skill install state
    const [showInstallDialog, setShowInstallDialog] = useState(false);
    const [skillName, setSkillName] = useState('');
    const [installingSkill, setInstallingSkill] = useState(false);
    const [installResult, setInstallResult] = useState<{ success: boolean; message: string } | null>(null);

    const fetchSkills = async () => {
        if (!isTauri()) return;
        try {
            const result = await api.getSkills();
            if (Array.isArray(result)) {
                setSkills(result);
            } else {
                setSkills([]);
            }
        } catch (e) {
            setError('Failed to load skills: ' + String(e));
        }
    };

    const checkClawhub = async () => {
        if (!isTauri()) return;
        try {
            const installed = await api.checkClawhubInstalled();
            setClawhubInstalled(installed);
        } catch (e) {
            console.error('Failed to check clawhub:', e);
            // Assume false on error to allow retry
            setClawhubInstalled(false);
        }
    };

    const init = async () => {
        setLoading(true);
        await Promise.all([fetchSkills(), checkClawhub()]);
        setLoading(false);
    };

    useEffect(() => {
        init();
    }, []);

    const handleInstallClawhub = async () => {
        setInstallingClawhub(true);
        setError(null);
        try {
            await api.installClawhub();
            await checkClawhub();
            setInstallResult({ success: true, message: 'Clawhub installed successfully' });
        } catch (e) {
            setError('Failed to install clawhub: ' + String(e));
        } finally {
            setInstallingClawhub(false);
        }
    };

    const handleInstallSkill = async () => {
        if (!skillName.trim()) return;
        setInstallingSkill(true);
        setInstallResult(null);
        setError(null);
        try {
            const output = await api.installSkill(skillName.trim());
            setInstallResult({ success: true, message: output });
            setSkillName('');
            setShowInstallDialog(false);
            await fetchSkills();
        } catch (e) {
            setInstallResult({ success: false, message: String(e) });
        } finally {
            setInstallingSkill(false);
        }
    };

    const handleUninstallSkill = async () => {
        if (!showUninstallConfirm) return;
        setUninstallingSkill(true);
        try {
            await api.uninstallSkill(showUninstallConfirm);
            setShowUninstallConfirm(null);
            await fetchSkills();
        } catch (e) {
            setError('Failed to uninstall skill: ' + String(e));
        } finally {
            setUninstallingSkill(false);
        }
    };

    const handleUninstallClawhub = async () => {
        if (!confirm('Are you sure you want to uninstall Clawhub? This will remove the global npm package.')) return;
        setUninstallingClawhub(true);
        setError(null);
        try {
            await api.uninstallClawhub();
            await checkClawhub();
            setInstallResult({ success: true, message: 'Clawhub uninstalled successfully' });
        } catch (e) {
            setError('Failed to uninstall clawhub: ' + String(e));
        } finally {
            setUninstallingClawhub(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto scroll-container pr-2 relative">
            {/* Overlay for Uninstall Confirmation */}
            {showUninstallConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-dark-800 border border-dark-600 rounded-xl p-6 max-w-sm w-full shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-2">Uninstall Skill?</h3>
                        <p className="text-gray-400 text-sm mb-6">
                            Are you sure you want to verify removing <span className="text-white font-mono">{showUninstallConfirm}</span>? This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowUninstallConfirm(null)}
                                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-dark-700 rounded-lg transition-colors text-sm"
                                disabled={uninstallingSkill}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUninstallSkill}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
                                disabled={uninstallingSkill}
                            >
                                {uninstallingSkill ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                <span>Uninstall</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Skills</h2>
                    <p className="text-gray-400">Manage your OpenClaw skills</p>
                </div>
                {clawhubInstalled && (
                    <button
                        onClick={() => setShowInstallDialog(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-claw-500 hover:bg-claw-600 text-white rounded-lg transition-colors"
                        disabled={loading || installingSkill}
                    >
                        <Plus size={18} />
                        <span>Install Skill</span>
                    </button>
                )}
            </div>

            {/* Clawhub Status Banner */}
            {!loading && clawhubInstalled !== null && (
                <div className={`rounded-xl p-4 mb-6 flex items-center justify-between ${clawhubInstalled
                    ? 'bg-green-500/5 border border-green-500/20'
                    : 'bg-amber-500/10 border border-amber-500/30'
                    }`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${clawhubInstalled ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                            }`}>
                            <Terminal size={20} />
                        </div>
                        <div>
                            <h3 className={`font-medium ${clawhubInstalled ? 'text-green-200' : 'text-amber-200'
                                }`}>
                                {clawhubInstalled ? 'Clawhub Installed' : 'Clawhub CLI Required'}
                            </h3>
                            <p className="text-xs text-gray-400">
                                {clawhubInstalled
                                    ? 'The official CLI tool is installed and ready.'
                                    : 'Install the official CLI tool to manage skills'}
                            </p>
                        </div>
                    </div>

                    {clawhubInstalled ? (
                        <button
                            onClick={handleUninstallClawhub}
                            disabled={uninstallingClawhub}
                            className="p-2 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                            title="Uninstall Clawhub"
                        >
                            {uninstallingClawhub ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Trash2 size={16} />
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={handleInstallClawhub}
                            disabled={installingClawhub}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors text-sm disabled:opacity-50"
                        >
                            {installingClawhub ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Installing...</span>
                                </>
                            ) : (
                                <>
                                    <Download size={16} />
                                    <span>Install Clawhub</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}

            {/* Install Result Notification */}
            {installResult && (
                <div className={`rounded-xl p-4 mb-6 flex items-center gap-3 ${installResult.success ? 'bg-green-500/10 border border-green-500/50' : 'bg-red-500/10 border border-red-500/50'
                    }`}>
                    {installResult.success ? (
                        <CheckCircle className="text-green-400 flex-shrink-0" size={20} />
                    ) : (
                        <AlertCircle className="text-red-400 flex-shrink-0" size={20} />
                    )}
                    <p className={`text-sm ${installResult.success ? 'text-green-200' : 'text-red-200'}`}>
                        {installResult.message}
                    </p>
                    <button
                        onClick={() => setInstallResult(null)}
                        className="ml-auto text-gray-400 hover:text-white"
                    >
                        &times;
                    </button>
                </div>
            )}

            {/* Install Skill Dialog */}
            {showInstallDialog && (
                <div className="bg-dark-700 rounded-2xl border border-dark-600 p-6 mb-8">
                    <h3 className="text-lg font-semibold text-white mb-4">Install New Skill</h3>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <input
                                type="text"
                                value={skillName}
                                onChange={(e) => setSkillName(e.target.value)}
                                placeholder="e.g. self-improving-agent"
                                className="w-full bg-dark-800 border border-dark-600 rounded-xl pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-claw-500 focus:border-transparent outline-none font-mono text-sm"
                                disabled={installingSkill}
                                onKeyDown={(e) => e.key === 'Enter' && handleInstallSkill()}
                            />
                        </div>
                        <button
                            onClick={handleInstallSkill}
                            disabled={installingSkill || !skillName.trim()}
                            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {installingSkill ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                            <span>Install</span>
                        </button>
                        <button
                            onClick={() => setShowInstallDialog(false)}
                            disabled={installingSkill}
                            className="px-4 py-2 text-gray-400 hover:text-white hover:bg-dark-600 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                        Installs using <code className="bg-dark-800 px-1 py-0.5 rounded text-gray-300">npx clawhub install</code>
                    </p>
                </div>
            )}

            {loading && (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-10 h-10 text-claw-400 animate-spin mb-4" />
                    <p className="text-gray-400">Loading skills...</p>
                </div>
            )}

            {error && !installResult && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 mb-6 flex items-center gap-3">
                    <AlertCircle className="text-red-400 flex-shrink-0" size={20} />
                    <p className="text-red-200 text-sm">{error}</p>
                </div>
            )}

            {!loading && !error && skills.length === 0 && (
                <div className="py-12 text-center text-gray-500">
                    <Package size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium mb-1">No Skills Found</p>
                    <p className="text-sm">Install a skill to get started</p>
                </div>
            )}

            {!loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {skills.map((skill) => (
                        <div
                            key={skill.id}
                            className="bg-dark-700/50 hover:bg-dark-700 border border-dark-600 hover:border-dark-500 rounded-xl p-5 transition-all group"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                                    <Book size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-white truncate">{skill.name}</h3>
                                    {skill.description && (
                                        <p className="text-sm text-gray-400 mt-1 line-clamp-2">{skill.description}</p>
                                    )}
                                    <div className="mt-3 flex items-center justify-between">
                                        <span className="text-xs font-mono text-gray-600 bg-dark-800 px-1.5 py-0.5 rounded truncate max-w-[70%] block">
                                            {skill.id}
                                        </span>
                                        <button
                                            onClick={() => setShowUninstallConfirm(skill.id)}
                                            className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title={`Remove ${skill.name}`}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
