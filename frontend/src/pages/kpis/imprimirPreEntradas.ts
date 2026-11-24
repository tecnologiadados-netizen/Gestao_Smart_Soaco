import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ImpressaoPreEntrada, MaterialImpressaoPreEntrada } from '../../api/gestaoEntradas';

function fmtDataBr(ymd: string | null): string {
  if (!ymd) return '—';
  const [y, m, d] = ymd.slice(0, 10).split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function fmtQtde(qtde: number | null): string {
  if (qtde == null) return '—';
  return qtde.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
}

function textoMaterial(item: MaterialImpressaoPreEntrada): string {
  return item.descricao?.trim() || item.codigo?.trim() || 'Sem materiais neste documento';
}

const NAVY: [number, number, number] = [0, 40, 85];
const OURO: [number, number, number] = [255, 214, 102];
const GELO: [number, number, number] = [232, 238, 246];
const CINZA: [number, number, number] = [241, 245, 249];
const TINTA: [number, number, number] = [15, 23, 42];
const APAGADO: [number, number, number] = [71, 85, 105];

function subtitulo(relacao: ImpressaoPreEntrada, documentos: number): string {
  const periodo =
    relacao.dataInicio && relacao.dataFim
      ? `Entrada de ${fmtDataBr(relacao.dataInicio)} a ${fmtDataBr(relacao.dataFim)}`
      : 'Todas as pré-entradas atuais';
  const rotulo = documentos === 1 ? 'documento' : 'documentos';
  return `${periodo} · ${documentos} ${rotulo}`;
}

function contarDocumentos(relacao: ImpressaoPreEntrada): number {
  const ids = new Set<number>();
  for (const fornecedor of relacao.fornecedores) {
    for (const pedido of fornecedor.pedidos) {
      for (const material of pedido.materiais) ids.add(material.idDocumento);
    }
  }
  return ids.size;
}

function montarPdf(relacao: ImpressaoPreEntrada): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margem = 12;
  const agora = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text('Relação de pré-entradas', margem, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(subtitulo(relacao, contarDocumentos(relacao)), margem, 20);
  doc.text(`Impresso em ${agora}`, margem, 25);
  doc.setTextColor(0);

  let y = 30;
  const altura = doc.internal.pageSize.getHeight();
  const largura = doc.internal.pageSize.getWidth();
  const linhaMaterial = (item: MaterialImpressaoPreEntrada) => [
    item.numeroDocumento,
    item.numeroNfe?.trim() || '—',
    fmtDataBr(item.dataEntrada),
    item.dataEntrega ? fmtDataBr(item.dataEntrega) : '—',
    item.codigo?.trim() || '—',
    textoMaterial(item),
    fmtQtde(item.qtde),
    item.unidade?.trim() || '—',
  ];

  for (const fornecedor of relacao.fornecedores) {
    if (y > altura - 36) {
      doc.addPage();
      y = 14;
    }
    const corpo = fornecedor.pedidos.flatMap((pedido) => {
      const semPedido = pedido.idPedido <= 0;
      return [
        [
          {
            content: pedido.nome,
            colSpan: 8,
            styles: {
              halign: 'left' as const,
              fillColor: semPedido ? CINZA : OURO,
              textColor: semPedido ? APAGADO : TINTA,
              fontStyle: 'bold' as const,
              fontSize: 8,
            },
          },
        ],
        ...pedido.materiais.map(linhaMaterial),
      ];
    });
    autoTable(doc, {
      startY: y,
      margin: { left: margem, right: margem, bottom: 12 },
      head: [
        [
          {
            content: fornecedor.nome,
            colSpan: 8,
            styles: { halign: 'left', fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 10 },
          },
        ],
        ['Documento', 'NF-e', 'Entrada', 'Entrega do pedido', 'Código', 'Material', 'Qtde', 'Un'],
      ],
      body: corpo,
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.6, textColor: TINTA, overflow: 'linebreak' },
      headStyles: { fillColor: GELO, textColor: NAVY, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 28, fontStyle: 'bold' },
        1: { cellWidth: 20 },
        2: { cellWidth: 22 },
        3: { cellWidth: 28 },
        4: { cellWidth: 24 },
        5: { cellWidth: 'auto' },
        6: { cellWidth: 18, halign: 'right' },
        7: { cellWidth: 26 },
      },
      showHead: 'everyPage',
    });
    const fim = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
    y = fim + 6;
  }

  const total = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina += 1) {
    doc.setPage(pagina);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`${pagina} / ${total}`, largura - margem, altura - 6, { align: 'right' });
  }
  return doc;
}

/** Abre o PDF para impressão. Se o navegador bloquear a janela, baixa o arquivo. */
export async function imprimirRelacaoPreEntradas(
  relacao: ImpressaoPreEntrada,
): Promise<'aberto' | 'baixado'> {
  if (relacao.fornecedores.length === 0) {
    throw new Error('Não há pré-entradas para imprimir.');
  }
  const doc = montarPdf(relacao);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const janela = window.open(url, '_blank', 'noopener,noreferrer');
  if (!janela) {
    doc.save('relacao-pre-entradas.pdf');
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
