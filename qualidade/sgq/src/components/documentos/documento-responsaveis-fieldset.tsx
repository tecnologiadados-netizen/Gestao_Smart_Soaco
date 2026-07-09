"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { User } from "@/types/user";
import type { DocumentWorkflowPrazos } from "@/types/document";
import { cn } from "@/lib/utils";
import { userSelectLabel } from "@/lib/utils/select-display";

export const DEFAULT_STAGE_DAYS = 7;

export interface ResponsaveisFormValues {
  elaboradorId: string;
  consensoId: string;
  aprovadorId: string;
  prazos: DocumentWorkflowPrazos;
}

export const defaultResponsaveisValues = (
  elaboradorId: string
): ResponsaveisFormValues => ({
  elaboradorId,
  consensoId: "",
  aprovadorId: "",
  prazos: {
    elaboracao: DEFAULT_STAGE_DAYS,
    consenso: DEFAULT_STAGE_DAYS,
    aprovacao: DEFAULT_STAGE_DAYS,
  },
});

const selectTriggerClass =
  "h-10 w-full min-w-0 *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal";

const selectContentClass = "min-w-[var(--anchor-width)] w-max max-w-md";

const selectItemClass = "py-2.5 whitespace-normal text-base leading-snug";

const stages = [
  {
    key: "elaborador" as const,
    responsavelKey: "elaboradorId" as const,
    prazoKey: "elaboracao" as const,
    label: "Elaborador",
  },
  {
    key: "consenso" as const,
    responsavelKey: "consensoId" as const,
    prazoKey: "consenso" as const,
    label: "Consenso",
  },
  {
    key: "aprovador" as const,
    responsavelKey: "aprovadorId" as const,
    prazoKey: "aprovacao" as const,
    label: "Aprovador",
  },
];

interface Props {
  users: User[];
  values: ResponsaveisFormValues;
  onChange: (values: ResponsaveisFormValues) => void;
  /** Completo: elaborador, consenso e aprovador. Responsável: apenas elaborador. */
  modo?: "completo" | "responsavel";
}

export function DocumentoResponsaveisFieldset({
  users,
  values,
  onChange,
  modo = "completo",
}: Props) {
  const activeUsers = users.filter((u) => u.ativo);
  const visibleStages =
    modo === "responsavel" ? stages.filter((s) => s.key === "elaborador") : stages;

  function updateResponsavel(
    key: keyof Pick<
      ResponsaveisFormValues,
      "elaboradorId" | "consensoId" | "aprovadorId"
    >,
    id: string
  ) {
    onChange({ ...values, [key]: id });
  }

  function updatePrazo(key: keyof DocumentWorkflowPrazos, raw: string) {
    const parsed = parseInt(raw, 10);
    const days = Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
    onChange({
      ...values,
      prazos: { ...values.prazos, [key]: days },
    });
  }

  return (
    <fieldset className="brand-fieldset space-y-4">
      <legend className="text-base">
        {modo === "responsavel" ? "Responsável" : "Responsáveis"}
      </legend>
      <div
        className={cn(
          "grid gap-4",
          modo === "responsavel"
            ? "mx-auto w-full max-w-md grid-cols-1"
            : "lg:grid-cols-3"
        )}
      >
        {visibleStages.map((stage) => {
          const responsavelId = values[stage.responsavelKey];
          const responsavelNome = userSelectLabel(activeUsers, responsavelId);

          return (
            <div
              key={stage.key}
              className="space-y-3 rounded-lg border border-brand-blue-muted/60 bg-background/80 p-3"
            >
              <p className="text-sm font-semibold text-brand-blue">
                {stage.label}
              </p>
              <div className="space-y-2">
                <Label className="text-sm">Responsável</Label>
                <Select
                  value={responsavelId}
                  onValueChange={(v) =>
                    v && updateResponsavel(stage.responsavelKey, v)
                  }
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Selecione">
                      {responsavelNome ?? null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {activeUsers.map((u) => (
                      <SelectItem
                        key={u.id}
                        value={u.id}
                        className={selectItemClass}
                      >
                        {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Prazo (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  value={values.prazos[stage.prazoKey]}
                  onChange={(e) => updatePrazo(stage.prazoKey, e.target.value)}
                  className="h-10 text-base"
                />
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export function formatWorkflowObservacoes(
  prazos: DocumentWorkflowPrazos
): string {
  return `Prazos — Elaboração: ${prazos.elaboracao} dias · Consenso: ${prazos.consenso} dias · Aprovação: ${prazos.aprovacao} dias`;
}
