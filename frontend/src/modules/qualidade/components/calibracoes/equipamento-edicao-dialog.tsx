import { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { ConfirmacaoDialog } from "@qualidade/components/ui/confirmacao-dialog";
import { Dialog, DialogContent } from "@qualidade/components/ui/dialog";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qualidade/components/ui/select";
import { CalibracaoHistoricoSection } from "@qualidade/components/calibracoes/calibracao-historico-section";
import {
  anexosPreenchidos,
  defaultAnexoRows,
  EquipamentoAnexosField,
  type AnexoItem,
} from "@qualidade/components/calibracoes/equipamento-anexos-field";
import { DocumentoArquivoField } from "@qualidade/components/documentos/documento-arquivo-field";
import { FornecedorSearchField } from "@qualidade/components/avaliacao-fornecedor/fornecedor-search-field";
import { SgqAnexosTable } from "@qualidade/components/ui/sgq-anexos-table";
import { useCalibrationsStore } from "@qualidade/lib/store/calibrations-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { flushQualidadeCalibrationsSync, cancelQualidadeCalibrationsDebounce, markQualidadeCalibrationFilesPending } from "@qualidade/lib/qualidadePersistence";
import { deleteQualidadeEquipamento } from "@qualidade/lib/api/qualidadeApi";
import {
  departmentSelectLabel,
  tipoCalibracaoSelectLabel,
  userSelectLabel,
} from "@qualidade/lib/utils/select-display";
import { randomUUID } from "@/utils/randomUUID";
import type { Fornecedor } from "@qualidade/types/avaliacao-fornecedor";
import type { CalibrationType, Equipment } from "@qualidade/types/calibration";
import type { SgqAnexo } from "@qualidade/types/registro-anexo";

const selectTriggerClass =
  "h-10 w-full min-w-0 *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal";

interface EquipamentoEdicaoDialogProps {
  equipmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isoToDateInput(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function anexosDoEquipamento(equipment: Equipment): AnexoItem[] {
  const source =
    equipment.anexos?.length
      ? equipment.anexos
      : equipment.laudoAnexos?.length
        ? equipment.laudoAnexos
        : [];
  if (!source.length) return defaultAnexoRows();
  return source.map((item) => ({
    id: randomUUID(),
    nome: item.nome,
    dataUrl: item.dataUrl,
    storagePath: item.storagePath,
  }));
}

function carregarFormularioDeEquipamento(
  equipment: Equipment,
  setters: {
    setCodigo: (v: string) => void;
    setDescricao: (v: string) => void;
    setSetorId: (v: string) => void;
    setResponsavelId: (v: string) => void;
    setFornecedorSelecionado: (v: Fornecedor | null) => void;
    setTipoCalibracao: (v: CalibrationType) => void;
    setFreqCal: (v: string) => void;
    setFreqVer: (v: string) => void;
    setUltimaCalibracao: (v: string) => void;
    setUltimaVerificacao: (v: string) => void;
    setLaudoNome: (v: string) => void;
    setLaudoDataUrl: (v: string) => void;
    setAnexos: (v: AnexoItem[]) => void;
    setError: (v: string) => void;
  }
) {
  setters.setCodigo(equipment.codigo);
  setters.setDescricao(equipment.descricao);
  setters.setSetorId(equipment.setorId);
  setters.setResponsavelId(equipment.responsavelId);
  setters.setFornecedorSelecionado(
    equipment.fornecedor
      ? { id: equipment.fornecedor, nome: equipment.fornecedor }
      : null
  );
  setters.setTipoCalibracao(equipment.tipoCalibracao);
  setters.setFreqCal(String(equipment.frequenciaCalibracaoDias));
  setters.setFreqVer(String(equipment.frequenciaVerificacaoDias));
  setters.setUltimaCalibracao(isoToDateInput(equipment.ultimaCalibracao));
  setters.setUltimaVerificacao(isoToDateInput(equipment.ultimaVerificacao));
  setters.setLaudoNome("");
  setters.setLaudoDataUrl("");
  setters.setAnexos(anexosDoEquipamento(equipment));
  setters.setError("");
}

export function EquipamentoEdicaoDialog({
  equipmentId,
  open,
  onOpenChange,
}: EquipamentoEdicaoDialogProps) {
  const getEquipmentById = useCalibrationsStore((s) => s.getEquipmentById);
  const updateEquipment = useCalibrationsStore((s) => s.updateEquipment);
  const setEquipmentAtivo = useCalibrationsStore((s) => s.setEquipmentAtivo);
  const removeEquipment = useCalibrationsStore((s) => s.removeEquipment);
  const departments = useConfigStore((s) => s.departments);
  const users = useConfigStore((s) => s.users);
  const activeUsers = users.filter((u) => u.ativo);

  const equipment = equipmentId ? getEquipmentById(equipmentId) : undefined;

  const [editando, setEditando] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [setorId, setSetorId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [fornecedorSelecionado, setFornecedorSelecionado] =
    useState<Fornecedor | null>(null);
  const [tipoCalibracao, setTipoCalibracao] = useState<CalibrationType>("interna");
  const [freqCal, setFreqCal] = useState("365");
  const [freqVer, setFreqVer] = useState("90");
  const [ultimaCalibracao, setUltimaCalibracao] = useState("");
  const [ultimaVerificacao, setUltimaVerificacao] = useState("");
  const [laudoNome, setLaudoNome] = useState("");
  const [laudoDataUrl, setLaudoDataUrl] = useState("");
  const [anexos, setAnexos] = useState<AnexoItem[]>(() => defaultAnexoRows());
  const [error, setError] = useState("");
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmarInativacao, setConfirmarInativacao] = useState(false);
  const [confirmarReativacao, setConfirmarReativacao] = useState(false);

  const formSetters = {
    setCodigo,
    setDescricao,
    setSetorId,
    setResponsavelId,
    setFornecedorSelecionado,
    setTipoCalibracao,
    setFreqCal,
    setFreqVer,
    setUltimaCalibracao,
    setUltimaVerificacao,
    setLaudoNome,
    setLaudoDataUrl,
    setAnexos,
    setError,
  };

  useEffect(() => {
    if (!open || !equipment) return;

    setEditando(false);
    carregarFormularioDeEquipamento(equipment, formSetters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, equipmentId]);

  function handleClose() {
    setEditando(false);
    setConfirmarExclusao(false);
    setConfirmarInativacao(false);
    setConfirmarReativacao(false);
    onOpenChange(false);
  }

  function iniciarEdicao() {
    if (!equipment?.ativo) return;
    carregarFormularioDeEquipamento(equipment, formSetters);
    setEditando(true);
  }

  function cancelarEdicao() {
    if (!equipment) return;
    carregarFormularioDeEquipamento(equipment, formSetters);
    setEditando(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!equipmentId || !equipment || !equipment.ativo || !editando) return;

    const descricaoTrim = descricao.trim();
    if (!descricaoTrim || !responsavelId) {
      setError("Preencha os campos obrigatórios.");
      return;
    }

    const temLaudoNovo = Boolean(laudoNome.trim() && laudoDataUrl.trim());
    const anexosSalvar = anexosPreenchidos(anexos);

    updateEquipment(equipmentId, {
      descricao: descricaoTrim,
      local: equipment.local,
      setorId,
      responsavelId,
      fornecedor: fornecedorSelecionado?.nome?.trim() || undefined,
      tipoCalibracao,
      frequenciaCalibracaoDias: Number(freqCal) || 365,
      frequenciaVerificacaoDias: Number(freqVer) || 90,
      ultimaCalibracao: ultimaCalibracao
        ? new Date(ultimaCalibracao).toISOString()
        : undefined,
      ultimaVerificacao: ultimaVerificacao
        ? new Date(ultimaVerificacao).toISOString()
        : undefined,
      ativo: equipment.ativo,
      anexos: anexosSalvar,
      ...(temLaudoNovo
        ? {
            laudoNome: laudoNome.trim(),
            laudoDataUrl: laudoDataUrl.trim(),
          }
        : {}),
    });

    if (temLaudoNovo || anexosSalvar.length > 0) {
      markQualidadeCalibrationFilesPending(equipmentId);
    }

    // Sempre faz flush: metadados do equipamento precisam ir ao servidor.
    // Arquivos só entram no payload se marcados como pending.

    try {
      await flushQualidadeCalibrationsSync();
      handleClose();
    } catch (err) {
      console.error("[qualidade] falha ao persistir equipamento:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Alterações salvas localmente, mas falhou ao gravar no servidor."
      );
    }
  }

  function handleLaudoSelect(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setError("O arquivo excede o limite de 5 MB.");
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

  function handleInativar() {
    if (!equipmentId) return;
    setEquipmentAtivo(equipmentId, false);
    setConfirmarInativacao(false);
    void flushQualidadeCalibrationsSync().catch((err) => {
      console.error("[qualidade] falha ao persistir inativação:", err);
    });
    handleClose();
  }

  function handleReativar() {
    if (!equipmentId) return;
    setEquipmentAtivo(equipmentId, true);
    setConfirmarReativacao(false);
    void flushQualidadeCalibrationsSync().catch((err) => {
      console.error("[qualidade] falha ao persistir reativação:", err);
    });
    handleClose();
  }

  async function handleExcluir() {
    if (!equipmentId || excluindo) return;
    setExcluindo(true);
    setError("");
    try {
      await deleteQualidadeEquipamento(equipmentId);
      cancelQualidadeCalibrationsDebounce();
      removeEquipment(equipmentId);
      setConfirmarExclusao(false);
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível excluir o equipamento."
      );
      setConfirmarExclusao(false);
    } finally {
      setExcluindo(false);
    }
  }

  if (!open || !equipmentId || !equipment) {
    return null;
  }

  const inativo = !equipment.ativo;
  const somenteLeitura = inativo || !editando;

  const tituloModal = inativo
    ? "Equipamento inativo"
    : editando
      ? "Editar equipamento"
      : "Detalhes do equipamento";
  const subtituloModal = inativo
    ? `${codigo} — visualização somente leitura`
    : editando
      ? `Código ${codigo} — alterações não modificam o identificador`
      : `Código ${codigo}`;

  return (
    <>
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
          <div className="modal-header-bar flex shrink-0 items-center justify-between px-5 py-3.5">
            <div>
              <h2 className="text-base font-semibold text-white">{tituloModal}</h2>
              <p className="mt-0.5 text-xs text-white/80">{subtituloModal}</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded p-1.5 hover:bg-white/20"
              aria-label="Fechar"
            >
              <X className="size-5 text-white" />
            </button>
          </div>

          <form
            onSubmit={somenteLeitura ? (e) => e.preventDefault() : handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-y-contain p-6">
              {inativo ? (
                <p className="rounded-lg border border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  Este equipamento está inativo. Os dados abaixo não podem ser
                  alterados — use o botão <strong>Ativar novamente</strong> para
                  reativá-lo.
                </p>
              ) : null}

              <fieldset
                className="brand-fieldset space-y-4"
                disabled={somenteLeitura}
              >
                <legend>Identificação</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-eq-codigo">Código</Label>
                    <Input
                      id="edit-eq-codigo"
                      value={codigo}
                      readOnly
                      disabled
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="edit-eq-descricao">Descrição *</Label>
                    <Input
                      id="edit-eq-descricao"
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      readOnly={somenteLeitura}
                      required={!somenteLeitura}
                      className={somenteLeitura ? "bg-muted/50" : undefined}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="edit-eq-setor">Setor</Label>
                    <Select
                      value={setorId || undefined}
                      onValueChange={(v) => v && setSetorId(v)}
                    >
                      <SelectTrigger
                        id="edit-eq-setor"
                        className={selectTriggerClass}
                        disabled={somenteLeitura}
                      >
                        <SelectValue placeholder="Selecione o setor">
                          {departmentSelectLabel(departments, setorId, "nome") ??
                            null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dep) => (
                          <SelectItem key={dep.id} value={dep.id}>
                            {dep.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </fieldset>

              <fieldset
                className="brand-fieldset space-y-4"
                disabled={somenteLeitura}
              >
                <legend>Responsabilidade</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-eq-responsavel">Responsável *</Label>
                    <Select
                      value={responsavelId || undefined}
                      onValueChange={(v) => v && setResponsavelId(v)}
                    >
                      <SelectTrigger
                        id="edit-eq-responsavel"
                        className={selectTriggerClass}
                        disabled={somenteLeitura}
                      >
                        <SelectValue placeholder="Selecione o responsável">
                          {userSelectLabel(activeUsers, responsavelId) ?? null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {activeUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <FornecedorSearchField
                      id="edit-eq-fornecedor"
                      value={fornecedorSelecionado}
                      onSelect={setFornecedorSelecionado}
                      onClear={() => setFornecedorSelecionado(null)}
                      disabled={somenteLeitura}
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset
                className="brand-fieldset space-y-4"
                disabled={somenteLeitura}
              >
                <legend>Calibração</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo calibração</Label>
                    <Select
                      value={tipoCalibracao}
                      onValueChange={(v) =>
                        v && setTipoCalibracao(v as CalibrationType)
                      }
                    >
                      <SelectTrigger
                        className={selectTriggerClass}
                        disabled={somenteLeitura}
                      >
                        <SelectValue>
                          {tipoCalibracaoSelectLabel(tipoCalibracao) ?? null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="interna">Interna</SelectItem>
                        <SelectItem value="externa">Externa</SelectItem>
                        <SelectItem value="ambos">Ambos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-eq-freq-cal">Freq. calibração (dias)</Label>
                    <Input
                      id="edit-eq-freq-cal"
                      type="number"
                      min={1}
                      value={freqCal}
                      onChange={(e) => setFreqCal(e.target.value)}
                      readOnly={somenteLeitura}
                      className={somenteLeitura ? "bg-muted/50" : undefined}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-eq-freq-ver">Freq. verificação (dias)</Label>
                    <Input
                      id="edit-eq-freq-ver"
                      type="number"
                      min={1}
                      value={freqVer}
                      onChange={(e) => setFreqVer(e.target.value)}
                      readOnly={somenteLeitura}
                      className={somenteLeitura ? "bg-muted/50" : undefined}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-eq-ult-cal">Última calibração</Label>
                    <Input
                      id="edit-eq-ult-cal"
                      type="date"
                      value={ultimaCalibracao}
                      onChange={(e) => setUltimaCalibracao(e.target.value)}
                      readOnly={somenteLeitura}
                      className={somenteLeitura ? "bg-muted/50" : undefined}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-eq-ult-ver">Última verificação</Label>
                    <Input
                      id="edit-eq-ult-ver"
                      type="date"
                      value={ultimaVerificacao}
                      onChange={(e) => setUltimaVerificacao(e.target.value)}
                      readOnly={somenteLeitura}
                      className={somenteLeitura ? "bg-muted/50" : undefined}
                    />
                  </div>
                </div>
              </fieldset>

              <CalibracaoHistoricoSection equipment={equipment} />

              {editando && !inativo ? (
                <fieldset className="brand-fieldset space-y-3">
                  <legend>Documentação</legend>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {equipment.laudoNome
                        ? "Anexe um arquivo para substituir o laudo atual (sem gerar nova versão de calibração)."
                        : "Anexe o laudo vigente caso ainda não tenha sido registrado."}
                    </p>
                    <DocumentoArquivoField
                      label={
                        equipment.laudoNome
                          ? "Substituir laudo"
                          : "Anexar laudo *"
                      }
                      arquivoNome={laudoNome || equipment.laudoNome}
                      arquivoDataUrl={laudoDataUrl || equipment.laudoDataUrl}
                      onFileSelect={handleLaudoSelect}
                      onRemove={() => {
                        setLaudoNome("");
                        setLaudoDataUrl("");
                      }}
                    />
                  </div>
                  <EquipamentoAnexosField
                    value={anexos}
                    onChange={setAnexos}
                  />
                </fieldset>
              ) : (
                <fieldset className="brand-fieldset space-y-3">
                  <legend>Documentação</legend>
                  {equipment.laudoNome && equipment.laudoDataUrl ? (
                    <SgqAnexosTable
                      label="Laudo vigente"
                      anexos={
                        [
                          {
                            id: "laudo-vigente",
                            nome: equipment.laudoNome,
                            dataUrl: equipment.laudoDataUrl,
                          },
                        ] satisfies SgqAnexo[]
                      }
                      onChange={() => {}}
                      disabled
                      readOnlyEmptyMessage="Nenhum laudo vigente registrado."
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {equipment.laudoNome
                        ? `Laudo vigente cadastrado: ${equipment.laudoNome}. O arquivo não foi encontrado no servidor — use Editar para anexá-lo novamente.`
                        : "Nenhum laudo vigente registrado."}
                    </p>
                  )}
                  <EquipamentoAnexosField
                    value={anexos}
                    onChange={setAnexos}
                    disabled
                  />
                </fieldset>
              )}

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="sgq-form-footer justify-between gap-3">
              {editando && !inativo ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setConfirmarExclusao(true)}
                  >
                    Excluir
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfirmarInativacao(true)}
                  >
                    Inativar
                  </Button>
                </div>
              ) : (
                <div />
              )}
              <div className="flex flex-wrap gap-2">
                {editando && !inativo ? (
                  <>
                    <Button type="button" variant="outline" onClick={cancelarEdicao}>
                      Cancelar
                    </Button>
                    <Button type="submit">Salvar alterações</Button>
                  </>
                ) : (
                  <>
                    {inativo ? (
                      <Button
                        type="button"
                        onClick={() => setConfirmarReativacao(true)}
                      >
                        Ativar novamente
                      </Button>
                    ) : (
                      <Button type="button" onClick={iniciarEdicao}>
                        <Pencil className="mr-2 size-4" />
                        Editar
                      </Button>
                    )}
                    <Button type="button" variant="outline" onClick={handleClose}>
                      Fechar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmacaoDialog
        open={confirmarExclusao}
        onOpenChange={setConfirmarExclusao}
        titulo="Excluir equipamento"
        mensagem={`Deseja excluir o equipamento ${codigo}? Esta ação não pode ser desfeita.`}
        confirmarLabel="Excluir"
        variant="destructive"
        onConfirmar={handleExcluir}
      />

      <ConfirmacaoDialog
        open={confirmarInativacao}
        onOpenChange={setConfirmarInativacao}
        titulo="Inativar equipamento"
        mensagem={`Deseja inativar o equipamento ${codigo}? Ele continuará visível na consulta, porém apagado e sem edição.`}
        confirmarLabel="Inativar"
        onConfirmar={handleInativar}
      />

      <ConfirmacaoDialog
        open={confirmarReativacao}
        onOpenChange={setConfirmarReativacao}
        titulo="Ativar equipamento"
        mensagem={`Deseja ativar novamente o equipamento ${codigo}?`}
        confirmarLabel="Ativar novamente"
        onConfirmar={handleReativar}
      />
    </>
  );
}
