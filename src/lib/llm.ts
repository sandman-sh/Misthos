// Provider-agnostic LLM layer for the Misthos oracle + MIZO agent.
// Default: OpenRouter free model. Supports presets (openrouter/openai/anthropic/gemini)
// and fully custom OpenAI-compatible endpoints. Resolution order:
// per-user DB settings -> environment variables -> OpenRouter free defaults.

import crypto from 'crypto';

export interface LlmConfig {
  provider: string;       // openrouter | openai | anthropic | gemini | custom
  baseUrl: string;        // OpenAI-compatible /chat/completions endpoint base
  apiKey: string;
  model: string;
  headers?: Record<string, string>;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const PRESETS: Record<string, { baseUrl: string; defaultModel: string; keyEnv: string; extraHeaders?: Record<string, string> }> = {
  openrouter: {
    baseUrl: 'https://' + 'openrouter.ai' + '/api/v1',
    defaultModel: 'deepseek/deepseek-v4.1-flash',
    keyEnv: 'OPENROUTER_API_KEY',
    extraHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Misthos Oracle',
    },
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    keyEnv: 'OPENAI_API_KEY',
  },
  anthropic: {
    baseUrl: 'https://' + 'openrouter.ai' + '/api/v1', // Claude via OpenRouter shim
    defaultModel: 'anthropic/claude-3.5-haiku',
    keyEnv: 'ANTHROPIC_API_KEY',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    keyEnv: 'GEMINI_API_KEY',
  },
};

export function resolveLlmConfig(userSettings?: {
  provider?: string | null;
  baseUrl?: string | null;
  apiKey?: string | null;
  model?: string | null;
} | null): LlmConfig | null {
  const provider = (userSettings?.provider || process.env.LLM_PROVIDER || 'openrouter').toLowerCase();
  const preset = PRESETS[provider] || PRESETS.openrouter;

  const baseUrl = userSettings?.baseUrl || process.env.LLM_BASE_URL || preset.baseUrl;
  const apiKey = userSettings?.apiKey || process.env[preset.keyEnv] || process.env.LLM_API_KEY || '';
  const model = userSettings?.model || process.env.LLM_MODEL || preset.defaultModel;

  if (!apiKey) return null; // caller decides fallback behavior

  return {
    provider,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
    model,
    headers: provider === 'openrouter' ? preset.extraHeaders : undefined,
  };
}

export async function llmChat(
  config: LlmConfig,
  messages: LlmMessage[],
  opts: { temperature?: number; maxTokens?: number; jsonMode?: boolean } = {}
): Promise<string> {
  const body: any = {
    model: config.model,
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 2048,
  };
  if (opts.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...(config.headers || {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM request failed (${config.provider}/${config.model}): ${res.status} ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('LLM returned empty content.');
  }
  return content;
}

// Extract the first JSON object from an LLM response, tolerant of markdown fences.
export function extractJson<T = any>(text: string): T {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in LLM response.');
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

export function hashPayload(obj: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}
