/**
 * Configurações persistidas (key-value). Usado para Evolution API (rótulo da instância e número).
 */

import { prisma } from '../config/prisma.js';

const KEY_EVOLUTION_INSTANCE = 'evolution_instance';
const KEY_EVOLUTION_WHATSAPP_NUMBER = 'evolution_whatsapp_number';
const KEY_UAZAPI_INSTANCE_TOKEN = 'uazapi_instance_token';

export interface EvolutionStoredConfig {
  instance?: string;
  number?: string;
  instanceToken?: string;
}

export async function getEvolutionStoredConfig(): Promise<EvolutionStoredConfig> {
  const rows = await prisma.config.findMany({
    where: {
      key: { in: [KEY_EVOLUTION_INSTANCE, KEY_EVOLUTION_WHATSAPP_NUMBER, KEY_UAZAPI_INSTANCE_TOKEN] },
    },
  });
  const map = new Map(rows.map((r) => [r.key, r.value?.trim() || '']));
  return {
    instance: map.get(KEY_EVOLUTION_INSTANCE) || undefined,
    number: map.get(KEY_EVOLUTION_WHATSAPP_NUMBER) || undefined,
    instanceToken: map.get(KEY_UAZAPI_INSTANCE_TOKEN) || undefined,
  };
}

export async function saveEvolutionConfig(instance: string, number?: string): Promise<void> {
  const instanceTrim = instance?.trim();
  if (!instanceTrim) return;
  await prisma.config.upsert({
    where: { key: KEY_EVOLUTION_INSTANCE },
    create: { key: KEY_EVOLUTION_INSTANCE, value: instanceTrim },
    update: { value: instanceTrim },
  });
  if (number != null && String(number).trim() !== '') {
    const numTrim = String(number).trim().replace(/\D/g, '');
    if (numTrim) {
      await prisma.config.upsert({
        where: { key: KEY_EVOLUTION_WHATSAPP_NUMBER },
        create: { key: KEY_EVOLUTION_WHATSAPP_NUMBER, value: numTrim },
        update: { value: numTrim },
      });
    }
  }
}

export async function saveUazapiInstanceToken(token: string): Promise<void> {
  const tokenTrim = token?.trim();
  if (!tokenTrim) return;
  await prisma.config.upsert({
    where: { key: KEY_UAZAPI_INSTANCE_TOKEN },
    create: { key: KEY_UAZAPI_INSTANCE_TOKEN, value: tokenTrim },
    update: { value: tokenTrim },
  });
}
