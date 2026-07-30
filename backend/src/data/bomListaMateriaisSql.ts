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
let escopoCalendarioCache: string | null = null;

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

/**
 * Allowlist de componentes para Materiais do dia / Materiais críticos:
 * dwlc_componentes válidos + vínculo Almox Material Secundário.
 * Substitui `__IDS__` por lista numérica (`1,2,3`).
 */
export function loadComponentesEscopoCalendarioMateriaisSql(ids: number[]): string {
  if (ids.length === 0) return 'SELECT NULL AS idProduto WHERE 0';
  if (!escopoCalendarioCache) {
    escopoCalendarioCache = readFileSync(
      join(__dirname, 'componentesEscopoCalendarioMateriais.sql'),
      'utf8'
    ).trim();
  }
  const idsSql = ids.map((id) => String(Math.floor(id))).join(', ');
  return escopoCalendarioCache.replace(/__IDS__/g, idsSql);
}
