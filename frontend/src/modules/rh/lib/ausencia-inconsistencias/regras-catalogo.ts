import type {
  FaltaAlertaBaseLegal,
  FaltaAlertaRegraRow,
  FaltaAlertaSeveridade,
} from "@rh/types/api";

export type AusenciaAlertaDetectado = {
  regraId: string;
  titulo: string;
  motivo: string;
  baseLegal: FaltaAlertaBaseLegal;
  severidade: FaltaAlertaSeveridade;
  contexto?: Record<string, unknown>;
};

export const CATALOGO_REGRAS_ALERTA_DEFAULT: Omit<FaltaAlertaRegraRow, "updatedAt" | "updatedBy">[] = [
  {
    id: "prev-soma-60-grupo-cid",
    titulo: "Soma de atestados no mesmo grupo de sintomas (CID)",
    descricao:
      "Alerta quando a soma de dias de atestados do colaborador no mesmo grupo de sintomas ultrapassa 15 dias em janela de 60 dias. Base previdenciária para encaminhamento ao INSS.",
    baseLegal: "previdenciario",
    referenciaLegal: "Art. 75, §§3–4 — Decreto 3.048/1999; Art. 60, §3 — Lei 8.213/91",
    limiteResumo: "> 15 dias / 60 dias",
    ativa: true,
    ordem: 1,
    severidadePadrao: "alta",
  },
  {
    id: "pol-declaracao-3-dias",
    titulo: "Declaração de comparecimento acumulada",
    descricao:
      "Política interna: soma de dias abonados por declaração de comparecimento acima do limite permitido em 12 meses.",
    baseLegal: "politica_interna",
    referenciaLegal: "Política interna da empresa",
    limiteResumo: "> 3 dias / 12 meses",
    ativa: true,
    ordem: 2,
    severidadePadrao: "media",
  },
  {
    id: "clt-473-iv",
    titulo: "Doação voluntária de sangue",
    descricao:
      "CLT Art. 473, IV: no máximo 1 dia abonado por lançamento e apenas 1 ausência a cada 12 meses de trabalho.",
    baseLegal: "clt",
    referenciaLegal: "Art. 473, IV — CLT",
    limiteResumo: "Máx. 1 dia / 1 vez em 12 meses",
    ativa: true,
    ordem: 3,
    severidadePadrao: "media",
  },
  {
    id: "clt-473-i",
    titulo: "Licença por óbito",
    descricao: "Ausência por falecimento de familiar — máximo de 2 dias consecutivos por evento.",
    baseLegal: "clt",
    referenciaLegal: "Art. 473, I — CLT",
    limiteResumo: "Máx. 2 dias consecutivos",
    ativa: true,
    ordem: 4,
    severidadePadrao: "media",
  },
  {
    id: "clt-473-ii",
    titulo: "Licença casamento",
    descricao: "Licença-gala por casamento — máximo de 3 dias consecutivos.",
    baseLegal: "clt",
    referenciaLegal: "Art. 473, II — CLT",
    limiteResumo: "Máx. 3 dias consecutivos",
    ativa: true,
    ordem: 5,
    severidadePadrao: "media",
  },
  {
    id: "clt-473-iii",
    titulo: "Licença paternidade",
    descricao: "Nascimento, adoção ou guarda compartilhada — máximo de 5 dias consecutivos.",
    baseLegal: "clt",
    referenciaLegal: "Art. 473, III — CLT",
    limiteResumo: "Máx. 5 dias consecutivos",
    ativa: true,
    ordem: 6,
    severidadePadrao: "media",
  },
  {
    id: "clt-473-v",
    titulo: "Alistamento eleitoral",
    descricao: "Ausência para alistamento eleitoral — máximo de 2 dias.",
    baseLegal: "clt",
    referenciaLegal: "Art. 473, V — CLT",
    limiteResumo: "Máx. 2 dias",
    ativa: true,
    ordem: 7,
    severidadePadrao: "baixa",
  },
  {
    id: "clt-473-xi",
    titulo: "Consulta médica de filho até 6 anos",
    descricao: "Acompanhamento de filho em consulta médica — 1 dia por ano.",
    baseLegal: "clt",
    referenciaLegal: "Art. 473, XI — CLT",
    limiteResumo: "1 dia / 12 meses",
    ativa: true,
    ordem: 8,
    severidadePadrao: "media",
  },
  {
    id: "clt-473-xii",
    titulo: "Exames preventivos de câncer / HPV",
    descricao: "Realização de exames preventivos — até 3 dias a cada 12 meses.",
    baseLegal: "clt",
    referenciaLegal: "Art. 473, XII — CLT; Lei 15.377/2026",
    limiteResumo: "Máx. 3 dias / 12 meses",
    ativa: true,
    ordem: 9,
    severidadePadrao: "media",
  },
  {
    id: "prev-15-dias-consecutivos",
    titulo: "Atestado único superior a 15 dias",
    descricao: "Afastamento por atestado médico com mais de 15 dias consecutivos — verificar encaminhamento ao INSS.",
    baseLegal: "previdenciario",
    referenciaLegal: "Art. 75 — Decreto 3.048/1999",
    limiteResumo: "> 15 dias consecutivos",
    ativa: true,
    ordem: 10,
    severidadePadrao: "alta",
  },
  {
    id: "doc-declaracao-dia-integral",
    titulo: "Declaração com período integral acima de 1 dia",
    descricao:
      "Declaração de comparecimento lançada com período integral e quantidade superior a 1 dia — documento pode ser inadequado para abono integral.",
    baseLegal: "politica_interna",
    referenciaLegal: "CFM Res. 2.381/2024; política interna",
    limiteResumo: "Período integral > 1 dia",
    ativa: true,
    ordem: 11,
    severidadePadrao: "media",
  },
  {
    id: "dup-mesmo-dia",
    titulo: "Duas ausências no mesmo dia",
    descricao: "Colaborador já possui outro lançamento de ausência na mesma data.",
    baseLegal: "operacional",
    referenciaLegal: "Controle operacional",
    limiteResumo: "1 ausência / dia",
    ativa: true,
    ordem: 12,
    severidadePadrao: "media",
  },
];

export function buildRegrasMap(regras: FaltaAlertaRegraRow[]): Map<string, FaltaAlertaRegraRow> {
  return new Map(regras.map((r) => [r.id, r]));
}

export function regrasAtivas(regras: FaltaAlertaRegraRow[]): FaltaAlertaRegraRow[] {
  return regras.filter((r) => r.ativa);
}
