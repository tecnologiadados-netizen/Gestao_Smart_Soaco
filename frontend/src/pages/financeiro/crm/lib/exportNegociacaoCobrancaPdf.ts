import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TarefaInadimplente } from '../../../../api/crmFinanceiro';
import { imageUrlToDataUrl } from '../../../../utils/imageDataUrl';
import {
  calcularJurosMora,
  moneyBr,
  moneyBrAte4,
  rotuloForma,
  rotuloPeriodicidade,
  type MetaNegociacaoCobranca,
} from './negociacaoCobranca';

const LOGO_URL = '/logo-soaco-email.png';

const PDF = {
  primary: [30, 34, 170] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  line: [148, 163, 184] as [number, number, number],
  fill: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
} as const;

const MARGIN = { left: 14, right: 14, top: 14, bottom: 16 };

function formatYmd(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd.slice(0, 10));
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return ymd;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatYmd(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .toLowerCase() || 'negociacao'
  );
}

function finalY(doc: jsPDF, fallback: number): number {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
}

const ESTILO_GRADE = {
  theme: 'grid' as const,
  styles: {
    font: 'helvetica' as const,
    fontSize: 8,
    cellPadding: 2,
    valign: 'middle' as const,
    textColor: PDF.text,
    lineColor: PDF.primary,
    lineWidth: 0.25,
    overflow: 'linebreak' as const,
  },
  headStyles: {
    fillColor: PDF.primary,
    textColor: PDF.white,
    fontStyle: 'bold' as const,
    fontSize: 8.5,
    halign: 'left' as const,
  },
  margin: { left: MARGIN.left, right: MARGIN.right },
};

function tabelaSecao(
  doc: jsPDF,
  startY: number,
  titulo: string,
  pares: [string, string][],
  nota?: string,
): number {
  const body: string[][] = [];
  if (nota) body.push([nota, '', '', '']);
  for (let i = 0; i < pares.length; i += 2) {
    const a = pares[i]!;
    const b = pares[i + 1];
    body.push([a[0], a[1], b?.[0] ?? '', b?.[1] ?? '']);
  }
  autoTable(doc, {
    startY,
    ...ESTILO_GRADE,
    head: [[titulo, '', '', '']],
    body,
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold', fillColor: [226, 232, 240], textColor: PDF.primary },
      1: { cellWidth: 45 },
      2: { cellWidth: 42, fontStyle: 'bold', fillColor: [226, 232, 240], textColor: PDF.primary },
      3: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index === 0) {
        data.cell.colSpan = 4;
      }
      if (data.section === 'body' && nota && data.row.index === 0 && data.column.index === 0) {
        data.cell.colSpan = 4;
        data.cell.styles.fontStyle = 'italic';
        data.cell.styles.fontSize = 7;
        data.cell.styles.textColor = PDF.muted;
        data.cell.styles.fillColor = PDF.fill;
      }
    },
  });
  return finalY(doc, startY) + 4;
}

export async function downloadNegociacaoCobrancaPdf(input: {
  tarefa: TarefaInadimplente;
  meta: MetaNegociacaoCobranca;
  dataContato?: string | null;
}): Promise<void> {
  const { tarefa, meta } = input;
  const calc = calcularJurosMora(
    meta.valorOriginal || tarefa.valor,
    meta.percentualJuros,
    meta.diasAtraso || tarefa.diasAtraso,
  );
  const emitidoEm = new Date();
  const logoBase64 = await imageUrlToDataUrl(LOGO_URL);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN.left - MARGIN.right;

  let y = MARGIN.top;
  const logoW = 48;
  const logoH = 15;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', MARGIN.left, y, logoW, logoH);
    } catch {
      /* ignora */
    }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...PDF.primary);
  doc.text('Comprovante de negociação', pageW - MARGIN.right, y + 9, { align: 'right' });
  y += logoH + 6;

  y = tabelaSecao(doc, y, 'Dados do cliente e do título', [
    ['Cliente', tarefa.clienteNome],
    ['Empresa', tarefa.empresaNome?.trim() || '—'],
    ['Conta', `${tarefa.codigoConta} (${tarefa.origem.toUpperCase()})`],
    ['NF / PD', tarefa.nfPd?.trim() || '—'],
    ['Vencimento original', formatYmd(tarefa.vencimento)],
    ['Dias em atraso', calc.diasAtraso.toLocaleString('pt-BR')],
  ]);

  y = tabelaSecao(
    doc,
    y,
    'Memorial da calculadora de juros',
    [
      ['Valor do título (principal)', moneyBr(meta.valorOriginal)],
      ['Juros % ao mês', `${calc.percentualJuros.toLocaleString('pt-BR')}%`],
      ['Juros por dia', moneyBrAte4(calc.jurosPorDia)],
      ['Dias em atraso', calc.diasAtraso.toLocaleString('pt-BR')],
    ],
    `Regra: juros = principal × (taxa mensal ÷ 30) × dias em atraso. Taxa informada: ${calc.percentualJuros.toLocaleString('pt-BR')}% ao mês.`,
  );

  autoTable(doc, {
    startY: y,
    ...ESTILO_GRADE,
    head: [['Resumo dos valores', '', '']],
    body: [
      ['Principal', 'Juros', 'Novo valor negociado'],
      [
        moneyBr(meta.valorOriginal),
        moneyBr(meta.valorJuros ?? calc.valorJuros),
        moneyBr(meta.valorNegociado),
      ],
    ],
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index === 0) data.cell.colSpan = 3;
      if (data.section === 'body' && data.row.index === 0) {
        data.cell.styles.fillColor = PDF.primary;
        data.cell.styles.textColor = PDF.white;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.halign = 'center';
      }
      if (data.section === 'body' && data.row.index === 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 10;
        data.cell.styles.textColor = PDF.primary;
        data.cell.styles.halign = 'center';
      }
    },
  });
  y = finalY(doc, y) + 4;

  y = tabelaSecao(doc, y, 'Condições e prazos do acordo', [
    [
      'Data do contato',
      formatYmd(input.dataContato) === '—'
        ? formatDateTime(input.dataContato)
        : formatYmd(input.dataContato),
    ],
    [
      'Entrada à vista',
      meta.entrada.valor > 0.009
        ? `${moneyBr(meta.entrada.valor)} via ${rotuloForma(meta.entrada.forma)}`
        : 'Sem entrada',
    ],
    ['Restante', moneyBr(meta.restante.valor)],
    ['Periodicidade', rotuloPeriodicidade(meta.restante.periodicidade)],
    ['Quantidade de parcelas', String(meta.restante.quantidadeParcelas || 0)],
    ['Forma do restante', rotuloForma(meta.restante.forma)],
    ['1ª parcela do restante', formatYmd(meta.restante.dataPrimeiraParcela)],
  ]);

  autoTable(doc, {
    startY: y,
    ...ESTILO_GRADE,
    head: [['#', 'Tipo', 'Data', 'Forma', 'Valor']],
    body:
      meta.parcelas?.length
        ? meta.parcelas.map((p) => [
            String(p.n),
            p.tipo === 'entrada' ? 'Entrada' : 'Parcela',
            formatYmd(p.data),
            rotuloForma(p.forma),
            moneyBr(p.valor),
          ])
        : [['—', '—', '—', '—', '—']],
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      4: { halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: PDF.fill },
  });
  y = finalY(doc, y) + 6;

  if (meta.observacao?.trim()) {
    if (y > pageH - 50) {
      doc.addPage();
      y = MARGIN.top;
    }
    autoTable(doc, {
      startY: y,
      ...ESTILO_GRADE,
      head: [['Observações do acordo']],
      body: [[meta.observacao.trim()]],
    });
    y = finalY(doc, y) + 6;
  }

  if (y > pageH - 58) {
    doc.addPage();
    y = MARGIN.top;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF.muted);
  const aviso = doc.splitTextToSize(
    'Documento gerado para evidenciar as condições negociadas (valores, juros, prazos e formas de pagamento). A efetivação do acordo depende do cumprimento das datas e formas indicadas neste comprovante.',
    contentW,
  );
  doc.text(aviso, MARGIN.left, y);
  y += aviso.length * 3.6 + 14;

  const linhaW = 72;
  const linhaX = (pageW - linhaW) / 2;
  doc.setDrawColor(...PDF.text);
  doc.setLineWidth(0.25);
  doc.line(linhaX, y, linhaX + linhaW, y);
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF.muted);
  doc.text('Diretoria — Só Aço', pageW / 2, y + 4.5, { align: 'center' });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...PDF.muted);
    doc.text(
      `Emitido em ${emitidoEm.toLocaleString('pt-BR')}  ·  Conta ${tarefa.codigoConta}`,
      MARGIN.left,
      pageH - 8,
    );
    doc.text(`Página ${p} de ${pages}`, pageW - MARGIN.right, pageH - 8, { align: 'right' });
  }

  const stamp = emitidoEm.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  doc.save(`negociacao-${slugify(tarefa.clienteNome)}-${tarefa.codigoConta}-${stamp}.pdf`);
}
