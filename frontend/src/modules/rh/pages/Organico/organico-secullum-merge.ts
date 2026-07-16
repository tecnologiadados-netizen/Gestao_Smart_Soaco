/**
 * Merge de dados Secullum na planilha Orgânico.
 * Campos espelhados da API sobrescrevem a linha quando há match por matrícula (fonte Secullum).
 * Campos que a API muitas vezes envia vazio (RG, PIS, etc.) só sobrescrevem se vier valor — não apaga dado já existente na planilha.
 */
import {
  type SecullumFuncionario,
  findSecullumFuncionarioByMatricula,
  normalizeMatriculaFolha,
} from "@rh/lib/api-client";
import type { OrganicoRow } from "@rh/types/api";
import { parseOrganicoValuesArray } from "@rh/lib/organico-normalize-api";
import { ORGANICO_HEADERS, ORGANICO_NUM_COLUNAS } from "./organico-headers";
import { ORGANICO_IDX, parseCtpsToNumber } from "./organico-derive";
import { calcularFormulasRow } from "./organico-formulas";
import type { OrganicoCell, OrganicoSheetRow } from "./useOrganicoImport";
import { ORGANICO_DETALHE_ORIGEM_API_SECULLUM } from "./organico-secullum-readonly";

function ensureCol(row: OrganicoCell[], idx: number): void {
  while (row.length <= idx) row.push("");
}

/** Só grava se a API mandou texto não vazio (preserva Excel/RH quando Secullum não tem o dado). */
function assignIfApiNonEmpty(row: OrganicoCell[], idx: number, apiVal: unknown): void {
  ensureCol(row, idx);
  const v = String(apiVal ?? "").trim();
  if (v === "") return;
  row[idx] = v;
}

/** Aplica na linha os campos vindos da Secullum. */
function applySecullumFieldsToRow(row: OrganicoCell[], f: SecullumFuncionario): void {
  ensureCol(row, ORGANICO_IDX.SITUACAO_TRABALHISTA);
  ensureCol(row, ORGANICO_IDX.STATUS);
  assignIfApiNonEmpty(row, ORGANICO_IDX.NOME, f.nome);
  row[ORGANICO_IDX.SITUACAO_TRABALHISTA] = String(f.statusDetalhado ?? "").trim();
  row[ORGANICO_IDX.STATUS] = String(f.statusFuncionario ?? (f.desligado ? "Desligado" : "Ativo")).trim() || "Ativo";

  const cpfDigits = (f.cpf || "").replace(/\D/g, "").slice(0, 11);
  if (cpfDigits.length === 11) {
    row[ORGANICO_IDX.CPF] = cpfDigits;
  } else if (String(f.cpf ?? "").trim() !== "") {
    row[ORGANICO_IDX.CPF] = String(f.cpf).trim();
  }

  assignIfApiNonEmpty(row, ORGANICO_IDX.RG, f.rg);
  assignIfApiNonEmpty(row, ORGANICO_IDX.PIS, f.pis);
  assignIfApiNonEmpty(row, ORGANICO_IDX.NASCIMENTO, f.nascimento);
  assignIfApiNonEmpty(row, ORGANICO_IDX.ADMISSAO, f.admissao);
  assignIfApiNonEmpty(row, ORGANICO_IDX.CARGO, f.cargo);
  // Area permanece como fonte do Orgânico (planilha/RH).
  assignIfApiNonEmpty(row, ORGANICO_IDX.SETOR, f.setor);
  // Telefone e telefone emergencial: fonte planilha/RH (não sobrescrever pela API Secullum).
  assignIfApiNonEmpty(row, ORGANICO_IDX.SEXO, f.sexo);

  if (f.ctps != null && String(f.ctps).trim() !== "") {
    ensureCol(row, ORGANICO_IDX.CTPS);
    row[ORGANICO_IDX.CTPS] = parseCtpsToNumber(f.ctps);
  }
}

/**
 * Matrículas novas criadas na sincronização Secullum (origem `API_SECULLUM` em DETALHAMENTO ARQUIVO),
 * que não existiam antes — indicam necessidade de cadastro complementar no Orgânico.
 */
export function collectNovosColaboradoresSecullumCadastroComplementar(
  prevRows: OrganicoSheetRow[],
  nextRows: OrganicoSheetRow[],
): Array<{ matricula: string; nome: string }> {
  const prevMat = new Set(
    prevRows
      .map((r) => normalizeMatriculaFolha(String(r[ORGANICO_IDX.MATRICULA] ?? "")))
      .filter((k) => k && k !== "0"),
  );
  const out: Array<{ matricula: string; nome: string }> = [];
  const seen = new Set<string>();
  for (const row of nextRows) {
    if (!Array.isArray(row)) continue;
    const mat = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
    const matKey = normalizeMatriculaFolha(mat);
    if (!matKey || matKey === "0" || prevMat.has(matKey)) continue;
    const detalhe = String(row[ORGANICO_NUM_COLUNAS - 1] ?? "").trim();
    if (detalhe !== ORGANICO_DETALHE_ORIGEM_API_SECULLUM) continue;
    if (seen.has(matKey)) continue;
    seen.add(matKey);
    const nome = String(row[ORGANICO_IDX.NOME] ?? "").trim() || "—";
    out.push({ matricula: mat, nome });
  }
  return out;
}

export function mergeSecullumIntoRows(
  prev: OrganicoSheetRow[],
  funcionarios: SecullumFuncionario[]
): OrganicoSheetRow[] {
  /** Evita linha duplicada quando Orgânico usa "000093" e Secullum manda "93". */
  const existingCanon = new Set(
    prev
      .map((r) => normalizeMatriculaFolha(String(r[ORGANICO_IDX.MATRICULA] ?? "")))
      .filter((k) => k && k !== "0"),
  );

  const next = prev.map((row) => {
    const id = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
    const f = id ? findSecullumFuncionarioByMatricula(funcionarios, id) : undefined;
    if (f != null) {
      const newRow = [...row];
      applySecullumFieldsToRow(newRow, f);
      calcularFormulasRow(newRow, { demissaoApi: f.demissao });
      return newRow;
    }
    return row;
  });

  for (const f of funcionarios) {
    const numeroFolha = String(f.numeroFolha ?? "").trim();
    if (!numeroFolha) continue;
    const canon = normalizeMatriculaFolha(numeroFolha);
    if (!canon || canon === "0") continue;
    if (existingCanon.has(canon)) continue;
    existingCanon.add(canon);
    const newRow: OrganicoCell[] = new Array(ORGANICO_HEADERS.length).fill("");
    newRow[ORGANICO_IDX.MATRICULA] = numeroFolha;
    applySecullumFieldsToRow(newRow, f);
    newRow[ORGANICO_NUM_COLUNAS - 1] = ORGANICO_DETALHE_ORIGEM_API_SECULLUM;
    calcularFormulasRow(newRow, { demissaoApi: f.demissao });
    next.push(newRow);
  }

  return next;
}

/**
 * Replica o que a aba Orgânico faz ao sincronizar Secullum: CTPS (e demais campos espelhados) passam a constar
 * nas linhas por matrícula. Útil quando `getOrganico()` ainda não persistiu o merge, mas a API de pessoas já tem o CTPS.
 */
export function mergeSecullumIntoOrganicoApiRows(
  rows: OrganicoRow[],
  funcionarios: SecullumFuncionario[],
): OrganicoRow[] {
  if (!Array.isArray(rows) || rows.length === 0 || !funcionarios?.length) {
    return rows;
  }

  const sheetRows: OrganicoSheetRow[] = rows.map((r) => {
    const arr = parseOrganicoValuesArray(r.values);
    const out: OrganicoCell[] = [...arr];
    while (out.length < ORGANICO_NUM_COLUNAS) out.push("");
    return out.slice(0, ORGANICO_NUM_COLUNAS);
  });

  const merged = mergeSecullumIntoRows(sheetRows, funcionarios);

  return merged.map((cells, i) => {
    const mat = String(cells[ORGANICO_IDX.MATRICULA] ?? "").trim();
    const id =
      i < rows.length ? rows[i]!.id : mat ? `sec-${mat}` : `sec-idx-${i}`;
    const values: string[] = cells.map((c) => {
      if (c == null || c === "") return "";
      if (typeof c === "number" && Number.isFinite(c)) return String(c);
      return String(c);
    });
    return { id, values };
  });
}
