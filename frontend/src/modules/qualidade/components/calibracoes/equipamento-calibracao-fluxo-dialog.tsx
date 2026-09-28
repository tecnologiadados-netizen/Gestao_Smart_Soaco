import { useEffect, useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { Button } from "@qualidade/components/ui/button";
import { FormModalHeader } from "@qualidade/components/ui/form-modal";
import { Dialog, DialogContent } from "@qualidade/components/ui/dialog";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import { DocumentoArquivoField } from "@qualidade/components/documentos/documento-arquivo-field";
import {
  mensagemLimiteAnexo,
  SGQ_ANEXO_MAX_BYTES,
  SGQ_ANEXO_MAX_MB,
} from "@qualidade/types/registro-anexo";
import {
  anexosPreenchidos,
  defaultAnexoRows,
  EquipamentoAnexosField,
  type AnexoItem,
} from "@qualidade/components/calibracoes/equipamento-anexos-field";
import { CalibracaoHistoricoSection } from "@qualidade/components/calibracoes/calibracao-historico-section";
import {
  CalibracaoArquivoActions,
} from "@qualidade/components/calibracoes/calibracao-versao-arquivos";
import { useCalibrationsStore } from "@qualidade/lib/store/calibrations-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { getQualidadeCurrentUserId } from "@qualidade/lib/current-user";
import { scheduleQualidadeCalibrationsFlush, markQualidadeCalibrationFilesPending } from "@qualidade/lib/qualidadePersistence";
import {
  calcularDueStatus,
  calcularProximaData,
  formatarData,
} from "@qualidade/lib/utils/dates";
import {
  departmentSelectLabel,
  tipoCalibracaoSelectLabel,
  userSelectLabel,
} from "@qualidade/lib/utils/select-display";
import { rotuloPeriodicidade } from "@qualidade/lib/utils/periodicidade-calibracao";
import { dueStatusLabels } from "@qualidade/lib/utils/status-labels";

interface EquipamentoCalibracaoFluxoDialogProps {
  equipmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  iniciarNovaCalibracao?: boolean;
}

function ReadOnlyField({
  label,
  value,
  className,
}: {
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

function LaudoActions({
  dataUrl,
  storagePath,
  nome,
}: {
  dataUrl?: string;
  storagePath?: string;
  nome: string;
}) {
  return (
    <CalibracaoArquivoActions
      dataUrl={dataUrl}
      storagePath={storagePath}
      nome={nome}
    />
  );
}

export function EquipamentoCalibracaoFluxoDialog({
  equipmentId,
  open,
  onOpenChange,
  iniciarNovaCalibracao = false,
}: EquipamentoCalibracaoFluxoDialogProps) {
  const equipmentState = useCalibrationsStore((s) => s.equipment);
  const registerCalibration = useCalibrationsStore((s) => s.registerCalibration);
  const departments = useConfigStore((s) => s.departments);
  const users = useConfigStore((s) => s.users);
  const currentUserId = useConfigStore((s) => s.currentUserId);

  const equipment = equipmentId
    ? equipmentState.find((e) => e.id === equipmentId)
    : undefined;

  const proximaCalibracao = useMemo(
    () =>
      equipment
        ? equipment.proximaCalibracao ??
          calcularProximaData(
            equipment.ultimaCalibracao,
            equipment.frequenciaCalibracaoDias
          )
        : undefined,
    [equipment]
  );
  const statusCalibracao = calcularDueStatus(proximaCalibracao);
  const podeCalibrar = Boolean(
    equipment && equipment.responsavelId === currentUserId
  );

  const [mostrarNovaCalibracao, setMostrarNovaCalibracao] = useState(false);
  const [calibracaoRegistrada, setCalibracaoRegistrada] = useState(false);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [proximaCalibracaoData, setProximaCalibracaoData] = useState("");
  const [laudoNome, setLaudoNome] = useState("");
  const [laudoDataUrl, setLaudoDataUrl] = useState("");
  const [anexos, setAnexos] = useState<AnexoItem[]>(() => defaultAnexoRows());
  const [error, setError] = useState("");
  function sugerirProximaCalibracao(
    dataCalibracao: string,
    frequenciaDias: number
  ) {
    const sugerida = calcularProximaData(
      new Date(dataCalibracao).toISOString(),
      frequenciaDias
    );
    return sugerida?.slice(0, 10) ?? "";
  }

  useEffect(() => {
    if (!open) {
      setMostrarNovaCalibracao(false);
      setCalibracaoRegistrada(false);
      setData(new Date().toISOString().slice(0, 10));
      setProximaCalibracaoData("");
      setLaudoNome("");
      setLaudoDataUrl("");
      setAnexos(defaultAnexoRows());
      setError("");
      return;
    }

    const hoje = new Date().toISOString().slice(0, 10);
    setData(hoje);
    if (equipment) {
      setProximaCalibracaoData(
        sugerirProximaCalibracao(hoje, equipment.frequenciaCalibracaoDias)
      );
    }
    setMostrarNovaCalibracao(iniciarNovaCalibracao);
    setCalibracaoRegistrada(false);
  }, [open, iniciarNovaCalibracao, equipmentId, equipment]);

  function handleClose() {
    onOpenChange(false);
  }

  function handleLaudoSelect(file: File) {
    if (file.size > SGQ_ANEXO_MAX_BYTES) {
      setError(mensagemLimiteAnexo());
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLaudoNome(file.name);
      setLaudoDataUrl(reader.result as string);
      setError("");
    };
    reader.readAsDataURL(file);
  }

  async function handleRegistrarCalibracao(e: React.FormEvent) {
    e.preventDefault();
    if (!equipmentId) return;

    if (!podeCalibrar) {
      setError("Somente o responsável pela calibração pode registrar o laudo.");
      return;
    }

    if (!laudoNome.trim() || !laudoDataUrl.trim()) {
      setError("Anexe o laudo da nova calibração.");
      return;
    }

    if (!proximaCalibracaoData.trim()) {
      setError("Informe a data da próxima calibração.");
      return;
    }

    if (parseISO(proximaCalibracaoData) <= parseISO(data)) {
      setError("A próxima calibração deve ser posterior à data da calibração.");
      return;
    }

    registerCalibration(equipmentId, {
      data: new Date(data).toISOString(),
      proximaCalibracao: new Date(proximaCalibracaoData).toISOString(),
      responsavelId: getQualidadeCurrentUserId(),
      laudoNome: laudoNome.trim(),
      laudoDataUrl: laudoDataUrl.trim(),
      anexos: anexosPreenchidos(anexos),
    });

    markQualidadeCalibrationFilesPending(equipmentId);

    scheduleQualidadeCalibrationsFlush();
    setCalibracaoRegistrada(true);
    setMostrarNovaCalibracao(false);
    setData(new Date().toISOString().slice(0, 10));
    setProximaCalibracaoData("");
    setLaudoNome("");
    setLaudoDataUrl("");
    setAnexos(defaultAnexoRows());
    setError("");
  }

  if (!open || !equipmentId || !equipment) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[min(92vh,100dvh)] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <FormModalHeader
          titulo={
            mostrarNovaCalibracao
              ? "Nova calibração"
              : "Equipamento — visualização"
          }
          descricao={`${equipment.codigo} · ${equipment.descricao}`}
          onClose={handleClose}
        />

        {mostrarNovaCalibracao ? (
          <form
            onSubmit={handleRegistrarCalibracao}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain p-6">
              <p className="text-sm text-muted-foreground">
                Informe as datas, anexe o laudo e documentos complementares se
                necessário. O laudo atual será arquivado automaticamente no
                histórico.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nova-cal-data">Data da calibração *</Label>
                  <Input
                    id="nova-cal-data"
                    type="date"
                    value={data}
                    onChange={(e) => {
                      const novaData = e.target.value;
                      setData(novaData);
                      setProximaCalibracaoData(
                        sugerirProximaCalibracao(
                          novaData,
                          equipment.frequenciaCalibracaoDias
                        )
                      );
                    }}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nova-cal-proxima">
                    Data da próxima calibração *
                  </Label>
                  <Input
                    id="nova-cal-proxima"
                    type="date"
                    value={proximaCalibracaoData}
                    min={data}
                    onChange={(e) => setProximaCalibracaoData(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Sugestão automática com base na periodicidade de{" "}
                    {rotuloPeriodicidade(equipment.frequenciaCalibracaoDias)} —
                    ajuste se necessário.
                  </p>
                </div>
              </div>

              <fieldset className="brand-fieldset space-y-4">
                <legend>Documentação</legend>
                <DocumentoArquivoField
                  label="Laudo da calibração *"
                  arquivoNome={laudoNome}
                  arquivoDataUrl={laudoDataUrl}
                  onFileSelect={handleLaudoSelect}
                  onRemove={() => {
                    setLaudoNome("");
                    setLaudoDataUrl("");
                  }}
                  hint={`PDF ou imagem do laudo · máx. ${SGQ_ANEXO_MAX_MB} MB`}
                />
                <EquipamentoAnexosField value={anexos} onChange={setAnexos} />
              </fieldset>

              {equipment.laudoNome ? (
                <p className="rounded-lg border border-border/80 bg-muted/30 p-3 text-sm text-muted-foreground">
                  Laudo vigente:{" "}
                  <span className="font-medium text-foreground">
                    {equipment.laudoNome}
                  </span>
                  {equipment.laudoAnexos?.length
                    ? ` · ${equipment.laudoAnexos.length} anexo(s) da versão atual`
                    : ""}
                  . Será movido para o histórico após o registro.
                </p>
              ) : null}

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="sgq-form-footer justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setMostrarNovaCalibracao(false);
                  setError("");
                }}
              >
                Voltar
              </Button>
              <Button type="submit">Registrar calibração</Button>
            </div>
          </form>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-y-contain p-6">
              <fieldset className="brand-fieldset space-y-4">
                <legend>Identificação</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ReadOnlyField label="Código" value={equipment.codigo} />
                  <ReadOnlyField
                    label="Status calibração"
                    value={dueStatusLabels[statusCalibracao]}
                  />
                  <ReadOnlyField
                    label="Descrição"
                    value={equipment.descricao}
                    className="sm:col-span-2"
                  />
                  <ReadOnlyField
                    label="Possui local fixo de uso?"
                    value={
                      equipment.possuiLocalFixo === true ||
                      (equipment.possuiLocalFixo == null && equipment.setorId)
                        ? "Sim"
                        : equipment.possuiLocalFixo === false ||
                            equipment.responsavelPosseNome
                          ? "Não"
                          : "—"
                    }
                  />
                  {equipment.possuiLocalFixo === true ||
                  (equipment.possuiLocalFixo == null && equipment.setorId) ? (
                    <ReadOnlyField
                      label="Setor do equipamento"
                      value={departmentSelectLabel(
                        departments,
                        equipment.setorId,
                        "nome"
                      )}
                    />
                  ) : (
                    <ReadOnlyField
                      label="Responsável pela posse do equipamento"
                      value={equipment.responsavelPosseNome?.trim() || "—"}
                    />
                  )}
                </div>
              </fieldset>

              <fieldset className="brand-fieldset space-y-4">
                <legend>Responsabilidade e calibração</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ReadOnlyField
                    label="Responsável pela calibração"
                    value={userSelectLabel(users, equipment.responsavelId)}
                  />
                  <ReadOnlyField
                    label="Fornecedor"
                    value={equipment.fornecedor}
                  />
                  <ReadOnlyField
                    label="Tipo calibração"
                    value={tipoCalibracaoSelectLabel(equipment.tipoCalibracao)}
                  />
                  <ReadOnlyField
                    label="Periodicidade de calibração"
                    value={rotuloPeriodicidade(equipment.frequenciaCalibracaoDias)}
                  />
                  <ReadOnlyField
                    label="Última calibração"
                    value={formatarData(equipment.ultimaCalibracao)}
                  />
                  <ReadOnlyField
                    label="Próxima calibração"
                    value={formatarData(proximaCalibracao)}
                  />
                </div>
              </fieldset>

              {equipment.laudoNome || equipment.anexos?.length ? (
                <fieldset className="brand-fieldset space-y-4">
                  <legend>Documentação</legend>
                  {equipment.laudoNome ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Laudo
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/20 p-3">
                        <span className="text-sm font-medium">
                          {equipment.laudoNome}
                        </span>
                        <LaudoActions
                          dataUrl={equipment.laudoDataUrl}
                          storagePath={equipment.laudoStoragePath}
                          nome={equipment.laudoNome}
                        />
                      </div>
                    </div>
                  ) : null}
                  {equipment.anexos?.length ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Arquivos complementares
                      </p>
                      <ul className="space-y-2">
                        {equipment.anexos
                          .filter(
                            (anexo) =>
                              anexo.nome.trim() !== equipment.laudoNome?.trim() &&
                              anexo.storagePath !== equipment.laudoStoragePath
                          )
                          .map((anexo) => (
                            <li
                              key={`${anexo.storagePath ?? anexo.nome}`}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/20 p-3"
                            >
                              <span className="text-sm font-medium">
                                {anexo.nome}
                              </span>
                              <LaudoActions
                                dataUrl={anexo.dataUrl}
                                storagePath={anexo.storagePath}
                                nome={anexo.nome}
                              />
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : null}
                </fieldset>
              ) : null}

              <CalibracaoHistoricoSection equipment={equipment} />
            </div>

            {!calibracaoRegistrada && statusCalibracao !== "em_dia" && podeCalibrar ? (
              <div className="sgq-form-footer justify-end gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    const hoje = new Date().toISOString().slice(0, 10);
                    setData(hoje);
                    setProximaCalibracaoData(
                      sugerirProximaCalibracao(
                        hoje,
                        equipment.frequenciaCalibracaoDias
                      )
                    );
                    setAnexos(defaultAnexoRows());
                    setMostrarNovaCalibracao(true);
                  }}
                >
                  Nova calibração
                </Button>
              </div>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
