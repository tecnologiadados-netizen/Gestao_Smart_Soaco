/**
 * Constantes de empresa para o Dashboard Financeiro (DRE).
 * RN Marques + Só Móveis = unidade consolidada.
 */
export const DRE_DASH_ID_ACO = 1;
export const DRE_DASH_ID_MOVEIS = 2;
export const DRE_DASH_ID_REFRIGERACAO = 3;
export const DRE_DASH_ID_RN_MARQUES = 4;

/** Grupo consolidado: Só Móveis + RN Marques */
export const GRUPO_RN_SOMOVEIS: readonly number[] = [DRE_DASH_ID_MOVEIS, DRE_DASH_ID_RN_MARQUES];

export const DRE_DASH_EMPRESAS_TODAS: readonly number[] = [
  DRE_DASH_ID_ACO,
  DRE_DASH_ID_MOVEIS,
  DRE_DASH_ID_REFRIGERACAO,
  DRE_DASH_ID_RN_MARQUES,
];

export type DreDashUnidadeId = 'todas' | 'grupo_rn_moveis' | '1' | '2' | '3' | '4';

export type DreDashUnidade = {
  id: string;
  label: string;
  idEmpresas: number[];
};

export const DRE_DASH_UNIDADES: DreDashUnidade[] = [
  { id: 'todas', label: 'Todas', idEmpresas: [...DRE_DASH_EMPRESAS_TODAS] },
  { id: 'grupo_rn_moveis', label: 'RN + Só Móveis', idEmpresas: [...GRUPO_RN_SOMOVEIS] },
  { id: '1', label: 'Só Aço', idEmpresas: [DRE_DASH_ID_ACO] },
  { id: '3', label: 'Só Refrigeração', idEmpresas: [DRE_DASH_ID_REFRIGERACAO] },
];

/** Unidades para comparativo entre empresas (sem "Todas"). */
export const DRE_DASH_UNIDADES_COMPARATIVO: DreDashUnidade[] = [
  { id: 'grupo_rn_moveis', label: 'RN + Só Móveis', idEmpresas: [...GRUPO_RN_SOMOVEIS] },
  { id: '1', label: 'Só Aço', idEmpresas: [DRE_DASH_ID_ACO] },
  { id: '3', label: 'Só Refrigeração', idEmpresas: [DRE_DASH_ID_REFRIGERACAO] },
];

export function resolverUnidadeDashboard(filtro: string | undefined): DreDashUnidade {
  const key = String(filtro ?? 'todas').trim().toLowerCase();
  if (key === 'grupo_rn_moveis' || key === 'rn_moveis' || key === '2+4') {
    return DRE_DASH_UNIDADES.find((u) => u.id === 'grupo_rn_moveis')!;
  }
  if (key === '1' || key === 'aco') return DRE_DASH_UNIDADES.find((u) => u.id === '1')!;
  if (key === '3' || key === 'refrigeracao') return DRE_DASH_UNIDADES.find((u) => u.id === '3')!;
  if (key === '2' || key === 'moveis') {
    return { id: '2', label: 'Só Móveis', idEmpresas: [DRE_DASH_ID_MOVEIS] };
  }
  if (key === '4' || key === 'rn') {
    return { id: '4', label: 'RN Marques', idEmpresas: [DRE_DASH_ID_RN_MARQUES] };
  }
  return DRE_DASH_UNIDADES.find((u) => u.id === 'todas')!;
}

/** Prefixos pathKey das seções de despesa (valores absolutos nas saídas → sinal −1). */
export const DRE_DASH_PREFIXOS = {
  impostos: 'D/3',
  cpv: 'D/5',
  despVar: 'D/6',
  pessoalOp: 'D/7',
  despOi: 'D/8',
  pessoalLog: 'D/8/1/0',
  despAdm: 'D/10',
  pessoalAdm: 'D/10/0',
  pessoalAdmVar: 'D/10/1',
  despCom: 'D/11',
  despTerceiros: 'D/12',
  despFin: 'D/14',
  tributos: 'D/16',
} as const;

/** Grupos da pizza "Principais despesas" (códigos da árvore DRE) + filhos de 1º nível. */
export type DreDashDespesaFilho = { codigo: string; label: string; pathKey: string };

export type DreDashDespesaGrupo = {
  id: string;
  codigo: string;
  label: string;
  pathKey: string;
  filhos: DreDashDespesaFilho[];
};

export const DRE_DASH_DESPESAS_PRINCIPAIS: DreDashDespesaGrupo[] = [
  {
    id: 'despVar',
    codigo: '8',
    label: 'Despesas Variáveis',
    pathKey: DRE_DASH_PREFIXOS.despVar,
    filhos: [
      { codigo: '8.1', label: 'Energia Elétrica', pathKey: 'D/6/0' },
      { codigo: '8.2', label: 'Movimentação e Armazenagem', pathKey: 'D/6/1' },
    ],
  },
  {
    id: 'pessoalOp',
    codigo: '10',
    label: 'Gastos com Pessoal Operação',
    pathKey: DRE_DASH_PREFIXOS.pessoalOp,
    filhos: [
      { codigo: '10.1', label: 'Folha de Pagamento - Operacional', pathKey: 'D/7/0' },
      { codigo: '10.2', label: 'Demais Gastos com Pessoal', pathKey: 'D/7/1' },
      { codigo: '10.3', label: 'Serviços Terceirizados da Produção', pathKey: 'D/7/2' },
      { codigo: '10.4', label: 'Desenvolvimento de Colaboradores', pathKey: 'D/7/3' },
      { codigo: '10.5', label: 'EPI e Uniformes', pathKey: 'D/7/4' },
    ],
  },
  {
    id: 'despOi',
    codigo: '11',
    label: 'Despesas Operacionais Indiretas',
    pathKey: DRE_DASH_PREFIXOS.despOi,
    filhos: [
      { codigo: '11.1', label: 'Mecânica, Manutenção e Equipamentos', pathKey: 'D/8/0' },
      { codigo: '11.2', label: 'Despesas Logística', pathKey: 'D/8/1' },
      { codigo: '11.3', label: 'Despesas com Frota', pathKey: 'D/8/2' },
      { codigo: '11.4', label: 'Manutenção Veicular', pathKey: 'D/8/3' },
    ],
  },
  {
    id: 'despAdm',
    codigo: '13',
    label: 'Despesas Administrativas',
    pathKey: DRE_DASH_PREFIXOS.despAdm,
    filhos: [
      { codigo: '13.1', label: 'Folha de Pagamento - Administrativo', pathKey: 'D/10/0' },
      { codigo: '13.2', label: 'Despesas Variáveis com Pessoal', pathKey: 'D/10/1' },
      { codigo: '13.3', label: 'Despesas Prediais', pathKey: 'D/10/2' },
      { codigo: '13.4', label: 'Indenizações e Rescisões', pathKey: 'D/10/3' },
      { codigo: '13.6', label: 'Treinamentos', pathKey: 'D/10/4' },
      { codigo: '13.7', label: 'Despesas Diversas', pathKey: 'D/10/5' },
      { codigo: '13.8', label: 'Despesas de Viagem', pathKey: 'D/10/6' },
      { codigo: '13.9', label: 'Despesas de Escritório', pathKey: 'D/10/7' },
      { codigo: '13.10', label: 'Utilidades', pathKey: 'D/10/8' },
      { codigo: '13.11', label: 'Copa e Cozinha', pathKey: 'D/10/9' },
      { codigo: '13.12', label: 'Softwares', pathKey: 'D/10/10' },
      { codigo: '13.13', label: 'Outros', pathKey: 'D/10/11' },
    ],
  },
  {
    id: 'despCom',
    codigo: '14',
    label: 'Despesas Comerciais',
    pathKey: DRE_DASH_PREFIXOS.despCom,
    filhos: [
      { codigo: '14.1', label: 'Promoção e Comercial', pathKey: 'D/11/0' },
      { codigo: '14.2', label: 'Despesas Operacionais', pathKey: 'D/11/1' },
      { codigo: '14.3', label: 'Relacionamento', pathKey: 'D/11/2' },
      { codigo: '14.4', label: 'Comissões e Bonificações', pathKey: 'D/11/3' },
    ],
  },
  {
    id: 'despTerceiros',
    codigo: '15',
    label: 'Serviços de Terceiros',
    pathKey: DRE_DASH_PREFIXOS.despTerceiros,
    filhos: [
      { codigo: '15.1', label: 'Judicial', pathKey: 'D/12/0' },
      { codigo: '15.2', label: 'Gestão Empresarial', pathKey: 'D/12/1' },
      { codigo: '15.3', label: 'Marketing/Publicidade', pathKey: 'D/12/2' },
      { codigo: '15.4', label: 'Contabilidade', pathKey: 'D/12/3' },
      { codigo: '15.5', label: 'Outros Serviços', pathKey: 'D/12/4' },
    ],
  },
];
