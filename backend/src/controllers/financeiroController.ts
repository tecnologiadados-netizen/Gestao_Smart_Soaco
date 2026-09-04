import type { Request, Response } from 'express';
import {
  queryDfcAgendamentosEfetivos,
  queryDfcAgendamentosDetalhe,
  queryDfcAgendamentosProjecao,
  queryDfcAgendamentosProjecaoDetalhe,
  queryDfcDespesasPagamentoEmAberto,
  queryDfcDespesasPagamentoFornecedorOpcoes,
  type DfcAgendamentoGranularidade,
  type DfcAgendamentoDetalheRow,
  type DfcAgendamentoLinha,
  type DfcDespesaPagamentoEmAbertoRow,
} from '../data/dfcAgendamentoRepository.js';
import {
  queryDfcShop9DespesasPagamentoEmAberto,
  queryDfcShop9DespesasPagamentoFornecedorOpcoes,
} from '../data/dfcShop9Repository.js';
import { queryDfcKpis } from '../data/dfcKpisRepository.js';
import { DFC_EMPRESAS_CARGA, listarContasBancariasNoPeriodoNomus } from '../data/dfcNomusRepository.js';
import { normalizarIdsEmpresasDfc } from '../data/dfcShop9Empresa.js';
import {
  listarContasBancariasDasContribuicoes,
  queryDfcContribuicoesCompletas,
} from '../data/dfcContribuicaoRepository.js';
import {
  queryDfcLancamentosLpAgrupado,
  queryDfcLancamentosLpDetalhe,
  mergeDfcAgregadoLinhas,
  mergeDfcDetalheOrdenadoMany,
} from '../data/dfcLancamentoLpRepository.js';
import {
  queryDfcReceitasAgrupado,
  queryDfcReceitasDetalhe,
  queryDfcReceitasProjecao,
  queryDfcReceitasProjecaoDetalhe,
} from '../data/dfcReceitasRepository.js';
import {
  obterPainelComercialDashboard,
  obterItensPedidoPainelComercial,
} from '../data/painelComercialRepository.js';
import { queryDfcSaldoFaturar } from '../data/dfcSaldoFaturarRepository.js';
import {
  queryDfcProjecaoReceitasPorPeriodo,
  queryDfcProjecaoReceitasDetalhe,
} from '../data/dfcProjecaoReceitasRepository.js';
import { queryDfcSaldosBancarios } from '../data/dfcSaldosBancariosRepository.js';
import { agregarSaldosBancariosParaGrade } from '../data/dfcSaldosBancariosAgregar.js';
import { resolverContasCaixaInicialFinal } from '../data/dfcContasCaixaConstantes.js';
import {
  queryDreReceitaIndiretaBruto,
  queryDreReceitaIndiretaDetalhe,
  queryDreReceitaIndiretaLiquido,
} from '../data/dreReceitaIndiretaRepository.js';
import {
  queryDreReceitaMoveisDireto,
  queryDreReceitaMoveisDiretoDetalhe,
} from '../data/dreReceitaMoveisDiretoRepository.js';
import {
  queryDreReceitaVendasDetalhe,
  queryDreReceitaVendasProdutos,
} from '../data/dreReceitaVendasRepository.js';
import { queryDreCpvSoAco } from '../data/dreCpvSoAcoRepository.js';
import { queryDreCpvMoveisDireto } from '../data/dreCpvMoveisDiretoRepository.js';
import { queryDreDevolucoes, queryDreDevolucoesDetalhe } from '../data/dreDevolucoesRepository.js';
import { carregarSaidasSoAcoDre, queryDreNomusSaidasDetalhe, queryDreFornecedorOpcoes, queryDreRateioFornecedorTotais } from '../data/dreSaidasSoAcoRepository.js';
import { queryDreShop9SaidasDetalhe } from '../data/dreShop9SaidasRepository.js';
import { carregarReceitaRefrigeracaoShop9Dre } from '../data/dreShop9ReceitaRefrigeracaoRepository.js';
import { mapaIdsContaPorPathKeyDre } from '../data/drePlanoContasMap.js';
import {
  carregarRelacaoPc,
  resetarRelacaoPcOverrides,
  salvarRelacaoPcPathKey,
} from '../data/dreRelacaoPcRepository.js';
import {
  lerDreRateioConfig,
  salvarDreRateioConfig,
  salvarDreRateioConfigSeVazio,
} from '../data/dreRateioConfigRepository.js';
import { montarDreDashboard } from '../data/dreDashboardService.js';
import { isShop9Enabled } from '../config/shop9Db.js';
import {
  queryDfcShop9RetroAgregado,
  queryDfcShop9RetroReceitasVendas,
  queryDfcShop9ProjecaoAgregado,
  queryDfcShop9ProjecaoReceitasVendas,
  queryDfcShop9Detalhe,
  testarConexaoShop9,
} from '../data/dfcShop9Repository.js';
import {
  getPoliticaComercialPainelPorEscopo,
  mergePoliticaComercialParcial,
  parseEscopoPolitica,
  savePoliticaComercialPainelPorEscopo,
} from '../data/politicaComercialPainelRepository.js';
import { buscarClientesPoliticaComercialNomus } from '../data/politicaComercialClientesRepository.js';
import { DEFAULT_POLITICA_COMERCIAL } from '../services/painelComercialConformidade.js';
import { resolverFiltroPrioridade, type DfcPrioridadeFilterResolvido } from '../data/dfcPrioridadeFilter.js';
import { LIMITE_DETALHE_EXPORT, LIMITE_DETALHE_MODAL } from '../data/detalheLimite.js';
import { labelEmpresaDfc } from '../data/dfcShop9Empresa.js';
import {
  DFC_PRIORIDADES_VALIDAS,
  ehDfcPrioridadeValida,
  type DfcPrioridade,
} from '../data/dfcPrioridadeConstantes.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

/** Cenários não se aplicam ao realizado — desliga o filtro de prioridade nas queries retro. */
const SEM_FILTRO_CENARIOS: DfcPrioridadeFilterResolvido = {
  semFiltro: true,
  contasAprovadas: [],
  refsAfAprovadas: [],
  refsAfReprovadas: [],
  refsLfAprovadas: [],
  refsLfReprovadas: [],
};

const MAX_IDS_DETALHE = 400;
const DFC_IDS_CONTA_ENDIVIDAMENTO_BANCARIO = [314, 321, 289, 371] as const;
const DFC_LABEL_ENDIVIDAMENTO_POR_CONTA: Record<number, string> = {
  314: 'Principal de Empréstimos',
  321: 'Juros de Empréstimos',
  289: 'Dívida Bancária Principal',
  371: 'Dívida Bancária Juros',
};

/** Une despesas Nomus + Shop9 (vencido primeiro) e limita o payload. */
function mergeDespesasPagamentoEmAberto(
  nomus: DfcDespesaPagamentoEmAbertoRow[],
  shop9: DfcDespesaPagamentoEmAbertoRow[],
  limite = 3000
): DfcDespesaPagamentoEmAbertoRow[] {
  const all = [...nomus, ...shop9];
  all.sort((a, b) => {
    if (a.situacao !== b.situacao) return a.situacao === 'vencido' ? -1 : 1;
    const da = a.dataVencimento ?? '';
    const db = b.dataVencimento ?? '';
    if (da !== db) return da < db ? -1 : 1;
    return b.id - a.id;
  });
  return all.length > limite ? all.slice(0, limite) : all;
}

function parseDate(s: string): Date | null {
  if (!DATE_RE.test(s)) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function diffDaysInclusive(a: Date, b: Date): number {
  const ms = 86400000;
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((ub - ua) / ms) + 1;
}

/** Data de hoje local no formato YYYY-MM-DD (usa horário do servidor). */
function hojeYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Data de amanhã local no formato YYYY-MM-DD. */
function amanhaYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Retorna a menor das duas datas no formato YYYY-MM-DD. */
function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

/** Retorna a maior das duas datas no formato YYYY-MM-DD. */
function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

/** Parseia "idEmpresas=1,2" ou "idEmpresa=1" da query string → ids DFC normalizados (1–4). */
function parseIdEmpresas(query: Request['query']): number[] {
  const raw = String(query.idEmpresas ?? query.idEmpresa ?? '').trim();
  if (!raw) return [...DFC_EMPRESAS_CARGA];
  const ids = raw
    .split(/[,;\s]+/)
    .map((s) => Math.trunc(Number(s)))
    .filter((n) => n > 0);
  return normalizarIdsEmpresasDfc(ids.length > 0 ? ids : DFC_EMPRESAS_CARGA);
}

/** Parseia "contasBancarias=Banco A|Banco B" (nomes de contabancaria.nome). */
function parseContasBancarias(query: Request['query']): string[] {
  const raw = String(query.contasBancarias ?? '').trim();
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split('|')
        .map((s) => decodeURIComponent(s.trim()))
        .filter(Boolean),
    ),
  ];
}

/** Parseia "prioridades=1,2,4" da query → array com prioridades válidas. */
function parsePrioridades(query: Request['query']): DfcPrioridade[] {
  const raw = String(query.prioridades ?? query.prioridade ?? '').trim();
  if (!raw) return [];
  const ns = raw
    .split(/[,;\s]+/)
    .map((s) => Math.trunc(Number(s)))
    .filter((n) => Number.isFinite(n)) as number[];
  const filtered: DfcPrioridade[] = [];
  for (const n of ns) {
    if (ehDfcPrioridadeValida(n) && !filtered.includes(n)) filtered.push(n);
  }
  return filtered;
}

function parseIdsContaFinanceiroQuery(query: Request['query']): number[] {
  const multi = String(query.idsContaFinanceiro ?? '').trim();
  const single = String(query.idContaFinanceiro ?? '').trim();
  const parts = [...(multi ? multi.split(/[,;\s]+/) : []), ...(single ? [single] : [])];
  const ids = parts.map((s) => Math.trunc(Number(s))).filter((n) => Number.isFinite(n) && n > 0);
  return [...new Set(ids)];
}

/** Lista de nomes (favorecido): repetir query `fornecedor` para múltiplos. */
function parseFornecedoresNomeQuery(query: Request['query']): string[] {
  const raw = query.fornecedor;
  const arr = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  return [...new Set(arr.map((x) => String(x).trim()).filter(Boolean))];
}

void DFC_PRIORIDADES_VALIDAS; // mantido para futura validação adicional

/**
 * GET /api/financeiro/dfc/agendamentos-efetivos
 * Carga completa do período (empresas 1–4, sem filtro de conta/prioridade/empresa na query).
 * Query: dataInicio, dataFim, granularidade. Retorno: contribuicoes[] para filtro no front.
 */
export async function getDfcAgendamentosEfetivos(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const granularidadeRaw = String(req.query.granularidade ?? 'mes').trim().toLowerCase();
  const granularidade: DfcAgendamentoGranularidade =
    granularidadeRaw === 'dia' ? 'dia' : 'mes';

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }

  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Período inválido: dataFim deve ser >= dataInicio.' });
    return;
  }

  if (granularidade === 'dia' && diffDaysInclusive(dIni, dFim) > 120) {
    res.status(400).json({
      error: 'No modo diário o intervalo máximo é 120 dias. Use visão mensal ou reduza o período.',
    });
    return;
  }

  const [{ contribuicoes, erro }, saldosRes] = await Promise.all([
    queryDfcContribuicoesCompletas({
      dataInicio,
      dataFim,
      granularidade,
    }),
    queryDfcSaldosBancarios({ dataInicio, dataFim }),
  ]);
  if (erro) console.error('[getDfcAgendamentosEfetivos] carga completa:', erro);
  if (saldosRes.erro) console.error('[getDfcAgendamentosEfetivos] saldos bancários:', saldosRes.erro);

  const saldosGrade = agregarSaldosBancariosParaGrade(saldosRes.linhas, {
    dataInicio,
    dataFim,
    granularidade,
    idEmpresas: [...DFC_EMPRESAS_CARGA],
    contasBancarias: resolverContasCaixaInicialFinal([]),
  });

  res.json({
    contribuicoes,
    saldosIniciaisPorPeriodo: saldosGrade.saldosIniciais,
    saldosFinaisPorPeriodo: saldosGrade.saldosFinais,
    saldosPorConta: saldosGrade.saldosPorConta,
    contasBancariasDisponiveis: listarContasBancariasDasContribuicoes(contribuicoes),
    linhas: [],
    granularidade,
    dataInicio,
    dataFim,
    idEmpresas: [...DFC_EMPRESAS_CARGA],
    projecaoReceitasPorPeriodo: {},
    fonteFinanceiro: isShop9Enabled() ? 'shop9+nomus' : 'nomus',
    erro,
    erroSaldosBancarios: saldosRes.erro,
  });
}

/** GET /api/financeiro/dfc/shop9-status — teste de conexão (admin). */
export async function getDfcShop9Status(_req: Request, res: Response): Promise<void> {
  if (!isShop9Enabled()) {
    res.json({ habilitado: false, ok: false, erro: 'SHOP9_DB_* não configurado' });
    return;
  }
  const r = await testarConexaoShop9();
  res.json({ habilitado: true, ok: r.ok, linhas: r.linhas, erro: r.erro });
}

/**
 * GET /api/financeiro/dfc/projecao-receitas
 * Sublinha 1.1.3.1 = Saldo a Receber (Carteira) rateado por cp.regra; pai 1.1.3 = soma.
 */
export async function getDfcProjecaoReceitas(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const granularidadeRaw = String(req.query.granularidade ?? 'mes').trim().toLowerCase();
  const granularidade: DfcAgendamentoGranularidade =
    granularidadeRaw === 'dia' ? 'dia' : 'mes';
  const idEmpresas = parseIdEmpresas(req.query);

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }

  const projSaldoRes = await queryDfcProjecaoReceitasPorPeriodo({
    dataInicio,
    dataFim,
    granularidade,
    idEmpresas,
  });
  if (projSaldoRes.erro) {
    console.error('[getDfcProjecaoReceitas]', projSaldoRes.erro);
  }
  res.json({
    porPeriodo: projSaldoRes.porPeriodo,
    porSublinha: projSaldoRes.porSublinha,
    erro: projSaldoRes.erro,
  });
}

/**
 * GET /api/financeiro/dfc/saldos-bancarios
 * Saldos diários por conta (LF Nomus) até dataFim — agregação por período no front.
 */
export async function getDfcSaldosBancarios(req: Request, res: Response): Promise<void> {
  const dataFim = String(req.query.dataFim ?? '').trim();
  const dataInicio = String(req.query.dataInicio ?? '').trim();

  if (!DATE_RE.test(dataFim) || !DATE_RE.test(dataInicio)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }

  const idEmpresas =
    String(req.query.idEmpresas ?? '').trim() !== ''
      ? parseIdEmpresas(req.query)
      : [...DFC_EMPRESAS_CARGA];
  const contasBancarias = parseContasBancarias(req.query);
  const granularidadeRaw = String(req.query.granularidade ?? 'mes').trim().toLowerCase();
  const granularidade: DfcAgendamentoGranularidade =
    granularidadeRaw === 'dia' ? 'dia' : 'mes';

  const { linhas, erro } = await queryDfcSaldosBancarios({ dataInicio, dataFim });
  if (erro) console.error('[getDfcSaldosBancarios]', erro);

  const grade = agregarSaldosBancariosParaGrade(linhas, {
    dataInicio,
    dataFim,
    granularidade,
    idEmpresas: idEmpresas.length > 0 ? idEmpresas : [...DFC_EMPRESAS_CARGA],
    contasBancarias: resolverContasCaixaInicialFinal(contasBancarias),
  });

  res.json({
    saldosIniciaisPorPeriodo: grade.saldosIniciais,
    saldosFinaisPorPeriodo: grade.saldosFinais,
    saldosPorConta: grade.saldosPorConta,
    dataInicio,
    dataFim,
    granularidade,
    erro,
  });
}

/**
 * GET /api/financeiro/dfc/projecao-receitas/detalhe
 * Parcelas da projeção (Carteira / regra). Query opcional: sublinha, periodo.
 */
export async function getDfcProjecaoReceitasDetalhe(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const granularidadeRaw = String(req.query.granularidade ?? 'mes').trim().toLowerCase();
  const granularidade: DfcAgendamentoGranularidade =
    granularidadeRaw === 'dia' ? 'dia' : 'mes';
  const idEmpresas = parseIdEmpresas(req.query);
  const periodo = String(req.query.periodo ?? '').trim() || undefined;
  const sublinha = String(req.query.sublinha ?? '').trim() || undefined;

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }

  const { linhas, erro } = await queryDfcProjecaoReceitasDetalhe({
    dataInicio,
    dataFim,
    granularidade,
    idEmpresas,
    periodo,
    sublinha,
  });
  if (erro) console.error('[getDfcProjecaoReceitasDetalhe]', erro);
  res.json({ linhas, erro });
}

type CarregarDfcLancamentosArgs = {
  dataInicio: string;
  dataFim: string;
  granularidade: DfcAgendamentoGranularidade;
  idEmpresas: number[];
  contasBancarias: string[];
  idsUniq: number[];
  periodoOpt: string | null;
  prioridades: DfcPrioridade[];
  todasContas: boolean;
  limite: number | null;
  logPrefix: string;
};

async function carregarDfcLancamentosDetalhe(args: CarregarDfcLancamentosArgs): Promise<{
  detalhes: DfcAgendamentoDetalheRow[];
  truncado: boolean;
  erroFatal?: string;
}> {
  const {
    dataInicio,
    dataFim,
    granularidade,
    idEmpresas,
    contasBancarias,
    idsUniq,
    periodoOpt,
    prioridades,
    todasContas,
    limite,
    logPrefix,
  } = args;

  const hoje = hojeYmd();
  const amanha = amanhaYmd();
  const bucketEhFuturo = periodoOpt != null && periodoOpt > hoje;
  const bucketEhPassado = periodoOpt != null && periodoOpt <= hoje;
  const retroFim = minDate(dataFim, hoje);
  const temRetro = dataInicio <= retroFim && !bucketEhFuturo;
  const projInicio = maxDate(dataInicio, amanha);
  const temProj = projInicio <= dataFim && !bucketEhPassado;
  /** Receitas Nomus (conta 2 inclui hoje): mês corrente / dia de hoje ainda entram na projeção. */
  const projInicioRec = maxDate(dataInicio, hoje);
  const periodoRecPassado =
    periodoOpt != null &&
    (granularidade === 'mes' ? periodoOpt < hoje.slice(0, 7) : periodoOpt < hoje);
  const temProjRec = projInicioRec <= dataFim && !periodoRecPassado;

  const filtroCenarios = await resolverFiltroPrioridade({ prioridades, idEmpresas });
  const extra = { todasContas, limite };

  const { detalhes: detalhesLp, erro: erroLp } = await queryDfcLancamentosLpDetalhe({
    dataLancamentoInicio: dataInicio,
    dataLancamentoFim: dataFim,
    granularidade,
    idEmpresas,
    contasBancarias,
    idsContaFinanceiro: idsUniq,
    periodoBucket: periodoOpt,
    filtroPrioridade: SEM_FILTRO_CENARIOS,
    ...extra,
  });
  if (erroLp) console.error(`[${logPrefix}] LP:`, erroLp);

  let detalhesAg: DfcAgendamentoDetalheRow[] = [];
  let detalhesRec: DfcAgendamentoDetalheRow[] = [];
  let detalhesProjPg: DfcAgendamentoDetalheRow[] = [];
  let detalhesProjRec: DfcAgendamentoDetalheRow[] = [];

  const useShop9 = isShop9Enabled() && contasBancarias.length === 0;

  if (temRetro) {
    if (useShop9) {
      const { detalhes: dShop9, erro: eShop9 } = await queryDfcShop9Detalhe({
        modo: 'retro',
        dataInicio,
        dataFim: retroFim,
        granularidade,
        idEmpresas,
        idsContaFinanceiro: idsUniq,
        periodoBucket: periodoOpt,
        ...extra,
      });
      if (eShop9) console.error(`[${logPrefix}] Shop9 retrospectivo:`, eShop9);
      else detalhesAg = dShop9;
    }

    const { detalhes: dPgNomus, erro: eAg } = await queryDfcAgendamentosDetalhe({
      dataBaixaInicio: dataInicio,
      dataBaixaFim: retroFim,
      granularidade,
      idEmpresas,
      contasBancarias,
      idsContaFinanceiro: idsUniq,
      periodoBucket: periodoOpt,
      filtroPrioridade: SEM_FILTRO_CENARIOS,
      ...extra,
    });
    if (eAg) {
      if (!useShop9) return { detalhes: [], truncado: false, erroFatal: eAg };
      console.error(`[${logPrefix}] pagamentos retrospectivos Nomus:`, eAg);
    } else if (useShop9) {
      detalhesAg = [...detalhesAg, ...dPgNomus];
    } else {
      detalhesAg = dPgNomus;
    }

    const { detalhes: dRec, erro: eRec } = await queryDfcReceitasDetalhe({
      dataBaixaInicio: dataInicio,
      dataBaixaFim: retroFim,
      granularidade,
      idEmpresas,
      contasBancarias,
      idsContaFinanceiro: idsUniq,
      periodoBucket: periodoOpt,
      filtroPrioridade: SEM_FILTRO_CENARIOS,
      ...extra,
    });
    if (eRec) console.error(`[${logPrefix}] receitas retrospectivas:`, eRec);
    else detalhesRec = dRec;
  }

  if (temProj) {
    if (useShop9) {
      const { detalhes: dShop9, erro: eShop9 } = await queryDfcShop9Detalhe({
        modo: 'proj',
        dataInicio: projInicio,
        dataFim,
        granularidade,
        idEmpresas,
        idsContaFinanceiro: idsUniq,
        periodoBucket: periodoOpt,
        ...extra,
      });
      if (eShop9) console.error(`[${logPrefix}] projeção Shop9:`, eShop9);
      else detalhesProjPg = dShop9;
    }

    const { detalhes: dPgNomus, erro: ePg } = await queryDfcAgendamentosProjecaoDetalhe({
      dataVencimentoInicio: projInicio,
      dataVencimentoFim: dataFim,
      granularidade,
      idEmpresas,
      contasBancarias,
      idsContaFinanceiro: idsUniq,
      periodoBucket: periodoOpt,
      filtroPrioridade: filtroCenarios,
      ...extra,
    });
    if (ePg) console.error(`[${logPrefix}] projeção pagamentos Nomus:`, ePg);
    else if (useShop9) detalhesProjPg = [...detalhesProjPg, ...dPgNomus];
    else detalhesProjPg = dPgNomus;
  }

  if (temProjRec) {
    const { detalhes: dRec, erro: eRec } = await queryDfcReceitasProjecaoDetalhe({
      dataVencimentoInicio: projInicioRec,
      dataVencimentoFim: dataFim,
      granularidade,
      idEmpresas,
      contasBancarias,
      idsContaFinanceiro: idsUniq,
      periodoBucket: periodoOpt,
      filtroPrioridade: filtroCenarios,
      ...extra,
    });
    if (eRec) console.error(`[${logPrefix}] projeção receitas Nomus:`, eRec);
    else detalhesProjRec = dRec;
  }

  return mergeDfcDetalheOrdenadoMany(
    [detalhesAg, erroLp ? [] : detalhesLp, detalhesRec, detalhesProjPg, detalhesProjRec],
    limite,
  );
}

function validarPeriodoDfcDetalhe(
  dataInicio: string,
  dataFim: string,
  granularidade: DfcAgendamentoGranularidade,
): string | null {
  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    return 'Informe dataInicio e dataFim no formato YYYY-MM-DD.';
  }
  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    return 'Período inválido: dataFim deve ser >= dataInicio.';
  }
  if (granularidade === 'dia' && diffDaysInclusive(dIni, dFim) > 120) {
    return 'No modo diário o intervalo máximo é 120 dias. Use visão mensal ou reduza o período.';
  }
  return null;
}

/**
 * GET /api/financeiro/dfc/agendamentos-efetivos-detalhe
 * Query: dataInicio, dataFim, granularidade, idEmpresas=1,2, ids (csv de idContaFinanceiro),
 * periodo (opcional: YYYY-MM ou YYYY-MM-DD conforme granularidade; omitir = intervalo inteiro).
 */
export async function getDfcAgendamentosDetalhe(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const granularidadeRaw = String(req.query.granularidade ?? 'mes').trim().toLowerCase();
  const granularidade: DfcAgendamentoGranularidade =
    granularidadeRaw === 'dia' ? 'dia' : 'mes';
  const idEmpresas = parseIdEmpresas(req.query);
  const contasBancarias = parseContasBancarias(req.query);
  const prioridades = parsePrioridades(req.query);
  const idsRaw = String(req.query.ids ?? '').trim();
  const periodoOpt = String(req.query.periodo ?? '').trim() || null;

  const erroPeriodo = validarPeriodoDfcDetalhe(dataInicio, dataFim, granularidade);
  if (erroPeriodo) {
    res.status(400).json({ error: erroPeriodo });
    return;
  }

  const idsContaFinanceiro = idsRaw
    .split(/[,;\s]+/)
    .map((s) => Math.trunc(Number(s)))
    .filter((n) => n > 0);
  const idsUniq = [...new Set(idsContaFinanceiro)].slice(0, MAX_IDS_DETALHE);

  if (idsUniq.length === 0) {
    res.status(400).json({ error: 'Informe ao menos um id de conta (ids=1,2,3).' });
    return;
  }

  if (periodoOpt) {
    if (granularidade === 'mes' && !MONTH_RE.test(periodoOpt)) {
      res.status(400).json({ error: 'periodo no modo mensal deve ser YYYY-MM.' });
      return;
    }
    if (granularidade === 'dia' && !DATE_RE.test(periodoOpt)) {
      res.status(400).json({ error: 'periodo no modo diário deve ser YYYY-MM-DD.' });
      return;
    }
  }

  const result = await carregarDfcLancamentosDetalhe({
    dataInicio,
    dataFim,
    granularidade,
    idEmpresas,
    contasBancarias,
    idsUniq,
    periodoOpt,
    prioridades,
    todasContas: false,
    limite: LIMITE_DETALHE_MODAL,
    logPrefix: 'getDfcAgendamentosDetalhe',
  });
  if (result.erroFatal) {
    res.status(503).json({ detalhes: [], erro: result.erroFatal });
    return;
  }

  res.json({
    detalhes: result.detalhes,
    truncado: result.truncado,
    granularidade,
    dataInicio,
    dataFim,
    idEmpresas,
  });
}

/**
 * GET /api/financeiro/dfc/export/lancamentos
 * Mesma regra da grade/modal, sem o corte de 2000 linhas.
 */
export async function getDfcExportLancamentos(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const granularidadeRaw = String(req.query.granularidade ?? 'mes').trim().toLowerCase();
  const granularidade: DfcAgendamentoGranularidade =
    granularidadeRaw === 'dia' ? 'dia' : 'mes';
  const idEmpresas = parseIdEmpresas(req.query);
  const contasBancarias = parseContasBancarias(req.query);
  const prioridades = parsePrioridades(req.query);
  const idsRaw = String(req.query.ids ?? '').trim();

  const erroPeriodo = validarPeriodoDfcDetalhe(dataInicio, dataFim, granularidade);
  if (erroPeriodo) {
    res.status(400).json({ error: erroPeriodo });
    return;
  }

  const idsContaFinanceiro = idsRaw
    .split(/[,;\s]+/)
    .map((s) => Math.trunc(Number(s)))
    .filter((n) => n > 0);
  const idsUniq = [...new Set(idsContaFinanceiro)];
  const todasContas = idsUniq.length === 0;

  const result = await carregarDfcLancamentosDetalhe({
    dataInicio,
    dataFim,
    granularidade,
    idEmpresas,
    contasBancarias,
    idsUniq,
    periodoOpt: null,
    prioridades,
    todasContas,
    limite: null,
    logPrefix: 'getDfcExportLancamentos',
  });
  if (result.erroFatal) {
    res.status(503).json({ detalhes: [], erro: result.erroFatal });
    return;
  }

  const avisos: string[] = [];
  if (result.truncado) {
    avisos.push(
      `Volume extremo: o Excel foi limitado a ${LIMITE_DETALHE_EXPORT.toLocaleString('pt-BR')} lançamentos.`,
    );
  }

  res.json({
    detalhes: result.detalhes,
    truncado: result.truncado,
    avisos,
    granularidade,
    dataInicio,
    dataFim,
    idEmpresas,
  });
}

/**
 * GET /api/financeiro/dfc/contas-bancarias
 * Query: idEmpresas=1,2 — lista nomes distintos (contabancaria.nome) para o filtro da DFC.
 */
export async function getDfcContasBancarias(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const idEmpresas = parseIdEmpresas(req.query);

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }

  const { nomes, erro } = await listarContasBancariasNoPeriodoNomus({ idEmpresas, dataInicio, dataFim });
  if (erro) console.error('[getDfcContasBancarias]', erro);
  res.json({ nomes, dataInicio, dataFim, idEmpresas, erro });
}

/**
 * GET /api/financeiro/dfc/kpis
 * Query: dataInicio, dataFim (YYYY-MM-DD), idEmpresas=1,2
 * Retorna KPIs financeiros: recebimentos, pagamentos, vencidos, a vencer, saldo bancário.
 */
export async function getDfcKpis(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const idEmpresas = parseIdEmpresas(req.query);
  const prioridades = parsePrioridades(req.query);

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }

  const filtroPrioridade = await resolverFiltroPrioridade({ prioridades, idEmpresas });
  const { kpis, erro } = await queryDfcKpis({ dataInicio, dataFim, idEmpresas, filtroPrioridade });
  if (erro) {
    console.error('[getDfcKpis]', erro);
  }
  res.json({ ...kpis, idEmpresas });
}

/**
 * GET /api/financeiro/dfc/despesas-pagamento-em-aberto
 * Query: dataInicio, dataFim (YYYY-MM-DD), idEmpresas=1,2,
 * idsContaFinanceiro=1,2 ou idContaFinanceiro=? (opcional),
 * repetir ?fornecedor=nome para filtrar favorecidos.
 * Retorna agendamentos P em aberto Nomus + contas a pagar abertas Shop9
 * (vencidos + a vencer), critério alinhado aos KPIs da DFC.
 */
export async function getDfcDespesasPagamentoEmAberto(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const idEmpresas = parseIdEmpresas(req.query);
  const idsContaFinanceiro = parseIdsContaFinanceiroQuery(req.query);
  const nomesFornecedor = parseFornecedoresNomeQuery(req.query);

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }

  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Intervalo de datas inválido.' });
    return;
  }

  const filtroConta = idsContaFinanceiro.length > 0 ? idsContaFinanceiro : undefined;
  const filtroForn = nomesFornecedor.length > 0 ? nomesFornecedor : undefined;

  const [nomus, shop9] = await Promise.all([
    queryDfcDespesasPagamentoEmAberto({
      dataInicio,
      dataFim,
      idEmpresas,
      idsContaFinanceiro: filtroConta,
      nomesFornecedor: filtroForn,
    }),
    queryDfcShop9DespesasPagamentoEmAberto({
      dataInicio,
      dataFim,
      idEmpresas,
      idsContaFinanceiro: filtroConta,
      nomesFornecedor: filtroForn,
    }),
  ]);

  if (nomus.erro && shop9.erro && nomus.linhas.length === 0 && shop9.linhas.length === 0) {
    res.status(503).json({ error: nomus.erro || shop9.erro });
    return;
  }

  const linhas = mergeDespesasPagamentoEmAberto(nomus.linhas, shop9.linhas);
  const aviso =
    linhas.length === 0 ? nomus.erro || shop9.erro || undefined : undefined;
  res.json({
    linhas,
    dataInicio,
    dataFim,
    idEmpresas,
    erro: aviso,
  });
}

/**
 * GET /api/financeiro/dfc/despesas-em-aberto-fornecedor-opcoes
 * Lista distinta de favorecidos (pessoa Nomus + fornecedor Shop9) no mesmo critério de despesas em aberto.
 */
export async function getDfcDespesasPagamentoFornecedorOpcoes(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const idEmpresas = parseIdEmpresas(req.query);

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }

  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Intervalo de datas inválido.' });
    return;
  }

  const [nomus, shop9] = await Promise.all([
    queryDfcDespesasPagamentoFornecedorOpcoes({ dataInicio, dataFim, idEmpresas }),
    queryDfcShop9DespesasPagamentoFornecedorOpcoes({ dataInicio, dataFim, idEmpresas }),
  ]);

  if (nomus.erro && shop9.erro && nomus.nomes.length === 0 && shop9.nomes.length === 0) {
    res.status(503).json({ error: nomus.erro || shop9.erro });
    return;
  }

  const nomes = [...new Set([...(nomus.nomes ?? []), ...(shop9.nomes ?? [])])].sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  );
  res.json({ nomes, erro: nomus.erro || shop9.erro || undefined });
}

/**
 * GET /api/financeiro/dfc/endividamento-bancario
 * Endividamento bancário em aberto (vencido + a vencer) para contas:
 * 8.2.4, 8.2.5, 12.1 e 12.2.
 */
export async function getDfcEndividamentoBancario(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const idEmpresas = parseIdEmpresas(req.query);

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }

  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Intervalo de datas inválido.' });
    return;
  }

  const { linhas, erro } = await queryDfcDespesasPagamentoEmAberto({
    dataInicio,
    dataFim,
    idEmpresas,
    idsContaFinanceiro: [...DFC_IDS_CONTA_ENDIVIDAMENTO_BANCARIO],
  });
  if (erro) {
    res.status(503).json({ error: erro });
    return;
  }

  const porFornecedorMap = new Map<string, number>();
  const porEmpresaMap = new Map<number, number>();
  const porContaMap = new Map<number, number>();
  let total = 0;
  let vencido = 0;
  let aVencer = 0;
  for (const l of linhas) {
    const valor = Number(l.saldoBaixar ?? 0);
    if (!Number.isFinite(valor) || valor <= 0) continue;
    total += valor;
    if (l.situacao === 'vencido') vencido += valor;
    else aVencer += valor;
    const forn = String(l.nome ?? '').trim() || '(sem favorecido)';
    porFornecedorMap.set(forn, (porFornecedorMap.get(forn) ?? 0) + valor);
    porEmpresaMap.set(l.idEmpresa, (porEmpresaMap.get(l.idEmpresa) ?? 0) + valor);
    if (l.idContaFinanceiro != null) {
      porContaMap.set(l.idContaFinanceiro, (porContaMap.get(l.idContaFinanceiro) ?? 0) + valor);
    }
  }

  const porFornecedor = [...porFornecedorMap.entries()]
    .map(([chave, valor]) => ({ chave, valor }))
    .sort((a, b) => b.valor - a.valor);
  const porEmpresa = [...porEmpresaMap.entries()]
    .map(([idEmpresa, valor]) => ({ idEmpresa, valor }))
    .sort((a, b) => b.valor - a.valor);
  const porConta = [...porContaMap.entries()]
    .map(([idContaFinanceiro, valor]) => ({
      idContaFinanceiro,
      conta: DFC_LABEL_ENDIVIDAMENTO_POR_CONTA[idContaFinanceiro] ?? `Conta ${idContaFinanceiro}`,
      valor,
    }))
    .sort((a, b) => b.valor - a.valor);

  res.json({
    dataInicio,
    dataFim,
    idEmpresas,
    total,
    vencido,
    aVencer,
    linhas,
    porFornecedor,
    porEmpresa,
    porConta,
  });
}

/**
 * GET /api/financeiro/dfc/saldo-faturar
 * Grade de saldo a faturar por parcela de PD (Nomus) + dataPrevisao do Gerenciador.
 */
export async function getDfcSaldoFaturar(req: Request, res: Response): Promise<void> {
  const idEmpresas = parseIdEmpresas(req.query);
  const dataEmissaoInicio = String(req.query.dataEmissaoInicio ?? '').trim() || undefined;
  const dataEmissaoFim = String(req.query.dataEmissaoFim ?? '').trim() || undefined;
  const dataVencimentoInicio = String(req.query.dataVencimentoInicio ?? '').trim() || undefined;
  const dataVencimentoFim = String(req.query.dataVencimentoFim ?? '').trim() || undefined;
  const dataPrevisaoInicio = String(req.query.dataPrevisaoInicio ?? '').trim() || undefined;
  const dataPrevisaoFim = String(req.query.dataPrevisaoFim ?? '').trim() || undefined;
  const pd = String(req.query.pd ?? '').trim() || undefined;
  const cliente = String(req.query.cliente ?? '').trim() || undefined;
  const uf = String(req.query.uf ?? '').trim() || undefined;
  const tipoPedido = String(req.query.tipoPedido ?? '').trim() || undefined;
  const pageRaw = parseInt(String(req.query.page ?? ''), 10);
  const limitRaw = parseInt(String(req.query.limit ?? ''), 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : undefined;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;

  for (const d of [dataEmissaoInicio, dataEmissaoFim, dataVencimentoInicio, dataVencimentoFim, dataPrevisaoInicio, dataPrevisaoFim]) {
    if (d && !DATE_RE.test(d)) {
      res.status(400).json({ error: 'Datas devem estar no formato YYYY-MM-DD.' });
      return;
    }
  }

  const { linhas, truncado, hasMore, page: pageOut, limit: limitOut, erro } = await queryDfcSaldoFaturar({
    idEmpresas,
    dataEmissaoInicio,
    dataEmissaoFim,
    dataVencimentoInicio,
    dataVencimentoFim,
    dataPrevisaoInicio,
    dataPrevisaoFim,
    pd,
    cliente,
    uf,
    tipoPedido,
    page,
    limit,
  });

  if (erro && linhas.length === 0) {
    res.status(503).json({ error: erro });
    return;
  }

  res.json({
    linhas,
    truncado: truncado === true,
    hasMore: hasMore === true,
    page: pageOut,
    limit: limitOut,
    idEmpresas,
    erro,
  });
}

/**
 * GET /api/financeiro/painel-comercial?dataInicio&dataFim&empresaId=todos|1|2 (YYYY-MM-DD)
 * Conformidade comercial agregada por PD (Nomus).
 */
export async function getPainelComercial(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const empresaIdRaw = String(req.query.empresaId ?? 'todos').trim().toLowerCase();
  const empresaId =
    empresaIdRaw === '1' || empresaIdRaw === '2'
      ? (Number(empresaIdRaw) as 1 | 2)
      : empresaIdRaw === 'todos' || empresaIdRaw === ''
        ? undefined
        : null;

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }
  if (empresaId === null) {
    res.status(400).json({ error: 'empresaId inválido. Use todos, 1 (Só Aço) ou 2 (Só Móveis).' });
    return;
  }

  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Intervalo de datas inválido.' });
    return;
  }

  const diff = diffDaysInclusive(dIni, dFim);
  if (diff > 400) {
    res.status(400).json({ error: 'Intervalo máximo: 400 dias.' });
    return;
  }

  const body = await obterPainelComercialDashboard(dataInicio, dataFim, empresaId);
  if (body.erro) {
    res.status(503).json({ error: body.erro });
    return;
  }
  res.json(body);
}

/**
 * GET /api/financeiro/painel-comercial/politica?escopo=industria|lojas
 * Política comercial persistida para o escopo (indústria / lojas).
 */
export async function getPoliticaComercialPainel(req: Request, res: Response): Promise<void> {
  const escopo = parseEscopoPolitica(req.query.escopo) ?? 'industria';
  const politica = await getPoliticaComercialPainelPorEscopo(escopo);
  res.json({ politica, padraoSistema: DEFAULT_POLITICA_COMERCIAL, escopo });
}

/**
 * PUT /api/financeiro/painel-comercial/politica?escopo=industria|lojas
 * Body: objeto parcial ou completo (mesmo formato de `politica` no GET).
 */
export async function putPoliticaComercialPainel(req: Request, res: Response): Promise<void> {
  const escopo =
    parseEscopoPolitica(req.query.escopo) ??
    parseEscopoPolitica((req.body as { escopo?: unknown })?.escopo) ??
    null;
  if (!escopo) {
    res.status(400).json({ error: 'Informe escopo=industria ou escopo=lojas.' });
    return;
  }
  const body = req.body && typeof req.body === 'object' ? { ...(req.body as object) } : {};
  delete (body as { escopo?: unknown }).escopo;
  const merged = mergePoliticaComercialParcial(body);
  try {
    await savePoliticaComercialPainelPorEscopo(escopo, merged);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(400).json({ error: msg });
    return;
  }
  res.json({ politica: merged, escopo });
}

/**
 * GET /api/financeiro/painel-comercial/politica/clientes?q=&limit=
 * Busca clientes Nomus (pessoa + grupo) para políticas «Outras».
 */
export async function getPoliticaComercialClientes(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? '').trim();
  const limitRaw = Number(req.query.limit ?? 50);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
  const body = await buscarClientesPoliticaComercialNomus(q, limit);
  if (body.erro) {
    res.status(503).json({ clientes: [], error: body.erro });
    return;
  }
  res.json({ clientes: body.clientes });
}

/**
 * GET /api/financeiro/painel-comercial/itens-pedido?pdId= (id numérico do pedido no Nomus)
 */
export async function getPainelComercialItensPedido(req: Request, res: Response): Promise<void> {
  const raw = String(req.query.pdId ?? '').trim();
  const pdId = Number.parseInt(raw, 10);
  if (!Number.isFinite(pdId) || pdId <= 0) {
    res.status(400).json({ error: 'Informe pdId (inteiro positivo).' });
    return;
  }
  const body = await obterItensPedidoPainelComercial(pdId);
  if (body.erro) {
    res.status(503).json({ error: body.erro, itens: [] });
    return;
  }
  res.json(body);
}

/**
 * GET /api/financeiro/dre/receita-vendas-produtos
 * Query: dataInicio, dataFim, idEmpresaSaida? (default 1)
 */
export async function getDreReceitaVendasProdutos(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const idEmpresaSaida = Math.trunc(Number(req.query.idEmpresaSaida ?? 1));

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }
  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Período inválido: dataFim deve ser >= dataInicio.' });
    return;
  }
  if (!Number.isFinite(idEmpresaSaida) || idEmpresaSaida <= 0) {
    res.status(400).json({ error: 'idEmpresaSaida inválido.' });
    return;
  }

  const { linhas, erro } = await queryDreReceitaVendasProdutos({
    dataInicio,
    dataFim,
    idEmpresaSaida,
  });
  if (erro) {
    res.status(503).json({ linhas: [], erro });
    return;
  }
  res.json({ linhas, dataInicio, dataFim, idEmpresaSaida });
}

/**
 * GET /api/financeiro/dre/receita-vendas-produtos/detalhe
 * Query: dataInicio, dataFim, idEmpresaSaida?, grupoProduto? (vazio = todos os grupos Só Aço)
 */
export async function getDreReceitaVendasDetalhe(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const idEmpresaSaida = Math.trunc(Number(req.query.idEmpresaSaida ?? 1));
  const grupoProduto = String(req.query.grupoProduto ?? '').trim();

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }
  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Período inválido: dataFim deve ser >= dataInicio.' });
    return;
  }
  if (!Number.isFinite(idEmpresaSaida) || idEmpresaSaida <= 0) {
    res.status(400).json({ error: 'idEmpresaSaida inválido.' });
    return;
  }

  const { detalhes, truncado, erro } = await queryDreReceitaVendasDetalhe({
    dataInicio,
    dataFim,
    idEmpresaSaida,
    grupoProduto: grupoProduto || undefined,
  });
  if (erro) {
    res.status(503).json({ detalhes: [], erro });
    return;
  }
  res.json({ detalhes, truncado: truncado === true, dataInicio, dataFim, grupoProduto: grupoProduto || null });
}

/**
 * GET /api/financeiro/dre/receita-indireta-produtos
 * Bruto (1.2) + líquido MKP por grupo (1.3.x).
 */
export async function getDreReceitaIndiretaProdutos(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const idEmpresaSaida = Math.trunc(Number(req.query.idEmpresaSaida ?? 1));

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }
  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Período inválido: dataFim deve ser >= dataInicio.' });
    return;
  }
  if (!Number.isFinite(idEmpresaSaida) || idEmpresaSaida <= 0) {
    res.status(400).json({ error: 'idEmpresaSaida inválido.' });
    return;
  }

  const params = { dataInicio, dataFim, idEmpresaSaida };
  const [brutoRes, liquidoRes] = await Promise.all([
    queryDreReceitaIndiretaBruto(params),
    queryDreReceitaIndiretaLiquido(params),
  ]);
  const erro = brutoRes.erro ?? liquidoRes.erro;
  if (erro) {
    res.status(503).json({ bruto: [], liquido: [], erro });
    return;
  }
  res.json({
    bruto: brutoRes.linhas,
    liquido: liquidoRes.linhas,
    dataInicio,
    dataFim,
    idEmpresaSaida,
  });
}

/**
 * GET /api/financeiro/dre/receita-indireta-produtos/detalhe
 */
export async function getDreReceitaIndiretaDetalhe(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const idEmpresaSaida = Math.trunc(Number(req.query.idEmpresaSaida ?? 1));
  const grupoProduto = String(req.query.grupoProduto ?? '').trim();

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }
  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Período inválido: dataFim deve ser >= dataInicio.' });
    return;
  }
  if (!Number.isFinite(idEmpresaSaida) || idEmpresaSaida <= 0) {
    res.status(400).json({ error: 'idEmpresaSaida inválido.' });
    return;
  }

  const { detalhes, truncado, erro } = await queryDreReceitaIndiretaDetalhe({
    dataInicio,
    dataFim,
    idEmpresaSaida,
    grupoProduto: grupoProduto || undefined,
  });
  if (erro) {
    res.status(503).json({ detalhes: [], erro });
    return;
  }
  res.json({ detalhes, truncado: truncado === true, dataInicio, dataFim, grupoProduto: grupoProduto || null });
}

/**
 * GET /api/financeiro/dre/receita-moveis-direto
 * Query: dataInicio, dataFim, idEmpresaSaida? (default 2)
 */
export async function getDreReceitaMoveisDireto(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const idEmpresaSaida = Math.trunc(Number(req.query.idEmpresaSaida ?? 2));

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }
  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Período inválido: dataFim deve ser >= dataInicio.' });
    return;
  }
  if (!Number.isFinite(idEmpresaSaida) || idEmpresaSaida <= 0) {
    res.status(400).json({ error: 'idEmpresaSaida inválido.' });
    return;
  }

  const { linhas, erro } = await queryDreReceitaMoveisDireto({
    dataInicio,
    dataFim,
    idEmpresaSaida,
  });
  if (erro) {
    res.status(503).json({ linhas: [], erro });
    return;
  }
  res.json({ linhas, dataInicio, dataFim, idEmpresaSaida });
}

/**
 * GET /api/financeiro/dre/receita-moveis-direto/detalhe
 */
export async function getDreReceitaMoveisDiretoDetalhe(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const idEmpresaSaida = Math.trunc(Number(req.query.idEmpresaSaida ?? 2));

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }
  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Período inválido: dataFim deve ser >= dataInicio.' });
    return;
  }
  if (!Number.isFinite(idEmpresaSaida) || idEmpresaSaida <= 0) {
    res.status(400).json({ error: 'idEmpresaSaida inválido.' });
    return;
  }

  const { detalhes, truncado, erro } = await queryDreReceitaMoveisDiretoDetalhe({
    dataInicio,
    dataFim,
    idEmpresaSaida,
  });
  if (erro) {
    res.status(503).json({ detalhes: [], erro });
    return;
  }
  res.json({ detalhes, truncado: truncado === true, dataInicio, dataFim });
}

/**
 * GET /api/financeiro/dre/receita-refrigeracao-shop9
 * Receita Bruta (1.5/1.6) e CMV (6.4/6.3) — Shop9 filial 1, split por vendedor.
 */
export async function getDreReceitaRefrigeracaoShop9(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const granularidade = String(req.query.granularidade ?? 'mes').trim() === 'dia' ? 'dia' : 'mes';
  const idEmpresasRaw = String(req.query.idEmpresas ?? req.query.idEmpresa ?? '3').trim();
  const idEmpresas = normalizarIdsEmpresasDfc(
    idEmpresasRaw
      .split(',')
      .map((s) => Math.trunc(Number(s.trim())))
      .filter((n) => Number.isFinite(n) && n > 0),
  );

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }
  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Período inválido: dataFim deve ser >= dataInicio.' });
    return;
  }

  const result = await carregarReceitaRefrigeracaoShop9Dre({
    dataInicio,
    dataFim,
    idEmpresas,
    granularidade,
  });
  if (result.erro && result.linhas.length === 0) {
    res.status(503).json({ ...result, error: result.erro });
    return;
  }
  res.json({
    linhas: result.linhas,
    dataInicio,
    dataFim,
    idEmpresas,
    granularidade,
    erro: result.erro,
  });
}

/**
 * GET /api/financeiro/dre/cpv-so-aco
 * CPV 6.1.1 direto · 6.1.2 indireto com MKP · 6.2.2 margem MKP (bruto − líquido).
 */
export async function getDreCpvSoAco(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const idEmpresaSaida = Math.trunc(Number(req.query.idEmpresaSaida ?? 1));

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }
  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Período inválido: dataFim deve ser >= dataInicio.' });
    return;
  }
  if (!Number.isFinite(idEmpresaSaida) || idEmpresaSaida <= 0) {
    res.status(400).json({ error: 'idEmpresaSaida inválido.' });
    return;
  }

  const { direto, indireto, indiretoSemMkp, erro } = await queryDreCpvSoAco({
    dataInicio,
    dataFim,
    idEmpresaSaida,
  });
  if (erro && direto.length === 0 && indireto.length === 0 && indiretoSemMkp.length === 0) {
    res.status(503).json({ direto: [], indireto: [], indiretoSemMkp: [], erro, error: erro });
    return;
  }
  res.json({ direto, indireto, indiretoSemMkp, dataInicio, dataFim, idEmpresaSaida, erro });
}

/**
 * GET /api/financeiro/dre/cpv-moveis-direto
 * CPV 6.2.1 Só Móveis — Nomus (entrada) + fallback Shop9 (COM SM%).
 */
export async function getDreCpvMoveisDireto(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const idEmpresaSaida = Math.trunc(Number(req.query.idEmpresaSaida ?? 2));

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }
  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Período inválido: dataFim deve ser >= dataInicio.' });
    return;
  }
  if (!Number.isFinite(idEmpresaSaida) || idEmpresaSaida <= 0) {
    res.status(400).json({ error: 'idEmpresaSaida inválido.' });
    return;
  }

  const { linhas, erro, aviso } = await queryDreCpvMoveisDireto({
    dataInicio,
    dataFim,
    idEmpresaSaida,
  });
  if (erro && linhas.length === 0) {
    res.status(503).json({ linhas: [], erro, aviso, error: erro });
    return;
  }
  res.json({ linhas, dataInicio, dataFim, idEmpresaSaida, erro, aviso });
}

/**
 * GET /api/financeiro/dre/devolucoes
 * Devoluções 2.1.1.1 (Só Aço) / 2.1.1.2 (Só Móveis) — Nomus, valorTotal por dataEmissao.
 */
export async function getDreDevolucoes(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const idEmpresas = parseIdEmpresas(req.query).filter((id) => id === 1 || id === 2);

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }
  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Período inválido: dataFim deve ser >= dataInicio.' });
    return;
  }
  if (!idEmpresas.length) {
    res.json({ linhas: [], dataInicio, dataFim, idEmpresas: [] });
    return;
  }

  const { linhas, erro } = await queryDreDevolucoes({ dataInicio, dataFim, idEmpresas });
  if (erro && linhas.length === 0) {
    res.status(503).json({ linhas: [], erro, error: erro });
    return;
  }
  res.json({ linhas, dataInicio, dataFim, idEmpresas, erro });
}

/**
 * GET /api/financeiro/dre/devolucoes/detalhe
 * Detalhe item a item das devoluções (Só Aço idEmpresa=1 / Só Móveis=2).
 */
export async function getDreDevolucoesDetalhe(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const idEmpresaEntrada = Math.trunc(Number(req.query.idEmpresa ?? req.query.idEmpresaEntrada ?? 0));

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }
  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Período inválido: dataFim deve ser >= dataInicio.' });
    return;
  }
  if (idEmpresaEntrada !== 1 && idEmpresaEntrada !== 2) {
    res.json({ detalhes: [], truncado: false, dataInicio, dataFim, idEmpresa: idEmpresaEntrada });
    return;
  }

  const { detalhes, truncado, erro } = await queryDreDevolucoesDetalhe({
    dataInicio,
    dataFim,
    idEmpresaEntrada,
  });
  if (erro) {
    res.status(503).json({ detalhes: [], erro });
    return;
  }
  res.json({ detalhes, truncado: truncado === true, dataInicio, dataFim, idEmpresa: idEmpresaEntrada });
}

/**
 * GET /api/financeiro/dre/saidas-soaco
 * Saídas SOACO (agendamentos P efetivos + lançamentos LP avulsos) por competência → pathKey na árvore DRE.
 */
export async function getDreSaidasSoAco(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const granularidade = String(req.query.granularidade ?? 'mes').trim() === 'dia' ? 'dia' : 'mes';
  const idEmpresasRaw = String(req.query.idEmpresas ?? req.query.idEmpresa ?? '1,2').trim();
  const idEmpresas = normalizarIdsEmpresasDfc(
    idEmpresasRaw
      .split(',')
      .map((s) => Math.trunc(Number(s.trim())))
      .filter((n) => Number.isFinite(n) && n > 0),
  );

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }
  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Período inválido: dataFim deve ser >= dataInicio.' });
    return;
  }
  if (idEmpresas.length === 0) {
    res.status(400).json({ error: 'Informe idEmpresas válidos (ex.: 1,2).' });
    return;
  }

  const result = await carregarSaidasSoAcoDre({
    dataInicio,
    dataFim,
    idEmpresas,
    granularidade,
  });
  if (result.erro && result.linhas.length === 0) {
    res.status(503).json({ ...result, error: result.erro });
    return;
  }
  res.json({
    linhas: result.linhas,
    naoMapeados: result.naoMapeados,
    totalBruto: result.totalBruto,
    totalMapeado: result.totalMapeado,
    idsPorPathKey: result.idsPorPathKey ?? mapaIdsContaPorPathKeyDre(),
    idsPorPathKeyShop9: result.idsPorPathKeyShop9 ?? {},
    shop9OrdensCatalogoPorPathKey: result.shop9OrdensCatalogoPorPathKey ?? {},
    simplesNacionalFilial6PorPeriodo: result.simplesNacionalFilial6PorPeriodo ?? {},
    fonteSaidas: result.fonteSaidas,
    dataInicio,
    dataFim,
    idEmpresas,
    granularidade,
    erro: result.erro,
  });
}

/** GET /api/financeiro/dre/saidas-soaco/fornecedor-opcoes */
export async function getDreFornecedorOpcoes(req: Request, res: Response): Promise<void> {
  const pathKey = String(req.query.pathKey ?? '').trim() || undefined;

  if (!pathKey) {
    res.status(400).json({ error: 'Informe pathKey da conta DRE.' });
    return;
  }

  const { nomes, erro } = await queryDreFornecedorOpcoes({ pathKey });
  if (erro && nomes.length === 0) {
    res.status(503).json({ nomes: [], erro, error: erro });
    return;
  }
  res.json({ nomes, pathKey, erro });
}

/** GET /api/financeiro/dre/saidas-soaco/rateio-fornecedores */
export async function getDreRateioFornecedorTotais(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const granularidadeRaw = String(req.query.granularidade ?? 'mes').trim().toLowerCase();
  const granularidade: DfcAgendamentoGranularidade =
    granularidadeRaw === 'dia' ? 'dia' : 'mes';
  const idEmpresas = parseIdEmpresas(req.query);
  const poolRateio =
    String(req.query.poolRateio ?? '')
      .trim()
      .toLowerCase() === '1' ||
    String(req.query.poolRateio ?? '')
      .trim()
      .toLowerCase() === 'true';
  const pathKey = String(req.query.pathKey ?? '').trim();
  const nomesFornecedor = parseFornecedoresNomeQuery(req.query);

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }
  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Período inválido: dataFim deve ser >= dataInicio.' });
    return;
  }
  if (!pathKey) {
    res.status(400).json({ error: 'Informe pathKey da conta DRE.' });
    return;
  }
  if (nomesFornecedor.length === 0) {
    res.status(400).json({ error: 'Informe ao menos um fornecedor (fornecedor=nome).' });
    return;
  }

  const { totaisPorPeriodo, erro } = await queryDreRateioFornecedorTotais({
    dataInicio,
    dataFim,
    granularidade,
    idEmpresas: idEmpresas.length > 0 ? idEmpresas : undefined,
    pathKey,
    nomesFornecedor,
    poolRateio,
  });
  if (erro && Object.keys(totaisPorPeriodo).length === 0) {
    res.status(503).json({ totaisPorPeriodo: {}, erro, error: erro });
    return;
  }
  res.json({ totaisPorPeriodo, dataInicio, dataFim, pathKey, nomesFornecedor, granularidade, erro });
}

/**
 * GET /api/financeiro/dre/saidas-soaco/detalhe
 * Lançamentos Shop9 por competência (Ordem_Plano_Contas3) — alinhado à grade DRE.
 */
export async function getDreSaidasSoAcoDetalhe(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const granularidadeRaw = String(req.query.granularidade ?? 'mes').trim().toLowerCase();
  const granularidade: DfcAgendamentoGranularidade =
    granularidadeRaw === 'dia' ? 'dia' : 'mes';
  const idEmpresas = parseIdEmpresas(req.query);
  const idsRaw = String(req.query.ids ?? '').trim();
  const periodoOpt = String(req.query.periodo ?? '').trim() || null;

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }
  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Período inválido: dataFim deve ser >= dataInicio.' });
    return;
  }
  if (idEmpresas.length === 0) {
    res.status(400).json({ error: 'Informe idEmpresas válidos (ex.: 1,3).' });
    return;
  }
  if (!isShop9Enabled()) {
    res.status(503).json({ detalhes: [], erro: 'Shop9: SHOP9_DB_* não configurado' });
    return;
  }

  const idsPlanoContas3 = idsRaw
    .split(/[,;\s]+/)
    .map((s) => Math.trunc(Number(s)))
    .filter((n) => n > 0);
  const idsUniq = [...new Set(idsPlanoContas3)].slice(0, MAX_IDS_DETALHE);
  if (idsUniq.length === 0) {
    res.status(400).json({ error: 'Informe ao menos um id de plano Shop9 (ids=1,2,3).' });
    return;
  }

  if (periodoOpt) {
    if (granularidade === 'mes' && !MONTH_RE.test(periodoOpt)) {
      res.status(400).json({ error: 'periodo no modo mensal deve ser YYYY-MM.' });
      return;
    }
    if (granularidade === 'dia' && !DATE_RE.test(periodoOpt)) {
      res.status(400).json({ error: 'periodo no modo diário deve ser YYYY-MM-DD.' });
      return;
    }
  }

  const { detalhes, erro } = await queryDreShop9SaidasDetalhe({
    dataInicio,
    dataFim,
    idEmpresas,
    idsPlanoContas3: idsUniq,
    granularidade,
    periodoBucket: periodoOpt,
  });
  if (erro) console.error('[getDreSaidasSoAcoDetalhe]', erro);
  res.json({
    detalhes,
    truncado: detalhes.length >= 2000,
    dataInicio,
    dataFim,
    idEmpresas,
    granularidade,
    erro,
  });
}

/**
 * GET /api/financeiro/dre/saidas-soaco/detalhe-nomus
 * Lançamentos Nomus por competência (contafinanceiro) — alinhado à grade DRE.
 */
export async function getDreSaidasNomusDetalhe(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const granularidadeRaw = String(req.query.granularidade ?? 'mes').trim().toLowerCase();
  const granularidade: DfcAgendamentoGranularidade =
    granularidadeRaw === 'dia' ? 'dia' : 'mes';
  const idEmpresas = parseIdEmpresas(req.query);
  const idsRaw = String(req.query.ids ?? '').trim();
  const periodoOpt = String(req.query.periodo ?? '').trim() || null;

  if (!DATE_RE.test(dataInicio) || !DATE_RE.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }
  const dIni = parseDate(dataInicio);
  const dFim = parseDate(dataFim);
  if (!dIni || !dFim || dFim < dIni) {
    res.status(400).json({ error: 'Período inválido: dataFim deve ser >= dataInicio.' });
    return;
  }
  if (idEmpresas.length === 0) {
    res.status(400).json({ error: 'Informe idEmpresas válidos (ex.: 1,3).' });
    return;
  }

  const idsContaFinanceiro = idsRaw
    .split(/[,;\s]+/)
    .map((s) => Math.trunc(Number(s)))
    .filter((n) => n > 0);
  const idsUniq = [...new Set(idsContaFinanceiro)].slice(0, MAX_IDS_DETALHE);
  if (idsUniq.length === 0) {
    res.status(400).json({ error: 'Informe ao menos um id de conta Nomus (ids=1,2,3).' });
    return;
  }

  if (periodoOpt) {
    if (granularidade === 'mes' && !MONTH_RE.test(periodoOpt)) {
      res.status(400).json({ error: 'periodo no modo mensal deve ser YYYY-MM.' });
      return;
    }
    if (granularidade === 'dia' && !DATE_RE.test(periodoOpt)) {
      res.status(400).json({ error: 'periodo no modo diário deve ser YYYY-MM-DD.' });
      return;
    }
  }

  const { detalhes, erro } = await queryDreNomusSaidasDetalhe({
    dataInicio,
    dataFim,
    idEmpresas,
    idsContaFinanceiro: idsUniq,
    granularidade,
    periodoBucket: periodoOpt,
  });
  if (erro) console.error('[getDreSaidasNomusDetalhe]', erro);
  res.json({
    detalhes,
    truncado: detalhes.length >= 2000,
    dataInicio,
    dataFim,
    idEmpresas,
    granularidade,
    erro,
  });
}

/** GET /api/financeiro/dre/relacao-pc — estrutura DRE (saídas) + relações Nomus/Shop9 */
export async function getDreRelacaoPc(_req: Request, res: Response): Promise<void> {
  try {
    const payload = await carregarRelacaoPc();
    res.json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[getDreRelacaoPc]', msg);
    res.status(500).json({ error: msg });
  }
}

/** PUT /api/financeiro/dre/relacao-pc — salva overrides de relação para um pathKey DRE */
export async function putDreRelacaoPc(req: Request, res: Response): Promise<void> {
  const pathKey = String(req.body?.pathKey ?? '').trim();
  if (!pathKey) {
    res.status(400).json({ error: 'Informe pathKey da conta DRE.' });
    return;
  }

  const parseIds = (v: unknown): number[] | undefined => {
    if (v === undefined) return undefined;
    if (!Array.isArray(v)) return [];
    return [...new Set(v.map((n) => Math.trunc(Number(n))).filter((n) => Number.isFinite(n) && n > 0))].sort(
      (a, b) => a - b,
    );
  };

  try {
    const overrides = salvarRelacaoPcPathKey({
      pathKey,
      nomusIdsAdicionais: parseIds(req.body?.nomusIdsAdicionais),
      nomusIdsExcluidos: parseIds(req.body?.nomusIdsExcluidos),
      shop9OrdensAdicionais: parseIds(req.body?.shop9OrdensAdicionais),
      shop9OrdensExcluidos: parseIds(req.body?.shop9OrdensExcluidos),
    });
    const payload = await carregarRelacaoPc();
    res.json({ ok: true, overrides, conta: payload.contas.find((c) => c.pathKey === pathKey) ?? null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[putDreRelacaoPc]', msg);
    res.status(500).json({ error: msg });
  }
}

/** DELETE /api/financeiro/dre/relacao-pc — remove todos os overrides manuais */
export async function deleteDreRelacaoPcOverrides(_req: Request, res: Response): Promise<void> {
  try {
    resetarRelacaoPcOverrides();
    const payload = await carregarRelacaoPc();
    res.json({ ok: true, ...payload });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[deleteDreRelacaoPcOverrides]', msg);
    res.status(500).json({ error: msg });
  }
}

/** GET /api/financeiro/dre/dashboard — KPIs, séries e análise (somente leitura). */
export async function getDreDashboard(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim no formato YYYY-MM-DD.' });
    return;
  }
  if (dataFim < dataInicio) {
    res.status(400).json({ error: 'Período inválido: dataFim deve ser >= dataInicio.' });
    return;
  }

  const unidade = String(req.query.unidade ?? req.query.idEmpresas ?? 'todas').trim();
  const metaEbitdaPct = Number(req.query.metaEbitda ?? req.query.metaEbitdaPct ?? 12);
  const metaLucroPct = Number(req.query.metaLucro ?? req.query.metaLucroPct ?? 3);

  try {
    const payload = await montarDreDashboard({
      dataInicio,
      dataFim,
      unidade,
      metaEbitdaPct: Number.isFinite(metaEbitdaPct) ? metaEbitdaPct : 12,
      metaLucroPct: Number.isFinite(metaLucroPct) ? metaLucroPct : 3,
    });
    res.json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[getDreDashboard]', msg);
    res.status(500).json({ error: msg });
  }
}

/** GET /api/financeiro/dre/rateio-config — rateios DRE persistidos na VPS (var/dre-rateio.json). */
export async function getDreRateioConfig(_req: Request, res: Response): Promise<void> {
  try {
    const config = lerDreRateioConfig();
    res.json({
      regras: config.regras,
      atualizadoEm: config.atualizadoEm ?? null,
      vazio: config.regras.length === 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[getDreRateioConfig]', msg);
    res.status(500).json({ error: msg, regras: [], vazio: true });
  }
}

/**
 * PUT /api/financeiro/dre/rateio-config
 * Body: { regras: [...] }
 * Query: somenteSeVazio=1 — grava só se o arquivo ainda não tiver regras (migração do localStorage).
 */
export async function putDreRateioConfig(req: Request, res: Response): Promise<void> {
  try {
    const somenteSeVazio =
      String(req.query.somenteSeVazio ?? req.body?.somenteSeVazio ?? '')
        .trim()
        .toLowerCase() === '1' ||
      req.query.somenteSeVazio === 'true' ||
      req.body?.somenteSeVazio === true;

    const payload = { regras: req.body?.regras };
    if (somenteSeVazio) {
      const result = salvarDreRateioConfigSeVazio(payload);
      res.json({
        ok: true,
        gravado: result.gravado,
        regras: result.config.regras,
        atualizadoEm: result.config.atualizadoEm ?? null,
        vazio: result.config.regras.length === 0,
      });
      return;
    }

    const config = salvarDreRateioConfig(payload);
    if (config.regras.length === 0) {
      res.status(400).json({ error: 'Informe ao menos uma regra de rateio válida.' });
      return;
    }
    res.json({
      ok: true,
      gravado: true,
      regras: config.regras,
      atualizadoEm: config.atualizadoEm ?? null,
      vazio: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[putDreRateioConfig]', msg);
    res.status(500).json({ error: msg });
  }
}

const ID_EMPRESA_DRE_ACO = 1;
const ID_EMPRESA_DRE_MOVEIS = 2;

type DreExportReceitaLinha = Record<string, unknown> & {
  canal: string;
  empresa: string;
};

function mapearReceitaExport(
  rows: Array<Record<string, unknown>>,
  canal: string,
  idEmpresa: number,
): DreExportReceitaLinha[] {
  const empresa = labelEmpresaDfc(idEmpresa);
  return rows.map((r) => ({
    ...r,
    canal,
    empresa,
    percMarkup: r.percMarkup ?? null,
    valorIndireto: r.valorIndireto ?? null,
  }));
}

/**
 * GET /api/financeiro/dre/export/detalhe
 * Receitas + devoluções + saídas do intervalo, sem o corte dos modais.
 */
export async function getDreExportDetalhe(req: Request, res: Response): Promise<void> {
  const dataInicio = String(req.query.dataInicio ?? '').trim();
  const dataFim = String(req.query.dataFim ?? '').trim();
  const granularidadeRaw = String(req.query.granularidade ?? 'mes').trim().toLowerCase();
  const granularidade: DfcAgendamentoGranularidade =
    granularidadeRaw === 'dia' ? 'dia' : 'mes';
  const idEmpresas = parseIdEmpresas(req.query);

  const erroPeriodo = validarPeriodoDfcDetalhe(dataInicio, dataFim, granularidade);
  if (erroPeriodo) {
    res.status(400).json({ error: erroPeriodo });
    return;
  }

  const incluirAco = idEmpresas.includes(ID_EMPRESA_DRE_ACO);
  const incluirMoveis = idEmpresas.includes(ID_EMPRESA_DRE_MOVEIS);
  const idEmpresaIndireta = incluirAco ? ID_EMPRESA_DRE_ACO : ID_EMPRESA_DRE_MOVEIS;
  const avisos: string[] = [];
  let truncado = false;

  const [
    vendasRes,
    moveisRes,
    indiretaRes,
    devolAcoRes,
    devolMoveisRes,
    saidasNomusRes,
    saidasShop9Res,
  ] = await Promise.all([
    incluirAco
      ? queryDreReceitaVendasDetalhe({ dataInicio, dataFim, idEmpresaSaida: ID_EMPRESA_DRE_ACO, limite: null })
      : Promise.resolve({ detalhes: [] as Array<Record<string, unknown>>, truncado: false as boolean | undefined, erro: undefined as string | undefined }),
    incluirMoveis
      ? queryDreReceitaMoveisDiretoDetalhe({ dataInicio, dataFim, idEmpresaSaida: ID_EMPRESA_DRE_MOVEIS, limite: null })
      : Promise.resolve({ detalhes: [] as Array<Record<string, unknown>>, truncado: false as boolean | undefined, erro: undefined as string | undefined }),
    incluirAco || incluirMoveis
      ? queryDreReceitaIndiretaDetalhe({ dataInicio, dataFim, idEmpresaSaida: idEmpresaIndireta, limite: null })
      : Promise.resolve({ detalhes: [] as Array<Record<string, unknown>>, truncado: false as boolean | undefined, erro: undefined as string | undefined }),
    incluirAco
      ? queryDreDevolucoesDetalhe({ dataInicio, dataFim, idEmpresaEntrada: ID_EMPRESA_DRE_ACO, limite: null })
      : Promise.resolve({ detalhes: [] as Array<Record<string, unknown>>, truncado: false as boolean | undefined, erro: undefined as string | undefined }),
    incluirMoveis
      ? queryDreDevolucoesDetalhe({ dataInicio, dataFim, idEmpresaEntrada: ID_EMPRESA_DRE_MOVEIS, limite: null })
      : Promise.resolve({ detalhes: [] as Array<Record<string, unknown>>, truncado: false as boolean | undefined, erro: undefined as string | undefined }),
    queryDreNomusSaidasDetalhe({
      dataInicio,
      dataFim,
      idEmpresas,
      idsContaFinanceiro: [],
      granularidade,
      todasContas: true,
      limite: null,
    }),
    isShop9Enabled()
      ? queryDreShop9SaidasDetalhe({
          dataInicio,
          dataFim,
          idEmpresas,
          idsPlanoContas3: [],
          granularidade,
          todasContas: true,
          limite: null,
        })
      : Promise.resolve({ detalhes: [] as DfcAgendamentoDetalheRow[], erro: undefined as string | undefined }),
  ]);

  const erros = [
    vendasRes.erro,
    moveisRes.erro,
    indiretaRes.erro,
    devolAcoRes.erro,
    devolMoveisRes.erro,
    saidasNomusRes.erro,
    saidasShop9Res.erro,
  ].filter((e): e is string => Boolean(e));
  for (const e of erros) avisos.push(e);

  if (vendasRes.truncado || moveisRes.truncado || indiretaRes.truncado || devolAcoRes.truncado || devolMoveisRes.truncado) {
    truncado = true;
    avisos.push(
      `Volume extremo: alguma aba analítica foi limitada a ${LIMITE_DETALHE_EXPORT.toLocaleString('pt-BR')} linhas.`,
    );
  }

  const receitas: DreExportReceitaLinha[] = [
    ...mapearReceitaExport(vendasRes.detalhes as Array<Record<string, unknown>>, 'Vendas Só Aço', ID_EMPRESA_DRE_ACO),
    ...mapearReceitaExport(moveisRes.detalhes as Array<Record<string, unknown>>, 'Direto Só Móveis', ID_EMPRESA_DRE_MOVEIS),
    ...mapearReceitaExport(
      indiretaRes.detalhes as Array<Record<string, unknown>>,
      'Indireto',
      idEmpresaIndireta,
    ),
  ];

  const devolucoes = [
    ...((devolAcoRes.detalhes ?? []).map((r) => ({ ...r, empresa: labelEmpresaDfc(ID_EMPRESA_DRE_ACO) }))),
    ...((devolMoveisRes.detalhes ?? []).map((r) => ({ ...r, empresa: labelEmpresaDfc(ID_EMPRESA_DRE_MOVEIS) }))),
  ];

  const saidas = [
    ...(saidasNomusRes.detalhes ?? []),
    ...(saidasShop9Res.detalhes ?? []),
  ].sort((a, b) => b.valorBaixado - a.valorBaixado);

  res.json({
    receitas,
    devolucoes,
    saidas,
    truncado,
    avisos,
    dataInicio,
    dataFim,
    idEmpresas,
    granularidade,
  });
}

