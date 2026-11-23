import { Workbook, type Cell, type Row, type Worksheet } from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable, { type CellHookData, type CellInput } from 'jspdf-autotable';
import type { DiarioContaPagarLinha } from '../../../api/diarioFinanceiro';
import { baixarWorkbook, MONEY_FMT, styleHeader } from '../exportFinanceiroXlsxShared';
import { hexObservacaoDiario } from './coresObservacaoDiario';
import { trechosDescricaoReprogramada, type TrechoDescricao } from './descricaoReprogramada';

const COLUNAS = [
  'Código',
  'Situação',
  'Classificação',
  'Vencimento',
  'Reprogramado',
  'Empresa',
  'Conta',
  'Forma de pagamento',
  'Pessoa',
  'Descrição',
  'Comentários',
  'Observação',
  'Pedido de compra',
  'Saldo a pagar',
  'NF',
  'Prioridade',
  'Cartório',
] as const;

/** Índices 0-based (jsPDF-AutoTable). */
const COL_DESCRICAO = COLUNAS.indexOf('Descrição');
const COL_ANOTACAO = COLUNAS.indexOf('Observação');
/** Índices 1-based (ExcelJS). */
const COL_ANOTACAO_XLS = COL_ANOTACAO + 1;
const COL_SALDO = COLUNAS.indexOf('Saldo a pagar') + 1;

const VERMELHO = 'FFDC2626';
const TEXTO = [30, 41, 59] as [number, number, number];
const VERMELHO_RGB = [220, 38, 38] as [number, number, number];

function rgbDeHex(hex: string): [number, number, number] {
  const n = hex.replace('#', '');
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

function argbDeHex(hex: string): string {
  const n = hex.replace('#', '').toUpperCase();
  if (n.length === 8) return n;
  return `FF${n}`;
}

function corTextoSobreFundo(hex: string): string {
  const [r, g, b] = rgbDeHex(hex);
  const luma = (r * 299 + g * 587 + b * 114) / 1000;
  return luma < 140 ? 'FFFFFFFF' : 'FF1E293B';
}

function corTextoRgbSobreFundo(hex: string): [number, number, number] {
  const [r, g, b] = rgbDeHex(hex);
  const luma = (r * 299 + g * 587 + b * 114) / 1000;
  return luma < 140 ? [255, 255, 255] : TEXTO;
}

/** Novo objeto a cada chamada — ExcelJS compartilha style id se a mesma ref for reutilizada. */
function fillSolido(argb: string) {
  return {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb },
  };
}

function pintarCelula(cell: Cell, hex: string, opts?: { wrap?: boolean }) {
  const argb = argbDeHex(hex);
  cell.fill = fillSolido(argb);
  cell.font = {
    name: 'Calibri',
    size: 10,
    color: { argb: corTextoSobreFundo(hex) },
  };
  if (opts?.wrap) {
    cell.alignment = { wrapText: true, vertical: 'top' };
  }
}

/**
 * Pinta a linha inteira com a cor da Observação (comportamento visível no Excel)
 * e reforça a célula Observação.
 */
function pintarLinhaComCorObservacao(row: Row, hex: string, colAnotacao: number, colCount: number) {
  const fonte = corTextoSobreFundo(hex);
  const argb = argbDeHex(hex);
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = fillSolido(argb);
    // Descrição com richText: só o fundo; o restante recebe fonte sólida.
    if (c === COL_DESCRICAO + 1) continue;
    cell.font = { name: 'Calibri', size: 10, color: { argb: fonte } };
  }
  const obs = row.getCell(colAnotacao);
  pintarCelula(obs, hex, { wrap: true });
  if (obs.value == null || obs.value === '') obs.value = '';
}

function maiusculo(valor: string | null | undefined): string {
  return (valor ?? '').toLocaleUpperCase('pt-BR');
}

export type TotaisDiario = {
  qtd: number;
  valor: number;
  baixado: number;
  saldo: number;
};

function formatData(iso: string | null): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Serial do Excel (sistema 1900) só com o dia.
 * Um Date local passa pelo fuso em exceljs e a célula abre com hora (ex.: 03:00).
 */
function dataExcelSemHora(iso: string | null): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const utc = Date.UTC(y!, m! - 1, d!);
  return Math.round(25569 + utc / 86_400_000);
}

function formatMoeda(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function empresaExibida(l: DiarioContaPagarLinha): string {
  return l.filial?.trim() || l.empresa?.trim() || '';
}

function nomeArquivo(inicio: string, fim: string, ext: 'xlsx' | 'pdf'): string {
  const a = inicio || 'inicio';
  const b = fim || 'fim';
  const agora = new Date();
  const hh = String(agora.getHours()).padStart(2, '0');
  const mm = String(agora.getMinutes()).padStart(2, '0');
  return `diario-financeiro-${a}-a-${b}_${hh}${mm}.${ext}`;
}

function valorTextoCelula(value: unknown): string {
  if (value && typeof value === 'object' && 'richText' in value) {
    const rich = (value as { richText: Array<{ text?: string }> }).richText;
    return rich.map((p) => p.text ?? '').join('');
  }
  if (value instanceof Date) return value.toLocaleDateString('pt-BR');
  return value == null ? '' : String(value);
}

function autosize(ws: Worksheet, colCount: number) {
  for (let c = 1; c <= colCount; c++) {
    let max = 10;
    ws.eachRow((row) => {
      const len = valorTextoCelula(row.getCell(c).value).length;
      if (len > max) max = Math.min(len, 60);
    });
    ws.getColumn(c).width = Math.max(max + 3, c === COL_DESCRICAO + 1 ? 42 : 10);
  }
}

function richTextDescricao(texto: string | null) {
  const trechos = trechosDescricaoReprogramada(texto);
  if (trechos.length === 0) return '';
  if (trechos.length === 1 && !trechos[0].destaque) return trechos[0].texto;
  return {
    richText: trechos.map((t) => ({
      text: t.texto,
      font: t.destaque
        ? { bold: true, color: { argb: VERMELHO }, name: 'Calibri', size: 10 }
        : { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } },
    })),
  };
}

function celulaObsPdf(l: DiarioContaPagarLinha): CellInput {
  const texto = maiusculo(l.anotacao);
  const fundo = hexObservacaoDiario(l.anotacaoCor);
  if (!fundo) return texto;
  return {
    content: texto,
    styles: {
      fillColor: rgbDeHex(fundo),
      textColor: corTextoRgbSobreFundo(fundo),
      fontStyle: 'bold',
    },
  };
}

export async function exportarDiarioContasPagarExcel(opts: {
  linhas: DiarioContaPagarLinha[];
  totais: TotaisDiario;
  dataInicio: string;
  dataFim: string;
  rotuloPrioridade?: (linha: DiarioContaPagarLinha) => string;
  incluirResultadoAprovacao?: boolean;
}): Promise<void> {
  const wb = new Workbook();
  const ws = wb.addWorksheet('Contas a pagar');
  const colunas = [
    ...COLUNAS,
    ...(opts.incluirResultadoAprovacao ? ['STATUS DA APROVAÇÃO', 'BANCO'] : []),
  ];
  const colAnotacao =
    colunas.findIndex((c) => c === 'Observação') >= 0
      ? colunas.findIndex((c) => c === 'Observação') + 1
      : COL_ANOTACAO_XLS;

  ws.addRow(colunas);
  styleHeader(ws, colunas.length);

  for (const l of opts.linhas) {
    const row = ws.addRow([
      l.codigoClassificacao != null && l.codigoClassificacao > 0 ? l.codigoClassificacao : '',
      maiusculo(l.status),
      maiusculo(l.planoContas),
      dataExcelSemHora(l.dataVencimento),
      maiusculo(l.reprogramado),
      maiusculo(empresaExibida(l)),
      maiusculo(l.contaBancaria),
      maiusculo(l.formaPagamento),
      maiusculo(l.fornecedor),
      richTextDescricao(maiusculo(l.descricao)),
      maiusculo(l.observacao),
      maiusculo(l.anotacao) || '',
      maiusculo(l.pedidoCompra),
      l.saldo,
      maiusculo(l.notaFiscal),
      maiusculo(opts.rotuloPrioridade?.(l)),
      l.emCartorio ? 'SIM' : '',
      ...(opts.incluirResultadoAprovacao
        ? [maiusculo(l.statusAprovacao), maiusculo(l.bancoAprovacao)]
        : []),
    ]);
    row.getCell(4).numFmt = 'dd/mm/yyyy';
    row.getCell(COL_SALDO).numFmt = MONEY_FMT;
    row.getCell(COL_SALDO).alignment = { horizontal: 'right' };
    const fundo = hexObservacaoDiario(l.anotacaoCor);
    if (fundo) pintarLinhaComCorObservacao(row, fundo, colAnotacao, colunas.length);
  }

  const total = ws.addRow([
    `Lançamentos: ${opts.totais.qtd.toLocaleString('pt-BR')}`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    opts.totais.saldo,
    '',
    '',
    '',
    ...(opts.incluirResultadoAprovacao ? ['', ''] : []),
  ]);
  total.font = { bold: true };
  total.getCell(COL_SALDO).numFmt = MONEY_FMT;
  total.getCell(COL_SALDO).font = { bold: true };

  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, opts.linhas.length + 1), column: colunas.length },
  };
  autosize(ws, colunas.length);

  // Reaplica após autosize (alguns leitores ExcelJS perdem fill se só pintar antes).
  opts.linhas.forEach((l, i) => {
    const fundo = hexObservacaoDiario(l.anotacaoCor);
    if (!fundo) return;
    pintarLinhaComCorObservacao(ws.getRow(i + 2), fundo, colAnotacao, colunas.length);
  });

  await baixarWorkbook(wb, nomeArquivo(opts.dataInicio, opts.dataFim, 'xlsx'));
}

function tokensQuebraveis(doc: jsPDF, trechos: TrechoDescricao[], maxW: number): TrechoDescricao[] {
  const saida: TrechoDescricao[] = [];
  for (const trecho of trechos) {
    const pedacos = trecho.texto.split(/(\s+)/).filter(Boolean);
    for (const pedaco of pedacos) {
      doc.setFont('helvetica', trecho.destaque ? 'bold' : 'normal');
      if (doc.getTextWidth(pedaco) <= maxW) {
        saida.push({ texto: pedaco, destaque: trecho.destaque });
        continue;
      }
      let buf = '';
      for (const ch of pedaco) {
        const prox = buf + ch;
        if (buf && doc.getTextWidth(prox) > maxW) {
          saida.push({ texto: buf, destaque: trecho.destaque });
          buf = ch;
        } else {
          buf = prox;
        }
      }
      if (buf) saida.push({ texto: buf, destaque: trecho.destaque });
    }
  }
  return saida;
}

function desenharDescricao(doc: jsPDF, data: CellHookData, texto: string) {
  const fontSize = 6.5;
  const padX = 1.1;
  const padY = 1.3;
  const maxW = Math.max(8, data.cell.width - padX * 2);
  doc.setFontSize(fontSize);
  const tokens = tokensQuebraveis(doc, trechosDescricaoReprogramada(texto), maxW);
  const linhas: TrechoDescricao[][] = [];
  let linha: TrechoDescricao[] = [];
  let largura = 0;
  for (const token of tokens) {
    doc.setFont('helvetica', token.destaque ? 'bold' : 'normal');
    const w = doc.getTextWidth(token.texto);
    if (linha.length > 0 && largura + w > maxW && token.texto.trim()) {
      linhas.push(linha);
      linha = [];
      largura = 0;
    }
    linha.push(token);
    largura += w;
  }
  if (linha.length > 0) linhas.push(linha);

  const lineH = 2.6;
  let y = data.cell.y + padY + 2.1;
  for (const ln of linhas) {
    if (y > data.cell.y + data.cell.height - 0.4) break;
    let x = data.cell.x + padX;
    for (const t of ln) {
      doc.setFont('helvetica', t.destaque ? 'bold' : 'normal');
      doc.setTextColor(...(t.destaque ? VERMELHO_RGB : TEXTO));
      doc.text(t.texto, x, y);
      x += doc.getTextWidth(t.texto);
    }
    y += lineH;
  }
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXTO);
}

export function exportarDiarioContasPagarPdf(opts: {
  linhas: DiarioContaPagarLinha[];
  totais: TotaisDiario;
  dataInicio: string;
  dataFim: string;
  rotuloPrioridade?: (linha: DiarioContaPagarLinha) => string;
}): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...TEXTO);
  doc.text('Diário Financeiro — Contas a pagar', 8, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Vencimento ${formatData(opts.dataInicio)} a ${formatData(opts.dataFim)}`, 8, 15);

  const body: CellInput[][] = opts.linhas.map((l) => [
    l.codigoClassificacao != null && l.codigoClassificacao > 0 ? String(l.codigoClassificacao) : '',
    maiusculo(l.status),
    maiusculo(l.planoContas),
    formatData(l.dataVencimento),
    maiusculo(l.reprogramado),
    maiusculo(empresaExibida(l)),
    maiusculo(l.contaBancaria),
    maiusculo(l.formaPagamento),
    maiusculo(l.fornecedor),
    maiusculo(l.descricao),
    maiusculo(l.observacao),
    celulaObsPdf(l),
    maiusculo(l.pedidoCompra),
    formatMoeda(l.saldo),
    maiusculo(l.notaFiscal),
    maiusculo(opts.rotuloPrioridade?.(l)),
    l.emCartorio ? 'SIM' : '',
  ]);

  autoTable(doc, {
    startY: 18,
    margin: { left: 6, right: 6, bottom: 10 },
    head: [[...COLUNAS]],
    body,
    foot: [[
      `Lançamentos: ${opts.totais.qtd.toLocaleString('pt-BR')}`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      formatMoeda(opts.totais.saldo),
      '',
      '',
      '',
    ]],
    styles: { fontSize: 6.5, cellPadding: 0.9, textColor: TEXTO, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: TEXTO, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 18 },
      2: { cellWidth: 28 },
      3: { cellWidth: 18 },
      4: { cellWidth: 20 },
      5: { cellWidth: 24 },
      6: { cellWidth: 22 },
      7: { cellWidth: 22 },
      8: { cellWidth: 28 },
      9: { cellWidth: 32 },
      10: { cellWidth: 20 },
      11: { cellWidth: 24 },
      12: { cellWidth: 22 },
      13: { cellWidth: 18, halign: 'right' },
      14: { cellWidth: 16 },
      15: { cellWidth: 16 },
      16: { cellWidth: 14 },
    },
    horizontalPageBreak: true,
    didParseCell(data) {
      if (data.section !== 'body') return;
      const linha = opts.linhas[data.row.index];
      const fundo = hexObservacaoDiario(linha?.anotacaoCor);
      if (!fundo) return;
      // Linha inteira no PDF (mesma regra do Excel).
      data.cell.styles.fillColor = rgbDeHex(fundo);
      data.cell.styles.textColor = corTextoRgbSobreFundo(fundo);
      if (data.column.index === COL_ANOTACAO) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
    willDrawCell(data) {
      if (data.section === 'body' && data.column.index === COL_DESCRICAO) {
        data.cell.text = [];
      }
    },
    didDrawCell(data) {
      if (data.section !== 'body' || data.column.index !== COL_DESCRICAO) return;
      const texto = String(data.cell.raw ?? '');
      if (!texto) return;
      desenharDescricao(doc, data, texto);
    },
  });

  doc.save(nomeArquivo(opts.dataInicio, opts.dataFim, 'pdf'));
}
