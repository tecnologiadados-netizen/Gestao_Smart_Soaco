import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import type { CarteiraFinanceiraLinha } from '../../../api/financeiro';
import type { FiltrosCarteiraState } from '../../../utils/persistFiltros';
import {
  formatContasAtrasoTexto,
  formatStatusContasAtrasoTexto,
} from './carteiraContasAtraso';

/** Largura fixa da captura — força grade 2 colunas estável (breakpoint xl). */
const PDF_CAPTURE_WIDTH_PX = 1200;
const CAPTURE_SCALE = 2;
const SETTLE_MS = 450;

const COLS: {
  key: keyof CarteiraFinanceiraLinha;
  label: string;
  money?: boolean;
  date?: boolean;
}[] = [
  { key: 'PD', label: 'PD' },
  { key: 'Emissao', label: 'Emissão', date: true },
  { key: 'previsaoAtual', label: 'Previsão Atual', date: true },
  { key: 'Cliente', label: 'Cliente' },
  { key: 'UF', label: 'UF' },
  { key: 'Municipio de entrega', label: 'Município' },
  { key: 'Observacoes', label: 'Carrada/Rota' },
  { key: 'Condicao de pagamento do pedido de venda', label: 'Cond. Pagamento' },
  { key: 'StatusPedido', label: 'Status de entrega' },
  { key: 'Valor Romaneado', label: 'Saldo Romaneado', money: true },
  { key: 'Saldo a Faturar Real', label: 'Saldo a Faturar Real', money: true },
  { key: 'Saldo a Receber', label: 'Saldo a Receber', money: true },
  { key: 'Venda por qual empresa?', label: 'Empresa' },
  { key: 'tipoF', label: 'Tipo' },
  { key: 'RM', label: 'RM' },
  { key: 'Data de entrega', label: 'Data entrega', date: true },
  { key: 'Vendedor/Representante', label: 'Vendedor' },
  { key: 'Conta', label: 'Conta' },
  { key: 'Status conta', label: 'Status conta' },
];

function nomeArquivo(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `Carteira Financeira ${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}.pdf`;
}

function waitFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso ? String(iso) : '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function fmtReais(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPeriodo(ini: string, fim: string): string | null {
  if (!ini && !fim) return null;
  if (ini && fim) return `${fmtDate(ini)} a ${fmtDate(fim)}`;
  if (ini) return `a partir de ${fmtDate(ini)}`;
  return `até ${fmtDate(fim)}`;
}

function fmtListaCsv(csv: string): string | null {
  const itens = csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (itens.length === 0) return null;
  return itens.join(', ');
}

/** Monta o texto dos filtros ativos para o cabeçalho do PDF. */
export function montarResumoFiltrosCarteiraPdf(filtros: FiltrosCarteiraState): string[] {
  const partes: string[] = [];

  const emissao = fmtPeriodo(filtros.data_emissao_ini, filtros.data_emissao_fim);
  if (emissao) partes.push(`Emissão: ${emissao}`);

  const entrega = fmtPeriodo(filtros.data_entrega_ini, filtros.data_entrega_fim);
  if (entrega) partes.push(`Data original: ${entrega}`);

  const prevAnt = fmtPeriodo(filtros.data_previsao_anterior_ini, filtros.data_previsao_anterior_fim);
  if (prevAnt) partes.push(`Previsão anterior: ${prevAnt}`);

  const prevAtual = fmtPeriodo(filtros.data_previsao_ini, filtros.data_previsao_fim);
  if (prevAtual) partes.push(`Previsão atual: ${prevAtual}`);

  const empresa = fmtListaCsv(filtros.empresaCsv);
  if (empresa) partes.push(`Empresa: ${empresa}`);

  const uf = fmtListaCsv(filtros.ufCsv);
  if (uf) partes.push(`UF: ${uf}`);

  const cliente = fmtListaCsv(filtros.clienteCsv);
  if (cliente) partes.push(`Cliente: ${cliente}`);

  const condicao = fmtListaCsv(filtros.condicaoCsv);
  if (condicao) partes.push(`Condição: ${condicao}`);

  const carrada = fmtListaCsv(filtros.carradaCsv);
  if (carrada) partes.push(`Carrada/Rota: ${carrada}`);

  if (filtros.statusPedido.trim()) {
    partes.push(`Status de entrega: ${filtros.statusPedido.trim()}`);
  }

  return partes.length > 0 ? partes : ['Sem filtros aplicados'];
}

function desenharCabecalhoFiltros(
  pdf: jsPDF,
  filtros: FiltrosCarteiraState | undefined,
  margin: number,
  usableW: number
): number {
  let y = margin;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(30, 41, 59);
  pdf.text('Carteira Financeira', margin, y + 4);
  y += 8;

  if (!filtros) return y + 2;

  const partes = montarResumoFiltrosCarteiraPdf(filtros);
  const linhaFiltros = `Filtros: ${partes.join(' · ')}`;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  const linhas = pdf.splitTextToSize(linhaFiltros, usableW) as string[];
  pdf.text(linhas, margin, y + 2);
  y += linhas.length * 3.4 + 4;

  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.2);
  pdf.line(margin, y, margin + usableW, y);
  return y + 3;
}

function celulaPdf(linha: CarteiraFinanceiraLinha, col: (typeof COLS)[number]): string {
  const v = linha[col.key];
  if (col.money) return fmtReais(Number(v) || 0);
  if (col.date) return fmtDate(v as string | null);
  if (v == null || v === '') return '—';
  if (col.key === 'Conta') {
    return formatContasAtrasoTexto(String(v), fmtReais) || '—';
  }
  if (col.key === 'Status conta') {
    return formatStatusContasAtrasoTexto(String(v), fmtDate) || '—';
  }
  return String(v);
}

async function capturarBloco(el: HTMLElement): Promise<HTMLCanvasElement> {
  const canvas = await html2canvas(el, {
    scale: CAPTURE_SCALE,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: 0,
  });
  if (canvas.width <= 0 || canvas.height <= 0) {
    throw new Error('Falha ao capturar um bloco da Carteira Financeira.');
  }
  return canvas;
}

function adicionarImagemPaginada(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  opts: {
    margin: number;
    usableW: number;
    usableH: number;
    y: number;
    gap: number;
    pageUsed: boolean;
  }
): { y: number; pageUsed: boolean } {
  const { margin, usableW, usableH, gap } = opts;
  let { y, pageUsed } = opts;

  const naturalH = (canvas.height * usableW) / canvas.width;

  if (naturalH <= usableH) {
    if (pageUsed && y + naturalH > margin + usableH) {
      pdf.addPage();
      y = margin;
    }
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, y, usableW, naturalH);
    return { y: y + naturalH + gap, pageUsed: true };
  }

  if (pageUsed && y > margin + 0.5) {
    pdf.addPage();
    y = margin;
  }

  const pageHeightPx = (canvas.height * usableH) / naturalH;
  let offsetY = 0;
  let first = true;
  while (offsetY < canvas.height - 1) {
    if (!first) pdf.addPage();
    first = false;
    const sliceH = Math.min(pageHeightPx, canvas.height - offsetY);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = Math.max(1, Math.round(sliceH));
    const ctx = slice.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    }
    const sliceHMm = (slice.height * usableW) / canvas.width;
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, usableW, sliceHMm);
    offsetY += sliceH;
  }

  return { y: margin + usableH + gap, pageUsed: true };
}

function adicionarTabelaDetalhamento(
  pdf: jsPDF,
  linhas: CarteiraFinanceiraLinha[],
  margin: number,
  cursorY: number,
  pageUsed: boolean
): void {
  const ordenadas = [...linhas].sort(
    (a, b) => (b['Saldo a Receber'] || 0) - (a['Saldo a Receber'] || 0)
  );

  let totalReceber = 0;
  let totalRomaneado = 0;
  let totalFaturar = 0;
  for (const l of ordenadas) {
    totalReceber += l['Saldo a Receber'] || 0;
    totalRomaneado += l['Valor Romaneado'] || 0;
    totalFaturar += l['Saldo a Faturar Real'] || 0;
  }

  const head = [COLS.map((c) => c.label)];
  const body = ordenadas.map((l) => COLS.map((c) => celulaPdf(l, c)));
  const totalRow = COLS.map((c) => {
    if (c.key === 'PD') return 'Total';
    if (c.key === 'Saldo a Receber') return fmtReais(totalReceber);
    if (c.key === 'Valor Romaneado') return fmtReais(totalRomaneado);
    if (c.key === 'Saldo a Faturar Real') return fmtReais(totalFaturar);
    return '';
  });
  body.push(totalRow);

  const pdfH = pdf.internal.pageSize.getHeight();
  const pdfW = pdf.internal.pageSize.getWidth();

  let titleY: number;
  if (!pageUsed) {
    titleY = margin;
  } else if (cursorY < pdfH - margin - 36) {
    titleY = cursorY + 2;
  } else {
    pdf.addPage();
    titleY = margin;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(30, 41, 59);
  pdf.text(
    `Detalhamento (${ordenadas.length.toLocaleString('pt-BR')} linhas)`,
    margin,
    titleY + 4
  );

  autoTable(pdf, {
    startY: titleY + 8,
    head,
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 6.5,
      cellPadding: { top: 1.2, right: 1, bottom: 1.2, left: 1 },
      overflow: 'linebreak',
      valign: 'middle',
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.5,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: Object.fromEntries(
      COLS.map((c, i) => {
        if (c.money) return [i, { halign: 'right' as const }];
        if (c.key === 'UF' || c.key === 'tipoF') return [i, { halign: 'center' as const, cellWidth: 10 }];
        if (c.key === 'StatusPedido') return [i, { halign: 'center' as const, cellWidth: 24 }];
        if (c.key === 'Status conta') return [i, { halign: 'center' as const, cellWidth: 20 }];
        if (c.key === 'Conta') return [i, { cellWidth: 22 }];
        if (c.key === 'PD' || c.key === 'RM') return [i, { cellWidth: 16 }];
        return [i, {}];
      })
    ),
    margin: { left: margin, right: margin, top: margin, bottom: margin + 6 },
    tableWidth: pdfW - 2 * margin,
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [226, 232, 240];
      }
      if (data.section === 'body' && COLS[data.column.index]?.key === 'StatusPedido') {
        const txt = String(data.cell.raw ?? '');
        if (txt === 'Atrasado') {
          data.cell.styles.textColor = [159, 18, 57];
          data.cell.styles.fontStyle = 'bold';
        } else if (txt === 'Em dia') {
          data.cell.styles.textColor = [4, 120, 87];
          data.cell.styles.fontStyle = 'bold';
        }
      }
      if (data.section === 'body' && COLS[data.column.index]?.key === 'Status conta') {
        const txt = String(data.cell.raw ?? '');
        if (txt.includes('Em atraso')) {
          data.cell.styles.textColor = [180, 83, 9];
          data.cell.styles.fontStyle = 'bold';
        }
        if (txt.includes('\n')) {
          data.cell.text = txt.split('\n');
        }
      }
      if (data.section === 'body' && COLS[data.column.index]?.key === 'Conta') {
        const txt = String(data.cell.raw ?? '');
        if (txt.includes('\n')) {
          data.cell.text = txt.split('\n');
        }
      }
    },
  });
}

/**
 * PDF: espelho visual dos cards/gráficos + tabela completa (todas as linhas/colunas via autoTable).
 * O cabeçalho traz o título e o resumo dos filtros aplicados (rotas, datas, UF, etc.).
 */
export async function exportCarteiraFinanceiraPdf(
  root: HTMLElement,
  linhas: CarteiraFinanceiraLinha[],
  filtros?: FiltrosCarteiraState
): Promise<void> {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('[data-pdf-block]')).filter(
    (el) =>
      el.offsetParent !== null &&
      el.getBoundingClientRect().height > 2 &&
      !el.hasAttribute('data-pdf-table')
  );

  const prevWidth = root.style.width;
  const prevMinWidth = root.style.minWidth;

  try {
    root.style.width = `${PDF_CAPTURE_WIDTH_PX}px`;
    root.style.minWidth = `${PDF_CAPTURE_WIDTH_PX}px`;
    await waitFrames();
    await waitMs(SETTLE_MS);

    const pdf = new jsPDF('l', 'mm', 'a4');
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const footerH = 6;
    const gap = 3.5;
    const usableW = pdfW - 2 * margin;
    const usableH = pdfH - 2 * margin - footerH;

    let y = desenharCabecalhoFiltros(pdf, filtros, margin, usableW);
    let pageUsed = true;

    for (const block of blocks) {
      const canvas = await capturarBloco(block);
      const next = adicionarImagemPaginada(pdf, canvas, {
        margin,
        usableW,
        usableH,
        y,
        gap,
        pageUsed,
      });
      y = next.y;
      pageUsed = next.pageUsed;
    }

    if (linhas.length > 0) {
      adicionarTabelaDetalhamento(pdf, linhas, margin, y, pageUsed);
    }

    const totalPages = pdf.getNumberOfPages();
    const horario = new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      pdf.text('Carteira Financeira', margin, pdfH - 3);
      pdf.text(horario, pdfW / 2, pdfH - 3, { align: 'center' });
      pdf.text(`${p} / ${totalPages}`, pdfW - margin, pdfH - 3, { align: 'right' });
    }

    pdf.save(nomeArquivo());
  } finally {
    root.style.width = prevWidth;
    root.style.minWidth = prevMinWidth;
  }
}
