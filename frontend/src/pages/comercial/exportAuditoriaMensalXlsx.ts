import { Workbook, type Worksheet } from 'exceljs';
import type { AuditoriaMensalPortaPallets } from '../../api/portaPalletsComercial';
import { formatData, labelMes, simNao } from './portaPalletsComercialFormat';

const MOEDA = '#,##0.00';

function cabecalho(aba: Worksheet, titulos: string[], larguras: number[]) {
  aba.addRow(titulos);
  aba.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF041E42' } };
  });
  aba.columns.forEach((col, i) => {
    col.width = larguras[i] ?? 16;
  });
  aba.views = [{ state: 'frozen', ySplit: 1 }];
  aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: titulos.length } };
}

function baixar(buffer: BlobPart, nome: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportarAuditoriaMensalXlsx(dados: AuditoriaMensalPortaPallets): Promise<void> {
  const wb = new Workbook();
  wb.calcProperties.fullCalcOnLoad = true;

  const abaPropostas = wb.addWorksheet('Propostas');
  cabecalho(
    abaPropostas,
    [
      'Mês',
      'Proposta',
      'Abertura',
      'Cód. interno do cliente',
      'Cliente',
      'Valor',
      'Virou pedido',
      'Pedidos gerados',
      'Lead novo?',
      'Criação do cliente',
      'Dias para criar pedido',
    ],
    [11, 16, 12, 16, 40, 16, 13, 26, 14, 17, 17]
  );
  for (const r of dados.propostas) {
    const row = abaPropostas.addRow([
      labelMes(r.mes),
      r.codigoProposta,
      formatData(r.dataAbertura),
      r.codigoCliente,
      r.cliente,
      r.valor,
      simNao(r.convertida),
      r.codigosPedido,
      simNao(r.clienteNovo),
      r.dataCadastroCliente ? formatData(r.dataCadastroCliente) : '',
      r.convertida ? r.dias : null,
    ]);
    row.getCell(6).numFmt = MOEDA;
    row.getCell(11).numFmt = '0.0';
  }

  const abaPedidos = wb.addWorksheet('Pedidos gerados');
  cabecalho(
    abaPedidos,
    [
      'Mês da proposta',
      'Pedido',
      'Emissão',
      'Cód. interno do cliente',
      'Cliente',
      'Propostas de origem',
      'Valor vendido',
    ],
    [15, 16, 12, 16, 40, 26, 16]
  );
  for (const r of dados.pedidosGerados) {
    const row = abaPedidos.addRow([
      labelMes(r.mes),
      r.codigoPedido,
      formatData(r.dataEmissao),
      r.codigoCliente,
      r.cliente,
      r.propostasOrigem,
      r.valorVendido,
    ]);
    row.getCell(7).numFmt = MOEDA;
  }

  const abaClientes = wb.addWorksheet('Clientes');
  cabecalho(
    abaClientes,
    [
      'Mês',
      'Cód. interno do cliente',
      'Cliente',
      'Criação do cliente',
      'Proposta',
      'Data da proposta',
      'Pedido',
      'Data do pedido',
      'Pedidos no mês',
      'Valor vendido',
      '1ª compra',
    ],
    [11, 16, 40, 17, 18, 16, 18, 16, 14, 16, 11]
  );
  for (const r of dados.clientes) {
    const row = abaClientes.addRow([
      labelMes(r.mes),
      r.codigoCliente,
      r.cliente,
      r.dataCadastroCliente ? formatData(r.dataCadastroCliente) : '',
      r.codigosProposta,
      r.datasProposta
        .split(', ')
        .filter(Boolean)
        .map((d) => formatData(d.slice(0, 10)))
        .join(', '),
      r.codigosPedido,
      r.datasPedido
        .split(', ')
        .filter(Boolean)
        .map((d) => formatData(d.slice(0, 10)))
        .join(', '),
      r.qtdPedidos,
      r.valor,
      simNao(r.primeiraCompra),
    ]);
    row.getCell(10).numFmt = MOEDA;
  }

  const abaConf = wb.addWorksheet('Conferência');
  cabecalho(
    abaConf,
    [
      'Mês',
      'Propostas (qtd.)',
      'Propostas (valor)',
      'Pedidos gerados (qtd.)',
      'Valor vendido',
      'Ticket médio',
      'Clientes com pedido',
      '1ª compra',
      'Taxa de conversão',
      'Tempo médio (dias)',
    ],
    [11, 15, 18, 20, 18, 15, 18, 11, 17, 17]
  );
  const meses = [...dados.meses].sort((a, b) => b.mes.localeCompare(a.mes));
  meses.forEach((m, i) => {
    const n = i + 2;
    const ticket = m.qtdPedidosGerados > 0 ? m.valorPedidosGerados / m.qtdPedidosGerados : '';
    const row = abaConf.addRow([
      labelMes(m.mes),
      { formula: `COUNTIFS(Propostas!A:A,A${n})`, result: m.qtdPropostas },
      { formula: `SUMIFS(Propostas!F:F,Propostas!A:A,A${n})`, result: m.valorPropostas },
      { formula: `COUNTIFS('Pedidos gerados'!A:A,A${n})`, result: m.qtdPedidosGerados },
      { formula: `SUMIFS('Pedidos gerados'!G:G,'Pedidos gerados'!A:A,A${n})`, result: m.valorPedidosGerados },
      { formula: `IF(D${n}>0,E${n}/D${n},"")`, result: ticket },
      { formula: `COUNTIFS(Clientes!A:A,A${n})`, result: m.qtdClientes },
      { formula: `COUNTIFS(Clientes!A:A,A${n},Clientes!K:K,"Sim")`, result: m.qtdPrimeiraCompra },
      {
        formula: `IF(B${n}>0,COUNTIFS(Propostas!A:A,A${n},Propostas!G:G,"Sim")/B${n},"")`,
        result: m.taxaConversao ?? '',
      },
      {
        formula: `IFERROR(AVERAGEIFS(Propostas!K:K,Propostas!A:A,A${n},Propostas!G:G,"Sim"),"")`,
        result: m.tempoMedioDias ?? '',
      },
    ]);
    for (const c of [3, 5, 6]) row.getCell(c).numFmt = MOEDA;
    row.getCell(9).numFmt = '0.0%';
    row.getCell(10).numFmt = '0.0';
  });

  const t = dados.totais;
  const total = abaConf.addRow([
    'Total do recorte',
    t.qtdPropostas,
    t.valorPropostas,
    t.qtdPedidosGerados,
    t.valorPedidosGerados,
    t.qtdPedidosGerados > 0 ? t.valorPedidosGerados / t.qtdPedidosGerados : '',
    t.qtdClientes,
    t.qtdPrimeiraCompra,
    t.taxaConversao ?? '',
    t.tempoMedioDias ?? '',
  ]);
  total.font = { bold: true };
  for (const c of [3, 5, 6]) total.getCell(c).numFmt = MOEDA;
  total.getCell(9).numFmt = '0.0%';
  total.getCell(10).numFmt = '0.0';

  abaConf.addRow([]);
  abaConf.addRow([
    'Cada mês é recalculado pelas fórmulas a partir das abas Propostas, Pedidos gerados e Clientes.',
  ]);
  abaConf.addRow([
    'Cód. interno do cliente é o Cód. interno do cadastro de Pessoas no Nomus (todo cliente tem), para distinguir filiais com a mesma razão social.',
  ]);
  abaConf.addRow([
    'Lead novo? (aba Propostas) usa a regra do funil: lead novo é quem não tem proposta de porta-palete (família 95) anterior à primeira proposta dele no período. Proposta rejeitada também conta. 1ª compra (aba Clientes) = o pedido de porta-pallet do mês é a primeira compra do cliente na empresa. Criação do cliente = data da linha Criação no Histórico de modificações do Nomus (não é a Data do início do relacionamento).',
  ]);
  abaConf.addRow([
    'No total, Pedidos gerados e Clientes contam cada pedido/cliente uma vez no recorte: o mesmo pedido ligado a propostas de meses diferentes, ou o mesmo cliente comprando em vários meses, aparece em cada mês nas abas.',
  ]);

  const buffer = await wb.xlsx.writeBuffer();
  baixar(buffer, `porta-pallets-auditoria-mensal-${dados.desde}-a-${dados.ate}.xlsx`);
}
