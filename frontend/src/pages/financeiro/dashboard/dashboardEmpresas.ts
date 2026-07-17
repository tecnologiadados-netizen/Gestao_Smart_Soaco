/** Empresas / unidades do Dashboard Financeiro. */
export const GRUPO_RN_SOMOVEIS = [2, 4] as const;

export type DashboardUnidadeOpcao = { id: string; label: string };

export const DASHBOARD_UNIDADE_OPCOES: DashboardUnidadeOpcao[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'grupo_rn_moveis', label: 'RN + Só Móveis' },
  { id: '1', label: 'Só Aço' },
  { id: '3', label: 'Só Refrigeração' },
];

export const DASHBOARD_METAS_STORAGE_KEY = 'dre-dashboard-metas-v1';

export type DashboardMetas = { metaEbitdaPct: number; metaLucroPct: number };

export const DASHBOARD_METAS_PADRAO: DashboardMetas = {
  metaEbitdaPct: 12,
  metaLucroPct: 3,
};

export function carregarMetasDashboard(): DashboardMetas {
  if (typeof localStorage === 'undefined') return { ...DASHBOARD_METAS_PADRAO };
  try {
    const raw = localStorage.getItem(DASHBOARD_METAS_STORAGE_KEY);
    if (!raw) return { ...DASHBOARD_METAS_PADRAO };
    const p = JSON.parse(raw) as Partial<DashboardMetas>;
    const e = Number(p.metaEbitdaPct);
    const l = Number(p.metaLucroPct);
    return {
      metaEbitdaPct: Number.isFinite(e) ? e : 12,
      metaLucroPct: Number.isFinite(l) ? l : 3,
    };
  } catch {
    return { ...DASHBOARD_METAS_PADRAO };
  }
}

export function salvarMetasDashboard(metas: DashboardMetas): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(DASHBOARD_METAS_STORAGE_KEY, JSON.stringify(metas));
}
