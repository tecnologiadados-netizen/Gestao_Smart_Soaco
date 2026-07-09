import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  criarFavorito,
  excluirFavorito,
  listarFavoritos,
  type TelaFavorita,
} from '../api/favoritos';
import { useAuth } from './AuthContext';
import { SESSION_CLEARED_EVENT } from '../api/client';

interface FavoritosContextValue {
  favoritos: TelaFavorita[];
  loading: boolean;
  refreshFavoritos: () => Promise<void>;
  salvarFavorito: (payload: {
    nome: string;
    rota: string;
    filtros: Record<string, string>;
  }) => Promise<TelaFavorita>;
  removerFavorito: (id: number) => Promise<void>;
  favoritosDaRota: (rota: string) => TelaFavorita[];
}

const FavoritosContext = createContext<FavoritosContextValue | null>(null);

export function FavoritosProvider({ children }: { children: ReactNode }) {
  const { login, profileLoaded } = useAuth();
  const [favoritos, setFavoritos] = useState<TelaFavorita[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshFavoritos = useCallback(async () => {
    if (!login) {
      setFavoritos([]);
      return;
    }
    setLoading(true);
    try {
      const lista = await listarFavoritos();
      setFavoritos(lista);
    } catch {
      setFavoritos([]);
    } finally {
      setLoading(false);
    }
  }, [login]);

  useEffect(() => {
    if (!profileLoaded) return;
    if (!login) {
      setFavoritos([]);
      return;
    }
    void refreshFavoritos();
  }, [profileLoaded, login, refreshFavoritos]);

  useEffect(() => {
    const onClear = () => setFavoritos([]);
    window.addEventListener(SESSION_CLEARED_EVENT, onClear);
    return () => window.removeEventListener(SESSION_CLEARED_EVENT, onClear);
  }, []);

  const salvarFavorito = useCallback(
    async (payload: { nome: string; rota: string; filtros: Record<string, string> }) => {
      const created = await criarFavorito(payload);
      setFavoritos((prev) => [...prev, created].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)));
      return created;
    },
    []
  );

  const removerFavorito = useCallback(async (id: number) => {
    await excluirFavorito(id);
    setFavoritos((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const favoritosDaRota = useCallback(
    (rota: string) => favoritos.filter((f) => f.rota === rota.split('?')[0]),
    [favoritos]
  );

  const value = useMemo(
    () => ({
      favoritos,
      loading,
      refreshFavoritos,
      salvarFavorito,
      removerFavorito,
      favoritosDaRota,
    }),
    [favoritos, loading, refreshFavoritos, salvarFavorito, removerFavorito, favoritosDaRota]
  );

  return <FavoritosContext.Provider value={value}>{children}</FavoritosContext.Provider>;
}

export function useFavoritos(): FavoritosContextValue {
  const ctx = useContext(FavoritosContext);
  if (!ctx) throw new Error('useFavoritos must be used within FavoritosProvider');
  return ctx;
}
