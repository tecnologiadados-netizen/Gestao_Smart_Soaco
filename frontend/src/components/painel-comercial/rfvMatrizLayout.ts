/**
 * Layout clássico da matriz RFV (Recência × FV).
 * Grade 5×5: linha visual 1 = FV5 (topo), coluna 1 = R1 (esquerda).
 */
export type RfvCelulaRf = { r: number; fv: number };

export type RfvMatrizSegmentoLayout = {
  id: string;
  label: string;
  cor: string;
  textCor: string;
  celulas: RfvCelulaRf[];
  ordem: number;
};

export const RFV_MATRIZ_LAYOUT: RfvMatrizSegmentoLayout[] = [
  {
    id: 'campeoes',
    label: 'Campeões',
    cor: '#E8886B',
    textCor: '#ffffff',
    celulas: [{ r: 5, fv: 5 }],
    ordem: 1,
  },
  {
    id: 'clientes_fieis',
    label: 'Clientes fiéis',
    cor: '#B5D96C',
    textCor: '#1a1a1a',
    celulas: [
      { r: 3, fv: 5 },
      { r: 4, fv: 5 },
      { r: 3, fv: 4 },
      { r: 4, fv: 4 },
      { r: 5, fv: 4 },
    ],
    ordem: 2,
  },
  {
    id: 'potenciais_fieis',
    label: 'Potenciais fiéis',
    cor: '#9C7B5C',
    textCor: '#ffffff',
    celulas: [
      { r: 4, fv: 3 },
      { r: 5, fv: 3 },
      { r: 4, fv: 2 },
      { r: 5, fv: 2 },
    ],
    ordem: 3,
  },
  {
    id: 'clientes_recentes',
    label: 'Clientes recentes',
    cor: '#4ECDC4',
    textCor: '#1a1a1a',
    celulas: [{ r: 5, fv: 1 }],
    ordem: 4,
  },
  {
    id: 'promissores',
    label: 'Promissores',
    cor: '#C9A0B8',
    textCor: '#1a1a1a',
    celulas: [{ r: 4, fv: 1 }],
    ordem: 5,
  },
  {
    id: 'precisam_atencao',
    label: 'Precisam de atenção',
    cor: '#2A7B8C',
    textCor: '#ffffff',
    celulas: [{ r: 3, fv: 3 }],
    ordem: 6,
  },
  {
    id: 'prestes_hibernar',
    label: 'Prestes a hibernar',
    cor: '#C4B896',
    textCor: '#1a1a1a',
    celulas: [
      { r: 3, fv: 2 },
      { r: 3, fv: 1 },
    ],
    ordem: 7,
  },
  {
    id: 'em_risco',
    label: 'Em risco',
    cor: '#F5D76E',
    textCor: '#1a1a1a',
    celulas: [
      { r: 1, fv: 4 },
      { r: 2, fv: 4 },
      { r: 1, fv: 3 },
      { r: 2, fv: 3 },
    ],
    ordem: 8,
  },
  {
    id: 'nao_posso_perde_los',
    label: 'Não posso perdê-los',
    cor: '#67D4F7',
    textCor: '#1a1a1a',
    celulas: [
      { r: 1, fv: 5 },
      { r: 2, fv: 5 },
    ],
    ordem: 9,
  },
  {
    id: 'hibernando',
    label: 'Hibernando',
    cor: '#4A5568',
    textCor: '#ffffff',
    celulas: [{ r: 2, fv: 2 }],
    ordem: 10,
  },
  {
    id: 'perdidos',
    label: 'Perdidos',
    cor: '#C0392B',
    textCor: '#ffffff',
    celulas: [
      { r: 1, fv: 1 },
      { r: 2, fv: 1 },
      { r: 1, fv: 2 },
    ],
    ordem: 11,
  },
  {
    id: 'outros',
    label: 'Outros',
    cor: '#64748B',
    textCor: '#ffffff',
    celulas: [],
    ordem: 12,
  },
];

const GRID = 5;

function celulaRectPct(c: RfvCelulaRf): { left: number; top: number; right: number; bottom: number } {
  const col = c.r - 1;
  const row = GRID - c.fv;
  const step = 100 / GRID;
  const left = col * step;
  const top = row * step;
  return { left, top, right: left + step, bottom: top + step };
}

type Edge = { x1: number; y1: number; x2: number; y2: number };

function samePt(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
}

/** Contorno em polígono (%) da união de células — suporta formas em L. */
export function clipPathCelulas(celulas: RfvCelulaRf[]): string {
  if (!celulas.length) return 'none';
  const set = new Set(celulas.map((c) => `${c.r}-${c.fv}`));
  const has = (r: number, fv: number) => set.has(`${r}-${fv}`);

  const edges: Edge[] = [];
  for (const c of celulas) {
    const { left, top, right, bottom } = celulaRectPct(c);
    if (!has(c.r, c.fv + 1)) edges.push({ x1: left, y1: top, x2: right, y2: top });
    if (!has(c.r + 1, c.fv)) edges.push({ x1: right, y1: top, x2: right, y2: bottom });
    if (!has(c.r, c.fv - 1)) edges.push({ x1: right, y1: bottom, x2: left, y2: bottom });
    if (!has(c.r - 1, c.fv)) edges.push({ x1: left, y1: bottom, x2: left, y2: top });
  }

  if (!edges.length) {
    const b = bboxCelulas(celulas);
    return `polygon(${b.left}% ${b.top}%, ${b.right}% ${b.top}%, ${b.right}% ${b.bottom}%, ${b.left}% ${b.bottom}%)`;
  }

  const pts: { x: number; y: number }[] = [];
  const used = new Set<number>();
  let cur = edges[0]!;
  pts.push({ x: cur.x1, y: cur.y1 });
  pts.push({ x: cur.x2, y: cur.y2 });
  used.add(0);

  while (used.size < edges.length) {
    const last = pts[pts.length - 1]!;
    const nextIdx = edges.findIndex((e, i) => {
      if (used.has(i)) return false;
      return samePt({ x: e.x1, y: e.y1 }, last) || samePt({ x: e.x2, y: e.y2 }, last);
    });
    if (nextIdx < 0) break;
    const e = edges[nextIdx]!;
    used.add(nextIdx);
    if (samePt({ x: e.x1, y: e.y1 }, last)) pts.push({ x: e.x2, y: e.y2 });
    else pts.push({ x: e.x1, y: e.y1 });
  }

  const fmt = (p: { x: number; y: number }) => `${p.x.toFixed(2)}% ${p.y.toFixed(2)}%`;
  return `polygon(${pts.map(fmt).join(', ')})`;
}

export function bboxCelulas(celulas: RfvCelulaRf[]): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  const rects = celulas.map(celulaRectPct);
  return {
    left: Math.min(...rects.map((r) => r.left)),
    top: Math.min(...rects.map((r) => r.top)),
    right: Math.max(...rects.map((r) => r.right)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  };
}

export function centroCelulas(celulas: RfvCelulaRf[]): { x: number; y: number } {
  if (!celulas.length) return { x: 50, y: 50 };
  let sx = 0;
  let sy = 0;
  for (const c of celulas) {
    const { left, top, right, bottom } = celulaRectPct(c);
    sx += (left + right) / 2;
    sy += (top + bottom) / 2;
  }
  return { x: sx / celulas.length, y: sy / celulas.length };
}

export const RFV_SEGMENTO_POR_CELULA: Record<string, string> = Object.fromEntries(
  RFV_MATRIZ_LAYOUT.flatMap((seg) => seg.celulas.map((c) => [`${c.r}-${c.fv}`, seg.id]))
);

export function layoutSegmento(id: string): RfvMatrizSegmentoLayout | undefined {
  return RFV_MATRIZ_LAYOUT.find((s) => s.id === id);
}
