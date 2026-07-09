import type { WorkflowMovimentacao } from "@/types/workflow";

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
  novaDataValidade: string;
  usuarioId: string;
}

export interface DocumentPublicacao {
  solicitarRevisaoAposPublicacao?: boolean;
  avisarPorEmail?: boolean;
}

export type PermissaoAcessoDocumento = "todos" | "restrito" | "responsavel";

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
}
