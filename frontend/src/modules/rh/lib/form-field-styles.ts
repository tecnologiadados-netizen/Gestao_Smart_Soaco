/**
 * PADRÃO VISUAL DE FORMULÁRIOS DO MÓDULO RH (temas claro e escuro).
 *
 * Hierarquia de fundos:
 *   - Página / modal ........... var(--background)
 *   - Container de campos ...... var(--card) SÓLIDO (rhFormSection)
 *   - Campo editável ........... var(--background) (rebaixado em relação ao card)
 *   - Campo readonly/disabled .. var(--muted)
 *
 * Toda tela nova do RH deve importar estas constantes em vez de redefinir
 * strings locais (`dashedInput`, `FormSection`, etc.). As regras CSS em
 * `rh-module.css` reforçam os mesmos fundos para inputs nativos.
 */

/** Rótulo padrão acima do campo. */
export const rhFieldLabel = "text-xs font-medium text-muted-foreground mb-1.5 block";

/** Input editável padrão (nativo ou <Input/>). Já cobre readonly/disabled. */
export const rhFieldInput =
  "flex h-9 w-full min-w-0 rounded-lg border border-dashed border-muted-foreground/35 bg-background px-3 text-sm text-foreground shadow-none transition-colors placeholder:text-muted-foreground/70 file:mr-3 file:h-8 file:border-0 file:bg-transparent file:text-sm focus-visible:border-solid focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0 read-only:cursor-default read-only:bg-muted read-only:border-muted-foreground/25 read-only:text-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:border-muted-foreground/25 disabled:text-foreground disabled:opacity-100 md:text-sm";

/** Modificador para campo somente leitura (acrescentar após rhFieldInput). */
export const rhFieldInputRead =
  "cursor-default bg-muted border-muted-foreground/25 text-foreground placeholder:text-foreground read-only:text-foreground";

/** <select> nativo padrão. */
export const rhFieldSelectNative =
  "flex h-9 w-full min-w-0 appearance-none rounded-lg border border-dashed border-muted-foreground/35 bg-background px-3 pr-9 text-sm text-foreground shadow-none transition-colors focus-visible:border-solid focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-muted disabled:border-muted-foreground/25 disabled:text-foreground disabled:opacity-100";

/** Trigger do <Select/> (shadcn/Radix). */
export const rhFieldSelectTrigger =
  "h-9 w-full min-w-0 rounded-lg border border-dashed border-muted-foreground/35 bg-background text-foreground shadow-none focus:ring-2 focus:ring-ring/25 focus:ring-offset-0 [&>span]:line-clamp-1";

/** Textarea padrão. Ajuste min-h no consumidor se precisar de mais altura. */
export const rhFieldTextarea =
  "flex min-h-[88px] w-full resize-y rounded-lg border border-dashed border-muted-foreground/35 bg-background px-3 py-2.5 text-sm text-foreground shadow-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-solid focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0 read-only:cursor-default read-only:bg-muted read-only:border-muted-foreground/25 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-100";

/** Botão de combobox (Popover + Command). */
export const rhFieldCombo =
  "h-9 w-full min-w-0 justify-between rounded-lg border border-dashed border-muted-foreground/35 bg-background font-normal text-sm text-foreground shadow-none hover:bg-muted/40 hover:text-foreground";

/** Container de seção de formulário (o "quadro" que agrupa campos). */
export const rhFormSection =
  "rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden";

/** Cabeçalho da seção. */
export const rhFormSectionHeader =
  "border-b border-border/70 bg-muted/50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-foreground";

/** Corpo da seção. */
export const rhFormSectionBody = "p-4 sm:p-5";
