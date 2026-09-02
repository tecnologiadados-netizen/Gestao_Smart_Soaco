import { PERMISSOES, type CodigoPermissao } from '../config/permissoes.js';

/** Painéis KPI com permissão exclusiva (sem fallbacks PCP/Produção legados). */
export const PERMISSOES_ACESSO_PAINEL_PRODUCAO_CAMASI: CodigoPermissao[] = [
  PERMISSOES.KPIS_PAINEL_PRODUCAO_CAMASI_VER,
];

export const PERMISSOES_ACESSO_PAINEL_PEDIDOS_EM_ABERTO: CodigoPermissao[] = [
  PERMISSOES.KPIS_PAINEL_PEDIDOS_EM_ABERTO_VER,
];

export const PERMISSOES_ACESSO_PAINEL_COBERTURA_ESTOQUE: CodigoPermissao[] = [
  PERMISSOES.KPIS_PAINEL_COBERTURA_ESTOQUE_VER,
];
