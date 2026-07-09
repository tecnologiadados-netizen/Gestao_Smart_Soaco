import { useCallback, useEffect, useRef, type RefObject } from 'react';

const EDGE_PX = 48;
const MAX_SPEED = 18;

/**
 * Auto-scroll de um container overflow durante drag HTML5.
 * Chame o handler retornado em onDragOver do container (e nas linhas, se necessário).
 */
export function useDragAutoScroll(
  containerRef: RefObject<HTMLElement | null>,
  isDragging: boolean
): (e: React.DragEvent) => void {
  const rafRef = useRef<number | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    pointerRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    if (!isDragging) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = () => {
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const { x, y } = pointerRef.current;
        let dx = 0;
        let dy = 0;

        const distTop = y - rect.top;
        if (distTop < EDGE_PX) {
          dy = -Math.ceil(((EDGE_PX - distTop) / EDGE_PX) * MAX_SPEED);
        } else {
          const distBottom = rect.bottom - y;
          if (distBottom < EDGE_PX) {
            dy = Math.ceil(((EDGE_PX - distBottom) / EDGE_PX) * MAX_SPEED);
          }
        }

        const distLeft = x - rect.left;
        if (distLeft < EDGE_PX) {
          dx = -Math.ceil(((EDGE_PX - distLeft) / EDGE_PX) * MAX_SPEED);
        } else {
          const distRight = rect.right - x;
          if (distRight < EDGE_PX) {
            dx = Math.ceil(((EDGE_PX - distRight) / EDGE_PX) * MAX_SPEED);
          }
        }

        if (dx !== 0 || dy !== 0) {
          el.scrollTop += dy;
          el.scrollLeft += dx;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isDragging, containerRef]);

  return onDragOver;
}
