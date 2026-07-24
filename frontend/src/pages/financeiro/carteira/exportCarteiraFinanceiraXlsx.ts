import { Workbook, type Worksheet } from 'exceljs';
import type { CarteiraFinanceiraLinha } from '../../../api/financeiro';
import {
  aggPorCarrada,
  aggPorCliente,
  aggPorCondicao,
  aggPorUf,
  type MetricasAgg,
} from './carteiraAggregates';

const DATE_FMT = 'dd/mm/yyyy';
const MONEY_FMT = 'R$ #,##0.00';

const HEADER_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FF1E3A5F' },
};
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };
const TOTAL_FONT = { bold: true };

function toExcelDate(iso: string | null): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

function styleHeader(ws: Worksheet, colCount: number) {
  const row = ws.getRow(1);
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: colCount },
  };
}

function autosize(ws: Worksheet, colCount: number) {
  for (let c = 1; c <= colCount; c++) {
    let max = 10;
    ws.eachRow((row) => {
      const v = row.getCell(c).value;
      const len = v == null ? 0 : String(v).length;
      if (len > max) max = Math.min(len, 48);
    });
    ws.getColumn(c).width = max + 2;
  }
}

function addResumoSheet(
  wb: Workbook,
  name: string,
  headers: string[],
  rows: (string | number)[][],
  moneyCols: number[]
) {
  const ws = wb.addWorksheet(name);
  ws.addRow(headers);
  styleHeader(ws, headers.length);
  for (const r of rows) {
    const row = ws.addRow(r);
    for (const c of moneyCols) {
      row.getCell(c).numFmt = MONEY_FMT;
    }
  }
  if (rows.length) {
    const totals: (string | number)[] = headers.map((_, i) => {
      if (i === 0) return 'TOTAL';
      if (moneyCols.includes(i + 1) || headers[i] === 'Qtd Pedidos') {
        return rows.reduce((s, r) => s + (Number(r[i]) || 0), 0);
      }
      return '';
    });
    const totalRow = ws.addRow(totals);
    totalRow.font = TOTAL_FONT;
    for (const c of moneyCols) totalRow.getCell(c).numFmt = MONEY_FMT;
  }
  autosize(ws, headers.length);
}

function metricRows(aggs: MetricasAgg[], extra?: (a: MetricasAgg) => (string | number)[]) {
  return aggs.map((a) => {
    const base: (string | number)[] = [
      a.chave,
      ...(extra ? extra(a) : []),
      a.saldoAReceber,
      a.saldoAFaturar,
      a.saldoRomaneado,
      a.qtdPedidos,
    ];
    return base;
  });
}

const DETALHE_COLS: { key: keyof CarteiraFinanceiraLinha; label: string; kind: 'text' | 'money' | 'date' }[] = [
  { key: 'idEmpresa', label: 'idEmpresa', kind: 'text' },
  { key: 'id', label: 'id', kind: 'text' },
  { key: 'Observacoes', label: 'Observacoes', kind: 'text' },
  { key: 'RM', label: 'RM', kind: 'text' },
  { key: 'Tipo Pedido', label: 'Tipo Pedido', kind: 'text' },
  { key: 'PD', label: 'PD', kind: 'text' },
  { key: 'Emissao', label: 'Emissao', kind: 'date' },
  { key: 'Cliente', label: 'Cliente', kind: 'text' },
  { key: 'Data de entrega', label: 'Data de entrega', kind: 'date' },
  { key: 'Metodo de Entrega', label: 'Metodo de Entrega', kind: 'text' },
  { key: 'Requisicao de loja do grupo?', label: 'Requisicao de loja do grupo?', kind: 'text' },
  { key: 'UF', label: 'UF', kind: 'text' },
  { key: 'Municipio de entrega', label: 'Municipio de entrega', kind: 'text' },
  { key: 'Forma de Pagamento', label: 'Forma de Pagamento', kind: 'text' },
  { key: 'Condicao de pagamento do pedido de venda', label: 'Condicao de pagamento do pedido de venda', kind: 'text' },
  { key: 'Valor Original Pedido', label: 'Valor Original Pedido', kind: 'money' },
  { key: 'Valor Total', label: 'Valor Total', kind: 'money' },
  { key: 'Valor Pendente', label: 'Valor Pendente', kind: 'money' },
  { key: 'Valor Romaneado', label: 'Valor Romaneado', kind: 'money' },
  { key: 'Valor Adiantamento', label: 'Valor Adiantamento', kind: 'money' },
  { key: 'Valor Faturado Entrega Futura + IPI', label: 'Valor Faturado Entrega Futura + IPI', kind: 'money' },
  { key: 'Saldo a Faturar Real', label: 'Saldo a Faturar Real', kind: 'money' },
  { key: 'Data base entrega futura', label: 'Data base entrega futura', kind: 'text' },
  { key: 'Venda por qual empresa?', label: 'Venda por qual empresa?', kind: 'text' },
  { key: 'Vendedor/Representante', label: 'Vendedor/Representante', kind: 'text' },
  { key: 'dataParametro', label: 'dataParametro', kind: 'date' },
  { key: 'tipoF', label: 'tipoF', kind: 'text' },
  { key: 'StatusPedido', label: 'StatusPedido', kind: 'text' },
];

function nomeArquivo(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `carteira-financeira_${y}-${m}-${d}_${hh}${mm}.xlsx`;
}

export async function exportCarteiraFinanceiraXlsx(linhas: CarteiraFinanceiraLinha[]): Promise<void> {
  const wb = new Workbook();
  wb.creator = 'Gestão Smart Soaco';

  const wsDet = wb.addWorksheet('Detalhado');
  wsDet.addRow(DETALHE_COLS.map((c) => c.label));
  styleHeader(wsDet, DETALHE_COLS.length);
  for (const l of linhas) {
    const values = DETALHE_COLS.map((c) => {
      const v = l[c.key];
      if (c.kind === 'date') return toExcelDate(v as string | null);
      if (c.kind === 'money') return Number(v) || 0;
      return v ?? '';
    });
    const row = wsDet.addRow(values);
    DETALHE_COLS.forEach((c, i) => {
      if (c.kind === 'money') row.getCell(i + 1).numFmt = MONEY_FMT;
      if (c.kind === 'date' && row.getCell(i + 1).value instanceof Date) {
        row.getCell(i + 1).numFmt = DATE_FMT;
      }
    });
  }
  autosize(wsDet, DETALHE_COLS.length);

  addResumoSheet(
    wb,
    'Resumo UF',
    ['UF', 'Saldo a Receber', 'Saldo a Faturar', 'Saldo Romaneado', 'Qtd Pedidos'],
    metricRows(aggPorUf(linhas)),
    [2, 3, 4]
  );

  const porCliente = aggPorCliente(linhas, 99999);
  const clienteUf = new Map<string, string>();
  for (const l of linhas) {
    if (l.Cliente && !clienteUf.has(l.Cliente)) clienteUf.set(l.Cliente, l.UF ?? '');
  }
  addResumoSheet(
    wb,
    'Resumo Cliente',
    ['Cliente', 'UF', 'Saldo a Receber', 'Saldo a Faturar', 'Saldo Romaneado', 'Qtd Pedidos'],
    porCliente.map((a) => [
      a.chave,
      clienteUf.get(a.chave) ?? '',
      a.saldoAReceber,
      a.saldoAFaturar,
      a.saldoRomaneado,
      a.qtdPedidos,
    ]),
    [3, 4, 5]
  );

  addResumoSheet(
    wb,
    'Resumo Cond. Pagamento',
    ['Condição', 'Saldo a Receber', 'Saldo a Faturar', 'Saldo Romaneado', 'Qtd Pedidos'],
    metricRows(aggPorCondicao(linhas)),
    [2, 3, 4]
  );

  addResumoSheet(
    wb,
    'Resumo Carradas',
    ['Observações/Rota', 'Saldo a Receber', 'Saldo a Faturar', 'Saldo Romaneado', 'Qtd Pedidos'],
    metricRows(aggPorCarrada(linhas, 99999)),
    [2, 3, 4]
  );

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo();
  a.click();
  URL.revokeObjectURL(url);
}
