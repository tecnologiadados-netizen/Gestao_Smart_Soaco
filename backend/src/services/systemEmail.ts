import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { EmailProviderSettings, PrismaClient } from '@prisma/client';
import { envioNotificacoesHabilitado, logEnvioSuprimido } from '../config/envioNotificacoes.js';

export type EmailAttachment = {
  filename: string;
  mimeType: string;
  contentBase64: string;
};

export type SendSystemEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
};

export type SanitizedEmailSettings = {
  configured: boolean;
  provider: string;
  fromEmail: string;
  fromName: string;
  clientId: string;
  hasClientSecret: boolean;
  hasRefreshToken: boolean;
  lastTestedAt: string | null;
  lastError: string | null;
  credentialBlockedAt: string | null;
  credentialBlockCode: string | null;
  credentialBlockSummary: string | null;
  updatedAt: string | null;
};

function getEncryptionKey(): Buffer {
  const secret = process.env.EMAIL_SETTINGS_ENCRYPTION_KEY?.trim();
  if (!secret) {
    throw new Error('EMAIL_SETTINGS_ENCRYPTION_KEY não configurado no .env do backend.');
  }
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(value: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([encrypted, tag]);
  return `v1:${iv.toString('base64url')}:${payload.toString('base64url')}`;
}

export function decryptSecret(payload: string): string {
  const [version, ivRaw, encryptedRaw] = payload.split(':');
  if (version !== 'v1' || !ivRaw || !encryptedRaw) {
    throw new Error('Segredo criptografado inválido.');
  }
  const key = getEncryptionKey();
  const data = Buffer.from(encryptedRaw, 'base64url');
  const tag = data.subarray(data.length - 16);
  const ciphertext = data.subarray(0, data.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export async function fetchEmailProviderSettings(prisma: PrismaClient): Promise<EmailProviderSettings | null> {
  return prisma.emailProviderSettings.findFirst({ orderBy: { updatedAt: 'desc' } });
}

export function sanitizeEmailProviderSettings(
  settings: EmailProviderSettings | null
): SanitizedEmailSettings {
  return {
    configured: Boolean(settings),
    provider: 'gmail_api',
    fromEmail: settings?.fromEmail ?? '',
    fromName: settings?.fromName ?? '',
    clientId: settings?.clientId ?? '',
    hasClientSecret: Boolean(settings?.clientSecretEncrypted),
    hasRefreshToken: Boolean(settings?.refreshTokenEncrypted),
    lastTestedAt: settings?.lastTestedAt?.toISOString() ?? null,
    lastError: settings?.lastError ?? null,
    credentialBlockedAt: settings?.credentialBlockedAt?.toISOString() ?? null,
    credentialBlockCode: settings?.credentialBlockCode ?? null,
    credentialBlockSummary: settings?.credentialBlockSummary ?? null,
    updatedAt: settings?.updatedAt?.toISOString() ?? null,
  };
}

function normalizeRecipients(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return [...new Set(list.map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

function encodeHeaderUtf8(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function toBase64Url(data: Buffer | string): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function buildRawMimeMessage(input: {
  fromEmail: string;
  fromName: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): string {
  const boundaryMixed = `mixed_${randomBytes(8).toString('hex')}`;
  const boundaryAlt = `alt_${randomBytes(8).toString('hex')}`;
  const from = `"${encodeHeaderUtf8(input.fromName)}" <${input.fromEmail}>`;
  const lines: string[] = [
    `From: ${from}`,
    `To: ${input.to.join(', ')}`,
  ];
  if (input.cc.length > 0) lines.push(`Cc: ${input.cc.join(', ')}`);
  if (input.bcc.length > 0) lines.push(`Bcc: ${input.bcc.join(', ')}`);
  lines.push(
    `Subject: ${encodeHeaderUtf8(input.subject)}`,
    'MIME-Version: 1.0',
  );

  const attachments = input.attachments ?? [];
  if (attachments.length === 0) {
    lines.push('Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', Buffer.from(input.html, 'utf8').toString('base64'));
    return lines.join('\r\n');
  }

  lines.push(`Content-Type: multipart/mixed; boundary="${boundaryMixed}"`, '', `--${boundaryMixed}`);
  lines.push(
    `Content-Type: multipart/alternative; boundary="${boundaryAlt}"`,
    '',
    `--${boundaryAlt}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(input.html, 'utf8').toString('base64'),
    `--${boundaryAlt}--`,
  );

  for (const att of attachments) {
    lines.push(
      `--${boundaryMixed}`,
      `Content-Type: ${att.mimeType}; name="${att.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${att.filename}"`,
      '',
      att.contentBase64,
    );
  }
  lines.push(`--${boundaryMixed}--`);
  return lines.join('\r\n');
}

function oauthErrorHint(error: string | undefined): string {
  switch (error) {
    case 'invalid_client':
      return 'Client ID ou Client Secret incorretos. Gere nova chave no Google Cloud e novo refresh token no OAuth Playground.';
    case 'unauthorized_client':
      return 'Tipo OAuth incorreto ou redirect ausente. Use Aplicativo da Web com redirect https://developers.google.com/oauthplayground';
    case 'invalid_grant':
      return 'Refresh token revogado ou de outro Client ID. Gere novo refresh no Playground com as mesmas credenciais.';
    default:
      return 'Verifique credenciais Gmail e escopo https://mail.google.com/';
  }
}

async function refreshGmailAccessToken(settings: EmailProviderSettings): Promise<string> {
  const clientSecret = decryptSecret(settings.clientSecretEncrypted);
  const refreshToken = decryptSecret(settings.refreshTokenEncrypted);

  const body = new URLSearchParams({
    client_id: settings.clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const json = (await response.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !json.access_token) {
    const hint = oauthErrorHint(json.error);
    throw new Error(
      `Falha ao renovar token do Gmail: ${response.status} — ${json.error ?? 'erro'} — ${json.error_description ?? hint}`
    );
  }
  return json.access_token;
}

async function sendEmailViaGmailApi(
  settings: EmailProviderSettings,
  input: SendSystemEmailInput
): Promise<void> {
  const accessToken = await refreshGmailAccessToken(settings);
  const to = normalizeRecipients(input.to);
  if (to.length === 0) throw new Error('Nenhum destinatário informado.');

  const raw = buildRawMimeMessage({
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
    to,
    cc: normalizeRecipients(input.cc),
    bcc: normalizeRecipients(input.bcc),
    subject: input.subject,
    html: input.html,
    attachments: input.attachments,
  });

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: toBase64Url(raw) }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gmail API rejeitou o envio (${response.status}): ${errText.slice(0, 500)}`);
  }
}

export async function sendSystemEmail(
  prisma: PrismaClient,
  input: SendSystemEmailInput
): Promise<void> {
  if (!envioNotificacoesHabilitado()) {
    logEnvioSuprimido('email', normalizeRecipients(input.to).join(', '), input.subject);
    return;
  }
  const settings = await fetchEmailProviderSettings(prisma);
  if (!settings) {
    throw new Error('Credencial de e-mail não configurada. Acesse Integração → Credenciais → E-mail.');
  }
  if (settings.credentialBlockedAt) {
    throw new Error(
      settings.credentialBlockSummary ??
        settings.lastError ??
        'Credencial de e-mail bloqueada. Reconfigure em Credenciais.'
    );
  }
  await sendEmailViaGmailApi(settings, input);
}

export async function markEmailCredentialError(
  prisma: PrismaClient,
  settingsId: string,
  error: unknown
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const codeMatch = message.match(/\b(invalid_client|unauthorized_client|invalid_grant)\b/);
  await prisma.emailProviderSettings.update({
    where: { id: settingsId },
    data: {
      lastError: message.slice(0, 2000),
      credentialBlockedAt: codeMatch ? new Date() : undefined,
      credentialBlockCode: codeMatch?.[1] ?? null,
      credentialBlockSummary: codeMatch ? oauthErrorHint(codeMatch[1]) : null,
    },
  });
}

export async function markEmailCredentialSuccess(prisma: PrismaClient, settingsId: string): Promise<void> {
  await prisma.emailProviderSettings.update({
    where: { id: settingsId },
    data: {
      lastTestedAt: new Date(),
      lastError: null,
      credentialBlockedAt: null,
      credentialBlockCode: null,
      credentialBlockSummary: null,
    },
  });
}
