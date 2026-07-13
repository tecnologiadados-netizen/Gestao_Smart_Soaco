import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@rh/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rh/components/ui/tabs";
import { Badge } from "@rh/components/ui/badge";
import FaltasAusenciasTab from "@rh/pages/FaltasAtestados/FaltasAusenciasTab";
import FaltasCadastrosTab from "@rh/pages/FaltasAtestados/FaltasCadastrosTab";
import FaltasRegrasAlertasTab from "@rh/pages/FaltasAtestados/FaltasRegrasAlertasTab";
import SancoesDisciplinaresTab from "@rh/pages/FaltasAtestados/SancoesDisciplinaresTab";
import {
  readFaltasAtestadosTab,
  writeFaltasAtestadosTab,
  type FaltasAtestadosTabId,
} from "@rh/pages/FaltasAtestados/faltas-ui-filters-persistence";
import {
  FALTAS_ALERTAS_CHANGED_EVENT,
  getFaltasAusenciaInconsistenciasSincronizadas,
} from "@rh/lib/ausencia-inconsistencias/faltas-alerta-storage";
import {
  canEditFaltasAusencias,
  canEditFaltasCadastros,
  canEditFaltasRegrasAlertas,
  canEditFaltasSancoes,
  canEditFaltasTiposRegras,
  canViewFaltasTab,
  canViewFaltasTiposRegras,
} from "@rh/lib/route-permissions";
import { getFaltasAtestados } from "@rh/lib/api-client";

const FaltasAtestados = () => {
  const tabs = [
    canViewFaltasTab("ausencias") ? { id: "ausencias" as const, label: "Ausências" } : null,
    canViewFaltasTab("sancoes") ? { id: "sancoes" as const, label: "Sanções disciplinares" } : null,
    canViewFaltasTab("cadastros") ? { id: "cadastros" as const, label: "Cadastros" } : null,
    canViewFaltasTab("regras-alertas") ? { id: "regras-alertas" as const, label: "Regras de alertas" } : null,
  ].filter(Boolean) as Array<{ id: FaltasAtestadosTabId; label: string }>;

  const defaultTab = tabs[0]?.id ?? "ausencias";
  const allowedTabIds = tabs.map((tab) => tab.id);
  const [activeTab, setActiveTab] = useState<FaltasAtestadosTabId>(() => {
    const saved = readFaltasAtestadosTab();
    if (saved === "inconsistencias") return "regras-alertas";
    if (saved && allowedTabIds.includes(saved)) return saved;
    return defaultTab;
  });
  const [highlightInconsistenciaId, setHighlightInconsistenciaId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: inconsistencias = [] } = useQuery({
    queryKey: ["faltas-ausencia-inconsistencias"],
    queryFn: async () => {
      const faltas = await getFaltasAtestados();
      return getFaltasAusenciaInconsistenciasSincronizadas(faltas);
    },
  });

  const pendentesCount = inconsistencias.filter(
    (i) => i.status === "pendente" || i.status === "em_analise",
  ).length;

  useEffect(() => {
    writeFaltasAtestadosTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    const handler = async () => {
      const { getFaltasAusenciaInconsistencias } = await import(
        "@rh/lib/ausencia-inconsistencias/faltas-alerta-storage"
      );
      const rows = await getFaltasAusenciaInconsistencias();
      queryClient.setQueryData(["faltas-ausencia-inconsistencias"], rows);
      void queryClient.invalidateQueries({ queryKey: ["faltas-alerta-enquadramentos"] });
    };
    window.addEventListener(FALTAS_ALERTAS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(FALTAS_ALERTAS_CHANGED_EVENT, handler);
  }, [queryClient]);

  const navigateToRegrasAlertas = () => {
    if (allowedTabIds.includes("regras-alertas")) {
      setActiveTab("regras-alertas");
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Faltas e Atestados</h1>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FaltasAtestadosTabId)} className="space-y-4">
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5">
                {tab.label}
                {tab.id === "regras-alertas" && pendentesCount > 0 ? (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[10px]">
                    {pendentesCount}
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
          {canViewFaltasTab("ausencias") ? (
            <TabsContent value="ausencias" keepMounted className="mt-0 focus-visible:outline-none">
              <FaltasAusenciasTab
                canEdit={canEditFaltasAusencias()}
                onNavigateToRegrasAlertas={navigateToRegrasAlertas}
              />
            </TabsContent>
          ) : null}
          {canViewFaltasTab("regras-alertas") ? (
            <TabsContent value="regras-alertas" keepMounted className="mt-0 focus-visible:outline-none">
              <FaltasRegrasAlertasTab
                canEdit={canEditFaltasRegrasAlertas()}
                highlightInconsistenciaId={highlightInconsistenciaId}
              />
            </TabsContent>
          ) : null}
          {canViewFaltasTab("sancoes") ? (
            <TabsContent value="sancoes" keepMounted className="mt-0 focus-visible:outline-none">
              <SancoesDisciplinaresTab canEdit={canEditFaltasSancoes()} />
            </TabsContent>
          ) : null}
          {canViewFaltasTab("cadastros") ? (
            <TabsContent value="cadastros" keepMounted className="mt-0 focus-visible:outline-none">
              <FaltasCadastrosTab
                canEdit={canEditFaltasCadastros()}
                canViewTiposRegras={canViewFaltasTiposRegras()}
                canEditTiposRegras={canEditFaltasTiposRegras()}
              />
            </TabsContent>
          ) : null}
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default FaltasAtestados;
