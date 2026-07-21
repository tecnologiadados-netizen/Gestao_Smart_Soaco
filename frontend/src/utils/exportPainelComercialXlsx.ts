/**
 * Exportação da grade "Detalhe por pedido" do Painel Financeiro-Comercial.
 */
import * as XLSX from 'xlsx';
import {
  formatEmissaoPainelBr,
  type PainelComercialPedido,
  type StatusConformidadePainel,
} from '../api/painelComercial';

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

function labelStatusFiltro(s: FiltrosPainelComercialExport['status']): string {
  if (s === 'todos') return 'Todos';
  return labelStatusExport(s);
}

function pctDescontoExport(valorTotal: number, valorDesconto: number): number {
  if (!(valorTotal > 0)) return 0;
  return Math.round((valorDesconto / valorTotal) * 1000) / 10;
}

function pedidoParaLinha(p: PainelComercialPedido): (string | number)[] {
  const valorTotal = p.valorTotal ?? 0;
  const valorDesconto = p.valorDesconto ?? 0;
  return [
    p.pd,
    labelEmpresa(p.empresaId),
    p.cliente,
    p.vendedorRepresentante || '',
    formatEmissaoPainelBr(p.emissao),
    valorTotal,
    valorDesconto,
    p.totalPedido,
    p.somaEntrada,
    Math.round(p.pctEntrada * 1000) / 10,
    pctDescontoExport(valorTotal, valorDesconto),
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
}

const COLUNAS_PEDIDOS = [
  'PD',
  'Empresa',
  'Cliente',
  'Vendedor/Representante',
  'Emissão',
  'Valor Total (R$)',
  'Valor Desconto (R$)',
  'Valor Total com Desconto (R$)',
  'Entrada (R$)',
  '% Entrada',
  '% Desconto',
  'Forma pagamento',
  'Condição pagamento',
  'Prazos (cadastro)',
  'Prazos esperados',
  'Observação do pedido',
  'Status',
  'Faixa ticket',
  'Retirada Só Aço',
  'Motivos',
];

function autoLarguraColunas(headers: string[], rows: (string | number)[][]): XLSX.ColInfo[] {
  return headers.map((h, colIdx) => {
    let max = h.length;
    for (const row of rows) {
      const cell = row[colIdx];
      const len = cell == null ? 0 : String(cell).length;
      if (len > max) max = len;
    }
    return { wch: Math.min(Math.max(max + 2, 10), 48) };
  });
}

function criarAbaFiltros(filtros: FiltrosPainelComercialExport, totalExportado: number): XLSX.WorkSheet {
  const exportadoEm = new Date().toLocaleString('pt-BR');
  const linhas: (string | number)[][] = [
    ['Campo', 'Valor'],
    ['Período (emissão de)', filtros.dataInicio],
    ['Período (emissão até)', filtros.dataFim],
    ['Empresa', labelEmpresaFiltro(filtros.empresa)],
    ['Status', labelStatusFiltro(filtros.status)],
    ['Forma de pagamento', filtros.formaPagamento.trim() || '(todos)'],
    ['Condição de pagamento', filtros.condicaoPagamento.trim() || '(todos)'],
    ['Cliente', filtros.cliente.trim() || '(todos)'],
    ['Pedido', filtros.pedido.trim() || '(todos)'],
    ['Registros exportados', totalExportado],
    ['Exportado em', exportadoEm],
  ];
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  ws['!cols'] = [{ wch: 28 }, { wch: 40 }];
  return ws;
}

export function downloadPainelComercialXlsx(
  pedidos: PainelComercialPedido[],
  filtros: FiltrosPainelComercialExport,
  filename?: string
): void {
  const body = pedidos.map(pedidoParaLinha);
  const wsPedidos = XLSX.utils.aoa_to_sheet([COLUNAS_PEDIDOS, ...body]);
  wsPedidos['!cols'] = autoLarguraColunas(COLUNAS_PEDIDOS, body);

  const wsFiltros = criarAbaFiltros(filtros, pedidos.length);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsPedidos, 'Pedidos');
  XLSX.utils.book_append_sheet(wb, wsFiltros, 'Filtros');

  const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const nome =
    filename ??
    `painel-financeiro-comercial_${filtros.dataInicio}_${filtros.dataFim}_${ts}.xlsx`;
  XLSX.writeFile(wb, nome);
}
