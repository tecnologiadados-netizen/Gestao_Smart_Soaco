/**
 * Exportação da grade "Detalhe por pedido" do Painel Financeiro-Comercial.
 * Formatos de célula (Excel pt-BR):
 * - data: dd/mm/yyyy
 * - dinheiro: contábil (R$)
 * - quantidade: geral, valor inteiro
 * - percentual: 0,00%
 */
import { Workbook, type Worksheet } from 'exceljs';
import type { PainelComercialPedido, StatusConformidadePainel } from '../api/painelComercial';
import { DATE_FMT, baixarWorkbook, toExcelDate } from '../pages/financeiro/exportFinanceiroXlsxShared';

export type EmpresaPainelFiltroExport = 'todos' | 1 | 2;

export interface FiltrosPainelComercialExport {
  dataInicio: string;
  dataFim: string;
  empresa: EmpresaPainelFiltroExport;
  status: StatusConformidadePainel | 'todos';
  formaPagamento: string;
  condicaoPagamento: string;
  cliente: string;
  pedido: string;
  equipe: 'todos' | 'televendas' | 'vendedores' | 'representantes' | 'sem_equipe';
  tipoCliente?: 'todos' | 'recorrente' | 'reativado' | 'novo';
}

/**
 * Contábil do Excel: R$ à esquerda, número à direita (ex.: R$  6.535,56).
 * O código usa ponto/vírgula dos EUA; o Excel pt-BR exibe 6.535,56.
 * Fica só na célula — estilo de coluna da tabela vira DXF e o Excel repara o arquivo.
 */
const ACCOUNTING_FMT = '_([$R$-0416]* #,##0.00_);_([$R$-0416]* (#,##0.00);_([$R$-0416]* "-"??_);_(@_)';
/** Porcentagem 0,00% no Excel pt-BR (o código usa ponto; o Excel localiza a vírgula). */
const PCT_FMT = '0.00%';
/** Geral: inteiros aparecem sem casas decimais. */
const QTY_FMT = 'General';
const DATETIME_FMT = 'dd/mm/yyyy hh:mm';

type ColKind = 'text' | 'date' | 'money' | 'pct' | 'qty';

const COLUNAS_PEDIDOS: { header: string; kind: ColKind }[] = [
  { header: 'PD', kind: 'text' },
  { header: 'Empresa', kind: 'text' },
  { header: 'Cliente', kind: 'text' },
  { header: 'Vendedor/Representante', kind: 'text' },
  { header: 'Equipe', kind: 'text' },
  { header: 'Tipo cliente', kind: 'text' },
  { header: 'Emissão', kind: 'date' },
  { header: 'Valor Total (R$)', kind: 'money' },
  { header: 'Valor Desconto (R$)', kind: 'money' },
  { header: 'Valor Total com Desconto (R$)', kind: 'money' },
  { header: 'Entrada (R$)', kind: 'money' },
  { header: '% Entrada', kind: 'pct' },
  { header: '% Desconto', kind: 'pct' },
  { header: 'Forma pagamento', kind: 'text' },
  { header: 'Condição pagamento', kind: 'text' },
  { header: 'Prazos (cadastro)', kind: 'text' },
  { header: 'Prazos esperados', kind: 'text' },
  { header: 'Observação do pedido', kind: 'text' },
  { header: 'Status', kind: 'text' },
  { header: 'Faixa ticket', kind: 'text' },
  { header: 'Retirada Só Aço', kind: 'text' },
  { header: 'Motivos', kind: 'text' },
];

const FMT_POR_TIPO: Record<Exclude<ColKind, 'text'>, string> = {
  date: DATE_FMT,
  money: ACCOUNTING_FMT,
  pct: PCT_FMT,
  qty: QTY_FMT,
};

/** Excel grava o instante em UTC; desloca para o relógio local aparecer em dd/mm/yyyy hh:mm. */
function agoraNoExcel(): Date {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
}

function labelEmpresa(id: number): string {
  if (id === 1) return 'Só Aço';
  if (id === 2) return 'Só Móveis';
  return String(id);
}

function labelEmpresaFiltro(v: EmpresaPainelFiltroExport): string {
  if (v === 1) return 'Só Aço';
  if (v === 2) return 'Só Móveis';
  return 'Todas';
}

function labelStatusExport(s: StatusConformidadePainel): string {
  switch (s) {
    case 'ok':
      return 'Conforme';
    case 'alerta':
      return 'Alerta';
    case 'nao_conforme':
      return 'Não conforme';
    default:
      return 'Excluído (cartão)';
  }
}

function labelEquipeExport(equipe: FiltrosPainelComercialExport['equipe']): string {
  switch (equipe) {
    case 'televendas':
      return 'Televendas';
    case 'vendedores':
      return 'Vendedores';
    case 'representantes':
      return 'Representantes';
    case 'sem_equipe':
      return 'Sem equipe';
    default:
      return 'Todas';
  }
}

function labelEquipePedido(equipe: PainelComercialPedido['equipe']): string {
  return labelEquipeExport(equipe ?? 'sem_equipe');
}

function labelStatusFiltro(s: FiltrosPainelComercialExport['status']): string {
  if (s === 'todos') return 'Todos';
  return labelStatusExport(s);
}

function valorCelula(kind: ColKind, value: string | number | Date | null): string | number | Date | null {
  if (kind === 'qty') {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  if (kind === 'money' || kind === 'pct') {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return value;
}

function aplicarFormato(cell: { value: unknown; numFmt: string }, kind: ColKind): void {
  if (kind === 'text') return;
  if (kind === 'date' && !(cell.value instanceof Date)) return;
  cell.numFmt = FMT_POR_TIPO[kind];
}

function pedidoParaLinha(p: PainelComercialPedido): (string | number | Date | null)[] {
  const valorTotal = p.valorTotal ?? 0;
  const valorDesconto = p.valorDesconto ?? 0;
  const valores: (string | number | Date | null)[] = [
    p.pd,
    labelEmpresa(p.empresaId),
    p.cliente,
    p.vendedorRepresentante || '',
    labelEquipePedido(p.equipe),
    p.tipoCliente === 'recorrente' ? 'Recorrente' : p.tipoCliente === 'reativado' ? 'Reativado' : 'Novo',
    toExcelDate(p.emissao),
    valorTotal,
    valorDesconto,
    p.totalPedido ?? 0,
    p.somaEntrada ?? 0,
    p.pctEntrada ?? 0,
    valorTotal > 0 ? valorDesconto / valorTotal : 0,
    p.formaPagamento,
    p.condicaoPagamento,
    p.periodicidadeLabel,
    p.diasEsperados,
    p.observacaoPedido || '',
    labelStatusExport(p.status),
    p.labelFaixa,
    p.retiradaSoAco ? 'Sim' : 'Não',
    p.motivos.join('; '),
  ];
  return valores.map((value, i) => valorCelula(COLUNAS_PEDIDOS[i]!.kind, value));
}

function larguraColuna(header: string, kind: ColKind, rows: (string | number | Date | null)[][], colIdx: number): number {
  let max = header.length;
  for (const row of rows) {
    const cell = row[colIdx];
    const len = cell instanceof Date ? 10 : cell == null ? 0 : String(cell).length;
    if (len > max) max = len;
  }
  const min = kind === 'money' ? 16 : kind === 'date' ? 12 : kind === 'pct' ? 12 : 10;
  return Math.min(Math.max(max + 2, min), 48);
}

function preencherAbaPedidos(ws: Worksheet, pedidos: PainelComercialPedido[]): void {
  const body = pedidos.map(pedidoParaLinha);
  ws.addTable({
    name: 'TabelaPedidos',
    displayName: 'TabelaPedidos',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleLight9',
      showRowStripes: false,
      showColumnStripes: false,
      showFirstColumn: false,
      showLastColumn: false,
    },
    columns: COLUNAS_PEDIDOS.map((col) => ({
      name: col.header,
      filterButton: true,
    })),
    rows: body,
  });

  COLUNAS_PEDIDOS.forEach((col, i) => {
    ws.getColumn(i + 1).width = Math.max(
      larguraColuna(col.header, col.kind, body, i),
      col.kind === 'money' ? 22 : 0
    );
  });

  for (let r = 2; r <= body.length + 1; r++) {
    const row = ws.getRow(r);
    COLUNAS_PEDIDOS.forEach((col, i) => aplicarFormato(row.getCell(i + 1), col.kind));
  }

  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function criarAbaFiltros(wb: Workbook, filtros: FiltrosPainelComercialExport, totalExportado: number): void {
  const ws = wb.addWorksheet('Filtros');
  ws.addRow(['Campo', 'Valor']);
  const inicio = toExcelDate(filtros.dataInicio);
  const fim = toExcelDate(filtros.dataFim);
  const linhas: [string, string | number | Date][] = [
    ['Período (emissão de)', inicio ?? filtros.dataInicio],
    ['Período (emissão até)', fim ?? filtros.dataFim],
    ['Empresa', labelEmpresaFiltro(filtros.empresa)],
    ['Equipe', labelEquipeExport(filtros.equipe)],
    [
      'Tipo de cliente',
      filtros.tipoCliente === 'recorrente'
        ? 'Recorrentes'
        : filtros.tipoCliente === 'reativado'
          ? 'Reativados'
          : filtros.tipoCliente === 'novo'
            ? 'Novos'
            : 'Todos',
    ],
    ['Status', labelStatusFiltro(filtros.status)],
    ['Forma de pagamento', filtros.formaPagamento.trim() || '(todos)'],
    ['Condição de pagamento', filtros.condicaoPagamento.trim() || '(todos)'],
    ['Cliente', filtros.cliente.trim() || '(todos)'],
    ['Pedido', filtros.pedido.trim() || '(todos)'],
    ['Registros exportados', Math.round(totalExportado)],
    ['Exportado em', agoraNoExcel()],
  ];
  for (const [campo, valor] of linhas) {
    const row = ws.addRow([campo, valor]);
    const cell = row.getCell(2);
    if (valor instanceof Date) {
      cell.numFmt = campo === 'Exportado em' ? DATETIME_FMT : DATE_FMT;
    } else if (campo === 'Registros exportados') {
      cell.numFmt = QTY_FMT;
    }
  }
  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 22;
}

export function criarWorkbookPainelComercial(
  pedidos: PainelComercialPedido[],
  filtros: FiltrosPainelComercialExport
): Workbook {
  const wb = new Workbook();
  const wsPedidos = wb.addWorksheet('Pedidos');
  preencherAbaPedidos(wsPedidos, pedidos);
  criarAbaFiltros(wb, filtros, pedidos.length);
  return wb;
}

export async function downloadPainelComercialXlsx(
  pedidos: PainelComercialPedido[],
  filtros: FiltrosPainelComercialExport,
  filename?: string
): Promise<void> {
  const wb = criarWorkbookPainelComercial(pedidos, filtros);

  const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const nome =
    filename ??
    `painel-financeiro-comercial_${filtros.dataInicio}_${filtros.dataFim}_${ts}.xlsx`;
  await baixarWorkbook(wb, nome);
}
