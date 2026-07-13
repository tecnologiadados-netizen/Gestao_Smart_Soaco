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

const iconColors = {
  green:
    "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800/70",
  yellow:
    "bg-amber-50 text-amber-700 ring-1 ring-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800/70",
  red:
    "bg-rose-50 text-rose-700 ring-1 ring-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-800/70",
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
      className="group relative min-w-0 w-full overflow-hidden rounded-xl border border-border bg-card p-5 shadow-level-1 transition-all duration-200 hover:-translate-y-1 hover:border-primary/25 hover:shadow-level-2 sm:p-6"
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
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105 sm:h-10 sm:w-10 ${iconColors[alertColor]}`}
        >
          <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
        </div>
      </div>
    </div>
  );
};

export default KpiCard;
