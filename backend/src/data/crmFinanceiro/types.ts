export interface IndicadoresResumo {
  total: number;
  emAtraso: number;
  emDia: number;
  recebido30d: number;
  recebido90d: number;
  recebidoAno: number;
  recebidoHistorico: number;
}

export type ColunaIndicador =
  | "total"
  | "emAtraso"
  | "emDia"
  | "recebido30d"
  | "recebido90d"
  | "recebidoAno"
  | "recebidoHistorico";

export interface IndicadorDetalheClickPayload {
  coluna: ColunaIndicador;
  classificacao: string | null;
  nomeClassificacao: string;
  valor: number;
}

export interface IndicadorClassificacao {
  classificacao: string;
  nomeClassificacao: string;
  total: number;
  emAtraso: number;
  emDia: number;
  recebido30d: number;
  recebido90d: number;
  recebidoAno: number;
  recebidoHistorico: number;
}

export interface ContaFinanceira {
  codigo: number;
  dataVencimento: string | null;
  dataAgendamento: string | null;
  classificacao: string | null;
  nomeClassificacao: string | null;
  empresa: string | null;
  contaBancaria: string | null;
  formaPagamento: string | null;
  pessoa: string | null;
  descricao: string | null;
  comentariosAgendamento: string | null;
  comentariosLancamento: string | null;
  nfeOrigem: string | null;
  valor: number;
  status: string;
  natureza: string;
  diasAtraso: number;
  /** Linha baixada/FIDC reclassificada como aberta por comentário TITULO DESCONTADO. */
  tituloDescontadoAberto?: boolean;
}

export interface Recebimento {
  codigo: number;
  dataEmissao: string | null;
  dataVencimento: string | null;
  dataBaixa: string | null;
  dataRecebimento: string | null;
  dataCompetencia: string | null;
  classificacao: string | null;
  nomeClassificacao: string | null;
  contaBancaria: string | null;
  formaPagamento: string | null;
  pessoa: string | null;
  descricao: string | null;
  comentariosAgendamento: string | null;
  comentariosLancamento: string | null;
  nfeOrigem: string | null;
  totalDias: number | null;
  valorAteVencimento: number;
  valorBaixado: number;
  valorRecebido: number;
  valorJuros: number;
}

export interface PessoaOption {
  nome: string;
  razaoSocial: string | null;
  cnpjCpf: string | null;
  totalPendente: number;
  idGrupoPessoa: number | null;
  grupo: string | null;
}

export interface GrupoPessoaOption {
  id: number;
  nome: string;
  qtdMembros: number;
  totalPendente: number;
}

export interface MembroGrupoResumo {
  nome: string;
  razaoSocial: string | null;
  cnpjCpf: string | null;
  totalPendente: number;
}

export interface GrupoFiltradoInfo {
  id: number;
  nome: string;
  membros: MembroGrupoResumo[];
}

export interface EmpresaOption {
  id: number;
  nome: string;
}

export interface DashboardGlobalData {
  indicadoresGlobais: {
    receber: IndicadoresResumo;
    pagar: IndicadoresResumo;
  };
  indicadoresPorClassificacao: {
    receber: IndicadorClassificacao[];
    pagar: IndicadorClassificacao[];
  };
  pessoaFiltrada: string | null;
  grupoFiltrado: GrupoFiltradoInfo | null;
}

export interface DashboardDetalhesData {
  indicadoresGlobais: {
    receber: IndicadoresResumo;
    pagar: IndicadoresResumo;
  };
  indicadoresPorClassificacao: {
    receber: IndicadorClassificacao[];
    pagar: IndicadorClassificacao[];
  };
  contasReceberAtraso: ContaFinanceira[];
  contasReceberEmDia: ContaFinanceira[];
  contasPagarAtraso: ContaFinanceira[];
  contasPagarEmDia: ContaFinanceira[];
  recebimentos: Recebimento[];
  pagamentos: Recebimento[];
  pessoaFiltrada: string | null;
  grupoFiltrado: GrupoFiltradoInfo | null;
}

export interface DashboardData {
  indicadoresGlobais: {
    receber: IndicadoresResumo;
    pagar: IndicadoresResumo;
  };
  indicadoresPorClassificacao: {
    receber: IndicadorClassificacao[];
    pagar: IndicadorClassificacao[];
  };
  contasReceberAtraso: ContaFinanceira[];
  contasReceberEmDia: ContaFinanceira[];
  contasPagarAtraso: ContaFinanceira[];
  contasPagarEmDia: ContaFinanceira[];
  recebimentos: Recebimento[];
  pagamentos: Recebimento[];
  pessoaFiltrada: string | null;
  grupoFiltrado: GrupoFiltradoInfo | null;
}
