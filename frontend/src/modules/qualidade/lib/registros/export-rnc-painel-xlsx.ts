import { Workbook } from "exceljs";
import type { RncPainelItem } from "@qualidade/types/rnc-painel";

export type RncExportLinha = RncPainelItem & {
  situacaoPrazoLabel: string;
};

const HEADERS = [
  "ID",
  "Código",
  "Data da ocorrência",
  "Prazo de execução",
  "Responsável",
  "Situação do prazo",
] as const;

const DATE_FMT = "dd/mm/yyyy";

function isoToExcelDate(iso: string | null | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function colLetter(index0: number): string {
  let n = index0 + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function nomeArquivo(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `rnc-painel-${stamp}.xlsx`;
}

/**
 * Exporta a grade RNC (já filtrada) como tabela Excel formatada.
 * Datas saem como date serial com máscara dd/mm/yyyy; ID como número.
 */
export async function downloadRncPainelXlsx(linhas: RncExportLinha[]): Promise<void> {
  if (linhas.length === 0) {
    throw new Error("Não há linhas na grade para exportar.");
  }

  const rows = linhas.map((row) => [
    row.id,
    row.codigoDocumento || "",
    isoToExcelDate(row.dataOcorrencia),
    isoToExcelDate(row.prazoExecucao),
    row.responsavel?.trim() || "",
    row.situacaoPrazoLabel || "",
  ]);

  const wb = new Workbook();
  const ws = wb.addWorksheet("RNC", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const lastRow = rows.length + 1;
  const ref = `A1:${colLetter(HEADERS.length - 1)}${lastRow}`;

  ws.addTable({
    name: "TabelaRnc",
    ref,
    headerRow: true,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: HEADERS.map((name) => ({ name, filterButton: true })),
    rows,
  });

  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 16;
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 18;
  ws.getColumn(5).width = 22;
  ws.getColumn(6).width = 16;

  for (let r = 2; r <= lastRow; r++) {
    ws.getCell(r, 1).numFmt = "0";
    ws.getCell(r, 3).numFmt = DATE_FMT;
    ws.getCell(r, 4).numFmt = DATE_FMT;
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo();
  a.click();
  URL.revokeObjectURL(url);
}
