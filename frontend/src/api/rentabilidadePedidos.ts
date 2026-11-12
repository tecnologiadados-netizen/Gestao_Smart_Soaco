import { apiFetch } from './client';

export type StatusLucroRentabilidade = 'positivo' | 'neutro' | 'prejuizo';

export type RentabilidadeItem = {
  idItem: number;
  idProduto: number;
  codigoProduto: string;
  descricaoProduto: string;
  qtde: number;
  qtdeDevolvida: number;
  qtdeLiquida: number;
  precoUnitario: number;
  descontoItem: number;
  custoUnitario: number | null;
  statusLabel: string;
  alertas: string[];
  receitaBruta: number;
  impostosVenda: number;
  receitaLiquida: number;
  cmv: number;
  margemBruta: number;
  margemBrutaPct: number | null;
  despesas: number;
  lucroLiquido: number;
  margemLiquidaPct: number | null;
  semCusto: boolean;
  bonificado: boolean;
  despesasPadraoGeral: boolean;
  aliquotaImpostosPct: number;
  aliquotaDespesasPct: number;
};

export type RentabilidadePedido = {
  idPedido: number;
  numeroPedido: string;
  dataEmissao: string;
  idEmpresa: number;
  cliente: string;
  vendedor: string;
  statusResumo: string;
  statusLucro: StatusLucroRentabilidade;
  receitaBruta: number;
  impostosVenda: number;
  receitaLiquida: number;
  cmv: number;
  margemBruta: number;
  margemBrutaPct: number | null;
  despesas: number;
  lucroLiquido: number;
  margemLiquidaPct: number | null;
  qtdeItensSemCusto: number;
  qtdeItensBonificados: number;
  itens: RentabilidadeItem[];
};

export type RentabilidadeResumo = {
  receitaBruta: number;
  impostosVenda: number;
  cmv: number;
  despesas: number;
  lucroLiquido: number;
  margemLiquidaPct: number | null;
  qtdePedidos: number;
  qtdePedidosPrejuizo: number;
  aliquotaImpostosPct: number;
  aliquotaDespesasPct: number;
};

export type RentabilidadeFiltros = {
  dataInicio: string;
  dataFim: string;
  numeroPedido?: string;
  cliente?: string;
  vendedor?: string;
  idEmpresa?: 'todos' | 1 | 2;
  status?: string;
  somentePrejuizo?: boolean;
};

export async function fetchRentabilidadePedidos(
  filtros: RentabilidadeFiltros,
  opts?: { signal?: AbortSignal }
): Promise<{ resumo: RentabilidadeResumo; pedidos: RentabilidadePedido[]; error?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', filtros.dataInicio);
  sp.set('dataFim', filtros.dataFim);
  if (filtros.numeroPedido?.trim()) sp.set('numeroPedido', filtros.numeroPedido.trim());
  if (filtros.cliente?.trim()) sp.set('cliente', filtros.cliente.trim());
  if (filtros.vendedor?.trim()) sp.set('vendedor', filtros.vendedor.trim());
  if (filtros.idEmpresa === 1 || filtros.idEmpresa === 2) sp.set('idEmpresa', String(filtros.idEmpresa));
  if (filtros.status?.trim()) sp.set('status', filtros.status.trim());
  if (filtros.somentePrejuizo) sp.set('somentePrejuizo', '1');

  const res = await apiFetch(`/api/financeiro/rentabilidade-pedidos?${sp.toString()}`, {
    signal: opts?.signal,
  });
  const body = (await res.json().catch(() => ({}))) as {
    resumo?: RentabilidadeResumo;
    pedidos?: RentabilidadePedido[];
    error?: string;
  };
  if (!res.ok) {
    return {
      resumo: {
        receitaBruta: 0,
        impostosVenda: 0,
        cmv: 0,
        despesas: 0,
        lucroLiquido: 0,
        margemLiquidaPct: null,
        qtdePedidos: 0,
        qtdePedidosPrejuizo: 0,
        aliquotaImpostosPct: 0,
        aliquotaDespesasPct: 0,
      },
      pedidos: [],
      error: body.error ?? res.statusText,
    };
  }
  return {
    resumo: body.resumo!,
    pedidos: Array.isArray(body.pedidos) ? body.pedidos : [],
  };
}
