import { useMemo } from "react";
import { Badge } from "@qualidade/components/ui/badge";
import { SgqArquivoAcoes } from "@qualidade/components/documentos/sgq-arquivo-imprimir-btn";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qualidade/components/ui/table";
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
  anexos: EquipmentAnexo[];
};

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
        anexos: arquivosDaVersao(
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
        versao: reg.versao,
        atual: false,
        data: reg.data,
        responsavel: users.find((u) => u.id === reg.responsavelId)?.nome,
        tipo: reg.tipo,
        resultado: reg.resultado,
        laboratorio: reg.laboratorio,
        anexos: arquivosDaVersao(
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
        <Table surface>
          <TableHeader>
            <TableRow className="border-b-2 border-border">
              <TableHead className="w-28 border-r border-border/70">
                Versão
              </TableHead>
              <TableHead className="w-28 border-r border-border/70">
                Data
              </TableHead>
              <TableHead className="min-w-[8rem] border-r border-border/70">
                Responsável
              </TableHead>
              <TableHead className="min-w-[7rem] border-r border-border/70">
                Tipo / resultado
              </TableHead>
              <TableHead className="min-w-0">Arquivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((linha) => (
              <TableRow
                key={linha.key}
                className={cn(
                  "border-b border-border/80 last:border-b-0",
                  linha.atual && "bg-brand-blue-light/20"
                )}
              >
                <TableCell className="border-r border-border/60 !whitespace-normal">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-brand-navy">
                      {linha.versao}
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
                      <Badge
                        variant={getDueStatusVariant(linha.statusVencimento)}
                      >
                        {dueStatusLabels[linha.statusVencimento]}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="border-r border-border/60 text-muted-foreground">
                  {linha.data ? formatarData(linha.data) : "—"}
                </TableCell>
                <TableCell className="border-r border-border/60 !whitespace-normal text-muted-foreground">
                  {linha.responsavel || "—"}
                </TableCell>
                <TableCell className="border-r border-border/60 !whitespace-normal text-xs text-muted-foreground">
                  {linha.tipo || linha.resultado || linha.laboratorio ? (
                    <span className="capitalize">
                      {[linha.tipo, linha.resultado, linha.laboratorio]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="max-w-0 !whitespace-normal">
                  {linha.anexos.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="space-y-1.5">
                      {linha.anexos.map((anexo, idx) => (
                        <div
                          key={`${linha.key}-${anexo.nome}-${idx}`}
                          className="flex min-w-0 flex-wrap items-center gap-2"
                        >
                          <span
                            className="min-w-0 flex-1 truncate text-xs font-medium text-brand-navy"
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
                            className="h-8 shrink-0 gap-1.5 text-xs text-brand-blue"
                            labeled
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </fieldset>
  );
}
