import { create } from "zustand";
import type {
  Document,
  DocumentRevalidacao,
  DocumentStatus,
  DocumentValidadeAlerta,
  DocumentVersion,
  DocumentWorkflowPrazos,
  DocumentPermissoes,
  DocumentPublicacao,
  DocumentValidade,
  DocumentExternoRegistro,
  DocumentOrigem,
} from "@qualidade/types/document";
import type { Task } from "@qualidade/types/task";
import { getQualidadeCurrentUserId } from "@qualidade/lib/current-user";
import type { WorkflowMovimentacao } from "@qualidade/types/workflow";
import { generateNextDocumentCode } from "@qualidade/lib/documents/generate-code";
import {
  computeTaskDeadline,
  resolveTaskAssignee,
} from "@qualidade/lib/documents/task-assignee";
import {
  formatRevision,
  getNextRevision,
  INITIAL_REVISION,
} from "@qualidade/lib/documents/revision";
import {
  calcularDiasRestantesValidade,
  calcularProximaDataValidade,
  documentoExigeRevalidacao,
  marcosAlertaAplicaveis,
  mensagemAlertaValidade,
  severidadeAlertaValidade,
} from "@qualidade/lib/documents/validity";

interface CreateDocumentInput {
  codigo?: string;
  tipoSigla?: string;
  titulo: string;
  tipoId: string;
  setorId: string;
  elaboradorId: string;
  consensoId?: string;
  aprovadorId?: string;
  prazos?: DocumentWorkflowPrazos;
  observacoes?: string;
  origem: DocumentOrigem;
  versao?: string;
  localizacao?: string;
  permissoes?: DocumentPermissoes;
  publicacao?: DocumentPublicacao;
  validade?: DocumentValidade;
  externoRegistro?: DocumentExternoRegistro;
  arquivoNome?: string;
  arquivoDataUrl?: string;
}

interface RevalidarDocumentoInput {
  observacoes: string;
  novaDataValidade: string;
  evidenciaNome?: string;
  evidenciaDataUrl?: string;
}

interface UpdateDocumentCadastroInput {
  titulo: string;
  setorId: string;
  elaboradorId: string;
  consensoId?: string;
  aprovadorId?: string;
  prazos?: DocumentWorkflowPrazos;
  permissoes?: DocumentPermissoes;
  publicacao?: DocumentPublicacao;
  validade?: DocumentValidade;
}

interface SolicitarRevisaoInput {
  elaboradorId: string;
  consensoId?: string;
  aprovadorId?: string;
  prazos: DocumentWorkflowPrazos;
  justificativaRevisao: string;
  alteracoesRevisao?: string;
  arquivoNome?: string;
  arquivoDataUrl?: string;
  /** Atualiza validade e conclui pendência de revalidação (fluxo revalidação → revisão). */
  novaDataValidade?: string;
}

interface DocumentsState {
  documents: Document[];
  versions: DocumentVersion[];
  tasks: Task[];
  validadeAlertas: DocumentValidadeAlerta[];
  revalidacoes: DocumentRevalidacao[];
  createDocument: (input: CreateDocumentInput) => string;
  updateDocumentCadastro: (
    documentId: string,
    input: UpdateDocumentCadastroInput
  ) => boolean;
  createNewRevision: (
    documentId: string,
    input: SolicitarRevisaoInput
  ) => string | null;
  getNextDocumentCode: (tipoSigla: string) => string;
  getNextRevisionForDocument: (documentId: string) => string;
  getDocumentById: (id: string) => Document | undefined;
  getVersionsByDocumentId: (id: string) => DocumentVersion[];
  getPendingTasks: (userId: string, allUsers?: boolean) => Task[];
  getDocumentTasks: () => Task[];
  enviarParaRevisao: (documentId: string, consensoId: string) => void;
  aprovarConsenso: (
    documentId: string,
    observacoesConsenso?: string
  ) => boolean;
  reenviarParaAprovacao: (
    documentId: string,
    observacoesConsenso?: string
  ) => boolean;
  reprovarConsenso: (documentId: string, motivo: string) => boolean;
  aprovarDocumentoFinal: (
    documentId: string,
    observacoesAprovacao?: string
  ) => boolean;
  reprovarAprovacao: (documentId: string, motivo: string) => boolean;
  updateElaboracao: (
    documentId: string,
    input: {
      arquivoNome?: string;
      arquivoDataUrl?: string;
      observacoesElaboracao?: string;
    }
  ) => void;
  updateConsenso: (
    documentId: string,
    input: {
      observacoesConsenso?: string;
      arquivoNome?: string;
      arquivoDataUrl?: string;
    }
  ) => void;
  completeTask: (taskId: string) => void;
  inativarDocumento: (documentId: string) => boolean;
  excluirDocumento: (documentId: string) => boolean;
  syncValidadeAlertas: () => void;
  getValidadeAlertasNaoLidos: () => DocumentValidadeAlerta[];
  getRevalidacoesByDocumentId: (documentId: string) => DocumentRevalidacao[];
  marcarAlertaValidadeLido: (alertaId: string) => void;
  revalidarDocumento: (
    documentId: string,
    input: RevalidarDocumentoInput
  ) => boolean;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

function getCurrentVersion(
  versions: DocumentVersion[],
  documentId: string,
  versaoAtual: string
) {
  return versions.find(
    (v) => v.documentId === documentId && v.versao === versaoAtual
  );
}

function withoutPendingDocumentTasks(tasks: Task[], documentId: string) {
  return tasks.filter(
    (t) => !(t.referenciaId === documentId && t.status === "pendente")
  );
}

function exigeSubstituicaoConsenso(version: DocumentVersion): boolean {
  if (version.requerSubstituicaoConsenso) return true;
  const movimentacoes = version.movimentacoes ?? [];
  return movimentacoes.some(
    (m) => m.etapa === "aprovacao" && m.acao === "reprovacao"
  );
}

function appendMovimentacao(
  version: DocumentVersion,
  mov: WorkflowMovimentacao
): DocumentVersion {
  return {
    ...version,
    movimentacoes: [...(version.movimentacoes ?? []), mov],
  };
}

function mergeValidadeOnUpdate(
  atual: DocumentValidade | undefined,
  input: DocumentValidade | undefined
): DocumentValidade | undefined {
  if (!input?.ativa) return undefined;

  if (input.modo === "data") {
    return {
      ativa: true,
      modo: "data",
      periodoDias: input.periodoDias,
      dataValidade: input.dataValidade,
    };
  }

  return {
    ativa: true,
    modo: "periodo",
    periodoDias: input.periodoDias,
    dataValidade:
      atual?.modo === "periodo" ? atual?.dataValidade : undefined,
  };
}

function applyValidadeSync(
  documents: Document[],
  versions: DocumentVersion[],
  alertas: DocumentValidadeAlerta[],
  tasks: Task[]
): { alertas: DocumentValidadeAlerta[]; tasks: Task[] } {
  const now = new Date().toISOString();
  let nextAlertas = [...alertas];
  let nextTasks = [...tasks];

  for (const doc of documents) {
    if (
      doc.status !== "vigente" ||
      !doc.validade?.ativa ||
      !doc.validade.dataValidade
    ) {
      continue;
    }

    const dias = calcularDiasRestantesValidade(doc.validade.dataValidade);
    if (dias === null) continue;

    for (const marco of marcosAlertaAplicaveis(dias)) {
      const exists = nextAlertas.some(
        (alerta) =>
          alerta.documentId === doc.id && alerta.marcoDias === marco
      );
      if (!exists) {
        nextAlertas.push({
          id: generateId("val-alert"),
          documentId: doc.id,
          marcoDias: marco,
          severidade: severidadeAlertaValidade(marco, dias),
          mensagem: mensagemAlertaValidade(doc, marco, dias),
          createdAt: now,
          lida: false,
        });
      }
    }

    if (dias <= 0) {
      const hasTask = nextTasks.some(
        (task) =>
          task.referenciaId === doc.id &&
          task.tipo === "revalidar_documento" &&
          task.status === "pendente"
      );
      if (!hasTask) {
        const version = getCurrentVersion(
          versions,
          doc.id,
          doc.versaoAtual
        );
        nextTasks.push({
          id: generateId("task"),
          tipo: "revalidar_documento",
          titulo: `Revalidar ${doc.codigo} — ${doc.titulo}`,
          descricao:
            dias === 0
              ? `Validade vence hoje · Revisão ${doc.versaoAtual}`
              : `Validade vencida · Revisão ${doc.versaoAtual}`,
          referenciaId: doc.id,
          referenciaTipo: "documento",
          responsavelId: resolveTaskAssignee(version?.elaboradorId),
          prazo: doc.validade.dataValidade,
          status: "pendente",
          createdAt: now,
        });
      }
    }
  }

  return { alertas: nextAlertas, tasks: nextTasks };
}

function applyRevalidacaoAposRevisao(
  documents: Document[],
  versions: DocumentVersion[],
  documentId: string,
  novaDataValidade: string,
  observacoes: string,
  now: string,
  alertas: DocumentValidadeAlerta[],
  tasks: Task[],
  revalidacoes: DocumentRevalidacao[]
): {
  documents: Document[];
  alertas: DocumentValidadeAlerta[];
  tasks: Task[];
  revalidacoes: DocumentRevalidacao[];
} {
  const documentsUpdated = documents.map((d) =>
    d.id === documentId && d.validade?.ativa
      ? {
          ...d,
          validade: {
            ...d.validade,
            dataValidade: novaDataValidade,
          },
          updatedAt: now,
        }
      : d
  );
  const tasksUpdated = tasks.map((task) =>
    task.referenciaId === documentId &&
    task.tipo === "revalidar_documento" &&
    task.status === "pendente"
      ? { ...task, status: "concluida" as const }
      : task
  );
  const alertasUpdated = alertas.map((alerta) =>
    alerta.documentId === documentId ? { ...alerta, lida: true } : alerta
  );
  const revalidacao: DocumentRevalidacao = {
    id: generateId("reval"),
    documentId,
    data: now,
    observacoes,
    novaDataValidade,
    usuarioId: getQualidadeCurrentUserId(),
  };
  const synced = applyValidadeSync(
    documentsUpdated,
    versions,
    alertasUpdated,
    tasksUpdated
  );
  return {
    documents: documentsUpdated,
    alertas: synced.alertas,
    tasks: synced.tasks,
    revalidacoes: [...revalidacoes, revalidacao],
  };
}

export const useDocumentsStore = create<DocumentsState>()((set, get) => ({
      documents: [],
      versions: [],
      tasks: [],
      validadeAlertas: [],
      revalidacoes: [],

      createDocument: (input) => {
        const id = generateId("doc");
        const now = new Date().toISOString();
        const versao = formatRevision(input.versao ?? INITIAL_REVISION);
        const codigo =
          input.codigo ??
          (input.tipoSigla
            ? generateNextDocumentCode(
                input.tipoSigla,
                get().documents.map((d) => d.codigo)
              )
            : "");
        const skipWorkflow =
          input.origem === "externo" ||
          (input.origem === "registro" && !input.consensoId);
        const doc: Document = {
          id,
          codigo,
          titulo: input.titulo,
          tipoId: input.tipoId,
          setorId: input.setorId,
          status: skipWorkflow ? "vigente" : "rascunho",
          versaoAtual: versao,
          origem: input.origem,
          localizacao: input.localizacao,
          permissoes: input.permissoes,
          publicacao: input.publicacao,
          validade: input.validade,
          externoRegistro: input.externoRegistro,
          createdAt: now,
          updatedAt: now,
        };
        const version: DocumentVersion = {
          id: generateId("ver"),
          documentId: id,
          versao,
          elaboradorId: input.elaboradorId,
          consensoId: input.consensoId,
          aprovadorId: input.aprovadorId,
          prazos: input.prazos,
          dataElaboracao: now,
          observacoes: input.observacoes,
          arquivoNome: input.arquivoNome,
          arquivoDataUrl: input.arquivoDataUrl,
          ...(skipWorkflow ? { dataAprovacao: now } : {}),
        };
        set((state) => {
          const documents = [doc, ...state.documents];
          const synced = skipWorkflow
            ? applyValidadeSync(
                documents,
                [...state.versions, version],
                state.validadeAlertas,
                state.tasks
              )
            : { alertas: state.validadeAlertas, tasks: state.tasks };

          return {
            documents,
            versions: [...state.versions, version],
            validadeAlertas: synced.alertas,
            tasks: skipWorkflow
              ? synced.tasks
              : [
                  ...state.tasks,
                  {
                    id: generateId("task"),
                    tipo: "elaborar_documento" as const,
                    titulo: `Elaborar ${codigo} — ${input.titulo}`,
                    descricao: `Revisão ${versao} · Etapa: Elaboração`,
                    referenciaId: id,
                    referenciaTipo: "documento" as const,
                    responsavelId: resolveTaskAssignee(input.elaboradorId),
                    prazo: computeTaskDeadline(
                      now,
                      input.prazos?.elaboracao ?? 7
                    ),
                    status: "pendente" as const,
                    createdAt: now,
                  },
                ],
          };
        });
        return id;
      },

      updateDocumentCadastro: (documentId, input) => {
        const doc = get().getDocumentById(documentId);
        if (!doc) return false;

        const versaoAtual = getCurrentVersion(
          get().versions,
          documentId,
          doc.versaoAtual
        );
        if (!versaoAtual) return false;

        const now = new Date().toISOString();
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === documentId
              ? {
                  ...d,
                  titulo: input.titulo.trim(),
                  setorId: input.setorId,
                  permissoes: input.permissoes,
                  publicacao: input.publicacao,
                  validade: mergeValidadeOnUpdate(d.validade, input.validade),
                  updatedAt: now,
                }
              : d
          ),
          versions: state.versions.map((v) =>
            v.id === versaoAtual.id
              ? {
                  ...v,
                  elaboradorId: input.elaboradorId,
                  consensoId: input.consensoId,
                  aprovadorId: input.aprovadorId,
                  prazos: input.prazos,
                }
              : v
          ),
        }));
        return true;
      },

      getDocumentById: (id) => get().documents.find((d) => d.id === id),

      getNextDocumentCode: (tipoSigla) =>
        generateNextDocumentCode(
          tipoSigla,
          get().documents.map((d) => d.codigo)
        ),

      getNextRevisionForDocument: (documentId) =>
        getNextRevision(
          get()
            .versions.filter((v) => v.documentId === documentId)
            .map((v) => v.versao)
        ),

      createNewRevision: (documentId, input) => {
        const doc = get().getDocumentById(documentId);
        if (!doc || doc.status !== "vigente") return null;

        const justificativa = input.justificativaRevisao.trim();
        const alteracoes = input.alteracoesRevisao?.trim() ?? "";
        const isInterno = doc.origem === "interno";

        if (!input.elaboradorId || !justificativa) return null;
        if (isInterno && (!input.consensoId || !input.aprovadorId)) return null;
        if (
          !isInterno &&
          (!input.arquivoNome?.trim() || !input.arquivoDataUrl?.trim())
        ) {
          return null;
        }

        const now = new Date().toISOString();
        const versao = getNextRevision(
          get()
            .versions.filter((v) => v.documentId === documentId)
            .map((v) => v.versao)
        );
        const version: DocumentVersion = {
          id: generateId("ver"),
          documentId,
          versao,
          elaboradorId: input.elaboradorId,
          consensoId: isInterno ? input.consensoId : undefined,
          aprovadorId: isInterno ? input.aprovadorId : undefined,
          prazos: input.prazos,
          dataElaboracao: now,
          justificativaRevisao: justificativa,
          ...(alteracoes ? { alteracoesRevisao: alteracoes } : {}),
          observacoes: `Revisão ${versao} solicitada`,
          ...(!isInterno
            ? {
                dataAprovacao: now,
                arquivoNome: input.arquivoNome,
                arquivoDataUrl: input.arquivoDataUrl,
              }
            : {}),
        };

        if (!isInterno) {
          set((state) => {
            let documents = state.documents.map((d) =>
              d.id === documentId
                ? {
                    ...d,
                    status: "vigente" as DocumentStatus,
                    versaoAtual: versao,
                    updatedAt: now,
                  }
                : d
            );
            let tasks = withoutPendingDocumentTasks(state.tasks, documentId);
            let validadeAlertas = state.validadeAlertas;
            let revalidacoes = state.revalidacoes;
            const versions = [...state.versions, version];

            if (input.novaDataValidade) {
              const revalidacao = applyRevalidacaoAposRevisao(
                documents,
                versions,
                documentId,
                input.novaDataValidade,
                `Revalidação via revisão ${versao}: ${justificativa}`,
                now,
                validadeAlertas,
                tasks,
                revalidacoes
              );
              documents = revalidacao.documents;
              validadeAlertas = revalidacao.alertas;
              tasks = revalidacao.tasks;
              revalidacoes = revalidacao.revalidacoes;
            }

            return {
              documents,
              versions,
              tasks,
              validadeAlertas,
              revalidacoes,
            };
          });
          return versao;
        }

        set((state) => {
          let documents = state.documents.map((d) =>
            d.id === documentId
              ? {
                  ...d,
                  status: "rascunho" as DocumentStatus,
                  versaoAtual: versao,
                  updatedAt: now,
                }
              : d
          );
          let tasks = withoutPendingDocumentTasks(state.tasks, documentId);
          let validadeAlertas = state.validadeAlertas;
          let revalidacoes = state.revalidacoes;
          const versions = [...state.versions, version];

          if (input.novaDataValidade) {
            const revalidacao = applyRevalidacaoAposRevisao(
              documents,
              versions,
              documentId,
              input.novaDataValidade,
              `Revalidação via revisão ${versao}: ${justificativa}`,
              now,
              validadeAlertas,
              tasks,
              revalidacoes
            );
            documents = revalidacao.documents;
            validadeAlertas = revalidacao.alertas;
            tasks = revalidacao.tasks;
            revalidacoes = revalidacao.revalidacoes;
          }

          return {
            documents,
            versions,
            tasks: [
              ...tasks,
              {
                id: generateId("task"),
                tipo: "elaborar_documento",
                titulo: `Elaborar ${doc.codigo} — ${doc.titulo}`,
                descricao: `Revisão ${versao} · ${justificativa}`,
                referenciaId: documentId,
                referenciaTipo: "documento",
                responsavelId: resolveTaskAssignee(input.elaboradorId),
                prazo: computeTaskDeadline(
                  now,
                  input.prazos.elaboracao ?? 7
                ),
                status: "pendente",
                createdAt: now,
              },
            ],
            validadeAlertas,
            revalidacoes,
          };
        });

        return versao;
      },

      getVersionsByDocumentId: (id) =>
        get()
          .versions.filter((v) => v.documentId === id)
          .sort((a, b) => b.versao.localeCompare(a.versao)),

      getPendingTasks: (userId, allUsers = false) =>
        get().tasks.filter(
          (t) =>
            t.status === "pendente" &&
            (allUsers || t.responsavelId === userId)
        ),

      getDocumentTasks: () =>
        get().tasks.filter((t) => t.referenciaTipo === "documento"),

      enviarParaRevisao: (documentId, consensoId) => {
        const now = new Date().toISOString();
        const doc = get().getDocumentById(documentId);
        const version = doc
          ? getCurrentVersion(get().versions, documentId, doc.versaoAtual)
          : undefined;

        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === documentId
              ? { ...d, status: "em_revisao" as DocumentStatus, updatedAt: now }
              : d
          ),
          tasks: [
            ...withoutPendingDocumentTasks(state.tasks, documentId),
            {
              id: generateId("task"),
              tipo: "consenso_documento",
              titulo: `Consenso ${doc?.codigo} — ${doc?.titulo}`,
              descricao: `Revisão ${doc?.versaoAtual} · Etapa: Consenso`,
              referenciaId: documentId,
              referenciaTipo: "documento",
              responsavelId: resolveTaskAssignee(
                consensoId ?? version?.consensoId
              ),
              prazo: computeTaskDeadline(
                now,
                version?.prazos?.consenso ?? 7
              ),
              status: "pendente",
              createdAt: now,
            },
          ],
        }));
      },

      aprovarConsenso: (documentId, observacoesConsenso) => {
        const motivo = observacoesConsenso?.trim();
        const now = new Date().toISOString();
        const doc = get().getDocumentById(documentId);
        if (!doc || doc.status !== "em_revisao") return false;

        const version = getCurrentVersion(
          get().versions,
          documentId,
          doc.versaoAtual
        );
        if (!version?.arquivoNome) return false;
        if (exigeSubstituicaoConsenso(version)) return false;

        const movimentacao: WorkflowMovimentacao = {
          id: generateId("mov"),
          etapa: "consenso",
          acao: "aprovacao",
          usuarioId: getQualidadeCurrentUserId(),
          data: now,
        };

        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === documentId
              ? {
                  ...d,
                  status: "em_aprovacao" as DocumentStatus,
                  updatedAt: now,
                }
              : d
          ),
          versions: state.versions.map((v) =>
            v.documentId === documentId && v.versao === doc.versaoAtual
              ? appendMovimentacao(
                  {
                    ...v,
                    dataRevisao: now,
                    observacoesConsenso: motivo || v.observacoesConsenso,
                    requerSubstituicaoConsenso: false,
                  },
                  movimentacao
                )
              : v
          ),
          tasks: [
            ...withoutPendingDocumentTasks(state.tasks, documentId),
            {
              id: generateId("task"),
              tipo: "aprovar_documento",
              titulo: `Aprovar ${doc.codigo} — ${doc.titulo}`,
              descricao: `Revisão ${doc.versaoAtual} · Etapa: Aprovação`,
              referenciaId: documentId,
              referenciaTipo: "documento",
              responsavelId: resolveTaskAssignee(version.aprovadorId),
              prazo: computeTaskDeadline(
                now,
                version.prazos?.aprovacao ?? 7
              ),
              status: "pendente",
              createdAt: now,
            },
          ],
        }));
        return true;
      },

      reenviarParaAprovacao: (documentId, observacoesConsenso) => {
        const motivo = observacoesConsenso?.trim();
        const now = new Date().toISOString();
        const doc = get().getDocumentById(documentId);
        if (!doc || doc.status !== "em_revisao") return false;

        const version = getCurrentVersion(
          get().versions,
          documentId,
          doc.versaoAtual
        );
        if (!version?.arquivoNome) return false;
        if (!exigeSubstituicaoConsenso(version)) return false;
        if (!version.arquivoAtualizadoEm) return false;

        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === documentId
              ? {
                  ...d,
                  status: "em_aprovacao" as DocumentStatus,
                  updatedAt: now,
                }
              : d
          ),
          versions: state.versions.map((v) =>
            v.documentId === documentId && v.versao === doc.versaoAtual
              ? {
                  ...v,
                  observacoesConsenso: motivo || v.observacoesConsenso,
                  requerSubstituicaoConsenso: false,
                }
              : v
          ),
          tasks: [
            ...withoutPendingDocumentTasks(state.tasks, documentId),
            {
              id: generateId("task"),
              tipo: "aprovar_documento",
              titulo: `Aprovar ${doc.codigo} — ${doc.titulo}`,
              descricao: `Revisão ${doc.versaoAtual} · Reenvio após ajuste no consenso`,
              referenciaId: documentId,
              referenciaTipo: "documento",
              responsavelId: resolveTaskAssignee(version.aprovadorId),
              prazo: computeTaskDeadline(
                now,
                version.prazos?.aprovacao ?? 7
              ),
              status: "pendente",
              createdAt: now,
            },
          ],
        }));
        return true;
      },

      reprovarConsenso: (documentId, motivo) => {
        const motivoTrim = motivo.trim();
        if (!motivoTrim) return false;

        const now = new Date().toISOString();
        const doc = get().getDocumentById(documentId);
        if (!doc || doc.status !== "em_revisao") return false;

        const version = getCurrentVersion(
          get().versions,
          documentId,
          doc.versaoAtual
        );
        if (!version) return false;

        const movimentacao: WorkflowMovimentacao = {
          id: generateId("mov"),
          etapa: "consenso",
          acao: "reprovacao",
          motivo: motivoTrim,
          usuarioId: getQualidadeCurrentUserId(),
          data: now,
        };

        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === documentId
              ? { ...d, status: "rascunho" as DocumentStatus, updatedAt: now }
              : d
          ),
          versions: state.versions.map((v) =>
            v.documentId === documentId && v.versao === doc.versaoAtual
              ? appendMovimentacao(v, movimentacao)
              : v
          ),
          tasks: [
            ...withoutPendingDocumentTasks(state.tasks, documentId),
            {
              id: generateId("task"),
              tipo: "elaborar_documento",
              titulo: `Corrigir ${doc.codigo} — reprovado no consenso`,
              descricao: motivoTrim,
              referenciaId: documentId,
              referenciaTipo: "documento",
              responsavelId: resolveTaskAssignee(version.elaboradorId),
              prazo: computeTaskDeadline(
                now,
                version.prazos?.elaboracao ?? 7
              ),
              status: "pendente",
              createdAt: now,
            },
          ],
        }));
        return true;
      },

      aprovarDocumentoFinal: (documentId, observacoesAprovacao) => {
        const now = new Date().toISOString();
        const doc = get().getDocumentById(documentId);
        if (!doc || doc.status !== "em_aprovacao") return false;

        const version = getCurrentVersion(
          get().versions,
          documentId,
          doc.versaoAtual
        );
        if (!version) return false;

        const movimentacao: WorkflowMovimentacao = {
          id: generateId("mov"),
          etapa: "aprovacao",
          acao: "aprovacao",
          usuarioId: getQualidadeCurrentUserId(),
          data: now,
        };

        set((state) => {
          const documents = state.documents.map((d) => {
            if (d.id !== documentId) return d;
            const updated: Document = {
              ...d,
              status: "vigente",
              updatedAt: now,
            };
            if (d.validade?.ativa && !d.validade.dataValidade) {
              updated.validade = {
                ...d.validade,
                dataValidade: calcularProximaDataValidade(
                  now,
                  d.validade.periodoDias
                ),
              };
            }
            return updated;
          });
          const synced = applyValidadeSync(
            documents,
            state.versions,
            state.validadeAlertas,
            withoutPendingDocumentTasks(state.tasks, documentId)
          );
          return {
            documents,
            versions: state.versions.map((v) =>
              v.documentId === documentId && v.versao === doc.versaoAtual
                ? appendMovimentacao(
                    {
                      ...v,
                      dataAprovacao: now,
                      aprovadorId: version.aprovadorId ?? getQualidadeCurrentUserId(),
                      observacoesAprovacao: observacoesAprovacao?.trim(),
                    },
                    movimentacao
                  )
                : v
            ),
            tasks: synced.tasks,
            validadeAlertas: synced.alertas,
          };
        });
        return true;
      },

      reprovarAprovacao: (documentId, motivo) => {
        const motivoTrim = motivo.trim();
        if (!motivoTrim) return false;

        const now = new Date().toISOString();
        const doc = get().getDocumentById(documentId);
        if (!doc || doc.status !== "em_aprovacao") return false;

        const version = getCurrentVersion(
          get().versions,
          documentId,
          doc.versaoAtual
        );
        if (!version) return false;

        const movimentacao: WorkflowMovimentacao = {
          id: generateId("mov"),
          etapa: "aprovacao",
          acao: "reprovacao",
          motivo: motivoTrim,
          usuarioId: getQualidadeCurrentUserId(),
          data: now,
        };

        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === documentId
              ? { ...d, status: "em_revisao" as DocumentStatus, updatedAt: now }
              : d
          ),
          versions: state.versions.map((v) =>
            v.documentId === documentId && v.versao === doc.versaoAtual
              ? appendMovimentacao(
                  {
                    ...v,
                    requerSubstituicaoConsenso: true,
                    arquivoAtualizadoEm: undefined,
                  },
                  movimentacao
                )
              : v
          ),
          tasks: [
            ...withoutPendingDocumentTasks(state.tasks, documentId),
            {
              id: generateId("task"),
              tipo: "consenso_documento",
              titulo: `Consenso ${doc.codigo} — substituir documento`,
              descricao: motivoTrim,
              referenciaId: documentId,
              referenciaTipo: "documento",
              responsavelId: resolveTaskAssignee(version.consensoId),
              prazo: computeTaskDeadline(
                now,
                version.prazos?.consenso ?? 7
              ),
              status: "pendente",
              createdAt: now,
            },
          ],
        }));
        return true;
      },

      updateElaboracao: (documentId, input) => {
        const now = new Date().toISOString();
        const doc = get().getDocumentById(documentId);
        if (!doc) return;

        const removingFile =
          input.arquivoNome === "" || input.arquivoDataUrl === "";
        const replacingFile =
          !removingFile &&
          Boolean(input.arquivoNome && input.arquivoDataUrl);

        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === documentId ? { ...d, updatedAt: now } : d
          ),
          versions: state.versions.map((v) =>
            v.documentId === documentId && v.versao === doc.versaoAtual
              ? {
                  ...v,
                  ...(input.arquivoNome !== undefined
                    ? { arquivoNome: input.arquivoNome || undefined }
                    : {}),
                  ...(input.arquivoDataUrl !== undefined
                    ? { arquivoDataUrl: input.arquivoDataUrl || undefined }
                    : {}),
                  ...(input.observacoesElaboracao !== undefined
                    ? { observacoesElaboracao: input.observacoesElaboracao }
                    : {}),
                  ...(replacingFile ? { arquivoAtualizadoEm: now } : {}),
                  ...(removingFile ? { arquivoAtualizadoEm: undefined } : {}),
                }
              : v
          ),
        }));
      },

      updateConsenso: (documentId, input) => {
        const now = new Date().toISOString();
        const doc = get().getDocumentById(documentId);
        if (!doc) return;

        const removingFile =
          input.arquivoNome === "" || input.arquivoDataUrl === "";
        const replacingFile =
          !removingFile &&
          Boolean(input.arquivoNome && input.arquivoDataUrl);

        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === documentId ? { ...d, updatedAt: now } : d
          ),
          versions: state.versions.map((v) =>
            v.documentId === documentId && v.versao === doc.versaoAtual
              ? {
                  ...v,
                  ...(input.observacoesConsenso !== undefined
                    ? { observacoesConsenso: input.observacoesConsenso }
                    : {}),
                  ...(input.arquivoNome !== undefined
                    ? { arquivoNome: input.arquivoNome || undefined }
                    : {}),
                  ...(input.arquivoDataUrl !== undefined
                    ? { arquivoDataUrl: input.arquivoDataUrl || undefined }
                    : {}),
                  ...(replacingFile
                    ? {
                        arquivoAtualizadoEm: now,
                        requerSubstituicaoConsenso: false,
                      }
                    : {}),
                  ...(removingFile
                    ? {
                        arquivoAtualizadoEm: undefined,
                        requerSubstituicaoConsenso: true,
                      }
                    : {}),
                }
              : v
          ),
        }));
      },

      completeTask: (taskId) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, status: "concluida" as const } : t
          ),
        }));
      },

      inativarDocumento: (documentId) => {
        const doc = get().getDocumentById(documentId);
        if (!doc || doc.status !== "vigente") return false;

        const now = new Date().toISOString();
        set((state) => ({
          documents: state.documents.map((d) =>
            d.id === documentId
              ? { ...d, status: "obsoleto" as DocumentStatus, updatedAt: now }
              : d
          ),
        }));
        return true;
      },

      excluirDocumento: (documentId) => {
        const doc = get().getDocumentById(documentId);
        if (!doc) return false;

        set((state) => ({
          documents: state.documents.filter((d) => d.id !== documentId),
          versions: state.versions.filter((v) => v.documentId !== documentId),
          tasks: state.tasks.filter((t) => t.referenciaId !== documentId),
          validadeAlertas: state.validadeAlertas.filter(
            (a) => a.documentId !== documentId
          ),
          revalidacoes: state.revalidacoes.filter(
            (r) => r.documentId !== documentId
          ),
        }));
        return true;
      },

      syncValidadeAlertas: () => {
        set((state) => {
          const synced = applyValidadeSync(
            state.documents,
            state.versions,
            state.validadeAlertas,
            state.tasks
          );
          return {
            validadeAlertas: synced.alertas,
            tasks: synced.tasks,
          };
        });
      },

      getValidadeAlertasNaoLidos: () =>
        get().validadeAlertas.filter((alerta) => !alerta.lida),

      getRevalidacoesByDocumentId: (documentId) =>
        get()
          .revalidacoes.filter((r) => r.documentId === documentId)
          .sort((a, b) => b.data.localeCompare(a.data)),

      marcarAlertaValidadeLido: (alertaId) => {
        set((state) => ({
          validadeAlertas: state.validadeAlertas.map((alerta) =>
            alerta.id === alertaId ? { ...alerta, lida: true } : alerta
          ),
        }));
      },

      revalidarDocumento: (documentId, input) => {
        const doc = get().getDocumentById(documentId);
        if (
          !doc ||
          doc.status !== "vigente" ||
          !doc.validade?.ativa ||
          !documentoExigeRevalidacao(doc) ||
          !input.observacoes.trim()
        ) {
          return false;
        }

        const now = new Date().toISOString();
        const revalidacao: DocumentRevalidacao = {
          id: generateId("reval"),
          documentId,
          data: now,
          observacoes: input.observacoes.trim(),
          evidenciaNome: input.evidenciaNome,
          evidenciaDataUrl: input.evidenciaDataUrl,
          novaDataValidade: input.novaDataValidade,
          usuarioId: getQualidadeCurrentUserId(),
        };

        set((state) => {
          const documents = state.documents.map((d) =>
            d.id === documentId
              ? {
                  ...d,
                  validade: {
                    ...d.validade!,
                    dataValidade: input.novaDataValidade,
                  },
                  updatedAt: now,
                }
              : d
          );
          const tasks = state.tasks.map((task) =>
            task.referenciaId === documentId &&
            task.tipo === "revalidar_documento" &&
            task.status === "pendente"
              ? { ...task, status: "concluida" as const }
              : task
          );
          const validadeAlertas = state.validadeAlertas.map((alerta) =>
            alerta.documentId === documentId
              ? { ...alerta, lida: true }
              : alerta
          );
          const synced = applyValidadeSync(
            documents,
            state.versions,
            validadeAlertas,
            tasks
          );
          return {
            documents,
            revalidacoes: [...state.revalidacoes, revalidacao],
            tasks: synced.tasks,
            validadeAlertas: synced.alertas,
          };
        });
        return true;
      },
}));
