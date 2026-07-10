/**
 * Cron genérico para tipos de notificação por e-mail com modoDisparo=cron.
 */

import * as cron from 'node-cron';
import { listarTiposEmailCronAtivos } from '../data/emailNotificacaoRepository.js';
import { executarNotificacaoEmailAgendada } from '../services/emailNotificacaoService.js';
import { listarExpressoesCronAgendamento } from '../utils/smsCronHorarios.js';

const jobs = new Map<string, cron.ScheduledTask>();

export async function recarregarCronsEmailNotificacao(): Promise<void> {
  for (const task of jobs.values()) {
    task.stop();
  }
  jobs.clear();

  const tipos = await listarTiposEmailCronAtivos();
  for (const tipo of tipos) {
    const expressoes = listarExpressoesCronAgendamento(tipo.cronExpressao);
    if (expressoes.length === 0) {
      console.warn(`[emailNotificacaoCron] Sem horário para "${tipo.code}".`);
      continue;
    }
    for (const expr of expressoes) {
      if (!cron.validate(expr)) {
        console.warn(`[emailNotificacaoCron] Cron inválido para "${tipo.code}": ${expr}`);
        continue;
      }
      const jobKey = `${tipo.id}:${expr}`;
      const task = cron.schedule(expr, () => {
        void executarNotificacaoEmailAgendada(tipo.code);
      });
      jobs.set(jobKey, task);
      console.log(`[emailNotificacaoCron] Agendado "${tipo.code}": ${expr}`);
    }
  }
}

export function iniciarCronsEmailNotificacao(): void {
  void recarregarCronsEmailNotificacao().catch((err) => {
    console.error('[emailNotificacaoCron] Falha ao iniciar:', err instanceof Error ? err.message : err);
  });
}
