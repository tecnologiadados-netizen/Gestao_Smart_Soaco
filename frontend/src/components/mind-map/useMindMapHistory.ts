import { useCallback, useRef, useState } from 'react';
import type { MindMapNode } from './types';
import { cloneRoot } from './defaults';

const MAX_HISTORY = 80;

export function useMindMapHistory(initialRoot: MindMapNode) {
  const pastRef = useRef<MindMapNode[]>([]);
  const futureRef = useRef<MindMapNode[]>([]);
  const [root, setRootState] = useState<MindMapNode>(() => cloneRoot(initialRoot));

  const pushPast = useCallback((snapshot: MindMapNode) => {
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), cloneRoot(snapshot)];
    futureRef.current = [];
  }, []);

  const setRoot = useCallback(
    (next: MindMapNode | ((prev: MindMapNode) => MindMapNode), recordHistory = true) => {
      setRootState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        if (recordHistory) pushPast(prev);
        return resolved;
      });
    },
    [pushPast]
  );

  const undo = useCallback(() => {
    const past = pastRef.current;
    if (past.length === 0) return;
    setRootState((current) => {
      const prev = past[past.length - 1]!;
      pastRef.current = past.slice(0, -1);
      futureRef.current = [cloneRoot(current), ...futureRef.current];
      return cloneRoot(prev);
    });
  }, []);

  const redo = useCallback(() => {
    const future = futureRef.current;
    if (future.length === 0) return;
    setRootState((current) => {
      const next = future[0]!;
      futureRef.current = future.slice(1);
      pastRef.current = [...pastRef.current, cloneRoot(current)];
      return cloneRoot(next);
    });
  }, []);

  const resetHistory = useCallback((newRoot: MindMapNode) => {
    pastRef.current = [];
    futureRef.current = [];
    setRootState(cloneRoot(newRoot));
  }, []);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  return { root, setRoot, undo, redo, resetHistory, canUndo, canRedo };
}
