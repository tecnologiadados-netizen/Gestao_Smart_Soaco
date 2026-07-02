import type { MindMapNode, MindMapObservation } from './types';
import { createEmptyNode } from './defaults';

export function findNode(root: MindMapNode, id: string): MindMapNode | null {
  if (root.id === id) return root;
  for (const ch of root.children) {
    const f = findNode(ch, id);
    if (f) return f;
  }
  return null;
}

export function findParent(root: MindMapNode, id: string): MindMapNode | null {
  for (const ch of root.children) {
    if (ch.id === id) return root;
    const p = findParent(ch, id);
    if (p) return p;
  }
  return null;
}

export function isRoot(root: MindMapNode, id: string): boolean {
  return root.id === id;
}

export function collectIds(node: MindMapNode, out: string[] = []): string[] {
  out.push(node.id);
  if (!node.collapsed) {
    for (const ch of node.children) collectIds(ch, out);
  }
  return out;
}

export function deleteNodes(root: MindMapNode, ids: Set<string>): MindMapNode {
  if (ids.has(root.id)) return root;
  const walk = (n: MindMapNode): MindMapNode => ({
    ...n,
    children: n.children.filter((c) => !ids.has(c.id)).map(walk),
  });
  return walk(root);
}

export function addChildToNode(parent: MindMapNode, text = 'Novo tópico'): MindMapNode {
  return {
    ...parent,
    collapsed: false,
    children: [...parent.children, createEmptyNode(text)],
  };
}

export function updateNodeInTree(
  root: MindMapNode,
  id: string,
  updater: (n: MindMapNode) => MindMapNode
): MindMapNode {
  if (root.id === id) return updater(root);
  return {
    ...root,
    children: root.children.map((ch) => updateNodeInTree(ch, id, updater)),
  };
}

export function applyToSelected(
  root: MindMapNode,
  ids: Set<string>,
  updater: (n: MindMapNode) => MindMapNode
): MindMapNode {
  if (ids.has(root.id)) return updater(root);
  return {
    ...root,
    children: root.children.map((ch) => applyToSelected(ch, ids, updater)),
  };
}

export function resetOffsets(root: MindMapNode, ids?: Set<string>): MindMapNode {
  const resetOne = (n: MindMapNode): MindMapNode => ({
    ...n,
    offsetX: 0,
    offsetY: 0,
    children: n.children.map(resetOne),
  });
  if (!ids || ids.size === 0) return resetOne(root);
  return applyToSelected(root, ids, (n) => ({
    ...n,
    offsetX: 0,
    offsetY: 0,
  }));
}

export function branchSelected(root: MindMapNode, ids: Set<string>): MindMapNode {
  return applyToSelected(root, ids, (n) => addChildToNode(n, 'Ramificação'));
}

export function setCollapsed(root: MindMapNode, ids: Set<string>, collapsed: boolean): MindMapNode {
  return applyToSelected(root, ids, (n) => ({ ...n, collapsed }));
}

export function moveSelection(
  root: MindMapNode,
  ids: Set<string>,
  dx: number,
  dy: number
): MindMapNode {
  return applyToSelected(root, ids, (n) => ({
    ...n,
    offsetX: (n.offsetX ?? 0) + dx,
    offsetY: (n.offsetY ?? 0) + dy,
  }));
}

export function resizeNode(
  root: MindMapNode,
  id: string,
  width: number,
  height: number
): MindMapNode {
  return updateNodeInTree(root, id, (n) => ({
    ...n,
    width,
    height,
    userSized: true,
  }));
}

export function setObservation(
  root: MindMapNode,
  id: string,
  observation: MindMapObservation | undefined
): MindMapNode {
  return updateNodeInTree(root, id, (n) => {
    if (!observation?.text?.trim()) {
      const { observation: _removed, ...rest } = n;
      return rest as MindMapNode;
    }
    return { ...n, observation };
  });
}

export function moveObservation(
  root: MindMapNode,
  id: string,
  dx: number,
  dy: number
): MindMapNode {
  return updateNodeInTree(root, id, (n) => {
    if (!n.observation) return n;
    return {
      ...n,
      observation: {
        ...n.observation,
        offsetX: (n.observation.offsetX ?? 4) + dx,
        offsetY: (n.observation.offsetY ?? 0) + dy,
      },
    };
  });
}
