import type { FaltaRow } from "@rh/types/api";

/** Planilha principal do arquivo modelo. */
export const FALTAS_SHEET_MAIN = "ABS - Agrupado";

/** Referência de períodos, tipos e CIDs (modelo atualizado). */
export const FALTAS_SHEET_CADASTROS = "Cadastros";

/** Cabeçalhos na ordem do modelo `base_faltas e atestados_modelo.xlsx`. */
export const FALTAS_MODELO_HEADERS = [
  "DATA",
  "MÊS FALTA",
  "MATRÍCULA",
  "NOME FUNCIONÁRIO",
  "ENDEREÇO",
  "ÁREA",
  "SETOR",
  "LÍDER",
  "PERÍODO",
  "QNTD",
  "DIAS/HORAS",
  "TIPO",
  "CID",
  "LOCAL ATENDIMENTO",
  "MÉDICO RESPONSAVEL",
  "OBSERVAÇÕES",
] as const;

type FaltaFieldKey = keyof Omit<FaltaRow, "id">;

/** Mapa: cabeçalho sem acentos, maiúsculo → campo interno */
export const FALTAS_HEADER_MAP: Record<string, FaltaFieldKey> = {
  DATA: "data",
  "MES FALTA": "mesFalta",
  MATRICULA: "matricula",
  "NOME FUNCIONARIO": "nomeFuncionario",
  ENDERECO: "endereco",
  AREA: "area",
  SETOR: "setor",
  LIDER: "lider",
  PERIODO: "periodo",
  QNTD: "qntd",
  "DIAS/HORAS": "diasTurno",
  "DIAS/TURNO": "diasTurno",
  TIPO: "tipo",
  CID: "cid",
  "LOCAL ATENDIMENTO": "localAtendimento",
  "MEDICO RESPONSAVEL": "medicoResponsavel",
  OBSERVACOES: "observacoes",
  APROVADO: "aprovado",
  REPROVADO: "reprovado",
};

export function normalizeFaltasHeader(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function mapFaltasHeaderToField(normalizedHeader: string): FaltaFieldKey | undefined {
  return FALTAS_HEADER_MAP[normalizedHeader];
}

export function emptyFaltaFields(): Omit<FaltaRow, "id"> {
  return {
    data: "",
    mesFalta: "",
    matricula: "",
    nomeFuncionario: "",
    endereco: "",
    area: "",
    setor: "",
    lider: "",
    periodo: "",
    qntd: "",
    diasTurno: "",
    tipo: "",
    cid: "",
    localAtendimento: "",
    medicoResponsavel: "",
    observacoes: "",
    aprovado: "",
    reprovado: "",
  };
}
