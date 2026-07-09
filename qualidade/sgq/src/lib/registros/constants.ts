import type { RegistroStatus, RegistroTipo } from "@/types/registro";

export const registroTipoLabels = {
  rnc: "RNC",
  rcc: "RCC",
} as const;

export const registroTipoDescricoes = {
  rnc: "Registro de Não Conformidade",
  rcc: "Registro de Controle de Conformidade",
} as const;

/** Tipos disponíveis no módulo Registros (cadastro e consulta). */
export type ModuloRegistroTipo = RegistroTipo | "avaliacao-fornecedor";

export const MODULO_REGISTRO_TIPOS = [
  "rnc",
  "rcc",
  "avaliacao-fornecedor",
] as const satisfies readonly ModuloRegistroTipo[];

export const moduloRegistroTipoLabels: Record<ModuloRegistroTipo, string> = {
  rnc: "RNC — Registro de Não Conformidade",
  rcc: "RCC — Registro de Controle de Conformidade",
  "avaliacao-fornecedor": "Avaliação de fornecedor",
};

export const moduloRegistroTipoLabelsCurto: Record<ModuloRegistroTipo, string> =
  {
    rnc: "RNC",
    rcc: "RCC",
    "avaliacao-fornecedor": "Avaliação de fornecedor",
  };

export function isModuloRegistroTipo(
  value: string | null | undefined
): value is ModuloRegistroTipo {
  return (
    value === "rnc" ||
    value === "rcc" ||
    value === "avaliacao-fornecedor"
  );
}

export const registroStatusLabels: Record<RegistroStatus, string> = {
  aberto: "Aberto",
  em_tratamento: "Em andamento",
  encerrado: "Fechado",
};

export const ORIGEM_NOMUS_LABEL = "Sistema Nomus";

/** Opções extraídas do histórico ERP — podem ser refinadas depois. */
export const RNC_TIPOS_ACAO = [
  "Real (já ocorrida)",
  "Potencial (pode ocorrer)",
] as const;

export const RNC_TIPOS_OCORRENCIA = [
  "Processo",
  "Produto",
  "Matéria-prima",
  "Relatórios de Ensaios",
] as const;

export const RNC_TIPOS_PRODUTO = [
  "Acabado",
  "Intermediário",
  "Outros",
] as const;

export const RNC_ACOES_IMEDIATAS = [
  "Aceitar como está",
  "Criar plano de ação",
  "Reclassificar",
  "Retrabalhar",
  "Sucatear",
  "Verificar com fornecedor",
] as const;

export const RNC_ANALISE_PROBLEMA = [
  "Aspecto físico do material recebido",
  "Chapa amassada",
  "Chapa arranhada",
  "Dimensões incorretas",
  "Falha na pintura",
  "Falha nos Estampos da Peça",
  "Falha nos furos da peça",
  "Falta de acessório",
  "Outros",
  "Qualidade do produto",
] as const;

export const rncFieldLabels = {
  codigoDocumento: "Código do documento",
  dataOcorrencia: "Data da ocorrência",
  tipoAcao: "Tipo de ação",
  tipoOcorrencia: "Tipo de ocorrência",
  setorOcorrencia: "Setor de ocorrência",
  grupoProduto: "Grupo de produto",
  codigoProduto: "Código do produto",
  produto: "Produto (descrição)",
  tipoProduto: "Tipo de produto",
  descricaoOcorrencia: "Descrição da ocorrência (RNC)",
  setorDeteccao: "Setor de detecção",
  responsavel: "Responsável",
  acaoImediata: "Ação imediata",
  descricaoAcaoImediata: "Descrição da ação imediata",
  responsavelAcaoImediata: "Responsável pela ação imediata",
  notaFiscal: "Nota fiscal",
  analiseProblema: "Análise do problema (RNC)",
  quantidade: "Quantidade",
  resolucaoNaoConformidade: "Resolução da não conformidade",
  causa: "Causa",
  dataFechamento: "Data de fechamento do RNC",
  usuarioCriacao: "Usuário responsável pela criação",
  prazoExecucao: "Prazo de execução",
} as const;

export const RCC_SIM_NAO = ["Sim", "Não"] as const;

export const RCC_RECLAMACOES = [
  "CHAMAS DESREGULADAS",
  "CHAPA AMASSADA",
  "CHAPA ENFERRUJADA",
  "EMISSÃO DE RUÍDOS ELEVADA",
  "FALTA DE PRODUTO",
  "FECHADURA/ PITÃO COM DEFEITO",
  "FERRUGEM",
  "MONTAGEM INCORRETA",
  "NÃO REFRIGERA",
  "OUTRO",
  "PEÇAS AVARIADAS",
  "PEÇAS FOLGADAS/ SOLTAS",
  "PEÇAS NÃO ENCAIXAM",
  "PRODUTO CONGELANDO",
  "PRODUTO DANDO CHOQUE",
  "PRODUTO ENVIADO ERRADO",
  "PRODUTO NÃO LIGA",
  "VAZAMENTO DE GÁS",
  "VAZAMENTO DE ÁGUA",
  "VIDRO QUEBRADO",
] as const;

export const RCC_SERVICOS_REALIZADOS = [
  "AJUSTE DE PEÇAS",
  "CARGA DE GÁS",
  "CORREÇÃO DO VAZAMENTO DE GÁS",
  "CORREÇÃO DO VAZAMENTO DE ÁGUA",
  "CORREÇÃO NA FIAÇÃO",
  "ENTREGUE AS PEÇAS FALTANTES",
  "OUTRO",
  "REFEITA A PROGRAMAÇÃO",
  "REGULAGEM DO TERMOSTATO",
  "TROCA DA BOIA",
  "TROCA DA RESISTÊNCIA",
  "TROCA DAS TORNEIRAS",
  "TROCA DE PEÇAS",
  "TROCA DO COMPRESSOR",
  "TROCA DO MICRO VENTILADOR",
  "TROCA DO PRODUTO",
  "TROCA DO TERMOSTATO",
  "NÃO FOI DETECTADO NENHUM PROBLEMA",
] as const;

export const RCC_VENDEDOR_PADRAO =
  "SO AÇO INDUSTRIAL LTDA - SO MOVEIS LTDA";

export const rccFieldLabels = {
  codigoDocumento: "Código do documento",
  codigoProduto: "Código do produto",
  dataRegistroReclamacao: "Data de registro da reclamação",
  cidade: "Cidade",
  nomeClienteConsumidor: "Nome do cliente consumidor",
  contato: "Contato",
  telefone: "Telefone",
  bairro: "Bairro",
  endereco: "Endereço",
  pontoReferencia: "Ponto de referência",
  clienteDoRevendedor: "Cliente do revendedor ?",
  nomeRevendedor: "Nome do revendedor",
  cidadeRevendedor: "Cidade",
  estadoRevendedor: "Estado (UF)",
  vendedor: "Vendedor",
  produto: "Produto (RCC)",
  grupoProduto: "Grupo de produto",
  numeroSerieLoteProduto: "Nº Série/Lote do produto",
  dataEmissaoNf: "Data de emissão da NF",
  numeroNf: "N° da NF",
  numeroPedidoInternoExterno: "N° do pedido interno/externo",
  produtoNossaFabricacao: "Produto de nossa fabricação?",
  produtoDentroGarantia: "Produto dentro da garantia?",
  quantidade: "Quantidade",
  descricaoReclamacao: "Descrição da reclamação",
  analiseCausaQualidade: "Análise de causa (Qualidade)",
  comentario: "Comentário",
  reclamacao1: "Reclamação 1",
  reclamacao2: "Reclamação 2",
  reclamacaoAceita: "Reclamação aceita?",
  abrirOrdemServico: "Abrir ordem de serviço?",
  servicoRealizado: "Serviço realizado",
  servicoRealizado1: "Serviço realizado (1)",
  servicoRealizado2: "Serviço realizado (2)",
  funcionarioSolicitado: "Funcionário solicitado",
  numeroOrdemProducao: "Número de ordem de produção",
  dataAssistencia: "Previsão para data de assistência",
  horaSaidaEmpresa: "Hora da saída da empresa",
  numeroSerieCompressor: "Número de série do compressor",
  horaChegadaEmpresa: "Hora de chegada à empresa",
  problemaSolucionado: "Problema solucionado?",
  dataFechamento: "Data de fechamento",
  causaProblema: "Causa do problema",
  estado: "Estado (UF)",
  usuarioCriacao: "Usuário responsável pela criação",
} as const;
