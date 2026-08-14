import { useCallback, useEffect, useState } from 'react';

const STORAGE_PREFIX = 'kpis_favoritos_';

function storageKey(login: string | null | undefined): string {
  return `${STORAGE_PREFIX}${login?.trim() || 'anon'}`;
}

function lerFavoritos(login: string | null | undefined): string[] {
  try {
    const raw = localStorage.getItem(storageKey(login));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

function gravarFavoritos(login: string | null | undefined, ids: string[]) {
  try {
    localStorage.setItem(storageKey(login), JSON.stringify(ids));
  } catch {
    /* ignore quota */
  }
}

/** Favoritos de painéis KPIs (localStorage por login). */
export function useKpisFavoritos(login: string | null | undefined) {
  const [favoritos, setFavoritos] = useState<string[]>(() => lerFavoritos(login));

  useEffect(() => {
    setFavoritos(lerFavoritos(login));
  }, [login]);

  const isFavorito = useCallback((painelId: string) => favoritos.includes(painelId), [favoritos]);

  const toggleFavorito = useCallback(
    (painelId: string) => {
      setFavoritos((prev) => {
        const next = prev.includes(painelId)
          ? prev.filter((id) => id !== painelId)
          : [...prev, painelId];
        gravarFavoritos(login, next);
        return next;
      });
    },
    [login]
  );

  return { favoritos, isFavorito, toggleFavorito };
}
