"use client";

import { useEffect, useState } from "react";
import { useAvaliacaoFornecedorStore } from "@/lib/store/avaliacao-fornecedor-store";
import { useRegistrosStore } from "@/lib/store/registros-store";
import { useCalibrationsStore } from "@/lib/store/calibrations-store";
import { useConfigStore } from "@/lib/store/config-store";
import { useDocumentsStore } from "@/lib/store/documents-store";

async function rehydrateAllStores() {
  await Promise.all([
    useConfigStore.persist.rehydrate(),
    useDocumentsStore.persist.rehydrate(),
    useCalibrationsStore.persist.rehydrate(),
    useAvaliacaoFornecedorStore.persist.rehydrate(),
    useRegistrosStore.persist.rehydrate(),
  ]);
}

export function StoreHydration({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fallback = window.setTimeout(() => {
      if (!cancelled) setHydrated(true);
    }, 5000);

    void rehydrateAllStores()
      .then(() => {
        if (cancelled) return;
        useDocumentsStore.getState().syncValidadeAlertas();
        useAvaliacaoFornecedorStore.getState().mesclarHistoricoErp();
        useRegistrosStore.getState().mesclarHistoricoNomus();
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      })
      .finally(() => {
        window.clearTimeout(fallback);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return <>{children}</>;
}
