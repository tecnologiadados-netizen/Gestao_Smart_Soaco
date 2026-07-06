import { useEffect, useState } from "react";
import { X } from "lucide-react";
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
import { useCalibrationsStore } from "@qualidade/lib/store/calibrations-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import {
  departmentSelectLabel,
  tipoCalibracaoSelectLabel,
  userSelectLabel,
} from "@qualidade/lib/utils/select-display";
import type { CalibrationType } from "@qualidade/types/calibration";

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

  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [local, setLocal] = useState("");
  const [setorId, setSetorId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [tipoCalibracao, setTipoCalibracao] = useState<CalibrationType>("interna");
  const [freqCal, setFreqCal] = useState("365");
  const [freqVer, setFreqVer] = useState("90");
  const [ultimaCalibracao, setUltimaCalibracao] = useState("");
  const [ultimaVerificacao, setUltimaVerificacao] = useState("");
  const [error, setError] = useState("");
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [confirmarInativacao, setConfirmarInativacao] = useState(false);
  const [confirmarReativacao, setConfirmarReativacao] = useState(false);

  useEffect(() => {
    if (!open || !equipment) return;

    setCodigo(equipment.codigo);
    setDescricao(equipment.descricao);
    setLocal(equipment.local);
    setSetorId(equipment.setorId);
    setResponsavelId(equipment.responsavelId);
    setFornecedor(equipment.fornecedor ?? "");
    setTipoCalibracao(equipment.tipoCalibracao);
    setFreqCal(String(equipment.frequenciaCalibracaoDias));
    setFreqVer(String(equipment.frequenciaVerificacaoDias));
    setUltimaCalibracao(isoToDateInput(equipment.ultimaCalibracao));
    setUltimaVerificacao(isoToDateInput(equipment.ultimaVerificacao));
    setError("");
  }, [open, equipment]);

  function handleClose() {
    setConfirmarExclusao(false);
    setConfirmarInativacao(false);
    setConfirmarReativacao(false);
    onOpenChange(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!equipmentId || !equipment || !equipment.ativo) return;

    const descricaoTrim = descricao.trim();
    if (!descricaoTrim || !responsavelId) {
      setError("Preencha os campos obrigatórios.");
      return;
    }

    updateEquipment(equipmentId, {
      descricao: descricaoTrim,
      local: local.trim(),
      setorId,
      responsavelId,
      fornecedor: fornecedor.trim() || undefined,
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
    });
    handleClose();
  }

  function handleInativar() {
    if (!equipmentId) return;
    setEquipmentAtivo(equipmentId, false);
    setConfirmarInativacao(false);
    handleClose();
  }

  function handleReativar() {
    if (!equipmentId) return;
    setEquipmentAtivo(equipmentId, true);
    setConfirmarReativacao(false);
    handleClose();
  }

  function handleExcluir() {
    if (!equipmentId) return;
    removeEquipment(equipmentId);
    setConfirmarExclusao(false);
    handleClose();
  }

  if (!open || !equipmentId || !equipment) {
    return null;
  }

  const somenteLeitura = !equipment.ativo;

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
              <h2 className="text-base font-semibold text-white">
                {somenteLeitura ? "Equipamento inativo" : "Editar equipamento"}
              </h2>
              <p className="mt-0.5 text-xs text-white/80">
                {somenteLeitura
                  ? `${codigo} — visualização somente leitura`
                  : `Código ${codigo} — alterações não modificam o identificador`}
              </p>
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
              {somenteLeitura ? (
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
                    <Label htmlFor="edit-eq-local">Localização</Label>
                    <Input
                      id="edit-eq-local"
                      value={local}
                      onChange={(e) => setLocal(e.target.value)}
                      readOnly={somenteLeitura}
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
                            {dep.sigla} — {dep.nome}
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
                    <Label htmlFor="edit-eq-fornecedor">Fornecedor</Label>
                    <Input
                      id="edit-eq-fornecedor"
                      value={fornecedor}
                      onChange={(e) => setFornecedor(e.target.value)}
                      readOnly={somenteLeitura}
                      className={somenteLeitura ? "bg-muted/50" : undefined}
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

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="sgq-form-footer justify-between gap-3">
              {somenteLeitura ? (
                <div />
              ) : (
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
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  {somenteLeitura ? "Fechar" : "Cancelar"}
                </Button>
                {somenteLeitura ? (
                  <Button
                    type="button"
                    onClick={() => setConfirmarReativacao(true)}
                  >
                    Ativar novamente
                  </Button>
                ) : (
                  <Button type="submit">Salvar alterações</Button>
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
