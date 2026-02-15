import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Trash2,
  Star,
  Settings2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Cpu,
  Server,
  Sparkles,
  Zap,
  CheckCircle,
  XCircle,
  Pencil,
} from 'lucide-react';
import clsx from 'clsx';
import { aiLogger } from '../../lib/logger';

// ============ Type Definitions ============

interface SuggestedModel {
  id: string;
  name: string;
  description: string | null;
  context_window: number | null;
  max_tokens: number | null;
  recommended: boolean;
}

interface OfficialProvider {
  id: string;
  name: string;
  icon: string;
  default_base_url: string | null;
  api_type: string;
  suggested_models: SuggestedModel[];
  requires_api_key: boolean;
  docs_url: string | null;
}

interface ConfiguredModel {
  full_id: string;
  id: string;
  name: string;
  api_type: string | null;
  context_window: number | null;
  max_tokens: number | null;
  is_primary: boolean;
}

interface ConfiguredProvider {
  name: string;
  base_url: string;
  api_key_masked: string | null;
  has_api_key: boolean;
  models: ConfiguredModel[];
}

interface AIConfigOverview {
  primary_model: string | null;
  configured_providers: ConfiguredProvider[];
  available_models: string[];
}

interface ModelConfig {
  id: string;
  name: string;
  api: string | null;
  input: string[];
  context_window: number | null;
  max_tokens: number | null;
  reasoning: boolean | null;
  cost: { input: number; output: number; cache_read: number; cache_write: number } | null;
}

interface AITestResult {
  success: boolean;
  provider: string;
  model: string;
  response: string | null;
  error: string | null;
  latency_ms: number | null;
}

// ============ Add/Edit Provider Dialog ============

interface ProviderDialogProps {
  officialProviders: OfficialProvider[];
  onClose: () => void;
  onSave: () => void;
  // Pass existing configuration when in edit mode
  editingProvider?: ConfiguredProvider | null;
}

function ProviderDialog({ officialProviders, onClose, onSave, editingProvider }: ProviderDialogProps) {
  const isEditing = !!editingProvider;
  const [step, setStep] = useState<'select' | 'configure'>(isEditing ? 'configure' : 'select');
  const [selectedOfficial, setSelectedOfficial] = useState<OfficialProvider | null>(() => {
    if (editingProvider) {
      return officialProviders.find(p => 
        editingProvider.name.includes(p.id) || p.id === editingProvider.name
      ) || null;
    }
    return null;
  });
  
  // Configuration form
  const [providerName, setProviderName] = useState(editingProvider?.name || '');
  const [baseUrl, setBaseUrl] = useState(editingProvider?.base_url || '');
  const [apiKey, setApiKey] = useState('');
  const [apiType, setApiType] = useState(() => {
    if (editingProvider) {
      const firstModel = editingProvider.models[0];
      return firstModel?.api_type || 'openai-completions';
    }
    return 'openai-completions';
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>(() => {
    if (editingProvider) {
      return editingProvider.models.map(m => m.id);
    }
    return [];
  });
  const [customModelId, setCustomModelId] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showCustomUrlWarning, setShowCustomUrlWarning] = useState(false);

  // Check if using official Provider name with custom URL
  const isCustomUrlWithOfficialName = (() => {
    const official = officialProviders.find(p => p.id === providerName);
    if (official && official.default_base_url && baseUrl !== official.default_base_url) {
      return true;
    }
    return false;
  })();
  
  const handleSelectOfficial = (provider: OfficialProvider) => {
    setSelectedOfficial(provider);
    setProviderName(provider.id);
    setBaseUrl(provider.default_base_url || '');
    setApiType(provider.api_type);
    // Pre-select recommended models
    const recommended = provider.suggested_models.filter(m => m.recommended).map(m => m.id);
    setSelectedModels(recommended.length > 0 ? recommended : [provider.suggested_models[0]?.id].filter(Boolean));
    setFormError(null);
    setShowCustomUrlWarning(false);
    setStep('configure');
  };

  const handleSelectCustom = () => {
    setSelectedOfficial(null);
    setProviderName('');
    setBaseUrl('');
    setApiType('openai-completions');
    setSelectedModels([]);
    setFormError(null);
    setShowCustomUrlWarning(false);
    setStep('configure');
  };

  const toggleModel = (modelId: string) => {
    setFormError(null);
    setSelectedModels(prev => 
      prev.includes(modelId) 
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId]
    );
  };

  const addCustomModel = () => {
    if (customModelId && !selectedModels.includes(customModelId)) {
      setFormError(null);
      setSelectedModels(prev => [...prev, customModelId]);
      setCustomModelId('');
    }
  };

  // Automatically suggest using a custom name
  const suggestedName = (() => {
    if (isCustomUrlWithOfficialName && selectedOfficial) {
      return `${selectedOfficial.id}-custom`;
    }
    return null;
  })();

  const handleApplySuggestedName = () => {
    if (suggestedName) {
      setProviderName(suggestedName);
    }
  };

  const handleSave = async (forceOverride: boolean = false) => {
    setFormError(null);
    
    if (!providerName || !baseUrl || selectedModels.length === 0) {
      setFormError('Please fill in complete Provider information and select at least one model');
      return;
    }

    // Show warning if using official name with custom URL
    if (isCustomUrlWithOfficialName && !forceOverride) {
      setShowCustomUrlWarning(true);
      return;
    }
    
    setSaving(true);
    setShowCustomUrlWarning(false);
    try {
      // Build model configuration
      const models: ModelConfig[] = selectedModels.map(modelId => {
        const suggested = selectedOfficial?.suggested_models.find(m => m.id === modelId);
        // In edit mode, preserve original model configuration
        const existingModel = editingProvider?.models.find(m => m.id === modelId);
        return {
          id: modelId,
          name: suggested?.name || existingModel?.name || modelId,
          api: apiType,
          input: ['text', 'image'],
          context_window: suggested?.context_window || existingModel?.context_window || 200000,
          max_tokens: suggested?.max_tokens || existingModel?.max_tokens || 8192,
          reasoning: false,
          cost: null,
        };
      });

      await invoke('save_provider', {
        providerName,
        baseUrl,
        apiKey: apiKey || null,
        apiType,
        models,
      });

      aiLogger.info(`✓ Provider ${providerName} ${isEditing ? 'updated' : 'saved'}`);
      onSave();
      onClose();
    } catch (e) {
      aiLogger.error('Failed to save Provider', e);
      setFormError('Save failed: ' + String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-dark-800 rounded-2xl border border-dark-600 w-full max-w-2xl max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-600 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            {isEditing ? <Settings2 size={20} className="text-claw-400" /> : <Plus size={20} className="text-claw-400" />}
            {isEditing
              ? `Edit Provider: ${editingProvider?.name}`
              : (step === 'select' ? 'Add AI Provider' : `Configure ${selectedOfficial?.name || 'Custom Provider'}`)}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-140px)]">
          <AnimatePresence mode="wait">
            {step === 'select' ? (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Official Providers */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-400">Official Providers</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {officialProviders.map(provider => (
                <button
                  key={provider.id}
                        onClick={() => handleSelectOfficial(provider)}
                        className="flex items-center gap-3 p-4 rounded-xl bg-dark-700 border border-dark-500 hover:border-claw-500/50 hover:bg-dark-600 transition-all text-left group"
                >
                  <span className="text-2xl">{provider.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{provider.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {provider.suggested_models.length} models
                          </p>
                    </div>
                        <ChevronRight size={16} className="text-gray-500 group-hover:text-claw-400 transition-colors" />
                </button>
                    ))}
          </div>
        </div>

                {/* Custom Provider */}
                <div className="pt-4 border-t border-dark-600">
                  <button
                    onClick={handleSelectCustom}
                    className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-dark-500 hover:border-claw-500/50 text-gray-400 hover:text-white transition-all"
                  >
                    <Settings2 size={18} />
                    <span>Custom Provider (OpenAI/Anthropic API Compatible)</span>
                  </button>
                </div>
              </motion.div>
            ) : (
          <motion.div
                key="configure"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-5"
              >
                {/* Provider Name */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Provider Name
                    <span className="text-gray-600 text-xs ml-2">(For configuration identifier, e.g., anthropic-custom)</span>
                  </label>
                  <input
                    type="text"
                    value={providerName}
                    onChange={e => { setFormError(null); setProviderName(e.target.value); }}
                    placeholder="e.g., anthropic-custom, my-openai"
                    className={clsx(
                      'input-base',
                      isCustomUrlWithOfficialName && 'border-yellow-500/50'
                    )}
                    disabled={isEditing}
                  />
                  {isEditing && (
                    <p className="text-xs text-gray-500 mt-1">
                      Provider name cannot be modified. Please delete and recreate if you need to change it.
                    </p>
                  )}
                  {isCustomUrlWithOfficialName && !isEditing && (
                    <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <p className="text-xs text-yellow-400">
                        ⚠️ You are using an official Provider name but have modified the API URL. It is recommended to use a different name to avoid configuration conflicts.
                      </p>
                      <button
                        type="button"
                        onClick={handleApplySuggestedName}
                        className="mt-1 text-xs text-yellow-300 hover:text-yellow-200 underline"
                      >
                        Use suggested name: {suggestedName}
                      </button>
                    </div>
                  )}
                </div>

                {/* API URL */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">API URL</label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={e => { setFormError(null); setBaseUrl(e.target.value); }}
                    placeholder="https://api.example.com/v1"
                    className="input-base"
                  />
                </div>

              {/* API Key */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    API Key
                    {!selectedOfficial?.requires_api_key && (
                      <span className="text-gray-600 text-xs ml-2">(Optional)</span>
                    )}
                  </label>
                  {/* Show current API Key status in edit mode */}
                  {isEditing && editingProvider?.has_api_key && (
                    <div className="mb-2 flex items-center gap-2 text-sm">
                      <span className="text-gray-500">Current:</span>
                      <code className="px-2 py-0.5 bg-dark-600 rounded text-gray-400">
                        {editingProvider.api_key_masked}
                      </code>
                      <span className="text-green-400 text-xs">✓ Configured</span>
                    </div>
                  )}
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder={isEditing && editingProvider?.has_api_key
                        ? "Leave empty to keep existing API Key, or enter a new one"
                        : "sk-..."}
                      className="input-base pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    >
                      {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {isEditing && editingProvider?.has_api_key && (
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Leave empty if you don't need to change the API Key
                    </p>
                  )}
                </div>

                {/* API Type */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">API Type</label>
                  <select
                    value={apiType}
                    onChange={e => setApiType(e.target.value)}
                    className="input-base"
                  >
                    <option value="openai-completions">OpenAI Compatible (openai-completions)</option>
                    <option value="anthropic-messages">Anthropic Compatible (anthropic-messages)</option>
                  </select>
                </div>

                {/* Model Selection */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                    Select Models
                    <span className="text-gray-600 text-xs ml-2">
                      ({selectedModels.length} selected)
                    </span>
                  </label>
                  
                  {/* Preset Models */}
                  {selectedOfficial && (
                    <div className="space-y-2 mb-3">
                      {selectedOfficial.suggested_models.map(model => (
                        <button
                          key={model.id}
                          onClick={() => toggleModel(model.id)}
                          className={clsx(
                            'w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left',
                            selectedModels.includes(model.id)
                              ? 'bg-claw-500/20 border-claw-500'
                              : 'bg-dark-700 border-dark-500 hover:border-dark-400'
                          )}
                        >
                          <div>
                            <p className={clsx(
                              'text-sm font-medium',
                              selectedModels.includes(model.id) ? 'text-white' : 'text-gray-300'
                            )}>
                              {model.name}
                              {model.recommended && (
                                <span className="ml-2 text-xs text-claw-400">Recommended</span>
                              )}
                            </p>
                            {model.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{model.description}</p>
                            )}
                          </div>
                          {selectedModels.includes(model.id) && (
                            <Check size={16} className="text-claw-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Custom Model Input */}
                  <div className="flex gap-2">
                  <input
                    type="text"
                      value={customModelId}
                      onChange={e => setCustomModelId(e.target.value)}
                      placeholder="Enter custom model ID"
                      className="input-base flex-1"
                      onKeyDown={e => e.key === 'Enter' && addCustomModel()}
                    />
                    <button
                      onClick={addCustomModel}
                      disabled={!customModelId}
                      className="btn-secondary px-4"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Added Custom Models */}
                  {selectedModels.filter(id => !selectedOfficial?.suggested_models.find(m => m.id === id)).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedModels
                        .filter(id => !selectedOfficial?.suggested_models.find(m => m.id === id))
                        .map(modelId => (
                          <span
                            key={modelId}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-dark-600 rounded-lg text-sm text-gray-300"
                          >
                            {modelId}
                            <button
                              onClick={() => toggleModel(modelId)}
                              className="text-gray-500 hover:text-red-400"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                    </div>
                  )}
                </div>

                {/* Documentation Link */}
                {selectedOfficial?.docs_url && (
                  <a
                    href={selectedOfficial.docs_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-claw-400 hover:text-claw-300"
                  >
                    <ExternalLink size={14} />
                    View Official Documentation
                  </a>
                )}

                {/* Form Error Message */}
                {formError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
                  >
                    <p className="text-red-400 text-sm flex items-center gap-2">
                      <XCircle size={16} />
                      {formError}
                    </p>
                  </motion.div>
                )}

                {/* Custom URL Warning Dialog */}
                {showCustomUrlWarning && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg space-y-3"
                  >
                    <p className="text-yellow-400 text-sm">
                      ⚠️ You are using the official Provider name "{providerName}" but have modified the API URL.
                      This may cause the configuration to be overridden by OpenClaw's built-in settings.
                    </p>
                    <p className="text-yellow-300 text-sm">
                      It is recommended to use a different name, such as "{suggestedName}"
                    </p>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleApplySuggestedName}
                        className="btn-secondary text-sm py-2 px-3"
                      >
                        Use Suggested Name
                      </button>
                      <button
                        onClick={() => handleSave(true)}
                        className="btn-primary text-sm py-2 px-3"
                      >
                        Save Anyway
                      </button>
                      <button
                        onClick={() => setShowCustomUrlWarning(false)}
                        className="text-sm text-gray-400 hover:text-white px-3"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
              </div>

        {/* Footer Buttons */}
        <div className="px-6 py-4 border-t border-dark-600 flex justify-between">
          {step === 'configure' && !isEditing && (
            <button
              onClick={() => setStep('select')}
              className="btn-secondary"
            >
              Back
            </button>
          )}
          <div className="flex-1" />
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            {step === 'configure' && !showCustomUrlWarning && (
              <button
                onClick={() => handleSave()}
                disabled={saving || !providerName || !baseUrl || selectedModels.length === 0}
                className="btn-primary flex items-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {isEditing ? 'Update' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============ Provider Card ============

interface ProviderCardProps {
  provider: ConfiguredProvider;
  officialProviders: OfficialProvider[];
  onSetPrimary: (modelId: string) => void;
  onRefresh: () => void;
  onEdit: (provider: ConfiguredProvider) => void;
}

function ProviderCard({ provider, officialProviders, onSetPrimary, onRefresh, onEdit }: ProviderCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Find official Provider information
  const officialInfo = officialProviders.find(p =>
    provider.name.includes(p.id) || p.id === provider.name
  );

  // Check if using custom URL
  const isCustomUrl = officialInfo && officialInfo.default_base_url && provider.base_url !== officialInfo.default_base_url;

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await invoke('delete_provider', { providerName: provider.name });
      setShowDeleteConfirm(false);
      onRefresh();
    } catch (e) {
      setDeleteError('Delete failed: ' + String(e));
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setDeleteError(null);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-700 rounded-xl border border-dark-500 overflow-hidden"
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-dark-600/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xl">{officialInfo?.icon || '🔌'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-white">{provider.name}</h3>
            {provider.has_api_key && (
              <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                Configured
              </span>
            )}
            {isCustomUrl && (
              <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">
                Custom URL
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{provider.base_url}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{provider.models.length} models</span>
          <motion.div animate={{ rotate: expanded ? 180 : 0 }}>
            <ChevronDown size={18} className="text-gray-500" />
          </motion.div>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-dark-600"
          >
            <div className="p-4 space-y-3">
              {/* API Key Information */}
              {provider.api_key_masked && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">API Key:</span>
                  <code className="px-2 py-0.5 bg-dark-600 rounded text-gray-400">
                    {provider.api_key_masked}
                  </code>
                </div>
              )}

              {/* Model List */}
              <div className="space-y-2">
                {provider.models.map(model => (
                  <div
                    key={model.full_id}
                      className={clsx(
                      'flex items-center justify-between p-3 rounded-lg border transition-all',
                      model.is_primary
                        ? 'bg-claw-500/10 border-claw-500/50'
                        : 'bg-dark-600 border-dark-500'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Cpu size={16} className={model.is_primary ? 'text-claw-400' : 'text-gray-500'} />
                      <div>
                        <p className={clsx(
                            'text-sm font-medium',
                          model.is_primary ? 'text-white' : 'text-gray-300'
                        )}>
                          {model.name}
                          {model.is_primary && (
                            <span className="ml-2 text-xs text-claw-400">
                              <Star size={12} className="inline -mt-0.5" /> Primary Model
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">{model.full_id}</p>
                      </div>
                    </div>
                    {!model.is_primary && (
                      <button
                        onClick={() => onSetPrimary(model.full_id)}
                        className="text-xs text-gray-500 hover:text-claw-400 transition-colors"
                      >
                        Set as Primary
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Delete Confirmation Dialog */}
              {showDeleteConfirm && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg space-y-3"
                >
                  <p className="text-red-400 text-sm">
                    ⚠️ Are you sure you want to delete Provider "{provider.name}"? This will also delete all model configurations under it.
                  </p>
                  {deleteError && (
                    <p className="text-red-300 text-sm bg-red-500/20 p-2 rounded">
                      {deleteError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteConfirm}
                      disabled={deleting}
                      className="btn-primary text-sm py-2 px-3 bg-red-500 hover:bg-red-600 flex items-center gap-1"
                    >
                      {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      Confirm Delete
                    </button>
                    <button
                      onClick={handleDeleteCancel}
                      disabled={deleting}
                      className="btn-secondary text-sm py-2 px-3"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Action Buttons */}
              {!showDeleteConfirm && (
                <div className="flex justify-end gap-4 pt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(provider);
                    }}
                    className="flex items-center gap-1 text-sm text-claw-400 hover:text-claw-300 transition-colors"
                  >
                    <Pencil size={14} />
                    Edit Provider
                  </button>
                  <button
                    onClick={handleDeleteClick}
                    disabled={deleting}
                    className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Delete Provider
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============ Main Component ============

export function AIConfig() {
  const [loading, setLoading] = useState(true);
  const [officialProviders, setOfficialProviders] = useState<OfficialProvider[]>([]);
  const [aiConfig, setAiConfig] = useState<AIConfigOverview | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ConfiguredProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AITestResult | null>(null);

  const handleEditProvider = (provider: ConfiguredProvider) => {
    setEditingProvider(provider);
    setShowAddDialog(true);
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setEditingProvider(null);
  };

  const runAITest = async () => {
    aiLogger.action('Testing AI connection');
    setTesting(true);
    setTestResult(null);
    try {
      const result = await invoke<AITestResult>('test_ai_connection');
      setTestResult(result);
      if (result.success) {
        aiLogger.info(`✅ AI connection test successful, latency: ${result.latency_ms}ms`);
      } else {
        aiLogger.warn(`❌ AI connection test failed: ${result.error}`);
      }
    } catch (e) {
      aiLogger.error('AI test failed', e);
      setTestResult({
        success: false,
        provider: 'unknown',
        model: 'unknown',
        response: null,
        error: String(e),
        latency_ms: null,
      });
    } finally {
      setTesting(false);
    }
  };

  const loadData = useCallback(async () => {
    aiLogger.info('Loading AIConfig component data...');
    setError(null);

    try {
      const [officials, config] = await Promise.all([
        invoke<OfficialProvider[]>('get_official_providers'),
        invoke<AIConfigOverview>('get_ai_config'),
      ]);
      setOfficialProviders(officials);
      setAiConfig(config);
      aiLogger.info(`Loading complete: ${officials.length} official providers, ${config.configured_providers.length} configured`);
    } catch (e) {
      aiLogger.error('Failed to load AI configuration', e);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSetPrimary = async (modelId: string) => {
    try {
      await invoke('set_primary_model', { modelId });
      aiLogger.info(`Primary model set to: ${modelId}`);
      loadData();
    } catch (e) {
      aiLogger.error('Failed to set primary model', e);
      alert('Failed to set: ' + e);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-claw-500" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scroll-container pr-2">
      <div className="max-w-4xl space-y-6">
        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-300">
            <p className="font-medium mb-1">Failed to load configuration</p>
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={loadData}
              className="mt-2 text-sm text-red-300 hover:text-white underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Overview Card */}
        <div className="bg-gradient-to-br from-dark-700 to-dark-800 rounded-2xl p-6 border border-dark-500">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Sparkles size={22} className="text-claw-400" />
                AI Model Configuration
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Manage AI Providers and models used by OpenClaw
              </p>
            </div>
            <button
              onClick={() => setShowAddDialog(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} />
              Add Provider
            </button>
          </div>

          {/* Primary Model Display */}
          <div className="bg-dark-600/50 rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-claw-500/20 flex items-center justify-center">
              <Star size={24} className="text-claw-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-400">Current Primary Model</p>
              {aiConfig?.primary_model ? (
                <p className="text-lg font-medium text-white">{aiConfig.primary_model}</p>
              ) : (
                <p className="text-lg text-gray-500">Not Set</p>
              )}
            </div>
            <div className="text-right mr-4">
              <p className="text-sm text-gray-500">
                {aiConfig?.configured_providers.length || 0} Providers
              </p>
              <p className="text-sm text-gray-500">
                {aiConfig?.available_models.length || 0} Available Models
              </p>
            </div>
            <button
              onClick={runAITest}
              disabled={testing || !aiConfig?.primary_model}
              className="btn-secondary flex items-center gap-2"
            >
              {testing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                <Zap size={16} />
              )}
              Test Connection
            </button>
          </div>

          {/* AI Test Result */}
          {testResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={clsx(
                'mt-4 p-4 rounded-xl',
                testResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
              )}
            >
              <div className="flex items-center gap-3 mb-2">
                {testResult.success ? (
                  <CheckCircle size={20} className="text-green-400" />
                ) : (
                  <XCircle size={20} className="text-red-400" />
                )}
                <div className="flex-1">
                  <p className={clsx('font-medium', testResult.success ? 'text-green-400' : 'text-red-400')}>
                    {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                  </p>
                  {testResult.latency_ms && (
                    <p className="text-xs text-gray-400">Response Time: {testResult.latency_ms}ms</p>
                  )}
                </div>
                <button
                  onClick={() => setTestResult(null)}
                  className="text-gray-500 hover:text-white text-sm"
                >
                  Close
                </button>
              </div>

              {testResult.response && (
                <div className="mt-2 p-3 bg-dark-700 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">AI Response:</p>
                  <p className="text-sm text-white whitespace-pre-wrap">{testResult.response}</p>
                </div>
              )}

              {testResult.error && (
                <div className="mt-2 p-3 bg-red-500/10 rounded-lg">
                  <p className="text-xs text-red-400 mb-1">Error Message:</p>
                  <p className="text-sm text-red-300 whitespace-pre-wrap">{testResult.error}</p>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Configured Providers List */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Server size={18} className="text-gray-500" />
            Configured Providers
          </h3>

          {aiConfig?.configured_providers.length === 0 ? (
            <div className="bg-dark-700 rounded-xl border border-dark-500 p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-dark-600 flex items-center justify-center">
                <Plus size={24} className="text-gray-500" />
              </div>
              <p className="text-gray-400 mb-4">No AI Providers configured yet</p>
              <button
                onClick={() => setShowAddDialog(true)}
                className="btn-primary"
              >
                Add First Provider
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {aiConfig?.configured_providers.map(provider => (
                <ProviderCard
                  key={provider.name}
                  provider={provider}
                  officialProviders={officialProviders}
                  onSetPrimary={handleSetPrimary}
                  onRefresh={loadData}
                  onEdit={handleEditProvider}
                />
              ))}
            </div>
          )}
        </div>

        {/* Available Models List */}
        {aiConfig && aiConfig.available_models.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <Cpu size={18} className="text-gray-500" />
              Available Models
              <span className="text-sm font-normal text-gray-500">
                ({aiConfig.available_models.length} total)
              </span>
            </h3>
            <div className="bg-dark-700 rounded-xl border border-dark-500 p-4">
              <div className="flex flex-wrap gap-2">
                {aiConfig.available_models.map(modelId => (
                  <span
                    key={modelId}
                    className={clsx(
                      'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm',
                      modelId === aiConfig.primary_model
                        ? 'bg-claw-500/20 text-claw-300 border border-claw-500/30'
                        : 'bg-dark-600 text-gray-300'
                    )}
                  >
                    {modelId === aiConfig.primary_model && <Star size={12} />}
                    {modelId}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Configuration Notes */}
        <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-500">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Configuration Notes</h4>
          <ul className="text-sm text-gray-500 space-y-1">
            <li>• Provider configuration is saved in <code className="text-claw-400">~/.openclaw/openclaw.json</code></li>
            <li>• Supports official Providers (Anthropic, OpenAI, Kimi, etc.) and custom OpenAI/Anthropic compatible APIs</li>
            <li>• The primary model is used for Agent's default inference and can be switched at any time</li>
            <li>• Restart the service for configuration changes to take effect</li>
          </ul>
        </div>
      </div>

      {/* Add/Edit Provider Dialog */}
      <AnimatePresence>
        {showAddDialog && (
          <ProviderDialog
            officialProviders={officialProviders}
            onClose={handleCloseDialog}
            onSave={loadData}
            editingProvider={editingProvider}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
