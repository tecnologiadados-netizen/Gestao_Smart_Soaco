/** Paleta de preenchimento no formato do Excel: cores do tema, cores padrão e mais cores. */

const CORES_ANTIGAS: Record<string, string> = {
  laranja_claro: '#F6D7A8',
  laranja: '#F0A202',
  azul: '#A9C6E3',
  rosa: '#F0BBA8',
  amarelo: '#FFE14A',
};

/** Tema padrão do Excel (Microsoft 365): 10 colunas × 6 variações, na mesma ordem do seletor. */
export const CORES_TEMA_EXCEL: string[][] = [
  ['#FFFFFF', '#000000', '#E8E8E8', '#0E2841', '#156082', '#E97132', '#196B24', '#0F9ED5', '#A02B93', '#4EA72E'],
  ['#F2F2F2', '#7F7F7F', '#D0D0D0', '#DBE9F7', '#C1E4F5', '#FAE2D6', '#C1F0C8', '#CAEDFB', '#F1CEEE', '#D9F2D0'],
  ['#D8D8D8', '#595959', '#AEAEAE', '#A6C9EB', '#83CAEB', '#F6C6AC', '#84E291', '#95DCF7', '#E49EDD', '#B3E5A1'],
  ['#BFBFBF', '#3F3F3F', '#747474', '#4D94D8', '#45B0E1', '#F1A984', '#47D45A', '#60CBF3', '#D76DCC', '#8ED873'],
  ['#A5A5A5', '#262626', '#3A3A3A', '#215E99', '#0F4861', '#BF4F14', '#12501B', '#0B769F', '#78206E', '#3A7D22'],
  ['#7F7F7F', '#0C0C0C', '#171717', '#153D64', '#0A3041', '#7F340D', '#0C3512', '#074F6A', '#501549', '#265316'],
];

export const CORES_PADRAO_EXCEL = [
  '#C00000',
  '#FF0000',
  '#FFC000',
  '#FFFF00',
  '#92D050',
  '#00B050',
  '#00B0F0',
  '#0070C0',
  '#002060',
  '#7030A0',
] as const;

export type CorObservacaoDiario = string;

export function corObservacaoDiario(valor: string | null | undefined): string | null {
  const cru = valor?.trim() ?? '';
  if (!cru) return null;
  const antiga = CORES_ANTIGAS[cru];
  if (antiga) return antiga;
  return /^#[0-9a-fA-F]{6}$/.test(cru) ? cru.toUpperCase() : null;
}

export function hexObservacaoDiario(valor: string | null | undefined): string | null {
  return corObservacaoDiario(valor);
}
