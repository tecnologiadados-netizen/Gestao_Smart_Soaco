import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AbaKeepAliveOutlet from './AbaKeepAliveOutlet';
import { logout, changeMyPassword } from '../api/auth';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSOES } from '../config/permissoes';
import {
  buildFinanceiroMenuForUser,
  buildIntegracaoSubmenusForUser,
  buildLogisticaMenuForUser,
  getLabelForPath,
} from '../config/navigationMenu';
import PermissionGuard from './PermissionGuard';
import StatusCard from './StatusCard';
import { getSycroOrderNotifications } from '../api/sycroorder';
import { getSupportUnreadCount } from '../api/suporte';
import { podeAcessarRotaChamadosSuporte } from '../utils/suportePermissoes';
import { LayoutFocoProvider, useLayoutFoco } from '../contexts/LayoutFocoContext';
import { useAutoLogout } from '../hooks/useAutoLogout';
import { useSidebarOpen } from '../hooks/useSidebarOpen';
import LogoSoAco from './LogoSoAco';
import Sidebar from './layout/Sidebar';
import BuscaRapidaTelas from './layout/BuscaRapidaTelas';

function SunIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function MenuToggleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export default function Layout() {
  return (
    <LayoutFocoProvider>
      <LayoutInner />
    </LayoutFocoProvider>
  );
}

function LayoutInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { hasPermission, isMaster, grupo, nome, login, mustChangePassword, refreshUser, telaInicialPath, logoutInatividadeMinutos } = useAuth();
  const { modoFoco, sairModoFoco } = useLayoutFoco();
  const { open: sidebarOpen, pinned: sidebarPinned, toggle: toggleSidebar, expand: expandSidebar, collapse: collapseSidebar } = useSidebarOpen();

  useEffect(() => {
    if (!modoFoco) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') sairModoFoco(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modoFoco, sairModoFoco]);

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [savingSenha, setSavingSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);

  const [sycroUnreadCount, setSycroUnreadCount] = useState<number>(0);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);

  const refreshSupportUnreadCount = useCallback(async () => {
    if (!podeAcessarRotaChamadosSuporte(hasPermission)) {
      setSupportUnreadCount(0);
      return;
    }
    try {
      setSupportUnreadCount(await getSupportUnreadCount());
    } catch {
      setSupportUnreadCount(0);
    }
  }, [hasPermission]);

  const refreshSycroUnreadCount = useCallback(async () => {
    if (!hasPermission(PERMISSOES.COMUNICACAO_TELA_VER) && !hasPermission(PERMISSOES.COMUNICACAO_TOTAL)) {
      setSycroUnreadCount(0);
      return;
    }
    try {
      const list = await getSycroOrderNotifications();
      setSycroUnreadCount(list.filter((n) => !n.is_read).length);
    } catch {
      setSycroUnreadCount(0);
    }
  }, [hasPermission]);

  useEffect(() => {
    refreshSycroUnreadCount();
  }, [login, refreshSycroUnreadCount]);

  useEffect(() => {
    const handler = () => refreshSycroUnreadCount();
    window.addEventListener('sycroorder:notificationsUpdated', handler);
    return () => window.removeEventListener('sycroorder:notificationsUpdated', handler);
  }, [refreshSycroUnreadCount]);

  useEffect(() => {
    void refreshSupportUnreadCount();
  }, [login, refreshSupportUnreadCount]);

  useEffect(() => {
    const handler = () => void refreshSupportUnreadCount();
    window.addEventListener('suporte:notificationsUpdated', handler);
    return () => window.removeEventListener('suporte:notificationsUpdated', handler);
  }, [refreshSupportUnreadCount]);

  useEffect(() => {
    if (!podeAcessarRotaChamadosSuporte(hasPermission)) return;
    const t = window.setInterval(() => void refreshSupportUnreadCount(), 30000);
    return () => window.clearInterval(t);
  }, [hasPermission, refreshSupportUnreadCount]);

  useEffect(() => {
    if (location.pathname.startsWith('/suporte')) {
      void refreshSupportUnreadCount();
    }
  }, [location.pathname, refreshSupportUnreadCount]);

  const integracaoItems = useMemo(
    () => buildIntegracaoSubmenusForUser(hasPermission, isMaster, grupo),
    [hasPermission, isMaster, grupo],
  );

  const financeiroMenu = useMemo(
    () => buildFinanceiroMenuForUser(hasPermission),
    [hasPermission],
  );

  const logisticaMenu = useMemo(
    () => buildLogisticaMenuForUser(hasPermission),
    [hasPermission],
  );

  const [syncPanelOpen, setSyncPanelOpen] = useState(false);
  const syncPanelRef = useRef<HTMLDivElement>(null);

  const telaInicialPathRef = useRef(telaInicialPath);
  useEffect(() => { telaInicialPathRef.current = telaInicialPath; }, [telaInicialPath]);

  const [abas, setAbas] = useState<{ id: string; path: string; label: string }[]>(() => {
    const path = location.pathname || '/';
    if (path === '/') return [];
    return [{ id: path, path, label: getLabelForPath(path) }];
  });

  useEffect(() => {
    const path = location.pathname || '/';
    if (path === '/') return;
    const tabPath = path.startsWith('/mind-maps')
      ? '/mind-maps'
      : path.startsWith('/pedidos/programacao-producao/recursos')
        ? '/pedidos/programacao-producao/recursos'
        : path.startsWith('/pedidos/regras-data-entrega')
          ? '/pedidos/regras-data-entrega'
          : path.startsWith('/pedidos/programacao-producao')
            ? '/pedidos/programacao-producao'
            : path;
    setAbas((prev) => {
      const exists = prev.some((a) => a.path === tabPath);
      if (exists) return prev;
      return [...prev, { id: tabPath, path: tabPath, label: getLabelForPath(tabPath) }];
    });
  }, [location.pathname]);

  useEffect(() => {
    if (!telaInicialPath || telaInicialPath === '/') return;
    setAbas((prev) => {
      if (prev.some((a) => a.path === telaInicialPath)) return prev;
      return [{ id: telaInicialPath, path: telaInicialPath, label: getLabelForPath(telaInicialPath) }, ...prev];
    });
  }, [telaInicialPath]);

  const navigateAposFecharRef = useRef<string | null>(null);
  const dragTabIndexRef = useRef<number | null>(null);
  const justDraggedRef = useRef(false);

  const reordenarAbas = useCallback((dragIndex: number, dropIndex: number) => {
    if (dragIndex === dropIndex) return;
    setAbas((prev) => {
      const next = [...prev];
      const [removed] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, removed);
      return next;
    });
  }, []);

  const fecharAba = useCallback((pathToClose: string) => {
    const pinnedPath = telaInicialPathRef.current;
    if (pinnedPath && pathToClose === pinnedPath) return;

    const pathname = location.pathname;
    setAbas((prev) => {
      const idx = prev.findIndex((a) => a.path === pathToClose);
      if (idx < 0) return prev;
      const next = prev.filter((a) => a.path !== pathToClose);
      if (next.length === 0) return prev;
      if (pathname === pathToClose) {
        const target = next[Math.min(idx, next.length - 1)];
        navigateAposFecharRef.current = target?.path ?? pinnedPath ?? '/';
      }
      return next;
    });
    setTimeout(() => {
      const p = navigateAposFecharRef.current;
      if (p) {
        navigateAposFecharRef.current = null;
        navigate(p);
      }
    }, 0);
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (!syncPanelOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (syncPanelRef.current && !syncPanelRef.current.contains(e.target as Node)) {
        setSyncPanelOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [syncPanelOpen]);

  const handleSincronizado = () => {
    window.dispatchEvent(new CustomEvent('sincronizado'));
  };

  const handleLogout = useCallback(async () => {
    try {
      await logout(login);
    } catch {
      // rede/servidor: logout() já removeu token e disparou sessão limpa
    }
    navigate('/', { replace: true });
  }, [login, navigate]);

  useAutoLogout(logoutInatividadeMinutos, login, () => {
    void handleLogout();
  });

  const handleForcarTrocaSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroSenha(null);
    if (!senhaAtual || !novaSenha || !confirmarNovaSenha) {
      setErroSenha('Preencha senha atual, nova senha e confirmação da nova senha.');
      return;
    }
    if (novaSenha !== confirmarNovaSenha) {
      setErroSenha('Confirmação da nova senha não confere.');
      return;
    }
    setSavingSenha(true);
    try {
      await changeMyPassword({ senhaAtual, novaSenha, confirmarNovaSenha });
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarNovaSenha('');
      await refreshUser();
    } catch (err) {
      setErroSenha(err instanceof Error ? err.message : 'Erro ao alterar senha.');
    } finally {
      setSavingSenha(false);
    }
  };

  return (
    <div className="h-svh min-h-0 flex bg-[var(--soaco-surface)]">
      {!modoFoco && (
        <Sidebar
          open={sidebarOpen}
          onExpand={expandSidebar}
          onCollapse={collapseSidebar}
          onNavigate={collapseSidebar}
          pathname={location.pathname}
          hasPermission={hasPermission}
          isMaster={isMaster}
          logisticaMenu={logisticaMenu}
          integracaoItems={integracaoItems}
          financeiroMenu={financeiroMenu}
          supportUnreadCount={supportUnreadCount}
        />
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header
          className={`relative z-50 shrink-0 border-b border-soaco-gray/30 bg-black backdrop-blur transition-all duration-200 ${modoFoco ? 'hidden' : ''}`}
        >
          <div className="flex w-full min-w-0 items-center gap-x-2 gap-y-1.5 px-3 py-2">
            <button
              type="button"
              onClick={toggleSidebar}
              className="rounded-lg p-2 text-white/75 transition hover:bg-white/10 hover:text-white shrink-0"
              title={sidebarPinned ? 'Liberar menu (retrai ao sair)' : 'Fixar menu aberto'}
              aria-label={sidebarPinned ? 'Liberar menu lateral' : 'Fixar menu lateral aberto'}
              aria-expanded={sidebarOpen}
              aria-pressed={sidebarPinned}
            >
              <MenuToggleIcon />
            </button>
            <div className="flex min-w-0 shrink-0 items-center gap-2">
              <LogoSoAco className="h-9 xl:h-10 w-auto min-w-[50px] max-w-[160px] xl:max-w-[200px]" />
              <h1 className="hidden shrink-0 text-base font-bold text-white sm:block xl:text-lg">
                Gestão Smart 2.0
              </h1>
            </div>
            <div className="hidden min-w-0 flex-1 justify-center px-2 md:flex">
              <BuscaRapidaTelas className="max-w-md" />
            </div>
            <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-lg p-2 text-white/75 transition hover:bg-white/10 hover:text-white"
                title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
                aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>
              {(hasPermission(PERMISSOES.COMUNICACAO_TELA_VER) || hasPermission(PERMISSOES.COMUNICACAO_TOTAL)) && (
                <button
                  type="button"
                  onClick={() => {
                    const targetPath = '/pedidos/sycroorder';
                    if (location.pathname === targetPath) {
                      window.dispatchEvent(new CustomEvent('sycroorder:openNotificacoes'));
                    } else {
                      navigate(targetPath);
                      setTimeout(() => window.dispatchEvent(new CustomEvent('sycroorder:openNotificacoes')), 350);
                    }
                  }}
                  className="relative rounded-lg p-2 text-white/75 transition hover:bg-white/10 hover:text-white"
                  title="Notificações"
                  aria-label="Notificações"
                >
                  {sycroUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                      {sycroUnreadCount}
                    </span>
                  )}
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </button>
              )}
              <span
                className="hidden max-w-[6rem] truncate text-xs text-white/80 sm:inline md:max-w-[8rem] xl:max-w-[11rem] xl:text-sm"
                title={nome ?? login ?? ''}
              >
                {nome ?? login ?? ''}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="shrink-0 whitespace-nowrap rounded-md bg-soaco-graphite px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-soaco-blue xl:text-sm"
              >
                Sair
              </button>
            </div>
          </div>
        </header>

        <main className={`flex min-h-0 w-full flex-1 flex-col px-4 ${modoFoco ? 'py-2' : 'py-6'}`}>
          {abas.length > 0 && !modoFoco && (
            <div className="scrollbar-app mb-4 flex shrink-0 items-center gap-1 overflow-x-auto border-b border-soaco-gray/30 dark:border-soaco-gray/40">
              {abas.map((aba, index) => {
                const ativa = location.pathname === aba.path;
                const isPinned = !!telaInicialPath && aba.path === telaInicialPath;
                return (
                  <div
                    key={aba.id}
                    draggable={!isPinned}
                    onDragStart={(e) => {
                      if (isPinned) { e.preventDefault(); return; }
                      const target = e.target as HTMLElement;
                      if (target.closest('button[aria-label="Fechar aba"]')) {
                        e.preventDefault();
                        return;
                      }
                      dragTabIndexRef.current = index;
                      e.dataTransfer.setData('text/plain', String(index));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const dragIndex = dragTabIndexRef.current;
                      if (dragIndex == null) return;
                      reordenarAbas(dragIndex, index);
                      dragTabIndexRef.current = null;
                      justDraggedRef.current = true;
                      setTimeout(() => { justDraggedRef.current = false; }, 100);
                    }}
                    onDragEnd={() => {
                      dragTabIndexRef.current = null;
                    }}
                    className={`mb-[-1px] flex shrink-0 cursor-grab items-center gap-1 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition active:cursor-grabbing ${
                      ativa
                        ? 'border-accent-500 bg-white text-primary-600 dark:bg-soaco-graphite dark:text-accent-400'
                        : 'border-transparent text-soaco-gray hover:bg-slate-100 hover:text-soaco-navy dark:text-white/60 dark:hover:bg-soaco-navy/30 dark:hover:text-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (justDraggedRef.current) return;
                        navigate(aba.path);
                      }}
                      className="inline-flex max-w-[200px] items-center gap-1 truncate text-left"
                      title={isPinned ? `${aba.label} (aba fixa)` : aba.label}
                      aria-label={aba.label}
                    >
                      {isPinned && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="shrink-0 opacity-60">
                          <path d="M16 12V4h1a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/>
                        </svg>
                      )}
                      {aba.label}
                    </button>
                    {!isPinned && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fecharAba(aba.path);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600"
                        aria-label="Fechar aba"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div
            className={`scrollbar-app flex min-h-0 flex-1 flex-col overflow-x-hidden ${
              modoFoco ? 'overflow-y-hidden' : 'overflow-y-auto'
            }`}
          >
            <PermissionGuard>
              <AbaKeepAliveOutlet abaPaths={abas.map((a) => a.path)} />
            </PermissionGuard>
          </div>
        </main>
      </div>

      {mustChangePassword && (
        <div className="fixed inset-0 z-[16000] flex items-center justify-center bg-black/75 p-4">
          <div className="card-panel w-full max-w-md p-6 shadow-soaco-lg">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Troca obrigatória de senha</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Para continuar, confirme sua senha atual e defina uma nova senha.
            </p>
            <form onSubmit={handleForcarTrocaSenha} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Senha atual</label>
                <input
                  type="password"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Nova senha</label>
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Confirmação da nova senha</label>
                <input
                  type="password"
                  value={confirmarNovaSenha}
                  onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              {erroSenha && <p className="text-sm text-amber-600 dark:text-amber-400">{erroSenha}</p>}
              <button
                type="submit"
                disabled={savingSenha}
                className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {savingSenha ? 'Salvando...' : 'Alterar senha'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div ref={syncPanelRef} className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
        {syncPanelOpen && (
          <div className="card-panel relative mb-2 w-80 border-accent-500/30 p-4 shadow-soaco-lg">
            <button
              type="button"
              onClick={() => setSyncPanelOpen(false)}
              className="absolute right-3 top-3 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              aria-label="Fechar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
            <StatusCard onSincronizado={handleSincronizado} />
          </div>
        )}
        <button
          type="button"
          onClick={() => setSyncPanelOpen((v) => !v)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg transition ${
            syncPanelOpen
              ? 'bg-primary-600 text-white'
              : 'border-2 border-accent-500/60 bg-white text-soaco-navy hover:border-accent-500 hover:bg-slate-50 dark:bg-soaco-graphite dark:text-soaco-white dark:hover:bg-soaco-navy/50'
          }`}
          title="Conexão com API / ERP e sincronização"
          aria-expanded={syncPanelOpen}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
          Conexão API / ERP
        </button>
      </div>
    </div>
  );
}
