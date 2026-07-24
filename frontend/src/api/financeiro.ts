import { apiFetch } from './client';
import type { DfcPrioridade, DfcTipoRefLancamento } from './dfcPrioridade';

export interface DfcAgendamentoLinha {
  idContaFinanceiro: number;
  periodo: string;
  valor: number;
}

/** Contribuição granular (carga completa no Aplicar; filtros no cliente). */
export interface DfcContribuicaoLinha {
  idContaFinanceiro: number;
  valor: number;
  idEmpresa: number;
  /** Nome da empresa no Nomus (filtro por texto quando idEmpresa do ERP diverge). */
  empresa?: string | null;
  contaBancaria: string | null;
  codigoConta: number;
  tipoRef: 'A' | 'L';
  dataBucket: string;
}

export interface DfcAgendamentosEfetivosResponse {
  linhas: DfcAgendamentoLinha[];
  contribuicoes?: DfcContribuicaoLinha[];
  granularidade: 'dia' | 'mes';
  dataInicio: string;
  dataFim: string;
  idEmpresas: number[];
  /** Contas bancárias Nomus com movimento no período (após Aplicar). */
  contasBancariasDisponiveis?: string[];
  /** Saldo a faturar agregado por Data Proj Venc (linha «Projeção de Receitas» na árvore). */
  projecaoReceitasPorPeriodo?: Record<string, number>;
  /** Saldos agregados por coluna da grade (pré-calculados no servidor). */
  saldosIniciaisPorPeriodo?: Record<string, number>;
  saldosFinaisPorPeriodo?: Record<string, number>;
  saldosPorConta?: DfcSaldoBancarioContaGrade[];
  erroSaldosBancarios?: string;
  erro?: string;
}

export async function fetchDfcProjecaoReceitasDetalhe(params: {
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  idEmpresas?: number[];
  periodo?: string;
}): Promise<{ linhas: DfcSaldoFaturarLinha[]; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  sp.set('granularidade', params.granularidade);
  const emps = params.idEmpresas ?? [1];
  if (emps.length > 0) sp.set('idEmpresas', emps.join(','));
  if (params.periodo) sp.set('periodo', params.periodo);
  const res = await apiFetch(`/api/financeiro/dfc/projecao-receitas/detalhe?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    linhas?: DfcSaldoFaturarLinha[];
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return { linhas: [], erro: body.error ?? body.erro ?? res.statusText };
  }
  return {
    linhas: Array.isArray(body.linhas) ? body.linhas : [],
    erro: body.erro,
  };
}

export interface DfcSaldoBancarioLinha {
  dataLancamento: string;
  idEmpresa: number;
  idContaBancaria: number;
  nomeContaBancaria: string;
  saldoInicial: number;
  valorLancamento: number;
  saldoFinal: number;
}

/** Saldos agregados por conta bancária e coluna da grade. */
export interface DfcSaldoBancarioContaGrade {
  idContaBancaria: number;
  nomeContaBancaria: string;
  idEmpresa: number;
  saldosIniciaisPorPeriodo: Record<string, number>;
  saldosFinaisPorPeriodo: Record<string, number>;
}

export async function fetchDfcSaldosBancarios(params: {
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  idEmpresas?: number[];
  contasBancarias?: string[];
}): Promise<{
  saldosIniciaisPorPeriodo: Record<string, number>;
  saldosFinaisPorPeriodo: Record<string, number>;
  saldosPorConta: DfcSaldoBancarioContaGrade[];
  erro?: string;
}> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  sp.set('granularidade', params.granularidade);
  const emps = params.idEmpresas ?? [1, 2, 3, 4];
  if (emps.length > 0) sp.set('idEmpresas', emps.join(','));
  appendContasBancariasQuery(sp, params.contasBancarias);
  const res = await apiFetch(`/api/financeiro/dfc/saldos-bancarios?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    saldosIniciaisPorPeriodo?: Record<string, number>;
    saldosFinaisPorPeriodo?: Record<string, number>;
    saldosPorConta?: DfcSaldoBancarioContaGrade[];
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return {
      saldosIniciaisPorPeriodo: {},
      saldosFinaisPorPeriodo: {},
      saldosPorConta: [],
      erro: body.error ?? body.erro ?? res.statusText,
    };
  }
  return {
    saldosIniciaisPorPeriodo:
      body.saldosIniciaisPorPeriodo && typeof body.saldosIniciaisPorPeriodo === 'object'
        ? body.saldosIniciaisPorPeriodo
        : {},
    saldosFinaisPorPeriodo:
      body.saldosFinaisPorPeriodo && typeof body.saldosFinaisPorPeriodo === 'object'
        ? body.saldosFinaisPorPeriodo
        : {},
    saldosPorConta: Array.isArray(body.saldosPorConta) ? body.saldosPorConta : [],
    erro: body.erro,
  };
}

export async function fetchDfcProjecaoReceitas(params: {
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  idEmpresas?: number[];
}): Promise<{ porPeriodo: Record<string, number>; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  sp.set('granularidade', params.granularidade);
  const emps = params.idEmpresas ?? [1];
  if (emps.length > 0) sp.set('idEmpresas', emps.join(','));
  const res = await apiFetch(`/api/financeiro/dfc/projecao-receitas?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    porPeriodo?: Record<string, number>;
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return { porPeriodo: {}, erro: body.error ?? body.erro ?? res.statusText };
  }
  return {
    porPeriodo: body.porPeriodo && typeof body.porPeriodo === 'object' ? body.porPeriodo : {},
    erro: body.erro,
  };
}

function appendContasBancariasQuery(sp: URLSearchParams, contasBancarias?: string[]): void {
  if (contasBancarias && contasBancarias.length > 0) {
    sp.set('contasBancarias', contasBancarias.map((n) => encodeURIComponent(n)).join('|'));
  }
}

export async function fetchDfcContasBancarias(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresas?: number[];
}): Promise<{ nomes: string[]; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  const emps = params.idEmpresas ?? [1];
  if (emps.length > 0) sp.set('idEmpresas', emps.join(','));
  const res = await apiFetch(`/api/financeiro/dfc/contas-bancarias?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    nomes?: string[];
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return { nomes: [], erro: body.error ?? body.erro ?? res.statusText };
  }
  return {
    nomes: Array.isArray(body.nomes) ? body.nomes : [],
    erro: body.erro,
  };
}

/** Carga DFC: apenas período e granularidade (empresas 1–4 no servidor). */
export async function fetchDfcAgendamentosEfetivos(params: {
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
}): Promise<DfcAgendamentosEfetivosResponse> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  sp.set('granularidade', params.granularidade);
  const res = await apiFetch(`/api/financeiro/dfc/agendamentos-efetivos?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as DfcAgendamentosEfetivosResponse & { error?: string };
  if (!res.ok) {
    return {
      linhas: [],
      contribuicoes: [],
      granularidade: params.granularidade,
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      idEmpresas: [1, 2, 3, 4],
      erro: body.error ?? body.erro ?? res.statusText,
    };
  }
  return {
    linhas: Array.isArray(body.linhas) ? body.linhas : [],
    contribuicoes: Array.isArray(body.contribuicoes) ? body.contribuicoes : [],
    granularidade: body.granularidade === 'dia' ? 'dia' : 'mes',
    dataInicio: body.dataInicio ?? params.dataInicio,
    dataFim: body.dataFim ?? params.dataFim,
    idEmpresas: Array.isArray(body.idEmpresas) ? body.idEmpresas : [1, 2, 3, 4],
    contasBancariasDisponiveis: Array.isArray(body.contasBancariasDisponiveis)
      ? body.contasBancariasDisponiveis
      : undefined,
    projecaoReceitasPorPeriodo:
      body.projecaoReceitasPorPeriodo && typeof body.projecaoReceitasPorPeriodo === 'object'
        ? body.projecaoReceitasPorPeriodo
        : undefined,
    saldosIniciaisPorPeriodo:
      body.saldosIniciaisPorPeriodo && typeof body.saldosIniciaisPorPeriodo === 'object'
        ? body.saldosIniciaisPorPeriodo
        : undefined,
    saldosFinaisPorPeriodo:
      body.saldosFinaisPorPeriodo && typeof body.saldosFinaisPorPeriodo === 'object'
        ? body.saldosFinaisPorPeriodo
        : undefined,
    saldosPorConta: Array.isArray(body.saldosPorConta) ? body.saldosPorConta : undefined,
    erroSaldosBancarios: body.erroSaldosBancarios,
    erro: body.erro,
  };
}

export interface DfcAgendamentoDetalheLinha {
  id: number;
  descricaoLancamento: string | null;
  nome: string | null;
  dataVencimento: string | null;
  dataBaixa: string | null;
  /** Data de competência (DRE) — critério da grade. */
  dataCompetencia?: string | null;
  valorBaixado: number;
  /** Universo do `id`: 'A' = agendamentofinanceiro.id ; 'L' = lancamentofinanceiro.id. */
  tipoRef: DfcTipoRefLancamento;
  /** idEmpresa Nomus desta linha (chave para a prioridade). */
  idEmpresa: number;
  /** idContaFinanceiro Nomus (chave para a prioridade pelo plano de contas). */
  idContaFinanceiro: number | null;
  /** Nome da empresa (exibição no modal de detalhe). */
  empresa?: string | null;
}

export interface DfcKpis {
  recebimentos: number;
  pagamentos: number;
  vencidosPagar: number;
  vencidosReceber: number;
  aVencerPagar: number;
  aVencerReceber: number;
  saldoBancario: number;
  idEmpresas?: number[];
  erro?: string;
}

export async function fetchDfcKpis(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresas?: number[];
  prioridades?: DfcPrioridade[];
}): Promise<DfcKpis> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  const emps = params.idEmpresas ?? [1];
  sp.set('idEmpresas', emps.join(','));
  if (params.prioridades && params.prioridades.length > 0) {
    sp.set('prioridades', params.prioridades.join(','));
  }
  const res = await apiFetch(`/api/financeiro/dfc/kpis?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as DfcKpis & { error?: string };
  if (!res.ok) {
    return {
      recebimentos: 0, pagamentos: 0, vencidosPagar: 0, vencidosReceber: 0,
      aVencerPagar: 0, aVencerReceber: 0, saldoBancario: 0,
      erro: body.error ?? body.erro ?? res.statusText,
    };
  }
  return {
    recebimentos: body.recebimentos ?? 0,
    pagamentos: body.pagamentos ?? 0,
    vencidosPagar: body.vencidosPagar ?? 0,
    vencidosReceber: body.vencidosReceber ?? 0,
    aVencerPagar: body.aVencerPagar ?? 0,
    aVencerReceber: body.aVencerReceber ?? 0,
    saldoBancario: body.saldoBancario ?? 0,
    idEmpresas: body.idEmpresas,
    erro: body.erro,
  };
}

/** Despesas (agendamento P) em aberto no Nomus — critérios alinhados aos KPIs Vencidos / A vencer a pagar. */
export type DfcDespesaPagamentoSituacaoApi = 'vencido' | 'a_vencer';

export interface DfcDespesaPagamentoEmAbertoLinha {
  situacao: DfcDespesaPagamentoSituacaoApi;
  id: number;
  idEmpresa: number;
  idContaFinanceiro: number | null;
  descricaoLancamento: string | null;
  nome: string | null;
  dataVencimento: string | null;
  saldoBaixar: number;
}

export interface DfcEndividamentoBancarioLinha extends DfcDespesaPagamentoEmAbertoLinha {}

export interface DfcEndividamentoBancarioResponse {
  dataInicio: string;
  dataFim: string;
  idEmpresas: number[];
  total: number;
  vencido: number;
  aVencer: number;
  linhas: DfcEndividamentoBancarioLinha[];
  porFornecedor: Array<{ chave: string; valor: number }>;
  porEmpresa: Array<{ idEmpresa: number; valor: number }>;
  porConta: Array<{ idContaFinanceiro: number; conta: string; valor: number }>;
  erro?: string;
}

export async function fetchDfcEndividamentoBancario(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresas?: number[];
}): Promise<DfcEndividamentoBancarioResponse> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  const emps = params.idEmpresas ?? [1];
  sp.set('idEmpresas', emps.join(','));
  const res = await apiFetch(`/api/financeiro/dfc/endividamento-bancario?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as
    | (DfcEndividamentoBancarioResponse & { error?: string })
    | { error?: string; erro?: string };
  if (!res.ok) {
    return {
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      idEmpresas: emps,
      total: 0,
      vencido: 0,
      aVencer: 0,
      linhas: [],
      porFornecedor: [],
      porEmpresa: [],
      porConta: [],
      erro: (body as { error?: string; erro?: string }).error ?? (body as { error?: string; erro?: string }).erro ?? res.statusText,
    };
  }
  return {
    dataInicio: (body as DfcEndividamentoBancarioResponse).dataInicio ?? params.dataInicio,
    dataFim: (body as DfcEndividamentoBancarioResponse).dataFim ?? params.dataFim,
    idEmpresas: Array.isArray((body as DfcEndividamentoBancarioResponse).idEmpresas)
      ? (body as DfcEndividamentoBancarioResponse).idEmpresas
      : emps,
    total: Number((body as DfcEndividamentoBancarioResponse).total ?? 0),
    vencido: Number((body as DfcEndividamentoBancarioResponse).vencido ?? 0),
    aVencer: Number((body as DfcEndividamentoBancarioResponse).aVencer ?? 0),
    linhas: Array.isArray((body as DfcEndividamentoBancarioResponse).linhas)
      ? (body as DfcEndividamentoBancarioResponse).linhas
      : [],
    porFornecedor: Array.isArray((body as DfcEndividamentoBancarioResponse).porFornecedor)
      ? (body as DfcEndividamentoBancarioResponse).porFornecedor
      : [],
    porEmpresa: Array.isArray((body as DfcEndividamentoBancarioResponse).porEmpresa)
      ? (body as DfcEndividamentoBancarioResponse).porEmpresa
      : [],
    porConta: Array.isArray((body as DfcEndividamentoBancarioResponse).porConta)
      ? (body as DfcEndividamentoBancarioResponse).porConta
      : [],
    erro: (body as DfcEndividamentoBancarioResponse).erro,
  };
}

export async function fetchDfcDespesasPagamentoFornecedorOpcoes(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresas?: number[];
}): Promise<{ nomes: string[]; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  const emps = params.idEmpresas ?? [1];
  sp.set('idEmpresas', emps.join(','));
  const res = await apiFetch(`/api/financeiro/dfc/despesas-em-aberto-fornecedor-opcoes?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    nomes?: string[];
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return { nomes: [], erro: body.error ?? body.erro ?? res.statusText };
  }
  return {
    nomes: Array.isArray(body.nomes) ? body.nomes : [],
    erro: body.erro,
  };
}

export async function fetchDfcDespesasPagamentoEmAberto(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresas?: number[];
  /** Legado — preferir `idsContaFinanceiro`. */
  idContaFinanceiro?: number;
  idsContaFinanceiro?: number[];
  nomesFornecedor?: string[];
}): Promise<{
  linhas: DfcDespesaPagamentoEmAbertoLinha[];
  erro?: string;
}> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  const emps = params.idEmpresas ?? [1];
  sp.set('idEmpresas', emps.join(','));
  const idsMulti = params.idsContaFinanceiro?.filter((n) => n > 0) ?? [];
  if (idsMulti.length > 0) {
    sp.set('idsContaFinanceiro', idsMulti.join(','));
  } else if (params.idContaFinanceiro != null && params.idContaFinanceiro > 0) {
    sp.set('idContaFinanceiro', String(params.idContaFinanceiro));
  }
  for (const n of params.nomesFornecedor ?? []) {
    if (n.trim()) sp.append('fornecedor', n.trim());
  }
  const res = await apiFetch(`/api/financeiro/dfc/despesas-pagamento-em-aberto?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    linhas?: DfcDespesaPagamentoEmAbertoLinha[];
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return {
      linhas: [],
      erro: body.error ?? body.erro ?? res.statusText,
    };
  }
  return {
    linhas: Array.isArray(body.linhas) ? body.linhas : [],
    erro: body.erro,
  };
}

export interface DfcSaldoFaturarLinha {
  idEmpresa: number;
  idPedido: number;
  tipoPedido: string | null;
  idParcela: number | null;
  pd: string | null;
  dataEmissao: string | null;
  dataPrevisao: string | null;
  dataVencimento: string | null;
  parc: number | null;
  cliente: string | null;
  requisicaoLojaGrupo: string | null;
  uf: string | null;
  municipioEntrega: string | null;
  formaPagamento: string | null;
  condicaoPagamento: string | null;
  regra: number | null;
  valorTotalComDescontoIpi: number;
  valorPendente: number;
  vendaPorEmpresa: string | null;
  vendedorRepresentante: string | null;
  valorAdiantamento: number | null;
  saldoFaturarReal: number;
  qtdeParcelas: number | null;
  dataProjVenc: string | null;
}

export async function fetchDfcSaldoFaturar(params: {
  idEmpresas?: number[];
  dataEmissaoInicio?: string;
  dataEmissaoFim?: string;
  dataVencimentoInicio?: string;
  dataVencimentoFim?: string;
  dataPrevisaoInicio?: string;
  dataPrevisaoFim?: string;
  pd?: string;
  cliente?: string;
  uf?: string;
  tipoPedido?: string;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}): Promise<{
  linhas: DfcSaldoFaturarLinha[];
  truncado?: boolean;
  hasMore?: boolean;
  page?: number;
  limit?: number;
  erro?: string;
}> {
  const sp = new URLSearchParams();
  const emps = params.idEmpresas ?? [1];
  if (emps.length > 0) sp.set('idEmpresas', emps.join(','));
  if (params.page != null && params.page > 0) sp.set('page', String(params.page));
  if (params.limit != null && params.limit > 0) sp.set('limit', String(params.limit));
  if (params.dataEmissaoInicio) sp.set('dataEmissaoInicio', params.dataEmissaoInicio);
  if (params.dataEmissaoFim) sp.set('dataEmissaoFim', params.dataEmissaoFim);
  if (params.dataVencimentoInicio) sp.set('dataVencimentoInicio', params.dataVencimentoInicio);
  if (params.dataVencimentoFim) sp.set('dataVencimentoFim', params.dataVencimentoFim);
  if (params.dataPrevisaoInicio) sp.set('dataPrevisaoInicio', params.dataPrevisaoInicio);
  if (params.dataPrevisaoFim) sp.set('dataPrevisaoFim', params.dataPrevisaoFim);
  if (params.pd?.trim()) sp.set('pd', params.pd.trim());
  if (params.cliente?.trim()) sp.set('cliente', params.cliente.trim());
  if (params.uf?.trim()) sp.set('uf', params.uf.trim());
  if (params.tipoPedido?.trim()) sp.set('tipoPedido', params.tipoPedido.trim());

  const res = await apiFetch(`/api/financeiro/dfc/saldo-faturar?${sp.toString()}`, {
    signal: params.signal,
  });
  const body = (await res.json().catch(() => ({}))) as {
    linhas?: DfcSaldoFaturarLinha[];
    truncado?: boolean;
    hasMore?: boolean;
    page?: number;
    limit?: number;
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return { linhas: [], erro: body.error ?? body.erro ?? res.statusText };
  }
  return {
    linhas: Array.isArray(body.linhas) ? body.linhas : [],
    truncado: body.truncado === true,
    hasMore: body.hasMore === true,
    page: body.page,
    limit: body.limit,
    erro: body.erro,
  };
}

export async function fetchDfcAgendamentosDetalhe(params: {
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  ids: number[];
  /** Se omitido, retorna lançamentos de todo o intervalo (ex.: coluna Total). */
  periodo?: string;
  idEmpresas?: number[];
  contasBancarias?: string[];
  prioridades?: DfcPrioridade[];
  signal?: AbortSignal;
}): Promise<{
  detalhes: DfcAgendamentoDetalheLinha[];
  truncado?: boolean;
  erro?: string;
}> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  sp.set('granularidade', params.granularidade);
  sp.set('ids', params.ids.filter((n) => n > 0).join(','));
  if (params.periodo) sp.set('periodo', params.periodo);
  const detEmps = params.idEmpresas?.length ? params.idEmpresas : [1, 2, 3, 4];
  sp.set('idEmpresas', detEmps.join(','));
  appendContasBancariasQuery(sp, params.contasBancarias);
  if (params.prioridades && params.prioridades.length > 0) {
    sp.set('prioridades', params.prioridades.join(','));
  }
  const res = await apiFetch(`/api/financeiro/dfc/agendamentos-efetivos-detalhe?${sp.toString()}`, {
    signal: params.signal,
  });
  const body = (await res.json().catch(() => ({}))) as {
    detalhes?: DfcAgendamentoDetalheLinha[];
    truncado?: boolean;
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return {
      detalhes: [],
      erro: body.error ?? body.erro ?? res.statusText,
    };
  }
  return {
    detalhes: Array.isArray(body.detalhes) ? body.detalhes : [],
    truncado: body.truncado === true,
    erro: body.erro,
  };
}

export interface DreReceitaVendasProdutoLinha {
  mes: number;
  ano: number;
  grupoProduto: string;
  idItemPedidoSM: string;
  valorTotal: number;
  totalDesconto: number;
}

export interface DreReceitaMoveisDiretoLinha {
  mes: number;
  ano: number;
  dataEmissao: string;
  valorTotal: number;
  totalDesconto: number;
}

export async function fetchDreReceitaMoveisDireto(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresaSaida?: number;
}): Promise<{ linhas: DreReceitaMoveisDiretoLinha[]; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  if (params.idEmpresaSaida != null && params.idEmpresaSaida > 0) {
    sp.set('idEmpresaSaida', String(params.idEmpresaSaida));
  }
  const res = await apiFetch(`/api/financeiro/dre/receita-moveis-direto?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    linhas?: DreReceitaMoveisDiretoLinha[];
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return { linhas: [], erro: body.error ?? body.erro ?? res.statusText };
  }
  return {
    linhas: Array.isArray(body.linhas) ? body.linhas : [],
    erro: body.erro,
  };
}

export async function fetchDreReceitaMoveisDiretoDetalhe(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresaSaida?: number;
}): Promise<{ detalhes: DreReceitaVendasDetalheLinha[]; truncado?: boolean; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  if (params.idEmpresaSaida != null && params.idEmpresaSaida > 0) {
    sp.set('idEmpresaSaida', String(params.idEmpresaSaida));
  }
  const res = await apiFetch(`/api/financeiro/dre/receita-moveis-direto/detalhe?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    detalhes?: DreReceitaVendasDetalheLinha[];
    truncado?: boolean;
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return { detalhes: [], erro: body.error ?? body.erro ?? res.statusText };
  }
  return {
    detalhes: Array.isArray(body.detalhes) ? body.detalhes : [],
    truncado: body.truncado === true,
    erro: body.erro,
  };
}

export async function fetchDreReceitaVendasProdutos(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresaSaida?: number;
}): Promise<{ linhas: DreReceitaVendasProdutoLinha[]; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  if (params.idEmpresaSaida != null && params.idEmpresaSaida > 0) {
    sp.set('idEmpresaSaida', String(params.idEmpresaSaida));
  }
  const res = await apiFetch(`/api/financeiro/dre/receita-vendas-produtos?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    linhas?: DreReceitaVendasProdutoLinha[];
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return { linhas: [], erro: body.error ?? body.erro ?? res.statusText };
  }
  return {
    linhas: Array.isArray(body.linhas) ? body.linhas : [],
    erro: body.erro,
  };
}

export interface DreCpvSoAcoLinhaApi {
  mes: number;
  ano: number;
  grupoProduto: string;
  custoTotal: number;
}

export interface DreCpvMoveisDiretoLinha {
  mes: number;
  ano: number;
  dataEmissao: string;
  custoTotal: number;
}

export interface DreDevolucoesLinha {
  idEmpresaEntrada: number;
  mes: number;
  ano: number;
  dataEmissao: string;
  valorTotal: number;
}

export async function fetchDreDevolucoes(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresas: number[];
}): Promise<{ linhas: DreDevolucoesLinha[]; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  if (params.idEmpresas.length) {
    sp.set('idEmpresas', params.idEmpresas.join(','));
  }
  const res = await apiFetch(`/api/financeiro/dre/devolucoes?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    linhas?: DreDevolucoesLinha[];
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return { linhas: [], erro: body.error ?? body.erro ?? res.statusText };
  }
  return {
    linhas: Array.isArray(body.linhas) ? body.linhas : [],
    erro: body.erro,
  };
}

export interface DreDevolucoesDetalheLinha {
  idItemDocumentoEstoque: number;
  idEmpresaEntrada: number;
  dataEmissao: string | null;
  numeroDocumentoFiscal: number | null;
  tipoMovimentacao: string | null;
  idProduto: number | null;
  produto: string | null;
  grupoProduto: string;
  qtde: number;
  valorUnitario: number;
  valorTotal: number;
}

export async function fetchDreDevolucoesDetalhe(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresa: number;
}): Promise<{ detalhes: DreDevolucoesDetalheLinha[]; truncado?: boolean; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  sp.set('idEmpresa', String(params.idEmpresa));
  const res = await apiFetch(`/api/financeiro/dre/devolucoes/detalhe?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    detalhes?: DreDevolucoesDetalheLinha[];
    truncado?: boolean;
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return { detalhes: [], erro: body.error ?? body.erro ?? res.statusText };
  }
  return {
    detalhes: Array.isArray(body.detalhes) ? body.detalhes : [],
    truncado: body.truncado === true,
    erro: body.erro,
  };
}

export async function fetchDreCpvMoveisDireto(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresaSaida?: number;
}): Promise<{ linhas: DreCpvMoveisDiretoLinha[]; erro?: string; aviso?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  if (params.idEmpresaSaida != null && params.idEmpresaSaida > 0) {
    sp.set('idEmpresaSaida', String(params.idEmpresaSaida));
  }
  const res = await apiFetch(`/api/financeiro/dre/cpv-moveis-direto?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    linhas?: DreCpvMoveisDiretoLinha[];
    erro?: string;
    aviso?: string;
    error?: string;
  };
  if (!res.ok) {
    return { linhas: [], erro: body.error ?? body.erro ?? res.statusText, aviso: body.aviso };
  }
  return {
    linhas: Array.isArray(body.linhas) ? body.linhas : [],
    erro: body.erro,
    aviso: body.aviso,
  };
}

export async function fetchDreCpvSoAco(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresaSaida?: number;
}): Promise<{
  direto: DreCpvSoAcoLinhaApi[];
  indireto: DreCpvSoAcoLinhaApi[];
  indiretoSemMkp: DreCpvSoAcoLinhaApi[];
  erro?: string;
}> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  if (params.idEmpresaSaida != null && params.idEmpresaSaida > 0) {
    sp.set('idEmpresaSaida', String(params.idEmpresaSaida));
  }
  const res = await apiFetch(`/api/financeiro/dre/cpv-so-aco?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    direto?: DreCpvSoAcoLinhaApi[];
    indireto?: DreCpvSoAcoLinhaApi[];
    indiretoSemMkp?: DreCpvSoAcoLinhaApi[];
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return { direto: [], indireto: [], indiretoSemMkp: [], erro: body.error ?? body.erro ?? res.statusText };
  }
  return {
    direto: Array.isArray(body.direto) ? body.direto : [],
    indireto: Array.isArray(body.indireto) ? body.indireto : [],
    indiretoSemMkp: Array.isArray(body.indiretoSemMkp) ? body.indiretoSemMkp : [],
    erro: body.erro,
  };
}

export interface DreReceitaVendasDetalheLinha {
  idItemDocumentoEstoque: number;
  idItemPedido: number | null;
  pedido: string | null;
  idItemPedidoSM: string;
  dataEmissao: string | null;
  tipoMovimentacao: string | null;
  statusNfe: string | null;
  idProduto: number | null;
  produto: string | null;
  qtde: number;
  valorUnitario: number;
  valorTotal: number;
  totalDesconto: number;
  valorTotalComDesconto: number;
  grupoProduto: string;
  familiaProduto: string | null;
  mes: number;
  ano: number;
  numeroDocumentoFiscal: number | null;
}

export async function fetchDreReceitaVendasDetalhe(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresaSaida?: number;
  grupoProduto?: string;
}): Promise<{ detalhes: DreReceitaVendasDetalheLinha[]; truncado?: boolean; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  if (params.idEmpresaSaida != null && params.idEmpresaSaida > 0) {
    sp.set('idEmpresaSaida', String(params.idEmpresaSaida));
  }
  if (params.grupoProduto?.trim()) {
    sp.set('grupoProduto', params.grupoProduto.trim());
  }
  const res = await apiFetch(`/api/financeiro/dre/receita-vendas-produtos/detalhe?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    detalhes?: DreReceitaVendasDetalheLinha[];
    truncado?: boolean;
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return { detalhes: [], erro: body.error ?? body.erro ?? res.statusText };
  }
  return {
    detalhes: Array.isArray(body.detalhes) ? body.detalhes : [],
    truncado: body.truncado === true,
    erro: body.erro,
  };
}

export interface DreReceitaIndiretaBrutoLinha {
  mes: number;
  ano: number;
  valorTotal: number;
}

export interface DreReceitaIndiretaLiquidoLinha {
  mes: number;
  ano: number;
  grupoProduto: string;
  valorLiquido: number;
}

export async function fetchDreReceitaIndiretaProdutos(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresaSaida?: number;
}): Promise<{
  bruto: DreReceitaIndiretaBrutoLinha[];
  liquido: DreReceitaIndiretaLiquidoLinha[];
  erro?: string;
}> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  if (params.idEmpresaSaida != null && params.idEmpresaSaida > 0) {
    sp.set('idEmpresaSaida', String(params.idEmpresaSaida));
  }
  const res = await apiFetch(`/api/financeiro/dre/receita-indireta-produtos?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    bruto?: DreReceitaIndiretaBrutoLinha[];
    liquido?: DreReceitaIndiretaLiquidoLinha[];
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return { bruto: [], liquido: [], erro: body.error ?? body.erro ?? res.statusText };
  }
  return {
    bruto: Array.isArray(body.bruto) ? body.bruto : [],
    liquido: Array.isArray(body.liquido) ? body.liquido : [],
    erro: body.erro,
  };
}

export interface DreReceitaIndiretaDetalheLinha {
  idItemDocumentoEstoque: number;
  idItemPedido: number | null;
  pedido: string | null;
  idItemPedidoSM: string;
  dataEmissao: string | null;
  tipoMovimentacao: string | null;
  statusNfe: string | null;
  idProduto: number | null;
  produto: string | null;
  qtde: number;
  valorUnitario: number;
  valorTotal: number;
  totalDesconto: number;
  valorTotalComDesconto: number;
  grupoProduto: string;
  familiaProduto: string | null;
  mes: number;
  ano: number;
  numeroDocumentoFiscal: number | null;
  percMarkup: number;
  valorIndireto: number;
}

export type DreSaidasSoAcoLinhaApi = {
  pathKey: string;
  periodo: string;
  valor: number;
};

export type DreSaidasSoAcoNaoMapeado = {
  idContaFinanceiro: number | null;
  nomePlanoFinanceiro: string;
  valor: number;
  quantidade: number;
};

export async function fetchDreSaidasSoAco(params: {
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  /** Padrão no backend: 1 (Só Aço) e 2 (Só Móveis). */
  idEmpresas?: number[];
}): Promise<{
  linhas: DreSaidasSoAcoLinhaApi[];
  naoMapeados: DreSaidasSoAcoNaoMapeado[];
  totalBruto: number;
  totalMapeado: number;
  idsPorPathKey?: Record<string, number[]>;
  idsPorPathKeyShop9?: Record<string, number[]>;
  /** Catálogo Shop9 por pathKey — drill-down rateio (independente do filtro da grade). */
  shop9OrdensCatalogoPorPathKey?: Record<string, number[]>;
  /** shop9 = Só Aço via Shop9; nomus = demais empresas; shop9+nomus = combinação. */
  fonteSaidas?: 'shop9' | 'nomus' | 'shop9+nomus';
  /** Simples Nacional direto filial 6 (RN Marques) por período — base do rateio 4.14. */
  simplesNacionalFilial6PorPeriodo?: Record<string, number>;
  erro?: string;
}> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  sp.set('granularidade', params.granularidade);
  const empresas =
    params.idEmpresas?.filter((n) => Number.isFinite(n) && n > 0) ?? [1, 2];
  if (empresas.length > 0) {
    sp.set('idEmpresas', empresas.map(String).join(','));
  }
  const res = await apiFetch(`/api/financeiro/dre/saidas-soaco?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    linhas?: DreSaidasSoAcoLinhaApi[];
    naoMapeados?: DreSaidasSoAcoNaoMapeado[];
    totalBruto?: number;
    totalMapeado?: number;
    idsPorPathKey?: Record<string, number[]>;
    idsPorPathKeyShop9?: Record<string, number[]>;
    shop9OrdensCatalogoPorPathKey?: Record<string, number[]>;
    fonteSaidas?: 'shop9' | 'nomus' | 'shop9+nomus';
    simplesNacionalFilial6PorPeriodo?: Record<string, number>;
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return {
      linhas: [],
      naoMapeados: [],
      totalBruto: 0,
      totalMapeado: 0,
      erro: body.error ?? body.erro ?? res.statusText,
    };
  }
  return {
    linhas: Array.isArray(body.linhas) ? body.linhas : [],
    naoMapeados: Array.isArray(body.naoMapeados) ? body.naoMapeados : [],
    totalBruto: Number(body.totalBruto) || 0,
    totalMapeado: Number(body.totalMapeado) || 0,
    idsPorPathKey: body.idsPorPathKey ?? {},
    idsPorPathKeyShop9: body.idsPorPathKeyShop9 ?? {},
    shop9OrdensCatalogoPorPathKey: body.shop9OrdensCatalogoPorPathKey ?? {},
    fonteSaidas: body.fonteSaidas,
    simplesNacionalFilial6PorPeriodo: body.simplesNacionalFilial6PorPeriodo ?? {},
    erro: body.erro ?? body.error,
  };
}

export async function fetchDreFornecedorOpcoes(params: {
  pathKey: string;
}): Promise<{ nomes: string[]; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('pathKey', params.pathKey.trim());
  const res = await apiFetch(`/api/financeiro/dre/saidas-soaco/fornecedor-opcoes?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as { nomes?: string[]; erro?: string; error?: string };
  if (!res.ok) return { nomes: [], erro: body.error ?? body.erro ?? res.statusText };
  return { nomes: Array.isArray(body.nomes) ? body.nomes : [], erro: body.erro ?? body.error };
}

export async function fetchDreRateioFornecedorTotais(params: {
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  pathKey: string;
  nomesFornecedor: string[];
  idEmpresas?: number[];
  /** Pool completo (todas filiais) para calcular fatia de rateio. */
  poolRateio?: boolean;
}): Promise<{ totaisPorPeriodo: Record<string, number>; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  sp.set('granularidade', params.granularidade);
  sp.set('pathKey', params.pathKey);
  if (params.poolRateio) sp.set('poolRateio', '1');
  const empresas = params.idEmpresas?.filter((n) => Number.isFinite(n) && n > 0) ?? [1, 2, 3, 4];
  if (empresas.length > 0) sp.set('idEmpresas', empresas.join(','));
  for (const nome of params.nomesFornecedor) {
    if (nome.trim()) sp.append('fornecedor', nome.trim());
  }
  const res = await apiFetch(`/api/financeiro/dre/saidas-soaco/rateio-fornecedores?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    totaisPorPeriodo?: Record<string, number>;
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return { totaisPorPeriodo: {}, erro: body.error ?? body.erro ?? res.statusText };
  }
  return {
    totaisPorPeriodo: body.totaisPorPeriodo ?? {},
    erro: body.erro ?? body.error,
  };
}

export async function fetchDreSaidasSoAcoDetalhe(params: {
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  ids: number[];
  periodo?: string;
  idEmpresas?: number[];
  signal?: AbortSignal;
}): Promise<{ detalhes: DfcAgendamentoDetalheLinha[]; truncado?: boolean; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  sp.set('granularidade', params.granularidade);
  sp.set('ids', params.ids.join(','));
  if (params.periodo) sp.set('periodo', params.periodo);
  const empresas = params.idEmpresas?.filter((n) => Number.isFinite(n) && n > 0) ?? [1, 2, 3, 4];
  if (empresas.length > 0) sp.set('idEmpresas', empresas.join(','));
  const res = await apiFetch(`/api/financeiro/dre/saidas-soaco/detalhe?${sp.toString()}`, {
    signal: params.signal,
  });
  const body = (await res.json().catch(() => ({}))) as {
    detalhes?: DfcAgendamentoDetalheLinha[];
    truncado?: boolean;
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return { detalhes: [], erro: body.error ?? body.erro ?? res.statusText };
  }
  return {
    detalhes: Array.isArray(body.detalhes) ? body.detalhes : [],
    truncado: body.truncado,
    erro: body.erro ?? body.error,
  };
}

export async function fetchDreSaidasNomusDetalhe(params: {
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  ids: number[];
  periodo?: string;
  idEmpresas?: number[];
  signal?: AbortSignal;
}): Promise<{ detalhes: DfcAgendamentoDetalheLinha[]; truncado?: boolean; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  sp.set('granularidade', params.granularidade);
  sp.set('ids', params.ids.join(','));
  if (params.periodo) sp.set('periodo', params.periodo);
  const empresas = params.idEmpresas?.filter((n) => Number.isFinite(n) && n > 0) ?? [1, 2, 3, 4];
  if (empresas.length > 0) sp.set('idEmpresas', empresas.join(','));
  const res = await apiFetch(`/api/financeiro/dre/saidas-soaco/detalhe-nomus?${sp.toString()}`, {
    signal: params.signal,
  });
  const body = (await res.json().catch(() => ({}))) as {
    detalhes?: DfcAgendamentoDetalheLinha[];
    truncado?: boolean;
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return { detalhes: [], erro: body.error ?? body.erro ?? res.statusText };
  }
  return {
    detalhes: Array.isArray(body.detalhes) ? body.detalhes : [],
    truncado: body.truncado,
    erro: body.erro ?? body.error,
  };
}

export async function fetchDreReceitaRefrigeracaoShop9(params: {
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  idEmpresas?: number[];
}): Promise<{ linhas: DreSaidasSoAcoLinhaApi[]; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  sp.set('granularidade', params.granularidade);
  const empresas =
    params.idEmpresas?.filter((n) => Number.isFinite(n) && n > 0) ?? [3];
  if (empresas.length > 0) {
    sp.set('idEmpresas', empresas.map(String).join(','));
  }
  const res = await apiFetch(`/api/financeiro/dre/receita-refrigeracao-shop9?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    linhas?: DreSaidasSoAcoLinhaApi[];
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return { linhas: [], erro: body.error ?? body.erro ?? res.statusText };
  }
  return {
    linhas: Array.isArray(body.linhas) ? body.linhas : [],
    erro: body.erro ?? body.error,
  };
}

export async function fetchDreReceitaIndiretaDetalhe(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresaSaida?: number;
  grupoProduto?: string;
}): Promise<{ detalhes: DreReceitaIndiretaDetalheLinha[]; truncado?: boolean; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  if (params.idEmpresaSaida != null && params.idEmpresaSaida > 0) {
    sp.set('idEmpresaSaida', String(params.idEmpresaSaida));
  }
  if (params.grupoProduto?.trim()) {
    sp.set('grupoProduto', params.grupoProduto.trim());
  }
  const res = await apiFetch(`/api/financeiro/dre/receita-indireta-produtos/detalhe?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    detalhes?: DreReceitaIndiretaDetalheLinha[];
    truncado?: boolean;
    erro?: string;
    error?: string;
  };
  if (!res.ok) {
    return { detalhes: [], erro: body.error ?? body.erro ?? res.statusText };
  }
  return {
    detalhes: Array.isArray(body.detalhes) ? body.detalhes : [],
    truncado: body.truncado === true,
    erro: body.erro,
  };
}

export type DreRelacaoPcContaApi = {
  pathKey: string;
  codigo: string;
  nome: string;
  tipo: 'A' | 'S';
  nomus: { id: number; nome: string; origem: 'automatico' | 'manual' }[];
  shop9: { ordem: number; nome: string; origem: 'automatico' | 'manual' }[];
  nomusIdsAdicionais: number[];
  nomusIdsExcluidos: number[];
  shop9OrdensAdicionais: number[];
  shop9OrdensExcluidos: number[];
};

export type DreRelacaoPcPayload = {
  contas: DreRelacaoPcContaApi[];
  catalogoNomus: { id: number; nome: string }[];
  catalogoShop9: { ordem: number; nome: string }[];
  fonteNomus: 'live' | 'json';
  fonteShop9: 'live' | 'indisponivel';
  erroNomus?: string;
  erroShop9?: string;
};

export async function fetchDreRelacaoPc(): Promise<DreRelacaoPcPayload & { erro?: string }> {
  const res = await apiFetch('/api/financeiro/dre/relacao-pc');
  const body = (await res.json().catch(() => ({}))) as DreRelacaoPcPayload & { error?: string };
  if (!res.ok) {
    return {
      contas: [],
      catalogoNomus: [],
      catalogoShop9: [],
      fonteNomus: 'json',
      fonteShop9: 'indisponivel',
      erro: body.error ?? res.statusText,
    };
  }
  return {
    contas: Array.isArray(body.contas) ? body.contas : [],
    catalogoNomus: Array.isArray(body.catalogoNomus) ? body.catalogoNomus : [],
    catalogoShop9: Array.isArray(body.catalogoShop9) ? body.catalogoShop9 : [],
    fonteNomus: body.fonteNomus ?? 'json',
    fonteShop9: body.fonteShop9 ?? 'indisponivel',
    erroNomus: body.erroNomus,
    erroShop9: body.erroShop9,
  };
}

export async function salvarDreRelacaoPcPathKey(body: {
  pathKey: string;
  nomusIdsAdicionais?: number[];
  nomusIdsExcluidos?: number[];
  shop9OrdensAdicionais?: number[];
  shop9OrdensExcluidos?: number[];
}): Promise<{ ok?: boolean; conta?: DreRelacaoPcContaApi | null; erro?: string }> {
  const res = await apiFetch('/api/financeiro/dre/relacao-pc', {
    method: 'PUT',
    body,
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    conta?: DreRelacaoPcContaApi | null;
    error?: string;
  };
  if (!res.ok) return { erro: json.error ?? res.statusText };
  return { ok: json.ok, conta: json.conta ?? null };
}

export type DreRateioConfigApi = {
  regras: unknown[];
  atualizadoEm?: string | null;
  vazio?: boolean;
  gravado?: boolean;
  erro?: string;
};

export async function fetchDreRateioConfig(): Promise<DreRateioConfigApi> {
  const res = await apiFetch('/api/financeiro/dre/rateio-config');
  const body = (await res.json().catch(() => ({}))) as DreRateioConfigApi & { error?: string };
  if (!res.ok) {
    return { regras: [], vazio: true, erro: body.error ?? res.statusText };
  }
  return {
    regras: Array.isArray(body.regras) ? body.regras : [],
    atualizadoEm: body.atualizadoEm ?? null,
    vazio: body.vazio ?? (!Array.isArray(body.regras) || body.regras.length === 0),
  };
}

export async function salvarDreRateioConfigApi(
  config: { regras: unknown[] },
  opts?: { somenteSeVazio?: boolean },
): Promise<DreRateioConfigApi & { ok?: boolean }> {
  const qs = opts?.somenteSeVazio ? '?somenteSeVazio=1' : '';
  const res = await apiFetch(`/api/financeiro/dre/rateio-config${qs}`, {
    method: 'PUT',
    body: config,
  });
  const body = (await res.json().catch(() => ({}))) as DreRateioConfigApi & {
    ok?: boolean;
    error?: string;
  };
  if (!res.ok) {
    return { regras: [], vazio: true, erro: body.error ?? res.statusText };
  }
  return {
    ok: body.ok,
    regras: Array.isArray(body.regras) ? body.regras : [],
    atualizadoEm: body.atualizadoEm ?? null,
    vazio: body.vazio ?? false,
    gravado: body.gravado,
  };
}

export type DreDashboardKpi = {
  id: string;
  label: string;
  valor: number;
  momPct: number | null;
  yoyPct: number | null;
  pctFaturamento: number | null;
  inverso?: boolean;
  breakdown?: {
    operacional: { valor: number; pctTotal: number | null };
    logistica: { valor: number; pctTotal: number | null };
    administrativo: { valor: number; pctTotal: number | null };
  };
};

export type DreDashboardPayload = {
  unidade: { id: string; label: string; idEmpresas: number[] };
  dataInicio: string;
  dataFim: string;
  periodos: string[];
  vazio: boolean;
  kpis: DreDashboardKpi[];
  series: {
    evolucao12m: {
      periodo: string;
      faturamento: number;
      lucroBruto: number;
      ebitda: number;
      lucroLiquido: number;
      faturamentoAnoAnt: number | null;
      lucroBrutoAnoAnt: number | null;
      ebitdaAnoAnt: number | null;
      lucroLiquidoAnoAnt: number | null;
    }[];
    margens: {
      periodo: string;
      margemBruta: number | null;
      margemEbitda: number | null;
      margemLiquida: number | null;
    }[];
    pessoal: {
      periodo: string;
      operacional: number;
      logistica: number;
      administrativo: number;
    }[];
    empresas: {
      unidadeId: string;
      label: string;
      faturamento: number;
      cpv: number;
      lucroBruto: number;
      despOp: number;
      ebitda: number;
      lucroLiquido: number;
      margemLiquida: number | null;
    }[];
  };
  waterfall: { id: string; label: string; valor: number; tipo: string }[];
  despesasPrincipais: {
    total: number;
    fatias: {
      id: string;
      codigo: string;
      label: string;
      pathKey: string;
      valor: number;
      pctTotal: number | null;
      detalhes: {
        codigo: string;
        label: string;
        pathKey: string;
        valor: number;
        pctGrupo: number | null;
      }[];
    }[];
  };
  analise: {
    pontoEquilibrio: number | null;
    faturamentoMetaEbitda: number | null;
    faturamentoMetaLucro: number | null;
    metaEbitdaPct: number;
    metaLucroPct: number;
    premissas: {
      cpvPct: number;
      custosFixos: number;
      margemContribuicaoPct: number;
      descricao: string;
    };
  };
  insights: { severidade: 'positivo' | 'atencao' | 'critico'; titulo: string; texto: string }[];
  erro?: string;
};

export async function fetchDreDashboard(params: {
  dataInicio: string;
  dataFim: string;
  unidade?: string;
  metaEbitdaPct?: number;
  metaLucroPct?: number;
}): Promise<DreDashboardPayload> {
  const sp = new URLSearchParams({
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
    unidade: params.unidade ?? 'todas',
  });
  if (params.metaEbitdaPct != null) sp.set('metaEbitda', String(params.metaEbitdaPct));
  if (params.metaLucroPct != null) sp.set('metaLucro', String(params.metaLucroPct));
  const res = await apiFetch(`/api/financeiro/dre/dashboard?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as DreDashboardPayload & { error?: string };
  if (!res.ok) {
    return {
      unidade: { id: 'todas', label: 'Todas', idEmpresas: [] },
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      periodos: [],
      vazio: true,
      kpis: [],
      series: { evolucao12m: [], margens: [], pessoal: [], empresas: [] },
      waterfall: [],
      despesasPrincipais: { total: 0, fatias: [] },
      analise: {
        pontoEquilibrio: null,
        faturamentoMetaEbitda: null,
        faturamentoMetaLucro: null,
        metaEbitdaPct: 12,
        metaLucroPct: 3,
        premissas: { cpvPct: 0, custosFixos: 0, margemContribuicaoPct: 0, descricao: '' },
      },
      insights: [],
      erro: body.error ?? res.statusText,
    };
  }
  return {
    ...body,
    kpis: Array.isArray(body.kpis) ? body.kpis : [],
    series: body.series ?? { evolucao12m: [], margens: [], pessoal: [], empresas: [] },
    waterfall: Array.isArray(body.waterfall) ? body.waterfall : [],
    despesasPrincipais: body.despesasPrincipais ?? { total: 0, fatias: [] },
    analise: body.analise ?? {
      pontoEquilibrio: null,
      faturamentoMetaEbitda: null,
      faturamentoMetaLucro: null,
      metaEbitdaPct: params.metaEbitdaPct ?? 12,
      metaLucroPct: params.metaLucroPct ?? 3,
      premissas: { cpvPct: 0, custosFixos: 0, margemContribuicaoPct: 0, descricao: '' },
    },
    insights: Array.isArray(body.insights) ? body.insights : [],
    vazio: Boolean(body.vazio),
  };
}

/* ��� Carteira Financeira ��� */

export type CarteiraFinanceiraLinha = {
  idEmpresa: number;
  id: number;
  Observacoes: string | null;
  RM: string | null;
  'Tipo Pedido': string | null;
  PD: string | null;
  Emissao: string | null;
  Cliente: string | null;
  'Data de entrega': string | null;
  'Metodo de Entrega': string | null;
  'Requisicao de loja do grupo?': string | null;
  UF: string | null;
  'Municipio de entrega': string | null;
  'Forma de Pagamento': string | null;
  'Condicao de pagamento do pedido de venda': string | null;
  'Valor Original Pedido': number;
  'Valor Total': number;
  'Valor Pendente': number;
  'Valor Romaneado': number;
  'Valor Adiantamento': number;
  'Valor Faturado Entrega Futura + IPI': number;
  'Saldo a Faturar Real': number;
  'Data base entrega futura': string | null;
  'Venda por qual empresa?': string | null;
  'Vendedor/Representante': string | null;
  dataParametro: string | null;
  tipoF: string | null;
  StatusPedido: string | null;
};

export type CarteiraFinanceiraResumo = {
  saldoAReceber: number;
  saldoAFaturar: number;
  saldoRomaneado: number;
  totalPedidos: number;
  pedidosAtrasados: number;
  pctAtrasados: number;
  ticketMedio: number;
};

export type CarteiraMapaPonto = {
  municipio: string;
  uf: string;
  lat: number;
  lng: number;
  saldoAReceber: number;
  saldoAFaturar: number;
  saldoRomaneado: number;
  qtdPedidos: number;
  qtdClientes: number;
};

export type CarteiraFinanceiraPayload = {
  linhas: CarteiraFinanceiraLinha[];
  resumo: CarteiraFinanceiraResumo;
  mapaPontos: CarteiraMapaPonto[];
  semLocalizacao: number;
  opcoes: {
    uf: string[];
    cliente: string[];
    empresa: string[];
    condicaoPagamento: string[];
    tipoF: string[];
  };
  erro?: string;
};

export type CarteiraFinanceiraFiltrosParams = {
  dataInicio?: string;
  dataFim?: string;
  uf?: string[];
  cliente?: string[];
  empresa?: string[];
  statusPedido?: string;
  tipoF?: string[];
  condicaoPagamento?: string[];
  municipio?: string[];
};

const CARTEIRA_VAZIA: CarteiraFinanceiraPayload = {
  linhas: [],
  resumo: {
    saldoAReceber: 0,
    saldoAFaturar: 0,
    saldoRomaneado: 0,
    totalPedidos: 0,
    pedidosAtrasados: 0,
    pctAtrasados: 0,
    ticketMedio: 0,
  },
  mapaPontos: [],
  semLocalizacao: 0,
  opcoes: { uf: [], cliente: [], empresa: [], condicaoPagamento: [], tipoF: [] },
};

export async function fetchCarteiraFinanceira(
  params: CarteiraFinanceiraFiltrosParams = {}
): Promise<CarteiraFinanceiraPayload> {
  const sp = new URLSearchParams();
  if (params.dataInicio) sp.set('dataInicio', params.dataInicio);
  if (params.dataFim) sp.set('dataFim', params.dataFim);
  if (params.statusPedido) sp.set('statusPedido', params.statusPedido);
  for (const [key, list] of [
    ['uf', params.uf],
    ['cliente', params.cliente],
    ['empresa', params.empresa],
    ['tipoF', params.tipoF],
    ['condicaoPagamento', params.condicaoPagamento],
    ['municipio', params.municipio],
  ] as const) {
    if (list?.length) sp.set(key, list.join(','));
  }
  const qs = sp.toString();
  const res = await apiFetch(`/api/financeiro/carteira-financeira${qs ? `?${qs}` : ''}`);
  const body = (await res.json().catch(() => ({}))) as CarteiraFinanceiraPayload & { error?: string };
  if (!res.ok) {
    return { ...CARTEIRA_VAZIA, erro: body.error ?? body.erro ?? res.statusText };
  }
  return {
    ...CARTEIRA_VAZIA,
    ...body,
    linhas: Array.isArray(body.linhas) ? body.linhas : [],
    resumo: body.resumo ?? CARTEIRA_VAZIA.resumo,
    mapaPontos: Array.isArray(body.mapaPontos) ? body.mapaPontos : [],
    semLocalizacao: Number(body.semLocalizacao) || 0,
    opcoes: {
      uf: Array.isArray(body.opcoes?.uf) ? body.opcoes.uf : [],
      cliente: Array.isArray(body.opcoes?.cliente) ? body.opcoes.cliente : [],
      empresa: Array.isArray(body.opcoes?.empresa) ? body.opcoes.empresa : [],
      condicaoPagamento: Array.isArray(body.opcoes?.condicaoPagamento) ? body.opcoes.condicaoPagamento : [],
      tipoF: Array.isArray(body.opcoes?.tipoF) ? body.opcoes.tipoF : [],
    },
    erro: body.erro,
  };
}
