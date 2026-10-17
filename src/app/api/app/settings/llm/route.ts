import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import db from '@/lib/db';
import { resolveLlmConfig, llmChat } from '@/lib/llm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = db.prepare('SELECT llm_provider, llm_base_url, llm_api_key, llm_model FROM users WHERE id = ?').get(user.id) as any;
  const envConfig = resolveLlmConfig(null);

  return NextResponse.json({
    settings: {
      provider: row?.llm_provider || '',
      baseUrl: row?.llm_base_url || '',
      apiKey: row?.llm_api_key ? '********' + String(row.llm_api_key).slice(-4) : '',
      apiKeySet: Boolean(row?.llm_api_key),
      model: row?.llm_model || '',
    },
    envFallback: envConfig ? { provider: envConfig.provider, model: envConfig.model, baseUrl: envConfig.baseUrl } : null,
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { provider, baseUrl, apiKey, model } = body;

  let effectiveKey = apiKey;
  if (apiKey && apiKey.startsWith('********')) {
    const row = db.prepare('SELECT llm_api_key FROM users WHERE id = ?').get(user.id) as any;
    effectiveKey = row?.llm_api_key || '';
  }

  db.prepare(`
    UPDATE users SET llm_provider = ?, llm_base_url = ?, llm_api_key = ?, llm_model = ? WHERE id = ?
  `).run(provider || null, baseUrl || null, effectiveKey || null, model || null, user.id);

  return NextResponse.json({ success: true });
}

// PUT = connectivity test with a tiny ping
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const row = db.prepare('SELECT llm_provider, llm_base_url, llm_api_key, llm_model FROM users WHERE id = ?').get(user.id) as any;

  const settings = (body.provider || body.apiKey)
    ? { provider: body.provider, baseUrl: body.baseUrl, apiKey: body.apiKey?.startsWith('********') ? row?.llm_api_key : body.apiKey, model: body.model }
    : row ? { provider: row.llm_provider, baseUrl: row.llm_base_url, apiKey: row.llm_api_key, model: row.llm_model } : null;

  const config = resolveLlmConfig(settings);
  if (!config) {
    return NextResponse.json({ ok: false, error: 'No API key configured.' }, { status: 400 });
  }

  try {
    const reply = await llmChat(config, [
      { role: 'system', content: 'You are MIZO, the Misthos oracle agent. Reply with exactly: MIZO ONLINE' },
      { role: 'user', content: 'ping' },
    ], { maxTokens: 20, temperature: 0 });
    return NextResponse.json({ ok: true, provider: config.provider, model: config.model, reply: reply.trim().slice(0, 100) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message.slice(0, 300) }, { status: 502 });
  }
}
