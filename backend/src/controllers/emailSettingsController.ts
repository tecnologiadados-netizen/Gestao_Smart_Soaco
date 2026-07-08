import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import {
  encryptSecret,
  fetchEmailProviderSettings,
  markEmailCredentialError,
  markEmailCredentialSuccess,
  sanitizeEmailProviderSettings,
  sendSystemEmail,
} from '../services/systemEmail.js';

const saveSchema = z.object({
  provider: z.literal('gmail_api').default('gmail_api'),
  fromEmail: z.string().email(),
  fromName: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().optional(),
  refreshToken: z.string().optional(),
  testTo: z.string().email().optional(),
});

export async function getEmailSettings(_req: Request, res: Response): Promise<void> {
  try {
    const settings = await fetchEmailProviderSettings(prisma);
    res.json(sanitizeEmailProviderSettings(settings));
  } catch (e) {
    console.error('[emailSettings] GET', e);
    res.status(503).json({ error: 'Erro ao carregar credencial de e-mail.' });
  }
}

export async function saveEmailSettings(req: Request, res: Response): Promise<void> {
  try {
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos.', details: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;
    const existing = await fetchEmailProviderSettings(prisma);

    const clientSecretPlain = body.clientSecret?.trim() ?? '';
    const refreshTokenPlain = body.refreshToken?.trim() ?? '';

    if (!existing && (!clientSecretPlain || !refreshTokenPlain)) {
      res.status(400).json({
        error: 'Na primeira configuração, Client Secret e Refresh Token são obrigatórios.',
      });
      return;
    }

    let clientSecretEncrypted = existing?.clientSecretEncrypted ?? '';
    let refreshTokenEncrypted = existing?.refreshTokenEncrypted ?? '';

    if (clientSecretPlain) clientSecretEncrypted = encryptSecret(clientSecretPlain);
    if (refreshTokenPlain) refreshTokenEncrypted = encryptSecret(refreshTokenPlain);

    const saved = existing
      ? await prisma.emailProviderSettings.update({
          where: { id: existing.id },
          data: {
            provider: body.provider,
            fromEmail: body.fromEmail.trim(),
            fromName: body.fromName.trim(),
            clientId: body.clientId.trim(),
            clientSecretEncrypted,
            refreshTokenEncrypted,
            lastError: null,
            credentialBlockedAt: null,
            credentialBlockCode: null,
            credentialBlockSummary: null,
          },
        })
      : await prisma.emailProviderSettings.create({
          data: {
            provider: body.provider,
            fromEmail: body.fromEmail.trim(),
            fromName: body.fromName.trim(),
            clientId: body.clientId.trim(),
            clientSecretEncrypted,
            refreshTokenEncrypted,
          },
        });

    if (body.testTo) {
      try {
        await sendSystemEmail(prisma, {
          to: body.testTo,
          subject: 'Teste de credencial Gmail — Gestor de Pedidos SoAço',
          html: '<p>Este e-mail confirma que a credencial Gmail foi configurada com sucesso.</p>',
        });
        await markEmailCredentialSuccess(prisma, saved.id);
      } catch (e) {
        await markEmailCredentialError(prisma, saved.id, e);
        const refreshed = await fetchEmailProviderSettings(prisma);
        res.status(400).json({
          error: e instanceof Error ? e.message : 'Falha no envio de teste.',
          settings: sanitizeEmailProviderSettings(refreshed),
        });
        return;
      }
    }

    const refreshed = await fetchEmailProviderSettings(prisma);
    res.json({
      ok: true,
      settings: sanitizeEmailProviderSettings(refreshed),
    });
  } catch (e) {
    console.error('[emailSettings] POST', e);
    const msg = e instanceof Error ? e.message : 'Erro ao salvar credencial.';
    if (msg.includes('EMAIL_SETTINGS_ENCRYPTION_KEY')) {
      res.status(503).json({ error: msg });
      return;
    }
    res.status(500).json({ error: msg });
  }
}

const dispatchSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
});

const testSchema = z.object({
  to: z.string().email(),
});

export async function sendTestEmail(req: Request, res: Response): Promise<void> {
  try {
    const parsed = testSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Informe um e-mail de destino válido.' });
      return;
    }
    const settings = await fetchEmailProviderSettings(prisma);
    if (!settings) {
      res.status(400).json({ error: 'Credencial não configurada. Salve a credencial antes de testar.' });
      return;
    }

    await sendSystemEmail(prisma, {
      to: parsed.data.to,
      subject: 'Teste de credencial Gmail — Gestor de Pedidos SoAço',
      html: `<p>Este e-mail confirma que a credencial Gmail (<strong>${settings.fromEmail}</strong>) está funcionando.</p>
        <p>Enviado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.</p>`,
    });
    await markEmailCredentialSuccess(prisma, settings.id);
    const refreshed = await fetchEmailProviderSettings(prisma);
    res.json({
      ok: true,
      message: `E-mail de teste enviado para ${parsed.data.to}.`,
      sentAt: new Date().toISOString(),
      to: parsed.data.to,
      from: settings.fromEmail,
      settings: sanitizeEmailProviderSettings(refreshed),
    });
  } catch (e) {
    console.error('[emailSettings] POST /test', e);
    const settings = await fetchEmailProviderSettings(prisma);
    if (settings) await markEmailCredentialError(prisma, settings.id, e);
    const refreshed = await fetchEmailProviderSettings(prisma);
    res.status(400).json({
      error: e instanceof Error ? e.message : 'Falha no envio de teste.',
      settings: sanitizeEmailProviderSettings(refreshed),
    });
  }
}

export async function dispatchEmail(req: Request, res: Response): Promise<void> {
  try {
    const parsed = dispatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Dados inválidos.' });
      return;
    }
    await sendSystemEmail(prisma, parsed.data);
    res.json({ ok: true });
  } catch (e) {
    console.error('[emailDispatcher] POST', e);
    res.status(400).json({ error: e instanceof Error ? e.message : 'Erro ao enviar e-mail.' });
  }
}
