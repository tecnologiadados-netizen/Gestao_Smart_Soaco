import { X } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { Dialog, DialogContent } from "@qualidade/components/ui/dialog";
import { cn } from "@qualidade/lib/utils";

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descricao?: string;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel?: string;
  cancelLabel?: string;
  children: React.ReactNode;
  error?: string;
  className?: string;
}

export function FormDialog({
  open,
  onOpenChange,
  titulo,
  descricao,
  onSubmit,
  submitLabel = "Salvar",
  cancelLabel = "Cancelar",
  children,
  error,
  className,
}: FormDialogProps) {
  function handleClose() {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "z-[60] max-h-[min(92vh,100dvh)] gap-0 overflow-hidden p-0",
          className
        )}
      >
        <div className="modal-header-bar flex shrink-0 items-center justify-between px-5 py-3.5">
          <h2 className="text-base font-semibold text-white">{titulo}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1.5 hover:bg-white/20"
            aria-label="Fechar"
          >
            <X className="size-5 text-white" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-6 py-5">
            {descricao ? (
              <p className="text-sm text-muted-foreground">{descricao}</p>
            ) : null}
            {children}
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="sgq-form-footer justify-end">
            <Button type="button" variant="outline" onClick={handleClose}>
              {cancelLabel}
            </Button>
            <Button type="submit">{submitLabel}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
