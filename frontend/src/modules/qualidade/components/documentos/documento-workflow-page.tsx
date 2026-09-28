import { createPortal } from "react-dom";
import { FormModalHeader, useMarcarFormularioAberto } from "@qualidade/components/ui/form-modal";
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
  useMarcarFormularioAberto(!exiting);

  return createPortal(
    <>
      <div className="sgq-form-page-backdrop" onClick={onBack} aria-hidden="true" />
      <div
        className={cn(
          "sgq-form-page sgq-form-page-frame is-wide",
          exiting && "sgq-view-exit"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sgq-dialog-surface flex max-h-[min(92vh,100dvh)] w-full flex-col overflow-hidden bg-card text-card-foreground">
          <FormModalHeader titulo={title} onClose={onBack} />
          <div className="sgq-doc-timeline-bar">
            <DocumentoStepper activeStep={activeStep} />
          </div>

          <div
            className={cn(
              "grid min-h-0 flex-1 gap-6 overflow-y-auto px-7 py-5",
              version && users && "lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]"
            )}
          >
            <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
              {children}
            </div>
            {version && users ? (
              <aside className="hidden min-w-0 lg:block">
                <DocumentoLogsProcesso version={version} users={users} />
              </aside>
            ) : null}
          </div>

          <div className="sgq-form-footer">{footer}</div>
        </div>
      </div>
    </>,
    document.body
  );
}
