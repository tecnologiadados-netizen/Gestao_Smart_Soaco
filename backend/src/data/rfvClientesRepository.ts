/**
 * Classificação RFV de clientes — leitura Nomus (MySQL) via base do Histórico de Vendas.
 */

import {
  carregarHistoricoVendasBasePeriodo,
  extrairOpcoesFiltroHistorico,
  normalizeEmissaoYmd,
  periodoDadosEmissao,
  type FiltrosHistoricoVendas,
  type VendaHistoricoRow,
  validarPeriodoMaximo,
} from './historicoVendasRepository.js';
import {
  RFV_SEGMENTOS,
  classificarSegmentoRfv,
  fvScoreFrom,
  labelSegmento,
} from './rfvSegmentos.js';

export type FiltrosRfvClientes = FiltrosHistoricoVendas;

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

export interface RfvClientesAnalyticsDto {
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

type ClienteRfvBase = {
  cliente: string;
  recenciaDias: number;
  frequencia: number;
  valor: number;
  ultimaEmissao: string;
  municipio: string;
  vendedor: string;
};

function media(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function scoreQuintilPorOrdem(
  itens: ClienteRfvBase[],
  getMetric: (it: ClienteRfvBase) => number,
  sortAsc: boolean
): Map<string, number> {
  const sorted = [...itens].sort((a, b) => {
    const va = getMetric(a);
    const vb = getMetric(b);
    return sortAsc ? va - vb : vb - va;
  });
  const n = sorted.length;
  const out = new Map<string, number>();
  if (n === 0) return out;
  for (let idx = 0; idx < n; idx++) {
    const score = Math.max(1, Math.min(5, 5 - Math.floor((idx * 5) / n)));
    out.set(sorted[idx]!.cliente, score);
  }
  return out;
}

function buildDistribuicao(
  clientes: RfvClienteItem[],
  getScore: (c: RfvClienteItem) => number
): RfvDistribuicaoItem[] {
  const byScore = new Map<number, { clientes: number; valor: number }>();
  for (let s = 1; s <= 5; s++) byScore.set(s, { clientes: 0, valor: 0 });
  for (const c of clientes) {
    const s = getScore(c);
    const cur = byScore.get(s)!;
    cur.clientes += 1;
    cur.valor += c.valor;
  }
  return [...byScore.entries()].map(([score, v]) => ({ score, clientes: v.clientes, valor: v.valor }));
}

function ymdToMs(ymd: string): number {
  return new Date(`${ymd}T12:00:00`).getTime();
}

function aplicarFiltrosDimensionais(rows: VendaHistoricoRow[], filtros: FiltrosRfvClientes): VendaHistoricoRow[] {
  const { matchFiltro } = {
    matchFiltro(valor: string, filtro: string | undefined, mode: 'eq' | 'includes'): boolean {
      const raw = String(filtro ?? '').trim();
      if (!raw) return true;
      const norm = (x: string) => x.trim().toLowerCase();
      const eq = (a: string, b: string) => norm(a) === norm(b);
      const includes = (a: string, b: string) => norm(a).includes(norm(b));
      const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length === 0) return true;
      if (parts.length === 1) {
        const p = parts[0]!;
        return mode === 'eq' ? eq(valor, p) : includes(valor, p);
      }
      return parts.some((p) => eq(valor, p));
    },
  };
  return rows.filter((r) => {
    if (!matchFiltro(r.grupoProduto, filtros.grupoProduto, 'includes')) return false;
    if (!matchFiltro(r.subgrupo1, filtros.subgrupo1, 'includes')) return false;
    if (!matchFiltro(r.subgrupo2, filtros.subgrupo2, 'includes')) return false;
    if (!matchFiltro(r.vendedor, filtros.vendedor, 'includes')) return false;
    if (!matchFiltro(r.regiao, filtros.regiao, 'includes')) return false;
    if (!matchFiltro(r.uf, filtros.uf, 'eq')) return false;
    if (!matchFiltro(r.municipio, filtros.municipio, 'includes')) return false;
    if (!matchFiltro(r.cliente, filtros.cliente, 'includes')) return false;
    if (
      filtros.produto &&
      !matchFiltro(r.codigoProduto, filtros.produto, 'includes') &&
      !matchFiltro(r.descricaoProduto, filtros.produto, 'includes')
    ) {
      return false;
    }
    if (filtros.pd && !matchFiltro(r.pdCodigo, filtros.pd, 'includes')) return false;
    return true;
  });
}

function emptyAnalytics(filtros: FiltrosRfvClientes): RfvClientesAnalyticsDto {
  const matrizCelulas: RfvMatrizCelula[] = [];
  for (let r = 1; r <= 5; r++) {
    for (let fv = 1; fv <= 5; fv++) {
      matrizCelulas.push({ rScore: r, fvScore: fv, clientes: 0, valor: 0, segmentoDominante: 'outros' });
    }
  }
  return {
    filtros,
    periodoDados: null,
    opcoes: { municipios: [], ufs: [], vendedores: [], regioes: [], gruposProduto: [] },
    resumo: {
      totalClientes: 0,
      faturamentoPeriodo: 0,
      recenciaMediaDias: 0,
      frequenciaMedia: 0,
      valorMedioCliente: 0,
    },
    distribuicao: {
      recencia: [1, 2, 3, 4, 5].map((score) => ({ score, clientes: 0, valor: 0 })),
      frequencia: [1, 2, 3, 4, 5].map((score) => ({ score, clientes: 0, valor: 0 })),
      valor: [1, 2, 3, 4, 5].map((score) => ({ score, clientes: 0, valor: 0 })),
    },
    segmentos: RFV_SEGMENTOS.map((s) => ({
      id: s.id,
      label: s.label,
      clientes: 0,
      valor: 0,
      pctClientes: 0,
      pctValor: 0,
    })),
    matrizCelulas,
    clientes: [],
  };
}

function calcularRfvCompleto(rows: VendaHistoricoRow[], dataFim: string): Omit<RfvClientesAnalyticsDto, 'filtros' | 'erro'> {
  const empty = emptyAnalytics({ dataIni: '', dataFim: '' });
  if (!rows.length) return empty;

  const fim = new Date(`${dataFim}T12:00:00`);
  const fimMs = Number.isNaN(fim.getTime()) ? Date.now() : fim.getTime();

  const porCliente = new Map<
    string,
    {
      ultimoMs: number;
      ultimaEmissao: string;
      pds: Set<number>;
      valor: number;
      municipio: string;
      vendedor: string;
    }
  >();

  for (const r of rows) {
    const cliente = (r.cliente || '—').trim() || '—';
    const cur = porCliente.get(cliente) ?? {
      ultimoMs: 0,
      ultimaEmissao: '',
      pds: new Set<number>(),
      valor: 0,
      municipio: r.municipio,
      vendedor: r.vendedor,
    };
    const ymd = normalizeEmissaoYmd(r.dataEmissao);
    if (ymd) {
      const em = ymdToMs(ymd);
      if (Number.isFinite(em) && em >= cur.ultimoMs) {
        cur.ultimoMs = em;
        cur.ultimaEmissao = ymd;
        cur.municipio = r.municipio;
        cur.vendedor = r.vendedor;
      }
    }
    if (r.pdId > 0) cur.pds.add(r.pdId);
    cur.valor += r.valorVendido;
    porCliente.set(cliente, cur);
  }

  const itens: ClienteRfvBase[] = [...porCliente.entries()].map(([cliente, v]) => {
    const recenciaDias =
      v.ultimoMs > 0
        ? Math.floor(Math.max(0, fimMs - v.ultimoMs) / (24 * 60 * 60 * 1000))
        : 0;
    return {
      cliente,
      recenciaDias,
      frequencia: Math.max(0, v.pds.size),
      valor: v.valor,
      ultimaEmissao: v.ultimaEmissao,
      municipio: v.municipio,
      vendedor: v.vendedor,
    };
  });

  const scoreR = scoreQuintilPorOrdem(itens, (x) => x.recenciaDias, true);
  const scoreF = scoreQuintilPorOrdem(itens, (x) => x.frequencia, false);
  const scoreV = scoreQuintilPorOrdem(itens, (x) => x.valor, false);

  const clientes: RfvClienteItem[] = itens.map((it) => {
    const rScore = scoreR.get(it.cliente) ?? 1;
    const fScore = scoreF.get(it.cliente) ?? 1;
    const vScore = scoreV.get(it.cliente) ?? 1;
    const fvScore = fvScoreFrom(fScore, vScore);
    const segmentoId = classificarSegmentoRfv({ r: rScore, f: fScore, v: vScore });
    return {
      cliente: it.cliente,
      rScore,
      fScore,
      vScore,
      fvScore,
      segmentoId,
      recenciaDias: it.recenciaDias,
      frequencia: it.frequencia,
      valor: it.valor,
      ultimaEmissao: it.ultimaEmissao || '',
      municipio: it.municipio,
      vendedor: it.vendedor,
    };
  });

  const faturamentoPeriodo = rows.reduce((s, r) => s + r.valorVendido, 0);
  const totalClientes = clientes.length;

  const bySegmento = new Map<string, { clientes: number; valor: number }>();
  for (const s of RFV_SEGMENTOS) bySegmento.set(s.id, { clientes: 0, valor: 0 });
  for (const c of clientes) {
    const cur = bySegmento.get(c.segmentoId) ?? { clientes: 0, valor: 0 };
    cur.clientes += 1;
    cur.valor += c.valor;
    bySegmento.set(c.segmentoId, cur);
  }

  const segmentos: RfvSegmentoAgg[] = RFV_SEGMENTOS.map((s) => {
    const agg = bySegmento.get(s.id) ?? { clientes: 0, valor: 0 };
    return {
      id: s.id,
      label: s.label,
      clientes: agg.clientes,
      valor: agg.valor,
      pctClientes: totalClientes > 0 ? Math.round((agg.clientes / totalClientes) * 1000) / 10 : 0,
      pctValor: faturamentoPeriodo > 0 ? Math.round((agg.valor / faturamentoPeriodo) * 1000) / 10 : 0,
    };
  }).sort((a, b) => b.clientes - a.clientes || b.valor - a.valor);

  const byCelula = new Map<string, { clientes: number; valor: number; segmentos: Map<string, number> }>();
  for (const c of clientes) {
    const key = `${c.rScore}-${c.fvScore}`;
    const cur = byCelula.get(key) ?? { clientes: 0, valor: 0, segmentos: new Map<string, number>() };
    cur.clientes += 1;
    cur.valor += c.valor;
    cur.segmentos.set(c.segmentoId, (cur.segmentos.get(c.segmentoId) ?? 0) + 1);
    byCelula.set(key, cur);
  }

  const matrizCelulas: RfvMatrizCelula[] = [];
  for (let r = 1; r <= 5; r++) {
    for (let fv = 1; fv <= 5; fv++) {
      const cell = byCelula.get(`${r}-${fv}`);
      let segmentoDominante = 'outros';
      if (cell) {
        let max = 0;
        for (const [segId, count] of cell.segmentos.entries()) {
          if (count > max) {
            max = count;
            segmentoDominante = segId;
          }
        }
      }
      matrizCelulas.push({
        rScore: r,
        fvScore: fv,
        clientes: cell?.clientes ?? 0,
        valor: cell?.valor ?? 0,
        segmentoDominante,
      });
    }
  }

  return {
    resumo: {
      totalClientes,
      faturamentoPeriodo,
      recenciaMediaDias: media(clientes.map((x) => x.recenciaDias)),
      frequenciaMedia: media(clientes.map((x) => x.frequencia)),
      valorMedioCliente: totalClientes > 0 ? faturamentoPeriodo / totalClientes : 0,
    },
    distribuicao: {
      recencia: buildDistribuicao(clientes, (c) => c.rScore),
      frequencia: buildDistribuicao(clientes, (c) => c.fScore),
      valor: buildDistribuicao(clientes, (c) => c.vScore),
    },
    segmentos,
    matrizCelulas,
    clientes: clientes.sort((a, b) => b.valor - a.valor),
  };
}

export async function obterRfvClientesAnalytics(filtros: FiltrosRfvClientes): Promise<RfvClientesAnalyticsDto> {
  const empty = emptyAnalytics(filtros);
  const periodoErro = validarPeriodoMaximo(filtros.dataIni, filtros.dataFim);
  if (periodoErro) return { ...empty, erro: periodoErro };

  const loaded = await carregarHistoricoVendasBasePeriodo(filtros.dataIni, filtros.dataFim);
  if (loaded.erro) return { ...empty, erro: loaded.erro };

  const opcoes = extrairOpcoesFiltroHistorico(loaded.rows);
  const periodoDados = periodoDadosEmissao(loaded.rows);
  const rows = aplicarFiltrosDimensionais(loaded.rows, filtros);

  const calc = calcularRfvCompleto(rows, filtros.dataFim);
  return { filtros, periodoDados, opcoes, ...calc };
}

export { labelSegmento, calcularRfvCompleto };
