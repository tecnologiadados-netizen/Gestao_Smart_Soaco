import { useEffect } from 'react';
import { useFavoritoVisaoAtual, type VisaoFavoritavel } from '../contexts/FavoritoVisaoAtualContext';

/** Registra a visão atual da página para favoritar via busca rápida. */
export function useRegistrarVisaoFavorito(visao: VisaoFavoritavel | null) {
  const { registrarVisao } = useFavoritoVisaoAtual();

  useEffect(() => {
    registrarVisao(visao);
    return () => registrarVisao(null);
  }, [visao, registrarVisao]);
}
