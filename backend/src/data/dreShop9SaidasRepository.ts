/**
 * DRE — saídas Shop9 (Financeiro_Contas por competência).
 * Só Aço, Só Refrigeração (filial 1) e R N Marques (filial 1 + CC ou filial 6).
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getShop9Pool, isShop9Enabled } from '../config/shop9Db.js';
import {
  empresasComSaidasShop9Dre,
  filiaisShop9SaidasDre,
  filtrarPorEmpresasSaidasShop9Dre,
  DRE_SHOP9_SAIDAS_EMPRESAS,
  SHOP9_FILIAL_RN_MARQUES_DRE,
  type Shop9LinhaEmpresa,
} from './dfcShop9Empresa.js';
import { formatSqlDateYmd } from './dfcDateUtils.js';
import { resolverPathKeyDreSaidasShop9 } from './drePlanoContasMap.js';
import { resolverPathKeyInssPoolAgregacao } from './dreInssRateio.js';
import type { DreSaidasSoAcoAgregado, DreSaidasSoAcoNaoMapeado } from './dreSaidasSoAcoRepository.js';
import {
  limparNomePlanoShop9Dre,
  deduplicarLinhasShop9SaidasDre,
  ehPlanoSimplesNacionalShop9Dre,
} from './dreShop9SaidasUtils.js';
import type { DfcAgendamentoDetalheRow, DfcAgendamentoGranularidade } from './dfcAgendamentoRepository.js';
import {
  labelEmpresaDfc,
  resolverIdEmpresaShop9SaidasDre,
} from './dfcShop9Empresa.js';
import { linhaPassaFornecedoresRateio } from '../utils/dreRateioFornecedorMatch.js';
import { listarOrdensShop9PorPathKeyDre } from './dreRelacaoPcRepository.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SQL_DRE_SHOP9 = readFileSync(join(__dirname, 'sql', 'dreShop9SaidasSoAco.sql'), 'utf-8');
const SQL_FORNECEDOR_OPCOES_RATEIO = readFileSync(
  join(__dirname, 'sql', 'dreShop9FornecedorOpcoesRateio.sql'),
  'utf-8',
);

export type DreShop9SaidaRow = Shop9LinhaEmpresa & {
  ordem: number;
  ordemPlanoContas3: number | null;
  dataCompetencia: string | null;
  dataVencimento: string | null;
  dataQuitacao: string | null;
  descricaoLancamento: string | null;
  nomeCliFor: string | null;
  nomePlanoContas: string;
  valorBase: number;
};

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown): number {
  const n = Math.trunc(toNum(v));
  return Number.isFinite(n) ? n : 0;
}

function aplicarSql(dataInicio: string, dataFim: string, ordensFilial: number[]): string {
  const inFilial = ordensFilial.join(', ');
  return SQL_DRE_SHOP9.replace(/\{\{DATA_COMPETENCIA_MIN\}\}/g, dataInicio)
    .replace(/\{\{DATA_COMPETENCIA_MAX\}\}/g, dataFim)
    .replace(/\{\{ORDEM_FILIAL_IN\}\}/g, inFilial);
}

function aplicarSqlFornecedorOpcoesRateio(ordensFilial: number[], ordensPlano: number[]): string | null {
  if (ordensFilial.length === 0 || ordensPlano.length === 0) return null;
  return SQL_FORNECEDOR_OPCOES_RATEIO.replace(/\{\{ORDEM_FILIAL_IN\}\}/g, ordensFilial.join(', ')).replace(
    /\{\{ORDEM_PLANO_IN\}\}/g,
    ordensPlano.join(', '),
  );
}

function mapRawRow(r: Record<string, unknown>): DreShop9SaidaRow {
  const nomeRaw = String(r.NomePlanoContas ?? r.nomePlanoContas ?? '').trim();
  return {
    ordem: toInt(r.ordem ?? r.Ordem),
    ordemFilial: toInt(r.Ordem_Filial ?? r.ordemFilial) || null,
    empresa: r.empresa != null ? String(r.empresa) : null,
    nomeFilial: r.nomeFilial != null ? String(r.nomeFilial) : null,
    centrocusto: r.centrocusto != null ? String(r.centrocusto) : null,
    ordemPlanoContas3: toInt(r.Ordem_Plano_Contas3 ?? r.ordemPlanoContas3) || null,
    dataCompetencia: formatSqlDateYmd(r.Data_Competencia ?? r.dataCompetencia),
    dataVencimento: formatSqlDateYmd(r.Data_Vencimento ?? r.dataVencimento),
    dataQuitacao: formatSqlDateYmd(r.Data_Quitacao ?? r.dataQuitacao),
    descricaoLancamento: r.DescricaoLancamento != null ? String(r.DescricaoLancamento).trim() || null : null,
    nomeCliFor: r.NomeCliFor != null ? String(r.NomeCliFor).trim() || null : null,
    nomePlanoContas: limparNomePlanoShop9Dre(nomeRaw),
    valorBase: toNum(r.Valor_Base ?? r.valorBase),
  };
}

function periodoFromYmd(ymd: string, granularidade: DfcAgendamentoGranularidade): string {
  return granularidade === 'mes' ? ymd.slice(0, 7) : ymd;
}

export function agregarLinhasShop9SaidasDre(
  rows: DreShop9SaidaRow[],
  granularidade: 'dia' | 'mes',
): {
  linhas: DreSaidasSoAcoAgregado[];
  naoMapeados: DreSaidasSoAcoNaoMapeado[];
  totalBruto: number;
  totalMapeado: number;
  idsPorPathKeyShop9: Record<string, number[]>;
  /** Simples Nacional (4.14) direto na filial 6 — somado ao rateio RN no frontend. */
  simplesNacionalFilial6PorPeriodo: Record<string, number>;
} {
  const agregado = new Map<string, number>();
  const naoMap = new Map<string, DreSaidasSoAcoNaoMapeado>();
  const idsPorPathKey = new Map<string, Set<number>>();
  const simplesNacionalFilial6PorPeriodo: Record<string, number> = {};
  let totalBruto = 0;
  let totalMapeado = 0;

  for (const row of rows) {
    const valor = Math.abs(row.valorBase);
    if (valor <= 0) continue;
    totalBruto += valor;

    const ymd = row.dataCompetencia;
    if (!ymd) continue;
    const periodo = granularidade === 'mes' ? ymd.slice(0, 7) : ymd;

    const nomePlano = row.nomePlanoContas.trim();
    const pathKeyInss = resolverPathKeyInssPoolAgregacao(nomePlano, row.ordemPlanoContas3);
    const pathKey = pathKeyInss ?? resolverPathKeyDreSaidasShop9(row.ordemPlanoContas3, nomePlano);

    if (!pathKey) {
      const k = `${row.ordemPlanoContas3 ?? 0}\t${nomePlano}`;
      const cur = naoMap.get(k) ?? {
        idContaFinanceiro: row.ordemPlanoContas3,
        nomePlanoFinanceiro: nomePlano || '(sem nome)',
        valor: 0,
        quantidade: 0,
      };
      cur.valor += valor;
      cur.quantidade += 1;
      naoMap.set(k, cur);
      continue;
    }

    totalMapeado += valor;
    const aggKey = `${pathKey}\t${periodo}`;
    agregado.set(aggKey, (agregado.get(aggKey) ?? 0) + valor);

    if (
      ehPlanoSimplesNacionalShop9Dre(nomePlano) &&
      row.ordemFilial === SHOP9_FILIAL_RN_MARQUES_DRE
    ) {
      simplesNacionalFilial6PorPeriodo[periodo] =
        Math.round(((simplesNacionalFilial6PorPeriodo[periodo] ?? 0) + valor) * 100) / 100;
    }

    if (row.ordemPlanoContas3 != null && row.ordemPlanoContas3 > 0) {
      const set = idsPorPathKey.get(pathKey) ?? new Set<number>();
      set.add(row.ordemPlanoContas3);
      idsPorPathKey.set(pathKey, set);
    }
  }

  const linhas: DreSaidasSoAcoAgregado[] = [...agregado.entries()].map(([k, valor]) => {
    const [pathKey, periodo] = k.split('\t');
    return { pathKey: pathKey!, periodo: periodo!, valor: Math.round(valor * 100) / 100 };
  });

  const idsPorPathKeyShop9: Record<string, number[]> = {};
  for (const [pk, set] of idsPorPathKey) {
    idsPorPathKeyShop9[pk] = [...set].sort((a, b) => a - b);
  }

  return {
    linhas,
    naoMapeados: [...naoMap.values()].sort((a, b) => b.valor - a.valor),
    totalBruto,
    totalMapeado,
    idsPorPathKeyShop9,
    simplesNacionalFilial6PorPeriodo,
  };
}

/** Nomes distintos de fornecedores Shop9 na conta DRE (histórico, todas filiais DRE). */
export async function queryDreShop9FornecedorOpcoesRateio(pathKey: string): Promise<{
  nomes: string[];
  erro?: string;
}> {
  const pk = pathKey.trim();
  if (!pk) return { nomes: [] };

  const ordensPlano = await listarOrdensShop9PorPathKeyDre(pk);
  if (ordensPlano.length === 0) return { nomes: [] };

  if (!isShop9Enabled()) {
    return { nomes: [], erro: 'Shop9: SHOP9_DB_* não configurado' };
  }

  const filiais = filiaisShop9SaidasDre([...DRE_SHOP9_SAIDAS_EMPRESAS]);
  const sql = aplicarSqlFornecedorOpcoesRateio(filiais, ordensPlano);
  if (!sql) return { nomes: [] };

  const pool = await getShop9Pool();
  if (!pool) {
    return { nomes: [], erro: 'Shop9: falha ao conectar' };
  }

  try {
    const result = await pool.query(sql);
    const list = Array.isArray(result.recordset) ? result.recordset : [];
    const nomes = list
      .map((r) => {
        const row = r as Record<string, unknown>;
        return row.nomeCliFor != null ? String(row.nomeCliFor).trim() : '';
      })
      .filter((n) => n.length > 0);
    return { nomes: [...new Set(nomes)].sort((a, b) => a.localeCompare(b, 'pt-BR')) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { nomes: [], erro: msg };
  }
}

/** Soma por período dos fornecedores rateados em conta DRE no Shop9 (mesma regra da grade). */
export async function queryDreShop9RateioFornecedorTotais(params: {
  dataInicio: string;
  dataFim: string;
  granularidade: DfcAgendamentoGranularidade;
  idEmpresas?: number[];
  pathKey: string;
  nomesFornecedor: string[];
  poolRateio?: boolean;
}): Promise<{ totaisPorPeriodo: Record<string, number>; erro?: string }> {
  const nomes = [...new Set(params.nomesFornecedor.map((n) => n.trim()).filter(Boolean))];
  if (nomes.length === 0) return { totaisPorPeriodo: {} };

  const pathKey = params.pathKey.trim();
  if (!pathKey) return { totaisPorPeriodo: {} };

  const idEmpresasShop9 = params.poolRateio
    ? [...DRE_SHOP9_SAIDAS_EMPRESAS]
    : empresasComSaidasShop9Dre(params.idEmpresas ?? [...DRE_SHOP9_SAIDAS_EMPRESAS]);
  if (!idEmpresasShop9.length) return { totaisPorPeriodo: {} };

  if (!isShop9Enabled()) {
    return { totaisPorPeriodo: {}, erro: 'Shop9: SHOP9_DB_* não configurado' };
  }

  const filiais = filiaisShop9SaidasDre(idEmpresasShop9);
  if (!filiais.length) return { totaisPorPeriodo: {} };

  const pool = await getShop9Pool();
  if (!pool) {
    return { totaisPorPeriodo: {}, erro: 'Shop9: falha ao conectar' };
  }

  try {
    const result = await pool.query(aplicarSql(params.dataInicio, params.dataFim, filiais));
    const list = Array.isArray(result.recordset) ? result.recordset : [];
    const rowsBrutas = list.map((r) => mapRawRow(r as Record<string, unknown>));
    const rowsFiltradas = params.poolRateio
      ? rowsBrutas
      : filtrarPorEmpresasSaidasShop9Dre(rowsBrutas, idEmpresasShop9);
    const rows = deduplicarLinhasShop9SaidasDre(rowsFiltradas);

    const totais = new Map<string, number>();
    for (const row of rows) {
      const pk = resolverPathKeyDreSaidasShop9(row.ordemPlanoContas3, row.nomePlanoContas);
      if (pk !== pathKey) continue;

      if (!linhaPassaFornecedoresRateio(row.nomeCliFor, nomes)) continue;

      const valor = Math.abs(row.valorBase);
      if (valor <= 0) continue;

      const ymd = row.dataCompetencia;
      if (!ymd || ymd < params.dataInicio || ymd > params.dataFim) continue;

      const periodo = periodoFromYmd(ymd, params.granularidade);
      totais.set(periodo, (totais.get(periodo) ?? 0) + valor);
    }

    const totaisPorPeriodo: Record<string, number> = {};
    for (const [p, v] of totais.entries()) {
      totaisPorPeriodo[p] = Math.round(v * 100) / 100;
    }
    return { totaisPorPeriodo };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { totaisPorPeriodo: {}, erro: msg };
  }
}

/**
 * Carrega saídas DRE no Shop9 — Só Aço, Só Refrigeração (filial 1) e R N Marques (filial 1 + filial 6).
 */
export async function carregarSaidasShop9SoAcoDre(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresas: number[];
  granularidade?: 'dia' | 'mes';
}): Promise<{
  linhas: DreSaidasSoAcoAgregado[];
  naoMapeados: DreSaidasSoAcoNaoMapeado[];
  totalBruto: number;
  totalMapeado: number;
  idsPorPathKeyShop9: Record<string, number[]>;
  simplesNacionalFilial6PorPeriodo: Record<string, number>;
  erro?: string;
  usado: boolean;
}> {
  const vazio = {
    linhas: [] as DreSaidasSoAcoAgregado[],
    naoMapeados: [] as DreSaidasSoAcoNaoMapeado[],
    totalBruto: 0,
    totalMapeado: 0,
    idsPorPathKeyShop9: {} as Record<string, number[]>,
    simplesNacionalFilial6PorPeriodo: {} as Record<string, number>,
    usado: false,
  };

  const idEmpresasShop9 = empresasComSaidasShop9Dre(params.idEmpresas);
  if (!idEmpresasShop9.length) {
    return vazio;
  }
  if (!isShop9Enabled()) {
    return { ...vazio, erro: 'Shop9: SHOP9_DB_* não configurado (saídas DRE)' };
  }

  const filiais = filiaisShop9SaidasDre(idEmpresasShop9);
  if (!filiais.length) {
    return vazio;
  }

  const pool = await getShop9Pool();
  if (!pool) {
    return { ...vazio, erro: 'Shop9: falha ao conectar (saídas DRE)' };
  }

  try {
    const result = await pool.query(aplicarSql(params.dataInicio, params.dataFim, filiais));
    const list = Array.isArray(result.recordset) ? result.recordset : [];
    const rowsBrutas = list.map((r) => mapRawRow(r as Record<string, unknown>));
    const rowsFiltradas = filtrarPorEmpresasSaidasShop9Dre(rowsBrutas, idEmpresasShop9);
    const rows = deduplicarLinhasShop9SaidasDre(rowsFiltradas);
    const granularidade = params.granularidade ?? 'mes';
    const agg = agregarLinhasShop9SaidasDre(rows, granularidade);
    return { ...agg, usado: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[dreShop9SaidasRepository]', msg);
    return { ...vazio, erro: msg };
  }
}

const MAX_DETALHE_DRE_SHOP9 = 2000;

/**
 * Detalhe DRE Shop9 — mesma base da grade (competência + Ordem_Plano_Contas3).
 */
export async function queryDreShop9SaidasDetalhe(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresas: number[];
  idsPlanoContas3: number[];
  granularidade: DfcAgendamentoGranularidade;
  periodoBucket?: string | null;
}): Promise<{ detalhes: DfcAgendamentoDetalheRow[]; erro?: string }> {
  const idsSet = new Set(params.idsPlanoContas3.filter((n) => n > 0));
  if (idsSet.size === 0) return { detalhes: [] };

  const idEmpresasShop9 = empresasComSaidasShop9Dre(params.idEmpresas);
  if (!idEmpresasShop9.length) return { detalhes: [] };
  if (!isShop9Enabled()) {
    return { detalhes: [], erro: 'Shop9: SHOP9_DB_* não configurado (detalhe DRE)' };
  }

  const filiais = filiaisShop9SaidasDre(idEmpresasShop9);
  if (!filiais.length) return { detalhes: [] };

  const pool = await getShop9Pool();
  if (!pool) {
    return { detalhes: [], erro: 'Shop9: falha ao conectar (detalhe DRE)' };
  }

  try {
    const result = await pool.query(
      aplicarSql(params.dataInicio, params.dataFim, filiais),
    );
    const list = Array.isArray(result.recordset) ? result.recordset : [];
    const rowsBrutas = list.map((r) => mapRawRow(r as Record<string, unknown>));
    const rowsFiltradas = filtrarPorEmpresasSaidasShop9Dre(rowsBrutas, idEmpresasShop9);
    const rows = deduplicarLinhasShop9SaidasDre(rowsFiltradas);
    const detalhes: DfcAgendamentoDetalheRow[] = [];
    const ordensVistas = new Set<number>();

    for (const row of rows) {
      const idPlano = row.ordemPlanoContas3;
      if (idPlano == null || !idsSet.has(idPlano)) continue;

      const valor = Math.abs(row.valorBase);
      if (valor <= 0) continue;

      if (row.ordem > 0 && ordensVistas.has(row.ordem)) continue;

      const ymd = row.dataCompetencia;
      if (!ymd || ymd < params.dataInicio || ymd > params.dataFim) continue;

      const periodo = periodoFromYmd(ymd, params.granularidade);
      if (params.periodoBucket && periodo !== params.periodoBucket) continue;

      const idEmpresa = resolverIdEmpresaShop9SaidasDre(row) ?? 0;
      const descricao =
        row.descricaoLancamento?.trim() ||
        row.nomePlanoContas?.trim() ||
        null;

      detalhes.push({
        id: row.ordem,
        descricaoLancamento: descricao,
        nome: row.nomeCliFor,
        dataVencimento: row.dataVencimento,
        dataBaixa: row.dataQuitacao,
        dataCompetencia: ymd,
        valorBaixado: Math.round(valor * 100) / 100,
        tipoRef: 'A',
        idEmpresa,
        idContaFinanceiro: idPlano,
        empresa: idEmpresa > 0 ? labelEmpresaDfc(idEmpresa) : row.empresa,
      });
      if (row.ordem > 0) ordensVistas.add(row.ordem);
    }

    detalhes.sort((a, b) => b.valorBaixado - a.valorBaixado);
    return { detalhes: detalhes.slice(0, MAX_DETALHE_DRE_SHOP9) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[queryDreShop9SaidasDetalhe]', msg);
    return { detalhes: [], erro: msg };
  }
}
