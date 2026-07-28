import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { Pool } from 'mysql2/promise';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VAR_DIR = join(__dirname, '..', '..', 'var', 'ressup-nao-almox-catalog');
const OVERRIDES_FILE = join(VAR_DIR, 'overrides.json');

/** Token nos SQLs de explosão (VM/empenho): substituído em runtime. */
export const TOKEN_EXCLUIR_IDS_PINTADOS = '__EXCLUIR_IDS_PINTADOS__';

/** Par fundível resolvido no Nomus (pintado → sem pintura). */
export type FundivelParNomus = {
  idPintado: number;
  idSem: number;
  /** qtdeNecessaria do sem pintura na lista do pintado (default 1). */
  fatorSem: number;
};

export type RessupNaoAlmoxCatalogOverrides = {
  descricoes: Record<string, string>;
  fundiveis: Record<string, string>;
};

function normalizarCodProduto(cod: string): string {
  return cod.trim().replace(/\s+/g, ' ');
}

function resolveSeedPath(filename: string): string | null {
  const candidates = [
    join(process.cwd(), 'frontend', 'src', 'data', filename),
    join(process.cwd(), '..', 'frontend', 'src', 'data', filename),
    join(__dirname, '..', '..', '..', 'frontend', 'src', 'data', filename),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function readSeedJson<T>(filename: string): T {
  const path = resolveSeedPath(filename);
  if (!path) return {} as T;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return {} as T;
  }
}

function ensureVarDir(): void {
  if (!existsSync(VAR_DIR)) mkdirSync(VAR_DIR, { recursive: true });
}

function readOverrides(): RessupNaoAlmoxCatalogOverrides {
  ensureVarDir();
  if (!existsSync(OVERRIDES_FILE)) {
    return { descricoes: {}, fundiveis: {} };
  }
  try {
    const raw = JSON.parse(readFileSync(OVERRIDES_FILE, 'utf-8')) as Partial<RessupNaoAlmoxCatalogOverrides>;
    return {
      descricoes: raw.descricoes && typeof raw.descricoes === 'object' ? raw.descricoes : {},
      fundiveis: raw.fundiveis && typeof raw.fundiveis === 'object' ? raw.fundiveis : {},
    };
  } catch {
    return { descricoes: {}, fundiveis: {} };
  }
}

function writeOverrides(overrides: RessupNaoAlmoxCatalogOverrides): void {
  ensureVarDir();
  writeFileSync(OVERRIDES_FILE, `${JSON.stringify(overrides, null, 2)}\n`, 'utf-8');
}

function mergeCatalogs(): {
  descricoes: Record<string, string>;
  fundiveis: Record<string, string>;
} {
  const baseDesc = readSeedJson<Record<string, string>>('ressupNaoAlmoxDescricoesSimplificadas.json');
  const baseFund = readSeedJson<Record<string, string>>('ressupNaoAlmoxFundiveisPares.json');
  const overrides = readOverrides();
  return {
    descricoes: { ...baseDesc, ...overrides.descricoes },
    fundiveis: { ...baseFund, ...overrides.fundiveis },
  };
}

export function loadRessupNaoAlmoxCatalogo(): {
  descricoes: Record<string, string>;
  fundiveis: Record<string, string>;
} {
  return mergeCatalogs();
}

export function saveCatalogoDescricaoSimplificadaNaoAlmox(
  codProduto: string,
  descricao: string | null
): { descricoes: Record<string, string> } {
  const key = normalizarCodProduto(codProduto);
  if (!key) throw new Error('Código do produto inválido.');
  const overrides = readOverrides();
  const texto = descricao?.trim() ?? '';
  if (texto) {
    overrides.descricoes[key] = texto;
  } else {
    delete overrides.descricoes[key];
  }
  writeOverrides(overrides);
  return { descricoes: mergeCatalogs().descricoes };
}

export function saveCatalogoFundivelPar(
  codSemPintura: string,
  codComPintura: string | null
): { fundiveis: Record<string, string> } {
  const key = normalizarCodProduto(codSemPintura);
  if (!key) throw new Error('Código sem pintura inválido.');
  const overrides = readOverrides();
  const pintado = codComPintura?.trim() ?? '';
  if (pintado && pintado !== key) {
    overrides.fundiveis[key] = normalizarCodProduto(pintado);
  } else {
    delete overrides.fundiveis[key];
  }
  writeOverrides(overrides);
  return { fundiveis: mergeCatalogs().fundiveis };
}

/** Mapa invertido: código com pintura → código sem pintura (para deduplicar grade). */
export function buildMapCodigosPintados(fundiveis: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [sem, com] of Object.entries(fundiveis)) {
    const k = normalizarCodProduto(com);
    if (k) map.set(k, normalizarCodProduto(sem));
  }
  return map;
}

/** Cláusula SQL: exclui ids pintados do agregado final (mantém explosão intermediária). */
export function sqlClauseExcluirIdsPintados(idsPintados: number[], column = 'idComponente'): string {
  const ids = [...new Set(idsPintados.filter((id) => Number.isFinite(id) && id > 0))];
  if (ids.length === 0) return '1=1';
  return `${column} NOT IN (${ids.join(',')})`;
}

/** Substitui `__EXCLUIR_IDS_PINTADOS__` pela cláusula NOT IN (ou 1=1). */
export function applyExcluirIdsPintadosToken(sql: string, idsPintados: number[]): string {
  return sql.split(TOKEN_EXCLUIR_IDS_PINTADOS).join(sqlClauseExcluirIdsPintados(idsPintados));
}

/**
 * Resolve no Nomus os ids dos pares fundíveis (catálogo sem→com pintura)
 * e o fator BOM do sem pintura na lista do pintado.
 */
export async function resolverFundiveisParesNomus(pool: Pool): Promise<FundivelParNomus[]> {
  const { fundiveis } = loadRessupNaoAlmoxCatalogo();
  const paresCod: { sem: string; com: string }[] = [];
  for (const [sem, com] of Object.entries(fundiveis)) {
    const s = normalizarCodProduto(sem);
    const c = normalizarCodProduto(com);
    if (s && c && s !== c) paresCod.push({ sem: s, com: c });
  }
  if (paresCod.length === 0) return [];

  const codigos = [...new Set(paresCod.flatMap((p) => [p.sem, p.com]))];
  const ph = codigos.map(() => '?').join(', ');
  const [prodRows] = await pool.query(
    `SELECT id, nome FROM produto WHERE nome IN (${ph})`,
    codigos
  );
  const idByNome = new Map<string, number>();
  for (const r of Array.isArray(prodRows) ? (prodRows as Array<{ id: number; nome: string }>) : []) {
    idByNome.set(normalizarCodProduto(String(r.nome ?? '')), Number(r.id));
  }

  const out: FundivelParNomus[] = [];
  for (const { sem, com } of paresCod) {
    const idSem = idByNome.get(sem);
    const idPintado = idByNome.get(com);
    if (!idSem || !idPintado) continue;

    let fatorSem = 1;
    const [fatorRows] = await pool.query(
      `SELECT CAST(REPLACE(pq.qtdeNecessaria, ',', '.') AS DECIMAL(20,6)) AS fator
       FROM listamateriais lm
       INNER JOIN produtoqtde pq
         ON pq.idListaMateriais = lm.id AND pq.idProdutoComponente = ?
       WHERE lm.idProduto = ?
         AND lm.padrao = 1
         AND COALESCE(lm.ativo, 1) = 1
         AND COALESCE(lm.discriminador, 'Original') = 'Original'
       ORDER BY
         CASE
           WHEN lm.descricao LIKE 'Lista%Produ__o' THEN 1
           WHEN lm.descricao LIKE 'Lista%Precifica__o' THEN 2
           WHEN lm.descricao LIKE 'Lista%Parci%' THEN 3
           ELSE 9
         END,
         lm.id
       LIMIT 1`,
      [idSem, idPintado]
    );
    const fatorList = Array.isArray(fatorRows) ? (fatorRows as Array<{ fator: number | string }>) : [];
    const fatorRaw = fatorList[0] ? Number(fatorList[0].fator) : NaN;
    if (Number.isFinite(fatorRaw) && fatorRaw > 0) fatorSem = fatorRaw;

    out.push({ idPintado, idSem, fatorSem });
  }
  return out;
}

export function idsPintadosFromPares(pares: FundivelParNomus[]): number[] {
  return pares.map((p) => p.idPintado);
}

/** Subquery SQL (UNION) pintado → sem + fator, ou NULL se vazio. */
export function sqlFundiveisMapSubquery(pares: FundivelParNomus[]): string | null {
  if (pares.length === 0) return null;
  const parts = pares.map(
    (p) =>
      `SELECT ${p.idPintado} AS id_pintado, ${p.idSem} AS id_sem, ${Number(p.fatorSem)} AS fator_sem`
  );
  return parts.join('\n    UNION ALL\n    ');
}

export { normalizarCodProduto };
