import { apiFetch } from './client';

export type StatusConformidadePainel = 'ok' | 'alerta' | 'nao_conforme' | 'excluido_politica';
export type FaixaTicketPainel = 'ate_3000' | 'entre_3001_10000' | 'acima_10000';

/** Data do painel em `YYYY-MM-DD` → exibição `dd/MM/yyyy`. */
export function formatEmissaoPainelBr(isoYmd: string | undefined | null): string {
  const s = String(isoYmd ?? '').trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s || '—';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Mesmo contrato do backend (`PoliticaComercialParams`). */
export interface PoliticaComercialPainel {
  limiteFaixa1Reais: number;
  limiteFaixa2Reais: number;
  diasParcelasFaixa1: number[];
  diasParcelasFaixa2: number[];
  diasParcelasFaixa3: number[];
  pctEntradaAlvo: number;
  pctEntradaTolerancia: number;
  diasCondicaoMin: number;
  diasCondicaoMax: number;
  /** Teto de desconto em fração. `null` = não avalia, salvo retirada Só Aço (4%). */
  pctDescontoMaximo?: number | null;
}

export interface PainelComercialItemPedido {
  idItemPedido: number;
  codigo: string;
  descricao: string;
  qtdePedida: number;
  qtdeAtendida: number;
  valorTotalComIpi: number;
  statusIp: number;
  tabelaPreco: string;
}

export interface PainelComercialPedido {
  pd: string;
  pdId: number;
  empresaId: number;
  vendaPorEmpresa?: string;
  cliente: string;
  /** Pessoa Nomus. Ausente em respostas antigas. */
  clienteId?: number;
  /** Recorrente / reativado / novo (preenchido no painel). */
  tipoCliente?: 'recorrente' | 'reativado' | 'novo';
  /** @deprecated use tipoCliente */
  clienteRecorrente?: boolean;
  vendedorRepresentante: string;
  /** Classificação salva em Comissionamento → Classificar equipes. */
  equipe?: 'televendas' | 'vendedores' | 'representantes' | 'sem_equipe';
  /** Dias médios do pedido quando entra no prazo médio a prazo; ausente se fora da média. */
  prazoMedioDias?: number | null;
  emissao: string;
  tabelaPreco: string;
  valorTotal: number;
  valorDesconto: number;
  totalPedido: number;
  somaEntrada: number;
  pctEntrada: number;
  formaPagamento: string;
  condicaoPagamento: string;
  metodoEntrega: string;
  /** Rota / romaneio (política). */
  observacoes: string;
  /** Observação livre do pedido. */
  observacaoPedido: string;
  faixaTicket: FaixaTicketPainel;
  labelFaixa: string;
  diasCondicao: number[];
  diasEsperados: string;
  periodicidadeLabel: string;
  entradaOk: boolean;
  /** Acima da faixa de entrada — conta como conforme. */
  entradaBenigna?: boolean;
  prazosOk: boolean;
  /** Prazo diferente do pacote, porém menor — conta como conforme. */
  prazosBenignos?: boolean;
  prazosIndeterminados: boolean;
  retiradaSoAco: boolean;
  status: StatusConformidadePainel;
  motivos: string[];
}

export interface PainelComercialDashboard {
  dataInicio: string;
  dataFim: string;
  totalPedidos: number;
  pedidosAnalisados: number;
  pedidosExcluidosPolitica: number;
  pctConformes: number;
  pctAlertas: number;
  pctNaoConformes: number;
  ticketMedio: number;
  ticketMedioAnalisados: number;
  prazoMedioVendasAPrazoDias: number | null;
  pedidosVendasAPrazoComPrazoCadastrado: number;
  porMes: { mes: string; total: number; ok: number; alerta: number; naoConforme: number; excluido: number }[];
  porForma: { forma: string; pedidos: number; pctOk: number }[];
  porCondicao: { condicao: string; pedidos: number }[];
  porFaixa: { faixa: FaixaTicketPainel; label: string; pedidos: number; pctOk: number }[];
  porEntradaFaixa: { faixa: string; pedidos: number }[];
  historicoClientes?: {
    clienteId: number;
    cliente: string;
    primeiraEmissao: string;
    ultimaEmissaoAntesPeriodo: string | null;
  }[];
  clientesComCompraAnterior?: { clienteId: number; cliente: string }[];
  pedidos: PainelComercialPedido[];
  erro?: string;
  error?: string;
}

export async function fetchPainelComercialItensPedido(
  pdId: number,
  opts?: { signal?: AbortSignal }
): Promise<{ itens: PainelComercialItemPedido[]; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('pdId', String(pdId));
  const res = await apiFetch(`/api/financeiro/painel-comercial/itens-pedido?${sp.toString()}`, { signal: opts?.signal });
  const body = (await res.json().catch(() => ({}))) as {
    itens?: unknown[];
    error?: string;
    erro?: string;
  };
  if (!res.ok) {
    return { itens: [], erro: body.error ?? body.erro ?? res.statusText };
  }
  const raw = Array.isArray(body.itens) ? body.itens : [];
  const itens: PainelComercialItemPedido[] = raw.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      idItemPedido: Number(r.idItemPedido) || 0,
      codigo: String(r.codigo ?? ''),
      descricao: String(r.descricao ?? ''),
      qtdePedida: Number(r.qtdePedida) || 0,
      qtdeAtendida: Number(r.qtdeAtendida) || 0,
      valorTotalComIpi: Number(r.valorTotalComIpi) || 0,
      statusIp: Number(r.statusIp) || 0,
      tabelaPreco: String(r.tabelaPreco ?? ''),
    };
  });
  return { itens };
}

export interface UltimaVendaClienteEntrada {
  valor: number;
  vencimento: string;
}

export interface UltimaVendaCliente {
  pd: string;
  pdId: number;
  empresaId: number;
  vendaPorEmpresa: string;
  cliente: string;
  vendedorRepresentante: string;
  emissao: string;
  formaPagamento: string;
  condicaoPagamento: string;
  valorTotal: number;
  valorDesconto: number;
  totalPedido: number;
  somaEntrada: number;
  pctEntrada: number;
  entradas: UltimaVendaClienteEntrada[];
}

export async function fetchUltimasVendasClientePainel(
  opts: { clienteId?: number; cliente?: string; limit?: number; signal?: AbortSignal }
): Promise<{ vendas: UltimaVendaCliente[]; erro?: string }> {
  const sp = new URLSearchParams();
  if (opts.clienteId && opts.clienteId > 0) sp.set('clienteId', String(opts.clienteId));
  if (opts.cliente?.trim()) sp.set('cliente', opts.cliente.trim());
  if (opts.limit) sp.set('limit', String(opts.limit));
  const res = await apiFetch(`/api/financeiro/painel-comercial/ultimas-vendas?${sp.toString()}`, {
    signal: opts.signal,
  });
  const body = (await res.json().catch(() => ({}))) as {
    vendas?: unknown[];
    error?: string;
    erro?: string;
  };
  if (!res.ok) {
    return { vendas: [], erro: body.error ?? body.erro ?? res.statusText };
  }
  const raw = Array.isArray(body.vendas) ? body.vendas : [];
  const vendas: UltimaVendaCliente[] = raw.map((row) => {
    const r = row as Record<string, unknown>;
    const entradasRaw = Array.isArray(r.entradas) ? r.entradas : [];
    return {
      pd: String(r.pd ?? ''),
      pdId: Number(r.pdId) || 0,
      empresaId: Number(r.empresaId) || 0,
      vendaPorEmpresa: String(r.vendaPorEmpresa ?? ''),
      cliente: String(r.cliente ?? ''),
      vendedorRepresentante: String(r.vendedorRepresentante ?? ''),
      emissao: String(r.emissao ?? ''),
      formaPagamento: String(r.formaPagamento ?? ''),
      condicaoPagamento: String(r.condicaoPagamento ?? ''),
      valorTotal: Number(r.valorTotal) || 0,
      valorDesconto: Number(r.valorDesconto) || 0,
      totalPedido: Number(r.totalPedido) || 0,
      somaEntrada: Number(r.somaEntrada) || 0,
      pctEntrada: Number(r.pctEntrada) || 0,
      entradas: entradasRaw.map((e) => {
        const p = e as Record<string, unknown>;
        return { valor: Number(p.valor) || 0, vencimento: String(p.vencimento ?? '') };
      }),
    };
  });
  return { vendas };
}

function hojeYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function inicioAnoYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

export async function fetchPainelComercial(params?: {
  dataInicio?: string;
  dataFim?: string;
  empresaId?: 'todos' | 1 | 2;
}): Promise<PainelComercialDashboard> {
  const dataInicio = params?.dataInicio ?? inicioAnoYmd();
  const dataFim = params?.dataFim ?? hojeYmd();
  const sp = new URLSearchParams();
  sp.set('dataInicio', dataInicio);
  sp.set('dataFim', dataFim);
  sp.set('empresaId', String(params?.empresaId ?? 'todos'));
  const res = await apiFetch(`/api/financeiro/painel-comercial?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as PainelComercialDashboard & { error?: string };
  if (!res.ok) {
    return {
      dataInicio,
      dataFim,
      totalPedidos: 0,
      pedidosAnalisados: 0,
      pedidosExcluidosPolitica: 0,
      pctConformes: 0,
      pctAlertas: 0,
      pctNaoConformes: 0,
      ticketMedio: 0,
      ticketMedioAnalisados: 0,
      prazoMedioVendasAPrazoDias: null,
      pedidosVendasAPrazoComPrazoCadastrado: 0,
      porMes: [],
      porForma: [],
      porCondicao: [],
      porFaixa: [],
      porEntradaFaixa: [],
      historicoClientes: [],
      pedidos: [],
      erro: body.error ?? body.erro ?? res.statusText,
    };
  }
  return {
    ...body,
    prazoMedioVendasAPrazoDias:
      typeof body.prazoMedioVendasAPrazoDias === 'number' ? body.prazoMedioVendasAPrazoDias : null,
    pedidosVendasAPrazoComPrazoCadastrado:
      typeof body.pedidosVendasAPrazoComPrazoCadastrado === 'number'
        ? body.pedidosVendasAPrazoComPrazoCadastrado
        : 0,
    porMes: Array.isArray(body.porMes) ? body.porMes : [],
    porForma: Array.isArray(body.porForma) ? body.porForma : [],
    porCondicao: Array.isArray(body.porCondicao) ? body.porCondicao : [],
    porFaixa: Array.isArray(body.porFaixa) ? body.porFaixa : [],
    porEntradaFaixa: Array.isArray(body.porEntradaFaixa) ? body.porEntradaFaixa : [],
    pedidos: Array.isArray(body.pedidos) ? body.pedidos : [],
  };
}

export type PoliticaComercialEscopo = 'industria' | 'lojas';

export async function fetchPoliticaComercialPainel(
  escopo: PoliticaComercialEscopo = 'industria'
): Promise<{
  politica: PoliticaComercialPainel;
  padraoSistema: PoliticaComercialPainel;
  escopo: PoliticaComercialEscopo;
  erro?: string;
}> {
  const sp = new URLSearchParams({ escopo });
  const res = await apiFetch(`/api/financeiro/painel-comercial/politica?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    politica?: PoliticaComercialPainel;
    padraoSistema?: PoliticaComercialPainel;
    escopo?: PoliticaComercialEscopo;
    error?: string;
  };
  if (!res.ok) {
    return {
      politica: body.politica ?? ({} as PoliticaComercialPainel),
      padraoSistema: body.padraoSistema ?? ({} as PoliticaComercialPainel),
      escopo,
      erro: body.error ?? res.statusText,
    };
  }
  return {
    politica: body.politica as PoliticaComercialPainel,
    padraoSistema: (body.padraoSistema ?? body.politica) as PoliticaComercialPainel,
    escopo: body.escopo === 'lojas' ? 'lojas' : 'industria',
  };
}

export async function putPoliticaComercialPainel(
  politica: PoliticaComercialPainel,
  escopo: PoliticaComercialEscopo
): Promise<{ politica: PoliticaComercialPainel; escopo: PoliticaComercialEscopo; erro?: string }> {
  const sp = new URLSearchParams({ escopo });
  const res = await apiFetch(`/api/financeiro/painel-comercial/politica?${sp.toString()}`, {
    method: 'PUT',
    body: politica,
  });
  const body = (await res.json().catch(() => ({}))) as {
    politica?: PoliticaComercialPainel;
    escopo?: PoliticaComercialEscopo;
    error?: string;
  };
  if (!res.ok) {
    return { politica, escopo, erro: body.error ?? res.statusText };
  }
  return {
    politica: (body.politica ?? politica) as PoliticaComercialPainel,
    escopo: body.escopo === 'lojas' ? 'lojas' : escopo,
  };
}

export type PoliticaComercialClienteNomus = {
  id: number;
  nome: string;
  idGrupoPessoa: number | null;
  grupo: string;
};

export async function fetchPoliticaComercialClientes(params?: {
  q?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<{ clientes: PoliticaComercialClienteNomus[]; erro?: string }> {
  const sp = new URLSearchParams();
  if (params?.q?.trim()) sp.set('q', params.q.trim());
  if (params?.limit != null) sp.set('limit', String(params.limit));
  const res = await apiFetch(`/api/financeiro/painel-comercial/politica/clientes?${sp.toString()}`, {
    signal: params?.signal,
  });
  const body = (await res.json().catch(() => ({}))) as {
    clientes?: PoliticaComercialClienteNomus[];
    error?: string;
  };
  if (!res.ok) {
    return { clientes: [], erro: body.error ?? res.statusText };
  }
  return { clientes: Array.isArray(body.clientes) ? body.clientes : [] };
}
