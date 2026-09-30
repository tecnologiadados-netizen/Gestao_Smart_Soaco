import { Workbook } from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DiarioContaPagarLinha } from '../../../api/diarioFinanceiro';
import {
  MONEY_FMT,
  DATE_FMT,
  autosize,
  baixarWorkbook,
  styleHeader,
  toExcelDate,
} from '../exportFinanceiroXlsxShared';

export type DiarioExportLinha = {
  origem: string;
  situacao: string;
  vencimento: string | null;
  baixa: string | null;
  fornecedor: string;
  empresa: string;
  plano: string;
  descricao: string;
  observacao: string;
  forma: string;
  conta: string;
  valor: number;
  baixado: number;
  saldo: number;
};

const COLUNAS = [
  'Origem',
  'Situação',
  'Vencimento',
  'Baixa',
  'Fornecedor',
  'Empresa',
  'Plano de contas',
  'Descrição',
  'Observações',
  'Forma pgto',
  'Conta bancária',
  'Valor',
  'Baixado',
  'Saldo',
] as const;

function dataBr(iso: string | null): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function nomeArquivo(inicio: string, fim: string, ext: 'xlsx' | 'pdf'): string {
  const a = inicio || 'inicio';
  const b = fim || 'fim';
  return `diario-financeiro-${a}-a-${b}.${ext}`;
}

function totais(linhas: DiarioExportLinha[]) {
  return linhas.reduce(
    (acc, l) => ({
      valor: acc.valor + l.valor,
      baixado: acc.baixado + l.baixado,
      saldo: acc.saldo + l.saldo,
    }),
    { valor: 0, baixado: 0, saldo: 0 },
  );
}

export async function exportDiarioFinanceiroXlsx(
  linhas: DiarioExportLinha[],
  periodo: { inicio: string; fim: string },
): Promise<void> {
  const wb = new Workbook();
  const ws = wb.addWorksheet('Contas a pagar');
  ws.addRow([...COLUNAS]);
  styleHeader(ws, COLUNAS.length);
  for (const l of linhas) {
    const row = ws.addRow([
      l.origem,
      l.situacao,
      toExcelDate(l.vencimento),
      toExcelDate(l.baixa),
      l.fornecedor,
      l.empresa,
      l.plano,
      l.descricao,
      l.observacao,
      l.forma,
      l.conta,
      l.valor,
      l.baixado,
      l.saldo,
    ]);
    row.getCell(3).numFmt = DATE_FMT;
    row.getCell(4).numFmt = DATE_FMT;
    row.getCell(12).numFmt = MONEY_FMT;
    row.getCell(13).numFmt = MONEY_FMT;
    row.getCell(14).numFmt = MONEY_FMT;
  }
  const t = totais(linhas);
  const total = ws.addRow(['', '', '', '', '', '', '', '', '', '', `${linhas.length} lançamento(s)`, t.valor, t.baixado, t.saldo]);
  total.font = { bold: true };
  total.getCell(12).numFmt = MONEY_FMT;
  total.getCell(13).numFmt = MONEY_FMT;
  total.getCell(14).numFmt = MONEY_FMT;
  autosize(ws, COLUNAS.length);
  await baixarWorkbook(wb, nomeArquivo(periodo.inicio, periodo.fim, 'xlsx'));
}

export function exportDiarioFinanceiroPdf(
  linhas: DiarioExportLinha[],
  periodo: { inicio: string; fim: string },
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const t = totais(linhas);
  const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  doc.setFontSize(12);
  doc.text('Diário Financeiro — Contas a pagar', 8, 10);
  doc.setFontSize(8);
  doc.text(
    `Vencimento ${dataBr(periodo.inicio)} a ${dataBr(periodo.fim)} · ${linhas.length.toLocaleString('pt-BR')} lançamento(s) · Valor ${moeda(t.valor)} · Baixado ${moeda(t.baixado)} · Saldo ${moeda(t.saldo)}`,
    8,
    15,
  );
  autoTable(doc, {
    startY: 18,
    head: [COLUNAS.slice()],
    body: linhas.map((l) => [
      l.origem,
      l.situacao,
      dataBr(l.vencimento),
      dataBr(l.baixa),
      l.fornecedor,
      l.empresa,
      l.plano,
      l.descricao,
      l.observacao,
      l.forma,
      l.conta,
      moeda(l.valor),
      moeda(l.baixado),
      moeda(l.saldo),
    ]),
    styles: { fontSize: 6, cellPadding: 0.8, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
    margin: { left: 6, right: 6 },
  });
  doc.save(nomeArquivo(periodo.inicio, periodo.fim, 'pdf'));
}

export function linhaParaExport(
  l: DiarioContaPagarLinha,
  empresa: string | null,
): DiarioExportLinha {
  return {
    origem: l.origem,
    situacao: l.status,
    vencimento: l.dataVencimento,
    baixa: l.dataBaixa,
    fornecedor: l.fornecedor?.trim() ?? '',
    empresa: empresa?.trim() ?? '',
    plano: l.planoContas?.trim() ?? '',
    descricao: l.descricao?.trim() ?? '',
    observacao: l.observacao?.trim() ?? '',
    forma: l.formaPagamento?.trim() ?? '',
    conta: l.contaBancaria?.trim() ?? '',
    valor: l.valor,
    baixado: l.valorBaixado,
    saldo: l.saldo,
  };
}
