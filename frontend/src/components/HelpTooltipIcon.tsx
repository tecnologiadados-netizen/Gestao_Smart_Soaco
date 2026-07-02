/** Ícone ? com texto exibido ao passar o mouse (title nativo). */
export default function HelpTooltipIcon({ text }: { text: string }) {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 cursor-help select-none items-center justify-center rounded-full border border-slate-300 text-[11px] text-slate-600 dark:border-slate-600 dark:text-slate-300"
      title={text}
      aria-label={text}
      role="img"
    >
      ?
    </span>
  );
}
