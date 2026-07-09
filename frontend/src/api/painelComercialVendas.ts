import { apiJson } from './client';

export type ComparacaoBase = 'periodo_anterior' | 'ano_anterior';

export type DrillDim = 'mes' | 'grupo' | 'subgrupo1' | 'subgrupo2' | 'vendedor' | 'regiao' | 'uf' | 'municipio' | 'produto' | 'cliente';

export interface FiltrosPainelComercialVendas {
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

export interface VendaPainelRow {
  pdId: number;
  pdCodigo: string;
  dataEmissao: string;
  mes: string;
  cliente: string;
  vendedor: string;
  uf: string;
  municipio: string;
  regiao: string;
  codigoProduto: string;
  descricaoProduto: string;
  grupoProduto: string;
  subgrupo1: string;
  subgrupo2: string;
  qtdeVendida: number;
  valorVendido: number;
}

export interface PainelComercialVendasAnalytics {
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
  serieMensal: { mes: string; valor: number; qtde: number; pedidos: number }[];
  topGrupos: { key: string; label: string; valor: number; qtde: number; pedidos: number; valorVarPct?: number | null }[];
  topSubgrupo1: { key: string; label: string; valor: number; qtde: number; pedidos: number; valorVarPct?: number | null }[];
  topVendedores: { key: string; label: string; valor: number; qtde: number; pedidos: number; valorVarPct?: number | null }[];
  topRegioes: { key: string; label: string; valor: number; qtde: number; pedidos: number; valorVarPct?: number | null }[];
  mixGrupos: { grupoProduto: string; valor: number; pct: number }[];
  ganhadores: { codigoProduto: string; descricaoProduto: string; grupoProduto: string; valor: number; valorBase: number; valorVarPct: number | null }[];
  perdedores: { codigoProduto: string; descricaoProduto: string; grupoProduto: string; valor: number; valorBase: number; valorVarPct: number | null }[];
  erro?: string;
}

export interface PainelComercialVendasDrillResp {
  items: { key: string; label: string; valor: number; qtde: number; pedidos: number }[];
}

export interface PainelComercialVendasDetalheResp {
  rows: VendaPainelRow[];
}

function toQs(f: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    const s = String(v ?? '').trim();
    if (s) qs.set(k, s);
  }
  return qs.toString();
}

export async function obterPainelComercialVendasAnalytics(filtros: FiltrosPainelComercialVendas): Promise<PainelComercialVendasAnalytics> {
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
  return apiJson<PainelComercialVendasAnalytics>(`/api/comercial/painel-vendas/analytics${qs ? `?${qs}` : ''}`);
}

export async function obterPainelComercialVendasDrill(
  filtros: FiltrosPainelComercialVendas,
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
): Promise<PainelComercialVendasDrillResp> {
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
  return apiJson<PainelComercialVendasDrillResp>(`/api/comercial/painel-vendas/drill${qs ? `?${qs}` : ''}`);
}

export async function listarPainelComercialVendasDetalhe(
  filtros: FiltrosPainelComercialVendas,
  params?: {
    dim?: DrillDim;
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
): Promise<PainelComercialVendasDetalheResp> {
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
    dim: params?.dim,
    mes: params?.mes,
    grupoProduto: params?.grupoProduto,
    subgrupo1: params?.subgrupo1,
    subgrupo2: params?.subgrupo2,
    vendedor: params?.vendedor,
    regiao: params?.regiao,
    uf: params?.uf,
    municipio: params?.municipio,
    cliente: params?.cliente,
    codigoProduto: params?.codigoProduto,
    pd: params?.pd,
  });
  return apiJson<PainelComercialVendasDetalheResp>(`/api/comercial/painel-vendas/detalhe${qs ? `?${qs}` : ''}`);
}

