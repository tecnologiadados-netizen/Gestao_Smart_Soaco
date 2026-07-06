import { create } from "zustand";
import { persist } from "zustand/middleware";
import { mesclarHistoricoNomus } from "@qualidade/lib/registros/mesclar-historico";
import { inferirStatusRcc } from "@qualidade/lib/registros/validacao-rcc";
import { inferirStatusRnc } from "@qualidade/lib/registros/validacao-rnc";
import type {
  AtualizarRegistroRncInput,
  CriarRegistroInput,
  Registro,
  RegistroTipo,
} from "@qualidade/types/registro";
import type { RccDados } from "@qualidade/types/rcc";
import type { RncDados } from "@qualidade/types/rnc";

interface RegistrosState {
  registros: Registro[];
  criarRegistro: (input: CriarRegistroInput) => string;
  atualizarRegistroRnc: (input: AtualizarRegistroRncInput) => boolean;
  getRegistroById: (id: string) => Registro | undefined;
  getRegistrosPorTipo: (tipo: RegistroTipo) => Registro[];
  mesclarHistoricoNomus: () => void;
}

function generateId(): string {
  return `reg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function gerarNumeroSgq(tipo: RegistroTipo, registros: Registro[]): string {
  const sequencia =
    registros.filter(
      (registro) => registro.tipo === tipo && !registro.origemNomus
    ).length + 1;
  return `${tipo.toUpperCase()}-${String(sequencia).padStart(4, "0")}`;
}

function montarRncParaSalvar(
  rnc: RncDados,
  codigoDocumento: string
): RncDados {
  return { ...rnc, codigoDocumento };
}

function montarRccParaSalvar(
  rcc: RccDados,
  codigoDocumento: string
): RccDados {
  return { ...rcc, codigoDocumento };
}

export const useRegistrosStore = create<RegistrosState>()(
  persist(
    (set, get) => ({
      registros: [],

      criarRegistro: (input) => {
        const agora = new Date().toISOString();
        const id = generateId();
        const numero = gerarNumeroSgq(input.tipo, get().registros);

        if (input.tipo === "rnc") {
          const status = input.status ?? inferirStatusRnc(input.rnc);
          const registro: Registro = {
            id,
            tipo: "rnc",
            numero,
            codigoDocumento: numero,
            origemNomus: false,
            status,
            responsavelId: input.responsavelId,
            rnc: montarRncParaSalvar(input.rnc, numero),
            createdAt: input.rnc.dataOcorrencia || agora,
            updatedAt: agora,
          };

          set((state) => ({
            registros: [registro, ...state.registros],
          }));
          return id;
        }

        const status = input.status ?? inferirStatusRcc(input.rcc);
        const registro: Registro = {
          id,
          tipo: "rcc",
          numero,
          codigoDocumento: numero,
          origemNomus: false,
          status,
          responsavelId: input.responsavelId,
          rcc: montarRccParaSalvar(input.rcc, numero),
          createdAt: input.rcc.dataRegistroReclamacao || agora,
          updatedAt: agora,
        };

        set((state) => ({
          registros: [registro, ...state.registros],
        }));

        return id;
      },

      atualizarRegistroRnc: (input) => {
        const atual = get().registros.find((r) => r.id === input.id);
        if (!atual || atual.tipo !== "rnc" || atual.origemNomus) {
          return false;
        }

        const agora = new Date().toISOString();
        const status = input.status ?? inferirStatusRnc(input.rnc);

        set((state) => ({
          registros: state.registros.map((registro) =>
            registro.id === input.id
              ? {
                  ...registro,
                  status,
                  rnc: montarRncParaSalvar(
                    input.rnc,
                    registro.codigoDocumento
                  ),
                  updatedAt: agora,
                }
              : registro
          ),
        }));

        return true;
      },

      getRegistroById: (id) =>
        get().registros.find((registro) => registro.id === id),

      getRegistrosPorTipo: (tipo) =>
        get()
          .registros.filter((registro) => registro.tipo === tipo)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

      mesclarHistoricoNomus: () => {
        set((state) => ({
          registros: mesclarHistoricoNomus(state.registros),
        }));
      },
    }),
    { name: "sgq-registros", skipHydration: true }
  )
);
