/**
 * A cada 2 minutos, grava o espelho dos documentos novos que já têm pedido vinculado.
 */
import * as cron from 'node-cron';
import { gravarEspelhosVinculosRecentes } from '../services/doubleCheckInEspelhoVinculoJob.js';

let job: cron.ScheduledTask | null = null;

export function iniciarCronEspelhoVinculoDoubleCheck(): void {
  if (job) job.stop();
  job = cron.schedule(
    '*/2 * * * *',
    () => {
      void gravarEspelhosVinculosRecentes();
    },
    { timezone: 'America/Sao_Paulo' }
  );
  console.log('[espelhoVinculo] Agendado: */2 * * * * (America/Sao_Paulo)');
  setTimeout(() => {
    void gravarEspelhosVinculosRecentes();
  }, 20_000);
}
