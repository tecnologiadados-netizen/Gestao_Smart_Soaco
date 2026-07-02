import type {
  LayoutEdge,
  LayoutNode,
  LayoutNoteEdge,
  LayoutObservation,
  LayoutResult,
  MindMapNode,
} from './types';
import {
  DEFAULT_OBS_OFFSET_Y,
  H_GAP,
  MIN_NODE_H,
  MIN_NODE_W,
  MIN_OBS_H,
  MIN_OBS_W,
  V_GAP,
} from './types';

export function measureText(
  text: string,
  fontSize: number,
  fontFamily: string,
  maxWidth: number
): { width: number; height: number } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { width: Math.max(MIN_NODE_W, maxWidth), height: MIN_NODE_H };
  }
  ctx.font = `${fontSize}px ${fontFamily.split(',')[0]?.trim() || 'Inter'}`;
  const lines = text.split('\n');
  const lineHeight = fontSize * 1.35;
  const padX = 12;
  const padY = 10;
  let maxLineW = 0;
  for (const line of lines) {
    const w = ctx.measureText(line || ' ').width;
    if (w > maxLineW) maxLineW = w;
  }
  const contentW = Math.min(Math.max(maxLineW + padX * 2, MIN_NODE_W), maxWidth || 320);
  const contentH = Math.max(lines.length * lineHeight + padY * 2, MIN_NODE_H);
  return { width: contentW, height: contentH };
}

function nodeSize(node: MindMapNode): { width: number; height: number } {
  if (node.userSized && node.width && node.height) {
    return {
      width: Math.max(MIN_NODE_W, node.width),
      height: Math.max(MIN_NODE_H, node.height),
    };
  }
  const m = measureText(node.text, node.fontSize, node.fontFamily, 280);
  return { width: m.width, height: m.height };
}

interface SubtreeSize {
  width: number;
  height: number;
}

function measureSubtree(node: MindMapNode): SubtreeSize {
  const self = nodeSize(node);
  if (node.collapsed || node.children.length === 0) {
    return { width: self.width, height: self.height };
  }
  let totalH = 0;
  let maxChildW = 0;
  for (let i = 0; i < node.children.length; i++) {
    const ch = measureSubtree(node.children[i]!);
    totalH += ch.height;
    if (i > 0) totalH += V_GAP;
    if (ch.width > maxChildW) maxChildW = ch.width;
  }
  return {
    width: self.width + H_GAP + maxChildW,
    height: Math.max(self.height, totalH),
  };
}

interface Positioned {
  node: MindMapNode;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
}

function layoutRecursive(
  node: MindMapNode,
  x: number,
  y: number,
  depth: number,
  out: Positioned[]
): number {
  const self = nodeSize(node);
  const ox = node.offsetX ?? 0;
  const oy = node.offsetY ?? 0;
  const nx = x + ox;
  const ny = y + oy;

  out.push({
    node,
    x: nx,
    y: ny,
    width: self.width,
    height: self.height,
    depth,
  });

  if (node.collapsed || node.children.length === 0) {
    return self.height;
  }

  const childX = nx + self.width + H_GAP;
  const sizes = node.children.map((c) => measureSubtree(c));
  const totalChildH = sizes.reduce((s, m) => s + m.height, 0) + V_GAP * (node.children.length - 1);
  let childY = ny + self.height / 2 - totalChildH / 2;

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    const subH = sizes[i]!.height;
    layoutRecursive(child, childX, childY + subH / 2 - nodeSize(child).height / 2, depth + 1, out);
    childY += subH + V_GAP;
  }

  return Math.max(self.height, totalChildH);
}

export function measureObservation(text: string): { width: number; height: number } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { width: MIN_OBS_W, height: MIN_OBS_H };
  ctx.font = '12px Inter, system-ui, sans-serif';
  const lines = text.split('\n');
  const lineHeight = 14;
  const padX = 10;
  const padY = 8;
  let maxLineW = 0;
  for (const line of lines) {
    const w = ctx.measureText(line || ' ').width;
    if (w > maxLineW) maxLineW = w;
  }
  return {
    width: Math.min(Math.max(maxLineW + padX * 2, MIN_OBS_W), 220),
    height: Math.max(lines.length * lineHeight + padY * 2, MIN_OBS_H),
  };
}

function buildObservations(nodes: LayoutNode[]): {
  observations: LayoutObservation[];
  noteEdges: LayoutNoteEdge[];
} {
  const observations: LayoutObservation[] = [];
  const noteEdges: LayoutNoteEdge[] = [];
  for (const ln of nodes) {
    const obs = ln.node.observation;
    if (!obs?.text?.trim()) continue;
    const size =
      obs.width && obs.height
        ? { width: Math.max(MIN_OBS_W, obs.width), height: Math.max(MIN_OBS_H, obs.height) }
        : measureObservation(obs.text);
    const ox = obs.offsetX ?? 4;
    const oy = obs.offsetY ?? ln.height + DEFAULT_OBS_OFFSET_Y;
    const bx = ln.x + ox;
    const by = ln.y + oy;
    observations.push({
      nodeId: ln.id,
      x: bx,
      y: by,
      width: size.width,
      height: size.height,
      text: obs.text,
    });
    noteEdges.push({
      nodeId: ln.id,
      x1: ln.x + ln.width / 2,
      y1: ln.y + ln.height,
      x2: bx + size.width / 2,
      y2: by,
    });
  }
  return { observations, noteEdges };
}

/** Arestas entre posições reais dos cards (inclui offset manual de cada nó). */
function buildEdgesFromTree(
  node: MindMapNode,
  byId: Map<string, { x: number; y: number; width: number; height: number }>,
  edges: LayoutEdge[]
): void {
  if (node.collapsed || node.children.length === 0) return;
  const parent = byId.get(node.id);
  if (!parent) return;
  for (const child of node.children) {
    const c = byId.get(child.id);
    if (c) {
      edges.push({
        fromId: node.id,
        toId: child.id,
        x1: parent.x + parent.width,
        y1: parent.y + parent.height / 2,
        x2: c.x,
        y2: c.y + c.height / 2,
      });
    }
    buildEdgesFromTree(child, byId, edges);
  }
}

/** Layout horizontal esquerda→direita; pai centrado nos filhos. */
export function computeLayout(root: MindMapNode): LayoutResult {
  const positioned: Positioned[] = [];
  layoutRecursive(root, 0, 0, 0, positioned);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of positioned) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + p.width);
    maxY = Math.max(maxY, p.y + p.height);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = MIN_NODE_W;
    maxY = MIN_NODE_H;
  }

  const pad = 40;
  const offsetX = pad - minX;
  const offsetY = pad - minY;

  const nodes: LayoutNode[] = positioned.map((p) => ({
    id: p.node.id,
    x: p.x + offsetX,
    y: p.y + offsetY,
    width: p.width,
    height: p.height,
    node: p.node,
    depth: p.depth,
  }));

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: LayoutEdge[] = [];
  buildEdgesFromTree(root, byId, edges);

  const { observations, noteEdges } = buildObservations(nodes);
  for (const o of observations) {
    maxX = Math.max(maxX, o.x + o.width);
    maxY = Math.max(maxY, o.y + o.height);
  }

  return {
    nodes,
    edges,
    observations,
    noteEdges,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

/** Curva Bézier horizontal entre dois pontos. */
export function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}
