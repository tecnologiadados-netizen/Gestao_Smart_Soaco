export const ROTULO_CARTORIO_SIM = 'SIM';
export const ROTULO_CARTORIO_NAO = '—';

export function textoCartorio(sim: boolean | null | undefined): string {
  return sim ? ROTULO_CARTORIO_SIM : ROTULO_CARTORIO_NAO;
}

export function BadgeCartorio({ sim }: { sim: boolean | null | undefined }) {
  if (!sim) {
    return <span className="text-slate-400">{ROTULO_CARTORIO_NAO}</span>;
  }
  return (
    <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
      {ROTULO_CARTORIO_SIM}
    </span>
  );
}
