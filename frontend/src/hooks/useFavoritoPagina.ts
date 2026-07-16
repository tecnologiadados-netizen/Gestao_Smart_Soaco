import { useMemo } from 'react';
import { useRegistrarVisaoFavorito } from './useRegistrarVisaoFavorito';
import { useTelaFavorita } from './useTelaFavorita';
import { normalizarRotaFavorito, resumoFiltrosFavorito } from '../config/telasFavoritaveis';

type UseFavoritoPaginaOptions = {
  rota: string;
  telaLabel: string;
  /** Filtros atuais da tela (todos string). */
  filtros: Record<string, string>;
  /** Aplica filtros vindos do favorito / URL. */
  aplicarFiltros: (filtros: Record<string, string>) => void;
  resumoFiltros?: string;
  enabled?: boolean;
  validarFiltros?: (filtros: Record<string, string>) => Record<string, string> | null;
};

/**
 * Atalho para telas favoritáveis: registra a visão atual e restaura ao abrir ?fav=.
 */
export function useFavoritoPagina({
  rota,
  telaLabel,
  filtros,
  aplicarFiltros,
  resumoFiltros,
  enabled = true,
  validarFiltros,
}: UseFavoritoPaginaOptions) {
  const rotaNorm = normalizarRotaFavorito(rota);
  const resumo =
    resumoFiltros ??
    resumoFiltrosFavorito(rotaNorm, filtros);

  const visao = useMemo(
    () =>
      enabled
        ? {
            rota: rotaNorm,
            filtros,
            telaLabel,
            resumoFiltros: resumo,
          }
        : null,
    [enabled, rotaNorm, filtros, telaLabel, resumo]
  );

  useRegistrarVisaoFavorito(visao);

  return useTelaFavorita({
    filtrosAtuais: filtros,
    aplicarFiltros,
    validarFiltros,
    enabled,
  });
}
