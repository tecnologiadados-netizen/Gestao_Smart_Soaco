import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type VisaoFavoritavel = {
  rota: string;
  filtros: Record<string, string>;
  telaLabel: string;
  resumoFiltros: string;
};

interface FavoritoVisaoAtualContextValue {
  visao: VisaoFavoritavel | null;
  registrarVisao: (visao: VisaoFavoritavel | null) => void;
}

const FavoritoVisaoAtualContext = createContext<FavoritoVisaoAtualContextValue | null>(null);

export function FavoritoVisaoAtualProvider({ children }: { children: ReactNode }) {
  const [visao, setVisao] = useState<VisaoFavoritavel | null>(null);

  const registrarVisao = useCallback((v: VisaoFavoritavel | null) => {
    setVisao(v);
  }, []);

  const value = useMemo(() => ({ visao, registrarVisao }), [visao, registrarVisao]);

  return (
    <FavoritoVisaoAtualContext.Provider value={value}>{children}</FavoritoVisaoAtualContext.Provider>
  );
}

export function useFavoritoVisaoAtual(): FavoritoVisaoAtualContextValue {
  const ctx = useContext(FavoritoVisaoAtualContext);
  if (!ctx) throw new Error('useFavoritoVisaoAtual must be used within FavoritoVisaoAtualProvider');
  return ctx;
}
