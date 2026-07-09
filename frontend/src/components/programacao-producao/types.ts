export type ProgramacaoProducaoStatus = 'em_processamento' | 'processado' | 'concluido';

export interface ProgramacaoProducaoListItem {
  id: string;
  name: string;
  description?: string;
  criadoPorLogin: string;
  criadoPorNome?: string;
  createdAt: string;
  updatedAt: string;
  linhaCount: number;
  status: ProgramacaoProducaoStatus;
  processadoAt: string | null;
  usuarioLoginProcessado: string | null;
  concluidoAt: string | null;
  usuarioLoginConcluido: string | null;
}

export interface EstoqueEmProcesso {
  perfiladeira: number;
  corteDobra: number;
  solda: number;
  pintura: number;
  montagem: number;
}

/** Passo de um roteiro (códigos dos recursos cadastrados, em ordem). */
export interface RoteiroProducao {
  sequencia: string[];
  qtde: number;
  /** Preenchido na programação; não vai para o catálogo do produto. */
  chapa?: string | null;
}

export interface QtdeProduzir {
  roteiros: RoteiroProducao[];
}

export type MedidasPecaCatalogEntry = {
  med1: number | null;
  med2: number | null;
};

export type ProgramacaoProducaoRecurso = {
  cod: string;
  nome: string;
  criadoPorLogin: string;
  criadoPorNome: string | null;
  atualizadoPorLogin: string;
  atualizadoPorNome: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Ordem de produção aberta no Nomus (recurso 124). */
/** OP vinculada na programação (saldo Nomus no momento da seleção). */
export interface OrdemProducaoNomusSelecionada {
  ordem: string;
  saldo: number;
}

export interface OrdemNomusOpcao {
  ordem: string;
  tipo_ordem: string;
  codigo_produto: string;
  descricao_produto: string;
  unidade_medida: string | null;
  qtde_planejada: number;
  qtde_produzida: number;
  saldo: number;
  prioridade: number | null;
  data_emissao: string | null;
  data_inicial_planejada: string | null;
  data_entrega: string | null;
  status: string;
}

export interface EstoqueMpAlternativaDetalheItem {
  cod: string;
  descricao: string | null;
  /** Setor 19 — Galpão Bobina */
  saldoGalpaoBobina: number;
  /** Setor 20 — MP Processada */
  saldoMpProcessada: number;
  saldoTotal: number;
}

/** Bobina alternativa (Alter 1 = maior prioridade). */
export interface BobinaAlternativaItem {
  cod: string;
  descricao: string | null;
  idProduto: number | null;
}

export interface LinhaProgramacaoProducao {
  idComponente: number;
  idBobina?: number | null;
  cod_componente: string;
  descricao_componente: string;
  peso_unitario_bobina: number | null;
  estoque_atual_componente: number;
  empenho_componente: number;
  venda_media_componente: number;
  cod_bobina: string | null;
  descricao_bobina: string | null;
  estoque_atual_bobina: number | null;
  /** Soma do saldo (setores 19/20) de todas as bobinas alternativas (códigos únicos). */
  estoque_mp_alternativa?: number | null;
  estoque_mp_alternativa_erro?: string | null;
  estoque_mp_alternativa_detalhe?: EstoqueMpAlternativaDetalheItem[];
  /** @deprecated Mantido por compatibilidade; não usado no cálculo. */
  id_bobina_alternativa?: number | null;
  kg_bobina_necessario: number | null;
  saldo_projetado: number | null;
  cobertura_meses: number | null;
  descricao_simplificada?: string | null;
  grupo_produto?: string | null;
  /** Lista ordenada por prioridade (índice 0 = Alter 1 na grade). */
  bobinas_alternativas?: BobinaAlternativaItem[];
  cod_bobina_alternativa?: string | null;
  descricao_bobina_alternativa?: string | null;
  estoque_em_processo?: EstoqueEmProcesso;
  sequencia?: number | null;
  qtde_produzir?: QtdeProduzir;
  /** OPs Nomus selecionadas (status processado). */
  ordens_producao_nomus?: OrdemProducaoNomusSelecionada[];
  /** Resumo legado / exportação; derivado de ordens_producao_nomus. */
  ordem_producao_nomus?: string | null;
  observacao?: string | null;
}

export interface DadosProgramacaoProducaoV1 {
  versao: 1;
  geradoEm: string;
  /** Momento do snapshot gravado (dados Nomus congelados ao criar a programação). */
  snapshotEm?: string;
  /** Versão do catálogo de bobinas alternativas (reaplica Alter1… ao abrir). */
  catalogBobinasV?: number;
  linhas: LinhaProgramacaoProducao[];
}

export interface ProgramacaoProducaoSalva {
  id: string;
  name: string;
  description?: string;
  dados: DadosProgramacaoProducaoV1;
  updatedAt: string;
  status: ProgramacaoProducaoStatus;
  processadoAt: string | null;
  usuarioLoginProcessado: string | null;
  concluidoAt: string | null;
  usuarioLoginConcluido: string | null;
}

export type ProgramacaoProducaoGradeRowApi = {
  id_componente: number;
  cod_componente: string;
  descricao_componente: string;
  peso_unitario_bobina: number | null;
  estoque_atual_componente: number;
  empenho_componente: number;
  venda_media_componente: number;
  cod_bobina: string | null;
  descricao_bobina: string | null;
  id_bobina: number | null;
  estoque_atual_bobina: number | null;
  kg_bobina_necessario: number | null;
  saldo_projetado: number | null;
  cobertura_meses: number | null;
};

export type EstoqueSetorDetalhe = {
  id_setor: number;
  nome_setor: string;
  saldo: number;
};

export type ExplosaoPaDetalhe = {
  cod_pa: string;
  descricao_pa: string;
  qtde_alocada: number;
};
