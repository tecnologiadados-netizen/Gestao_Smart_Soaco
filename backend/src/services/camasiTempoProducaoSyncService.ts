/**
 * Sync Camasi (Firebird) → SQLite local.
 * - 1ª execução: histórico completo
 * - seguintes: janela incremental (padrão 120 dias) a cada ~1 min
 */

import { isCamasiEnabled } from '../config/camasiFirebirdDb.js';
import {
  countCamasiCacheRows,
  getCamasiSyncEstado,
  markCamasiSyncAttempt,
  markCamasiSyncError,
  markCamasiSyncSuccess,
  upsertCamasiTempoProducaoRows,
  type CamasiCacheWriteRow,
} from '../data/camasiTempoProducaoCacheRepository.js';
import {
  listTempoProducaoFirebirdAll,
  listTempoProducaoFirebirdDesde,
  type TempoProducaoRow,
} from '../data/camasiTempoProducaoRepository.js';

const DEFAULT_INCREMENTAL_DIAS = 120;

function incrementalDias(): number {
  const n = Number(process.env.CAMASI_SYNC_INCREMENTAL_DIAS ?? DEFAULT_INCREMENTAL_DIAS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_INCREMENTAL_DIAS;
}

export function isCamasiSyncEnabled(): boolean {
  if (process.env.CAMASI_SYNC_DISABLED === 'true') return false;
  return isCamasiEnabled();
}

function ymdOffset(daysBack: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysBack);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toWriteRows(rows: TempoProducaoRow[]): CamasiCacheWriteRow[] {
  return rows
    .filter((r) => Number.isFinite(r.id) && r.id > 0 && r.data)
    .map((r) => ({
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
    }));
}

export type CamasiSyncResult = {
  ok: boolean;
  skipped?: boolean;
  motivo?: string;
  modo?: 'full' | 'incremental';
  rowsUpserted?: number;
  erro?: string;
};

let emAndamento = false;

export async function sincronizarCamasiTempoProducao(): Promise<CamasiSyncResult> {
  if (!isCamasiSyncEnabled()) {
    return { ok: true, skipped: true, motivo: 'Sync Camasi desabilitado.' };
  }
  if (emAndamento) {
    return { ok: true, skipped: true, motivo: 'Sync já em andamento.' };
  }

  emAndamento = true;
  try {
    await markCamasiSyncAttempt();
    const estado = await getCamasiSyncEstado();
    const cacheCount = await countCamasiCacheRows();
    const precisaFull = !estado.fullSyncDone || cacheCount === 0;

    const modo: 'full' | 'incremental' = precisaFull ? 'full' : 'incremental';
    const firebirdRows =
      modo === 'full'
        ? await listTempoProducaoFirebirdAll()
        : await listTempoProducaoFirebirdDesde(ymdOffset(incrementalDias()));

    const writeRows = toWriteRows(firebirdRows);
    const rowsUpserted = await upsertCamasiTempoProducaoRows(writeRows);
    await markCamasiSyncSuccess({
      rowsUpserted,
      fullSyncDone: true,
      modo,
    });

    console.log(
      `[camasiSync] ${modo}: ${rowsUpserted} linha(s) upsert` +
        (modo === 'incremental' ? ` (desde ${ymdOffset(incrementalDias())})` : ' (histórico completo)')
    );

    try {
      const { avaliarEEnviarAlertaParadaCamasi } = await import('./camasiParadaAlertaService.js');
      await avaliarEEnviarAlertaParadaCamasi();
    } catch (alertaErr) {
      const alertaMsg = alertaErr instanceof Error ? alertaErr.message : String(alertaErr);
      console.warn('[camasiParadaAlerta] Falha ao avaliar alerta:', alertaMsg);
    }

    return { ok: true, modo, rowsUpserted };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      await markCamasiSyncError(msg);
    } catch {
      /* ignore */
    }
    console.warn('[camasiSync] Falha:', msg);
    return { ok: false, erro: msg };
  } finally {
    emAndamento = false;
  }
}
