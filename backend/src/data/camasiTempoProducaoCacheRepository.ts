/**
 * Espelho SQLite de TEMPO_PRODUCAO (Camasi) — leitura offline e estado do sync.
 */

import { prisma } from '../config/prisma.js';
import type { TempoProducaoRow } from './camasiTempoProducaoRepository.js';
import {
  horasEntre,
  horasEntreParado,
} from './camasiTempoProducaoRepository.js';

const BATCH = 80;

export type CamasiSyncEstadoDto = {
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  lastRowsUpserted: number;
  totalRows: number;
  fullSyncDone: boolean;
  modoUltimoSync: string | null;
};

function toIso(d: Date | null | undefined): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function countCamasiCacheRows(): Promise<number> {
  return prisma.camasiTempoProducao.count();
}

export async function getCamasiSyncEstado(): Promise<CamasiSyncEstadoDto> {
  const row = await prisma.camasiSyncEstado.findUnique({ where: { id: 1 } });
  if (!row) {
    return {
      lastSuccessAt: null,
      lastAttemptAt: null,
      lastError: null,
      lastRowsUpserted: 0,
      totalRows: 0,
      fullSyncDone: false,
      modoUltimoSync: null,
    };
  }
  return {
    lastSuccessAt: toIso(row.lastSuccessAt),
    lastAttemptAt: toIso(row.lastAttemptAt),
    lastError: row.lastError,
    lastRowsUpserted: row.lastRowsUpserted,
    totalRows: row.totalRows,
    fullSyncDone: row.fullSyncDone,
    modoUltimoSync: row.modoUltimoSync,
  };
}

export async function markCamasiSyncAttempt(): Promise<void> {
  await prisma.camasiSyncEstado.upsert({
    where: { id: 1 },
    create: { id: 1, lastAttemptAt: new Date() },
    update: { lastAttemptAt: new Date() },
  });
}

export async function markCamasiSyncSuccess(opts: {
  rowsUpserted: number;
  fullSyncDone: boolean;
  modo: 'full' | 'incremental';
}): Promise<void> {
  const totalRows = await prisma.camasiTempoProducao.count();
  await prisma.camasiSyncEstado.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      lastSuccessAt: new Date(),
      lastAttemptAt: new Date(),
      lastError: null,
      lastRowsUpserted: opts.rowsUpserted,
      totalRows,
      fullSyncDone: opts.fullSyncDone,
      modoUltimoSync: opts.modo,
    },
    update: {
      lastSuccessAt: new Date(),
      lastAttemptAt: new Date(),
      lastError: null,
      lastRowsUpserted: opts.rowsUpserted,
      totalRows,
      fullSyncDone: opts.fullSyncDone,
      modoUltimoSync: opts.modo,
    },
  });
}

export async function markCamasiSyncError(mensagem: string): Promise<void> {
  const msg = mensagem.slice(0, 2000);
  await prisma.camasiSyncEstado.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      lastAttemptAt: new Date(),
      lastError: msg,
    },
    update: {
      lastAttemptAt: new Date(),
      lastError: msg,
    },
  });
}

export type CamasiCacheWriteRow = {
  id: number;
  data: string;
  inicioProducao: string | null;
  fimProducao: string | null;
  inicioParado: string | null;
  fimParado: string | null;
  motivoParado: string | null;
  nomeMotivo: string | null;
  obsMotivo: string | null;
  operador: string | null;
  nomeOperador: string | null;
};

export async function upsertCamasiTempoProducaoRows(
  rows: CamasiCacheWriteRow[]
): Promise<number> {
  if (rows.length === 0) return 0;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await prisma.$transaction(
      chunk.map((r) =>
        prisma.camasiTempoProducao.upsert({
          where: { id: r.id },
          create: {
            id: r.id,
            data: r.data,
            inicioProducao: r.inicioProducao,
            fimProducao: r.fimProducao,
            inicioParado: r.inicioParado,
            fimParado: r.fimParado,
            motivoParado: r.motivoParado,
            nomeMotivo: r.nomeMotivo,
            obsMotivo: r.obsMotivo,
            operador: r.operador,
            nomeOperador: r.nomeOperador,
          },
          update: {
            data: r.data,
            inicioProducao: r.inicioProducao,
            fimProducao: r.fimProducao,
            inicioParado: r.inicioParado,
            fimParado: r.fimParado,
            motivoParado: r.motivoParado,
            nomeMotivo: r.nomeMotivo,
            obsMotivo: r.obsMotivo,
            operador: r.operador,
            nomeOperador: r.nomeOperador,
          },
        })
      )
    );
    upserted += chunk.length;
  }
  return upserted;
}

export async function listCamasiTempoProducaoFromCache(
  dataIni: string,
  dataFim: string
): Promise<TempoProducaoRow[]> {
  const rows = await prisma.camasiTempoProducao.findMany({
    where: { data: { gte: dataIni, lte: dataFim } },
    orderBy: { id: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    data: r.data,
    inicioProducao: r.inicioProducao,
    fimProducao: r.fimProducao,
    inicioParado: r.inicioParado,
    fimParado: r.fimParado,
    motivoParado: r.motivoParado,
    nomeMotivo: r.nomeMotivo,
    obsMotivo: r.obsMotivo,
    operador: r.operador,
    nomeOperador: r.nomeOperador,
    horasProducao: horasEntre(r.data, r.inicioProducao, r.fimProducao),
    horasParado: horasEntreParado(r.data, r.inicioParado, r.fimParado),
  }));
}
