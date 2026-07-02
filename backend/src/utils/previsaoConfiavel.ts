/** Interpreta SIM/NÃO (e variantes) para o flag de previsão confiável. */
export function parsePrevisaoConfiavel(val: unknown, defaultValue = true): boolean {
  if (val == null || val === '') return defaultValue;
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toUpperCase();
  if (['SIM', 'S', 'TRUE', 'VERDADEIRO', '1', 'YES'].includes(s)) return true;
  if (['NAO', 'NÃO', 'N', 'FALSE', 'FALSO', '0', 'NO'].includes(s)) return false;
  return defaultValue;
}

/** Valor inválido quando o usuário preencheu algo que não é SIM/NÃO reconhecível. */
export function previsaoConfiavelValorInvalido(val: unknown): boolean {
  if (val == null || val === '') return false;
  if (typeof val === 'boolean') return false;
  const s = String(val).trim().toUpperCase();
  if (!s) return false;
  const ok = ['SIM', 'S', 'TRUE', 'VERDADEIRO', '1', 'YES', 'NAO', 'NÃO', 'N', 'FALSE', 'FALSO', '0', 'NO'];
  return !ok.includes(s);
}
