import { Workbook } from 'exceljs';
import type { RentabilidadePedido, RentabilidadeResumo } from '../../api/rentabilidadePedidos';
import { baixarWorkbook } from './exportFinanceiroXlsxShared';

const ACCOUNTING_FMT = '_([$R$-0416]* #,##0.00_);_([$R$-0416]* (#,##0.00);_([$R$-0416]* "-"??_);_(@_)';
const PCT_FMT = '0.0%';

export async function downloadRentabilidadePedidosXlsx(opts: {
  pedidos: RentabilidadePedido[];
  resumo: RentabilidadeResumo;
  dataInicio: string;
  dataFim: string;
}): Promise<void> {
  const wb = new Workbook();
  const ws = wb.addWorksheet('Pedidos');
  ws.columns = [
    { header: 'Pedido', key: 'pedido', width: 14 },
    { header: 'Emissão', key: 'emissao', width: 12 },
    { header: 'Cliente', key: 'cliente', width: 36 },
    { header: 'Vendedor', key: 'vendedor', width: 24 },
    { header: 'Receita Bruta', key: 'receita', width: 14 },
    { header: 'Impostos', key: 'impostos', width: 12 },
    { header: 'CMV', key: 'cmv', width: 12 },
    { header: 'Despesas', key: 'despesas', width: 12 },
    { header: 'Lucro Líquido', key: 'lucro', width: 14 },
    { header: 'Margem Líq. %', key: 'margem', width: 12 },
    { header: 'Status lucro', key: 'status', width: 12 },
  ];

  for (const p of opts.pedidos) {
    ws.addRow({
      pedido: p.numeroPedido,
      emissao: p.dataEmissao,
      cliente: p.cliente,
      vendedor: p.vendedor,
      receita: p.receitaBruta,
      impostos: p.impostosVenda,
      cmv: p.cmv,
      despesas: p.despesas,
      lucro: p.lucroLiquido,
      margem: p.margemLiquidaPct != null ? p.margemLiquidaPct / 100 : null,
      status: p.statusLucro,
    });
  }

  for (const col of ['receita', 'impostos', 'cmv', 'despesas', 'lucro']) {
    ws.getColumn(col).numFmt = ACCOUNTING_FMT;
  }
  ws.getColumn('margem').numFmt = PCT_FMT;

  const wsI = wb.addWorksheet('Itens');
  wsI.columns = [
    { header: 'Pedido', key: 'pedido', width: 14 },
    { header: 'Código', key: 'codigo', width: 14 },
    { header: 'Descrição', key: 'descricao', width: 40 },
    { header: 'Qtde líquida', key: 'qtde', width: 12 },
    { header: 'Receita Bruta', key: 'receita', width: 14 },
    { header: 'Impostos', key: 'impostos', width: 12 },
    { header: 'CMV', key: 'cmv', width: 12 },
    { header: 'Despesas', key: 'despesas', width: 12 },
    { header: 'Lucro Líquido', key: 'lucro', width: 14 },
    { header: 'Margem Líq. %', key: 'margem', width: 12 },
    { header: 'Alertas', key: 'alertas', width: 28 },
  ];
  for (const p of opts.pedidos) {
    for (const i of p.itens) {
      wsI.addRow({
        pedido: p.numeroPedido,
        codigo: i.codigoProduto,
        descricao: i.descricaoProduto,
        qtde: i.qtdeLiquida,
        receita: i.receitaBruta,
        impostos: i.impostosVenda,
        cmv: i.cmv,
        despesas: i.despesas,
        lucro: i.lucroLiquido,
        margem: i.margemLiquidaPct != null ? i.margemLiquidaPct / 100 : null,
        alertas: i.alertas.join('; '),
      });
    }
  }
  for (const col of ['receita', 'impostos', 'cmv', 'despesas', 'lucro']) {
    wsI.getColumn(col).numFmt = ACCOUNTING_FMT;
  }
  wsI.getColumn('margem').numFmt = PCT_FMT;

  const nome = `rentabilidade-pedidos_${opts.dataInicio}_${opts.dataFim}.xlsx`;
  await baixarWorkbook(wb, nome);
}
