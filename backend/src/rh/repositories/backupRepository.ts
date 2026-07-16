import { prisma } from '../../config/prisma.js';
import { RH_BACKUP_MODELS } from '../lib/rh-backup-tables.js';

type PrismaDelegate = {
  findMany: (args?: unknown) => Promise<unknown[]>;
  deleteMany: (args?: unknown) => Promise<unknown>;
  createMany: (args: unknown) => Promise<unknown>;
};

function delegate(name: (typeof RH_BACKUP_MODELS)[number]): PrismaDelegate {
  return (prisma as unknown as Record<string, PrismaDelegate>)[name];
}

export async function exportRhBackup() {
  const tables: Record<string, unknown[]> = {};
  for (const model of RH_BACKUP_MODELS) {
    try {
      tables[model] = await delegate(model).findMany();
    } catch (err) {
      console.error(`rh-backup-export ${model}:`, err);
      tables[model] = [];
    }
  }

  return {
    kind: 'people-s-rh-full-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

export async function importRhBackup(payload: { tables?: Record<string, unknown[]> }) {
  const tables = payload.tables ?? {};
  let imported = 0;

  for (const model of RH_BACKUP_MODELS) {
    const rows = tables[model];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const d = delegate(model);
    await d.deleteMany();
    await d.createMany({ data: rows, skipDuplicates: true });
    imported += rows.length;
  }

  return { ok: true, imported };
}
