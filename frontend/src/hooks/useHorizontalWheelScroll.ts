import { useEffect, type RefObject } from 'react';

const DOM_DELTA_PIXEL = 0;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

/** Converte delta do WheelEvent para pixels (roda lateral costuma vir em linhas no Windows). */
function wheelDeltaToPixels(delta: number, deltaMode: number, pageSize: number): number {
  if (deltaMode === DOM_DELTA_LINE) return delta * 16;
  if (deltaMode === DOM_DELTA_PAGE) return delta * pageSize;
  return delta;
}

/**
 * Converte rolagem do mouse (deltaX, Shift+deltaY ou roda vertical sem scroll Y)
 * em scroll horizontal quando o elemento tem overflow-x.
 * Usa capture para interceptar a roda lateral antes de filhos consumirem o evento.
 */
export function useHorizontalWheelScroll(
  ref: RefObject<HTMLElement | null>,
  enabled = true,
  /** Quando não há scroll vertical, converte roda vertical em horizontal. */
  wheelVerticalAsHorizontal = false
): void {
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const canScrollX = el.scrollWidth > el.clientWidth + 1;
      if (!canScrollX) return;

      const canScrollY = el.scrollHeight > el.clientHeight + 1;
      const pageW = el.clientWidth || 1;
      const pageH = el.clientHeight || 1;

      const rawDx = wheelDeltaToPixels(e.deltaX, e.deltaMode, pageW);
      const rawDy = wheelDeltaToPixels(e.deltaY, e.deltaMode, pageH);

      let dx = 0;

      // Roda lateral / trackpad horizontal: prioridade explícita ao deltaX
      if (rawDx !== 0 && (Math.abs(rawDx) >= Math.abs(rawDy) || rawDy === 0)) {
        dx = rawDx;
      } else if (e.shiftKey && rawDy !== 0) {
        dx = rawDy;
      } else if (rawDy !== 0 && wheelVerticalAsHorizontal && !canScrollY) {
        dx = rawDy;
      }

      if (dx === 0) return;

      const prev = el.scrollLeft;
      const maxLeft = el.scrollWidth - el.clientWidth;
      const next = Math.max(0, Math.min(maxLeft, prev + dx));
      if (next === prev) return;

      el.scrollLeft = next;
      e.preventDefault();
      e.stopPropagation();
    };

    el.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', onWheel, { capture: true });
  }, [ref, enabled, wheelVerticalAsHorizontal]);
}
