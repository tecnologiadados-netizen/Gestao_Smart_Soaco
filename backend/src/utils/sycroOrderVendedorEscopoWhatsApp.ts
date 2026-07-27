/**
 * Escopo Loja / Indústria para alertas WhatsApp da Comunicação PD
 * (Integração → SMS), conforme o vendedor do pedido no Nomus.
 */

export type EscopoWhatsAppComunicacaoPd = 'loja' | 'industria';

/** Vendedores que disparam alertas da Loja (match normalizado). */
export const VENDEDORES_WHATSAPP_LOJA = [
  'ANTONIO LUIS PEREIRA DE SOUSA',
  'GILVANIA EVANGELISTA SAMPAIO',
  'MIRIAM DA SILVA NEPOMUCENO',
  'LARISSA CRISTINE PINHEIRO DOS SANTOS',
] as const;

/** Vendedores que disparam alertas da Indústria. */
export const VENDEDORES_WHATSAPP_INDUSTRIA = [
  'MARCOS AMORIM',
  'IDELGASTO ALVES CAMPELO',
  'J. A. DE P. ROCHA - AIRTON REPRESENTAÇÕES',
  'JAMES PEREIRA DOS SANTOS',
  'JONAS JEMYSON DA SILVA FERREIRA',
  'LARISSE NARLLA',
  'MARIA CLARA',
  'GOLD REPRESENTAÇÕES',
  'HENRIQUE REPRESENTAÇÃO LTDA',
] as const;

export const WHATSAPP_TIPO_TAG_DISPONIVEL_LOJA = 'sycroorder_tag_disponivel_loja';
export const WHATSAPP_TIPO_TAG_DISPONIVEL_INDUSTRIA = 'sycroorder_tag_disponivel_industria';
export const WHATSAPP_TIPO_TAG_INDISPONIVEL_LOJA = 'sycroorder_tag_indisponivel_loja';
export const WHATSAPP_TIPO_TAG_INDISPONIVEL_INDUSTRIA = 'sycroorder_tag_indisponivel_industria';

/** Normaliza nome de vendedor para comparação (maiúsculas, sem acento, espaços colapsados). */
export function normalizarNomeVendedorWhatsApp(nome: string | null | undefined): string {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const LOJA_SET = new Set(VENDEDORES_WHATSAPP_LOJA.map(normalizarNomeVendedorWhatsApp));
const INDUSTRIA_SET = new Set(VENDEDORES_WHATSAPP_INDUSTRIA.map(normalizarNomeVendedorWhatsApp));

/**
 * Resolve escopo pelo vendedor do PD.
 * Fora das duas listas (ou sem vendedor) → Indústria.
 */
export function resolverEscopoWhatsAppPorVendedor(
  vendedorNome: string | null | undefined
): EscopoWhatsAppComunicacaoPd {
  const key = normalizarNomeVendedorWhatsApp(vendedorNome);
  if (key && LOJA_SET.has(key)) return 'loja';
  if (key && INDUSTRIA_SET.has(key)) return 'industria';
  return 'industria';
}

export function codigoWhatsAppTagDisponivel(
  available: boolean,
  escopo: EscopoWhatsAppComunicacaoPd
): string {
  if (available) {
    return escopo === 'loja'
      ? WHATSAPP_TIPO_TAG_DISPONIVEL_LOJA
      : WHATSAPP_TIPO_TAG_DISPONIVEL_INDUSTRIA;
  }
  return escopo === 'loja'
    ? WHATSAPP_TIPO_TAG_INDISPONIVEL_LOJA
    : WHATSAPP_TIPO_TAG_INDISPONIVEL_INDUSTRIA;
}

/** Texto de descrição (Integração → SMS) listando vendedores do escopo. */
export function descricaoVendedoresEscopoWhatsApp(escopo: EscopoWhatsAppComunicacaoPd): string {
  const lista =
    escopo === 'loja'
      ? [...VENDEDORES_WHATSAPP_LOJA]
      : [...VENDEDORES_WHATSAPP_INDUSTRIA];
  const rotulo = escopo === 'loja' ? 'Loja' : 'Indústria';
  const fallback =
    escopo === 'industria'
      ? ' Vendedores não listados (ou sem vendedor no PD) também disparam este alerta.'
      : '';
  return `Escopo ${rotulo}. Vendedores: ${lista.join('; ')}.${fallback}`;
}
