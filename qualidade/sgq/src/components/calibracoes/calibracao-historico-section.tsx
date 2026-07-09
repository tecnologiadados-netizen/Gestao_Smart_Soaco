"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  CalibracaoArquivoActions,
  CalibracaoVersaoAnexosList,
} from "@/components/calibracoes/calibracao-versao-arquivos";
import { useCalibrationsStore } from "@/lib/store/calibrations-store";
import { useConfigStore } from "@/lib/store/config-store";
import {
  calcularDueStatus,
  calcularProximaData,
  formatarData,
} from "@/lib/utils/dates";
import {
  dueStatusLabels,
  getDueStatusVariant,
} from "@/lib/utils/status-labels";
import { cn } from "@/lib/utils";
import type { Equipment } from "@/types/calibration";

interface CalibracaoHistoricoSectionProps {
  equipment: Equipment;
}

export function CalibracaoHistoricoSection({
  equipment,
}: CalibracaoHistoricoSectionProps) {
  const calibrationRecords = useCalibrationsStore((s) => s.calibrationRecords);
  const users = useConfigStore((s) => s.users);

  const historico = useMemo(
    () =>
      calibrationRecords
        .filter((record) => record.equipmentId === equipment.id)
        .sort((a, b) => b.versao.localeCompare(a.versao)),
    [calibrationRecords, equipment.id]
  );

  const proximaCalibracao =
    equipment.proximaCalibracao ??
    calcularProximaData(
      equipment.ultimaCalibracao,
      equipment.frequenciaCalibracaoDias
    );
  const statusCalibracao = calcularDueStatus(proximaCalibracao);
  const versaoAtual = equipment.versaoLaudoAtual ?? "—";

  return (
    <fieldset className="brand-fieldset space-y-3">
      <legend>Histórico de calibrações</legend>

      {equipment.laudoNome ? (
        <div className="rounded-lg border border-brand-blue/30 bg-brand-blue-light/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-brand-navy">
                Versão {versaoAtual}
              </span>
              <Badge
                variant="outline"
                className="border-brand-blue/40 text-brand-blue"
              >
                Atual
              </Badge>
              <Badge variant={getDueStatusVariant(statusCalibracao)}>
                {dueStatusLabels[statusCalibracao]}
              </Badge>
            </div>
            {equipment.laudoDataUrl ? (
              <CalibracaoArquivoActions
                dataUrl={equipment.laudoDataUrl}
                nome={equipment.laudoNome}
              />
            ) : null}
          </div>
          <p className="mt-2 break-all text-sm font-medium">
            {equipment.laudoNome}
          </p>
          {equipment.ultimaCalibracao ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Calibrado em {formatarData(equipment.ultimaCalibracao)}
            </p>
          ) : null}
          {equipment.laudoAnexos?.length ? (
            <CalibracaoVersaoAnexosList anexos={equipment.laudoAnexos} />
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhum laudo vigente registrado.
        </p>
      )}

      {historico.length > 0 ? (
        <ul className="space-y-3">
          {historico.map((reg) => {
            const responsavel = users.find((user) => user.id === reg.responsavelId);
            return (
              <li
                key={reg.id}
                className={cn(
                  "rounded-lg border border-border/80 bg-muted/20 p-4 text-sm"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-brand-navy">
                    Versão {reg.versao}
                  </span>
                  {reg.laudoDataUrl && reg.laudoNome ? (
                    <CalibracaoArquivoActions
                      dataUrl={reg.laudoDataUrl}
                      nome={reg.laudoNome}
                    />
                  ) : null}
                </div>
                {reg.laudoNome ? (
                  <p className="mt-2 break-all font-medium">{reg.laudoNome}</p>
                ) : null}
                <p className="mt-1 text-muted-foreground">
                  Calibrado em {formatarData(reg.data)}
                  {responsavel ? ` · ${responsavel.nome}` : ""}
                </p>
                <p className="text-xs capitalize text-muted-foreground">
                  {reg.tipo} · {reg.resultado}
                  {reg.laboratorio ? ` · ${reg.laboratorio}` : ""}
                </p>
                {reg.anexos?.length ? (
                  <CalibracaoVersaoAnexosList anexos={reg.anexos} />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhuma versão anterior arquivada.
        </p>
      )}
    </fieldset>
  );
}
