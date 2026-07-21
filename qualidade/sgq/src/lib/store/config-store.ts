"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Department, DocumentType, User } from "@/types/user";
import {
  CURRENT_USER_ID,
  departments as initialDepartments,
  documentTypes as initialDocumentTypes,
  users as initialUsers,
} from "@/lib/mock-data/users";

interface ConfigState {
  currentUserId: string;
  users: User[];
  departments: Department[];
  documentTypes: DocumentType[];
  setCurrentUserId: (id: string) => void;
  getCurrentUser: () => User | undefined;
  addDepartment: (nome: string) => boolean;
  updateDepartment: (id: string, nome: string) => boolean;
  removeDepartment: (id: string) => void;
  addDocumentType: (nome: string, sigla: string) => boolean;
  updateDocumentType: (id: string, nome: string, sigla: string) => boolean;
  removeDocumentType: (id: string) => void;
  addUser: (user: Omit<User, "id">) => void;
  updateUser: (id: string, data: Partial<User>) => void;
  removeUser: (id: string) => boolean;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      currentUserId: CURRENT_USER_ID,
      users: initialUsers,
      departments: initialDepartments,
      documentTypes: initialDocumentTypes,

      setCurrentUserId: (id) => set({ currentUserId: id }),

      getCurrentUser: () =>
        get().users.find((u) => u.id === get().currentUserId),

      addDepartment: (nome) => {
        const nomeNorm = nome.trim();
        if (!nomeNorm) return false;

        const exists = get().departments.some(
          (d) =>
            d.nome.toLocaleLowerCase("pt-BR") ===
            nomeNorm.toLocaleLowerCase("pt-BR")
        );
        if (exists) return false;

        set((state) => ({
          departments: [
            ...state.departments,
            { id: generateId("dep"), nome: nomeNorm },
          ],
        }));
        return true;
      },

      updateDepartment: (id, nome) => {
        const nomeNorm = nome.trim();
        if (!nomeNorm) return false;

        const duplicate = get().departments.some(
          (d) =>
            d.id !== id &&
            d.nome.toLocaleLowerCase("pt-BR") ===
              nomeNorm.toLocaleLowerCase("pt-BR")
        );
        if (duplicate) return false;

        set((state) => ({
          departments: state.departments.map((d) =>
            d.id === id ? { ...d, nome: nomeNorm } : d
          ),
        }));
        return true;
      },

      removeDepartment: (id) => {
        set((state) => ({
          departments: state.departments.filter((d) => d.id !== id),
        }));
      },

      addDocumentType: (nome, sigla) => {
        const siglaNorm = sigla.trim().toUpperCase();
        const nomeNorm = nome.trim();
        if (!nomeNorm || !siglaNorm) return false;

        const exists = get().documentTypes.some(
          (t) => t.sigla.toUpperCase() === siglaNorm
        );
        if (exists) return false;

        set((state) => ({
          documentTypes: [
            ...state.documentTypes,
            { id: generateId("tipo"), nome: nomeNorm, sigla: siglaNorm },
          ],
        }));
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
        return true;
      },

      removeDocumentType: (id) => {
        set((state) => ({
          documentTypes: state.documentTypes.filter((t) => t.id !== id),
        }));
      },

      addUser: (user) => {
        set((state) => ({
          users: [...state.users, { ...user, id: generateId("user") }],
        }));
      },

      updateUser: (id, data) => {
        set((state) => ({
          users: state.users.map((u) =>
            u.id === id ? { ...u, ...data } : u
          ),
        }));
      },

      removeUser: (id) => {
        if (id === get().currentUserId) return false;
        set((state) => ({
          users: state.users.filter((u) => u.id !== id),
        }));
        return true;
      },
    }),
    { name: "sgq-config", skipHydration: true }
  )
);
