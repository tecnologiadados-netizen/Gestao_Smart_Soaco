import { normalizarTextoBusca } from './textoLivreBusca';

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
 */
export function classificarProdutoPadrao(familiaProduto: unknown): LabelProdutoPadrao {
  const n = normalizarTextoBusca(String(familiaProduto ?? ''));
  if (n === 'padrao') return LABEL_PRODUTO_PADRAO;
  if (n === 'projeto') return LABEL_PRODUTO_NAO_PADRAO;
  return LABEL_PRODUTO_PADRAO_INDEFINIDO;
}

export function classeBadgeProdutoPadrao(label: string): string {
  if (label === LABEL_PRODUTO_PADRAO) {
    return 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300';
  }
  if (label === LABEL_PRODUTO_NAO_PADRAO) {
    return 'bg-amber-500/20 text-amber-800 dark:text-amber-300';
  }
  return 'bg-slate-500/15 text-slate-700 dark:text-slate-300';
}
