import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@qualidade/components/ui/badge";
import { CalibracaoVersaoAnexosList } from "@qualidade/components/calibracoes/calibracao-versao-arquivos";
import { useCalibrationsStore } from "@qualidade/lib/store/calibrations-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import {
  calcularDueStatus,
  calcularProximaData,
  formatarData,
} from "@qualidade/lib/utils/dates";
import {
  dueStatusLabels,
  getDueStatusVariant,
} from "@qualidade/lib/utils/status-labels";
import { cn } from "@qualidade/lib/utils";
import type { Equipment, EquipmentAnexo } from "@qualidade/types/calibration";

function arquivosDaVersao(
  laudoNome?: string,
  laudoDataUrl?: string,
  laudoStoragePath?: string,
  anexos?: EquipmentAnexo[]
): EquipmentAnexo[] {
  const principal = laudoNome?.trim()
    ? [
        {
          nome: laudoNome.trim(),
          dataUrl: laudoDataUrl ?? "",
          ...(laudoStoragePath ? { storagePath: laudoStoragePath } : {}),
        },
      ]
    : [];
  const extras = (anexos ?? []).filter(
    (anexo) => anexo.nome.trim() && anexo.nome.trim() !== laudoNome?.trim()
  );
  return [...principal, ...extras];
}

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

  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  function alternar(id: string, abertoPadrao: boolean) {
    setAbertos((atual) => ({
      ...atual,
      [id]: !(atual[id] ?? abertoPadrao),
    }));
  }

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
        <article className="overflow-hidden rounded-lg border border-brand-blue/30 bg-brand-blue-light/20">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            aria-expanded={abertos.atual ?? true}
            onClick={() => alternar("atual", true)}
          >
            <span className="flex min-w-0 flex-wrap items-center gap-2">
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
              {equipment.ultimaCalibracao ? (
                <span className="text-xs text-muted-foreground">
                  {formatarData(equipment.ultimaCalibracao)}
                </span>
              ) : null}
            </span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                (abertos.atual ?? true) && "rotate-180"
              )}
            />
          </button>
          {(abertos.atual ?? true) ? (
            <div className="border-t border-brand-blue/20 px-4 py-3">
              <CalibracaoVersaoAnexosList
                anexos={arquivosDaVersao(
                  equipment.laudoNome,
                  equipment.laudoDataUrl,
                  equipment.laudoStoragePath,
                  equipment.laudoAnexos
                )}
              />
            </div>
          ) : null}
        </article>
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
                className="overflow-hidden rounded-lg border border-border/80 bg-muted/20 text-sm"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  aria-expanded={abertos[reg.id] ?? false}
                  onClick={() => alternar(reg.id, false)}
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="font-semibold text-brand-navy">
                      Versão {reg.versao}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatarData(reg.data)}
                      {responsavel ? ` · ${responsavel.nome}` : ""}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      abertos[reg.id] && "rotate-180"
                    )}
                  />
                </button>
                {abertos[reg.id] ? (
                  <div className="border-t border-border/70 px-4 py-3">
                    <p className="mb-2 text-xs capitalize text-muted-foreground">
                      {reg.tipo} · {reg.resultado}
                      {reg.laboratorio ? ` · ${reg.laboratorio}` : ""}
                    </p>
                    <CalibracaoVersaoAnexosList
                      anexos={arquivosDaVersao(
                        reg.laudoNome,
                        reg.laudoDataUrl,
                        reg.laudoStoragePath,
                        reg.anexos
                      )}
                    />
                  </div>
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
