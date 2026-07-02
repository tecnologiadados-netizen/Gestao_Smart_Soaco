import { jsPDF } from 'jspdf';
import { bezierPath, computeLayout } from '../components/mind-map/layout';
import type { LayoutResult, MindMapNode, SavedMap } from '../components/mind-map/types';
import { EDGE_COLOR, MIN_NODE_H, MIN_NODE_W, OBS_EDGE_COLOR } from '../components/mind-map/types';

export interface ExportMindMapPdfOptions {
  map: Pick<SavedMap, 'name' | 'mapDescription' | 'root'>;
  logoBase64?: string | null;
}

function drawDiagram(doc: jsPDF, layout: LayoutResult, area: { x: number; y: number; w: number; h: number }) {
  const scale = Math.min(area.w / layout.width, area.h / layout.height, 1);
  const offX = area.x + (area.w - layout.width * scale) / 2;
  const offY = area.y + (area.h - layout.height * scale) / 2;

  const drawBezier = (x1: number, y1: number, x2: number, y2: number, dashed: boolean) => {
    if (dashed) {
      doc.setLineDashPattern([2, 1.5], 0);
    } else {
      doc.setLineDashPattern([], 0);
    }
    const steps = 24;
    let px = x1;
    let py = y1;
    const mx = (x1 + x2) / 2;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = (1 - t) ** 3 * x1 + 3 * (1 - t) ** 2 * t * mx + 3 * (1 - t) * t ** 2 * mx + t ** 3 * x2;
      const y = (1 - t) ** 3 * y1 + 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3 * y2;
      doc.line(px, py, x, y);
      px = x;
      py = y;
    }
    doc.setLineDashPattern([], 0);
  };

  doc.setDrawColor(EDGE_COLOR);
  doc.setLineWidth(0.4);
  for (const e of layout.edges) {
    drawBezier(
      offX + e.x1 * scale,
      offY + e.y1 * scale,
      offX + e.x2 * scale,
      offY + e.y2 * scale,
      false
    );
  }

  doc.setDrawColor(OBS_EDGE_COLOR);
  doc.setLineWidth(0.35);
  for (const e of layout.noteEdges) {
    drawBezier(
      offX + e.x1 * scale,
      offY + e.y1 * scale,
      offX + e.x2 * scale,
      offY + e.y2 * scale,
      true
    );
  }

  for (const ln of layout.nodes) {
    const x = offX + ln.x * scale;
    const y = offY + ln.y * scale;
    const w = Math.max(MIN_NODE_W, ln.width) * scale;
    const h = Math.max(MIN_NODE_H, ln.height) * scale;
    const border = ln.node.color || '#1a1d24';
    doc.setDrawColor(border);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');
    doc.setTextColor(0, 0, 0);
    const fontSize = Math.max(6, ln.node.fontSize * scale * 0.55);
    doc.setFontSize(fontSize);
    const family = ln.node.fontFamily?.split(',')[0]?.trim() || 'helvetica';
    doc.setFont(family.toLowerCase().includes('mono') ? 'courier' : 'helvetica', 'normal');
    const lines = ln.node.text.split('\n');
    const lineH = fontSize * 0.38;
    const textBlockH = lines.length * lineH;
    let ty = y + (h - textBlockH) / 2 + lineH * 0.85;
    const pad = 2 * scale;
    for (const line of lines) {
      doc.text(line, x + pad, ty, { maxWidth: w - pad * 2 });
      ty += lineH;
    }
  }

  for (const obs of layout.observations) {
    const x = offX + obs.x * scale;
    const y = offY + obs.y * scale;
    const w = obs.width * scale;
    const h = obs.height * scale;
    doc.setDrawColor(OBS_EDGE_COLOR);
    doc.setFillColor(255, 251, 235);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, w, h, 1.2, 1.2, 'FD');
    doc.setFontSize(Math.max(5.5, 7 * scale));
    doc.setTextColor(51, 65, 85);
    const obsLines = obs.text.split('\n');
    let oty = y + 4 * scale;
    for (const line of obsLines) {
      doc.text(line, x + 2 * scale, oty, { maxWidth: w - 4 * scale });
      oty += 3.5 * scale;
    }
  }
}

export function exportMindMapPdf({ map, logoBase64 }: ExportMindMapPdfOptions): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const titleX = logoBase64 ? 46 : 14;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 14, 8, 28, 10);
    } catch {
      /* ignora */
    }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 40);
  doc.text(map.name || 'Mapa mental', titleX, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 100);
  const desc = (map.mapDescription || '').trim();
  if (desc) {
    const descLines = doc.splitTextToSize(desc, pageW - titleX - 14);
    doc.text(descLines, titleX, 20);
  }

  const layout = computeLayout(map.root as MindMapNode);
  drawDiagram(doc, layout, { x: 10, y: 28, w: pageW - 20, h: pageH - 36 });

  const safeName = (map.name || 'mapa').replace(/[^\w\-]+/g, '_').slice(0, 60);
  doc.save(`${safeName}.pdf`);
}
