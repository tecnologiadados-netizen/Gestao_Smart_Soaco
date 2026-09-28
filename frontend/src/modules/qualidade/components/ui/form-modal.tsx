import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@qualidade/lib/utils";

/** Marca o body enquanto um formulário modal está aberto (menus portados herdam o cartão). */
export function useMarcarFormularioAberto(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    const root = document.body;
    const atual = Number(root.dataset.sgqFormularios ?? "0") + 1;
    root.dataset.sgqFormularios = String(atual);
    root.classList.add("sgq-form-aberto");
    return () => {
      const proximo = Number(root.dataset.sgqFormularios ?? "1") - 1;
      if (proximo <= 0) {
        delete root.dataset.sgqFormularios;
        root.classList.remove("sgq-form-aberto");
      } else {
        root.dataset.sgqFormularios = String(proximo);
      }
    };
  }, [ativo]);
}

interface FormModalHeaderProps {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  onClose?: () => void;
  closeDisabled?: boolean;
  className?: string;
}

export function FormModalHeader({
  titulo,
  descricao,
  onClose,
  closeDisabled,
  className,
}: FormModalHeaderProps) {
  return (
    <div className={cn("sgq-form-modal-header", className)}>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          disabled={closeDisabled}
          className="sgq-form-modal-close"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>
      ) : null}
      <h2>{titulo}</h2>
      {descricao ? <p>{descricao}</p> : null}
    </div>
  );
}

interface FormPageModalProps {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "wide";
  className?: string;
}

/** Formulário de página apresentado como modal central. */
export function FormPageModal({
  titulo,
  descricao,
  onClose,
  children,
  size = "sm",
  className,
}: FormPageModalProps) {
  useMarcarFormularioAberto(true);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return createPortal(
    <>
      <div
        className="sgq-form-page-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "sgq-form-page sgq-form-page-frame",
          size === "md" && "is-md",
          size === "lg" && "is-lg",
          size === "wide" && "is-wide",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-label={typeof titulo === "string" ? titulo : undefined}
      >
        <div className="sgq-dialog-surface flex max-h-[min(92vh,100dvh)] w-full flex-col overflow-hidden bg-card text-card-foreground">
          <FormModalHeader
            titulo={titulo}
            descricao={descricao}
            onClose={onClose}
          />
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}
