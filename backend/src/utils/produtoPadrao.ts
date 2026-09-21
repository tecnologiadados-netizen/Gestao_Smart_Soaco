import { normalizarTextoBusca } from './textoLivreBusca.js';

/** Família Nomus que classifica o item como produto padrão. */
export const FAMILIA_PRODUTO_PADRAO = 'padrao';
/** Família Nomus que classifica o item como não padrão (projeto). */
export const FAMILIA_PRODUTO_PROJETO = 'projeto';

export const LABEL_PRODUTO_PADRAO = 'Padrão';
export const LABEL_PRODUTO_NAO_PADRAO = 'Não padrão';
export const LABEL_PRODUTO_PADRAO_INDEFINIDO = 'Indefinido';

export const OPCOES_PRODUTO_PADRAO = [
  LABEL_PRODUTO_PADRAO,
  LABEL_PRODUTO_NAO_PADRAO,
  LABEL_PRODUTO_PADRAO_INDEFINIDO,
] as const;

export type LabelProdutoPadrao = (typeof OPCOES_PRODUTO_PADRAO)[number];

/**
 * Classifica o item só pela família Nomus:
 * Padrão → produto padrão; Projeto → não padrão; demais/vazio → indefinido.
 * Não usa atributo recurso (corte/dobra Hebert).
 */
export function classificarProdutoPadrao(familiaProduto: unknown): LabelProdutoPadrao {
  const n = normalizarTextoBusca(String(familiaProduto ?? ''));
  if (n === FAMILIA_PRODUTO_PADRAO) return LABEL_PRODUTO_PADRAO;
  if (n === FAMILIA_PRODUTO_PROJETO) return LABEL_PRODUTO_NAO_PADRAO;
  return LABEL_PRODUTO_PADRAO_INDEFINIDO;
}
