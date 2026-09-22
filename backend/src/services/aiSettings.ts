import type { AiProviderSettings, PrismaClient } from '@prisma/client';
import { decryptSecret, encryptSecret } from './systemEmail.js';

export type SanitizedAiSettings = {
  configured: boolean;
  provider: string;
  model: string;
  hasApiKey: boolean;
  lastTestedAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
};

export async function fetchAiProviderSettings(
  prisma: PrismaClient
): Promise<AiProviderSettings | null> {
  return prisma.aiProviderSettings.findFirst({ orderBy: { updatedAt: 'desc' } });
}

export function sanitizeAiProviderSettings(
  settings: AiProviderSettings | null
): SanitizedAiSettings {
  return {
    configured: Boolean(settings?.apiKeyEncrypted),
    provider: settings?.provider ?? 'openai',
    model: settings?.model ?? 'gpt-4o-mini',
    hasApiKey: Boolean(settings?.apiKeyEncrypted),
    lastTestedAt: settings?.lastTestedAt?.toISOString() ?? null,
    lastError: settings?.lastError ?? null,
    updatedAt: settings?.updatedAt?.toISOString() ?? null,
  };
}

export function getDecryptedApiKey(settings: AiProviderSettings): string {
  return decryptSecret(settings.apiKeyEncrypted);
}

export { encryptSecret };
