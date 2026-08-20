import * as cron from 'node-cron';
import { sincronizarTarefasInadimplentes } from '../services/crmInadimplenteTarefasService.js';

let job: cron.ScheduledTask | null = null;

export function iniciarCronInadimplenteTarefas(): void {
  if (job) job.stop();
  job = cron.schedule('20 * * * *', () => {
    void sincronizarTarefasInadimplentes()
      .then((r) => {
        console.log(
          `[inadimplenteTarefasCron] sync: ${r.fontes} título(s), +${r.criadas} / ~${r.atualizadas} / ✓${r.concluidas}`,
        );
        if (r.erros.length) console.warn('[inadimplenteTarefasCron]', r.erros.join('; '));
      })
      .catch((err) => {
        console.error(
          '[inadimplenteTarefasCron]',
          err instanceof Error ? err.message : err,
        );
      });
  });
  console.log('[inadimplenteTarefasCron] Agendado: 20 * * * *');
}
