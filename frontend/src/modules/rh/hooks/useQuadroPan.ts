import { useCallback, useEffect, useRef, useState } from "react";

/** Distância mínima (px) antes de assumir o gesto — abaixo disso continua sendo clique. */
const LIMIAR_PAN_PX = 5;

type OpcoesQuadroPan = {
  /** Ctrl/⌘ + scroll. Recebe 1 para aproximar e -1 para afastar. */
  onZoomStep?: (direcao: 1 | -1) => void;
};

/**
 * Arrastar-para-navegar (pan) em quadros roláveis: organograma, mapa de vínculos, etc.
 *
 * Usa ref de callback de propósito: o quadro costuma ser renderizado só depois que os
 * dados chegam, e um `useEffect([])` registraria os listeners enquanto o elemento ainda
 * não existe — deixando o arraste e o zoom inertes.
 */
export function useQuadroPan({ onZoomStep }: OpcoesQuadroPan = {}) {
  const [isPanning, setIsPanning] = useState(false);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const desconectarRef = useRef<(() => void) | null>(null);
  const onZoomStepRef = useRef(onZoomStep);

  useEffect(() => {
    onZoomStepRef.current = onZoomStep;
  }, [onZoomStep]);

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
      ativo: false,
      arrastou: false,
    };

    const capturar = (pointerId: number) => {
      try {
        node.setPointerCapture(pointerId);
      } catch {
        /* ignore */
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 1) return;
      estado.pointerId = e.pointerId;
      estado.x = e.clientX;
      estado.y = e.clientY;
      estado.scrollLeft = node.scrollLeft;
      estado.scrollTop = node.scrollTop;
      estado.ativo = true;
      estado.arrastou = false;
      // Botão do meio: evita o autoscroll nativo e já assume o gesto.
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
      node.scrollLeft = estado.scrollLeft - dx;
      node.scrollTop = estado.scrollTop - dy;
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
      // Depois de arrastar, bloqueia o clique que abriria modal / alternaria o card.
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
      if (!estado.arrastou) return;
      estado.ativo = false;
      estado.arrastou = false;
      estado.pointerId = -1;
      setIsPanning(false);
    };

    const onAuxClick = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };

    // Fotos e logos são arrastáveis por padrão: o drag nativo cancelaria o pan.
    const onDragStart = (e: DragEvent) => e.preventDefault();

    const onWheel = (e: WheelEvent) => {
      if (!onZoomStepRef.current || (!e.ctrlKey && !e.metaKey)) return;
      e.preventDefault();
      onZoomStepRef.current(e.deltaY > 0 ? -1 : 1);
    };

    node.addEventListener("pointerdown", onPointerDown);
    node.addEventListener("pointermove", onPointerMove);
    node.addEventListener("pointerup", encerrarPan);
    node.addEventListener("pointercancel", encerrarPan);
    node.addEventListener("lostpointercapture", onLostCapture);
    node.addEventListener("auxclick", onAuxClick);
    node.addEventListener("dragstart", onDragStart);
    node.addEventListener("wheel", onWheel, { passive: false });

    desconectarRef.current = () => {
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", encerrarPan);
      node.removeEventListener("pointercancel", encerrarPan);
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
