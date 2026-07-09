import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { obterFavorito } from '../api/favoritos';
import { useFavoritos } from '../contexts/FavoritosContext';
import {
  filtrosFromSearchParams,
  isRotaFavoritavel,
  normalizarRotaFavorito,
} from '../config/telasFavoritaveis';

type UseTelaFavoritaOptions<T extends Record<string, string>> = {
  filtrosAtuais: T;
  aplicarFiltros: (filtros: T) => void;
  validarFiltros?: (filtros: Record<string, string>) => T | null;
  onResolved?: () => void;
  /** Aguarda listas de filtros carregarem antes de resolver favoritos. */
  enabled?: boolean;
};

export function useTelaFavorita<T extends Record<string, string>>({
  filtrosAtuais,
  aplicarFiltros,
  validarFiltros,
  onResolved,
  enabled = true,
}: UseTelaFavoritaOptions<T>) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { favoritos, favoritosDaRota, loading: favoritosLoading } = useFavoritos();

  const rota = normalizarRotaFavorito(location.pathname);
  const [resolving, setResolving] = useState(isRotaFavoritavel(rota));
  const [favIdAtivo, setFavIdAtivo] = useState<number | null>(null);
  const resolvedRef = useRef(false);
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;

  const favoritosRota = useMemo(() => favoritosDaRota(rota), [favoritosDaRota, rota]);

  const aplicarComValidacao = useCallback(
    (raw: Record<string, string>) => {
      const parsed = validarFiltros ? validarFiltros(raw) : (raw as T);
      if (parsed) aplicarFiltros(parsed);
      return parsed;
    },
    [aplicarFiltros, validarFiltros]
  );

  useEffect(() => {
    if (!enabled) return;
    if (!isRotaFavoritavel(rota)) {
      setResolving(false);
      resolvedRef.current = true;
      onResolvedRef.current?.();
      return;
    }
    if (resolvedRef.current) return;
    if (favoritosLoading) return;

    let cancelled = false;

    async function resolve() {
      setResolving(true);
      try {
        const favParam = searchParams.get('fav');
        if (favParam) {
          const id = Number(favParam);
          if (Number.isFinite(id)) {
            const cached = favoritos.find((f) => f.id === id && f.rota === rota);
            const fav = cached ?? (await obterFavorito(id));
            if (!cancelled && fav.rota === rota) {
              aplicarComValidacao(fav.filtros);
              setFavIdAtivo(fav.id);
              resolvedRef.current = true;
              onResolvedRef.current?.();
              return;
            }
          }
        }

        const fromParams = filtrosFromSearchParams(rota, searchParams);
        if (fromParams) {
          const ok = aplicarComValidacao(fromParams);
          if (!cancelled && ok) {
            setFavIdAtivo(null);
            resolvedRef.current = true;
            onResolvedRef.current?.();
            return;
          }
        }

        const padrao = favoritosRota.find((f) => f.padrao);
        if (padrao) {
          aplicarComValidacao(padrao.filtros);
          setFavIdAtivo(padrao.id);
          navigate(`${rota}?fav=${padrao.id}`, { replace: true });
          resolvedRef.current = true;
          onResolvedRef.current?.();
          return;
        }

        if (!cancelled) {
          resolvedRef.current = true;
          onResolvedRef.current?.();
        }
      } catch {
        if (!cancelled) {
          resolvedRef.current = true;
          onResolvedRef.current?.();
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [
    rota,
    searchParams,
    favoritos,
    favoritosRota,
    favoritosLoading,
    aplicarComValidacao,
    navigate,
    enabled,
  ]);

  const aplicarFavorito = useCallback(
    (id: number) => {
      const fav = favoritos.find((f) => f.id === id);
      if (!fav) return;
      aplicarComValidacao(fav.filtros);
      setFavIdAtivo(fav.id);
      navigate(`${rota}?fav=${id}`, { replace: true });
    },
    [aplicarComValidacao, favoritos, navigate, rota]
  );

  const sincronizarUrlFavorito = useCallback(
    (id: number) => {
      setFavIdAtivo(id);
      navigate(`${rota}?fav=${id}`, { replace: true });
    },
    [navigate, rota]
  );

  const temFavNaUrl = !!searchParams.get('fav');

  return {
    rota,
    favoritosRota,
    favIdAtivo,
    temFavNaUrl,
    resolving: resolving || (isRotaFavoritavel(rota) && favoritosLoading && !resolvedRef.current),
    aplicarFavorito,
    sincronizarUrlFavorito,
    filtrosAtuais,
  };
}
