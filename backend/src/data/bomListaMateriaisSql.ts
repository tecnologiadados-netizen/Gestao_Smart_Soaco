/**
 * BOM explosão 5 níveis para PA (tipos 8/15) — único ponto de verdade alinhado à planilha.
 * O filtro de lista nível 1 espelha sqlRegistroColetaPrecos / análise de estoques.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Filtro lm (nível 1) — Lista Produção / Precificação / Parcial, padrão. */
export const BOM_LISTA_MATERIAIS_LM_WHERE =
  `(lm.descricao LIKE 'Lista%Produ__o' OR lm.descricao LIKE 'Lista%Precifica__o' OR lm.descricao LIKE 'Lista%Parci%') AND (lm.padrao = 1) AND`;

let acabadoCache: string | null = null;

/** BOM completo (outer select + ft) com bind opcional por idProduto pai. */
export function loadBomListaMateriaisAcabadoSql(): string {
  if (acabadoCache) return acabadoCache;
  acabadoCache = readFileSync(join(__dirname, 'bomListaMateriaisAcabado.sql'), 'utf8').trim();
  return acabadoCache;
}

/** Mesmo BOM, sem `pq.idProduto = ?` (join em lote por componente). */
export function loadBomListaMateriaisAcabadoSemProdutoSql(): string {
  return loadBomListaMateriaisAcabadoSql().replace(
    /Where \(pq\.idProduto = \?\)\s+And\s+/i,
    'Where '
  );
}
