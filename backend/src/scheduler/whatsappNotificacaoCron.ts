/**
 * Cron genérico para tipos de mensagem WhatsApp com modoDisparo=cron.
 */

import * as cron from 'node-cron';
import { listarTiposCronAtivos } from '../data/whatsappNotificacaoRepository.js';
import { executarNotificacaoAgendada } from '../services/whatsappNotificacaoService.js';
import { listarExpressoesCronAgendamento } from '../utils/smsCronHorarios.js';
import {
  dispararComClaim,
  ensureAgendamentoExecucaoTable,
  executarCatchup,
} from './agendamentoExecucao.js';

const jobs = new Map<string, cron.ScheduledTask>();

export async function recarregarCronsWhatsappNotificacao(): Promise<void> {
  for (const task of jobs.values()) {
    task.stop();
  }
  jobs.clear();

  await ensureAgendamentoExecucaoTable();

  const tipos = await listarTiposCronAtivos();
  for (const tipo of tipos) {
    const expressoes = listarExpressoesCronAgendamento(tipo.cronExpressao);
    if (expressoes.length === 0) {
      console.warn(`[whatsappNotificacaoCron] Sem horário para "${tipo.code}".`);
      continue;
    }
    for (const expr of expressoes) {
      if (!cron.validate(expr)) {
        console.warn(`[whatsappNotificacaoCron] Cron inválido para "${tipo.code}": ${expr}`);
        continue;
      }
      const jobKey = `${tipo.id}:${expr}`;
      const task = cron.schedule(expr, () => {
        void dispararComClaim('whatsapp', tipo.code, () =>
          executarNotificacaoAgendada(tipo.code, 'cron')
        );
      });
      jobs.set(jobKey, task);
      console.log(`[whatsappNotificacaoCron] Agendado "${tipo.code}": ${expr}`);
    }

    await executarCatchup({
      canal: 'whatsapp',
      code: tipo.code,
      expr: tipo.cronExpressao,
      run: () => executarNotificacaoAgendada(tipo.code, 'catchup'),
      logPrefix: '[whatsappNotificacaoCron]',
    });
  }
}

export function iniciarCronsWhatsappNotificacao(): void {
  void recarregarCronsWhatsappNotificacao().catch((err) => {
    console.error('[whatsappNotificacaoCron] Falha ao iniciar:', err instanceof Error ? err.message : err);
  });
}
