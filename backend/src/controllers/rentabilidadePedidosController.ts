import type { Request, Response } from 'express';
import {
  listarItensPedidosRentabilidade,
  type LinhaPedidoItemNomus,
} from '../data/rentabilidadePedidosRepository.js';
import { obterCustosBomUltimaEntrada } from '../services/precificacaoCustoUltimaEntradaService.js';
import {
  agregarPedidoRentabilidade,
  calcularItemRentabilidade,
  statusLucroOperacao,
  type ResultadoItemRentabilidade,
} from '../lib/calculos/rentabilidadePedidos.js';
import { aliquotaDespesasPadrao, aliquotaImpostosVenda } from '../lib/calculos/precificacaoPadroes.js';

function parseYmd(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function parseIdEmpresa(v: unknown): number | null {
  if (v == null || v === '' || v === 'todos') return null;
  const n = Number(v);
  return n === 1 || n === 2 ? n : null;
}

function parseStatusLista(v: unknown): number[] | undefined {
  if (v == null || v === '') return undefined;
  const parts = String(v)
    .split(',')
    .map((p) => Number(p.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return parts.length ? parts : undefined;
}

type ItemApi = ResultadoItemRentabilidade & {
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
};

type PedidoApi = {
  idPedido: number;
  numeroPedido: string;
  dataEmissao: string;
  idEmpresa: number;
  cliente: string;
  vendedor: string;
  statusResumo: string;
  statusLucro: 'positivo' | 'neutro' | 'prejuizo';
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
  itens: ItemApi[];
};

function montarItem(
  row: LinhaPedidoItemNomus,
  custoUnitario: number | null,
  semCustoFlag: boolean
): ItemApi {
  const qtdeLiquida = Math.max(0, row.qtde - row.qtdeDevolvida);
  const fator = row.qtde > 0 ? qtdeLiquida / row.qtde : 0;
  const descontoItem = row.valorDesconto * fator;
  const precoUnitario = row.qtde > 0 ? row.valorTotal / row.qtde : 0;

  const calc = calcularItemRentabilidade({
    qtde: qtdeLiquida,
    precoUnitario,
    descontoItem,
    rateioDescontoCabecalho: 0,
    custoUnitario: semCustoFlag ? null : custoUnitario,
    despesasPadraoGeral: true,
  });

  const alertas: string[] = [];
  if (calc.semCusto) alertas.push('sem custo');
  if (calc.bonificado) alertas.push('bonificado');
  if (calc.despesasPadraoGeral) alertas.push('despesas padrão geral');
  if (row.qtdeDevolvida > 0) alertas.push('com devolução');

  return {
    ...calc,
    idItem: row.idItem,
    idProduto: row.idProduto,
    codigoProduto: row.codigoProduto,
    descricaoProduto: row.descricaoProduto,
    qtde: row.qtde,
    qtdeDevolvida: row.qtdeDevolvida,
    qtdeLiquida,
    precoUnitario,
    descontoItem,
    custoUnitario: semCustoFlag ? null : custoUnitario,
    statusLabel: row.statusLabel,
    alertas,
  };
}

/**
 * GET /api/financeiro/rentabilidade-pedidos
 * Query: dataInicio, dataFim, numeroPedido?, cliente?, vendedor?, idEmpresa?, status?, somentePrejuizo?
 */
export async function getRentabilidadePedidos(req: Request, res: Response): Promise<void> {
  const dataInicio = parseYmd(req.query.dataInicio);
  const dataFim = parseYmd(req.query.dataFim);
  if (!dataInicio || !dataFim) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim (YYYY-MM-DD).' });
    return;
  }
  if (dataInicio > dataFim) {
    res.status(400).json({ error: 'dataInicio não pode ser maior que dataFim.' });
    return;
  }

  const somentePrejuizo =
    String(req.query.somentePrejuizo ?? '') === '1' ||
    String(req.query.somentePrejuizo ?? '').toLowerCase() === 'true';

  try {
    const linhas = await listarItensPedidosRentabilidade({
      dataInicio,
      dataFim,
      numeroPedido: typeof req.query.numeroPedido === 'string' ? req.query.numeroPedido : undefined,
      cliente: typeof req.query.cliente === 'string' ? req.query.cliente : undefined,
      vendedor: typeof req.query.vendedor === 'string' ? req.query.vendedor : undefined,
      idEmpresa: parseIdEmpresa(req.query.idEmpresa),
      statusItens: parseStatusLista(req.query.status),
    });

    const idsProduto = [...new Set(linhas.map((l) => l.idProduto).filter((id) => id > 0))];
    const custos = await obterCustosBomUltimaEntrada(idsProduto);

    const porPedido = new Map<number, LinhaPedidoItemNomus[]>();
    for (const row of linhas) {
      const list = porPedido.get(row.idPedido) ?? [];
      list.push(row);
      porPedido.set(row.idPedido, list);
    }

    const pedidos: PedidoApi[] = [];
    for (const [, itensRow] of porPedido) {
      const head = itensRow[0]!;
      const itens: ItemApi[] = itensRow.map((row) => {
        const c = custos.get(row.idProduto);
        return montarItem(row, c?.custoUnitario ?? null, c?.semCusto ?? true);
      });
      const agg = agregarPedidoRentabilidade(itens);
      const statusLucro = statusLucroOperacao(agg.lucroLiquido, agg.margemLiquidaPct);
      if (somentePrejuizo && statusLucro !== 'prejuizo') continue;

      const statusSet = [...new Set(itensRow.map((i) => i.statusLabel))];
      pedidos.push({
        idPedido: head.idPedido,
        numeroPedido: head.numeroPedido,
        dataEmissao: head.dataEmissao,
        idEmpresa: head.idEmpresa,
        cliente: head.cliente,
        vendedor: head.vendedor,
        statusResumo: statusSet.join(', '),
        statusLucro,
        ...agg,
        itens,
      });
    }

    pedidos.sort((a, b) => {
      const d = b.dataEmissao.localeCompare(a.dataEmissao);
      if (d !== 0) return d;
      return b.numeroPedido.localeCompare(a.numeroPedido, 'pt-BR');
    });

    const resumo = {
      receitaBruta: pedidos.reduce((s, p) => s + p.receitaBruta, 0),
      impostosVenda: pedidos.reduce((s, p) => s + p.impostosVenda, 0),
      cmv: pedidos.reduce((s, p) => s + p.cmv, 0),
      despesas: pedidos.reduce((s, p) => s + p.despesas, 0),
      lucroLiquido: pedidos.reduce((s, p) => s + p.lucroLiquido, 0),
      qtdePedidos: pedidos.length,
      qtdePedidosPrejuizo: pedidos.filter((p) => p.statusLucro === 'prejuizo').length,
      margemLiquidaPct:
        pedidos.reduce((s, p) => s + p.receitaBruta, 0) > 0
          ? Math.round(
              (pedidos.reduce((s, p) => s + p.lucroLiquido, 0) /
                pedidos.reduce((s, p) => s + p.receitaBruta, 0)) *
                1000
            ) / 10
          : null,
      aliquotaImpostosPct: aliquotaImpostosVenda(),
      aliquotaDespesasPct: aliquotaDespesasPadrao(),
    };

    res.json({
      resumo: {
        ...resumo,
        receitaBruta: Math.round(resumo.receitaBruta * 100) / 100,
        impostosVenda: Math.round(resumo.impostosVenda * 100) / 100,
        cmv: Math.round(resumo.cmv * 100) / 100,
        despesas: Math.round(resumo.despesas * 100) / 100,
        lucroLiquido: Math.round(resumo.lucroLiquido * 100) / 100,
      },
      pedidos,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[getRentabilidadePedidos]', msg);
    res.status(503).json({ error: msg });
  }
}
