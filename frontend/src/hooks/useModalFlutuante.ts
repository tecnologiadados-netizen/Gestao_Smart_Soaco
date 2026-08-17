import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

export type ModalFlutuanteSize = { w: number; h: number };
export type ModalFlutuantePos = { x: number; y: number };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function centerPos(w: number, h: number): ModalFlutuantePos {
  if (typeof window === 'undefined') return { x: 40, y: 40 };
  const margin = 8;
  const cw = Math.min(w, window.innerWidth - margin * 2);
  const ch = Math.min(h, window.innerHeight - margin * 2);
  return {
    x: Math.max(margin, Math.round((window.innerWidth - cw) / 2)),
    y: Math.max(margin, Math.round((window.innerHeight - ch) / 2)),
  };
}

function clampPos(pos: ModalFlutuantePos, size: ModalFlutuanteSize): ModalFlutuantePos {
  if (typeof window === 'undefined') return pos;
  const maxX = Math.max(8, window.innerWidth - Math.min(size.w, window.innerWidth - 16));
  const maxY = Math.max(8, window.innerHeight - Math.min(size.h, window.innerHeight - 16));
  return {
    x: clamp(pos.x, 8, maxX),
    y: clamp(pos.y, 8, maxY),
  };
}

function clampSize(size: ModalFlutuanteSize, minW: number, minH: number): ModalFlutuanteSize {
  if (typeof window === 'undefined') return size;
  return {
    w: clamp(size.w, minW, window.innerWidth - 16),
    h: clamp(size.h, minH, window.innerHeight - 16),
  };
}

/**
 * Posição/tamanho de modal flutuante (centralizado ao abrir; arrastar pelo handle; redimensionar pelo canto).
 * Só aplica lógica quando `enabled`; o consumidor decide o markup.
 */
export function useModalFlutuante(opts: {
  enabled: boolean;
  open: boolean;
  defaultSize: ModalFlutuanteSize;
  minSize?: ModalFlutuanteSize;
  /** Reinicia centro/tamanho ao mudar (ex.: número do PD). */
  resetKey?: string;
}) {
  const minW = opts.minSize?.w ?? 360;
  const minH = opts.minSize?.h ?? 240;
  const defaultSizeRef = useRef(opts.defaultSize);
  defaultSizeRef.current = opts.defaultSize;

  // Layout inicial já no centro — evita “piscada” (primeiro paint em 40,40 → depois recentraliza).
  const [size, setSize] = useState<ModalFlutuanteSize>(() => {
    if (typeof window === 'undefined') return opts.defaultSize;
    return clampSize(opts.defaultSize, minW, minH);
  });
  const [pos, setPos] = useState<ModalFlutuantePos>(() => {
    if (typeof window === 'undefined') return { x: 40, y: 40 };
    const s = clampSize(opts.defaultSize, minW, minH);
    return centerPos(s.w, s.h);
  });
  const [dragging, setDragging] = useState(false);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    baseW: number;
    baseH: number;
  } | null>(null);
  const posRef = useRef(pos);
  const sizeRef = useRef(size);
  posRef.current = pos;
  sizeRef.current = size;

  // Só recentraliza quando reabre / troca de chave — no 1º paint o useState já centralizou.
  const prevOpenRef = useRef(false);
  const prevResetKeyRef = useRef(opts.resetKey);
  const skipPrimeiroEffectRef = useRef(true);
  useEffect(() => {
    if (!opts.enabled || !opts.open) {
      prevOpenRef.current = false;
      return;
    }
    const abriuAgora = !prevOpenRef.current;
    const trocouChave = prevResetKeyRef.current !== opts.resetKey;
    prevOpenRef.current = true;
    prevResetKeyRef.current = opts.resetKey;

    if (skipPrimeiroEffectRef.current) {
      skipPrimeiroEffectRef.current = false;
      return;
    }
    if (!abriuAgora && !trocouChave) return;

    const next = clampSize(defaultSizeRef.current, minW, minH);
    setSize(next);
    setPos(centerPos(next.w, next.h));
    setDragging(false);
    dragRef.current = null;
    resizeRef.current = null;
  }, [opts.enabled, opts.open, opts.resetKey, minW, minH]);

  const onDragPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!opts.enabled) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('button, a, input, textarea, select, label, [data-no-drag]')) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: posRef.current.x,
        origY: posRef.current.y,
      };
      setDragging(true);
    },
    [opts.enabled]
  );

  const onDragPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const d = dragRef.current;
      if (!d) return;
      const next = clampPos(
        {
          x: d.origX + (e.clientX - d.startX),
          y: d.origY + (e.clientY - d.startY),
        },
        sizeRef.current
      );
      setPos(next);
    },
    []
  );

  const onDragPointerEnd = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
  }, []);

  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!opts.enabled) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        baseW: sizeRef.current.w,
        baseH: sizeRef.current.h,
      };
    },
    [opts.enabled]
  );

  const onResizePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      const d = resizeRef.current;
      if (!d) return;
      const next = clampSize(
        {
          w: d.baseW + (e.clientX - d.startX),
          h: d.baseH + (e.clientY - d.startY),
        },
        minW,
        minH
      );
      setSize(next);
      setPos((p) => clampPos(p, next));
    },
    [minW, minH]
  );

  const onResizePointerEnd = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!resizeRef.current) return;
    resizeRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
  }, []);

  /** Encaixa o modal no topo (~36% da tela) para caber o calendário abaixo. */
  const aplicarTopoSplit = useCallback(() => {
    if (!opts.enabled || typeof window === 'undefined') return;
    const margin = 8;
    const availW = Math.max(minW, window.innerWidth - margin * 2);
    const topBand = Math.round(window.innerHeight * 0.36);
    const w = clamp(Math.min(1100, availW), minW, availW);
    const h = clamp(topBand, minH, window.innerHeight - margin * 2 - 120);
    setSize({ w, h });
    setPos({
      x: margin + Math.round((availW - w) / 2),
      y: margin,
    });
  }, [opts.enabled, minW, minH]);

  /**
   * Encaixa o modal sob o painel do PD mantendo o tamanho padrão, sempre
   * inteiro na viewport (canto de redimensionar acessível).
   */
  const aplicarBaseSplit = useCallback(() => {
    if (!opts.enabled || typeof window === 'undefined') return;
    const margin = 8;
    const gap = 8;
    // Mesma faixa do aplicarTopoSplit (não usa minH do calendário, para alinhar).
    const topBand = Math.round(window.innerHeight * 0.36);
    const y = margin + topBand + gap;
    const base = clampSize(defaultSizeRef.current, minW, minH);
    const w = Math.min(base.w, window.innerWidth - margin * 2);
    const h = Math.min(base.h, Math.max(160, window.innerHeight - y - margin));
    setSize({ w, h });
    setPos({ x: Math.max(margin, Math.round((window.innerWidth - w) / 2)), y });
  }, [opts.enabled, minW, minH]);

  /** Volta ao centro com o tamanho padrão. */
  const aplicarCentroPadrao = useCallback(() => {
    if (!opts.enabled || typeof window === 'undefined') return;
    const next = clampSize(defaultSizeRef.current, minW, minH);
    setSize(next);
    setPos(centerPos(next.w, next.h));
  }, [opts.enabled, minW, minH]);

  const panelStyle: CSSProperties | undefined = opts.enabled
    ? {
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        maxWidth: 'calc(100vw - 16px)',
        maxHeight: 'calc(100vh - 16px)',
      }
    : undefined;

  return {
    panelStyle,
    dragging,
    onDragPointerDown,
    onDragPointerMove,
    onDragPointerEnd,
    onResizePointerDown,
    onResizePointerMove,
    onResizePointerEnd,
    aplicarTopoSplit,
    aplicarBaseSplit,
    aplicarCentroPadrao,
  };
}
