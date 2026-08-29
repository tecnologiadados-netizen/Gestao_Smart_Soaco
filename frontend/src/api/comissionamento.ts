import { apiFetch, apiJson } from './client';

export type ComparacaoBase = 'periodo_anterior' | 'ano_anterior';
export type EquipeComissionamento = 'televendas' | 'vendedores' | 'representantes' | 'sem_equipe';
export type DrillDimComissionamento = 'mes' | 'grupo' | 'vendedor' | 'equipe' | 'status' | 'cliente';

export const EQUIPE_LABEL: Record<EquipeComissionamento, string> = {
  televendas: 'Televendas',
  vendedores: 'Vendedores',
  representantes: 'Representantes',
  sem_equipe: 'Sem equipe',
};

export type ClassificacaoEquipesMap = Record<string, Exclude<EquipeComissionamento, 'sem_equipe'>>;

export interface FiltrosComissionamento {
  dataIni: string;
  dataFim: string;
  comparacaoBase?: ComparacaoBase;
  grupoProduto?: string;
  vendedor?: string;
  equipe?: string;
  status?: string;
  cliente?: string;
  produto?: string;
}

export interface SerieMesComissionamento {
  mes: string;
  valor: number;
  qtde: number;
  pedidos: number;
  valorAnoAnterior: number | null;
  varMomPct: number | null;
  varYoyPct: number | null;
}

export interface RankingItem {
  key: string;
  label: string;
  valor: number;
  qtde: number;
  pedidos: number;
  clientes?: number;
  equipe?: EquipeComissionamento;
  sharePct?: number;
  custo?: number;
  margem?: number;
  margemPct?: number | null;
}

export interface ComissionamentoAnalytics {
  filtros: { dataIni: string; dataFim: string; comparacaoBase: ComparacaoBase };
  kpis: {
    valor: number;
    valorBase: number;
    valorVarPct: number | null;
    qtde: number;
    pedidos: number;
    clientes: number;
    ticketMedio: number;
    ticketMedioCliente: number;
    positivacao: number;
    coberturaPct: number | null;
    descontoMedioPct: number | null;
    itensPorPedido: number;
    valorPorItem: number;
    concentracaoTop20Pct: number | null;
    clientesNovos: number;
    clientesRecorrentes: number;
    custo: number;
    margem: number;
    margemPct: number | null;
    margemBase: number;
    margemVarPct: number | null;
    coberturaCustoPct: number | null;
  };
  serieMensal: SerieMesComissionamento[];
  mixGrupos: RankingItem[];
  rankingVendedores: RankingItem[];
  rankingEquipes: RankingItem[];
  rankingProdutosMargem: RankingItem[];
  mixStatus: Array<{ key: string; label: string; valor: number; qtde: number; pedidos: number }>;
  paretoClientes: Array<{
    key: string;
    label: string;
    valor: number;
    qtde: number;
    pedidos: number;
    sharePct: number;
    acumuladoPct: number;
  }>;
  heatmapEquipeMes: Array<{ equipe: string; mes: string; valor: number }>;
  opcoes: {
    vendedores: string[];
    grupos: string[];
    status: string[];
    equipes: EquipeComissionamento[];
  };
  classificacao: ClassificacaoEquipesMap;
  erro?: string;
}

function qs(filtros: FiltrosComissionamento, extra?: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  sp.set('dataIni', filtros.dataIni);
  sp.set('dataFim', filtros.dataFim);
  if (filtros.comparacaoBase) sp.set('comparacaoBase', filtros.comparacaoBase);
  if (filtros.grupoProduto) sp.set('grupoProduto', filtros.grupoProduto);
  if (filtros.vendedor) sp.set('vendedor', filtros.vendedor);
  if (filtros.equipe) sp.set('equipe', filtros.equipe);
  if (filtros.status) sp.set('status', filtros.status);
  if (filtros.cliente) sp.set('cliente', filtros.cliente);
  if (filtros.produto) sp.set('produto', filtros.produto);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) sp.set(k, v);
    }
  }
  return sp.toString();
}

export async function obterComissionamentoAnalytics(
  filtros: FiltrosComissionamento
): Promise<ComissionamentoAnalytics> {
  return apiJson<ComissionamentoAnalytics>(`/api/comercial/comissionamento/analytics?${qs(filtros)}`);
}

export async function obterComissionamentoDrill(
  filtros: FiltrosComissionamento,
  dim: DrillDimComissionamento,
  where?: Record<string, string>
): Promise<{ items: RankingItem[] }> {
  return apiJson(`/api/comercial/comissionamento/drill?${qs(filtros, { dim, ...where })}`);
}

export type ComissionamentoDetalheRow = {
  idEmpresa: number;
  empresa: string;
  idItem: number;
  pdId: number;
  pdCodigo: string;
  dataEmissao: string;
  mes: string;
  idProduto?: number;
  codigoProduto: string;
  descricaoProduto: string;
  cliente: string;
  grupoProduto: string;
  qtde: number;
  precoUnitario: number;
  valorTotal: number;
  valorDesconto: number;
  valorVendido: number;
  vendedor: string;
  status: string;
  requisicao: string;
  equipe: EquipeComissionamento;
  custoUnitario?: number | null;
  custoTotal?: number | null;
  margem?: number | null;
  margemPct?: number | null;
};

export type DetalheComissionamentoContexto = {
  mes?: string;
  grupoProduto?: string;
  vendedor?: string;
  equipe?: string;
  status?: string;
  cliente?: string;
  produto?: string;
};

export async function listarComissionamentoDetalhe(
  filtros: FiltrosComissionamento,
  contexto?: DetalheComissionamentoContexto
): Promise<{ rows: ComissionamentoDetalheRow[]; truncado: boolean; erro?: string }> {
  return apiJson(
    `/api/comercial/comissionamento/detalhe?${qs(filtros, {
      mes: contexto?.mes,
      grupoProduto: contexto?.grupoProduto,
      vendedor: contexto?.vendedor,
      equipe: contexto?.equipe,
      status: contexto?.status,
      cliente: contexto?.cliente,
      produto: contexto?.produto,
    })}`
  );
}

export type ComparativoVendedorItem = {
  vendedor: string;
  equipe: EquipeComissionamento;
  valor: number;
  qtde: number;
  pedidos: number;
  clientes: number;
  ticketMedio: number;
  custo?: number;
  margem?: number;
  margemPct?: number | null;
  serieMensal: Array<{ mes: string; valor: number; qtde: number; pedidos: number; margem?: number }>;
};

export async function obterComissionamentoComparativo(
  filtros: FiltrosComissionamento,
  vendedores: string[]
): Promise<{ items: ComparativoVendedorItem[]; meses: string[]; erro?: string }> {
  return apiJson(
    `/api/comercial/comissionamento/comparativo?${qs(filtros, {
      vendedores: vendedores.join(','),
    })}`
  );
}

export async function obterComissionamentoClassificacao(
  filtros: FiltrosComissionamento
): Promise<{
  pessoas: Array<{ nome: string; equipe: EquipeComissionamento; valor: number }>;
  classificacao: ClassificacaoEquipesMap;
  erro?: string;
}> {
  return apiJson(`/api/comercial/comissionamento/classificacao?${qs(filtros)}`);
}

export async function salvarComissionamentoClassificacao(
  classificacao: ClassificacaoEquipesMap
): Promise<{ classificacao: ClassificacaoEquipesMap }> {
  const res = await apiFetch('/api/comercial/comissionamento/classificacao', {
    method: 'PUT',
    body: { classificacao },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? res.statusText);
  }
  return (await res.json()) as { classificacao: ClassificacaoEquipesMap };
}

export type ClienteInativoComissionamento = {
  cliente: string;
  ultimaCompra: string;
  diasSemCompra: number;
  vendedorUltimo: string;
  equipe: EquipeComissionamento;
  pedidos: number;
  valor: number;
};

export type ClientesInativosComissionamentoResponse = {
  referencia: string;
  dataIniAnalise: string;
  dataFimAnalise: string;
  diasSemCompraMin: number;
  clientes: ClienteInativoComissionamento[];
  total: number;
  erro?: string;
};

export async function listarComissionamentoClientesInativos(
  filtros: FiltrosComissionamento
): Promise<ClientesInativosComissionamentoResponse> {
  return apiJson(`/api/comercial/comissionamento/clientes-inativos?${qs(filtros)}`);
}

export async function obterComissionamentoInativosWhatsapp(): Promise<{ numero: string }> {
  return apiJson('/api/comercial/comissionamento/clientes-inativos/whatsapp');
}

export async function salvarComissionamentoInativosWhatsapp(
  numero: string
): Promise<{ numero: string }> {
  const res = await apiFetch('/api/comercial/comissionamento/clientes-inativos/whatsapp', {
    method: 'PUT',
    body: { numero },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? res.statusText);
  }
  return (await res.json()) as { numero: string };
}

export async function enviarComissionamentoInativosWhatsapp(
  filtros: FiltrosComissionamento,
  numero: string
): Promise<{ ok: boolean; enviado: boolean; dryRun?: boolean; numero: string; total: number }> {
  const res = await apiFetch(`/api/comercial/comissionamento/clientes-inativos/whatsapp?${qs(filtros)}`, {
    method: 'POST',
    body: { numero },
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    ok?: boolean;
    enviado?: boolean;
    dryRun?: boolean;
    numero?: string;
    total?: number;
  };
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return {
    ok: Boolean(body.ok),
    enviado: Boolean(body.enviado),
    dryRun: body.dryRun,
    numero: body.numero ?? numero,
    total: body.total ?? 0,
  };
}
