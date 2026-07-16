/**
 * Cálculos das fórmulas do Excel replicados em JavaScript.
 * Ordem de cálculo respeita dependências entre colunas.
 *
 * **Importante:** ao importar planilha (.xlsx), o sistema zera as células de fórmula e
 * preenche de novo com `calcularFormulasRow` — a fonte da verdade é este arquivo, não o Excel antigo.
 *
 * Salário base (BA/CTPS) e demais moedas em formato BR: usar parseCtpsToNumber.
 * O parser antigo (apagar não-dígitos) quebrava "2.106,25" → 210625 e faixa "Acima de 5k".
 */
import type { OrganicoSheetRow } from "./useOrganicoImport";
import { ORGANICO_NUM_COLUNAS } from "./organico-headers";
import { lookupValueByMatriculaFolha } from "@rh/lib/api-client";
import {
  ORGANICO_IDX,
  normalizeSimNao,
  parseCtpsToNumber,
  textoIdadeDesdeNascimento,
  textoTempoEmpresaDesdeAdmissao,
} from "./organico-derive";
import { COLUNAS_PERCENTUAL, ORGANICO_INDICES_SIM_NAO } from "./organico-excel-schema";

function num(cells: (string | number)[], idx: number): number {
  const v = cells[idx];
  if (v == null || v === "") return 0;
  if (typeof v === "number" && !Number.isNaN(v)) return v;

  // Percentuais (INCRE %, etc.): 20 → 0,2; "0,2" → 0,2 (não usar parseCtpsToNumber — evita misturar com moeda)
  if (COLUNAS_PERCENTUAL.has(idx)) {
    const s = String(v).trim().replace(/[%\s]/g, "");
    const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s.replace(",", ".");
    const n = parseFloat(normalized);
    if (Number.isNaN(n)) return 0;
    return n > 1 && n <= 100 ? n / 100 : n;
  }

  // Moeda BR e números (vale, $ dia, CTPS não passa aqui para v52 — ver abaixo)
  return parseCtpsToNumber(v);
}

export interface CalcularFormulasRowOptions {
  /** Data de demissão (API Secullum / Pessoas), quando existir. */
  demissaoApi?: string;
  /** Mapa matrícula → demissão (ex.: após sync Secullum). */
  demissaoByMatricula?: Record<string, string>;
}

function resolveDemissaoApi(row: OrganicoSheetRow, opts?: CalcularFormulasRowOptions): string | undefined {
  const a = opts?.demissaoApi?.trim();
  if (a) return a;
  const mat = String(row[ORGANICO_IDX.MATRICULA] ?? "").trim();
  if (!mat || !opts?.demissaoByMatricula) return undefined;
  const fromMap = lookupValueByMatriculaFolha(opts.demissaoByMatricula, mat);
  if (fromMap !== undefined) return String(fromMap).trim();
  return undefined;
}


/** Evita lixo de ponto flutuante (ex.: 1621 * 0,4 → 648,4000000000001). */
function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Calcula os valores das colunas com fórmula para uma linha.
 * Modifica o array in-place, preenchendo as células de fórmula.
 */
export function calcularFormulasRow(row: OrganicoSheetRow, opts?: CalcularFormulasRowOptions): void {
  const cells = Array.isArray(row) ? row : [];
  while (cells.length < ORGANICO_NUM_COLUNAS) cells.push("");

  const n = (i: number) => num(cells, i);

  /** Parcela INCRE (BE/BH/BK): null se a célula for "-" (IFERROR/SEERRO na planilha). */
  const parcelaIncreParaTotal = (idx: number): number | null => {
    const raw = cells[idx];
    if (raw === "-" || (typeof raw === "string" && raw.trim() === "-")) return null;
    const v = num(cells, idx);
    return Number.isFinite(v) ? v : null;
  };

  // Salário base: exclusivamente coluna CTPS; todas as derivações usam este valor
  const v52 = parseCtpsToNumber(cells[ORGANICO_IDX.CTPS]);

  // 41: $$ (valor diário) = AO*AN (Valor (Vale) × QTD 2 ou 4)
  const v40 = roundMoney(n(40) * n(39));
  cells[41] = v40;

  // 42: $$ (21 Dias) = AO*21
  const v41 = roundMoney(v40 * 21);
  cells[42] = v41;

  // 43: Desconto VT = IF(AP>0, BA*6%, 0)
  cells[43] = roundMoney(v41 > 0 ? v52 * 0.06 : 0);

  // 47: $ Semanal = AS*AT
  const v46 = roundMoney(n(45) * n(46));
  cells[47] = v46;

  // 48: $$ (4 Semanas) = AU*4
  const v47 = roundMoney(v46 * 4);
  cells[48] = v47;

  // 51: $$ (21 Dias quentinha) = AX*21
  const v50 = roundMoney(n(50) * 21);
  cells[51] = v50;

  // 52: TOTAL MÊS = AY+AV+AP
  const v51 = roundMoney(v50 + v47 + v41);
  cells[52] = v51;

  // 57: INCRE $$ = 1621*BD (salário mínimo da categoria × percentual insalubridade)
  const v56 = roundMoney(1621 * n(56));
  cells[57] = v56;

  // 60: INCRE $$2 = BA*BG
  const v59 = roundMoney(v52 * n(59));
  cells[60] = v59;

  // 63: INCRE $$5 = BA*BJ
  const v62 = roundMoney(v52 * n(62));
  cells[63] = v62;

  // 66: INCRE $$6 = 65*BM
  const v65 = roundMoney(65 * n(65));
  cells[66] = v65;

  // 69: INCRE $$7 = BA*BP
  const v68 = roundMoney(v52 * n(68));
  cells[69] = v68;

  // 70: TOTAL INCRE $$8 = SEERRO(BK+BH+BE;"-")
  const pBe = parcelaIncreParaTotal(57);
  const pBh = parcelaIncreParaTotal(60);
  const pBk = parcelaIncreParaTotal(63);
  const v69: number | string =
    pBe === null || pBh === null || pBk === null ? "-" : roundMoney(pBe + pBh + pBk);
  cells[70] = v69;

  // 71: SOMENTE SALÁRIO = BQ+BA
  const v70 = roundMoney(v68 + v52);
  cells[71] = v70;

  // 73: SALÁRIO + ADENDO = BS+BT
  const v71 = n(72); // Adendo
  const v72 = roundMoney(v70 + v71);
  cells[73] = v72;

  // 74: SALÁRIO + ADENDO + ADICIONAIS = BU+BR
  const v69Num = typeof v69 === "number" && Number.isFinite(v69) ? v69 : 0;
  const v73 = roundMoney(v72 + v69Num);
  cells[74] = v73;

  // 75: CUSTO TOTAL = (BV+AZ) - AQ
  const v42 = num(cells, 43);
  cells[75] = roundMoney(v73 + v51 - v42);

  // 54: FAIXA SALARIAL (texto)
  const faixa = (() => {
    const sal = v52;
    if (sal < 1593.78) return "CTPS - abaixo do minimo";
    if (sal === 1593.78) return "CTPS - Minimo";
    if (sal > 5000) return "CTPS - Acima de 5k";
    if (sal > 4000) return "CTPS - 4,01K até 5k";
    if (sal > 3000) return "CTPS - 3,01k até 4k";
    if (sal > 2000) return "CTPS - 2,01k até 3k";
    if (sal > 1593.78) return "CTPS - Minimo até 2k";
    return "";
  })();
  cells[54] = faixa;

  const demissaoResolved = resolveDemissaoApi(cells, opts);
  cells[ORGANICO_IDX.TEMPO_EMPRESA] = textoTempoEmpresaDesdeAdmissao(cells, demissaoResolved);
  cells[ORGANICO_IDX.IDADE] = textoIdadeDesdeNascimento(cells);

  for (const idx of ORGANICO_INDICES_SIM_NAO) {
    cells[idx] = normalizeSimNao(cells[idx]);
  }
}

/**
 * Calcula fórmulas para todas as linhas.
 */
export function calcularFormulas(rows: OrganicoSheetRow[]): void {
  for (const row of rows) {
    if (Array.isArray(row)) calcularFormulasRow(row);
  }
}
