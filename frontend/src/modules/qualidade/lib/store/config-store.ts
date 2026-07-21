import { create } from 'zustand';
import { persistConfigToServer } from '@qualidade/lib/qualidadeConfigSync';
import type { Enderecamento } from '@qualidade/types/enderecamento';
import type { Department, DocumentType, User } from '@qualidade/types/user';

interface ConfigState {
  currentUserId: string;
  users: User[];
  departments: Department[];
  documentTypes: DocumentType[];
  enderecamentos: Enderecamento[];
  getCurrentUser: () => User | undefined;
  addDepartment: (nome: string) => boolean;
  updateDepartment: (id: string, nome: string) => boolean;
  removeDepartment: (id: string) => void;
  addDocumentType: (nome: string, sigla: string) => boolean;
  updateDocumentType: (id: string, nome: string, sigla: string) => boolean;
  removeDocumentType: (id: string) => void;
  addEnderecamento: (setorId: string, endereco: string) => boolean;
  updateEnderecamento: (id: string, setorId: string, endereco: string) => boolean;
  removeEnderecamento: (id: string) => void;
}

function normalizarEndereco(endereco: string): string {
  return endereco.trim().toLowerCase();
}

function enderecamentoDuplicado(
  enderecamentos: Enderecamento[],
  setorId: string,
  endereco: string,
  ignoreId?: string
): boolean {
  const alvo = normalizarEndereco(endereco);
  return enderecamentos.some(
    (e) =>
      e.id !== ignoreId &&
      e.setorId === setorId &&
      normalizarEndereco(e.endereco) === alvo
  );
}

function syncEnderecamentosAfterMutation() {
  void import('@qualidade/lib/qualidadePersistence').then(({ scheduleEnderecamentosSync }) =>
    scheduleEnderecamentosSync()
  );
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

function syncConfigAfterMutation() {
  const { departments, documentTypes } = useConfigStore.getState();
  void persistConfigToServer({ departments, documentTypes }).catch((err) =>
    console.error('[qualidade] falha ao salvar configurações:', err)
  );
}

export const useConfigStore = create<ConfigState>()((set, get) => ({
  currentUserId: '',
  users: [],
  departments: [],
  documentTypes: [],
  enderecamentos: [],

  getCurrentUser: () => get().users.find((u) => u.id === get().currentUserId),

  addDepartment: (nome) => {
    const nomeNorm = nome.trim();
    if (!nomeNorm) return false;

    const exists = get().departments.some(
      (d) => d.nome.toLocaleLowerCase('pt-BR') === nomeNorm.toLocaleLowerCase('pt-BR')
    );
    if (exists) return false;

    set((state) => ({
      departments: [
        ...state.departments,
        { id: generateId('dep'), nome: nomeNorm },
      ],
    }));
    syncConfigAfterMutation();
    return true;
  },

  updateDepartment: (id, nome) => {
    const nomeNorm = nome.trim();
    if (!nomeNorm) return false;

    const duplicate = get().departments.some(
      (d) =>
        d.id !== id &&
        d.nome.toLocaleLowerCase('pt-BR') === nomeNorm.toLocaleLowerCase('pt-BR')
    );
    if (duplicate) return false;

    set((state) => ({
      departments: state.departments.map((d) =>
        d.id === id ? { ...d, nome: nomeNorm } : d
      ),
    }));
    syncConfigAfterMutation();
    return true;
  },

  removeDepartment: (id) => {
    set((state) => ({
      departments: state.departments.filter((d) => d.id !== id),
    }));
    syncConfigAfterMutation();
  },

  addDocumentType: (nome, sigla) => {
    const siglaNorm = sigla.trim().toUpperCase();
    const nomeNorm = nome.trim();
    if (!nomeNorm || !siglaNorm) return false;

    const exists = get().documentTypes.some((t) => t.sigla.toUpperCase() === siglaNorm);
    if (exists) return false;

    set((state) => ({
      documentTypes: [
        ...state.documentTypes,
        { id: generateId('tipo'), nome: nomeNorm, sigla: siglaNorm },
      ],
    }));
    syncConfigAfterMutation();
    return true;
  },

  updateDocumentType: (id, nome, sigla) => {
    const siglaNorm = sigla.trim().toUpperCase();
    const nomeNorm = nome.trim();
    if (!nomeNorm || !siglaNorm) return false;

    const duplicate = get().documentTypes.some(
      (t) => t.id !== id && t.sigla.toUpperCase() === siglaNorm
    );
    if (duplicate) return false;

    set((state) => ({
      documentTypes: state.documentTypes.map((t) =>
        t.id === id ? { ...t, nome: nomeNorm, sigla: siglaNorm } : t
      ),
    }));
    syncConfigAfterMutation();
    return true;
  },

  removeDocumentType: (id) => {
    set((state) => ({
      documentTypes: state.documentTypes.filter((t) => t.id !== id),
    }));
    syncConfigAfterMutation();
  },

  addEnderecamento: (setorId, endereco) => {
    const enderecoNorm = endereco.trim();
    if (!setorId || !enderecoNorm) return false;
    if (!get().departments.some((d) => d.id === setorId)) return false;
    if (enderecamentoDuplicado(get().enderecamentos, setorId, enderecoNorm)) return false;

    set((state) => ({
      enderecamentos: [
        ...state.enderecamentos,
        { id: generateId('end'), setorId, endereco: enderecoNorm },
      ],
    }));
    syncEnderecamentosAfterMutation();
    return true;
  },

  updateEnderecamento: (id, setorId, endereco) => {
    const enderecoNorm = endereco.trim();
    if (!setorId || !enderecoNorm) return false;
    if (!get().departments.some((d) => d.id === setorId)) return false;
    if (enderecamentoDuplicado(get().enderecamentos, setorId, enderecoNorm, id)) return false;

    set((state) => ({
      enderecamentos: state.enderecamentos.map((e) =>
        e.id === id ? { ...e, setorId, endereco: enderecoNorm } : e
      ),
    }));
    syncEnderecamentosAfterMutation();
    return true;
  },

  removeEnderecamento: (id) => {
    set((state) => ({
      enderecamentos: state.enderecamentos.filter((e) => e.id !== id),
    }));
    syncEnderecamentosAfterMutation();
  },
}));
