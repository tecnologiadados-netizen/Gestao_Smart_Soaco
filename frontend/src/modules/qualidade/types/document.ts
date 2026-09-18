import type { WorkflowMovimentacao } from "@qualidade/types/workflow";

export type DocumentStatus =
  | "rascunho"
  | "em_revisao"
  | "em_aprovacao"
  | "vigente"
  | "obsoleto";

export interface DocumentVersion {
  id: string;
  documentId: string;
  versao: string;
  elaboradorId: string;
  consensoId?: string;
  revisorId?: string;
  aprovadorId?: string;
  prazos?: DocumentWorkflowPrazos;
  dataElaboracao: string;
  dataRevisao?: string;
  dataAprovacao?: string;
  observacoes?: string;
  justificativaRevisao?: string;
  alteracoesRevisao?: string;
  arquivoNome?: string;
  arquivoDataUrl?: string;
  arquivoStoragePath?: string;
  /** Todos os arquivos da revisão (principal + complementares). */
  anexos?: DocumentoAnexoArquivo[];
  observacoesElaboracao?: string;
  observacoesConsenso?: string;
  observacoesAprovacao?: string;
  movimentacoes?: WorkflowMovimentacao[];
  requerSubstituicaoConsenso?: boolean;
  arquivoAtualizadoEm?: string;
}

export interface DocumentWorkflowPrazos {
  elaboracao: number;
  consenso: number;
  aprovacao: number;
}

export type DocumentOrigem = "interno" | "externo" | "registro";

export interface DocumentPermissoes {
  avisoPublicacaoEmailIds: string[];
  baixarArquivoIds: string[];
  imprimirArquivoIds: string[];
  /** IDs dos setores cadastrados em Configurações → Setores */
  copiasDistribuidasIds: string[];
  consultarTodos: boolean;
  consultarIds: string[];
}

export type ValidadeModo = "periodo" | "data";

export interface DocumentValidade {
  ativa: boolean;
  /** periodo = calcula vencimento na publicação; data = usa dataValidade informada */
  modo?: ValidadeModo;
  periodoDias: number;
  dataValidade?: string;
}

export type ValidadeMarcoDias = 30 | 20 | 10 | 5 | 3 | 1 | 0;

export interface DocumentValidadeAlerta {
  id: string;
  documentId: string;
  marcoDias: ValidadeMarcoDias;
  severidade: "info" | "warning" | "danger";
  mensagem: string;
  createdAt: string;
  lida: boolean;
}

export interface DocumentRevalidacao {
  id: string;
  documentId: string;
  data: string;
  observacoes: string;
  evidenciaNome?: string;
  evidenciaDataUrl?: string;
  evidenciaStoragePath?: string;
  novaDataValidade: string;
  usuarioId: string;
}

export interface DocumentPublicacao {
  solicitarRevisaoAposPublicacao?: boolean;
  avisarPorEmail?: boolean;
}

export type PermissaoAcessoDocumento = "todos" | "restrito" | "responsavel";

export type RetencaoUnidade = "meses" | "anos";

/** Metadado de anexo em documento externo / registro. */
export interface DocumentoAnexoArquivo {
  nome: string;
  dataUrl: string;
  storagePath?: string;
  /** Liga o arquivo à ocorrência do registro interno. */
  ocorrenciaId?: string;
}

/** Uma ocorrência (arquivo + data) de um registro interno. */
export interface DocumentoRegistroOcorrencia {
  id: string;
  nome: string;
  dataOcorrencia: string;
  observacao?: string;
  criadoEm: string;
  storagePath?: string;
}

/** Campos específicos de documento externo e registro */
export interface DocumentExternoRegistro {
  unidadeTodos: boolean;
  distribuicaoEletronica: boolean;
  distribuicaoFisica: boolean;
  avisarAntesAtivo: boolean;
  avisarAntesDias: number;
  observacao?: string;
  associarDocumentos: boolean;
  documentosAssociadosIds: string[];
  permissaoAcesso: PermissaoAcessoDocumento;
  anexos?: DocumentoAnexoArquivo[];
  /** Prazo de retenção (texto de exibição, ex.: "2 anos"). */
  retencao?: string;
  retencaoValor?: number;
  retencaoUnidade?: RetencaoUnidade;
  /** Como o registro é protegido (texto livre). */
  protecao?: string;
  /** Como recuperar o registro (texto livre). */
  recuperacao?: string;
  /** Arquivo-modelo da ficha (preenchido no cadastro). */
  modelo?: DocumentoAnexoArquivo;
  /** Histórico de arquivos inseridos no registro interno. */
  ocorrencias?: DocumentoRegistroOcorrencia[];
}

export interface Document {
  id: string;
  codigo: string;
  titulo: string;
  tipoId: string;
  setorId: string;
  status: DocumentStatus;
  versaoAtual: string;
  origem: DocumentOrigem;
  localizacao?: string;
  permissoes?: DocumentPermissoes;
  publicacao?: DocumentPublicacao;
  validade?: DocumentValidade;
  externoRegistro?: DocumentExternoRegistro;
  createdAt: string;
  updatedAt: string;
  /**
   * Momento da última transição de etapa. O sync compara este carimbo com o do
   * servidor para descartar snapshots atrasados que reverteriam o workflow.
   */
  statusAtualizadoEm?: string;
}
