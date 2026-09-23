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

/** Há scroll vertical útil no próprio elemento, em ancestrais ou na página. */
function podeRolarVerticalFora(el: HTMLElement): boolean {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return true;
    }
    node = node.parentElement;
  }
  const root = document.scrollingElement ?? document.documentElement;
  return root.scrollHeight > root.clientHeight + 1;
}

/**
 * Converte rolagem do mouse (deltaX, Shift+deltaY ou roda vertical sem scroll Y)
 * em scroll horizontal quando o elemento tem overflow-x.
 * Usa capture para interceptar a roda lateral antes de filhos consumirem o evento.
 *
 * Não rouba gestos verticais quando a página/ancestral ainda pode rolar para baixo
 * (caso típico de grades com só overflow-x que cresceram com o conteúdo).
 */
export function useHorizontalWheelScroll(
  ref: RefObject<HTMLElement | null>,
  enabled = true,
  /** Quando não há scroll vertical no elemento nem fora dele, converte roda vertical em horizontal. */
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

      // Trackpad: só trata como horizontal se o eixo X for claramente dominante
      // (evita “pulo” lateral com ruído enquanto o usuário rola para baixo).
      if (rawDx !== 0 && Math.abs(rawDx) > Math.abs(rawDy) * 1.15) {
        dx = rawDx;
      } else if (e.shiftKey && rawDy !== 0) {
        dx = rawDy;
      } else if (
        rawDy !== 0 &&
        wheelVerticalAsHorizontal &&
        !canScrollY &&
        !podeRolarVerticalFora(el)
      ) {
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
