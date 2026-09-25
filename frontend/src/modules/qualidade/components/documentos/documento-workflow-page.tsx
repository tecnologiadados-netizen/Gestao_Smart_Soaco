import { ArrowLeft } from "lucide-react";
import { DocumentoStepper } from "@qualidade/components/documentos/documento-stepper";
import { DocumentoLogsProcesso } from "@qualidade/components/documentos/documento-historico-workflow";
import { cn } from "@qualidade/lib/utils";
import type { DocumentVersion } from "@qualidade/types/document";
import type { User } from "@qualidade/types/user";

interface Props {
  title: string;
  activeStep: number;
  onBack: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  version?: DocumentVersion;
  users?: User[];
  exiting?: boolean;
}

export function DocumentoWorkflowPage({
  title,
  activeStep,
  onBack,
  children,
  footer,
  version,
  users,
  exiting = false,
}: Props) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-6xl flex-col rounded-xl border bg-card shadow-sm",
        exiting && "sgq-view-exit"
      )}
    >
      <div className="modal-header-bar flex shrink-0 items-center gap-3 px-5 py-3.5">
        <button
          type="button"
          onClick={onBack}
          className="rounded p-1.5 hover:bg-white/20"
          aria-label="Voltar"
        >
          <ArrowLeft className="size-5 text-white" />
        </button>
        <h1 className="min-w-0 truncate text-base font-semibold text-white">
          {title}
        </h1>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]">
        <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
          {children}
        </div>
        <aside className="hidden min-w-0 space-y-4 lg:block">
          <DocumentoStepper activeStep={activeStep} />
          {version && users ? (
            <DocumentoLogsProcesso version={version} users={users} />
          ) : null}
        </aside>
      </div>

      <div className="sgq-form-footer">{footer}</div>
    </div>
  );
}
