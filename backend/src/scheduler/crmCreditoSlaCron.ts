/**
 * Cron horário: alerta gestor quando pendência de crédito fica sem ação além do prazo.
 */
import * as cron from 'node-cron';
import { prisma } from '../config/prisma.js';
import { fetchEmailProviderSettings } from '../services/systemEmail.js';
import { processarAlertasSlaSemAcao } from '../services/crmCreditoSlaSemAcaoService.js';
import { dispararComClaim, executarCatchup } from './agendamentoExecucao.js';

const CANAL = 'crm_credito_sla';
const CODE = 'crm_credito_sla_sem_acao';

let job: cron.ScheduledTask | null = null;
let running = false;

function cronExpression(): string {
  return process.env.CRM_CREDITO_SLA_CRON?.trim() || '15 * * * *';
}

async function runJob(): Promise<void> {
  if (running) {
    console.warn('[crmCreditoSlaCron] Execução anterior ainda em andamento; ignorando.');
    return;
  }
  running = true;
  try {
    const settings = await fetchEmailProviderSettings(prisma);
    if (!settings) {
      console.log('[crmCreditoSlaCron] Credencial de e-mail não configurada; ignorando.');
      return;
    }
    const result = await processarAlertasSlaSemAcao(prisma);
    if (result.elegiveis > 0 || result.falhas > 0) {
      console.log(
        `[crmCreditoSlaCron] elegíveis=${result.elegiveis} enviados=${result.enviados} falhas=${result.falhas}`
      );
    }
  } catch (e) {
    console.error('[crmCreditoSlaCron] Falha:', e instanceof Error ? e.message : e);
  } finally {
    running = false;
  }
}

export function iniciarCronsCrmCreditoSla(): void {
  const expr = cronExpression();
  if (!cron.validate(expr)) {
    console.warn(`[crmCreditoSlaCron] Expressão cron inválida: ${expr}`);
    return;
  }
  if (job) job.stop();
  job = cron.schedule(expr, () => {
    void dispararComClaim(CANAL, CODE, runJob);
  });
  console.log(`[crmCreditoSlaCron] Agendado: ${expr}`);

  void executarCatchup({
    canal: CANAL,
    code: CODE,
    expr,
    run: runJob,
    logPrefix: '[crmCreditoSlaCron]',
  });
}
