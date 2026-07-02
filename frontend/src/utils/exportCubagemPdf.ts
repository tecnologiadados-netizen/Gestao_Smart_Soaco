import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ItemSimulacaoPayload, Layout2D, ResultadoSimulacaoCubagem, Veiculo } from '../api/logistica';

export type ItemCargaPdf = ItemSimulacaoPayload & {
  codigo: string;
  descricao: string;
};

function fmtMm(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n.toLocaleString('pt-BR')} mm`;
}

function fmtBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtM3(mm3: number): string {
  return `${(mm3 / 1e9).toFixed(2)} m³`;
}

function desenharLayout(
  doc: jsPDF,
  layout: Layout2D['superior'],
  titulo: string,
  area: { x: number; y: number; w: number; h: number }
) {
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(titulo, area.x, area.y - 2);

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.rect(area.x, area.y, area.w, area.h);

  for (const r of layout) {
    const rx = area.x + r.x * area.w;
    const ry = area.y + r.y * area.h;
    const rw = r.w * area.w;
    const rh = r.h * area.h;

    if (r.overflow) {
      doc.setFillColor(254, 202, 202);
      doc.setDrawColor(220, 38, 38);
    } else {
      const hex = r.cor.replace('#', '');
      const rr = parseInt(hex.slice(0, 2), 16);
      const gg = parseInt(hex.slice(2, 4), 16);
      const bb = parseInt(hex.slice(4, 6), 16);
      doc.setFillColor(rr, gg, bb);
      doc.setDrawColor(Math.max(0, rr - 30), Math.max(0, gg - 30), Math.max(0, bb - 30));
    }
    doc.setLineWidth(0.2);
    doc.roundedRect(rx, ry, rw, rh, 0.5, 0.5, 'FD');

    if (rw > 8 && rh > 4) {
      doc.setFontSize(5);
      doc.setTextColor(30, 30, 30);
      const label = r.codigoProduto.length > 12 ? r.codigoProduto.slice(0, 10) + '…' : r.codigoProduto;
      doc.text(label, rx + rw / 2, ry + rh / 2, { align: 'center', baseline: 'middle' });
    }
  }
}

function nomeArquivo(placa: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `plano-carga-${placa}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.pdf`;
}

export function exportCubagemPdf(
  veiculo: Veiculo,
  itens: ItemCargaPdf[],
  resultado: ResultadoSimulacaoCubagem
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text('Plano de Carga — Cubagem', margin, 14);

  y = 30;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.text(`Veículo: ${veiculo.placa}${veiculo.modelo ? ` — ${veiculo.modelo}` : ''}`, margin, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `Dimensões úteis: ${fmtMm(veiculo.alturaMm)} × ${fmtMm(veiculo.larguraMm)} × ${fmtMm(veiculo.profundidadeMm)}`,
    margin,
    y
  );
  y += 4;
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, y);
  y += 8;

  const ind = resultado.indicadores;
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text('Resumo de ocupação', margin, y);
  y += 5;

  const resumoRows = [
    ['Ocupação volumétrica', `${ind.pctVolume.toFixed(1)}%`, fmtM3(ind.volumeTotalMm3)],
    ['Capacidade volumétrica', '—', fmtM3(ind.capacidadeVolumeMm3)],
    [
      'Ocupação de peso',
      ind.pesoDisponivel ? `${ind.pctPeso?.toFixed(1)}%` : 'Não cadastrado',
      ind.pesoTotalKg != null ? `${ind.pesoTotalKg.toFixed(1)} kg` : '—',
    ],
    ['Volumes / Itens', `${ind.numVolumes}`, `${ind.numItens} item(ns)`],
    ['Valor total', fmtBrl(ind.valorTotal), ind.limitante ? `Limitante: ${ind.limitante}` : ''],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Indicador', 'Percentual', 'Valor']],
    body: resumoRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 58, 95] },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (resultado.excessos.volume || resultado.excessos.peso) {
    doc.setTextColor(185, 28, 28);
    doc.setFontSize(9);
    const msgs = [];
    if (resultado.excessos.volume) msgs.push('Volume excedido');
    if (resultado.excessos.peso) msgs.push('Peso excedido');
    doc.text(`ALERTA: ${msgs.join(' · ')}`, margin, y);
    y += 6;
    doc.setTextColor(30, 30, 30);
  }

  if (resultado.layout2D.superior.length > 0) {
    const halfW = (pageW - margin * 2 - 4) / 2;
    desenharLayout(doc, resultado.layout2D.superior, 'Vista superior', {
      x: margin,
      y: y + 4,
      w: halfW,
      h: 40,
    });
    desenharLayout(doc, resultado.layout2D.lateral, 'Vista lateral', {
      x: margin + halfW + 4,
      y: y + 4,
      w: halfW,
      h: 40,
    });
    y += 52;
  }

  const ordenados = [...itens].sort((a, b) => (a.sequencia ?? 999) - (b.sequencia ?? 999));
  const body = ordenados.map((item, idx) => [
    String(item.sequencia ?? idx + 1),
    item.codigo,
    item.descricao.length > 40 ? item.descricao.slice(0, 38) + '…' : item.descricao,
    String(item.quantidade),
    item.pd ?? '—',
  ]);

  doc.setFontSize(10);
  doc.text('Sequência de carregamento', margin, y);
  y += 2;

  autoTable(doc, {
    startY: y + 3,
    head: [['Seq.', 'Código', 'Descrição', 'Qtde', 'PD']],
    body,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7 },
    headStyles: { fillColor: [30, 58, 95] },
  });

  doc.save(nomeArquivo(veiculo.placa));
}
