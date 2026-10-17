'use client';

import React, { useEffect, useState } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Zap,
  Server,
} from 'lucide-react';

const PROVIDERS = [
  { id: 'openrouter', label: 'OpenRouter', hint: 'Any model, one key. Free models available.', baseUrl: 'https://openrouter.ai/api/v1', model: 'deepseek/deepseek-v4.1-flash' },
  { id: 'openai', label: 'OpenAI', hint: 'GPT-4o, GPT-5 family.', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'gemini', label: 'Google Gemini', hint: 'Gemini 2.0 Flash & Pro.', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
  { id: 'anthropic', label: 'Anthropic (via shim)', hint: 'Claude via OpenAI-compatible gateway.', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-3.5-haiku' },
  { id: 'custom', label: 'Custom Endpoint', hint: 'Any OpenAI-compatible /chat/completions API.', baseUrl: '', model: '' },
];

export function AiAgentSettings() {
  const [provider, setProvider] = useState('openrouter');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [apiKeySet, setApiKeySet] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [envFallback, setEnvFallback] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/app/settings/llm')
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) {
          setProvider(d.settings.provider || 'openrouter');
          setBaseUrl(d.settings.baseUrl || '');
          setApiKey(d.settings.apiKey || '');
          setApiKeySet(d.settings.apiKeySet || false);
          setModel(d.settings.model || '');
        }
        setEnvFallback(d.envFallback || null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const applyPreset = (id: string) => {
    setProvider(id);
    const p = PROVIDERS.find((x) => x.id === id);
    if (p && id !== 'custom') {
      setBaseUrl(p.baseUrl);
      setModel(p.model);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/app/settings/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, baseUrl, apiKey, model }),
      });
      if (!res.ok) throw new Error('Save failed');
      setStatus({ ok: true, text: 'AI agent configuration saved. Agent A and MIZO now use this provider.' });
      setApiKeySet(Boolean(apiKey));
    } catch (e: any) {
      setStatus({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const res = await fetch('/api/app/settings/llm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, baseUrl, apiKey, model }),
      });
      const d = await res.json();
      if (d.ok) {
        setStatus({ ok: true, text: `Connected: ${d.provider}/${d.model} replied "${d.reply}"` });
      } else {
        setStatus({ ok: false, text: d.error || 'Connection test failed.' });
      }
    } catch (e: any) {
      setStatus({ ok: false, text: e.message });
    } finally {
      setTesting(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="card-misthos p-6 space-y-5">
      <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-3">
        <h2 className="text-base font-bold flex items-center space-x-2">
          <BrainCircuit className="w-4 h-4 text-[var(--accent)]" />
          <span>AI Agent Engine (Agent A &amp; MIZO)</span>
        </h2>
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
            apiKeySet || envFallback
              ? 'bg-green-500/10 text-green-500 border border-green-500/30'
              : 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
          }`}
        >
          {apiKeySet || envFallback ? 'LLM ACTIVE' : 'HEURISTIC MODE'}
        </span>
      </div>

      <p className="text-xs text-[var(--foreground-muted)]">
        Powers the deliverable oracle (Agent A) and MIZO, the in-app autonomous agent. Works with OpenRouter
        (free models), OpenAI, Gemini, or any OpenAI-compatible endpoint — self-hosted included.
      </p>

      {envFallback && !apiKeySet && (
        <div className="p-3 rounded-lg bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-xs font-mono flex items-center space-x-2">
          <Server className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="text-[var(--foreground-muted)]">
            Server env fallback active: <strong className="text-[var(--foreground)]">{envFallback.provider}/{envFallback.model}</strong>
          </span>
        </div>
      )}

      {/* Provider picker */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p.id)}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              provider === p.id
                ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                : 'border-[var(--surface-border)] bg-[var(--surface-elevated)] hover:border-[var(--accent)]/50'
            }`}
          >
            <div className="text-xs font-bold">{p.label}</div>
            <div className="text-[10px] text-[var(--foreground-muted)] mt-0.5 leading-snug">{p.hint}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-semibold text-[var(--foreground-muted)] mb-1">Base URL</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://openrouter.ai/api/v1"
            className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[var(--foreground-muted)] mb-1">Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="deepseek/deepseek-v4.1-flash"
            className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-[var(--foreground-muted)] mb-1">API Key</label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="[redacted]..."
            className="w-full px-3 py-1.5 pr-10 text-xs font-mono rounded-lg bg-[var(--background)] border border-[var(--surface-border)] focus:ring-1 focus:ring-[var(--accent)]"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
          >
            {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {status && (
        <div
          className={`p-3 rounded-lg text-xs font-mono flex items-center space-x-2 ${
            status.ok
              ? 'bg-[var(--success-bg)] border border-[var(--success-border)] text-[var(--success)]'
              : 'bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)]'
          }`}
        >
          {status.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          <span>{status.text}</span>
        </div>
      )}

      <div className="flex items-center space-x-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary py-2 px-4 rounded-lg text-xs font-bold flex items-center space-x-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          <span>Save Configuration</span>
        </button>
        <button
          type="button"
          onClick={handleTest}
          disabled={testing}
          className="btn-secondary py-2 px-4 rounded-lg text-xs font-semibold flex items-center space-x-2 disabled:opacity-50"
        >
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          <span>Test Connection</span>
        </button>
      </div>
    </div>
  );
}
