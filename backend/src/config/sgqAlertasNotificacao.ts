/**
 * Alertas SGQ no catálogo de Integração (E-mail e WhatsApp/SMS).
 */

import { prisma } from './prisma.js';

export const SGQ_ALERTA_VALIDADE_CODE = 'sgq_validade_documento';
export const SGQ_ALERTA_CALIBRACAO_CODE = 'sgq_calibracao_equipamento';
export const SGQ_ALERTA_CRON_PADRAO = '0 8 * * *';

const VALIDADE_DESC =
  'Cadeia de validade de documentos vigentes no SGQ (30, 20, 10, 5, 3, 1 e 0 dias). ' +
  'E-mail em todos os marcos; WhatsApp a partir de 10 dias. Destinatários do tipo somam-se ao elaborador e aos avisos do documento.';

const CALIBRACAO_DESC =
  'Calibração e verificação de equipamentos ativos no SGQ (mesma cadeia de prazos). ' +
  'E-mail em todos os marcos; WhatsApp a partir de 10 dias. Destinatários do tipo somam-se ao responsável do equipamento.';

export function isSgqAlertaBuilder(code: string | null | undefined): boolean {
  const c = (code ?? '').trim();
  return c === SGQ_ALERTA_VALIDADE_CODE || c === SGQ_ALERTA_CALIBRACAO_CODE;
}

export async function ensureSgqAlertasEmailTipos(): Promise<void> {
  await upsertEmailTipo({
    code: SGQ_ALERTA_VALIDADE_CODE,
    label: 'SGQ — validade de documento',
    descricao: VALIDADE_DESC,
    sortOrder: 80,
  });
  await upsertEmailTipo({
    code: SGQ_ALERTA_CALIBRACAO_CODE,
    label: 'SGQ — calibração e verificação',
    descricao: CALIBRACAO_DESC,
    sortOrder: 81,
  });
}

export async function ensureSgqAlertasWhatsappTipos(): Promise<void> {
  await upsertWhatsappTipo({
    code: SGQ_ALERTA_VALIDADE_CODE,
    label: 'SGQ — validade de documento',
    descricao: VALIDADE_DESC,
    sortOrder: 80,
  });
  await upsertWhatsappTipo({
    code: SGQ_ALERTA_CALIBRACAO_CODE,
    label: 'SGQ — calibração e verificação',
    descricao: CALIBRACAO_DESC,
    sortOrder: 81,
  });
}

async function upsertEmailTipo(input: {
  code: string;
  label: string;
  descricao: string;
  sortOrder: number;
}): Promise<void> {
  const existing = await prisma.emailNotificacaoTipo.findUnique({
    where: { code: input.code },
    select: { id: true },
  });
  if (existing) return;
  await prisma.emailNotificacaoTipo.create({
    data: {
      code: input.code,
      label: input.label,
      descricao: input.descricao,
      ativo: true,
      sortOrder: input.sortOrder,
      fonteMensagem: 'codigo',
      modoDisparo: 'cron',
      cronExpressao: SGQ_ALERTA_CRON_PADRAO,
      builderCode: input.code,
    },
  });
}

async function upsertWhatsappTipo(input: {
  code: string;
  label: string;
  descricao: string;
  sortOrder: number;
}): Promise<void> {
  const existing = await prisma.whatsappNotificacaoTipo.findUnique({
    where: { code: input.code },
    select: { id: true },
  });
  if (existing) return;
  await prisma.whatsappNotificacaoTipo.create({
    data: {
      code: input.code,
      label: input.label,
      descricao: input.descricao,
      ativo: true,
      sortOrder: input.sortOrder,
      fonteMensagem: 'codigo',
      modoDisparo: 'cron',
      cronExpressao: SGQ_ALERTA_CRON_PADRAO,
      builderCode: input.code,
    },
  });
}
