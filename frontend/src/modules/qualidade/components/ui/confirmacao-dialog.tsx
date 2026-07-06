import { Button } from "@qualidade/components/ui/button";
import { Dialog, DialogContent } from "@qualidade/components/ui/dialog";

interface ConfirmacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  mensagem: string;
  confirmarLabel?: string;
  cancelarLabel?: string;
  variant?: "default" | "destructive";
  onConfirmar: () => void;
}

export function ConfirmacaoDialog({
  open,
  onOpenChange,
  titulo,
  mensagem,
  confirmarLabel = "Confirmar",
  cancelarLabel = "Cancelar",
  variant = "default",
  onConfirmar,
}: ConfirmacaoDialogProps) {
  function handleConfirmar() {
    onConfirmar();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="z-[60] max-w-md gap-0 overflow-hidden p-0"
      >
        <div className="modal-header-bar px-6 py-3.5">
          <h2 className="text-base font-semibold text-white">{titulo}</h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm leading-relaxed text-foreground">{mensagem}</p>
        </div>
        <div className="sgq-form-footer justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {cancelarLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirmar}
          >
            {confirmarLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
