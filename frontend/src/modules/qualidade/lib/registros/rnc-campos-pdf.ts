import type { RncDados } from "@qualidade/types/rnc";

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
  { rotuloPdf: "Cód. Produto", chaveSistema: "codigoProduto", situacao: "mapeado" },
  {
    rotuloPdf: "Descrição Produto",
    chaveSistema: "produto",
    situacao: "parcial",
    observacao: "Usa a descrição do produto; em registros Nomus extrai o texto após o código.",
  },
  { rotuloPdf: "Tipo de ação", chaveSistema: "tipoAcao", situacao: "mapeado" },
  { rotuloPdf: "Tipo de ocorrência", chaveSistema: "tipoOcorrencia", situacao: "mapeado" },
  { rotuloPdf: "Qtde", chaveSistema: "quantidade", situacao: "mapeado" },
  { rotuloPdf: "Setor de ocorrência", chaveSistema: "setorOcorrencia", situacao: "mapeado" },
  { rotuloPdf: "Setor de detecção", chaveSistema: "setorDeteccao", situacao: "mapeado" },
  {
    rotuloPdf: "Lote/Série",
    chaveSistema: "loteSerie",
    situacao: "mapeado",
  },
  { rotuloPdf: "Grupo de produto", chaveSistema: "grupoProduto", situacao: "mapeado" },
  {
    rotuloPdf: "O.P. Nº",
    chaveSistema: "numeroOrdemProducao",
    situacao: "mapeado",
  },
  { rotuloPdf: "Nota fiscal", chaveSistema: "notaFiscal", situacao: "mapeado" },
  {
    rotuloPdf: "Descrição da ocorrência",
    chaveSistema: "descricaoOcorrencia",
    situacao: "parcial",
    observacao: "Não repete código/descrição do produto (campos próprios no PDF).",
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
    rotuloPdf: "Porquê? (1–5)",
    chaveSistema: "porques",
    situacao: "mapeado",
    observacao: "Exibidos quando o plano de ação está ativo.",
  },
  {
    rotuloPdf: "Causa raiz",
    chaveSistema: "causa",
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Resolução da não conformidade (Ação 1 no PDF)",
    chaveSistema: "resolucaoNaoConformidade",
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Ações à parte",
    chaveSistema: "acoesApartadas",
    situacao: "mapeado",
    observacao:
      "Tabela dinâmica com ação, responsável, prazo e status. No PDF, as duas primeiras linhas vão para Ação 2 e Ação 3.",
  },
  {
    rotuloPdf: "Análise eficaz?",
    chaveSistema: "analiseEficaz",
    situacao: "mapeado",
  },
];

export const RNC_CAMPOS_PDF_PENDENTES = RNC_CAMPOS_PDF_MAPA.filter(
  (campo) => campo.situacao === "pendente"
);
