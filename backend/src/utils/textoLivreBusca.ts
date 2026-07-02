/**
 * Busca de texto livre com refinamento via `%` (estilo SQL LIKE).
 *
 * Padrão do projeto:
 * - Sem `%`: contém o termo (ignora maiúsculas/minúsculas e acentos).
 * - Com `%`: `%` = qualquer sequência; ex.: `São%` (prefixo), `%Paulo` (sufixo), `%cent%` (meio).
 */

/** Normaliza texto para comparação em filtros (trim, sem acentos, minúsculas). */
export function normalizarTextoBusca(s: string): string {
  const t = String(s ?? '').trim();
  if (!t) return '';
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Retorna função que testa se `valor` casa com `termo`.
 * Termo vazio → aceita qualquer valor.
 */
export function criarMatcherTextoLivre(termo: string): (valor: string) => boolean {
  const t = termo.trim();
  if (!t) return () => true;
  const termoNorm = normalizarTextoBusca(t);
  if (t.includes('%')) {
    const parts = t.split('%');
    const regexStr = parts
      .map((p) => escaparRegex(normalizarTextoBusca(p)))
      .join('.*');
    const regex = new RegExp(`^${regexStr}$`, 'i');
    return (val) => regex.test(normalizarTextoBusca(val));
  }
  return (val) => normalizarTextoBusca(val).includes(termoNorm);
}

/** Atalho: `termo` vazio → true. */
export function textoPassaBuscaLivre(termo: string, valor: string): boolean {
  return criarMatcherTextoLivre(termo)(valor);
}

/** Escapa `%`, `_` e `\` para uso literal em SQL LIKE (modo “contém”). */
export function escaparLikeSql(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Converte termo digitado pelo usuário em padrão SQL LIKE.
 * - Sem `%`: envolve com `%termo%` (contém).
 * - Com `%`: mantém curingas do usuário; escapa apenas `_` literal.
 */
export function termoParaPadraoLikeSql(termo: string): string {
  const t = termo.trim();
  if (!t) return '%';
  if (t.includes('%')) {
    return t.replace(/\\/g, '\\\\').replace(/_/g, '\\_');
  }
  return `%${escaparLikeSql(t)}%`;
}
