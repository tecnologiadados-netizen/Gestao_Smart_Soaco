import type { MindMapNode } from './types';
import { DEFAULT_BORDER_COLOR, DEFAULT_FONT_SIZE, FONT_FAMILIES } from './types';

let idCounter = 0;

export function newNodeId(): string {
  idCounter += 1;
  return `n-${Date.now()}-${idCounter}`;
}

export function createEmptyNode(text: string, partial?: Partial<MindMapNode>): MindMapNode {
  return {
    id: newNodeId(),
    text,
    color: DEFAULT_BORDER_COLOR,
    fontSize: DEFAULT_FONT_SIZE,
    fontFamily: FONT_FAMILIES[0],
    collapsed: false,
    children: [],
    ...partial,
  };
}

/** Demo inicial: raiz + Tópico 1/2/3 */
export function createDemoRoot(): MindMapNode {
  return {
    id: newNodeId(),
    text: 'Novo mapa',
    color: DEFAULT_BORDER_COLOR,
    fontSize: DEFAULT_FONT_SIZE,
    fontFamily: FONT_FAMILIES[0],
    collapsed: false,
    children: [
      createEmptyNode('Tópico 1'),
      createEmptyNode('Tópico 2'),
      createEmptyNode('Tópico 3'),
    ],
  };
}

export function cloneNode(node: MindMapNode): MindMapNode {
  return {
    ...node,
    children: node.children.map(cloneNode),
  };
}

export function cloneRoot(root: MindMapNode): MindMapNode {
  return cloneNode(root);
}
