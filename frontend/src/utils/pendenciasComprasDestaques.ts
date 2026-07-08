import type { PendenciasComprasDestaques } from '../api/pendenciasCompras';

/** Texto exibido na grade quando o estoque padrão não é o almox secundário (ex.: bobinas). */
export const ESTOQUE_VERIFICAR_PCP_TEXTO = '(Verificar com PCP)';
const CODIGO_CLASS: Record<NonNullable<PendenciasComprasDestaques['codigo']>, string> = {
  zerado_com_sc: 'bg-amber-100 dark:bg-amber-900/40',
  zerado_com_agpag: 'bg-orange-200 dark:bg-orange-900/50',
  necessidade_acima_40d: 'bg-slate-200 dark:bg-slate-700/60',
};

const AGPAG_CLASS: Record<NonNullable<PendenciasComprasDestaques['agPag']>, string> = {
  menos_24h: 'bg-emerald-100 dark:bg-emerald-900/40',
  mais_24h: 'bg-amber-100 dark:bg-amber-900/40',
};

const PC_CLASS: Record<NonNullable<PendenciasComprasDestaques['pc']>, string> = {
  atrasado: 'bg-red-100 dark:bg-red-950/50',
  em_dia: 'bg-emerald-100 dark:bg-emerald-900/40',
};

export function classeDestaqueCodigo(destaques: PendenciasComprasDestaques): string {
  if (!destaques.codigo) return '';
  return CODIGO_CLASS[destaques.codigo];
}

export function classeDestaqueAgPag(destaques: PendenciasComprasDestaques): string {
  if (!destaques.agPag) return '';
  return AGPAG_CLASS[destaques.agPag];
}

export function classeDestaquePc(destaques: PendenciasComprasDestaques): string {
  if (!destaques.pc) return '';
  return PC_CLASS[destaques.pc];
}

export const LEGENDA_PENDENCIAS = [
  { coluna: 'Cód', texto: 'Estoque zerado e possui solicitação', classe: CODIGO_CLASS.zerado_com_sc },
  {
    coluna: 'Cód',
    texto: 'Estoque zerado e possui Ag Pag (sobrepõe a regra de SC)',
    classe: CODIGO_CLASS.zerado_com_agpag,
  },
  {
    coluna: 'Cód',
    texto: 'Todas as datas de necessidade superiores a 40 dias',
    classe: CODIGO_CLASS.necessidade_acima_40d,
  },
  { coluna: 'Ag Pag', texto: 'Ag Pag com menos de 24h', classe: AGPAG_CLASS.menos_24h },
  { coluna: 'Ag Pag', texto: 'Ag Pag com 24h ou mais', classe: AGPAG_CLASS.mais_24h },
  {
    coluna: 'PC',
    texto: 'PC com data de entrega superior à data de necessidade da solicitação',
    classe: PC_CLASS.atrasado,
  },
  { coluna: 'PC', texto: 'PC em dia', classe: PC_CLASS.em_dia },
  {
    coluna: 'Estoque Atual',
    texto: 'Estoque padrão diferente do almox secundário (ex.: bobinas)',
    classe: 'italic text-slate-600 dark:text-slate-400',
  },
] as const;
