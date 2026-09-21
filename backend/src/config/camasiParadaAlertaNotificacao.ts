/**
 * Tipo SMS (Integração → SMS) do alerta de parada da Camasi.
 */

import { prisma } from './prisma.js';

export const CAMASI_PARADA_ALERTA_WA_CODE = 'camasi_parada_20min';

const LABEL = 'Camasi — máquina parada 20 min';
const DESCRICAO =
  'WhatsApp quando a perfiladeira fica 20 min parada após o corte de início de jornada (07:05). ' +
  'Não repete na mesma ociosidade; só dispara de novo se houver produção e a máquina parar outros 20 min. ' +
  'Configure destinatários (usuários ou grupo) nesta tela. O job roda junto com o sync Camasi (1 min).';

export async function ensureCamasiParadaAlertaWhatsappTipo(): Promise<{ id: number; code: string }> {
  const existing = await prisma.whatsappNotificacaoTipo.findUnique({
    where: { code: CAMASI_PARADA_ALERTA_WA_CODE },
    select: { id: true, code: true },
  });
  if (existing) return existing;

  const created = await prisma.whatsappNotificacaoTipo.create({
    data: {
      code: CAMASI_PARADA_ALERTA_WA_CODE,
      label: LABEL,
      descricao: DESCRICAO,
      ativo: true,
      sortOrder: 48,
      fonteMensagem: 'evento',
      modoDisparo: 'evento',
    },
    select: { id: true, code: true },
  });
  return created;
}
