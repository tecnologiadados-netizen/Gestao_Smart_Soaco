import { RCC_VENDEDOR_PADRAO } from "@qualidade/lib/registros/constants";

export interface RccDados {
  codigoDocumento: string;
  codigoProduto: string;
  dataRegistroReclamacao: string;
  cidade: string;
  nomeClienteConsumidor: string;
  contato: string;
  telefone: string;
  bairro: string;
  endereco: string;
  pontoReferencia: string;
  clienteDoRevendedor: boolean;
  nomeRevendedor: string;
  cidadeRevendedor: string;
  estadoRevendedor: string;
  vendedor: string;
  produto: string;
  grupoProduto: string;
  numeroSerieLoteProduto: string;
  dataEmissaoNf: string;
  numeroNf: string;
  numeroPedidoInternoExterno: string;
  produtoNossaFabricacao: string;
  produtoDentroGarantia: string;
  quantidade: string;
  descricaoReclamacao: string;
  analiseCausaQualidade: string;
  comentario: string;
  reclamacao1: string;
  reclamacao2: string;
  reclamacaoAceita: string;
  abrirOrdemServico: string;
  servicoRealizado: string;
  servicoRealizado1: string;
  servicoRealizado2: string;
  funcionarioSolicitado: string;
  numeroOrdemProducao: string;
  dataAssistencia: string;
  horaSaidaEmpresa: string;
  numeroSerieCompressor: string;
  horaChegadaEmpresa: string;
  problemaSolucionado: string;
  dataFechamento: string;
  causaProblema: string;
  estado: string;
  usuarioCriacao: string;
}

export function criarRccDadosVazio(codigoDocumento = ""): RccDados {
  return {
    codigoDocumento,
    codigoProduto: "",
    dataRegistroReclamacao: "",
    cidade: "",
    nomeClienteConsumidor: "",
    contato: "",
    telefone: "",
    bairro: "",
    endereco: "",
    pontoReferencia: "",
    clienteDoRevendedor: false,
    nomeRevendedor: "",
    cidadeRevendedor: "",
    estadoRevendedor: "",
    vendedor: RCC_VENDEDOR_PADRAO,
    produto: "",
    grupoProduto: "",
    numeroSerieLoteProduto: "",
    dataEmissaoNf: "",
    numeroNf: "",
    numeroPedidoInternoExterno: "",
    produtoNossaFabricacao: "",
    produtoDentroGarantia: "",
    quantidade: "",
    descricaoReclamacao: "",
    analiseCausaQualidade: "",
    comentario: "",
    reclamacao1: "",
    reclamacao2: "",
    reclamacaoAceita: "",
    abrirOrdemServico: "",
    servicoRealizado: "",
    servicoRealizado1: "",
    servicoRealizado2: "",
    funcionarioSolicitado: "",
    numeroOrdemProducao: "",
    dataAssistencia: "",
    horaSaidaEmpresa: "",
    numeroSerieCompressor: "",
    horaChegadaEmpresa: "",
    problemaSolucionado: "",
    dataFechamento: "",
    causaProblema: "",
    estado: "",
    usuarioCriacao: "",
  };
}

/** Garante campos novos em registros antigos (histórico Nomus / persist). */
export function normalizarRccDados(
  rcc: Partial<RccDados> & Pick<RccDados, "codigoDocumento">
): RccDados {
  const base = criarRccDadosVazio(rcc.codigoDocumento);
  return {
    ...base,
    ...rcc,
    vendedor: rcc.vendedor?.trim() || base.vendedor,
  };
}

export { isoParaInputDate, inputDateParaIso } from "@qualidade/types/rnc";
