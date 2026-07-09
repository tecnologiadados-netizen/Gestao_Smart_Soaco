"use client";

import { useState } from "react";
import { ArrowRight, Building2, CheckCircle2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EquipamentoCalibracaoFluxoDialog } from "@/components/calibracoes/equipamento-calibracao-fluxo-dialog";
import { formatarData } from "@/lib/utils/dates";
import {
  dueStatusLabels,
  getDueStatusVariant,
} from "@/lib/utils/status-labels";
import type { EquipmentWithDue } from "@/types/calibration";

interface CalibracoesKanbanColumnProps {
  titulo: string;
  descricao: string;
  icon: typeof Wrench;
  items: EquipmentWithDue[];
  emptyMessage: string;
  accent: "primary" | "warning";
  onRegistrarCalibracao: (equipmentId: string) => void;
}

function CalibracoesKanbanColumn({
  titulo,
  descricao,
  icon: Icon,
  items,
  emptyMessage,
  accent,
  onRegistrarCalibracao,
}: CalibracoesKanbanColumnProps) {
  return (
    <section
      className={cn(
        "sgq-kanban-column",
        accent === "primary"
          ? "sgq-kanban-column--primary"
          : "sgq-kanban-column--warning"
      )}
    >
      <header className="sgq-kanban-header">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="sgq-kanban-icon">
              <Icon className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
              <p className="text-xs text-muted-foreground">{descricao}</p>
            </div>
          </div>
          <Badge variant={items.length > 0 ? "warning" : "secondary"}>
            {items.length}
          </Badge>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {items.length === 0 ? (
          <div className="sgq-kanban-empty">
            <CheckCircle2 className="mb-3 size-8 text-primary/60" />
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          items.map((eq) => (
            <article
              key={eq.id}
              className="rounded-lg border border-border bg-muted/30 p-4 shadow-sm transition-shadow hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-foreground">
                    {eq.codigo}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {eq.descricao}
                  </p>
                  {eq.local ? (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {eq.local}
                    </p>
                  ) : null}
                  {eq.proximaCalibracao ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Próxima: {formatarData(eq.proximaCalibracao)}
                    </p>
                  ) : null}
                </div>
                <Badge
                  variant={getDueStatusVariant(eq.statusCalibracao)}
                  className="shrink-0 text-[10px]"
                >
                  {dueStatusLabels[eq.statusCalibracao]}
                </Badge>
              </div>
              <div className="mt-4">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => onRegistrarCalibracao(eq.id)}
                >
                  Registrar calibração
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

interface Props {
  internas: EquipmentWithDue[];
  externas: EquipmentWithDue[];
}

export function CalibracoesPendenciasBoards({ internas, externas }: Props) {
  const [equipamentoFluxoId, setEquipamentoFluxoId] = useState<string | null>(
    null
  );
  const semPendencias = internas.length === 0 && externas.length === 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-2">
        <CalibracoesKanbanColumn
          titulo="Calibrações pendentes (Interna)"
          descricao="Equipamentos com calibração interna vencida ou próxima"
          icon={Wrench}
          items={internas}
          emptyMessage="Você não possui calibrações internas pendentes."
          accent="primary"
          onRegistrarCalibracao={setEquipamentoFluxoId}
        />
        <CalibracoesKanbanColumn
          titulo="Calibrações pendentes (Externa)"
          descricao="Equipamentos com calibração externa vencida ou próxima"
          icon={Building2}
          items={externas}
          emptyMessage="Você não possui calibrações externas pendentes."
          accent="warning"
          onRegistrarCalibracao={setEquipamentoFluxoId}
        />
      </div>

      {semPendencias ? (
        <p className="text-center text-xs text-muted-foreground">
          Todos os equipamentos estão em dia. Consulte a base completa na tela de
          consulta.
        </p>
      ) : null}

      <EquipamentoCalibracaoFluxoDialog
        equipmentId={equipamentoFluxoId}
        open={equipamentoFluxoId !== null}
        onOpenChange={(open) => {
          if (!open) setEquipamentoFluxoId(null);
        }}
      />
    </div>
  );
}
