import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export type ItemImpressaoConferencia = {
  codigo: string;
  descricao: string;
};

export type ImprimirItensConferenciaInput = {
  numeroDocumento: string;
  numeroNfe: string | null;
  fornecedor: string | null;
  itens: ItemImpressaoConferencia[];
};

function nomeArquivo(numeroDocumento: string): string {
  const slug = numeroDocumento
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .toLowerCase();
  return `itens-conferencia-${slug || 'documento'}.pdf`;
}

function montarPdf(input: ImprimirItensConferenciaInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margem = 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`Itens — ${input.numeroDocumento}`, margem, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const nfe = input.numeroNfe?.trim() || '—';
  const fornecedor = input.fornecedor?.trim() || '—';
  doc.text(`NF-e ${nfe} · ${fornecedor}`, margem, 22);
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text('Lista só com código e descrição, para o conferente levar ao local da contagem.', margem, 28);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 32,
    margin: { left: margem, right: margem },
    head: [['Código', 'Descrição']],
    body: input.itens.map((item) => [item.codigo || '—', item.descricao || '—']),
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 2.2, textColor: 20 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
    },
  });

  return doc;
}

/** Abre o PDF para impressão. Se o navegador bloquear a janela, baixa o arquivo. */
export async function imprimirItensConferencia(
  input: ImprimirItensConferenciaInput,
): Promise<'aberto' | 'baixado'> {
  if (input.itens.length === 0) {
    throw new Error('Não há itens para imprimir.');
  }
  const doc = montarPdf(input);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const janela = window.open(url, '_blank', 'noopener,noreferrer');
  if (!janela) {
    doc.save(nomeArquivo(input.numeroDocumento));
    URL.revokeObjectURL(url);
    return 'baixado';
  }
  window.setTimeout(() => {
    try {
      janela.focus();
      janela.print();
    } catch {
      /* o usuário imprime pela janela do PDF */
    }
  }, 700);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'aberto';
}
