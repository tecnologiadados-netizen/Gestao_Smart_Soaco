import { apiJson } from './client';

export interface FiltrosRfvClientes {
  dataIni: string;
  dataFim: string;
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

export interface RfvDistribuicaoItem {
  score: number;
  clientes: number;
  valor: number;
}

export interface RfvSegmentoAgg {
  id: string;
  label: string;
  clientes: number;
  valor: number;
  pctClientes: number;
  pctValor: number;
}

export interface RfvMatrizCelula {
  rScore: number;
  fvScore: number;
  clientes: number;
  valor: number;
  segmentoDominante: string;
}

export interface RfvClienteItem {
  cliente: string;
  rScore: number;
  fScore: number;
  vScore: number;
  fvScore: number;
  segmentoId: string;
  recenciaDias: number;
  frequencia: number;
  valor: number;
  ultimaEmissao: string;
  municipio: string;
  vendedor: string;
}

export interface RfvOpcoesFiltro {
  municipios: string[];
  ufs: string[];
  vendedores: string[];
  regioes: string[];
  gruposProduto: string[];
}

export interface RfvClientesAnalytics {
  filtros: FiltrosRfvClientes;
  periodoDados: { dataIni: string; dataFim: string } | null;
  opcoes: RfvOpcoesFiltro;
  resumo: {
    totalClientes: number;
    faturamentoPeriodo: number;
    recenciaMediaDias: number;
    frequenciaMedia: number;
    valorMedioCliente: number;
  };
  distribuicao: {
    recencia: RfvDistribuicaoItem[];
    frequencia: RfvDistribuicaoItem[];
    valor: RfvDistribuicaoItem[];
  };
  segmentos: RfvSegmentoAgg[];
  matrizCelulas: RfvMatrizCelula[];
  clientes: RfvClienteItem[];
  erro?: string;
}

function toQs(f: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    const s = String(v ?? '').trim();
    if (s) qs.set(k, s);
  }
  return qs.toString();
}

export async function obterRfvClientesAnalytics(filtros: FiltrosRfvClientes): Promise<RfvClientesAnalytics> {
  const qs = toQs({
    dataIni: filtros.dataIni,
    dataFim: filtros.dataFim,
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
  return apiJson<RfvClientesAnalytics>(`/api/comercial/rfv/analytics${qs ? `?${qs}` : ''}`);
}
