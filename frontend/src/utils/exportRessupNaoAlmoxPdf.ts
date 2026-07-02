import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export type RessupNaoAlmoxPdfRow = {
  codigo: string;
  descricao: string;
  empenho: string;
  qtdSolicit: string;
  estoqAtual: string;
  pcPend: string;
  agPag: string;
  saldoProjetado: string;
};

export type DownloadRessupNaoAlmoxPdfOpts = {
  titulo: string;
  subtitulo?: string;
  linhas: RessupNaoAlmoxPdfRow[];
  logoBase64?: string | null;
};

export function downloadRessupNaoAlmoxPdf(opts: DownloadRessupNaoAlmoxPdfOpts): void {
  const { titulo, subtitulo, linhas, logoBase64 } = opts;
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
  doc.setTextColor(0, 26, 61);
  doc.text(titulo, titleX, 13);
  doc.setFontSize(9);
  doc.text(`Impresso em: ${dateStr}`, titleX, 18);
  if (subtitulo?.trim()) {
    doc.text(subtitulo.trim(), titleX, 22);
  }

  const head = [
    [
      'Cód',
      'Descrição',
      'Empenho',
      'Qtde solicit',
      'Estoque atual',
      'PC',
      'Ag Pag',
      'Saldo projetado',
    ],
  ];

  const body = linhas.map((r) => [
    r.codigo,
    r.descricao,
    r.empenho,
    r.qtdSolicit,
    r.estoqAtual,
    r.pcPend,
    r.agPag,
    r.saldoProjetado,
  ]);

  autoTable(doc, {
    startY: subtitulo?.trim() ? 28 : 24,
    head,
    body,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [4, 30, 66], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 62 },
      2: { cellWidth: 18, halign: 'right' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 16, halign: 'right' },
      6: { cellWidth: 16, halign: 'right' },
      7: { cellWidth: 24, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  const slug =
    titulo
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^\w\-]+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 40) || 'ressup-nao-almox';
  doc.save(`${slug}-${Date.now()}.pdf`);
}
