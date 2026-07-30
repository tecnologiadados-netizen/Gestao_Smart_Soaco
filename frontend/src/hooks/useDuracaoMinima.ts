import { useEffect, useRef, useState } from 'react';

/**
 * Mantém o indicador de carregamento visível por um tempo mínimo.
 * Resposta rápida do backend fazia o loader piscar por poucos milissegundos,
 * o que passa impressão de falha em vez de carregamento.
 */
export function useDuracaoMinima(ativo: boolean, duracaoMs = 450): boolean {
  const [visivel, setVisivel] = useState(ativo);
  const inicioRef = useRef<number | null>(ativo ? Date.now() : null);

  useEffect(() => {
    if (ativo) {
      inicioRef.current = Date.now();
      setVisivel(true);
      return;
    }

    const decorrido = inicioRef.current == null ? duracaoMs : Date.now() - inicioRef.current;
    const restante = duracaoMs - decorrido;
    if (restante <= 0) {
      setVisivel(false);
      return;
    }

    const timer = setTimeout(() => setVisivel(false), restante);
    return () => clearTimeout(timer);
  }, [ativo, duracaoMs]);

  return visivel;
}
