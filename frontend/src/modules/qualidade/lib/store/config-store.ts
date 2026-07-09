import { create } from 'zustand';
import { persistConfigToServer } from '@qualidade/lib/qualidadeConfigSync';
import type { Department, DocumentType, User } from '@qualidade/types/user';

interface ConfigState {
  currentUserId: string;
  users: User[];
  departments: Department[];
  documentTypes: DocumentType[];
  getCurrentUser: () => User | undefined;
  addDepartment: (nome: string, sigla: string) => boolean;
  updateDepartment: (id: string, nome: string, sigla: string) => boolean;
  removeDepartment: (id: string) => void;
  addDocumentType: (nome: string, sigla: string) => boolean;
  updateDocumentType: (id: string, nome: string, sigla: string) => boolean;
  removeDocumentType: (id: string) => void;
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

  getCurrentUser: () => get().users.find((u) => u.id === get().currentUserId),

  addDepartment: (nome, sigla) => {
    const siglaNorm = sigla.trim().toUpperCase();
    const nomeNorm = nome.trim();
    if (!nomeNorm || !siglaNorm) return false;

    const exists = get().departments.some((d) => d.sigla.toUpperCase() === siglaNorm);
    if (exists) return false;

    set((state) => ({
      departments: [
        ...state.departments,
        { id: generateId('dep'), nome: nomeNorm, sigla: siglaNorm },
      ],
    }));
    syncConfigAfterMutation();
    return true;
  },

  updateDepartment: (id, nome, sigla) => {
    const siglaNorm = sigla.trim().toUpperCase();
    const nomeNorm = nome.trim();
    if (!nomeNorm || !siglaNorm) return false;

    const duplicate = get().departments.some(
      (d) => d.id !== id && d.sigla.toUpperCase() === siglaNorm
    );
    if (duplicate) return false;

    set((state) => ({
      departments: state.departments.map((d) =>
        d.id === id ? { ...d, nome: nomeNorm, sigla: siglaNorm } : d
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
}));
