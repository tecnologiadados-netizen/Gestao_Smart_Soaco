import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import * as XLSX from "xlsx";
import type { OrganicoTrajetoriaImportRow, OrganicoTrajetoriaParseResult } from "@rh/types/api";
import { sanitizeSalaryMotivo } from "@rh/lib/rh-organico-trajetoria-sanitize";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const SEC_MAIN = /ALTERA[CÇ][OÕ]ES DE SAL[AÁ]RIO,\s*CARGO E[^\n]*FUN[CÇ][AÃ]O\s*\n(.*?)(?=\nF[EÉ]RIAS|\nACIDENTES|\Z)/gis;
const SEC_CONT = /ALTERA[CÇ][OÕ]ES SALARIAIS\s*\n(.*?)(?=\nDISCRIMINA|\nACIDENTES|\Z)/gis;
const NAME_MAIN = /CONTRIBUI[CÇ][AÃ]O\s+SINDICAL\s*\n\s*([^\n]+?)\s*\n\s*Emiss/i;
const NAME_CONT = /REGISTRO DE EMPREGADO\s*N[ºo°]?\s*:\s*\d+\s*\n[^\n]+\n\s*([^\n]+?)\s*\n\s*ALTERA[CÇ][OÕ]ES SALARIAIS/is;
const MATRICULA_MAIN = /REGISTRO DE EMPREGADO\s*N[ºo°]?\s*:\s*(\d+)/i;
const MATRICULA_ALT = /N[ÚU]MERO\s+FOLHA\s*[:\-]?\s*(\d+)/i;
const RE_SAL = /(\d{2}\/\d{2}\/\d{4})\s+(R\$\s*[\d.,]+\s+por\s*m[eê]s)/gi;
const RE_CARGO_START = /(\d{2}\/\d{2}\/\d{4})\s*-\s*Cargo:/gi;
const RE_FUNCAO_START = /(\d{2}\/\d{2}\/\d{4})\s*-\s*Fun(?:ç|c)[aã]o:/gi;

function normalizeHeaderLabel(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function flattenBlock(block: string): string {
  return normalizeSpaces(block.replace(/[\r\n]+/g, " "));
}

function stripTableHeader(flat: string): string {
  if (/Data\s+Sal/i.test(flat) && /Motivo/i.test(flat)) {
    return flat.replace(/^.*?Motivo\s*/i, "").trim();
  }
  return flat.trim();
}

function extractBlocks(pageText: string): string[] {
  const blocks: string[] = [];
  for (const regex of [SEC_MAIN, SEC_CONT]) {
    regex.lastIndex = 0;
    for (const match of pageText.matchAll(regex)) {
      const block = String(match[1] ?? "").trim();
      if (block) blocks.push(block);
    }
  }
  return blocks;
}

function employeeFromPage(pageText: string): string | null {
  const match = NAME_MAIN.exec(pageText) ?? NAME_CONT.exec(pageText);
  if (!match?.[1]) return null;
  return normalizeSpaces(match[1]);
}

function matriculaFromPage(pageText: string): string | null {
  const match = MATRICULA_MAIN.exec(pageText) ?? MATRICULA_ALT.exec(pageText);
  if (!match?.[1]) return null;
  return String(match[1]).trim();
}

function parseAlteracaoBlock(
  block: string,
): Array<{ dataEvento: string; tipoEvento: "salario" | "cargo" | "funcao"; descricao: string; motivo: string }> {
  let flat = stripTableHeader(flattenBlock(block));
  if (!flat) return [];

  const tokens: Array<{ pos: number; tipo: "salario" | "cargo" | "funcao"; data: string; valor?: string; end: number }> = [];
  RE_SAL.lastIndex = 0;
  for (const match of flat.matchAll(RE_SAL)) {
    tokens.push({
      pos: match.index ?? 0,
      tipo: "salario",
      data: String(match[1] ?? "").trim(),
      valor: normalizeSpaces(String(match[2] ?? "").trim()),
      end: (match.index ?? 0) + String(match[0] ?? "").length,
    });
  }
  RE_CARGO_START.lastIndex = 0;
  for (const match of flat.matchAll(RE_CARGO_START)) {
    tokens.push({
      pos: match.index ?? 0,
      tipo: "cargo",
      data: String(match[1] ?? "").trim(),
      end: (match.index ?? 0) + String(match[0] ?? "").length,
    });
  }
  RE_FUNCAO_START.lastIndex = 0;
  for (const match of flat.matchAll(RE_FUNCAO_START)) {
    tokens.push({
      pos: match.index ?? 0,
      tipo: "funcao",
      data: String(match[1] ?? "").trim(),
      end: (match.index ?? 0) + String(match[0] ?? "").length,
    });
  }
  tokens.sort((a, b) => a.pos - b.pos);

  const items: Array<{
    tipo: "salario" | "cargo" | "funcao";
    data: string;
    valor?: string;
    alteracao?: string;
    motivo: string;
  }> = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    const nextPos = tokens[index + 1]?.pos ?? flat.length;
    const tail = flat.slice(token.end, nextPos).trim();
    if (token.tipo === "salario") {
      items.push({ tipo: "salario", data: token.data, valor: token.valor, motivo: tail });
    } else if (token.tipo === "cargo") {
      items.push({ tipo: "cargo", data: token.data, alteracao: `Cargo: ${normalizeSpaces(tail)}`, motivo: "" });
    } else {
      items.push({ tipo: "funcao", data: token.data, alteracao: `Função: ${normalizeSpaces(tail)}`, motivo: "" });
    }
  }

  for (let index = 0; index < items.length - 1; index++) {
    const current = items[index]!;
    const next = items[index + 1]!;
    if (current.tipo === "salario" || next.tipo !== "salario") continue;
    if (/Para:\s*/i.test(current.alteracao ?? "")) continue;
    const match = /\s+(Para:.+)$/i.exec(next.motivo);
    if (!match) continue;
    current.alteracao = normalizeSpaces(`${current.alteracao ?? ""} ${match[1]}`);
    next.motivo = next.motivo.slice(0, match.index).trim();
  }

  const rows: Array<{ dataEvento: string; tipoEvento: "salario" | "cargo" | "funcao"; descricao: string; motivo: string }> = [];
  for (const item of items) {
    if (item.tipo === "salario") {
      const motivo = sanitizeSalaryMotivo(item.motivo);
      rows.push({
        dataEvento: item.data,
        tipoEvento: "salario",
        descricao: normalizeSpaces(item.valor ?? ""),
        motivo,
      });
      continue;
    }

    rows.push({
      dataEvento: item.data,
      tipoEvento: item.tipo,
      descricao: normalizeSpaces(item.alteracao ?? ""),
      motivo: "",
    });
  }

  return rows;
}

function sortKey(row: OrganicoTrajetoriaImportRow): string {
  return `${row.matricula}::${row.dataEvento}::${row.tipoEvento}::${row.descricao}`;
}

function toIsoDate(brDate: string): string {
  const [day, month, year] = brDate.split("/");
  if (!day || !month || !year) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function excelSerialToIsoDate(value: number): string {
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) return "";
  const year = String(parsed.y).padStart(4, "0");
  const month = String(parsed.m).padStart(2, "0");
  const day = String(parsed.d).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function anyDateToIso(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return excelSerialToIsoDate(value);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return toIsoDate(text);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function classifyTipoEvento(alteracao: string): "salario" | "cargo" | "funcao" {
  const normalized = normalizeHeaderLabel(alteracao);
  if (normalized.startsWith("cargo:")) return "cargo";
  if (normalized.startsWith("funcao:") || normalized.startsWith("função:")) return "funcao";
  return "salario";
}

function buildTitulo(tipoEvento: "salario" | "cargo" | "funcao"): string {
  return tipoEvento === "salario"
    ? "Alteração salarial"
    : tipoEvento === "cargo"
      ? "Alteração de cargo"
      : "Alteração de função";
}

function buildPageText(items: Array<{ str?: string; hasEOL?: boolean }>): string {
  let text = "";
  for (const item of items) {
    const part = String(item.str ?? "");
    if (!part) continue;
    text += part;
    text += item.hasEOL ? "\n" : " ";
  }
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

export async function parseOrganicoTrajetoriaPdf(file: File): Promise<OrganicoTrajetoriaParseResult> {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
  const warnings: string[] = [];
  const rows: OrganicoTrajetoriaImportRow[] = [];
  const colaboradoresDetectados = new Set<string>();
  const colaboradoresSemMatricula = new Set<string>();

  let currentName: string | null = null;
  let currentMatricula: string | null = null;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = buildPageText(textContent.items as Array<{ str?: string; hasEOL?: boolean }>);
    if (!pageText.trim()) continue;

    const pageName = employeeFromPage(pageText);
    const pageMatricula = matriculaFromPage(pageText);
    if (pageName) currentName = pageName;
    if (pageMatricula) currentMatricula = pageMatricula;

    const blocks = extractBlocks(pageText);
    if (blocks.length === 0) continue;

    const colaboradorLabel = currentName || `Página ${pageNumber}`;
    colaboradoresDetectados.add(currentMatricula ? `mat:${currentMatricula}` : `nome:${colaboradorLabel}`);

    if (!currentMatricula) {
      colaboradoresSemMatricula.add(colaboradorLabel);
      warnings.push(`${colaboradorLabel}: matrícula não identificada no PDF, o sistema tentará vincular pelo nome.`);
    }

    for (const block of blocks) {
      for (const parsed of parseAlteracaoBlock(block)) {
        if (!parsed.dataEvento || !parsed.descricao) continue;
        const dataEvento = toIsoDate(parsed.dataEvento);
        if (!dataEvento) {
          warnings.push(`Página ${pageNumber}: data inválida encontrada (${parsed.dataEvento}).`);
          continue;
        }
        rows.push({
          matricula: currentMatricula ?? "",
          colaboradorNome: currentName ?? "",
          dataEvento,
          tipoEvento: parsed.tipoEvento,
          titulo: buildTitulo(parsed.tipoEvento),
          descricao: parsed.descricao,
          motivo: parsed.motivo || null,
          origemArquivo: file.name,
        });
      }
    }
  }

  const deduped = Array.from(
    new Map(rows.map((row) => [`${sortKey(row)}::${row.motivo ?? ""}`, row])).values(),
  ).sort((a, b) => sortKey(a).localeCompare(sortKey(b), "pt-BR"));

  if (deduped.length === 0) {
    warnings.push(`Nenhuma alteração de salário, cargo ou função foi identificada no arquivo ${file.name}.`);
  }

  return {
    source: "pdf",
    rows: deduped,
    warnings,
    colaboradoresDetectados: colaboradoresDetectados.size,
    colaboradoresVinculados: new Set(deduped.map((row) => row.matricula).filter(Boolean)).size,
    colaboradoresSemMatricula: [...colaboradoresSemMatricula].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}

export async function parseOrganicoTrajetoriaSpreadsheet(file: File): Promise<OrganicoTrajetoriaParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
  if (!sheet) {
    return {
      source: "spreadsheet",
      rows: [],
      warnings: [`A planilha ${file.name} não possui abas legíveis.`],
      colaboradoresDetectados: 0,
      colaboradoresVinculados: 0,
      colaboradoresSemMatricula: [],
    };
  }

  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as unknown[][];
  const header = (matrix[0] ?? []).map((value) => normalizeHeaderLabel(String(value ?? "")));
  const idxData = header.findIndex((value) => value === "data");
  const idxColaborador = header.findIndex((value) => value === "colaborador");
  const idxAlteracao = header.findIndex((value) => value === "alteracao");
  const idxMotivo = header.findIndex((value) => value === "motivo");

  if (idxData < 0 || idxColaborador < 0 || idxAlteracao < 0) {
    return {
      source: "spreadsheet",
      rows: [],
      warnings: [`A planilha ${file.name} não possui as colunas esperadas: Data, Colaborador, Alteração e Motivo.`],
      colaboradoresDetectados: 0,
      colaboradoresVinculados: 0,
      colaboradoresSemMatricula: [],
    };
  }

  const warnings: string[] = [];
  const colaboradores = new Set<string>();
  const rows: OrganicoTrajetoriaImportRow[] = [];

  for (let lineIndex = 1; lineIndex < matrix.length; lineIndex++) {
    const raw = matrix[lineIndex] ?? [];
    const colaboradorNome = normalizeSpaces(String(raw[idxColaborador] ?? ""));
    const descricao = normalizeSpaces(String(raw[idxAlteracao] ?? ""));
    const motivo = normalizeSpaces(String(raw[idxMotivo] ?? ""));
    const dataEvento = anyDateToIso(raw[idxData]);
    if (!colaboradorNome || !descricao || !dataEvento) {
      if (colaboradorNome || descricao || dataEvento) {
        warnings.push(`Linha ${lineIndex + 1}: registro incompleto ignorado.`);
      }
      continue;
    }
    colaboradores.add(colaboradorNome);
    const tipoEvento = classifyTipoEvento(descricao);
    const motivoFinal =
      tipoEvento === "salario" && motivo ? sanitizeSalaryMotivo(motivo) : motivo || null;
    rows.push({
      matricula: "",
      colaboradorNome,
      dataEvento,
      tipoEvento,
      titulo: buildTitulo(tipoEvento),
      descricao,
      motivo: motivoFinal,
      origemArquivo: file.name,
    });
  }

  const deduped = Array.from(
    new Map(rows.map((row) => [`${row.colaboradorNome}::${sortKey(row)}::${row.motivo ?? ""}`, row])).values(),
  ).sort((a, b) => `${a.colaboradorNome}::${a.dataEvento}`.localeCompare(`${b.colaboradorNome}::${b.dataEvento}`, "pt-BR"));

  if (deduped.length === 0) {
    warnings.push(`Nenhum registro válido foi identificado na planilha ${file.name}.`);
  }

  return {
    source: "spreadsheet",
    rows: deduped,
    warnings,
    colaboradoresDetectados: colaboradores.size,
    colaboradoresVinculados: colaboradores.size,
    colaboradoresSemMatricula: [],
  };
}

export async function parseOrganicoTrajetoriaFile(file: File): Promise<OrganicoTrajetoriaParseResult> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    return parseOrganicoTrajetoriaSpreadsheet(file);
  }
  return parseOrganicoTrajetoriaPdf(file);
}
