import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

/** Distância mínima (px) antes de assumir o gesto — abaixo disso continua sendo clique. */
const LIMIAR_PAN_PX = 5;

export type QuadroPanOffset = { x: number; y: number };

type OpcoesQuadroPan = {
  /** Ctrl/⌘ + scroll. Recebe 1 para aproximar e -1 para afastar. */
  onZoomStep?: (direcao: 1 | -1) => void;
  /**
   * Se true, a roda do mouse dá zoom sem precisar de Ctrl/⌘.
   * Use em quadros com pan por translate (hierarquia). No mapa com scroll nativo,
   * deixe false para a roda continuar rolando o conteúdo.
   */
  zoomComScroll?: boolean;
  /**
   * Pan por translate (não depende de scroll).
   * Se omitido, usa scrollLeft/scrollTop do próprio elemento.
   */
  panOffsetRef?: MutableRefObject<QuadroPanOffset>;
  onPanOffsetChange?: (next: QuadroPanOffset) => void;
};

function alvoBloqueiaPan(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("input, textarea, select, option, [contenteditable='true'], [data-no-pan]"),
  );
}

/**
 * Arrastar-para-navegar (pan) em quadros: organograma, mapa de vínculos, etc.
 *
 * Usa ref de callback: o quadro só entra no DOM depois dos dados — um
 * `useEffect([])` deixaria o arraste inerte.
 */
export function useQuadroPan({
  onZoomStep,
  zoomComScroll = false,
  panOffsetRef,
  onPanOffsetChange,
}: OpcoesQuadroPan = {}) {
  const [isPanning, setIsPanning] = useState(false);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const desconectarRef = useRef<(() => void) | null>(null);
  const onZoomStepRef = useRef(onZoomStep);
  const zoomComScrollRef = useRef(zoomComScroll);
  const panOffsetRefRef = useRef(panOffsetRef);
  const onPanOffsetChangeRef = useRef(onPanOffsetChange);

  useEffect(() => {
    onZoomStepRef.current = onZoomStep;
  }, [onZoomStep]);

  useEffect(() => {
    zoomComScrollRef.current = zoomComScroll;
  }, [zoomComScroll]);

  useEffect(() => {
    panOffsetRefRef.current = panOffsetRef;
    onPanOffsetChangeRef.current = onPanOffsetChange;
  }, [panOffsetRef, onPanOffsetChange]);

  useEffect(() => () => desconectarRef.current?.(), []);

  const ref = useCallback((node: HTMLDivElement | null) => {
    desconectarRef.current?.();
    desconectarRef.current = null;
    elementRef.current = node;
    setIsPanning(false);
    if (!node) return;

    const estado = {
      pointerId: -1,
      x: 0,
      y: 0,
      scrollLeft: 0,
      scrollTop: 0,
      panX: 0,
      panY: 0,
      ativo: false,
      arrastou: false,
    };

    const usaOffset = () =>
      Boolean(panOffsetRefRef.current && onPanOffsetChangeRef.current);

    const capturar = (pointerId: number) => {
      try {
        node.setPointerCapture(pointerId);
      } catch {
        /* ignore */
      }
    };

    const aplicarPan = (clientX: number, clientY: number) => {
      const dx = clientX - estado.x;
      const dy = clientY - estado.y;
      if (usaOffset()) {
        onPanOffsetChangeRef.current!({
          x: estado.panX + dx,
          y: estado.panY + dy,
        });
        return;
      }
      node.scrollLeft = estado.scrollLeft - dx;
      node.scrollTop = estado.scrollTop - dy;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 1) return;
      if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
      if (alvoBloqueiaPan(e.target)) return;

      estado.pointerId = e.pointerId;
      estado.x = e.clientX;
      estado.y = e.clientY;
      estado.scrollLeft = node.scrollLeft;
      estado.scrollTop = node.scrollTop;
      const origin = panOffsetRefRef.current?.current;
      estado.panX = origin?.x ?? 0;
      estado.panY = origin?.y ?? 0;
      estado.ativo = true;
      estado.arrastou = false;

      if (e.button === 1) {
        e.preventDefault();
        estado.arrastou = true;
        setIsPanning(true);
        capturar(e.pointerId);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!estado.ativo || estado.pointerId !== e.pointerId) return;
      const dx = e.clientX - estado.x;
      const dy = e.clientY - estado.y;
      if (!estado.arrastou) {
        if (dx * dx + dy * dy < LIMIAR_PAN_PX * LIMIAR_PAN_PX) return;
        estado.arrastou = true;
        setIsPanning(true);
        capturar(e.pointerId);
      }
      e.preventDefault();
      aplicarPan(e.clientX, e.clientY);
    };

    const encerrarPan = (e: PointerEvent) => {
      if (!estado.ativo || estado.pointerId !== e.pointerId) return;
      const arrastou = estado.arrastou;
      estado.ativo = false;
      estado.arrastou = false;
      estado.pointerId = -1;
      setIsPanning(false);
      try {
        if (node.hasPointerCapture(e.pointerId)) node.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (arrastou) {
        const suprimirClique = (ev: MouseEvent) => {
          ev.preventDefault();
          ev.stopPropagation();
        };
        node.addEventListener("click", suprimirClique, true);
        window.setTimeout(() => node.removeEventListener("click", suprimirClique, true), 0);
      }
    };

    const onLostCapture = () => {
      if (!estado.ativo) return;
      estado.ativo = false;
      estado.arrastou = false;
      estado.pointerId = -1;
      setIsPanning(false);
    };

    const onAuxClick = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };

    const onDragStart = (e: DragEvent) => e.preventDefault();

    const onWheel = (e: WheelEvent) => {
      if (!onZoomStepRef.current) return;
      const livre = zoomComScrollRef.current;
      if (!livre && !e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      onZoomStepRef.current(e.deltaY > 0 ? -1 : 1);
    };

    node.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", encerrarPan);
    document.addEventListener("pointercancel", encerrarPan);
    node.addEventListener("lostpointercapture", onLostCapture);
    node.addEventListener("auxclick", onAuxClick);
    node.addEventListener("dragstart", onDragStart);
    node.addEventListener("wheel", onWheel, { passive: false });

    desconectarRef.current = () => {
      node.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", encerrarPan);
      document.removeEventListener("pointercancel", encerrarPan);
      node.removeEventListener("lostpointercapture", onLostCapture);
      node.removeEventListener("auxclick", onAuxClick);
      node.removeEventListener("dragstart", onDragStart);
      node.removeEventListener("wheel", onWheel);
    };
  }, []);

  return { ref, elementRef, isPanning };
}

/** Classes de cursor/seleção do quadro conforme o estado do arraste. */
export function classesQuadroPan(isPanning: boolean): string {
  return isPanning ? "cursor-grabbing select-none [&_*]:!cursor-grabbing" : "cursor-grab";
}
