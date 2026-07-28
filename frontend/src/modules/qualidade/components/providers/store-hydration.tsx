import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  hydrateQualidadeFromServer,
  startQualidadeAutoSync,
} from '@qualidade/lib/qualidadePersistence';

const HYDRATE_TIMEOUT_MS = 45_000;

export function StoreHydration({ children }: { children: React.ReactNode }) {
  const { login, profileLoaded } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!profileLoaded || !login) return;

    startQualidadeAutoSync();

    let cancelled = false;
    setHydrated(false);
    setErro(null);

    // Não liberar a UI por timeout com estado incompleto (isso + auto-sync apagava dados).
    // Em hang real do bootstrap, mostra erro com retry — sem marcar hydrated.
    const hangTimer = window.setTimeout(() => {
      if (!cancelled) {
        setErro(
          'O carregamento do módulo Qualidade está demorando demais. Verifique a rede e tente novamente.'
        );
        setHydrated(false);
      }
    }, HYDRATE_TIMEOUT_MS);

    void hydrateQualidadeFromServer(login)
      .then(() => {
        if (!cancelled) {
          setErro(null);
          setHydrated(true);
        }
      })
      .catch((err) => {
        console.error('[qualidade] falha ao carregar dados:', err);
        if (!cancelled) {
          setErro(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar o módulo Qualidade.'
          );
          setHydrated(false);
        }
      })
      .finally(() => {
        window.clearTimeout(hangTimer);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(hangTimer);
    };
  }, [login, profileLoaded]);

  if (erro) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-muted/30 px-4">
        <p className="text-sm text-destructive">{erro}</p>
        <button
          type="button"
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          onClick={() => {
            setErro(null);
            setHydrated(false);
            if (login) {
              void hydrateQualidadeFromServer(login)
                .then(() => setHydrated(true))
                .catch((err) =>
                  setErro(
                    err instanceof Error
                      ? err.message
                      : 'Não foi possível carregar o módulo Qualidade.'
                  )
                );
            }
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Carregando módulo Qualidade...</p>
      </div>
    );
  }

  return <>{children}</>;
}
