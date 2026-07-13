/**
 * Mapeia colunas do arquivo Excel importado → índices lógicos de ORGANICO_HEADERS.
 * Importação só por posição quebra quando a planilha tem ordem/nomes diferentes (ex.: CRM vs CNH),
 * deixando colunas “vazias” na exportação.
 */
import { ORGANICO_HEADERS, ORGANICO_NUM_COLUNAS } from "./organico-headers";

export type OrganicoPaddedRow = (string | number)[];

/** Normaliza rótulo de cabeçalho para comparação (trim, espaços, acentos). */
export function normalizeOrganicoHeaderLabel(x: unknown): string {
  return String(x ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/´/g, "'")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // sufixo visual da exportação para colunas protegidas
    .replace(/\s*\(\s*secullum\s*\)\s*$/g, "");
}

/**
 * Cabeçalhos alternativos por índice lógico (já normalizados ou serão normalizados na busca).
 * Inclui variações comuns em planilhas RH.
 */
const ORGANICO_IMPORT_HEADER_ALIASES: Record<number, readonly string[]> = {
  4: ["crm categoria", "categoria crm", "cat. crm", "categoria cnh"],
  5: ["numero crm", "n crm", "nº crm", "crm numero", "numero cnh", "nº cnh"],
  6: ["carga horaria", "ch mensal", "carga horaria mensal", "jornada mensal"],
  7: ["turno de trabalho"],
  8: ["escala", "jornada"],
  15: ["gestor direto", "lider imediato", "superior imediato", "chefe imediato"],
  16: ["gestor indireto", "lider indireto", "superior indireto", "gestor 2"],
  17: ["dir", "direcao"],
  18: ["pis/pasep", "nit"],
  21: ["grau de instrucao", "escolaridade", "instrucao", "formacao"],
  28: ["filhos", "numero de filhos"],
  29: ["numero de dependentes", "dependentes", "n dependentes"],
  30: ["telefone secullum", "tel", "celular", "telefone celular"],
  31: ["telefone emergencial secullum", "tel emergencial", "contato emergencia", "telefone de emergencia"],
  72: ["adendo", "adendo por fora"],
  73: ["salario + adendo", "salario + por fora"],
  74: ["salario + adendo + adicionais", "salario + por fora + adicionais"],
};

function expectedHeaderVariants(logicalIndex: number): string[] {
  const main = normalizeOrganicoHeaderLabel(ORGANICO_HEADERS[logicalIndex]);
  const rawAliases = ORGANICO_IMPORT_HEADER_ALIASES[logicalIndex] ?? [];
  const aliases = rawAliases.map((a) => normalizeOrganicoHeaderLabel(a));
  const set = new Set<string>();
  if (main) set.add(main);
  for (const a of aliases) {
    if (a) set.add(a);
  }
  return [...set];
}

function fileColumnMatchesLogical(fileLabel: string, logicalIndex: number): boolean {
  if (!fileLabel) return false;
  const variants = expectedHeaderVariants(logicalIndex);
  return variants.some((v) => v === fileLabel);
}

export type OrganicoColumnMapResult = {
  map: number[];
  warnings: string[];
};

/**
 * Para cada índice lógico h (0..ORGANICO_NUM_COLUNAS-1), retorna o índice da coluna no arquivo .xlsx.
 */
export function buildOrganicoSourceColumnMapWithWarnings(headerRow: unknown[]): OrganicoColumnMapResult {
  const fileLabels = (headerRow ?? []).map(normalizeOrganicoHeaderLabel);
  const used = new Set<number>();
  const map: number[] = [];
  const warnings: string[] = [];
  const fallbackUsed = new Set<number>();

  const takeFirstMatch = (logicalIndex: number): number => {
    for (let k = 0; k < fileLabels.length; k++) {
      if (used.has(k)) continue;
      const fl = fileLabels[k];
      if (fileColumnMatchesLogical(fl, logicalIndex)) {
        return k;
      }
    }
    return -1;
  };

  // Coluna 0 (matrícula): preferir cabeçalho explícito; depois coluna com título vazio; senão A
  const explicitMatricula = ["id", "matricula", "codigo", "cod", "nr", "nº", "numero", "mat", "funcional"];
  let col0 = -1;
  for (const label of explicitMatricula) {
    const k = fileLabels.findIndex((fl) => fl === label);
    if (k >= 0) {
      col0 = k;
      break;
    }
  }
  if (col0 < 0) {
    const kEmpty = fileLabels.findIndex((fl) => fl === "");
    col0 = kEmpty >= 0 ? kEmpty : 0;
    if (kEmpty < 0) {
      warnings.push("Coluna MATRICULA não identificada pelo cabeçalho; usando coluna A.");
    }
  }
  used.add(col0);
  map.push(col0);

  for (let h = 1; h < ORGANICO_NUM_COLUNAS; h++) {
    let found = takeFirstMatch(h);
    if (found < 0) {
      // Fallback posicional (planilha modelo alinhada)
      found = h < fileLabels.length ? h : Math.min(h, Math.max(0, fileLabels.length - 1));
      fallbackUsed.add(h);
    } else {
      used.add(found);
    }
    map.push(found);
  }

  const reusedPhysical = new Map<number, number[]>();
  for (let h = 0; h < map.length; h++) {
    const physical = map[h]!;
    const list = reusedPhysical.get(physical) ?? [];
    list.push(h);
    reusedPhysical.set(physical, list);
  }
  for (const [physical, logicalIndices] of reusedPhysical) {
    if (logicalIndices.length > 1) {
      const labels = logicalIndices
        .map((h) => ORGANICO_HEADERS[h] ?? `Col ${h + 1}`)
        .join(", ");
      warnings.push(
        `Coluna física ${physical + 1} do arquivo mapeada para vários campos (${labels}). Verifique se os cabeçalhos estão corretos.`,
      );
    }
  }

  if (fallbackUsed.size > 0 && fallbackUsed.size >= 5) {
    warnings.push(
      `${fallbackUsed.size} coluna(s) usaram mapeamento posicional por falta de cabeçalho correspondente. Reexporte pelo sistema se possível.`,
    );
  }

  if (fileLabels.length > 0 && fileLabels.length < ORGANICO_NUM_COLUNAS) {
    warnings.push(
      `Planilha com ${fileLabels.length} coluna(s) no cabeçalho; o modelo espera ${ORGANICO_NUM_COLUNAS}. Colunas extras podem estar desalinhadas.`,
    );
  }

  return { map, warnings };
}

export function buildOrganicoSourceColumnMap(headerRow: unknown[]): number[] {
  return buildOrganicoSourceColumnMapWithWarnings(headerRow).map;
}

/** Coluna inserida na v2 do schema (Número de dependentes). Planilhas com 86 colunas são migradas aqui. */
export const ORGANICO_SCHEMA_INSERT_INDEX = 29;
export const ORGANICO_LEGACY_NUM_COLUNAS = 86;

/** Migra linha 86→87 colunas (insere vazio em Número de dependentes). */
export function migrateOrganicoRowSchema(row: unknown[] | undefined | null): unknown[] {
  const cells = Array.isArray(row) ? [...row] : [];
  if (cells.length >= ORGANICO_NUM_COLUNAS) {
    return cells.slice(0, ORGANICO_NUM_COLUNAS);
  }
  if (cells.length === ORGANICO_LEGACY_NUM_COLUNAS) {
    const out = [...cells];
    out.splice(ORGANICO_SCHEMA_INSERT_INDEX, 0, "");
    return out;
  }
  return cells;
}

/** Garante array com ORGANICO_NUM_COLUNAS elementos (para exportação e gravação). */
export function padOrganicoRow(row: unknown[] | undefined | null): OrganicoPaddedRow {
  const migrated = migrateOrganicoRowSchema(row);
  const cells = Array.isArray(migrated) ? [...migrated] : [];
  while (cells.length < ORGANICO_NUM_COLUNAS) cells.push("");
  return cells.slice(0, ORGANICO_NUM_COLUNAS) as OrganicoPaddedRow;
}
