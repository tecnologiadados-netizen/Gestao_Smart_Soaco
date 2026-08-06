import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PainelProducaoApuracaoRow } from '../api/painelProducao';
import { imageUrlToDataUrl } from './imageDataUrl';

const LOGO_URL = '/logo-soaco-email.png';
const NAVY: [number, number, number] = [4, 30, 66];
const ZEBRA: [number, number, number] = [244, 246, 250];

function formatNumero(valor: number, maxDecimals = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(valor);
}

function formatMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

function slugArquivo(texto: string): string {
  return (
    String(texto ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 50) || 'apuracao'
  );
}

export type ExportarApuracaoPdfOpts = {
  mes: string;
  mesLabel: string;
  areaLabel: string;
  rows: PainelProducaoApuracaoRow[];
};

/**
 * PDF padrão do sistema (jsPDF + autoTable + logo Só Aço) com o recorte
 * solicitado da grade de Apuração de Metas.
 */
export async function exportarApuracaoMetasPdf(opts: ExportarApuracaoPdfOpts): Promise<void> {
  const { mes, mesLabel, areaLabel, rows } = opts;
  if (rows.length === 0) {
    throw new Error('Não há linhas para imprimir.');
  }

  const logoBase64 = await imageUrlToDataUrl(LOGO_URL);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const dateStr = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const titleX = logoBase64 ? 46 : 14;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 14, 8, 30, 10);
    } catch {
      /* ignora logo inválida */
    }
  }

  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text('Apuração de Metas', titleX, 13);
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Impresso em: ${dateStr}`, titleX, 18);
  doc.text(`${mesLabel} · ${areaLabel} · ${rows.length} setor(es)`, titleX, 22);

  const head = [
    [
      'Setor',
      'Meta quantitativa',
      'Realizado',
      'Atingimento quantitativo',
      'Meta atingida',
      'Valor a pagar',
    ],
  ];

  const body = rows.map((row) => {
    const unidade = row.unidade || 'un';
    return [
      row.setor,
      `${formatNumero(row.meta_quantitativa)} ${unidade}`,
      `${formatNumero(row.producao_realizada)} ${unidade}`,
      `${formatNumero(row.percentual_meta_quantitativa)}%`,
      row.meta_atingida || '—',
      formatMoeda(row.valor_a_pagar),
    ];
  });

  autoTable(doc, {
    startY: 28,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
    headStyles: {
      fillColor: NAVY,
      textColor: 255,
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: {
      0: { cellWidth: 48 },
      1: { cellWidth: 38, halign: 'right' },
      2: { cellWidth: 38, halign: 'right' },
      3: { cellWidth: 42, halign: 'right' },
      4: { cellWidth: 40 },
      5: { cellWidth: 36, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`apuracao-metas-${slugArquivo(areaLabel)}-${slugArquivo(mes)}.pdf`);
}
