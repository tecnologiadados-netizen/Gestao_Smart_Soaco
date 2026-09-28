import { Button } from "@qualidade/components/ui/button";
import { Dialog, DialogContent } from "@qualidade/components/ui/dialog";
import { FormModalHeader } from "@qualidade/components/ui/form-modal";

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
        className="z-[60] max-w-[26.5rem] gap-0 overflow-hidden p-0"
      >
        <FormModalHeader
          titulo={titulo}
          onClose={() => onOpenChange(false)}
        />
        <div className="px-7 py-5">
          <p className="text-center text-sm leading-relaxed text-muted-foreground">
            {mensagem}
          </p>
        </div>
        <div className="sgq-form-footer">
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirmar}
          >
            {confirmarLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {cancelarLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
