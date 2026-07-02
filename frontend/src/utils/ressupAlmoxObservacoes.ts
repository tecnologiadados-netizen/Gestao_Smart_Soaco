/** Colunas da grade Ressup Almox que aceitam observação por célula. */
export const RESSUP_OBS_COL_KEYS = ['qtdeSug', 'dataNecessSug', 'qtdAprov', 'dataNecessAprov'] as const;

export type RessupObsColKey = (typeof RESSUP_OBS_COL_KEYS)[number];

const OBS_SET = new Set<string>(RESSUP_OBS_COL_KEYS);

export function isRessupObsColKey(key: string): key is RessupObsColKey {
  return OBS_SET.has(key);
}

export type RessupRowObservacoes = Partial<Record<RessupObsColKey, string>>;

export type RessupRowUserInputs = Partial<Record<string, string>> & {
  observacoes?: RessupRowObservacoes;
};

export function getRessupObservacao(
  inputs: RessupRowUserInputs | undefined,
  col: RessupObsColKey
): string {
  return (inputs?.observacoes?.[col] ?? '').trim();
}

export function hasRessupObservacao(
  inputs: RessupRowUserInputs | undefined,
  col: RessupObsColKey
): boolean {
  return getRessupObservacao(inputs, col).length > 0;
}

/** Classes de destaque na célula quando há observação gravada. */
export const RESSUP_TD_COM_OBS_CLASS =
  'bg-amber-50/90 dark:bg-amber-950/35 ring-1 ring-inset ring-amber-200/80 dark:ring-amber-800/50';
