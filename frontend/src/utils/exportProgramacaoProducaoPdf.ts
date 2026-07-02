import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { LinhaProgramacaoProducao, ProgramacaoProducaoRecurso } from '../components/programacao-producao/types';
import { formatNum } from '../components/programacao-producao/programacaoProducaoCalculos';
import { ordenarLinhasParaPdf } from './programacaoProducaoValidacoes';
import { migrarQtdeProduzirLegado, textoRoteiroComQtdePdf } from './programacaoProducaoRoteiros';
import { getCatalogoRecursosRuntime, patchCatalogoRecursosRuntime } from './programacaoProducaoCatalogoRuntime';
import { listProgramacaoProducaoRecursos } from '../api/programacaoProducao';

export type DownloadProgramacaoProducaoPdfOpts = {
  codigoProgramacao: string;
  dataCriacao: string;
  responsavel: string;
  linhas: LinhaProgramacaoProducao[];
  logoBase64?: string | null;
  recursos?: ProgramacaoProducaoRecurso[];
};

type CellDef = string | { content: string; rowSpan?: number };

function formatDataBr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Uma ou mais linhas no PDF; colunas comuns mescladas quando há vários roteiros. */
function corpoTabelaPdf(
  linhas: LinhaProgramacaoProducao[],
  recursos: ProgramacaoProducaoRecurso[]
): CellDef[][] {
  const body: CellDef[][] = [];
  const linhasPdf = ordenarLinhasParaPdf(linhas);

  for (const l of linhasPdf) {
    const qp = migrarQtdeProduzirLegado(l.qtde_produzir);
    const qtyLinhas: string[] = qp.roteiros
      .filter((r) => r.sequencia.length > 0 && r.qtde > 0)
      .map((r) => textoRoteiroComQtdePdf(r, recursos, formatNum));
    if (qtyLinhas.length === 0) qtyLinhas.push('—');

    const n = qtyLinhas.length;
    const seq = String(l.sequencia);
    const cod = l.cod_componente ?? '—';
    const desc = l.descricao_simplificada?.trim() || '—';
    const codMp = l.cod_bobina?.trim() || '—';
    const descMp = l.descricao_bobina?.trim() || '—';

    body.push([
      { content: seq, rowSpan: n },
      { content: cod, rowSpan: n },
      { content: desc, rowSpan: n },
      qtyLinhas[0]!,
      { content: codMp, rowSpan: n },
      { content: descMp, rowSpan: n },
    ]);
    for (let i = 1; i < n; i++) {
      body.push([qtyLinhas[i]!]);
    }
  }

  return body;
}

function nomeArquivoPdf(codigoProgramacao: string): string {
  const safeName = codigoProgramacao.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'programacao';
  return `${safeName}.pdf`;
}

async function resolverRecursosPdf(
  recursos?: ProgramacaoProducaoRecurso[]
): Promise<ProgramacaoProducaoRecurso[]> {
  if (recursos?.length) return recursos;
  const cached = getCatalogoRecursosRuntime();
  if (cached?.length) return cached;
  const lista = await listProgramacaoProducaoRecursos();
  patchCatalogoRecursosRuntime(lista);
  return lista;
}

/** Monta o documento PDF (somente linhas com sequência na tabela). */
export async function buildProgramacaoProducaoPdfDoc(
  opts: DownloadProgramacaoProducaoPdfOpts
): Promise<jsPDF> {
  const { codigoProgramacao, dataCriacao, responsavel, linhas, logoBase64 } = opts;
  const recursos = await resolverRecursosPdf(opts.recursos);

  const body = corpoTabelaPdf(linhas, recursos);
  if (body.length === 0) {
    throw new Error('Não há linhas com sequência definida para gerar o PDF.');
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 10;
  const tableW = pageW - margin * 2;
  const colWidthFr = [0.06, 0.09, 0.2, 0.28, 0.09, 0.28] as const;
  let y = 14;

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin, 8, 42, 14);
    } catch {
      /* ignora logo inválida */
    }
  }

  const textX = logoBase64 ? margin + 46 : margin;
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text('Programação de produção', textX, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(`Código: ${codigoProgramacao}`, textX, y);
  y += 5;
  doc.text(`Data: ${formatDataBr(dataCriacao)}`, textX, y);
  y += 5;
  doc.text(`Responsável: ${responsavel}`, textX, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: tableW,
    head: [['Sequência', 'Código', 'Desc Simpl', 'Qtde Produzir (roteiros)', 'Cód MP', 'Descrição MP']],
    body,
    styles: {
      fontSize: 7,
      cellPadding: 1.2,
      overflow: 'linebreak',
      valign: 'top',
      lineColor: [180, 180, 180],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [72, 72, 72],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
      lineColor: [50, 50, 50],
      lineWidth: 0.2,
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    columnStyles: Object.fromEntries(
      colWidthFr.map((fr, i) => [
        i,
        {
          cellWidth: tableW * fr,
          halign: i === 0 ? ('right' as const) : ('left' as const),
        },
      ])
    ),
  });

  return doc;
}

export async function gerarProgramacaoProducaoPdfBlob(
  opts: DownloadProgramacaoProducaoPdfOpts
): Promise<{ blob: Blob; filename: string }> {
  const doc = await buildProgramacaoProducaoPdfDoc(opts);
  const filename = nomeArquivoPdf(opts.codigoProgramacao);
  const blob = doc.output('blob');
  return { blob, filename };
}

/** PDF da programação concluída: cabeçalho + grade (somente linhas com sequência). */
export async function downloadProgramacaoProducaoPdf(
  opts: DownloadProgramacaoProducaoPdfOpts
): Promise<void> {
  const { blob, filename } = await gerarProgramacaoProducaoPdfBlob(opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
