import { apiJson } from './client';

export type ComparacaoBase = 'periodo_anterior' | 'ano_anterior';

export type DrillDim = 'mes' | 'grupo' | 'subgrupo1' | 'subgrupo2' | 'vendedor' | 'regiao' | 'uf' | 'municipio' | 'produto' | 'cliente';

export interface FiltrosHistoricoVendas {
  dataIni: string;
  dataFim: string;
  comparacaoBase?: ComparacaoBase;
  grupoProduto?: string;
  subgrupo1?: string;
  subgrupo2?: string;
  vendedor?: string;
  regiao?: string;
  uf?: string;
  municipio?: string;
  cliente?: string;
  produto?: string;
  pd?: string;
}

export interface SerieMes {
  mes: string;
  valor: number;
  qtde: number;
  pedidos: number;
}

export interface HistoricoVendasAnalytics {
  filtros: { dataIni: string; dataFim: string; comparacaoBase: ComparacaoBase };
  kpis: {
    valor: number;
    valorBase: number;
    valorVarPct: number | null;
    qtde: number;
    qtdeBase: number;
    qtdeVarPct: number | null;
    ticketMedio: number;
    ticketMedioBase: number;
    ticketMedioVarPct: number | null;
    pedidos: number;
    pedidosBase: number;
    pedidosVarPct: number | null;
    concentracaoTopGrupoPct: number;
  };
  serieMensal: SerieMes[];
  topGrupos: { key: string; label: string; valor: number; qtde: number; pedidos: number; valorVarPct?: number | null }[];
  topSubgrupo1: { key: string; label: string; valor: number; qtde: number; pedidos: number; valorVarPct?: number | null }[];
  topVendedores: { key: string; label: string; valor: number; qtde: number; pedidos: number; valorVarPct?: number | null }[];
  topUfs: { key: string; label: string; valor: number; qtde: number; pedidos: number; valorVarPct?: number | null }[];
  mixGrupos: { grupoProduto: string; valor: number; pct: number }[];
  ganhadores: {
    codigoProduto: string;
    descricaoProduto: string;
    grupoProduto: string;
    valor: number;
    valorBase: number;
    valorVarPct: number | null;
  }[];
  perdedores: {
    codigoProduto: string;
    descricaoProduto: string;
    grupoProduto: string;
    valor: number;
    valorBase: number;
    valorVarPct: number | null;
  }[];
  erro?: string;
}

export interface HistoricoVendasDrillResp {
  items: { key: string; label: string; valor: number; qtde: number; pedidos: number }[];
}

export interface HistoricoVendasSerieFatiaResp {
  serieMensal: SerieMes[];
  error?: string;
}

export type SerieFatiaContexto = {
  mes?: string;
  grupoProduto?: string;
  subgrupo1?: string;
  subgrupo2?: string;
  vendedor?: string;
  regiao?: string;
  uf?: string;
  municipio?: string;
  cliente?: string;
  codigoProduto?: string;
  pd?: string;
};

function toQs(f: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    const s = String(v ?? '').trim();
    if (s) qs.set(k, s);
  }
  return qs.toString();
}

export async function obterHistoricoVendasAnalytics(filtros: FiltrosHistoricoVendas): Promise<HistoricoVendasAnalytics> {
  const qs = toQs({
    dataIni: filtros.dataIni,
    dataFim: filtros.dataFim,
    comparacaoBase: filtros.comparacaoBase,
    grupoProduto: filtros.grupoProduto,
    subgrupo1: filtros.subgrupo1,
    subgrupo2: filtros.subgrupo2,
    vendedor: filtros.vendedor,
    regiao: filtros.regiao,
    uf: filtros.uf,
    municipio: filtros.municipio,
    cliente: filtros.cliente,
    produto: filtros.produto,
    pd: filtros.pd,
  });
  return apiJson<HistoricoVendasAnalytics>(`/api/comercial/historico-vendas/analytics${qs ? `?${qs}` : ''}`);
}

export async function obterHistoricoVendasDrill(
  filtros: FiltrosHistoricoVendas,
  params: {
    dim: DrillDim;
    mes?: string;
    grupoProduto?: string;
    subgrupo1?: string;
    subgrupo2?: string;
    vendedor?: string;
    regiao?: string;
    uf?: string;
    municipio?: string;
    cliente?: string;
    codigoProduto?: string;
    pd?: string;
  }
): Promise<HistoricoVendasDrillResp> {
  const qs = toQs({
    dataIni: filtros.dataIni,
    dataFim: filtros.dataFim,
    comparacaoBase: filtros.comparacaoBase,
    grupoProduto: params.grupoProduto ?? filtros.grupoProduto,
    subgrupo1: params.subgrupo1 ?? filtros.subgrupo1,
    subgrupo2: params.subgrupo2 ?? filtros.subgrupo2,
    vendedor: params.vendedor ?? filtros.vendedor,
    regiao: params.regiao ?? filtros.regiao,
    uf: params.uf ?? filtros.uf,
    municipio: params.municipio ?? filtros.municipio,
    cliente: params.cliente ?? filtros.cliente,
    produto: filtros.produto,
    codigoProduto: params.codigoProduto,
    pd: params.pd ?? filtros.pd,
    dim: params.dim,
    mes: params.mes,
  });
  return apiJson<HistoricoVendasDrillResp>(`/api/comercial/historico-vendas/drill${qs ? `?${qs}` : ''}`);
}

export async function obterHistoricoVendasSerieFatia(
  filtros: FiltrosHistoricoVendas,
  contexto?: SerieFatiaContexto
): Promise<HistoricoVendasSerieFatiaResp> {
  const qs = toQs({
    dataIni: filtros.dataIni,
    dataFim: filtros.dataFim,
    comparacaoBase: filtros.comparacaoBase,
    produto: filtros.produto,
    mes: contexto?.mes,
    grupoProduto: contexto?.grupoProduto ?? filtros.grupoProduto,
    subgrupo1: contexto?.subgrupo1 ?? filtros.subgrupo1,
    subgrupo2: contexto?.subgrupo2 ?? filtros.subgrupo2,
    vendedor: contexto?.vendedor ?? filtros.vendedor,
    regiao: contexto?.regiao ?? filtros.regiao,
    uf: contexto?.uf ?? filtros.uf,
    municipio: contexto?.municipio ?? filtros.municipio,
    cliente: contexto?.cliente ?? filtros.cliente,
    codigoProduto: contexto?.codigoProduto,
    pd: contexto?.pd ?? filtros.pd,
  });
  return apiJson<HistoricoVendasSerieFatiaResp>(`/api/comercial/historico-vendas/serie-fatia${qs ? `?${qs}` : ''}`);
}
