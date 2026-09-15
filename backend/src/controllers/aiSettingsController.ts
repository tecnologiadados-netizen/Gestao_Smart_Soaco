import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import {
  encryptSecret,
  fetchAiProviderSettings,
  getDecryptedApiKey,
  sanitizeAiProviderSettings,
} from '../services/aiSettings.js';

const DEFAULT_MODEL = 'gpt-4o-mini';

const saveSchema = z.object({
  provider: z.literal('openai').default('openai'),
  model: z.string().min(1).default(DEFAULT_MODEL),
  apiKey: z.string().optional(),
});

export async function getAiSettings(_req: Request, res: Response): Promise<void> {
  try {
    const settings = await fetchAiProviderSettings(prisma);
    res.json(sanitizeAiProviderSettings(settings));
  } catch (e) {
    console.error('[aiSettings] GET', e);
    res.status(503).json({ error: 'Erro ao carregar credencial do Assistente IA.' });
  }
}

export async function saveAiSettings(req: Request, res: Response): Promise<void> {
  try {
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos.', details: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;
    const existing = await fetchAiProviderSettings(prisma);
    const apiKeyPlain = body.apiKey?.trim() ?? '';

    if (!existing && !apiKeyPlain) {
      res.status(400).json({ error: 'Na primeira configuração, a API key é obrigatória.' });
      return;
    }

    let apiKeyEncrypted = existing?.apiKeyEncrypted ?? '';
    if (apiKeyPlain) apiKeyEncrypted = encryptSecret(apiKeyPlain);

    const saved = existing
      ? await prisma.aiProviderSettings.update({
          where: { id: existing.id },
          data: {
            provider: body.provider,
            model: body.model.trim() || DEFAULT_MODEL,
            apiKeyEncrypted,
            lastError: null,
          },
        })
      : await prisma.aiProviderSettings.create({
          data: {
            provider: body.provider,
            model: body.model.trim() || DEFAULT_MODEL,
            apiKeyEncrypted,
          },
        });

    res.json({ ok: true, settings: sanitizeAiProviderSettings(saved) });
  } catch (e) {
    console.error('[aiSettings] PUT', e);
    const msg = e instanceof Error ? e.message : 'Erro ao salvar credencial.';
    if (msg.includes('EMAIL_SETTINGS_ENCRYPTION_KEY')) {
      res.status(503).json({ error: msg });
      return;
    }
    res.status(500).json({ error: msg });
  }
}

export async function testAiSettings(_req: Request, res: Response): Promise<void> {
  try {
    const settings = await fetchAiProviderSettings(prisma);
    if (!settings?.apiKeyEncrypted) {
      res.status(400).json({ error: 'Credencial não configurada. Salve a API key antes de testar.' });
      return;
    }

    const apiKey = getDecryptedApiKey(settings);
    const model = settings.model || DEFAULT_MODEL;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Responda apenas com a palavra OK.' },
          { role: 'user', content: 'ping' },
        ],
        max_tokens: 5,
        temperature: 0,
      }),
    });

    const raw = await response.text();
    let data: { error?: { message?: string }; choices?: { message?: { content?: string } }[] } = {};
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      /* ignore */
    }

    if (!response.ok) {
      const errMsg = data.error?.message ?? `OpenAI HTTP ${response.status}`;
      await prisma.aiProviderSettings.update({
        where: { id: settings.id },
        data: { lastError: errMsg },
      });
      const refreshed = await fetchAiProviderSettings(prisma);
      res.status(400).json({
        error: errMsg,
        settings: sanitizeAiProviderSettings(refreshed),
      });
      return;
    }

    await prisma.aiProviderSettings.update({
      where: { id: settings.id },
      data: { lastTestedAt: new Date(), lastError: null },
    });
    const refreshed = await fetchAiProviderSettings(prisma);
    res.json({
      ok: true,
      reply: data.choices?.[0]?.message?.content?.trim() ?? 'OK',
      settings: sanitizeAiProviderSettings(refreshed),
    });
  } catch (e) {
    console.error('[aiSettings] test', e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erro ao testar credencial.' });
  }
}
