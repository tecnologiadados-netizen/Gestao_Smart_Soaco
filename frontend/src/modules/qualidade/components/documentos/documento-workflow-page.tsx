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
        "mx-auto flex max-h-[calc(100vh-8rem)] max-w-5xl flex-col overflow-hidden rounded-xl border bg-card shadow-sm",
        exiting && "sgq-view-exit"
      )}
    >
      <div className="modal-header-bar flex items-center gap-3 px-5 py-3.5">
        <button
          type="button"
          onClick={onBack}
          className="rounded p-1.5 hover:bg-white/20"
          aria-label="Voltar"
        >
          <ArrowLeft className="size-5 text-white" />
        </button>
        <h1 className="text-base font-semibold text-white">{title}</h1>
      </div>

      <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[1fr_260px]">
        <div className="min-h-0 space-y-6">{children}</div>
        <aside className="hidden shrink-0 space-y-4 lg:block">
          <DocumentoStepper activeStep={activeStep} />
          {version && users ? (
            <DocumentoLogsProcesso version={version} users={users} />
          ) : null}
        </aside>
      </div>

      <div className="sgq-form-footer">
        {footer}
      </div>
    </div>
  );
}
