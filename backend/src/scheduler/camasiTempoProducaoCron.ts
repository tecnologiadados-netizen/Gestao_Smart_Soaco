/**
 * Cron Camasi → SQLite: a cada 1 minuto (enquanto o PC RICMAQ estiver online).
 */

import * as cron from 'node-cron';
import {
  isCamasiSyncEnabled,
  sincronizarCamasiTempoProducao,
} from '../services/camasiTempoProducaoSyncService.js';

let job: cron.ScheduledTask | null = null;

export function iniciarCronCamasiTempoProducao(): void {
  if (!isCamasiSyncEnabled()) {
    console.log('[camasiSyncCron] Desabilitado (CAMASI_SYNC_DISABLED ou CAMASI_FDB_DISABLED).');
    return;
  }
  if (job) job.stop();

  // A cada minuto
  job = cron.schedule('* * * * *', () => {
    void sincronizarCamasiTempoProducao();
  });

  console.log('[camasiSyncCron] Agendado: * * * * * (a cada 1 min)');

  // Primeira carga sem esperar o próximo tick (histórico completo se cache vazio)
  setTimeout(() => {
    void sincronizarCamasiTempoProducao();
  }, 8_000);
}
