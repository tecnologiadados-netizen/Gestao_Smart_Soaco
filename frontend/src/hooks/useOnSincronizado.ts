import { useEffect, useRef } from 'react';

const EVENT_SINCRONIZADO = 'sincronizado';

/**
 * Escuta o evento global `sincronizado` (ex.: página Situação da API).
 * Chama onRefresh para atualizar os dados exibidos na tela.
 */
export function useOnSincronizado(onRefresh: () => void): void {
  const cbRef = useRef(onRefresh);
  cbRef.current = onRefresh;
  useEffect(() => {
    const handler = () => {
      cbRef.current?.();
    };
    window.addEventListener(EVENT_SINCRONIZADO, handler);
    return () => window.removeEventListener(EVENT_SINCRONIZADO, handler);
  }, []);
}
