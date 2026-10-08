/**
 * Tipo SMS (Integração → SMS) quando a Mesa envia um documento para conferência.
 */

import { prisma } from './prisma.js';

export const RECEBIMENTO_CONFERENCIA_WA_CODE = 'recebimento_documento_conferencia';

const LABEL = 'Recebimento — documento enviado para conferência';
const DESCRICAO =
  'Enviada quando a Mesa delibera um documento de pré-entrada para um conferente. ' +
  'A mensagem avisa o almoxarifado para entrar no sistema. Configure o destinatário (usuário ou grupo) nesta aba.';

export async function ensureRecebimentoConferenciaWhatsappTipo(): Promise<{ id: number; code: string }> {
  const existing = await prisma.whatsappNotificacaoTipo.findUnique({
    where: { code: RECEBIMENTO_CONFERENCIA_WA_CODE },
    select: { id: true, code: true },
  });
  if (existing) return existing;

  const created = await prisma.whatsappNotificacaoTipo.create({
    data: {
      code: RECEBIMENTO_CONFERENCIA_WA_CODE,
      label: LABEL,
      descricao: DESCRICAO,
      ativo: true,
      sortOrder: 55,
      fonteMensagem: 'evento',
      modoDisparo: 'evento',
    },
    select: { id: true, code: true },
  });
  return created;
}

export function montarMensagemDocumentoEnviadoConferencia(numeroDocumento: string): string {
  const documento = numeroDocumento.trim() || 'sem número';
  return [
    'Setor de almoxarifado.',
    `Documento ${documento} foi enviado para a conferência.`,
    'Entre no sistema para verificar.',
  ].join('\n');
}
