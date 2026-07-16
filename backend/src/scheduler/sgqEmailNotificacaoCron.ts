/**
 * Cron diário de notificações SGQ por e-mail.
 */

import * as cron from 'node-cron';
import { prisma } from '../config/prisma.js';
import { executarNotificacoesSgqEmail } from '../services/sgq/sgqEmailNotificacaoService.js';
import { fetchEmailProviderSettings } from '../services/systemEmail.js';
import { dispararComClaim, executarCatchup } from './agendamentoExecucao.js';

const SGQ_CANAL = 'sgq_email';
const SGQ_CODE = 'sgq_email';

let job: cron.ScheduledTask | null = null;
let running = false;

function cronExpression(): string {
  return process.env.SGQ_EMAIL_CRON?.trim() || '0 8 * * *';
}

async function runJob(): Promise<void> {
  if (running) {
    console.warn('[sgqEmailNotificacaoCron] Execução anterior ainda em andamento; ignorando.');
    return;
  }
  running = true;
  try {
    const settings = await fetchEmailProviderSettings(prisma);
    if (!settings) {
      console.log('[sgqEmailNotificacaoCron] Credencial de e-mail não configurada; ignorando.');
      return;
    }
    const result = await executarNotificacoesSgqEmail(prisma);
    console.log(
      `[sgqEmailNotificacaoCron] Enviados — validade: ${result.validade}, tarefas: ${result.tarefas}, calibração: ${result.calibracao}, verificação: ${result.verificacao}`
    );
  } catch (e) {
    console.error('[sgqEmailNotificacaoCron] Falha:', e instanceof Error ? e.message : e);
  } finally {
    running = false;
  }
}

export function iniciarCronsSgqEmailNotificacao(): void {
  const expr = cronExpression();
  if (!cron.validate(expr)) {
    console.warn(`[sgqEmailNotificacaoCron] Expressão cron inválida: ${expr}`);
    return;
  }
  if (job) job.stop();
  job = cron.schedule(expr, () => {
    void dispararComClaim(SGQ_CANAL, SGQ_CODE, runJob);
  });
  console.log(`[sgqEmailNotificacaoCron] Agendado: ${expr}`);

  void executarCatchup({
    canal: SGQ_CANAL,
    code: SGQ_CODE,
    expr,
    run: runJob,
    logPrefix: '[sgqEmailNotificacaoCron]',
  });
}

export async function executarSgqEmailNotificacaoManual(): Promise<void> {
  await runJob();
}
