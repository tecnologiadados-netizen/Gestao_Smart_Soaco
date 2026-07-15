/**
 * Radix Dialog usa remove-scroll: rolagem com wheel/touchpad em elementos portaled (ex.: Popover)
 * ou em divs dentro do modal pode não aplicar. Listener não-passivo em capture + deltas normalizados
 * alinha mouse, trackpad (incl. deltaMode linha/página) e eixo dominante.
 */

import { useCallback, useLayoutEffect, useRef } from "react";

export function normalizeWheelDelta(e: WheelEvent, clientWidth: number, clientHeight: number): { dx: number; dy: number } {
  let dx = e.deltaX;
  let dy = e.deltaY;
  if (e.shiftKey && dy !== 0 && dx === 0) {
    dx = dy;
    dy = 0;
  }
  const lineApprox = 18;
  if (e.deltaMode === 1) {
    dx *= lineApprox;
    dy *= lineApprox;
  } else if (e.deltaMode === 2) {
    dx *= clientWidth;
    dy *= clientHeight;
  }
  return { dx, dy };
}

export type WheelScrollMode = "vertical" | "both";

/**
 * @returns cleanup para remover o listener
 */
export function attachDialogSafeWheelScroll(el: HTMLElement, mode: WheelScrollMode): () => void {
  const onWheel = (e: WheelEvent) => {
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    let { dx, dy } = normalizeWheelDelta(e, cw, ch);

    if (mode === "vertical") {
      if (Math.abs(dx) > Math.abs(dy)) dy = dx;
      dx = 0;
    }

    const maxTop = Math.max(0, el.scrollHeight - ch);
    const maxLeft = Math.max(0, el.scrollWidth - cw);
    if (maxTop <= 0 && maxLeft <= 0) return;

    const prevTop = el.scrollTop;
    const prevLeft = el.scrollLeft;

    let nextTop = prevTop + dy;
    let nextLeft = prevLeft + dx;
    nextTop = Math.max(0, Math.min(nextTop, maxTop));
    nextLeft = Math.max(0, Math.min(nextLeft, maxLeft));

    const triedV = dy !== 0 && maxTop > 0;
    const triedH = mode === "both" && dx !== 0 && maxLeft > 0;

    if (triedV) el.scrollTop = nextTop;
    if (triedH) el.scrollLeft = nextLeft;

    const movedV = triedV && el.scrollTop !== prevTop;
    const movedH = triedH && el.scrollLeft !== prevLeft;
    const atTop = prevTop <= 0;
    const atBottom = prevTop >= maxTop - 0.5;
    const atLeft = prevLeft <= 0;
    const atRight = prevLeft >= maxLeft - 0.5;
    const hitBoundaryV = triedV && !movedV && ((dy < 0 && atTop) || (dy > 0 && atBottom));
    const hitBoundaryH = triedH && !movedH && ((dx < 0 && atLeft) || (dx > 0 && atRight));

    if (movedV || movedH || hitBoundaryV || hitBoundaryH) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  el.addEventListener("wheel", onWheel, { passive: false, capture: true });
  return () => el.removeEventListener("wheel", onWheel, { capture: true });
}

/** Ref callback que liga/desliga wheel scroll seguro em modais (Popover/Select dentro de Dialog). */
export function useDialogSafeWheelScrollRef<T extends HTMLElement>(
  mode: WheelScrollMode = "vertical",
): (node: T | null) => void {
  const cleanupRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  return useCallback(
    (node: T | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (node) {
        cleanupRef.current = attachDialogSafeWheelScroll(node, mode);
      }
    },
    [mode],
  );
}
