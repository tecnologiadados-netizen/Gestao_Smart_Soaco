import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  hydrateQualidadeFromServer,
  isQualidadeStoreHydratedForLogin,
  markQualidadeStoreHydrated,
  startQualidadeAutoSync,
} from '@qualidade/lib/qualidadePersistence';
import { LoadingOverlay } from '@qualidade/components/ui/loading-overlay';

const HYDRATE_TIMEOUT_MS = 45_000;

/**
 * Hidrata o Qualiteam uma vez por sessão/login.
 * Remounts (troca de guia, voltar do viewer, navigate após enviar) NÃO
 * mostram de novo a tela preta nem sobrescrevem o estado local com
 * snapshot antigo do servidor (corrida com flush em andamento).
 */
export function StoreHydration({ children }: { children: React.ReactNode }) {
  const { login, profileLoaded } = useAuth();
  const [hydrated, setHydrated] = useState(
    () => Boolean(login && isQualidadeStoreHydratedForLogin(login))
  );
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!profileLoaded || !login) return;

    startQualidadeAutoSync();

    if (isQualidadeStoreHydratedForLogin(login)) {
      setHydrated(true);
      setErro(null);
      return;
    }

    let cancelled = false;
    setHydrated(false);
    setErro(null);

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
          markQualidadeStoreHydrated(login);
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
              markQualidadeStoreHydrated(null);
              void hydrateQualidadeFromServer(login)
                .then(() => {
                  markQualidadeStoreHydrated(login);
                  setHydrated(true);
                })
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
      <LoadingOverlay open message="Carregando módulo Qualidade..." />
    );
  }

  return <>{children}</>;
}
