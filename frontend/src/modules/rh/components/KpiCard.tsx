import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  alertColor?: "green" | "yellow" | "red";
  /** Textos longos (nomes, locais): quebra em várias linhas em vez de truncar em uma linha. */
  valueMultiline?: boolean;
}

const alertColors = {
  green: "bg-success",
  yellow: "bg-accent",
  red: "bg-destructive",
};

const KpiCard = ({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  alertColor = "green",
  valueMultiline = false,
}: KpiCardProps) => {
  return (
    <div
      className="relative min-w-0 w-full overflow-hidden border border-border bg-card p-5 shadow-level-1 transition-all duration-200 hover:-translate-y-1 hover:shadow-level-2 sm:p-6"
    >
      <div className={`alert-strip ${alertColors[alertColor]}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="label-industrial block leading-snug">{title}</span>
          <div className="mt-2 space-y-1.5">
            <span
              className={
                valueMultiline
                  ? "block min-w-0 max-w-full text-base font-bold leading-snug text-foreground [font-variant-numeric:proportional-nums] [overflow-wrap:anywhere] break-words hyphens-auto sm:text-lg"
                  : "kpi-value block text-xl leading-tight tabular-nums sm:text-2xl whitespace-nowrap"
              }
            >
              {value}
            </span>
            {change ? (
              <span
                className={`block max-w-full text-[11px] sm:text-xs font-semibold leading-snug break-words hyphens-auto ${
                  changeType === "positive"
                    ? "text-success"
                    : changeType === "negative"
                      ? "text-destructive"
                      : "text-muted-foreground"
                }`}
              >
                {change}
              </span>
            ) : null}
          </div>
        </div>
        <div className="w-9 h-9 shrink-0 bg-muted flex items-center justify-center sm:w-10 sm:h-10">
          <Icon className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
};

export default KpiCard;
