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
