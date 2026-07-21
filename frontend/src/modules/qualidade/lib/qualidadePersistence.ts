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
  RCC_RECLAMACOES_OPCOES_STORAGE_KEY,
  RCC_SERVICOS_OPCOES_STORAGE_KEY,
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
let registrosHydrating = false;

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

function syncDocumentsStateNow(): Promise<void> {
  const { documents, versions, tasks, validadeAlertas, revalidacoes } = useDocumentsStore.getState();
  return syncQualidadeDocuments({
    documents,
    versions,
    tasks,
    validadeAlertas,
    revalidacoes,
  }).then(() => undefined);
}

/** Persiste documentos no servidor imediatamente (ex.: após exclusão). */
export function flushQualidadeDocumentsSync(): Promise<void> {
  cancelQualidadeDocumentsDebounce();
  return syncDocumentsStateNow().catch((err) => {
    console.error('[qualidade-sync] documents flush:', err);
    throw err;
  });
}

function flushPendingSyncs() {
  cancelQualidadeDocumentsDebounce();
  void syncDocumentsStateNow().catch((err) =>
    console.error('[qualidade-sync] pagehide documents:', err)
  );
  cancelQualidadeRegistrosDebounce();
  void syncRegistrosStateNow().catch((err) =>
    console.error('[qualidade-sync] pagehide registros:', err)
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
    const rec = localStorage.getItem(RCC_RECLAMACOES_OPCOES_STORAGE_KEY);
    if (rec) opcoes['rcc-reclamacoes'] = JSON.parse(rec) as string[];
    const serv = localStorage.getItem(RCC_SERVICOS_OPCOES_STORAGE_KEY);
    if (serv) opcoes['rcc-servicos'] = JSON.parse(serv) as string[];
    if (Object.keys(opcoes).length) await syncQualidadeOpcoesLista(opcoes);
  } catch {
    /* ignore */
  }

  for (const k of LS_KEYS) localStorage.removeItem(k);
  localStorage.removeItem(RCC_RECLAMACOES_OPCOES_STORAGE_KEY);
  localStorage.removeItem(RCC_SERVICOS_OPCOES_STORAGE_KEY);

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

  useCalibrationsStore.setState({
    equipment: data.equipment as never[],
    calibrationRecords: data.calibrationRecords as never[],
    verificationRecords: data.verificationRecords as never[],
    tasks: calTasks as never[],
  });

  useAvaliacaoFornecedorStore.setState({ avaliacoes: data.avaliacoes as never[] });

  if (data.opcoesLista['rcc-reclamacoes']) {
    localStorage.setItem(
      RCC_RECLAMACOES_OPCOES_STORAGE_KEY,
      JSON.stringify(data.opcoesLista['rcc-reclamacoes'])
    );
  }
  if (data.opcoesLista['rcc-servicos']) {
    localStorage.setItem(
      RCC_SERVICOS_OPCOES_STORAGE_KEY,
      JSON.stringify(data.opcoesLista['rcc-servicos'])
    );
  }

  useDocumentsStore.getState().syncValidadeAlertas();
  } finally {
    setQualidadeConfigHydrating(false);
    setQualidadeDocumentsHydrating(false);
  }

  // Reconciliação pode recriar pendências perdidas — persiste após liberar o hydrate.
  void flushQualidadeDocumentsSync().catch((err) =>
    console.error('[qualidade] falha ao persistir tarefas reconciliadas:', err)
  );
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
      debounceSync('documents', () =>
        syncQualidadeDocuments({
          documents: state.documents,
          versions: state.versions,
          tasks: state.tasks,
          validadeAlertas: state.validadeAlertas,
          revalidacoes: state.revalidacoes,
        })
      );
    }
  });

  useRegistrosStore.subscribe((state, prev) => {
    if (registrosHydrating) return;
    if (state.registros !== prev.registros) {
      debounceSync('registros', () => syncQualidadeRegistros(state.registros));
    }
  });

  useCalibrationsStore.subscribe((state, prev) => {
    if (
      state.equipment !== prev.equipment ||
      state.calibrationRecords !== prev.calibrationRecords ||
      state.verificationRecords !== prev.verificationRecords ||
      state.tasks !== prev.tasks
    ) {
      debounceSync('calibrations', () =>
        syncQualidadeCalibrations({
          equipment: state.equipment,
          calibrationRecords: state.calibrationRecords,
          verificationRecords: state.verificationRecords,
          tasks: state.tasks,
        })
      );
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
      const rec = localStorage.getItem(RCC_RECLAMACOES_OPCOES_STORAGE_KEY);
      if (rec) opcoes['rcc-reclamacoes'] = JSON.parse(rec) as string[];
      const serv = localStorage.getItem(RCC_SERVICOS_OPCOES_STORAGE_KEY);
      if (serv) opcoes['rcc-servicos'] = JSON.parse(serv) as string[];
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
