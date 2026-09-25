import {
  deleteQualidadeRegistro,
  fetchQualidadeBootstrap,
  fetchQualidadeResponsaveis,
  importQualidadeRegistros,
  syncQualidadeAvaliacoes,
  syncQualidadeCalibrations,
  syncQualidadeConfig,
  syncQualidadeDocuments,
  syncQualidadeOpcoesLista,
  syncQualidadeRegistro,
  syncQualidadeRegistros,
} from '@qualidade/lib/api/qualidadeApi';
import type { Registro } from '@qualidade/types/registro';
import type {
  CalibrationRecord,
  Equipment,
  EquipmentAnexo,
} from '@qualidade/types/calibration';
import { useAvaliacaoFornecedorStore } from '@qualidade/lib/store/avaliacao-fornecedor-store';
import { useCalibrationsStore } from '@qualidade/lib/store/calibrations-store';
import { useConfigStore } from '@qualidade/lib/store/config-store';
import { useDocumentsStore } from '@qualidade/lib/store/documents-store';
import { useRegistrosStore } from '@qualidade/lib/store/registros-store';
import { isRegistroHistoricoNomusExcluido } from '@qualidade/lib/registros/constants';
import {
  persistConfigToServer as flushConfigToServer,
  isQualidadeConfigHydrating,
  setQualidadeConfigHydrating,
} from '@qualidade/lib/qualidadeConfigSync';
import {
  SGQ_OPCOES_LISTA_CHAVES,
} from '@qualidade/lib/registros/opcoes-lista-customizadas';
import {
  ENDERECAMENTOS_OPCOES_CHAVE,
  parseEnderecamentosFromOpcoes,
  serializeEnderecamentos,
} from '@qualidade/lib/enderecamentos-sync';

const LS_KEYS = [
  'sgq-config',
  'sgq-documents',
  'sgq-registros',
  'sgq-calibrations',
  'sgq-avaliacao-fornecedor',
] as const;

let syncTimers: Record<string, ReturnType<typeof setTimeout>> = {};
let autoSyncStarted = false;
let documentsHydrating = false;
/** Enfileira PUT /sync/documentos para não haver corrida entre anexo e avanço de etapa. */
let documentsFlushChain: Promise<void> = Promise.resolve();
/** Último flush da cadeia falhou — soft refresh não deve preferir o otimista local. */
let documentsFlushLastRejected = false;
/** Login cuja sessão já hidratou o Qualiteam (evita tela preta em remount). */
let qualidadeHydratedLogin: string | null = null;

export function isQualidadeStoreHydratedForLogin(login: string): boolean {
  return Boolean(login) && qualidadeHydratedLogin === login;
}

export function markQualidadeStoreHydrated(login: string | null): void {
  qualidadeHydratedLogin = login;
}

/** Reconsulta bootstrap sem tela preta (outras abas avançaram etapas). */
export async function softRefreshQualidadeDocuments(): Promise<void> {
  if (documentsHydrating) return;
  // Espera flush local (e o que ainda for enfileirado neste tick) terminar.
  await documentsFlushChain.catch(() => undefined);
  await new Promise<void>((resolve) => setTimeout(resolve, 80));
  await documentsFlushChain.catch(() => undefined);
  if (documentsHydrating) return;

  const localBefore = useDocumentsStore.getState();
  // Flush falhou: confiar no servidor (evita “enviei” fantasma até o F5).
  const preferLocalEtapa = !documentsFlushLastRejected;

  setQualidadeDocumentsHydrating(true);
  try {
    const data = await fetchQualidadeBootstrap();
    const docTasks = data.tasks.filter(
      (t) => (t as { referenciaTipo?: string }).referenciaTipo === 'documento'
    );

    // Não sobrescrever documento cuja etapa local é mais nova que a do servidor
    // (ex.: acabou de reprovar e o soft refresh rodou antes do flush gravar).
    const serverDocs = data.documents as Array<{
      id: string;
      statusAtualizadoEm?: string;
      updatedAt?: string;
      [key: string]: unknown;
    }>;
    const docsById = new Map(serverDocs.map((d) => [d.id, d]));
    for (const local of localBefore.documents) {
      const server = docsById.get(local.id);
      const localTs = local.statusAtualizadoEm ?? local.updatedAt ?? '';
      const serverTs = server
        ? String(server.statusAtualizadoEm ?? server.updatedAt ?? '')
        : '';
      if (preferLocalEtapa && (!server || localTs > serverTs)) {
        docsById.set(local.id, local as never);
      }
    }

    const mergedDocs = [...docsById.values()];
    const localNewerIds = new Set(
      preferLocalEtapa
        ? localBefore.documents
            .filter((local) => {
              const server = (
                data.documents as Array<{
                  id: string;
                  statusAtualizadoEm?: string;
                  updatedAt?: string;
                }>
              ).find((d) => d.id === local.id);
              const localTs = local.statusAtualizadoEm ?? local.updatedAt ?? '';
              const serverTs = server
                ? String(server.statusAtualizadoEm ?? server.updatedAt ?? '')
                : '';
              return !server || localTs > serverTs;
            })
            .map((d) => d.id)
        : []
    );

    const serverTasks = docTasks as never[];
    const localTasksKept = localBefore.tasks.filter(
      (t) =>
        t.referenciaTipo === 'documento' && localNewerIds.has(t.referenciaId)
    );
    const serverTasksFiltered = (serverTasks as Array<{ referenciaId?: string; referenciaTipo?: string }>).filter(
      (t) =>
        t.referenciaTipo !== 'documento' ||
        !localNewerIds.has(String(t.referenciaId ?? ''))
    );

    const versionsByDoc = new Map<string, unknown>();
    for (const v of data.versions as Array<{ documentId: string }>) {
      if (!localNewerIds.has(v.documentId)) versionsByDoc.set(`${v.documentId}:${(v as { versao?: string }).versao}`, v);
    }
    for (const v of localBefore.versions) {
      if (!localNewerIds.has(v.documentId)) continue;
      const key = `${v.documentId}:${v.versao}`;
      const serverVer = (data.versions as Array<{
        documentId: string;
        versao?: string;
        anexos?: Array<{
          nome?: string;
          storagePath?: string;
          ocorrenciaId?: string;
          dataUrl?: string;
        }>;
        arquivoStoragePath?: string;
        arquivoNome?: string;
      }>).find(
        (sv) =>
          sv.documentId === v.documentId &&
          String(sv.versao ?? '') === String(v.versao)
      );
      // Mantém etapa local, mas recupera storagePath dos anexos já no servidor
      // (senão Imprimir/Baixar de REGISTRO fica sem arquivo após o flush).
      if (serverVer?.anexos?.length) {
        const localAnexos = v.anexos ?? [];
        const mergedAnexos =
          localAnexos.length > 0
            ? localAnexos.map((la, idx) => {
                if (la.storagePath?.trim()) return la;
                const byId = la.ocorrenciaId
                  ? serverVer.anexos!.find(
                      (sa) => sa.ocorrenciaId === la.ocorrenciaId
                    )
                  : undefined;
                const byNome = serverVer.anexos!.find(
                  (sa) => sa.nome === la.nome && sa.storagePath
                );
                const byIdx = serverVer.anexos![idx];
                const path =
                  byId?.storagePath ||
                  byNome?.storagePath ||
                  byIdx?.storagePath ||
                  undefined;
                if (!path) return la;
                return {
                  ...la,
                  dataUrl: la.dataUrl?.startsWith('data:') ? la.dataUrl : '',
                  storagePath: path,
                  ...(byId?.ocorrenciaId || la.ocorrenciaId
                    ? {
                        ocorrenciaId:
                          la.ocorrenciaId || byId?.ocorrenciaId,
                      }
                    : {}),
                };
              })
            : serverVer.anexos.map((sa) => ({
                nome: String(sa.nome ?? ''),
                dataUrl: '',
                ...(sa.storagePath ? { storagePath: sa.storagePath } : {}),
                ...(sa.ocorrenciaId ? { ocorrenciaId: sa.ocorrenciaId } : {}),
              }));
        versionsByDoc.set(key, {
          ...v,
          anexos: mergedAnexos,
          arquivoStoragePath:
            v.arquivoStoragePath || serverVer.arquivoStoragePath,
          arquivoNome: v.arquivoNome || serverVer.arquivoNome,
        });
      } else {
        versionsByDoc.set(key, v);
      }
    }

    useDocumentsStore.setState({
      documents: mergedDocs as never[],
      versions: [...versionsByDoc.values()] as never[],
      tasks: [...serverTasksFiltered, ...localTasksKept] as never[],
      validadeAlertas: data.validadeAlertas as never[],
      revalidacoes: data.revalidacoes as never[],
    });
    useDocumentsStore.getState().syncValidadeAlertas();
  } finally {
    setQualidadeDocumentsHydrating(false);
  }
}
let registrosHydrating = false;
let calibrationsHydrating = false;

/** Equipamentos/calibrações com arquivos novos ainda não confirmados no servidor. */
const pendingCalibrationFileUids = new Set<string>();

export function markQualidadeCalibrationFilesPending(...uids: string[]) {
  for (const uid of uids) {
    if (uid) pendingCalibrationFileUids.add(uid);
  }
}

function anexosForSync(
  anexos: EquipmentAnexo[] | undefined,
  includeBinary: boolean
): EquipmentAnexo[] | undefined {
  if (!anexos?.length) return undefined;
  return anexos.map((a) => {
    if (a.storagePath) {
      // Já no servidor: nunca reenviar base64 (mesmo no flush).
      return { nome: a.nome, dataUrl: '', storagePath: a.storagePath };
    }
    if (includeBinary && a.dataUrl?.startsWith('data:')) {
      return { nome: a.nome, dataUrl: a.dataUrl };
    }
    return { nome: a.nome, dataUrl: '' };
  });
}

function equipmentForSync(eq: Equipment, includeFiles: boolean) {
  const anexos = eq.laudoAnexos ?? eq.anexos;
  if (includeFiles) {
    return {
      ...eq,
      // Só envia binário do laudo se for upload novo (sem path ainda no cliente).
      // Laudos já hidratados do servidor vêm só com dataUrl — o backend deduplica por conteúdo.
      laudoAnexos: anexosForSync(anexos, true),
      anexos: anexosForSync(anexos, true),
    };
  }
  const { laudoDataUrl: _laudo, laudoAnexos: _la, anexos: _an, ...rest } = eq;
  return rest;
}

function calibrationForSync(cal: CalibrationRecord, includeFiles: boolean) {
  if (includeFiles) {
    return {
      ...cal,
      anexos: anexosForSync(cal.anexos, true),
    };
  }
  const { laudoDataUrl: _laudo, anexos: _an, ...rest } = cal;
  return rest;
}

function buildCalibrationsSyncPayload(includePendingFiles: boolean) {
  const { equipment, calibrationRecords, verificationRecords, tasks } =
    useCalibrationsStore.getState();
  const pending = includePendingFiles
    ? new Set(pendingCalibrationFileUids)
    : new Set<string>();

  return {
    equipment: equipment.map((eq) =>
      equipmentForSync(eq, pending.has(eq.id))
    ),
    calibrationRecords: calibrationRecords.map((cal) =>
      calibrationForSync(
        cal,
        pending.has(cal.id) || pending.has(cal.equipmentId)
      )
    ),
    verificationRecords,
    tasks,
  };
}

export function setQualidadeDocumentsHydrating(value: boolean) {
  documentsHydrating = value;
}

export function isQualidadeDocumentsHydrating(): boolean {
  return documentsHydrating;
}

export function cancelQualidadeDocumentsDebounce(): void {
  if (syncTimers.documents) {
    clearTimeout(syncTimers.documents);
    delete syncTimers.documents;
  }
}

export function setQualidadeRegistrosHydrating(value: boolean) {
  registrosHydrating = value;
}

export function cancelQualidadeRegistrosDebounce(): void {
  if (syncTimers.registros) {
    clearTimeout(syncTimers.registros);
    delete syncTimers.registros;
  }
}

export function setQualidadeCalibrationsHydrating(value: boolean) {
  calibrationsHydrating = value;
}

export function cancelQualidadeCalibrationsDebounce(): void {
  if (syncTimers.calibrations) {
    clearTimeout(syncTimers.calibrations);
    delete syncTimers.calibrations;
  }
}

function syncRegistrosStateNow(): Promise<void> {
  const { registros } = useRegistrosStore.getState();
  return syncQualidadeRegistros(registros).then(() => undefined);
}

/** Persiste registros no servidor imediatamente (ex.: ao sair da página). */
export function flushQualidadeRegistrosSync(): Promise<void> {
  cancelQualidadeRegistrosDebounce();
  return syncRegistrosStateNow().catch((err) => {
    console.error('[qualidade-sync] registros flush:', err);
    throw err;
  });
}

/** Persiste um registro recém-criado/alterado sem reenviar todo o histórico Nomus. */
export async function persistQualidadeRegistro(registro: Registro): Promise<void> {
  cancelQualidadeRegistrosDebounce();
  await syncQualidadeRegistro(registro);
}

/** Exclui um registro no servidor (evita reenviar todo o histórico Nomus). */
export async function excluirQualidadeRegistro(registroId: string): Promise<void> {
  cancelQualidadeRegistrosDebounce();
  await deleteQualidadeRegistro(registroId);
}

function debounceSync(key: string, fn: () => Promise<void>, ms = 800) {
  if (syncTimers[key]) clearTimeout(syncTimers[key]);
  syncTimers[key] = setTimeout(() => {
    delete syncTimers[key];
    void fn().catch((err) => console.error(`[qualidade-sync] ${key}:`, err));
  }, ms);
}

/** Documentos/versões com arquivos novos ainda não confirmados no servidor. */
const pendingDocumentFileUids = new Set<string>();

export function markQualidadeDocumentFilesPending(...uids: string[]) {
  for (const uid of uids) {
    if (uid) pendingDocumentFileUids.add(uid);
  }
}

type DocAnexoSync = {
  nome: string;
  dataUrl?: string;
  storagePath?: string;
  ocorrenciaId?: string;
};

function docAnexoForSync(
  a: DocAnexoSync,
  includeBinary: boolean
): DocAnexoSync {
  const nome = a.nome;
  const extra = a.ocorrenciaId ? { ocorrenciaId: a.ocorrenciaId } : {};
  if (a.storagePath) {
    return { nome, dataUrl: '', storagePath: a.storagePath, ...extra };
  }
  if (includeBinary && a.dataUrl?.startsWith('data:')) {
    return { nome, dataUrl: a.dataUrl, ...extra };
  }
  return { nome, dataUrl: '', ...extra };
}

function sanitizeOcorrenciasForSync(raw: unknown) {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const id = String(o.id ?? '').trim();
      const nome = String(o.nome ?? '').trim();
      const dataOcorrencia = String(o.dataOcorrencia ?? '').trim();
      if (!id || !nome || !dataOcorrencia) return null;
      const observacao =
        typeof o.observacao === 'string' ? o.observacao.trim() : '';
      const criadoEm = String(o.criadoEm ?? '').trim();
      const storagePath =
        typeof o.storagePath === 'string' &&
        o.storagePath.startsWith('/uploads/qualidade/')
          ? o.storagePath
          : undefined;
      return {
        id,
        nome,
        dataOcorrencia,
        ...(observacao ? { observacao } : {}),
        ...(criadoEm ? { criadoEm } : {}),
        ...(storagePath ? { storagePath } : {}),
      };
    })
    .filter(Boolean);
}

function sanitizeHistoricoAtualizacoesForSync(raw: unknown) {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const a = item as Record<string, unknown>;
      const nome = String(a.nome ?? '').trim();
      if (!nome) return null;
      const storagePath =
        typeof a.storagePath === 'string' &&
        a.storagePath.startsWith('/uploads/qualidade/')
          ? a.storagePath
          : undefined;
      const dataPublicacao = String(a.dataPublicacao ?? '').trim();
      return {
        nome,
        ...(storagePath ? { storagePath } : {}),
        ...(dataPublicacao ? { dataPublicacao } : {}),
      };
    })
    .filter(Boolean);
}

function sanitizeExternoRegistroForSync(
  externoRegistro: Record<string, unknown> | undefined,
  includeBinary: boolean
): Record<string, unknown> | undefined {
  if (!externoRegistro) return undefined;
  const anexosRaw = externoRegistro.anexos;
  const anexos = Array.isArray(anexosRaw)
    ? (anexosRaw as DocAnexoSync[]).map((a) => docAnexoForSync(a, false))
    : undefined;
  // Nunca embutir base64 no JSON do documento — binário só na versão.
  void includeBinary;
  const ocorrencias = sanitizeOcorrenciasForSync(externoRegistro.ocorrencias);
  const historicoAtualizacoes = sanitizeHistoricoAtualizacoesForSync(
    externoRegistro.historicoAtualizacoes
  );
  const modeloRaw = externoRegistro.modelo;
  const modelo =
    modeloRaw && typeof modeloRaw === 'object'
      ? docAnexoForSync(modeloRaw as DocAnexoSync, false)
      : undefined;
  return {
    ...externoRegistro,
    ...(anexos ? { anexos } : {}),
    ...(ocorrencias ? { ocorrencias } : {}),
    ...(historicoAtualizacoes
      ? { historicoAtualizacoes }
      : {}),
    ...(modelo?.nome ? { modelo } : { modelo: undefined }),
  };
}

function versionForSync(
  ver: {
    id: string;
    documentId: string;
    arquivoNome?: string;
    arquivoDataUrl?: string;
    anexos?: DocAnexoSync[];
    [key: string]: unknown;
  },
  includeFiles: boolean
) {
  const anexos = ver.anexos?.map((a) => docAnexoForSync(a, includeFiles));
  const hasAnexoBinary = Boolean(
    anexos?.some((a) => a.dataUrl?.startsWith('data:'))
  );
  // Evita triplicar o mesmo PDF (anexos + arquivoDataUrl + externoRegistro).
  const arquivoDataUrl =
    includeFiles && !hasAnexoBinary && ver.arquivoDataUrl?.startsWith('data:')
      ? ver.arquivoDataUrl
      : undefined;

  if (includeFiles) {
    return {
      ...ver,
      anexos,
      ...(arquivoDataUrl !== undefined
        ? { arquivoDataUrl }
        : { arquivoDataUrl: '' }),
    };
  }

  const { arquivoDataUrl: _drop, ...rest } = ver;
  return {
    ...rest,
    anexos,
    arquivoDataUrl: '',
  };
}

function documentForSync(
  doc: {
    id: string;
    externoRegistro?: Record<string, unknown>;
    [key: string]: unknown;
  },
  includeFiles: boolean
) {
  return {
    ...doc,
    externoRegistro: sanitizeExternoRegistroForSync(
      doc.externoRegistro as Record<string, unknown> | undefined,
      includeFiles
    ),
  };
}

function buildDocumentsSyncPayload(
  includePendingFiles: boolean,
  documentId?: string
) {
  const { documents, versions, tasks, validadeAlertas, revalidacoes } =
    useDocumentsStore.getState();

  const versionIdsOfDoc = documentId
    ? new Set(
        versions.filter((v) => v.documentId === documentId).map((v) => v.id)
      )
    : null;

  const pending = new Set<string>();
  if (includePendingFiles) {
    for (const uid of pendingDocumentFileUids) {
      if (
        !documentId ||
        uid === documentId ||
        versionIdsOfDoc?.has(uid)
      ) {
        pending.add(uid);
      }
    }
  }

  const docs = documentId
    ? documents.filter((d) => d.id === documentId)
    : documents;
  const vers = documentId
    ? versions.filter((v) => v.documentId === documentId)
    : versions;
  const tsks = documentId
    ? tasks.filter(
        (t) =>
          t.referenciaTipo !== 'documento' || t.referenciaId === documentId
      )
    : tasks;
  const alertas = documentId
    ? validadeAlertas.filter((a) => a.documentId === documentId)
    : validadeAlertas;
  const revals = documentId
    ? revalidacoes.filter((r) => r.documentId === documentId)
    : revalidacoes;

  return {
    documents: docs.map((d) =>
      documentForSync(d as never, pending.has(d.id))
    ),
    versions: vers.map((v) =>
      versionForSync(
        v as never,
        pending.has(v.id) || pending.has(v.documentId)
      )
    ),
    tasks: tsks,
    validadeAlertas: alertas,
    revalidacoes: revals,
  };
}

function pendingUidsForDocument(documentId?: string): string[] {
  if (!documentId) return [...pendingDocumentFileUids];
  const { versions } = useDocumentsStore.getState();
  const versionIds = new Set(
    versions.filter((v) => v.documentId === documentId).map((v) => v.id)
  );
  return [...pendingDocumentFileUids].filter(
    (uid) => uid === documentId || versionIds.has(uid)
  );
}

function syncDocumentsStateNow(
  includePendingFiles = false,
  documentId?: string
): Promise<void> {
  // Serializa flushes e monta o payload SÓ na vez de enviar — evita que um
  // sync de anexo iniciado antes do "Enviar" grave rascunho depois e feche a
  // tarefa de consenso que o e-mail já notificou.
  const run = async () => {
    const pendingSnapshot = pendingUidsForDocument(documentId);
    const withFiles =
      includePendingFiles && pendingSnapshot.length > 0;
    try {
      const payload = buildDocumentsSyncPayload(withFiles, documentId);
      await syncQualidadeDocuments(payload);
      documentsFlushLastRejected = false;
      if (withFiles) {
        for (const uid of pendingSnapshot) {
          pendingDocumentFileUids.delete(uid);
        }
        // Não limpa data: aqui se ainda não há storagePath — soft refresh
        // depois do flush (fora da cadeia) preenche os paths do servidor.
        clearSyncedDocumentBinaries(pendingSnapshot);
      }
    } catch (err) {
      documentsFlushLastRejected = true;
      throw err;
    }
  };
  const next = documentsFlushChain.then(run, run);
  documentsFlushChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

/**
 * Remove base64 já persistido; soft refresh posterior preenche storagePath.
 * Só remove dataUrl quando já há storagePath — senão imprimir/baixar quebra
 * até o próximo bootstrap (ex.: consulta de registros sem soft refresh).
 */
function clearSyncedDocumentBinaries(uids: string[]) {
  const idSet = new Set(uids.filter(Boolean));
  if (idSet.size === 0) return;
  useDocumentsStore.setState((state) => ({
    versions: state.versions.map((v) => {
      if (!idSet.has(v.id) && !idSet.has(v.documentId)) return v;
      const limparArquivo = Boolean(
        v.arquivoDataUrl?.startsWith('data:') && v.arquivoStoragePath?.trim()
      );
      const anexos = v.anexos?.map((a) => {
        if (!a.dataUrl?.startsWith('data:')) return a;
        if (!a.storagePath?.trim()) return a;
        return {
          nome: a.nome,
          dataUrl: '',
          storagePath: a.storagePath,
          ...(a.ocorrenciaId ? { ocorrenciaId: a.ocorrenciaId } : {}),
        };
      });
      if (!limparArquivo && anexos === v.anexos) return v;
      return {
        ...v,
        ...(limparArquivo ? { arquivoDataUrl: undefined } : {}),
        ...(anexos ? { anexos } : {}),
      };
    }),
  }));
}

/** Persiste documentos no servidor imediatamente (ex.: após exclusão / upload). */
export function flushQualidadeDocumentsSync(): Promise<void> {
  cancelQualidadeDocumentsDebounce();
  const hadPendingFiles = pendingDocumentFileUids.size > 0;
  // Só reenvia binário se ainda houver UID pendente — avanço de etapa fica leve.
  return syncDocumentsStateNow(hadPendingFiles)
    .then(async () => {
      if (!hadPendingFiles) return;
      // Fora da cadeia de flush: evita deadlock (softRefresh espera a chain).
      try {
        await softRefreshQualidadeDocuments();
      } catch (err) {
        console.warn('[qualidade-sync] soft refresh pós-anexo:', err);
      }
    })
    .catch((err) => {
      console.error('[qualidade-sync] documents flush:', err);
      throw err;
    });
}

/**
 * Flush só do documento da etapa (payload leve). Usar em enviar/aprovar/reprovar
 * para não reenviar a base inteira do SGQ a cada transição.
 */
export function flushQualidadeDocumentSync(documentId: string): Promise<void> {
  cancelQualidadeDocumentsDebounce();
  const pending = pendingUidsForDocument(documentId);
  const hadPendingFiles = pending.length > 0;
  return syncDocumentsStateNow(hadPendingFiles, documentId)
    .then(async () => {
      if (!hadPendingFiles) return;
      try {
        await softRefreshQualidadeDocuments();
      } catch (err) {
        console.warn('[qualidade-sync] soft refresh pós-anexo:', err);
      }
    })
    .catch((err) => {
      console.error('[qualidade-sync] document flush:', err);
      throw err;
    });
}

/** Flush em segundo plano — não segura overlay/UI. */
export function scheduleQualidadeDocumentsFlush(): void {
  void flushQualidadeDocumentsSync().catch((err) => {
    console.error('[qualidade-sync] documents schedule:', err);
  });
}

function syncCalibrationsStateNow(includePendingFiles = false): Promise<void> {
  const payload = buildCalibrationsSyncPayload(includePendingFiles);
  return syncQualidadeCalibrations(payload).then(() => {
    if (includePendingFiles) {
      pendingCalibrationFileUids.clear();
    }
  });
}

/** Persiste calibrações/equipamentos imediatamente (ex.: após registrar laudo). */
export function flushQualidadeCalibrationsSync(): Promise<void> {
  cancelQualidadeCalibrationsDebounce();
  return syncCalibrationsStateNow(true).catch((err) => {
    console.error('[qualidade-sync] calibrations flush:', err);
    throw err;
  });
}

/** Flush de calibrações em segundo plano — não segura overlay/UI. */
export function scheduleQualidadeCalibrationsFlush(): void {
  void flushQualidadeCalibrationsSync().catch((err) => {
    console.error('[qualidade-sync] calibrations schedule:', err);
  });
}

function flushPendingSyncs() {
  cancelQualidadeDocumentsDebounce();
  void syncDocumentsStateNow(pendingDocumentFileUids.size > 0).catch((err) =>
    console.error('[qualidade-sync] pagehide documents:', err)
  );
  cancelQualidadeRegistrosDebounce();
  void syncRegistrosStateNow().catch((err) =>
    console.error('[qualidade-sync] pagehide registros:', err)
  );
  cancelQualidadeCalibrationsDebounce();
  void syncCalibrationsStateNow(pendingCalibrationFileUids.size > 0).catch((err) =>
    console.error('[qualidade-sync] pagehide calibrations:', err)
  );
  const { departments, documentTypes, enderecamentos } = useConfigStore.getState();
  void flushConfigToServer({ departments, documentTypes }).catch((err) =>
    console.error('[qualidade-sync] flush config:', err)
  );
  void flushEnderecamentosToServer(enderecamentos).catch((err) =>
    console.error('[qualidade-sync] flush enderecamentos:', err)
  );
}

function readLocalStorageJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: T };
    return parsed.state ?? (parsed as T);
  } catch {
    return null;
  }
}

function isBootstrapEmpty(data: Awaited<ReturnType<typeof fetchQualidadeBootstrap>>) {
  return (
    data.documents.length === 0 &&
    data.registros.length === 0 &&
    data.equipment.length === 0 &&
    data.avaliacoes.length === 0
  );
}

async function migrateFromLocalStorageIfNeeded() {
  const bootstrap = await fetchQualidadeBootstrap();
  if (!isBootstrapEmpty(bootstrap)) return bootstrap;

  const hasLocal = LS_KEYS.some((k) => localStorage.getItem(k));
  if (!hasLocal) return bootstrap;

  const config = readLocalStorageJson<{
    departments: unknown[];
    documentTypes: unknown[];
  }>('sgq-config');
  const docs = readLocalStorageJson<{
    documents: unknown[];
    versions: unknown[];
    tasks: unknown[];
    validadeAlertas: unknown[];
    revalidacoes: unknown[];
  }>('sgq-documents');
  const registros = readLocalStorageJson<{ registros: unknown[] }>('sgq-registros');
  const cal = readLocalStorageJson<{
    equipment: unknown[];
    calibrationRecords: unknown[];
    verificationRecords: unknown[];
    tasks: unknown[];
  }>('sgq-calibrations');
  const aval = readLocalStorageJson<{ avaliacoes: unknown[] }>('sgq-avaliacao-fornecedor');

  if (config) {
    await syncQualidadeConfig({
      departments: config.departments ?? [],
      documentTypes: config.documentTypes ?? [],
    });
  }
  if (docs) {
    await syncQualidadeDocuments({
      documents: docs.documents ?? [],
      versions: docs.versions ?? [],
      tasks: docs.tasks ?? [],
      validadeAlertas: docs.validadeAlertas ?? [],
      revalidacoes: docs.revalidacoes ?? [],
    });
  }
  if (registros?.registros?.length) {
    const registrosSemNomus = (registros.registros as Registro[]).filter(
      (r) => !isRegistroHistoricoNomusExcluido(r)
    );
    if (registrosSemNomus.length) {
      await syncQualidadeRegistros(registrosSemNomus);
    }
  }
  if (cal) {
    await syncQualidadeCalibrations({
      equipment: cal.equipment ?? [],
      calibrationRecords: cal.calibrationRecords ?? [],
      verificationRecords: cal.verificationRecords ?? [],
      tasks: cal.tasks ?? [],
    });
  }
  if (aval?.avaliacoes?.length) {
    await syncQualidadeAvaliacoes(aval.avaliacoes);
  }

  const opcoes: Record<string, string[]> = {};
  try {
    for (const [chaveApi, storageKey] of Object.entries(SGQ_OPCOES_LISTA_CHAVES)) {
      const raw = localStorage.getItem(storageKey);
      if (raw) opcoes[chaveApi] = JSON.parse(raw) as string[];
    }
    if (Object.keys(opcoes).length) await syncQualidadeOpcoesLista(opcoes);
  } catch {
    /* ignore */
  }

  for (const k of LS_KEYS) localStorage.removeItem(k);
  for (const storageKey of Object.values(SGQ_OPCOES_LISTA_CHAVES)) {
    localStorage.removeItem(storageKey);
  }

  return fetchQualidadeBootstrap();
}

export async function hydrateQualidadeFromServer(currentUserLogin: string) {
  setQualidadeConfigHydrating(true);
  setQualidadeDocumentsHydrating(true);
  try {
  const data = await migrateFromLocalStorageIfNeeded();
  const users = await fetchQualidadeResponsaveis();

  useConfigStore.setState({
    currentUserId: currentUserLogin,
    users,
    departments: data.departments,
    documentTypes: data.documentTypes,
    enderecamentos: parseEnderecamentosFromOpcoes(
      data.opcoesLista[ENDERECAMENTOS_OPCOES_CHAVE]
    ),
  });

  const docTasks = data.tasks.filter(
    (t) => (t as { referenciaTipo?: string }).referenciaTipo === 'documento'
  );
  const calTasks = data.tasks.filter(
    (t) => (t as { referenciaTipo?: string }).referenciaTipo === 'equipamento'
  );

  useDocumentsStore.setState({
    documents: data.documents as never[],
    versions: data.versions as never[],
    tasks: docTasks as never[],
    validadeAlertas: data.validadeAlertas as never[],
    revalidacoes: data.revalidacoes as never[],
  });

  setQualidadeRegistrosHydrating(true);
  const registrosAtivos = (data.registros as Registro[]).filter(
    (r) => !isRegistroHistoricoNomusExcluido(r)
  );
  useRegistrosStore.setState({ registros: registrosAtivos as never[] });
  setQualidadeRegistrosHydrating(false);

  setQualidadeCalibrationsHydrating(true);
  useCalibrationsStore.setState({
    equipment: data.equipment as never[],
    calibrationRecords: data.calibrationRecords as never[],
    verificationRecords: data.verificationRecords as never[],
    tasks: calTasks as never[],
  });
  setQualidadeCalibrationsHydrating(false);

  useAvaliacaoFornecedorStore.setState({ avaliacoes: data.avaliacoes as never[] });

  for (const [chaveApi, storageKey] of Object.entries(SGQ_OPCOES_LISTA_CHAVES)) {
    const lista = data.opcoesLista[chaveApi];
    if (lista) {
      localStorage.setItem(storageKey, JSON.stringify(lista));
    }
  }

  const tasksAntes = useDocumentsStore
    .getState()
    .tasks.map((t) => `${t.id}:${t.status}:${t.tipo}`)
    .sort()
    .join('|');
  useDocumentsStore.getState().syncValidadeAlertas();
  const tasksDepois = useDocumentsStore
    .getState()
    .tasks.map((t) => `${t.id}:${t.status}:${t.tipo}`)
    .sort()
    .join('|');

  if (tasksAntes !== tasksDepois) {
    scheduleQualidadeDocumentsFlush();
  }
  } finally {
    setQualidadeConfigHydrating(false);
    setQualidadeDocumentsHydrating(false);
  }
}

export function startQualidadeAutoSync() {
  if (autoSyncStarted) return;
  autoSyncStarted = true;

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushPendingSyncs);
  }

  useConfigStore.subscribe((state, prev) => {
    if (isQualidadeConfigHydrating()) return;
    if (state.departments !== prev.departments || state.documentTypes !== prev.documentTypes) {
      debounceSync('config', () => flushConfigToServer({
        departments: state.departments,
        documentTypes: state.documentTypes,
      }), 300);
    }
    if (state.enderecamentos !== prev.enderecamentos) {
      debounceSync('enderecamentos', () => flushEnderecamentosToServer(state.enderecamentos), 300);
    }
  });

  useDocumentsStore.subscribe((state, prev) => {
    if (isQualidadeConfigHydrating() || isQualidadeDocumentsHydrating()) return;
    if (
      state.documents !== prev.documents ||
      state.versions !== prev.versions ||
      state.tasks !== prev.tasks ||
      state.validadeAlertas !== prev.validadeAlertas ||
      state.revalidacoes !== prev.revalidacoes
    ) {
      debounceSync('documents', () => syncDocumentsStateNow(false));
    }
  });

  useRegistrosStore.subscribe((state, prev) => {
    if (registrosHydrating) return;
    if (state.registros !== prev.registros) {
      debounceSync('registros', () => syncQualidadeRegistros(state.registros));
    }
  });

  useCalibrationsStore.subscribe((state, prev) => {
    if (calibrationsHydrating) return;
    if (
      state.equipment !== prev.equipment ||
      state.calibrationRecords !== prev.calibrationRecords ||
      state.verificationRecords !== prev.verificationRecords ||
      state.tasks !== prev.tasks
    ) {
      // Auto-sync sem binários — arquivos só no flush explícito (evita estourar 15MB / F5).
      debounceSync('calibrations', () => syncCalibrationsStateNow(false));
    }
  });

  useAvaliacaoFornecedorStore.subscribe((state, prev) => {
    if (state.avaliacoes !== prev.avaliacoes) {
      debounceSync('avaliacoes', () => syncQualidadeAvaliacoes(state.avaliacoes));
    }
  });
}

export { importQualidadeRegistros };

export function scheduleOpcoesListaSync() {
  debounceSync('opcoes-lista', async () => {
    const opcoes: Record<string, string[]> = {};
    try {
      for (const [chaveApi, storageKey] of Object.entries(SGQ_OPCOES_LISTA_CHAVES)) {
        const raw = localStorage.getItem(storageKey);
        if (raw) opcoes[chaveApi] = JSON.parse(raw) as string[];
      }
      await syncQualidadeOpcoesLista(opcoes);
    } catch (err) {
      console.error('[qualidade-sync] opcoes-lista:', err);
    }
  });
}

async function flushEnderecamentosToServer(
  enderecamentos: ReturnType<typeof useConfigStore.getState>['enderecamentos']
): Promise<void> {
  await syncQualidadeOpcoesLista({
    [ENDERECAMENTOS_OPCOES_CHAVE]: serializeEnderecamentos(enderecamentos),
  });
}

export function scheduleEnderecamentosSync() {
  debounceSync('enderecamentos', async () => {
    const { enderecamentos } = useConfigStore.getState();
    await flushEnderecamentosToServer(enderecamentos);
  }, 300);
}
