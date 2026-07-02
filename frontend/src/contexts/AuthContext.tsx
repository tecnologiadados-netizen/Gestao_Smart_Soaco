import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { getMe } from '../api/auth';
import { getStoredToken, SESSION_CLEARED_EVENT } from '../api/client';
import { touchLastActivity } from '../utils/sessaoInatividade';
import type { CodigoPermissao } from '../config/permissoes';

interface AuthContextValue {
  login: string | null;
  nome: string | null;
  grupo: string | null;
  isCommercialTeam: boolean;
  mustChangePassword: boolean;
  /** Primeira tela após login (definida no grupo). */
  telaInicialPath: string | null;
  permissoes: string[];
  isMaster: boolean;
  /** Minutos sem interação antes do logout automático (definido no grupo). */
  logoutInatividadeMinutos: number | null;
  /** True após a primeira tentativa de carregar o perfil (independente de sucesso/falha). */
  profileLoaded: boolean;
  hasPermission: (codigo: CodigoPermissao) => boolean;
  setUser: (
    login: string | null,
    data?: { nome?: string | null; grupo?: string | null; isCommercialTeam?: boolean; permissoes?: string[] }
  ) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [login, setLogin] = useState<string | null>(null);
  const [nome, setNome] = useState<string | null>(null);
  const [grupo, setGrupo] = useState<string | null>(null);
  const [isCommercialTeam, setIsCommercialTeam] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [telaInicialPath, setTelaInicialPath] = useState<string | null>(null);
  const [permissoes, setPermissoes] = useState<string[]>([]);
  const [isMaster, setIsMaster] = useState(false);
  const [logoutInatividadeMinutos, setLogoutInatividadeMinutos] = useState<number | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const clearUser = useCallback(() => {
    setLogin(null);
    setNome(null);
    setGrupo(null);
    setIsCommercialTeam(false);
    setMustChangePassword(false);
    setTelaInicialPath(null);
    setPermissoes([]);
    setIsMaster(false);
    setLogoutInatividadeMinutos(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await getMe();
      const minutosInatividade =
        me.logoutInatividadeMinutos != null && me.logoutInatividadeMinutos > 0 ? me.logoutInatividadeMinutos : null;
      // Sessão validada pelo backend: sincroniza timestamp local para o timer de inatividade.
      if (me.login && minutosInatividade != null) {
        touchLastActivity(me.login);
      }
      setLogin(me.login ?? null);
      setNome(me.nome ?? null);
      setGrupo(me.grupo ?? null);
      setIsCommercialTeam(!!me.isCommercialTeam);
      setMustChangePassword(!!me.mustChangePassword);
      setTelaInicialPath(me.telaInicialPath ?? null);
      setPermissoes(me.permissoes ?? []);
      setIsMaster(!!me.isMaster);
      setLogoutInatividadeMinutos(
        me.logoutInatividadeMinutos != null && me.logoutInatividadeMinutos > 0 ? me.logoutInatividadeMinutos : null
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? '');
      const unauthorized = msg.toLowerCase().includes('não autorizado') || msg.toLowerCase().includes('nao autorizado');
      // Em queda/restart do backend com token existente, mantém perfil para evitar "deslogar" por falha transitória.
      if (!unauthorized && getStoredToken()) {
        return;
      }
      clearUser();
    } finally {
      setProfileLoaded(true);
    }
  }, [clearUser]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const onSessionCleared = () => {
      clearUser();
      setProfileLoaded(true);
    };
    window.addEventListener(SESSION_CLEARED_EVENT, onSessionCleared);
    return () => window.removeEventListener(SESSION_CLEARED_EVENT, onSessionCleared);
  }, [clearUser]);

  const hasPermission = useCallback(
    (codigo: CodigoPermissao) => isMaster || permissoes.includes(codigo),
    [isMaster, permissoes]
  );

  const setUser = useCallback(
    (
      l: string | null,
      data?: { nome?: string | null; grupo?: string | null; isCommercialTeam?: boolean; permissoes?: string[] }
    ) => {
      setLogin(l);
      if (data) {
        if (data.nome !== undefined) setNome(data.nome);
        if (data.grupo !== undefined) setGrupo(data.grupo);
        if ((data as { isCommercialTeam?: boolean }).isCommercialTeam !== undefined) {
          setIsCommercialTeam(!!(data as { isCommercialTeam?: boolean }).isCommercialTeam);
        }
        if (data.permissoes !== undefined) setPermissoes(data.permissoes);
      }
    },
    []
  );

  const value: AuthContextValue = useMemo(
    () => ({
      login,
      nome,
      grupo,
      isCommercialTeam,
      mustChangePassword,
      telaInicialPath,
      permissoes,
      isMaster,
      logoutInatividadeMinutos,
      profileLoaded,
      hasPermission,
      setUser,
      refreshUser,
    }),
    [login, nome, grupo, isCommercialTeam, mustChangePassword, telaInicialPath, permissoes, isMaster, logoutInatividadeMinutos, profileLoaded, hasPermission, setUser, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
