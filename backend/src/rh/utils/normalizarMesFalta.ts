/**
 * Padrão da coluna MÊS FALTA: abreviação minúscula com ponto (`jan.`, `fev.`, `set.`).
 * Manter em sincronia com `frontend/src/modules/rh/pages/FaltasAtestados/mes-falta.ts`.
 */
const MES_FALTA_PADRAO: Record<string, string> = {
  jan: 'jan.',
  janeiro: 'jan.',
  fev: 'fev.',
  fevereiro: 'fev.',
  mar: 'mar.',
  marco: 'mar.',
  abr: 'abr.',
  abril: 'abr.',
  mai: 'mai.',
  maio: 'mai.',
  jun: 'jun.',
  junho: 'jun.',
  jul: 'jul.',
  julho: 'jul.',
  ago: 'ago.',
  agosto: 'ago.',
  set: 'set.',
  setembro: 'set.',
  out: 'out.',
  outubro: 'out.',
  nov: 'nov.',
  novembro: 'nov.',
  dez: 'dez.',
  dezembro: 'dez.',
};

const VALORES_PADRAO = new Set(Object.values(MES_FALTA_PADRAO));

/** Converte nome ou abreviação de mês para `mmm.`. Texto que não é mês permanece como está. */
export function normalizarMesFalta(value: unknown): string {
  const raw = value == null ? '' : String(value).trim();
  if (!raw) return '';
  const key = raw
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\./g, '')
    .replace(/\s+/g, '');
  return MES_FALTA_PADRAO[key] ?? raw;
}

/**
 * Destino da coluna só quando o texto é um mês reconhecido e ainda não está
 * gravado exatamente como `jan.`, `fev.`, `set.` etc. Qualquer outro texto devolve null.
 */
export function destinoMesFaltaSeForaDoPadrao(valor: string | null | undefined): string | null {
  if (valor == null || valor === '') return null;
  const destino = normalizarMesFalta(valor);
  if (!VALORES_PADRAO.has(destino) || destino === valor) return null;
  return destino;
}
