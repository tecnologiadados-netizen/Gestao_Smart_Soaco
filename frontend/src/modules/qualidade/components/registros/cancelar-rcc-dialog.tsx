import { useEffect, useState } from "react";
import { Button } from "@qualidade/components/ui/button";
import { Dialog, DialogContent } from "@qualidade/components/ui/dialog";
import { FormModalHeader } from "@qualidade/components/ui/form-modal";
import { Label } from "@qualidade/components/ui/label";
import { Textarea } from "@qualidade/components/ui/textarea";
import { CampoErro } from "@qualidade/components/registros/campo-erro";

interface CancelarRccDialogProps {
  open: boolean;
  codigo: string;
  salvando?: boolean;
  erro?: string;
  onOpenChange: (open: boolean) => void;
  onConfirmar: (justificativa: string) => void;
}

export function CancelarRccDialog({
  open,
  codigo,
  salvando = false,
  erro = "",
  onOpenChange,
  onConfirmar,
}: CancelarRccDialogProps) {
  const [justificativa, setJustificativa] = useState("");
  const [erroLocal, setErroLocal] = useState("");

  useEffect(() => {
    if (!open) return;
    setJustificativa("");
    setErroLocal("");
  }, [open]);

  function confirmar() {
    const texto = justificativa.trim();
    if (!texto) {
      setErroLocal("Informe a justificativa do cancelamento.");
      return;
    }
    onConfirmar(texto);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(aberto) => {
        if (salvando) return;
        onOpenChange(aberto);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="z-[60] max-w-lg gap-0 overflow-hidden p-0"
      >
        <FormModalHeader
          titulo="Cancelar RCC"
          descricao={
            codigo
              ? `${codigo} será cancelada e já fica finalizada. Esta ação pede justificativa.`
              : "A RCC será cancelada e já fica finalizada. Esta ação pede justificativa."
          }
          closeDisabled={salvando}
          onClose={() => onOpenChange(false)}
        />
        <div className="space-y-3 px-7 py-5">
          <div className="space-y-2">
            <Label htmlFor="rcc-cancelar-justificativa">
              Justificativa do cancelamento *
            </Label>
            <Textarea
              id="rcc-cancelar-justificativa"
              value={justificativa}
              rows={4}
              maxLength={1000}
              disabled={salvando}
              placeholder="Descreva o motivo do cancelamento"
              onChange={(event) => {
                setJustificativa(event.target.value);
                if (erroLocal) setErroLocal("");
              }}
            />
            <CampoErro mensagem={erroLocal} />
          </div>
          {erro ? (
            <p className="text-sm text-destructive" role="alert">
              {erro}
            </p>
          ) : null}
        </div>
        <div className="sgq-form-footer justify-end">
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={salvando}
              onClick={() => onOpenChange(false)}
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={salvando || !justificativa.trim()}
              onClick={confirmar}
            >
              {salvando ? "Cancelando..." : "Cancelar RCC"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
