import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  hydrateQualidadeFromServer,
  startQualidadeAutoSync,
} from '@qualidade/lib/qualidadePersistence';

export function StoreHydration({ children }: { children: React.ReactNode }) {
  const { login, profileLoaded } = useAuth();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!profileLoaded || !login) return;

    startQualidadeAutoSync();

    let cancelled = false;
    const fallback = window.setTimeout(() => {
      if (!cancelled) setHydrated(true);
    }, 8000);

    void hydrateQualidadeFromServer(login)
      .then(() => {
        if (!cancelled) setHydrated(true);
      })
      .catch((err) => {
        console.error('[qualidade] falha ao carregar dados:', err);
        if (!cancelled) setHydrated(true);
      })
      .finally(() => {
        window.clearTimeout(fallback);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
  }, [login, profileLoaded]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Carregando módulo Qualidade...</p>
      </div>
    );
  }

  return <>{children}</>;
}
