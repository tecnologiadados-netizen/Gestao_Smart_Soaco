import type { RncDados } from "@/types/rnc";

export interface RncCampoPdfMapa {
  rotuloPdf: string;
  chaveSistema: keyof RncDados | "status";
  situacao: "mapeado" | "parcial" | "pendente";
  observacao?: string;
}

/** Mapeamento formulário FOR-SA (RNC) ↔ campos do sistema. */
export const RNC_CAMPOS_PDF_MAPA: RncCampoPdfMapa[] = [
  { rotuloPdf: "Nº da RNC", chaveSistema: "codigoDocumento", situacao: "mapeado" },
  {
    rotuloPdf: "Data do registro",
    chaveSistema: "dataOcorrencia",
    situacao: "mapeado",
    observacao: "Usa a data da ocorrência como data de registro no PDF.",
  },
  { rotuloPdf: "Data de fechamento", chaveSistema: "dataFechamento", situacao: "mapeado" },
  { rotuloPdf: "Status atual", chaveSistema: "status", situacao: "mapeado" },
  { rotuloPdf: "Tipo de ação", chaveSistema: "tipoAcao", situacao: "mapeado" },
  { rotuloPdf: "Tipo de ocorrência", chaveSistema: "tipoOcorrencia", situacao: "mapeado" },
  { rotuloPdf: "Qtde", chaveSistema: "quantidade", situacao: "mapeado" },
  { rotuloPdf: "Setor de ocorrência", chaveSistema: "setorOcorrencia", situacao: "mapeado" },
  { rotuloPdf: "Setor de detecção", chaveSistema: "setorDeteccao", situacao: "mapeado" },
  {
    rotuloPdf: "Lote/Série",
    chaveSistema: "codigoProduto",
    situacao: "parcial",
    observacao: "Reutiliza o código do produto ERP.",
  },
  { rotuloPdf: "Grupo de produto", chaveSistema: "grupoProduto", situacao: "mapeado" },
  {
    rotuloPdf: "O.P. Nº",
    chaveSistema: "codigoProduto",
    situacao: "parcial",
    observacao: "Campo sem equivalente direto; usa código do produto.",
  },
  { rotuloPdf: "Nota fiscal", chaveSistema: "notaFiscal", situacao: "mapeado" },
  {
    rotuloPdf: "Descrição da ocorrência",
    chaveSistema: "descricaoOcorrencia",
    situacao: "parcial",
    observacao: "Inclui produto e tipo de produto quando informados.",
  },
  {
    rotuloPdf: "Preenchido por",
    chaveSistema: "responsavel",
    situacao: "parcial",
    observacao: "Fallback para usuário de criação.",
  },
  { rotuloPdf: "Data da ocorrência", chaveSistema: "dataOcorrencia", situacao: "mapeado" },
  { rotuloPdf: "Ação imediata", chaveSistema: "acaoImediata", situacao: "mapeado" },
  {
    rotuloPdf: "Descrição da ação imediata",
    chaveSistema: "descricaoAcaoImediata",
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Responsável pela ação imediata",
    chaveSistema: "responsavelAcaoImediata",
    situacao: "mapeado",
  },
  { rotuloPdf: "Prazo de execução", chaveSistema: "prazoExecucao", situacao: "mapeado" },
  {
    rotuloPdf: "Abertura de análise de causa?",
    chaveSistema: "analiseProblema",
    situacao: "parcial",
  },
  {
    rotuloPdf: "Porquê? (1–5) / Causa raiz",
    chaveSistema: "causa",
    situacao: "parcial",
    observacao: "Linhas múltiplas viram porquês; texto único vai à causa raiz.",
  },
  {
    rotuloPdf: "Ação 1",
    chaveSistema: "resolucaoNaoConformidade",
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Ações 2 e 3 / Análise eficaz?",
    chaveSistema: "codigoDocumento",
    situacao: "pendente",
    observacao: "Campos do modelo sem equivalente no sistema.",
  },
];

export const RNC_CAMPOS_PDF_PENDENTES = RNC_CAMPOS_PDF_MAPA.filter(
  (campo) => campo.situacao === "pendente"
);
