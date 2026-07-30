import { useEffect, useRef, useState } from 'react';
import { useTransicaoRotaAtiva } from '../contexts/TransicaoRotaContext';

/** Ciclo completo da animação do loader (precisa bater com `index.css`). */
export const LOADER_CICLO_MS = 1250;

/** Dois ciclos — tempo mínimo que qualquer carregamento fica na tela. */
export const LOADER_DURACAO_MINIMA_MS = LOADER_CICLO_MS * 2;

/**
 * Mantém o retorno em `true` por pelo menos `ms` depois que `ativo` liga, para
 * a animação completar os ciclos em vez de piscar em respostas rápidas.
 *
 * Enquanto o overlay de troca de tela cobre a viewport o retorno fica `false`,
 * senão a mesma navegação mostraria duas animações em sequência. O relógio do
 * tempo mínimo corre desde que `ativo` ligou — inclusive durante a transição —
 * então quando ela termina o overlay da tela só continua se os dados ainda não
 * chegaram, e sai assim que chegarem.
 */
export function useDuracaoMinima(ativo: boolean, ms = LOADER_DURACAO_MINIMA_MS): boolean {
  const transicaoRota = useTransicaoRotaAtiva();
  const [visivel, setVisivel] = useState(ativo && !transicaoRota);
  const ligadoEmRef = useRef<number | null>(ativo ? Date.now() : null);

  useEffect(() => {
    if (ativo) {
      if (ligadoEmRef.current === null) ligadoEmRef.current = Date.now();
      setVisivel(!transicaoRota);
      return;
    }

    if (ligadoEmRef.current === null) {
      setVisivel(false);
      return;
    }

    const restante = ms - (Date.now() - ligadoEmRef.current);
    if (restante <= 0) {
      ligadoEmRef.current = null;
      setVisivel(false);
      return;
    }

    const id = window.setTimeout(() => {
      ligadoEmRef.current = null;
      setVisivel(false);
    }, restante);
    return () => window.clearTimeout(id);
  }, [ativo, transicaoRota, ms]);

  return visivel;
}
