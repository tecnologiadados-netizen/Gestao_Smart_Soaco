import { Button } from "@qualidade/components/ui/button";
import { Dialog, DialogContent } from "@qualidade/components/ui/dialog";
import { FormModalHeader } from "@qualidade/components/ui/form-modal";
import { cn } from "@qualidade/lib/utils";

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descricao?: string;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel?: string;
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
          "z-[60] max-h-[min(92vh,100dvh)] max-w-[26.5rem] gap-0 overflow-hidden p-0",
          className
        )}
      >
        <FormModalHeader
          titulo={titulo}
          descricao={descricao}
          onClose={handleClose}
        />

        <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-7 py-5">
            {children}
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="sgq-form-footer">
            <Button type="submit">{submitLabel}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
