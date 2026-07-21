import { nomusQuery } from './nomusQuery.js';
import { getCached, invalidateCache, setCache } from './cache.js';
import { EMPRESAS_PAINEL } from './empresaConfig.js';
import {
  buildBaixadosQuery,
  buildContasQuery,
  buildGruposPessoaQuery,
  buildIndicadoresConsolidadoQuery,
  buildMembrosGrupoQuery,
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
  GrupoFiltradoInfo,
  GrupoPessoaOption,
  IndicadorClassificacao,
  IndicadoresResumo,
  PessoaOption,
  EmpresaOption,
  Recebimento,
} from './types.js';

function resolveClienteFiltro(
  pessoa?: string | null,
  grupoId?: number | null,
): { pessoa: string | null; grupoId: number | null } {
  if (grupoId != null && grupoId > 0) {
    return { pessoa: null, grupoId: Math.trunc(grupoId) };
  }
  return { pessoa: pessoa?.trim() || null, grupoId: null };
}

function clienteCacheKey(
  pessoa?: string | null,
  grupoId?: number | null,
): string {
  const f = resolveClienteFiltro(pessoa, grupoId);
  if (f.grupoId != null) return `grupo:${f.grupoId}`;
  return f.pessoa || "all";
}

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
  grupoId?: number | null,
): Promise<ContaFinanceira[]> {
  const f = resolveClienteFiltro(pessoa, grupoId);
  const contasQuery = buildContasQuery(
    tipo,
    situacao,
    f.pessoa,
    classificacao,
    empresaId,
    f.grupoId,
  );
  const titulosQuery = buildTitulosDescontadoContasQuery(
    tipo,
    f.pessoa,
    classificacao,
    empresaId,
    f.grupoId,
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
  grupoId?: number | null,
): string {
  return `${CACHE_KEY_DETALHE}:${tipo}:${coluna}:${classificacao ?? "all"}:${clienteCacheKey(pessoa, grupoId)}${empresaCacheSuffix(empresaId)}`;
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
  grupoId?: number | null,
): Promise<IndicadoresConsolidadosResult> {
  const f = resolveClienteFiltro(pessoa, grupoId);
  const inFlightKey = `${clienteCacheKey(f.pessoa, f.grupoId)}${empresaCacheSuffix(empresaId ?? null)}`;
  const inFlight = indicadoresConsolidadosInFlight.get(inFlightKey);
  if (inFlight) return inFlight;

  const { sql, params } = buildIndicadoresConsolidadoQuery(
    f.pessoa,
    empresaId,
    f.grupoId,
  );
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
  options?: {
    refresh?: boolean;
    empresaId?: number | null;
    grupoId?: number | null;
  },
): Promise<DashboardGlobalData> {
  const f = resolveClienteFiltro(pessoa, options?.grupoId);
  const empresaId = options?.empresaId ?? null;
  const cacheKey =
    f.grupoId != null
      ? `${CACHE_KEY_GLOBAL}:grupo:${f.grupoId}${empresaCacheSuffix(empresaId)}`
      : f.pessoa
        ? `${CACHE_KEY_GLOBAL}:pessoa:${f.pessoa}${empresaCacheSuffix(empresaId)}`
        : `${CACHE_KEY_GLOBAL}${empresaCacheSuffix(empresaId)}`;

  if (!options?.refresh) {
    const cached = getCached<DashboardGlobalData>(cacheKey);
    if (cached) return cached;
  } else if (!f.pessoa && f.grupoId == null) {
    invalidateCache(`${CACHE_KEY_GLOBAL}${empresaCacheSuffix(empresaId)}`);
  }

  const indicadores = await carregarIndicadoresConsolidados(
    f.pessoa,
    empresaId,
    f.grupoId,
  );

  const data: DashboardGlobalData = {
    ...indicadores,
    pessoaFiltrada: f.pessoa,
    grupoFiltrado: null,
  };

  if (!f.pessoa && f.grupoId == null) {
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

async function carregarGrupoFiltrado(
  grupoId: number,
  empresaId?: number | null,
): Promise<GrupoFiltradoInfo | null> {
  const nomeRows = await nomusQuery<{ id: number; nome: string }>(
    `SELECT id, IFNULL(grupo, '') AS nome FROM grupopessoa WHERE id = ? LIMIT 1`,
    [grupoId],
  );
  const nome = nomeRows[0]?.nome?.trim() || `Grupo #${grupoId}`;

  const membrosQuery = buildMembrosGrupoQuery(grupoId, empresaId);
  const membrosRows = await nomusQuery<{
    nome: string;
    razaoSocial: string | null;
    cnpjCpf: string | null;
    totalPendente: number;
  }>(membrosQuery.sql, membrosQuery.params);

  return {
    id: grupoId,
    nome,
    membros: membrosRows.map((row) => ({
      nome: row.nome,
      razaoSocial: row.razaoSocial,
      cnpjCpf: row.cnpjCpf,
      totalPendente: Number(row.totalPendente ?? 0),
    })),
  };
}

export async function getDashboardDetalhes(
  pessoa?: string | null,
  empresaId?: number | null,
  grupoId?: number | null,
): Promise<DashboardDetalhesData> {
  const f = resolveClienteFiltro(pessoa, grupoId);
  if (!f.pessoa && f.grupoId == null) {
    throw new Error("Informe pessoa ou grupoId para carregar detalhes.");
  }

  const [
    indicadores,
    contasReceberAtraso,
    contasReceberEmDia,
    contasPagarAtraso,
    contasPagarEmDia,
    recebimentosRows,
    pagamentosRows,
    grupoFiltrado,
  ] = await Promise.all([
    carregarIndicadoresConsolidados(f.pessoa, empresaId, f.grupoId),
    carregarContasDetalheComTitulosDescontado(
      "receber",
      "atraso",
      f.pessoa,
      null,
      empresaId,
      f.grupoId,
    ),
    carregarContasDetalheComTitulosDescontado(
      "receber",
      "emDia",
      f.pessoa,
      null,
      empresaId,
      f.grupoId,
    ),
    carregarContasDetalheComTitulosDescontado(
      "pagar",
      "atraso",
      f.pessoa,
      null,
      empresaId,
      f.grupoId,
    ),
    carregarContasDetalheComTitulosDescontado(
      "pagar",
      "emDia",
      f.pessoa,
      null,
      empresaId,
      f.grupoId,
    ),
    (async () => {
      const { sql, params } = buildBaixadosQuery(
        "receber",
        f.pessoa,
        empresaId,
        f.grupoId,
      );
      return nomusQuery<RowConta>(sql, params);
    })(),
    (async () => {
      const { sql, params } = buildBaixadosQuery(
        "pagar",
        f.pessoa,
        empresaId,
        f.grupoId,
      );
      return nomusQuery<RowConta>(sql, params);
    })(),
    f.grupoId != null
      ? carregarGrupoFiltrado(f.grupoId, empresaId)
      : Promise.resolve(null),
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
    pessoaFiltrada: f.pessoa,
    grupoFiltrado,
  };
}

/** @deprecated Use getIndicadoresGlobais ou getDashboardDetalhes */
export async function getDashboardData(
  pessoa?: string | null,
  grupoId?: number | null,
): Promise<DashboardData> {
  const f = resolveClienteFiltro(pessoa, grupoId);
  if (f.pessoa || f.grupoId != null) {
    return getDashboardDetalhes(f.pessoa, null, f.grupoId);
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
  grupoId?: number | null,
): Promise<ContaFinanceira[]> {
  return carregarContasDetalheComTitulosDescontado(
    tipo,
    situacao,
    pessoa,
    classificacao,
    empresaId,
    grupoId,
  );
}

export async function getRecebimentosDetalhe(
  tipo: "receber" | "pagar",
  periodo: PeriodoRecebido,
  classificacao?: string | null,
  pessoa?: string | null,
  empresaId?: number | null,
  grupoId?: number | null,
): Promise<{ dados: Recebimento[]; resumo: DetalheResumo }> {
  const f = resolveClienteFiltro(pessoa, grupoId);
  const detalheQuery = buildRecebimentosDetalheQuery(
    tipo,
    periodo,
    f.pessoa,
    classificacao,
    empresaId,
    f.grupoId,
  );
  const resumoQuery = buildRecebimentosDetalheResumoQuery(
    tipo,
    periodo,
    f.pessoa,
    classificacao,
    empresaId,
    f.grupoId,
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
  grupoId?: number | null,
): Promise<IndicadorDetalheResultado> {
  const cacheKey = detalheCacheKey(
    tipo,
    coluna,
    classificacao,
    pessoa,
    empresaId,
    grupoId,
  );
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
      grupoId,
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
      grupoId,
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

export async function searchPessoasEGrupos(
  search?: string | null,
  empresaId?: number | null,
): Promise<{ pessoas: PessoaOption[]; grupos: GrupoPessoaOption[] }> {
  const pessoasQ = buildPessoasQuery(search, empresaId);
  const gruposQ = buildGruposPessoaQuery(search, empresaId);

  const [pessoasRows, gruposRows] = await Promise.all([
    nomusQuery<{
      nome: string;
      razaoSocial: string | null;
      cnpjCpf: string | null;
      idGrupoPessoa: number | null;
      grupo: string | null;
      totalPendente: number;
    }>(pessoasQ.sql, pessoasQ.params),
    nomusQuery<{
      id: number;
      nome: string;
      qtdMembros: number;
      totalPendente: number;
    }>(gruposQ.sql, gruposQ.params),
  ]);

  return {
    pessoas: pessoasRows.map((row) => ({
      nome: row.nome,
      razaoSocial: row.razaoSocial,
      cnpjCpf: row.cnpjCpf,
      totalPendente: Number(row.totalPendente ?? 0),
      idGrupoPessoa:
        row.idGrupoPessoa != null && Number(row.idGrupoPessoa) > 0
          ? Number(row.idGrupoPessoa)
          : null,
      grupo: row.grupo?.trim() || null,
    })),
    grupos: gruposRows.map((row) => ({
      id: Number(row.id),
      nome: row.nome,
      qtdMembros: Number(row.qtdMembros ?? 0),
      totalPendente: Number(row.totalPendente ?? 0),
    })),
  };
}

/** @deprecated Prefer searchPessoasEGrupos */
export async function searchPessoas(
  search?: string | null,
  empresaId?: number | null,
): Promise<PessoaOption[]> {
  const { pessoas } = await searchPessoasEGrupos(search, empresaId);
  return pessoas;
}

export async function listEmpresas(): Promise<EmpresaOption[]> {
  return EMPRESAS_PAINEL;
}

export async function listarContasReceberPorPessoa(
  situacao: "total" | "atraso" | "emDia",
  pessoa: string,
): Promise<ContaFinanceira[]> {
  return carregarContasDetalheComTitulosDescontado("receber", situacao, pessoa);
}
