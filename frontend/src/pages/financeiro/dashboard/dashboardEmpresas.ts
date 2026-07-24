/** Empresas / unidades do Dashboard Financeiro. */
export const GRUPO_RN_SOMOVEIS = [2, 4] as const;

export type DashboardUnidadeOpcao = { id: string; label: string };

export const DASHBOARD_UNIDADE_OPCOES: DashboardUnidadeOpcao[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'grupo_rn_moveis', label: 'RN + Só Móveis' },
  { id: '1', label: 'Só Aço' },
  { id: '3', label: 'Só Refrigeração' },
];

