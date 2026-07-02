/** Balão de observação sobre o nó (linha tracejada; não é ramificação do fluxo). */
export interface MindMapObservation {
  text: string;
  offsetX?: number;
  offsetY?: number;
  width?: number;
  height?: number;
}

export interface MindMapNode {
  id: string;
  text: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  collapsed: boolean;
  width?: number;
  height?: number;
  userSized?: boolean;
  offsetX?: number;
  offsetY?: number;
  /** Comentário visual ligado a este nó (ex.: observação sobre um filho da decisão). */
  observation?: MindMapObservation;
  children: MindMapNode[];
}

export interface SavedMap {
  id: string;
  name: string;
  mapDescription?: string;
  root: MindMapNode;
  pan: { x: number; y: number };
  zoom: number;
  updatedAt: string;
}

export interface MindMapListItem {
  id: string;
  name: string;
  mapDescription?: string;
  criadoPorLogin: string;
  criadoPorNome?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  node: MindMapNode;
  depth: number;
}

export interface LayoutEdge {
  fromId: string;
  toId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LayoutObservation {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

export interface LayoutNoteEdge {
  nodeId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  observations: LayoutObservation[];
  noteEdges: LayoutNoteEdge[];
  width: number;
  height: number;
}

export const OBS_EDGE_COLOR = '#94a3b8';
export const MIN_OBS_W = 96;
export const MIN_OBS_H = 36;
export const DEFAULT_OBS_OFFSET_Y = 18;

export const DEFAULT_BORDER_COLOR = '#1a1d24';
export const EDGE_COLOR = '#6b72d4';
export const H_GAP = 28;
export const V_GAP = 10;
export const MIN_NODE_W = 120;
export const MIN_NODE_H = 44;
export const DEFAULT_FONT_SIZE = 14;

export const PALETTE_COLORS = [
  '#041E42',
  '#1E22AA',
  '#FFAD00',
  '#808080',
  '#2E2D2C',
  '#059669',
  '#dc2626',
  '#FFFFFF',
] as const;

export const FONT_FAMILIES = [
  'Inter, system-ui, sans-serif',
  'Arial, Helvetica, sans-serif',
  'Georgia, serif',
  'Consolas, monospace',
] as const;
