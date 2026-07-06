import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  calcularMediaNotas,
  type CriterioId,
} from "@qualidade/lib/avaliacao-fornecedor/criterios";
import { validarSalvarAvaliacao } from "@qualidade/lib/avaliacao-fornecedor/validacao";
import { mesclarHistoricoImportado } from "@qualidade/lib/avaliacao-fornecedor/mesclar-historico";
import type {
  AvaliacaoFornecedor,
  SalvarAvaliacaoInput,
} from "@qualidade/types/avaliacao-fornecedor";
import { getDataAvaliacao } from "@qualidade/types/avaliacao-fornecedor";

interface AvaliacaoFornecedorState {
  avaliacoes: AvaliacaoFornecedor[];
  salvarAvaliacao: (input: SalvarAvaliacaoInput) => boolean;
  mesclarHistoricoErp: () => void;
  getAvaliacoesPorFornecedor: (fornecedorId: string) => AvaliacaoFornecedor[];
  getUltimaAvaliacao: (fornecedorId: string) => AvaliacaoFornecedor | undefined;
  getTodasAvaliacoes: () => AvaliacaoFornecedor[];
}

function generateId(): string {
  return `av-for-${Date.now()}`;
}

function compararPorData(a: AvaliacaoFornecedor, b: AvaliacaoFornecedor): number {
  return getDataAvaliacao(b).localeCompare(getDataAvaliacao(a));
}

export const useAvaliacaoFornecedorStore = create<AvaliacaoFornecedorState>()(
  persist(
    (set, get) => ({
      avaliacoes: [],

      salvarAvaliacao: (input) => {
        if (validarSalvarAvaliacao(input)) return false;

        const avaliacao: AvaliacaoFornecedor = {
          id: generateId(),
          fornecedorId: input.fornecedorId,
          fornecedorNome: input.fornecedorNome,
          avaliadorId: input.avaliadorId,
          dataReferencia: input.dataReferencia,
          dataAvaliacao: input.dataAvaliacao,
          numeroDocumento: input.numeroDocumento.trim(),
          fornecedorAprovado: input.fornecedorAprovado,
          rncNumero: input.rncNumero?.trim() || undefined,
          notas: input.notas as Record<CriterioId, number>,
          media: calcularMediaNotas(input.notas),
          observacoes: input.observacoes?.trim() || undefined,
        };

        set((state) => ({
          avaliacoes: [avaliacao, ...state.avaliacoes],
        }));
        return true;
      },

      mesclarHistoricoErp: () => {
        set((state) => ({
          avaliacoes: mesclarHistoricoImportado(state.avaliacoes),
        }));
      },

      getAvaliacoesPorFornecedor: (fornecedorId) =>
        get()
          .avaliacoes.filter((a) => a.fornecedorId === fornecedorId)
          .sort(compararPorData),

      getUltimaAvaliacao: (fornecedorId) =>
        get().getAvaliacoesPorFornecedor(fornecedorId)[0],

      getTodasAvaliacoes: () =>
        [...get().avaliacoes].sort(compararPorData),
    }),
    { name: "sgq-avaliacao-fornecedor", skipHydration: true }
  )
);
