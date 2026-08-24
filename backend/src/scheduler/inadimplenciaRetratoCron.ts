import * as cron from 'node-cron';
import { TZ_RETRATO } from '../services/crmInadimplenciaRetrato.js';
import { rodarRetratoInadimplencia } from '../services/crmInadimplenciaRetratoJob.js';

let job: cron.ScheduledTask | null = null;

function logResultado(r: Awaited<ReturnType<typeof rodarRetratoInadimplencia>>): void {
  console.log(
    `[inadimplenciaRetratoCron] ${r.mesAnterior}→${r.mesAtual} trabalho=${r.trabalho} fechamento=${r.fechamento}`,
  );
  if (r.erros.length) console.warn('[inadimplenciaRetratoCron]', r.erros.join('; '));
}

export async function executarRetratoInadimplenciaAgora(): Promise<void> {
  try {
    logResultado(await rodarRetratoInadimplencia());
  } catch (err) {
    console.error(
      '[inadimplenciaRetratoCron]',
      err instanceof Error ? err.message : err,
    );
  }
}

export function iniciarCronInadimplenciaRetrato(): void {
  if (job) job.stop();
  job = cron.schedule(
    '10 0 * * *',
    () => {
      void executarRetratoInadimplenciaAgora();
    },
    { timezone: TZ_RETRATO },
  );
  console.log(`[inadimplenciaRetratoCron] Agendado: 10 0 * * * (${TZ_RETRATO})`);
}
