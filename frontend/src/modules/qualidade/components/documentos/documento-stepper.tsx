import { cn } from "@qualidade/lib/utils";

const cadastroSteps = [
  "Cadastro inicial",
  "Elaboração",
  "Consenso",
  "Aprovação",
  "Publicação",
];

const revisaoSteps = [
  "Configurações da revisão",
  "Elaboração",
  "Consenso",
  "Aprovação",
  "Publicação",
];

interface DocumentoStepperProps {
  activeStep?: number;
  variant?: "cadastro" | "revisao";
  className?: string;
}

export function DocumentoStepper({
  activeStep = 0,
  variant = "cadastro",
  className,
}: DocumentoStepperProps) {
  const steps = variant === "revisao" ? revisaoSteps : cadastroSteps;

  return (
    <ol className={cn("sgq-doc-timeline", className)} aria-label="Etapas do processo">
      {steps.map((step, index) => {
        const isActive = index === activeStep;
        const isDone = index < activeStep;
        const state = isActive ? "active" : isDone ? "done" : "pending";

        return (
          <li key={step} className="sgq-doc-timeline-item" data-state={state}>
            <div className="sgq-doc-timeline-track" aria-hidden="true">
              <span className="sgq-doc-timeline-dot">{index + 1}</span>
            </div>
            <span className="sgq-doc-timeline-label">{step}</span>
          </li>
        );
      })}
    </ol>
  );
}
