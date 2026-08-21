import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

const DEFAULT_LOTE = 50;
const SCROLL_THRESHOLD_PX = 80;

/**
 * Renderiza a grade em lotes (padrão 50) e carrega mais ao chegar perto do fim do scroll.
 * Reinicia ao mudar `totalLinhas` (filtros, recorte, nova consulta).
 */
export function useGradeScrollIncremental(
  scrollRef: RefObject<HTMLDivElement | null>,
  totalLinhas: number,
  lote = DEFAULT_LOTE
): number {
  const [visiveis, setVisiveis] = useState(() => Math.min(lote, totalLinhas));

  useEffect(() => {
    setVisiveis(Math.min(lote, totalLinhas));
    scrollRef.current?.scrollTo({ top: 0 });
  }, [totalLinhas, lote, scrollRef]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || visiveis >= totalLinhas) return;

    let next = visiveis;
    while (next < totalLinhas && el.scrollHeight <= el.clientHeight + 4) {
      next = Math.min(totalLinhas, next + lote);
    }
    if (next !== visiveis) setVisiveis(next);
  }, [visiveis, totalLinhas, lote, scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      setVisiveis((prev) => {
        if (prev >= totalLinhas) return prev;
        const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_THRESHOLD_PX;
        if (!nearBottom) return prev;
        return Math.min(totalLinhas, prev + lote);
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [totalLinhas, lote, scrollRef]);

  return Math.min(visiveis, totalLinhas);
}
