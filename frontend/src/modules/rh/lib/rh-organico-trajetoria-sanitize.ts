/**
 * Espelho de supabase/functions/_shared/rh-organico-trajetoria-sanitize.ts
 * para o bundle do Vite (parse de trajetória no browser).
 */

export function normalizeSpacesTrajetoria(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/** Corta antes de ruídos típicos de seção de férias quando "Férias" não aparece literalmente antes deles. */
const SALARIO_MOTIVO_NOISE: RegExp[] = [
  /\bPER[ÍI]ODO\s+AQUISITIVO\b/i,
  /\bPER[ÍI]ODO\s+GOZO\b/i,
  /\bABONO\s+PECUNI[ÁA]RIO\b/i,
  /\b(?:^|[\s;,])-\s*PER[ÍI]ODO\b/i,
];

/** Tudo a partir da palavra inteira Férias/ferias (inclusive) deve ser descartado — PDF junta texto da folha de férias. */
const RE_WORD_FERIAS = /\bf(?:[ée]rias|erias)\b/i;

export function sanitizeSalaryMotivo(raw: string): string {
  let s = normalizeSpacesTrajetoria(raw);
  if (!s) return s;

  RE_WORD_FERIAS.lastIndex = 0;
  const feriasHit = RE_WORD_FERIAS.exec(s);
  if (feriasHit?.index !== undefined) {
    s = s.slice(0, feriasHit.index).trim();
  }

  let cut = s.length;
  for (const re of SALARIO_MOTIVO_NOISE) {
    re.lastIndex = 0;
    const m = re.exec(s);
    if (m?.index !== undefined && m.index < cut) cut = m.index;
  }
  s = s.slice(0, cut).trim();

  s = s.replace(/\b(REAJUSTE\s+CCT)\s+INDICE\b/gi, "$1 ÍNDICE");

  return normalizeSpacesTrajetoria(s);
}
