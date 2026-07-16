import type { SancaoDisciplinarRow } from "@rh/types/api";

/** Nome da aba no modelo `modelo-sancoes-disciplinares.xlsx`. */
export const SANCOES_SHEET_MAIN = "HIST. SANÇÕES";

export const SANCOES_MODELO_HEADERS = [
  "ID",
  "NOME",
  "TIPO",
  "DATA DA APLICAÇÃO",
  "MÊS",
  "ANO",
  "MOTIVO",
] as const;

type SancaoFieldKey = keyof Omit<SancaoDisciplinarRow, "id">;

export const SANCOES_HEADER_MAP: Record<string, SancaoFieldKey> = {
  ID: "matricula",
  NOME: "nomeFuncionario",
  TIPO: "tipo",
  "DATA DA APLICACAO": "dataAplicacao",
  MES: "mes",
  ANO: "ano",
  OBS: "observacoes",
  MOTIVO: "observacoes",
};

export function normalizeSanHeader(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function mapSanHeaderToField(normalizedHeader: string): SancaoFieldKey | undefined {
  return SANCOES_HEADER_MAP[normalizedHeader];
}

export function emptySancaoFields(): Omit<SancaoDisciplinarRow, "id"> {
  return {
    matricula: "",
    nomeFuncionario: "",
    tipo: "",
    dataAplicacao: "",
    mes: "",
    ano: "",
    observacoes: "",
  };
}
