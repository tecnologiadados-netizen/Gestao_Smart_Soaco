import { Workbook } from 'exceljs';
import type {
  DfcAgendamentoDetalheLinha,
  DfcDespesaPagamentoEmAbertoLinha,
  DfcKpis,
  DfcSaldoBancarioContaGrade,
  DfcSaldoFaturarLinha,
} from '../../../api/financeiro';
import { DFC_PRIORIDADE_LABEL, type DfcPrioridade } from '../../../api/dfcPrioridade';
import { rotuloPeriodoCabecalho } from './dfcPeriodos';
import { diasAtraso, labelCategoria, PLANO_LABEL } from './dfcVencidoPagarShared';
import { EMPRESA_LABELS, labelEmpresaDfc } from './dfcEmpresas';
import {
  addFiltrosSheet,
  autosize,
  baixarWorkbook,
  DATE_FMT,
  MONEY_FMT,
  nomeArquivoPeriodo,
  styleHeader,
  toExcelDate,
  TOTAL_FONT,
} from '../exportFinanceiroXlsxShared';
import type { DfcGradeExportLinha } from './dfcGradeExport';

export type DfcExportFiltros = {
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  empresas: string;
  banco: string;
  prioridade: string;
  plano: string;
};

function chaveLanc(r: DfcAgendamentoDetalheLinha): string {
  return `${r.idEmpresa}#${r.tipoRef}#${r.id}`;
}

function chaveConta(r: DfcAgendamentoDetalheLinha): string {
  return `${r.idEmpresa}#${r.idContaFinanceiro ?? 0}`;
}

function reprogramadoMarcador(r: DfcAgendamentoDetalheLinha): string {
  const desc = (r.descricaoLancamento ?? '').toUpperCase();
  if (r.origem === 'Shop9') return desc.includes('REPR') ? 'REPR' : '';
  return desc.includes('REPROGR') ? 'REPROGR' : '';
}

export async function exportDfcXlsx(params: {
  filtros: DfcExportFiltros;
  periodos: string[];
  grade: DfcGradeExportLinha[];
  kpis: DfcKpis;
  endividamentoTotal: number;
  lancamentos: DfcAgendamentoDetalheLinha[];
  projecao: DfcSaldoFaturarLinha[];
  saldosPorConta: DfcSaldoBancarioContaGrade[];
  vencidos: DfcDespesaPagamentoEmAbertoLinha[];
  prioridadesContasMap: Record<string, DfcPrioridade>;
  prioridadesLancsMap: Record<string, DfcPrioridade>;
  avisos?: string[];
}): Promise<void> {
  const {
    filtros,
    periodos,
    grade,
    kpis,
    endividamentoTotal,
    lancamentos,
    projecao,
    saldosPorConta,
    vencidos,
    prioridadesContasMap,
    prioridadesLancsMap,
    avisos = [],
  } = params;
  const wb = new Workbook();
  wb.creator = 'Gestão Smart Soaco';
  const rotulos = periodos.map((p) => rotuloPeriodoCabecalho(p, filtros.granularidade));

  addFiltrosSheet(
    wb,
    [
      ['Intervalo', `${filtros.dataInicio} a ${filtros.dataFim}`],
      ['Agrupamento', filtros.granularidade === 'dia' ? 'Dia' : 'Mês'],
      ['Empresas', filtros.empresas || 'Todas'],
      ['Banco', filtros.banco || 'Todas'],
      ['Prioridade', filtros.prioridade || 'Todas'],
      ['Plano de contas', filtros.plano || 'Todas'],
      ['Recebimentos', kpis.recebimentos],
      ['Pagamentos', kpis.pagamentos],
      ['Vencido a pagar', kpis.vencidosPagar],
      ['Vencido a receber', kpis.vencidosReceber],
      ['A vencer a pagar', kpis.aVencerPagar],
      ['A vencer a receber', kpis.aVencerReceber],
      ['Endividamento bancário', endividamentoTotal],
      [
        'Observação',
        'Até hoje: caixa realizado (data de baixa). A partir de amanhã: projetado (vencimento / saldo a baixar). Projeção de Receitas (1.1.3) = parcelas de PD Só Aço.',
      ],
    ],
    avisos,
  );
  const wsFiltros = wb.getWorksheet('Filtros');
  if (wsFiltros) {
    for (let r = 8; r <= 14; r++) wsFiltros.getRow(r).getCell(2).numFmt = MONEY_FMT;
  }

  const headersDfc = ['Código', 'Conta', 'Fluxo', 'Tipo', ...rotulos, 'Total'];
  const wsDfc = wb.addWorksheet('DFC');
  wsDfc.addRow(headersDfc);
  styleHeader(wsDfc, headersDfc.length);
  for (const linha of grade) {
    const values: (string | number)[] = [linha.codigo, linha.conta, linha.fluxo, linha.tipo];
    for (const p of periodos) values.push(linha.valores[p] ?? 0);
    values.push(linha.total);
    const row = wsDfc.addRow(values);
    if (linha.tipo === 'T' || linha.tipo === 'S') row.font = TOTAL_FONT;
    for (let c = 5; c <= 5 + periodos.length; c++) row.getCell(c).numFmt = MONEY_FMT;
  }
  autosize(wsDfc, headersDfc.length);

  const lancHeaders = [
    'Situação',
    'Empresa',
    'Conta DFC',
    'Banco',
    'Fornecedor/Cliente',
    'Descrição',
    'Competência',
    'Vencimento',
    'Baixa',
    'Valor',
    'Tipo',
    'Origem',
    'Pedido',
    'Forma de pagamento',
    'Comentários',
    'Prioridade',
    'Reprogramado',
  ];
  const wsLanc = wb.addWorksheet('Lançamentos');
  wsLanc.addRow(lancHeaders);
  styleHeader(wsLanc, lancHeaders.length);
  for (const r of lancamentos) {
    const sit = r.situacao ?? (r.dataBaixa ? 'Realizado' : 'Projetado');
    const prioLanc = prioridadesLancsMap[chaveLanc(r)];
    const prioConta = prioridadesContasMap[chaveConta(r)];
    const prio = prioLanc ?? prioConta;
    const contaLabel =
      (r.idContaFinanceiro != null && PLANO_LABEL[r.idContaFinanceiro]) || r.planoContas || r.idContaFinanceiro || '';
    const row = wsLanc.addRow([
      sit,
      r.empresa ?? labelEmpresaDfc(r.idEmpresa) ?? EMPRESA_LABELS[r.idEmpresa] ?? '',
      contaLabel,
      r.contaBancaria ?? '',
      r.nome ?? '',
      r.descricaoLancamento ?? '',
      toExcelDate(r.dataCompetencia),
      toExcelDate(r.dataVencimento),
      toExcelDate(r.dataBaixa),
      r.valorBaixado,
      r.tipoMovimento || r.tipoRef,
      r.origem ?? '',
      r.idPedido ?? '',
      r.formaPagamento ?? '',
      r.comentarios ?? '',
      prio != null ? DFC_PRIORIDADE_LABEL[prio] : '',
      reprogramadoMarcador(r),
    ]);
    for (const c of [7, 8, 9]) {
      if (row.getCell(c).value instanceof Date) row.getCell(c).numFmt = DATE_FMT;
    }
    row.getCell(10).numFmt = MONEY_FMT;
  }
  autosize(wsLanc, lancHeaders.length);

  const projHeaders = [
    'PD',
    'Parcela',
    'Cliente',
    'Vendedor',
    'UF',
    'Município',
    'Condição',
    'Valor pendente',
    'Saldo a faturar',
    'Data projetada vencimento',
  ];
  const wsProj = wb.addWorksheet('Projeção de receitas');
  wsProj.addRow(projHeaders);
  styleHeader(wsProj, projHeaders.length);
  for (const r of projecao) {
    const row = wsProj.addRow([
      r.pd ?? '',
      r.parc ?? r.idParcela ?? '',
      r.cliente ?? '',
      r.vendedorRepresentante ?? '',
      r.uf ?? '',
      r.municipioEntrega ?? '',
      r.condicaoPagamento ?? '',
      r.valorPendente,
      r.saldoFaturarReal,
      toExcelDate(r.dataProjVenc),
    ]);
    row.getCell(8).numFmt = MONEY_FMT;
    row.getCell(9).numFmt = MONEY_FMT;
    if (row.getCell(10).value instanceof Date) row.getCell(10).numFmt = DATE_FMT;
  }
  autosize(wsProj, projHeaders.length);

  const salHeaders = ['Conta', 'Empresa', ...rotulos.flatMap((r) => [`Inicial ${r}`, `Final ${r}`])];
  const wsSal = wb.addWorksheet('Saldos bancários');
  wsSal.addRow(salHeaders);
  styleHeader(wsSal, salHeaders.length);
  for (const c of saldosPorConta) {
    const values: (string | number)[] = [
      c.nomeContaBancaria,
      EMPRESA_LABELS[c.idEmpresa] ?? labelEmpresaDfc(c.idEmpresa) ?? String(c.idEmpresa),
    ];
    for (const p of periodos) {
      values.push(c.saldosIniciaisPorPeriodo[p] ?? 0);
      values.push(c.saldosFinaisPorPeriodo[p] ?? 0);
    }
    const row = wsSal.addRow(values);
    for (let col = 3; col <= 2 + periodos.length * 2; col++) row.getCell(col).numFmt = MONEY_FMT;
  }
  autosize(wsSal, salHeaders.length);

  const vencHeaders = ['Código', 'Vencimento', 'Atraso dias', 'Empresa', 'Categoria', 'Fornecedor', 'Saldo'];
  const wsVenc = wb.addWorksheet('Vencido a pagar');
  wsVenc.addRow(vencHeaders);
  styleHeader(wsVenc, vencHeaders.length);
  for (const r of vencidos) {
    const row = wsVenc.addRow([
      r.id,
      toExcelDate(r.dataVencimento),
      diasAtraso(r.dataVencimento),
      labelEmpresaDfc(r.idEmpresa),
      labelCategoria(r),
      r.nome ?? '',
      r.saldoBaixar,
    ]);
    if (row.getCell(2).value instanceof Date) row.getCell(2).numFmt = DATE_FMT;
    row.getCell(7).numFmt = MONEY_FMT;
  }
  autosize(wsVenc, vencHeaders.length);

  await baixarWorkbook(
    wb,
    nomeArquivoPeriodo('dfc', filtros.dataInicio, filtros.dataFim, filtros.granularidade),
  );
}
