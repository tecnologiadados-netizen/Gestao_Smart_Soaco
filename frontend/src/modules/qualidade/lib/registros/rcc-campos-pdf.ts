import type { RccDados } from "@qualidade/types/rcc";

/** Versão do formulário RCC usada no PDF. */
export type RccPdfVersaoFormulario = "cliente" | "empresa";

export interface RccCampoPdfMapa {
  /** Rótulo exibido no modelo Word/PDF */
  rotuloPdf: string;
  /** Chave em `RccDados` ou `registro.status` */
  chaveSistema?: keyof RccDados | "status";
  /** Seções do PDF em que o campo aparece */
  versoes: RccPdfVersaoFormulario[];
  /** Situação do campo no sistema */
  situacao: "mapeado" | "parcial" | "pendente";
  observacao?: string;
}

/**
 * Mapeamento entre campos do PDF (FOR-SA-0025) e o cadastro RCC no Qualyteam.
 * Use esta lista para revisar importações e evoluções do formulário.
 */
export const RCC_CAMPOS_PDF_MAPA: RccCampoPdfMapa[] = [
  {
    rotuloPdf: "Nº Reclamação",
    chaveSistema: "codigoDocumento",
    versoes: ["cliente", "empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Data do registro",
    chaveSistema: "dataRegistroReclamacao",
    versoes: ["cliente", "empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Data de fechamento",
    chaveSistema: "dataFechamento",
    versoes: ["cliente", "empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Status atual",
    chaveSistema: "status",
    versoes: ["cliente", "empresa"],
    situacao: "mapeado",
    observacao: "Derivado de `registro.status` no PDF.",
  },
  {
    rotuloPdf: "Nome cliente consumidor",
    chaveSistema: "nomeClienteConsumidor",
    versoes: ["cliente", "empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Nome cliente revendedor",
    chaveSistema: "nomeRevendedor",
    versoes: ["cliente", "empresa"],
    situacao: "parcial",
    observacao:
      "Quando não é cliente do revendedor, usa o campo vendedor (padrão SO AÇO).",
  },
  {
    rotuloPdf: "Contato",
    chaveSistema: "contato",
    versoes: ["cliente", "empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Cidade",
    chaveSistema: "cidade",
    versoes: ["cliente", "empresa"],
    situacao: "mapeado",
    observacao: "Exibida com UF quando disponível.",
  },
  {
    rotuloPdf: "Telefone",
    chaveSistema: "telefone",
    versoes: ["cliente", "empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Bairro",
    chaveSistema: "bairro",
    versoes: ["cliente", "empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Endereço",
    chaveSistema: "endereco",
    versoes: ["cliente", "empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Ponto de referência",
    chaveSistema: "pontoReferencia",
    versoes: ["cliente", "empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Produto",
    chaveSistema: "produto",
    versoes: ["cliente", "empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Nº Série/Lote do produto",
    chaveSistema: "numeroSerieLoteProduto",
    versoes: ["cliente", "empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Data emissão NF",
    chaveSistema: "dataEmissaoNf",
    versoes: ["cliente", "empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Nota fiscal Nº",
    chaveSistema: "numeroNf",
    versoes: ["cliente", "empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Quantidade",
    chaveSistema: "quantidade",
    versoes: ["cliente", "empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Pedido Nº",
    chaveSistema: "numeroPedidoInternoExterno",
    versoes: ["cliente", "empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Tipo de reclamação",
    chaveSistema: "reclamacao1",
    versoes: ["cliente", "empresa"],
    situacao: "parcial",
    observacao: "Usa reclamação 1; se vazia, reclamação 2.",
  },
  {
    rotuloPdf: "Descrição da reclamação",
    chaveSistema: "descricaoReclamacao",
    versoes: ["cliente", "empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Reclamação aceita?",
    chaveSistema: "reclamacaoAceita",
    versoes: ["cliente"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Dentro da garantia?",
    chaveSistema: "produtoDentroGarantia",
    versoes: ["cliente"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Abrir ordem de serviço?",
    chaveSistema: "abrirOrdemServico",
    versoes: ["cliente"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Comentário",
    chaveSistema: "comentario",
    versoes: ["cliente"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Responsável pela análise",
    chaveSistema: "usuarioCriacao",
    versoes: ["cliente"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Número de ordem de produção",
    chaveSistema: "numeroOrdemProducao",
    versoes: ["empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Previsão para data de assistência",
    chaveSistema: "dataAssistencia",
    versoes: ["empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Funcionário solicitado",
    chaveSistema: "funcionarioSolicitado",
    versoes: ["empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Hora da saída da empresa",
    chaveSistema: "horaSaidaEmpresa",
    versoes: ["empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Número de série do compressor",
    chaveSistema: "numeroSerieCompressor",
    versoes: ["empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Hora de chegada à empresa",
    chaveSistema: "horaChegadaEmpresa",
    versoes: ["empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Serviço realizado",
    chaveSistema: "servicoRealizado",
    versoes: ["empresa"],
    situacao: "parcial",
    observacao: "Concatena serviço realizado, 1 e 2 no PDF.",
  },
  {
    rotuloPdf: "Problema solucionado?",
    chaveSistema: "problemaSolucionado",
    versoes: ["empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Data de conclusão",
    chaveSistema: "dataFechamento",
    versoes: ["empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Hora da chegada ao cliente",
    chaveSistema: "horaChegadaCliente",
    versoes: ["empresa"],
    situacao: "mapeado",
  },
  {
    rotuloPdf: "Hora da saída do cliente",
    chaveSistema: "horaSaidaCliente",
    versoes: ["empresa"],
    situacao: "mapeado",
  },
];

export const RCC_CAMPOS_PDF_PENDENTES = RCC_CAMPOS_PDF_MAPA.filter(
  (campo) => campo.situacao === "pendente"
);
