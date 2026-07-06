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
}

export function DocumentoStepper({
  activeStep = 0,
  variant = "cadastro",
}: DocumentoStepperProps) {
  const steps = variant === "revisao" ? revisaoSteps : cadastroSteps;
  return (
    <div className="brand-fieldset rounded-lg p-4">
      <h2 className="mb-4 text-base font-semibold text-brand-navy">
        Etapas do processo
      </h2>
      <ol className="space-y-0">
      {steps.map((step, index) => {
        const isActive = index === activeStep;
        const isDone = index < activeStep;
        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  isActive &&
                    "bg-brand-blue text-white ring-2 ring-brand-yellow ring-offset-2",
                  isDone && "bg-brand-blue text-white",
                  !isActive && !isDone && "bg-white text-brand-gray ring-1 ring-border"
                )}
              >
                {index + 1}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "my-1 h-6 w-0.5",
                    isDone ? "bg-brand-blue" : "bg-brand-blue-muted"
                  )}
                />
              )}
            </div>
            <p
              className={cn(
                "pt-2 text-base leading-snug",
                isActive && "font-bold text-brand-blue",
                isDone && "font-medium text-brand-navy",
                !isActive && !isDone && "text-brand-gray"
              )}
            >
              {step}
            </p>
          </li>
        );
      })}
      </ol>
    </div>
  );
}
