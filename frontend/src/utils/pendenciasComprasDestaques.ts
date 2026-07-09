import type { PendenciasComprasDestaques } from '../api/pendenciasCompras';

export type EstoqueExibicaoPendencias = 'saldo' | 'verificar_pcp' | 'nao_controlado';

/** Estoque padrão Galpão Bobina ou Matéria Prima Processada. */
export const ESTOQUE_VERIFICAR_PCP_TEXTO = '(Verificar com PCP)';

/** Demais estoques padrão (fora almox secundário / bobina / MPP). */
export const ESTOQUE_NAO_CONTROLADO_TEXTO = 'Não controlado';

export function textoEstoquePendencias(
  linha: { estoqueExibicao: EstoqueExibicaoPendencias; estoqueAtual: number },
  formatarQtde: (valor: number) => string
): string {
  if (linha.estoqueExibicao === 'verificar_pcp') return ESTOQUE_VERIFICAR_PCP_TEXTO;
  if (linha.estoqueExibicao === 'nao_controlado') return ESTOQUE_NAO_CONTROLADO_TEXTO;
  return formatarQtde(linha.estoqueAtual);
}

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
] as const;

/** Regras de exibição da coluna Estoque Atual (conforme estoque padrão do produto no Nomus). */
export const LEGENDA_ESTOQUE_ATUAL_REGRAS = [
  {
    estoquePadrao: 'Almoxarifado Material Secundário',
    exibicao: 'Saldo numérico',
    detalhe: 'Exibe o saldo consolidado do almox secundário.',
    tipo: 'saldo' as const,
  },
  {
    estoquePadrao: 'Almoxarifado Galpão Bobina',
    exibicao: ESTOQUE_VERIFICAR_PCP_TEXTO,
    detalhe: 'O saldo não é exibido — consulte o PCP.',
    tipo: 'verificar_pcp' as const,
  },
  {
    estoquePadrao: 'Almoxarifado Matéria Prima Processada',
    exibicao: ESTOQUE_VERIFICAR_PCP_TEXTO,
    detalhe: 'O saldo não é exibido — consulte o PCP.',
    tipo: 'verificar_pcp' as const,
  },
  {
    estoquePadrao: 'Demais estoques padrão',
    exibicao: ESTOQUE_NAO_CONTROLADO_TEXTO,
    detalhe: 'Estoque não controlado neste relatório.',
    tipo: 'nao_controlado' as const,
  },
] as const;
