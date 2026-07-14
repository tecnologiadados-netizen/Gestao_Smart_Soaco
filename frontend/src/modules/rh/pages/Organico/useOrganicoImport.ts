import { useCallback } from "react";
import * as XLSX from "xlsx";
import type ExcelJS from "exceljs";
import { ORGANICO_HEADERS, ORGANICO_NUM_COLUNAS } from "./organico-headers";
import { buildOrganicoSourceColumnMapWithWarnings, padOrganicoRow } from "./organico-import-column-map";
import { sanitizeExcelSheetName, type OrganicoExportMeta } from "./organico-import-meta";
import {
  isColunaFormula,
  ORGANICO_INDICES_TEMPO_IDADE,
  FORMULAS_EXPORT,
  adaptarFormulaParaLinha,
  COLUNAS_NUMERICAS_VAZIO_ZERO,
  COLUNAS_FORMULA_MOEDA,
  COLUNAS_TEXTO_PRESERVAR,
  ORGANICO_COLUNAS_BENEFICIOS_SIM_NAO_EXCEL,
  COLUNA_CPF,
  COLUNAS_PERCENTUAL,
  COLUNAS_MOEDA_DADOS,
  COLUNAS_DATA,
  COLUNAS_EXCEL_NUMFMT_TEXTO,
} from "./organico-excel-schema";
import { calcularFormulasRow } from "./organico-formulas";
import { isOrganicoImportGhostRow } from "./organico-import-row-utils";
import { ORGANICO_COLUNAS_READONLY_SECULLUM } from "./organico-secullum-readonly";
import {
  formatFinancialForExport,
  ORGANICO_COLUNAS_TEXTO_FINANCEIRO,
  readOrganicoFinancialCell,
} from "./organico-financial-text";
import {
  createDefaultModeloExportStyle,
  type ModeloCellStyle,
  type ModeloExportStyle,
} from "./organico-excel-styles";
import { cloneExcelStyleValue } from "@rh/lib/excel-modelo-styles";

export type OrganicoCell = string | number;
export type OrganicoSheetRow = OrganicoCell[];

export type OrganicoParseFileResult = {
  rows: OrganicoSheetRow[];
  columnMapWarnings: string[];
};
/**
 * Converte valor de célula para string para exibição/edição.
 */
function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return String(value);
  return String(value).trim();
}

/**
 * Formata data para padrão brasileiro DD/MM/YYYY.
 * Aceita Date, ISO (YYYY-MM-DD), americano (MM/DD/YYYY) ou brasileiro (DD/MM/YYYY).
 */
function formatDateToBR(value: unknown): string {
  if (value == null || value === "") return "";
  let d: Date;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === "number" && Number.isFinite(value) && value >= 59 && value < 1_000_000) {
    // Serial de data do Excel (importação com raw: true)
    d = new Date((value - 25569) * 86400 * 1000);
  } else {
    const s = String(value).trim();
    if (!s) return "";
    // ISO: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      d = new Date(s);
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
      const [a, b, year] = s.split("/").map(Number);
      // DD/MM/YYYY ou MM/DD/YYYY? Se a > 12, é DD. Se b > 12, é MM.
      if (a > 12) d = new Date(year, b - 1, a);
      else if (b > 12) d = new Date(year, a - 1, b);
      else d = new Date(year, b - 1, a); // assume DD/MM
    } else {
      d = new Date(s);
    }
  }
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formata CPF para exportação: XXX.XXX.XXX-XX (11 dígitos).
 * Preserva como texto para evitar perda de zeros à esquerda.
 */
function formatCPFForExport(value: unknown): string {
  if (value == null || value === "") return "";
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 0) return "";
  const padded = digits.slice(0, 11).padStart(11, "0");
  return padded.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/**
 * Converte valor para exportação no Excel. Garante que números sejam escritos
 * como tipo numérico (não string), evitando #VALOR! no Excel PT-BR.
 * Strings como "4.00", "4,00", "R$ 4,00", "1.593,78" são convertidas para número.
 * Colunas especiais (CPF, texto, percentual) são tratadas separadamente.
 */
function toExcelValue(value: unknown, colIndex: number): string | number {
  if (value == null || value === "") return "";

  // CPF: sempre como texto formatado
  if (colIndex === COLUNA_CPF) {
    return formatCPFForExport(value);
  }

  // Colunas de data: formato brasileiro DD/MM/YYYY
  if (COLUNAS_DATA.has(colIndex)) {
    return formatDateToBR(value);
  }

  // Colunas de texto: preservar como string (não converter para número)
  if (COLUNAS_TEXTO_PRESERVAR.has(colIndex)) {
    if (ORGANICO_COLUNAS_TEXTO_FINANCEIRO.has(colIndex)) {
      return formatFinancialForExport(value, colIndex);
    }
    return String(value).trim();
  }

  // Colunas percentuais: valor 20 (20%) deve ser 0.2 no Excel
  if (COLUNAS_PERCENTUAL.has(colIndex)) {
    const v = value;
    if (typeof v === "number" && !isNaN(v)) {
      return v > 1 && v <= 100 ? v / 100 : v;
    }
    const s = String(v).trim().replace(/[%\s]/g, "");
    const num = parseFloat(s.replace(",", "."));
    if (!isNaN(num)) {
      return num > 1 && num <= 100 ? num / 100 : num;
    }
    return "";
  }

  if (typeof value === "number" && !isNaN(value)) return value;
  const s = String(value).trim();
  if (s === "") return "";
  let cleaned = s.replace(/R\$\s*/gi, "").replace(/\s/g, "");
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    const thousandsSep = lastComma > lastDot ? "." : ",";
    cleaned = cleaned.replace(new RegExp(`\\${thousandsSep.replace(".", "\\.")}`, "g"), "");
  }
  cleaned = cleaned.replace(",", ".");
  const num = parseFloat(cleaned);
  if (!isNaN(num)) return num;
  return s;
}

let modeloExportStylePromise: Promise<ModeloExportStyle> | null = null;
let excelJsModulePromise: Promise<typeof import("exceljs").default> | null = null;

async function getExcelJS(): Promise<typeof import("exceljs").default> {
  if (!excelJsModulePromise) {
    excelJsModulePromise = import("exceljs").then((m) => m.default);
  }
  return excelJsModulePromise;
}

function cloneStyleValue<T>(value: T | undefined): T | undefined {
  return cloneExcelStyleValue(value);
}

async function getModeloExportStyle(): Promise<ModeloExportStyle> {
  if (!modeloExportStylePromise) {
    modeloExportStylePromise = (async () => {
      try {
        const response = await fetch("/modelo-organico.xlsx");
        if (!response.ok) {
          throw new Error("Falha ao carregar modelo de exportacao");
        }

        const arrayBuffer = await response.arrayBuffer();
        const ExcelJSRuntime = await getExcelJS();
        const modelWorkbook = new ExcelJSRuntime.Workbook();
        await modelWorkbook.xlsx.load(arrayBuffer);

        const modelSheet = modelWorkbook.getWorksheet("SÓ AÇO") ?? modelWorkbook.worksheets[0];
        if (!modelSheet) {
          throw new Error("Aba do modelo não encontrada");
        }

        const headerStyles: ModeloCellStyle[] = [];
        const dataStyles: ModeloCellStyle[] = [];
        const columnWidths: number[] = [];

        for (let c = 0; c < ORGANICO_HEADERS.length; c++) {
          const headerCell = modelSheet.getRow(1).getCell(c + 1);
          const dataCell = modelSheet.getRow(2).getCell(c + 1);

          headerStyles.push({
            fill: cloneStyleValue(headerCell.fill),
            font: cloneStyleValue(headerCell.font),
            alignment: cloneStyleValue(headerCell.alignment),
            border: cloneStyleValue(headerCell.border),
          });

          dataStyles.push({
            fill: cloneStyleValue(dataCell.fill),
            font: cloneStyleValue(dataCell.font),
            alignment: cloneStyleValue(dataCell.alignment),
            border: cloneStyleValue(dataCell.border),
          });

          columnWidths.push(modelSheet.getColumn(c + 1).width ?? 16);
        }

        for (const ref of ["BR2", "BS2", "BV2", "BE2", "AO2"]) {
          const cell = modelSheet.getCell(ref);
          if (typeof cell.numFmt === "string" && cell.numFmt.trim()) {
            return {
              moeda: {
                numFmt: cell.numFmt,
                alignment: cloneStyleValue(cell.alignment) ?? undefined,
              },
              headerHeight: modelSheet.getRow(1).height ?? 22,
              columnWidths,
              headerStyles,
              dataStyles,
            };
          }
        }
      } catch {
        // modelo-organico.xlsx ausente ou inválido — aplica layout Só Aço parametrizado.
        return createDefaultModeloExportStyle();
      }

      return createDefaultModeloExportStyle();
    })();
  }

  return modeloExportStylePromise;
}

function getExportHeaderLabel(colIndex: number): string {
  const base = String(ORGANICO_HEADERS[colIndex] ?? "").trim();
  if (!ORGANICO_COLUNAS_READONLY_SECULLUM.has(colIndex)) return base;
  return base ? `${base} (Secullum)` : "Secullum";
}

/**
 * Lê arquivo .xlsx e retorna linhas de dados (cada linha = array de valores na ordem dos cabeçalhos).
 */
export function useOrganicoImport() {
  const parseFile = useCallback((file: File): Promise<OrganicoParseFileResult> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            reject(new Error("Arquivo não pôde ser lido"));
            return;
          }
          const wb = XLSX.read(data, { type: "binary", cellDates: true });
          const firstSheet = wb.SheetNames[0];
          const ws = wb.Sheets[firstSheet];
          // raw: true mantém números da CTPS e demais moedas como number (evita texto "39,05" errado).
          const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
            header: 1,
            defval: "",
            raw: true,
          }) as unknown as unknown[][];

          if (raw.length === 0) {
            resolve({ rows: [], columnMapWarnings: [] });
            return;
          }

          const headerRow = raw[0] as unknown[];
          const { map: sourceColByLogical, warnings: columnMapWarnings } =
            buildOrganicoSourceColumnMapWithWarnings(headerRow);

          // Linhas de dados (pular linha do cabeçalho)
          const rows: OrganicoSheetRow[] = [];
          let suspiciousRemuneracaoLayoutRows = 0;
          for (let i = 1; i < raw.length; i++) {
            const rawRow = raw[i] as unknown[] | undefined;
            const row: OrganicoCell[] = [];
            for (let c = 0; c < ORGANICO_NUM_COLUNAS; c++) {
              if (isColunaFormula(c) || ORGANICO_INDICES_TEMPO_IDADE.has(c)) {
                row.push("");
              } else {
                const src = sourceColByLogical[c] ?? c;
                const val =
                  src >= 0 && rawRow != null && src < rawRow.length ? rawRow[src] : undefined;
                // CPF: quando vem como número do Excel, preservar como string com 11 dígitos
                if (c === COLUNA_CPF && typeof val === "number" && !isNaN(val)) {
                  const digits = String(Math.floor(val)).replace(/\D/g, "");
                  row.push(digits.slice(0, 11).padStart(11, "0"));
                } else if (c === COLUNA_CPF && val != null) {
                  const digits = String(val).replace(/\D/g, "");
                  row.push(digits.slice(0, 11).padStart(11, "0"));
                } else if (COLUNAS_PERCENTUAL.has(c) && (typeof val === "number" || (val != null && !isNaN(parseFloat(String(val)))))) {
                  const n = typeof val === "number" ? val : parseFloat(String(val).replace(",", "."));
                  row.push(n > 1 && n <= 100 ? n / 100 : n);
                } else if (COLUNAS_DATA.has(c) && val != null && val !== "") {
                  row.push(formatDateToBR(val));
                } else if (ORGANICO_COLUNAS_TEXTO_FINANCEIRO.has(c)) {
                  const addr = XLSX.utils.encode_cell({ r: i, c: src });
                  const cell = ws[addr] as { t?: string; v?: unknown; w?: string } | undefined;
                  row.push(readOrganicoFinancialCell(cell, c));
                } else if (COLUNAS_TEXTO_PRESERVAR.has(c)) {
                  row.push(cellToString(val));
                } else {
                  row.push(typeof val === "number" ? val : cellToString(val));
                }
              }
            }
            const sliced = padOrganicoRow(row) as OrganicoSheetRow;
            // Ignora linhas fantasma (zeros do Excel abaixo dos dados) e linhas sem matrícula
            if (isOrganicoImportGhostRow(sliced)) continue;
            const matricula = String(sliced[0] ?? "").trim();
            if (!matricula) continue;

            const faixaRaw = sliced[54];
            const custoRaw = sliced[75];
            const salarioAdicionaisRaw = sliced[74];
            const agenciaRaw = sliced[76];
            const faixaNum =
              typeof faixaRaw === "number"
                ? faixaRaw
                : Number.parseFloat(String(faixaRaw ?? "").replace(/\./g, "").replace(",", "."));
            const faixaPareceNumerica = Number.isFinite(faixaNum) && Math.abs(faixaNum) > 0;
            const agenciaPareceMoeda =
              typeof agenciaRaw === "number"
                ? Math.abs(agenciaRaw) > 1000
                : /[0-9]+\.[0-9]{1,2}$/.test(String(agenciaRaw ?? "").trim());
            const custoIgualSalarioAdicionais =
              String(custoRaw ?? "").trim() !== "" &&
              String(custoRaw ?? "").trim() === String(salarioAdicionaisRaw ?? "").trim();
            if (faixaPareceNumerica && agenciaPareceMoeda && custoIgualSalarioAdicionais) {
              suspiciousRemuneracaoLayoutRows += 1;
            }

            calcularFormulasRow(sliced);
            rows.push(sliced);
          }
          if (suspiciousRemuneracaoLayoutRows >= 5) {
            reject(
              new Error(
                "Planilha com colunas desalinhadas no bloco de remuneração. Exporte novamente pelo sistema e recoloque os dados sem inserir/deslocar células.",
              ),
            );
            return;
          }
          resolve({ rows, columnMapWarnings });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Erro ao ler o arquivo"));
      reader.readAsBinaryString(file);
    });
  }, []);

  const exportToExcel = useCallback(
    async (
      rows: OrganicoSheetRow[],
      filename = "organico.xlsx",
      exportMeta?: OrganicoExportMeta,
    ) => {
      const ExcelJSRuntime = await getExcelJS();
      const workbook = new ExcelJSRuntime.Workbook();
      const modeloStyle = await getModeloExportStyle();
      const worksheetLabel = sanitizeExcelSheetName(exportMeta?.sheetName ?? "Orgânico");
      const worksheet = workbook.addWorksheet(worksheetLabel, {
        views: [{ state: "frozen", ySplit: 1 }],
        properties: { defaultColWidth: 16 },
      });

      if (exportMeta) {
        const metaSheet = workbook.addWorksheet("_meta", {
          state: "veryHidden",
        });
        const metaRows: [string, string | number | boolean][] = [
          ["exportedAt", exportMeta.exportedAt],
          ["rowCount", exportMeta.rowCount],
          ["matriculaHash", exportMeta.matriculaHash],
          ["recorteFiltrado", exportMeta.recorteFiltrado],
          ["baseTotalRows", exportMeta.baseTotalRows],
          ["sheetName", exportMeta.sheetName],
        ];
        metaRows.forEach(([key, value], i) => {
          metaSheet.getCell(i + 1, 1).value = key;
          metaSheet.getCell(i + 1, 2).value = value;
        });
      }

      const headerRow = worksheet.getRow(1);
      for (let c = 0; c < ORGANICO_HEADERS.length; c++) {
        const cell = headerRow.getCell(c + 1);
        cell.value = getExportHeaderLabel(c);
        const headerStyle = modeloStyle.headerStyles[c];
        if (headerStyle.fill) cell.fill = cloneStyleValue(headerStyle.fill) as ExcelJS.Fill;
        if (headerStyle.font) cell.font = cloneStyleValue(headerStyle.font) as Partial<ExcelJS.Font>;
        if (headerStyle.alignment) {
          cell.alignment = cloneStyleValue(headerStyle.alignment) as Partial<ExcelJS.Alignment>;
        } else {
          cell.alignment = { wrapText: true, vertical: "middle" };
        }
        if (headerStyle.border) {
          cell.border = cloneStyleValue(headerStyle.border) as Partial<ExcelJS.Borders>;
        }
      }
      headerRow.height = modeloStyle.headerHeight;

      for (let r = 0; r < rows.length; r++) {
        const cells = padOrganicoRow(rows[r]);
        const excelRowNum = r + 2;
        const idPreenchido = (cells[0] ?? "").toString().trim() !== "";
        const excelRow = worksheet.getRow(excelRowNum);

        for (let c = 0; c < ORGANICO_NUM_COLUNAS; c++) {
          const cell = excelRow.getCell(c + 1);
          const formulaTemplate = FORMULAS_EXPORT[c];
          if (formulaTemplate && idPreenchido) {
            const formula = adaptarFormulaParaLinha(formulaTemplate, excelRowNum);
            const raw = cells[c];
            const hasCached =
              raw != null &&
              String(raw).trim() !== "" &&
              String(raw).trim().toUpperCase() !== "#VALUE!" &&
              String(raw).trim().toUpperCase() !== "#REF!";
            if (hasCached) {
              const result: string | number =
                typeof raw === "number" && Number.isFinite(raw) ? raw : String(raw);
              cell.value = { formula, result } as ExcelJS.CellFormulaValue;
            } else {
              cell.value = { formula };
            }
          } else {
            const val = cells[c];
            const isEmpty = val == null || String(val).trim() === "";
            if (isEmpty && COLUNAS_NUMERICAS_VAZIO_ZERO.has(c)) {
              cell.value = 0;
            } else {
              cell.value = val != null ? toExcelValue(val, c) : "";
            }
          }

          const dataStyle = modeloStyle.dataStyles[c];
          if (dataStyle.fill) cell.fill = cloneStyleValue(dataStyle.fill) as ExcelJS.Fill;
          if (dataStyle.font) cell.font = cloneStyleValue(dataStyle.font) as Partial<ExcelJS.Font>;
          if (dataStyle.alignment) {
            cell.alignment = cloneStyleValue(dataStyle.alignment) as Partial<ExcelJS.Alignment>;
          }
          if (dataStyle.border) {
            cell.border = cloneStyleValue(dataStyle.border) as Partial<ExcelJS.Borders>;
          }
        }
      }

      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          const colIndex = (colNumber as number) - 1;
          if (rowNumber <= 1) return;
          if (COLUNAS_FORMULA_MOEDA.has(colIndex) || COLUNAS_MOEDA_DADOS.has(colIndex)) {
            cell.numFmt = modeloStyle.moeda.numFmt;
            if (modeloStyle.moeda.alignment) {
              cell.alignment = {
                ...modeloStyle.moeda.alignment,
                vertical: modeloStyle.moeda.alignment.vertical ?? "middle",
              };
            }
          } else if (COLUNAS_PERCENTUAL.has(colIndex)) {
            cell.numFmt = "0%";
          } else if (COLUNAS_EXCEL_NUMFMT_TEXTO.has(colIndex)) {
            cell.numFmt = "@";
          }
        });
      });

      for (let c = 0; c < ORGANICO_NUM_COLUNAS; c++) {
        worksheet.getColumn(c + 1).width = modeloStyle.columnWidths[c] ?? 16;
      }

      // Lista suspensa de Sim/Não para benefícios de edição em massa.
      const totalLinhasDados = Math.max(rows.length, 2000);
      for (const colIdx of ORGANICO_COLUNAS_BENEFICIOS_SIM_NAO_EXCEL) {
        for (let excelRowNum = 2; excelRowNum <= totalLinhasDados + 1; excelRowNum++) {
          worksheet.getCell(excelRowNum, colIdx + 1).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: ['"Sim,Não"'],
            showErrorMessage: true,
            errorTitle: "Valor inválido",
            error: 'Use apenas "Sim" ou "Não".',
          };
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    []
  );

  return { parseFile, exportToExcel };
}
