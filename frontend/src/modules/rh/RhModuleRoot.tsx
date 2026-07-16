import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster as Sonner } from '@rh/components/ui/sonner';
import { Toaster } from '@rh/components/ui/toaster';
import { TooltipProvider } from '@rh/components/ui/tooltip';
import { SavingOverlayProvider } from '@rh/contexts/saving-overlay-context';
import { useAuth } from '@/contexts/AuthContext';
import { loadRhSessionPermissions, setSessionAuthenticated } from '@rh/lib/auth';
import { rhQueryClient } from '@rh/lib/query-client';
import '@rh/rh-module.css';

export default function RhModuleRoot() {
  const { isMaster, login, profileLoaded } = useAuth();
  // As permissões do RH são carregadas de forma assíncrona no cache do módulo. O gate de
  // rota (ProtectedRoute) as lê de forma síncrona; por isso só renderizamos as rotas depois
  // que o carregamento terminou — do contrário o gate redirecionaria para "sem-acesso" antes
  // do cache existir (e não haveria re-render quando ele chegasse).
  const [permsReady, setPermsReady] = useState(false);

  useEffect(() => {
    if (!profileLoaded) return;
    let cancelled = false;
    // Sessão garantida pelo app principal (cookie e/ou token) — reflete antes de carregar,
    // pois o gate de rota do RH lê isAuthenticated() de forma síncrona.
    setSessionAuthenticated(!!login);
    setPermsReady(false);
    void loadRhSessionPermissions(isMaster, login).finally(() => {
      if (!cancelled) setPermsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isMaster, login, profileLoaded]);

  const ready = profileLoaded && permsReady;

  return (
    <QueryClientProvider client={rhQueryClient}>
      <SavingOverlayProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <div className="rh-module min-h-0 flex flex-1 flex-col overflow-auto">
            {ready ? (
              <Outlet />
            ) : (
              <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
                Carregando módulo de RH...
              </div>
            )}
          </div>
        </TooltipProvider>
      </SavingOverlayProvider>
    </QueryClientProvider>
  );
}
