/**
 * Mantém a descrição dos tipos Loja/Indústria (Integração → SMS) igual à lista de vendedores
 * do código, para que incluir um vendedor não exija migration nem edição manual na tela.
 */

import { prisma } from '../config/prisma.js';
import {
  descricaoVendedoresEscopoWhatsApp,
  WHATSAPP_TIPO_TAG_DISPONIVEL_INDUSTRIA,
  WHATSAPP_TIPO_TAG_DISPONIVEL_LOJA,
  WHATSAPP_TIPO_TAG_INDISPONIVEL_INDUSTRIA,
  WHATSAPP_TIPO_TAG_INDISPONIVEL_LOJA,
  type EscopoWhatsAppComunicacaoPd,
} from '../utils/sycroOrderVendedorEscopoWhatsApp.js';

const TIPOS_POR_ESCOPO: Array<{ code: string; escopo: EscopoWhatsAppComunicacaoPd }> = [
  { code: WHATSAPP_TIPO_TAG_DISPONIVEL_LOJA, escopo: 'loja' },
  { code: WHATSAPP_TIPO_TAG_INDISPONIVEL_LOJA, escopo: 'loja' },
  { code: WHATSAPP_TIPO_TAG_DISPONIVEL_INDUSTRIA, escopo: 'industria' },
  { code: WHATSAPP_TIPO_TAG_INDISPONIVEL_INDUSTRIA, escopo: 'industria' },
];

export async function sincronizarDescricaoEscopoWhatsAppComunicacaoPd(): Promise<number> {
  let atualizados = 0;
  for (const { code, escopo } of TIPOS_POR_ESCOPO) {
    const descricao = descricaoVendedoresEscopoWhatsApp(escopo);
    const { count } = await prisma.whatsappNotificacaoTipo.updateMany({
      where: { code, NOT: { descricao } },
      data: { descricao },
    });
    atualizados += count;
  }
  return atualizados;
}
