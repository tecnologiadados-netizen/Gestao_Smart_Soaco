import { nomusQuery } from './nomusQuery.js';
import { getCached, invalidateCache, setCache } from './cache.js';
import { EMPRESAS_PAINEL } from './empresaConfig.js';
import {
  buildBaixadosQuery,
  buildContasQuery,
  buildIndicadoresConsolidadoQuery,
  buildPessoasQuery,
  buildRecebimentosDetalheQuery,
  buildRecebimentosDetalheResumoQuery,
  buildResumoBaixadosSaudeEmpresaQuery,
  buildTitulosDescontadoContasQuery,
  type PeriodoRecebido,
} from './crmQueries.js';
import {
  filtrarRecebimentosSemTituloDescontado,
  filtrarTitulosDescontadoPorSituacao,
  mesclarContasComTitulosDescontado,
} from './tituloDescontado.js';
import { calcularTotalDiasEfetivo } from './atrasoRecebimento.js';
import {
  calcularSaudeCliente,
  calcularSaudeEmpresaComResumo,
  type ResumoRecebimentosSaude,
  type SaudeClienteResult,
} from './saudeCliente.js';
import type {
  ColunaIndicador,
  ContaFinanceira,
  DashboardData,
  DashboardDetalhesData,
  DashboardGlobalData,
  IndicadorClassificacao,
  IndicadoresResumo,
  PessoaOption,
  EmpresaOption,
  Recebimento,
} from './types.js';

interface RowIndicadores {
  total: number;
  emAtraso: number;
  emDia: number;
  recebido30d: number;
  recebido90d: number;
  recebidoAno: number;
  recebidoHistorico: number;
}

interface RowConta {
  codigo: number;
  dataVencimento: Date | null;
  dataAgendamento: Date | null;
  dataEmissao: Date | null;
  dataBaixa: Date | null;
  dataRecebimento: Date | null;
  dataCompetencia: Date | null;
  classificacao: string | null;
  nomeClassificacao: string | null;
  empresa: string | null;
  contaBancaria: string | null;
  formaPagamento: string | null;
  pessoa: string | null;
  descricao: string | null;
  comentariosAgendamento: string | null;
  comentariosLancamento: string | null;
  nfeOrigem: string | null;
  totalDias: number | null;
  valorSaldo: number;
  valorRecebidoPago: number;
  valorOriginal: number;
  valorBaixado: number;
  status: string;
  natureza: string;
  diasAtraso: number | null;
  tituloDescontadoAberto?: number | boolean | null;
}

type IndicadoresConsolidadosResult = {
  indicadoresGlobais: DashboardGlobalData["indicadoresGlobais"];
  indicadoresPorClassificacao: DashboardGlobalData["indicadoresPorClassificacao"];
};

const indicadoresConsolidadosInFlight = new Map<
  string,
  Promise<IndicadoresConsolidadosResult>
>();

function mapIndicadores(row?: RowIndicadores): IndicadoresResumo {
  return {
    total: Number(row?.total ?? 0),
    emAtraso: Number(row?.emAtraso ?? 0),
    emDia: Number(row?.emDia ?? 0),
    recebido30d: Number(row?.recebido30d ?? 0),
    recebido90d: Number(row?.recebido90d ?? 0),
    recebidoAno: Number(row?.recebidoAno ?? 0),
    recebidoHistorico: Number(row?.recebidoHistorico ?? 0),
  };
}

function mapClassificacao(
  row: RowIndicadores & { classificacao: string; nomeClassificacao: string },
): IndicadorClassificacao {
  return {
    classificacao: row.classificacao,
    nomeClassificacao: row.nomeClassificacao,
    ...mapIndicadores(row),
  };
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function toText(value: unknown): string | null {
  if (value == null) return null;
  if (Buffer.isBuffer(value)) {
    const text = value.toString("utf8").trim();
    return text || null;
  }
  const text = String(value).trim();
  return text || null;
}

function mapConta(row: RowConta): ContaFinanceira {
  return {
    codigo: row.codigo,
    dataVencimento: toIso(row.dataVencimento),
    dataAgendamento: toIso(row.dataAgendamento),
    classificacao: row.classificacao,
    nomeClassificacao: row.nomeClassificacao,
    empresa: row.empresa,
    contaBancaria: row.contaBancaria,
    formaPagamento: row.formaPagamento,
    pessoa: row.pessoa,
    descricao: toText(row.descricao),
    comentariosAgendamento: toText(row.comentariosAgendamento),
    comentariosLancamento: toText(row.comentariosLancamento),
    nfeOrigem: toText(row.nfeOrigem),
    valor: Math.abs(Number(row.valorSaldo ?? 0)),
    status: row.status,
    natureza: row.natureza,
    diasAtraso: Number(row.diasAtraso ?? 0),
    tituloDescontadoAberto:
      row.tituloDescontadoAberto === true ||
      Number(row.tituloDescontadoAberto ?? 0) === 1,
  };
}

async function carregarContasDetalheComTitulosDescontado(
  tipo: "receber" | "pagar",
  situacao: "total" | "atraso" | "emDia",
  pessoa?: string | null,
  classificacao?: string | null,
  empresaId?: number | null,
): Promise<ContaFinanceira[]> {
  const contasQuery = buildContasQuery(
    tipo,
    situacao,
    pessoa,
    classificacao,
    empresaId,
  );
  const titulosQuery = buildTitulosDescontadoContasQuery(
    tipo,
    pessoa,
    classificacao,
    empresaId,
  );

  const [contasRows, titulosRows] = await Promise.all([
    nomusQuery<RowConta>(contasQuery.sql, contasQuery.params),
    nomusQuery<RowConta>(titulosQuery.sql, titulosQuery.params),
  ]);

  const contas = contasRows.map(mapConta);
  const titulos = filtrarTitulosDescontadoPorSituacao(
    titulosRows.map(mapConta),
    situacao,
  );

  return mesclarContasComTitulosDescontado(contas, titulos);
}

interface RowResumoBaixadoSaude {
  dataVencimento: Date | null;
  dataBaixa: Date | null;
  dataRecebimento: Date | null;
  totalDias: number | null;
  temJuros: number;
  quantidade: number;
}

interface RowResumoDetalhe {
  quantidadeTotal: number;
  valorTotal: number;
}

interface DetalheResumo {
  quantidadeTotal: number;
  valorTotal: number;
  quantidadeCarregada: number;
  limite: number;
}

type IndicadorDetalheResultado =
  | { modo: "contas"; dados: ContaFinanceira[]; resumo?: DetalheResumo }
  | { modo: "recebimentos"; dados: Recebimento[]; resumo?: DetalheResumo };

function mapBaixado(row: RowConta): Recebimento {
  const valorAteVencimento = Math.abs(Number(row.valorOriginal ?? 0));
  const valorBaixado = Math.abs(Number(row.valorBaixado ?? 0));
  const valorRecebido = Math.abs(Number(row.valorRecebidoPago ?? 0));

  return {
    codigo: row.codigo,
    dataEmissao: toIso(row.dataEmissao),
    dataVencimento: toIso(row.dataVencimento),
    dataBaixa: toIso(row.dataBaixa),
    dataRecebimento: toIso(row.dataRecebimento),
    dataCompetencia: toIso(row.dataCompetencia),
    classificacao: row.classificacao,
    nomeClassificacao: row.nomeClassificacao,
    contaBancaria: row.contaBancaria,
    formaPagamento: row.formaPagamento,
    pessoa: row.pessoa,
    descricao: toText(row.descricao),
    comentariosAgendamento: toText(row.comentariosAgendamento),
    comentariosLancamento: toText(row.comentariosLancamento),
    nfeOrigem: toText(row.nfeOrigem),
    totalDias:
      row.totalDias == null ? null : Number(row.totalDias),
    valorAteVencimento,
    valorBaixado,
    valorRecebido,
    valorJuros: Math.max(0, valorRecebido - valorAteVencimento),
  };
}

const CACHE_KEY_GLOBAL = "dashboard:indicadores-globais:v11";
const CACHE_KEY_SAUDE_EMPRESA = "dashboard:saude-quadro-receber-empresa:v3";
const CACHE_KEY_DETALHE = "dashboard:detalhe:v6";
const CACHE_TTL_MS = 300_000;

function empresaCacheSuffix(empresaId?: number | null): string {
  return empresaId != null ? `:emp:${empresaId}` : ":emp:all";
}

function detalheCacheKey(
  tipo: "receber" | "pagar",
  coluna: ColunaIndicador,
  classificacao?: string | null,
  pessoa?: string | null,
  empresaId?: number | null,
): string {
  return `${CACHE_KEY_DETALHE}:${tipo}:${coluna}:${classificacao ?? "all"}:${pessoa?.trim() || "all"}${empresaCacheSuffix(empresaId)}`;
}

function somarIndicadores(rows: RowIndicadores[]): IndicadoresResumo {
  return rows.reduce(
    (acc, row) => ({
      total: acc.total + Number(row.total ?? 0),
      emAtraso: acc.emAtraso + Number(row.emAtraso ?? 0),
      emDia: acc.emDia + Number(row.emDia ?? 0),
      recebido30d: acc.recebido30d + Number(row.recebido30d ?? 0),
      recebido90d: acc.recebido90d + Number(row.recebido90d ?? 0),
      recebidoAno: acc.recebidoAno + Number(row.recebidoAno ?? 0),
      recebidoHistorico:
        acc.recebidoHistorico + Number(row.recebidoHistorico ?? 0),
    }),
    {
      total: 0,
      emAtraso: 0,
      emDia: 0,
      recebido30d: 0,
      recebido90d: 0,
      recebidoAno: 0,
      recebidoHistorico: 0,
    },
  );
}

async function carregarIndicadoresConsolidados(
  pessoa?: string | null,
  empresaId?: number | null,
): Promise<IndicadoresConsolidadosResult> {
  const pessoaKey = pessoa?.trim() || "all";
  const inFlightKey = `${pessoaKey}${empresaCacheSuffix(empresaId ?? null)}`;
  const inFlight = indicadoresConsolidadosInFlight.get(inFlightKey);
  if (inFlight) return inFlight;

  const { sql, params } = buildIndicadoresConsolidadoQuery(pessoa, empresaId);
  const promise = nomusQuery<
    RowIndicadores & {
      tipo: "receber" | "pagar";
      classificacao: string;
      nomeClassificacao: string;
    }
  >(sql, params).then((rows) => {
    const receberClassRows = rows.filter((row) => row.tipo === "receber");
    const pagarClassRows = rows.filter((row) => row.tipo === "pagar");

    return {
      indicadoresGlobais: {
        receber: somarIndicadores(receberClassRows),
        pagar: somarIndicadores(pagarClassRows),
      },
      indicadoresPorClassificacao: {
        receber: receberClassRows.map(mapClassificacao),
        pagar: pagarClassRows.map(mapClassificacao),
      },
    };
  });

  indicadoresConsolidadosInFlight.set(inFlightKey, promise);

  try {
    return await promise;
  } finally {
    indicadoresConsolidadosInFlight.delete(inFlightKey);
  }
}

async function carregarResumoRecebimentosSaudeEmpresa(
  empresaId?: number | null,
): Promise<ResumoRecebimentosSaude> {
  const { sql, params } = buildResumoBaixadosSaudeEmpresaQuery(empresaId);
  const rows = await nomusQuery<RowResumoBaixadoSaude>(sql, params);

  const resumo: ResumoRecebimentosSaude = {
    totalComPrazo: 0,
    noPrazoEfetivo: 0,
    atrasadosEfetivos: 0,
    desconsiderados: 0,
    atrasadosComJuros: 0,
    atrasadosSemJuros: 0,
  };

  for (const row of rows) {
    const quantidade = Number(row.quantidade ?? 0);
    if (quantidade <= 0 || row.totalDias == null) continue;

    const recebimento: Recebimento = {
      codigo: 0,
      dataEmissao: null,
      dataVencimento: toIso(row.dataVencimento),
      dataBaixa: toIso(row.dataBaixa),
      dataRecebimento: toIso(row.dataRecebimento),
      dataCompetencia: null,
      classificacao: null,
      nomeClassificacao: null,
      contaBancaria: null,
      formaPagamento: null,
      pessoa: null,
      descricao: null,
      comentariosAgendamento: null,
      comentariosLancamento: null,
      nfeOrigem: null,
      totalDias: Number(row.totalDias),
      valorAteVencimento: 0,
      valorBaixado: 0,
      valorRecebido: 0,
      valorJuros: Number(row.temJuros) > 0 ? 1 : 0,
    };

    const totalDiasOriginal = Number(row.totalDias);
    const totalDiasEfetivo = calcularTotalDiasEfetivo(recebimento);
    if (totalDiasEfetivo == null) continue;

    resumo.totalComPrazo += quantidade;

    if (totalDiasEfetivo >= 0) {
      resumo.noPrazoEfetivo += quantidade;
      if (totalDiasOriginal < 0) {
        resumo.desconsiderados += quantidade;
      }
      continue;
    }

    resumo.atrasadosEfetivos += quantidade;
    if (recebimento.valorJuros > 0) {
      resumo.atrasadosComJuros += quantidade;
    } else {
      resumo.atrasadosSemJuros += quantidade;
    }
  }

  return resumo;
}

export async function getIndicadoresGlobais(
  pessoa?: string | null,
  options?: { refresh?: boolean; empresaId?: number | null },
): Promise<DashboardGlobalData> {
  const pessoaKey = pessoa?.trim() || null;
  const empresaId = options?.empresaId ?? null;
  const cacheKey = pessoaKey
    ? `${CACHE_KEY_GLOBAL}:pessoa:${pessoaKey}${empresaCacheSuffix(empresaId)}`
    : `${CACHE_KEY_GLOBAL}${empresaCacheSuffix(empresaId)}`;

  if (!options?.refresh) {
    const cached = getCached<DashboardGlobalData>(cacheKey);
    if (cached) return cached;
  } else if (!pessoaKey) {
    invalidateCache(`${CACHE_KEY_GLOBAL}${empresaCacheSuffix(empresaId)}`);
  }

  const indicadores = await carregarIndicadoresConsolidados(pessoaKey, empresaId);

  const data: DashboardGlobalData = {
    ...indicadores,
    pessoaFiltrada: pessoaKey,
  };

  if (!pessoaKey) {
    setCache(cacheKey, data, CACHE_TTL_MS);
  }

  return data;
}

export async function getSaudeQuadroReceberEmpresa(options?: {
  refresh?: boolean;
  empresaId?: number | null;
}): Promise<SaudeClienteResult> {
  const empresaId = options?.empresaId ?? null;
  const cacheKey = `${CACHE_KEY_SAUDE_EMPRESA}${empresaCacheSuffix(empresaId)}`;

  if (!options?.refresh) {
    const cached = getCached<SaudeClienteResult>(cacheKey);
    if (cached) return cached;
  } else {
    invalidateCache(cacheKey);
  }

  const indicadoresCacheKey = `${CACHE_KEY_GLOBAL}${empresaCacheSuffix(empresaId)}`;
  const indicadoresEmCache = getCached<DashboardGlobalData>(indicadoresCacheKey);
  const [resumoRecebimentos, indicadoresReceber] = await Promise.all([
    carregarResumoRecebimentosSaudeEmpresa(empresaId),
    indicadoresEmCache
      ? Promise.resolve(indicadoresEmCache.indicadoresGlobais.receber)
      : carregarIndicadoresConsolidados(null, empresaId).then(
          (indicadores) => indicadores.indicadoresGlobais.receber,
        ),
  ]);

  const saudeEmpresa = calcularSaudeEmpresaComResumo(
    indicadoresReceber,
    resumoRecebimentos,
  );

  setCache(cacheKey, saudeEmpresa, CACHE_TTL_MS);
  return saudeEmpresa;
}

export async function getDashboardDetalhes(
  pessoa: string,
  empresaId?: number | null,
): Promise<DashboardDetalhesData> {
  const [
    indicadores,
    contasReceberAtraso,
    contasReceberEmDia,
    contasPagarAtraso,
    contasPagarEmDia,
    recebimentosRows,
    pagamentosRows,
  ] = await Promise.all([
    carregarIndicadoresConsolidados(pessoa, empresaId),
    carregarContasDetalheComTitulosDescontado(
      "receber",
      "atraso",
      pessoa,
      null,
      empresaId,
    ),
    carregarContasDetalheComTitulosDescontado(
      "receber",
      "emDia",
      pessoa,
      null,
      empresaId,
    ),
    carregarContasDetalheComTitulosDescontado(
      "pagar",
      "atraso",
      pessoa,
      null,
      empresaId,
    ),
    carregarContasDetalheComTitulosDescontado(
      "pagar",
      "emDia",
      pessoa,
      null,
      empresaId,
    ),
    (async () => {
      const { sql, params } = buildBaixadosQuery("receber", pessoa, empresaId);
      return nomusQuery<RowConta>(sql, params);
    })(),
    (async () => {
      const { sql, params } = buildBaixadosQuery("pagar", pessoa, empresaId);
      return nomusQuery<RowConta>(sql, params);
    })(),
  ]);

  return {
    indicadoresGlobais: indicadores.indicadoresGlobais,
    indicadoresPorClassificacao: indicadores.indicadoresPorClassificacao,
    contasReceberAtraso,
    contasReceberEmDia,
    contasPagarAtraso,
    contasPagarEmDia,
    recebimentos: filtrarRecebimentosSemTituloDescontado(
      recebimentosRows.map(mapBaixado),
    ),
    pagamentos: filtrarRecebimentosSemTituloDescontado(
      pagamentosRows.map(mapBaixado),
    ),
    pessoaFiltrada: pessoa.trim(),
  };
}

/** @deprecated Use getIndicadoresGlobais ou getDashboardDetalhes */
export async function getDashboardData(
  pessoa?: string | null,
): Promise<DashboardData> {
  if (pessoa?.trim()) {
    return getDashboardDetalhes(pessoa);
  }
  const global = await getIndicadoresGlobais();
  return {
    ...global,
    contasReceberAtraso: [],
    contasReceberEmDia: [],
    contasPagarAtraso: [],
    contasPagarEmDia: [],
    recebimentos: [],
    pagamentos: [],
  };
}

export async function getContasDetalhe(
  tipo: "receber" | "pagar",
  situacao: "total" | "atraso" | "emDia",
  classificacao?: string | null,
  pessoa?: string | null,
  empresaId?: number | null,
): Promise<ContaFinanceira[]> {
  return carregarContasDetalheComTitulosDescontado(
    tipo,
    situacao,
    pessoa,
    classificacao,
    empresaId,
  );
}

export async function getRecebimentosDetalhe(
  tipo: "receber" | "pagar",
  periodo: PeriodoRecebido,
  classificacao?: string | null,
  pessoa?: string | null,
  empresaId?: number | null,
): Promise<{ dados: Recebimento[]; resumo: DetalheResumo }> {
  const detalheQuery = buildRecebimentosDetalheQuery(
    tipo,
    periodo,
    pessoa,
    classificacao,
    empresaId,
  );
  const resumoQuery = buildRecebimentosDetalheResumoQuery(
    tipo,
    periodo,
    pessoa,
    classificacao,
    empresaId,
  );

  const [rows, resumoRows] = await Promise.all([
    nomusQuery<RowConta>(detalheQuery.sql, detalheQuery.params),
    nomusQuery<RowResumoDetalhe>(resumoQuery.sql, resumoQuery.params),
  ]);
  const dados = filtrarRecebimentosSemTituloDescontado(rows.map(mapBaixado));
  const resumoRow = resumoRows[0];

  return {
    dados,
    resumo: {
      quantidadeTotal: Number(resumoRow?.quantidadeTotal ?? dados.length),
      valorTotal: Number(
        resumoRow?.valorTotal ??
          dados.reduce((acc, item) => acc + item.valorRecebido, 0),
      ),
      quantidadeCarregada: dados.length,
      limite: dados.length,
    },
  };
}

const COLUNAS_CONTAS = new Set<ColunaIndicador>(["total", "emAtraso", "emDia"]);

function colunaParaSituacao(
  coluna: ColunaIndicador,
): "total" | "atraso" | "emDia" | null {
  if (coluna === "total") return "total";
  if (coluna === "emAtraso") return "atraso";
  if (coluna === "emDia") return "emDia";
  return null;
}

function colunaParaPeriodo(coluna: ColunaIndicador): PeriodoRecebido | null {
  if (coluna === "recebido30d") return "30d";
  if (coluna === "recebido90d") return "90d";
  if (coluna === "recebidoAno") return "ano";
  if (coluna === "recebidoHistorico") return "historico";
  return null;
}

export async function getIndicadorDetalhe(
  tipo: "receber" | "pagar",
  coluna: ColunaIndicador,
  classificacao?: string | null,
  pessoa?: string | null,
  empresaId?: number | null,
): Promise<IndicadorDetalheResultado> {
  const cacheKey = detalheCacheKey(tipo, coluna, classificacao, pessoa, empresaId);
  const cached = getCached<IndicadorDetalheResultado>(cacheKey);
  if (cached) return cached;

  let resultado: IndicadorDetalheResultado;

  if (COLUNAS_CONTAS.has(coluna)) {
    const situacao = colunaParaSituacao(coluna)!;
    const dados = await getContasDetalhe(
      tipo,
      situacao,
      classificacao,
      pessoa,
      empresaId,
    );
    resultado = { modo: "contas", dados };
  } else {
    const periodo = colunaParaPeriodo(coluna)!;
    const detalhe = await getRecebimentosDetalhe(
      tipo,
      periodo,
      classificacao,
      pessoa,
      empresaId,
    );
    resultado = {
      modo: "recebimentos",
      dados: detalhe.dados,
      resumo: detalhe.resumo,
    };
  }

  setCache(cacheKey, resultado, CACHE_TTL_MS);
  return resultado;
}

export async function searchPessoas(
  search?: string | null,
  empresaId?: number | null,
): Promise<PessoaOption[]> {
  const { sql, params } = buildPessoasQuery(search, empresaId);
  const rows = await nomusQuery<{
    nome: string;
    razaoSocial: string | null;
    cnpjCpf: string | null;
    totalPendente: number;
  }>(sql, params);

  return rows.map((row) => ({
    nome: row.nome,
    razaoSocial: row.razaoSocial,
    cnpjCpf: row.cnpjCpf,
    totalPendente: Number(row.totalPendente ?? 0),
  }));
}

export async function listEmpresas(): Promise<EmpresaOption[]> {
  return EMPRESAS_PAINEL;
}
