import { useMemo } from "react";
import { Badge } from "@qualidade/components/ui/badge";
import { SgqArquivoAcoes } from "@qualidade/components/documentos/sgq-arquivo-imprimir-btn";
import { useCalibrationsStore } from "@qualidade/lib/store/calibrations-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import {
  formatRevision,
  INITIAL_REVISION,
} from "@qualidade/lib/documents/revision";
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

function separarLaudoEComplementares(
  laudoNome?: string,
  laudoDataUrl?: string,
  laudoStoragePath?: string,
  anexos?: EquipmentAnexo[]
): { laudo?: EquipmentAnexo; complementares: EquipmentAnexo[] } {
  const nomeLaudo = laudoNome?.trim();
  const laudo = nomeLaudo
    ? {
        nome: nomeLaudo,
        dataUrl: laudoDataUrl ?? "",
        ...(laudoStoragePath ? { storagePath: laudoStoragePath } : {}),
      }
    : undefined;
  const complementares = (anexos ?? []).filter(
    (anexo) =>
      anexo.nome.trim() &&
      anexo.nome.trim() !== nomeLaudo &&
      anexo.storagePath !== laudoStoragePath
  );
  return { laudo, complementares };
}

interface CalibracaoHistoricoSectionProps {
  equipment: Equipment;
}

type LinhaHistorico = {
  key: string;
  versao: string;
  atual: boolean;
  data?: string;
  responsavel?: string;
  tipo?: string;
  resultado?: string;
  laboratorio?: string;
  statusVencimento?: ReturnType<typeof calcularDueStatus>;
  laudo?: EquipmentAnexo;
  complementares: EquipmentAnexo[];
};

function ArquivoLinha({ anexo }: { anexo: EquipmentAnexo }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
      <span
        className="min-w-0 flex-1 truncate text-sm font-medium text-foreground"
        title={anexo.nome}
      >
        {anexo.nome}
      </span>
      <SgqArquivoAcoes
        arquivo={{
          nome: anexo.nome,
          dataUrl: anexo.dataUrl,
          storagePath: anexo.storagePath,
        }}
        variant="ghost"
        size="sm"
        className="h-8 shrink-0 gap-1 text-xs text-brand-blue"
        labeled
      />
    </div>
  );
}

function CampoResumo({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn("mt-0.5 truncate text-sm text-foreground", className)}
        title={value}
      >
        {value}
      </p>
    </div>
  );
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
  const versaoAtual = equipment.versaoLaudoAtual?.trim()
    ? formatRevision(equipment.versaoLaudoAtual)
    : equipment.laudoNome?.trim()
      ? INITIAL_REVISION
      : "—";

  const linhas = useMemo((): LinhaHistorico[] => {
    const rows: LinhaHistorico[] = [];
    if (equipment.laudoNome) {
      rows.push({
        key: "atual",
        versao: versaoAtual,
        atual: true,
        data: equipment.ultimaCalibracao,
        responsavel: users.find((u) => u.id === equipment.responsavelId)?.nome,
        tipo: equipment.tipoCalibracao,
        statusVencimento: statusCalibracao,
        ...separarLaudoEComplementares(
          equipment.laudoNome,
          equipment.laudoDataUrl,
          equipment.laudoStoragePath,
          equipment.laudoAnexos
        ),
      });
    }
    for (const reg of historico) {
      rows.push({
        key: reg.id,
        versao: formatRevision(reg.versao),
        atual: false,
        data: reg.data,
        responsavel: users.find((u) => u.id === reg.responsavelId)?.nome,
        tipo: reg.tipo,
        resultado: reg.resultado,
        laboratorio: reg.laboratorio,
        ...separarLaudoEComplementares(
          reg.laudoNome,
          reg.laudoDataUrl,
          reg.laudoStoragePath,
          reg.anexos
        ),
      });
    }
    return rows;
  }, [
    equipment.laudoAnexos,
    equipment.laudoDataUrl,
    equipment.laudoNome,
    equipment.laudoStoragePath,
    equipment.responsavelId,
    equipment.tipoCalibracao,
    equipment.ultimaCalibracao,
    historico,
    statusCalibracao,
    users,
    versaoAtual,
  ]);

  return (
    <fieldset className="brand-fieldset space-y-3">
      <legend>Histórico de calibrações</legend>

      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum laudo vigente nem versão anterior registrada.
        </p>
      ) : (
        <ul className="min-w-0 space-y-3">
          {linhas.map((linha) => {
            const tipoResultado = [linha.tipo, linha.resultado, linha.laboratorio]
              .filter(Boolean)
              .join(" · ");
            return (
              <li
                key={linha.key}
                className={cn(
                  "min-w-0 overflow-hidden rounded-lg border border-border bg-card",
                  linha.atual && "ring-1 ring-brand-blue/30"
                )}
              >
                <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/30 px-3 py-2.5">
                  <span className="text-sm font-semibold text-foreground">
                    Versão {linha.versao}
                  </span>
                  {linha.atual ? (
                    <Badge
                      variant="outline"
                      className="border-brand-blue/40 text-brand-blue"
                    >
                      Atual
                    </Badge>
                  ) : null}
                  {linha.statusVencimento ? (
                    <Badge variant={getDueStatusVariant(linha.statusVencimento)}>
                      {dueStatusLabels[linha.statusVencimento]}
                    </Badge>
                  ) : null}
                </div>

                <div className="grid gap-3 border-b border-border/70 px-3 py-3 sm:grid-cols-3">
                  <CampoResumo
                    label="Data"
                    value={linha.data ? formatarData(linha.data) : "—"}
                  />
                  <CampoResumo
                    label="Responsável"
                    value={linha.responsavel || "—"}
                  />
                  <CampoResumo
                    label="Tipo / resultado"
                    value={tipoResultado || "—"}
                    className="capitalize"
                  />
                </div>

                <div className="space-y-3 p-3">
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Laudo
                    </p>
                    {linha.laudo ? (
                      <ArquivoLinha anexo={linha.laudo} />
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Complementares
                    </p>
                    {linha.complementares.length === 0 ? (
                      <p className="text-sm text-muted-foreground">—</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {linha.complementares.map((anexo, idx) => (
                          <li key={`${linha.key}-${anexo.storagePath ?? anexo.nome}-${idx}`}>
                            <ArquivoLinha anexo={anexo} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
