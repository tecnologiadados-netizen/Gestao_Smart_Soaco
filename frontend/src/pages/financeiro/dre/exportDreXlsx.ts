import { Workbook } from 'exceljs';
import type { DreExportDevolucaoLinha, DreExportReceitaLinha, DfcAgendamentoDetalheLinha } from '../../../api/financeiro';
import { rotuloPeriodoCabecalho } from '../dfc/dfcPeriodos';
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
import type { DreGradeExportLinha } from './dreGradeExport';

export type DreExportFiltros = {
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  empresas: string;
  planoContas: string;
  mkpAtivo: boolean;
  rateioLigado: boolean;
};

function pctExcel(v: number | null | undefined): number | string {
  if (v == null || !Number.isFinite(v)) return '';
  return v / 100;
}

export async function exportDreXlsx(params: {
  filtros: DreExportFiltros;
  periodos: string[];
  grade: DreGradeExportLinha[];
  receitas: DreExportReceitaLinha[];
  devolucoes: DreExportDevolucaoLinha[];
  saidas: DfcAgendamentoDetalheLinha[];
  avisos?: string[];
}): Promise<void> {
  const { filtros, periodos, grade, receitas, devolucoes, saidas, avisos = [] } = params;
  const wb = new Workbook();
  wb.creator = 'Gestão Smart Soaco';

  addFiltrosSheet(
    wb,
    [
      ['Intervalo', `${filtros.dataInicio} a ${filtros.dataFim}`],
      ['Visão', filtros.granularidade === 'dia' ? 'Dia' : 'Mês'],
      ['Empresas', filtros.empresas || 'Todas'],
      ['Plano de contas', filtros.planoContas || 'Todas'],
      ['MKP', filtros.mkpAtivo],
      ['Rateio', filtros.rateioLigado],
      [
        'Observação',
        'A DRE é competência realizada (NF emitida). Esticar a data fim não cria previsão de resultado; o caixa à frente está no DFC.',
      ],
    ],
    avisos,
  );

  const rotulos = periodos.map((p) => rotuloPeriodoCabecalho(p, filtros.granularidade));
  const headersDre = [
    'Código',
    'Conta',
    'Tipo',
    ...rotulos.flatMap((r) => [r, `AV ${r}`, `AH ${r}`]),
    'Total',
    'AV Total',
    'Média',
    'AV Média',
    ...(filtros.mkpAtivo ? ['MKP'] : []),
  ];
  const wsDre = wb.addWorksheet('DRE');
  wsDre.addRow(headersDre);
  styleHeader(wsDre, headersDre.length);

  const moneyCols: number[] = [];
  rotulos.forEach((_, i) => moneyCols.push(4 + i * 3));
  moneyCols.push(4 + rotulos.length * 3);
  moneyCols.push(6 + rotulos.length * 3);
  const pctCols: number[] = [];
  rotulos.forEach((_, i) => {
    pctCols.push(5 + i * 3);
    pctCols.push(6 + i * 3);
  });
  pctCols.push(5 + rotulos.length * 3);
  pctCols.push(7 + rotulos.length * 3);

  for (const linha of grade) {
    const values: (string | number | null)[] = [linha.codigo, linha.conta, linha.tipo];
    for (const p of periodos) {
      values.push(linha.valores[p] ?? 0);
      values.push(pctExcel(linha.avPorPeriodo[p]));
      values.push(pctExcel(linha.ahPorPeriodo[p]));
    }
    values.push(linha.total);
    values.push(pctExcel(linha.avTotal));
    values.push(linha.media);
    values.push(pctExcel(linha.avMedia));
    if (filtros.mkpAtivo) values.push(linha.mkpRotulo);
    const row = wsDre.addRow(values);
    if (linha.tipo === 'T' || linha.tipo === 'S') row.font = TOTAL_FONT;
    for (const c of moneyCols) row.getCell(c).numFmt = MONEY_FMT;
    for (const c of pctCols) {
      if (typeof row.getCell(c).value === 'number') row.getCell(c).numFmt = '0.0%';
    }
  }
  autosize(wsDre, headersDre.length);

  const recHeaders = [
    'Canal',
    'Empresa',
    'Emissão',
    'PD',
    'Produto',
    'Grupo',
    'Documento',
    'Qtde',
    'Unitário',
    'Bruto',
    'Desconto',
    'Líquido',
    'Tipo movimento',
    'Status NF',
    '% MKP',
    'Valor indireto',
  ];
  const wsRec = wb.addWorksheet('Receitas');
  wsRec.addRow(recHeaders);
  styleHeader(wsRec, recHeaders.length);
  for (const r of receitas) {
    const row = wsRec.addRow([
      r.canal,
      r.empresa,
      toExcelDate(r.dataEmissao),
      r.pedido ?? '',
      r.produto ?? '',
      r.grupoProduto,
      r.numeroDocumentoFiscal ?? '',
      r.qtde,
      r.valorUnitario,
      r.valorTotal,
      r.totalDesconto,
      r.valorTotalComDesconto,
      r.tipoMovimentacao ?? '',
      r.statusNfe ?? '',
      r.percMarkup ?? '',
      r.valorIndireto ?? '',
    ]);
    if (row.getCell(3).value instanceof Date) row.getCell(3).numFmt = DATE_FMT;
    for (const c of [8, 9, 10, 11, 12, 16]) row.getCell(c).numFmt = MONEY_FMT;
    row.getCell(8).numFmt = '#,##0.000';
  }
  autosize(wsRec, recHeaders.length);

  const devHeaders = ['Empresa', 'Emissão', 'NF', 'Produto', 'Grupo', 'Qtde', 'Unitário', 'Valor', 'Tipo movimento'];
  const wsDev = wb.addWorksheet('Devoluções');
  wsDev.addRow(devHeaders);
  styleHeader(wsDev, devHeaders.length);
  for (const r of devolucoes) {
    const row = wsDev.addRow([
      r.empresa ?? '',
      toExcelDate(r.dataEmissao),
      r.numeroDocumentoFiscal ?? '',
      r.produto ?? '',
      r.grupoProduto,
      r.qtde,
      r.valorUnitario,
      r.valorTotal,
      r.tipoMovimentacao ?? '',
    ]);
    if (row.getCell(2).value instanceof Date) row.getCell(2).numFmt = DATE_FMT;
    row.getCell(6).numFmt = '#,##0.000';
    row.getCell(7).numFmt = MONEY_FMT;
    row.getCell(8).numFmt = MONEY_FMT;
  }
  autosize(wsDev, devHeaders.length);

  const saiHeaders = [
    'Origem',
    'Empresa',
    'Conta DRE (id)',
    'Fornecedor',
    'Descrição',
    'Competência',
    'Vencimento',
    'Baixa',
    'Valor',
    'Tipo',
  ];
  const wsSai = wb.addWorksheet('Saídas');
  wsSai.addRow(saiHeaders);
  styleHeader(wsSai, saiHeaders.length);
  for (const r of saidas) {
    const row = wsSai.addRow([
      r.origem ?? '',
      r.empresa ?? '',
      r.idContaFinanceiro ?? '',
      r.nome ?? '',
      r.descricaoLancamento ?? '',
      toExcelDate(r.dataCompetencia),
      toExcelDate(r.dataVencimento),
      toExcelDate(r.dataBaixa),
      r.valorBaixado,
      r.tipoRef,
    ]);
    for (const c of [6, 7, 8]) {
      if (row.getCell(c).value instanceof Date) row.getCell(c).numFmt = DATE_FMT;
    }
    row.getCell(9).numFmt = MONEY_FMT;
  }
  autosize(wsSai, saiHeaders.length);

  await baixarWorkbook(
    wb,
    nomeArquivoPeriodo('dre', filtros.dataInicio, filtros.dataFim, filtros.granularidade),
  );
}
