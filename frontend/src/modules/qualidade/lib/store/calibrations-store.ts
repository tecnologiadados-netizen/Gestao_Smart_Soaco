import { create } from "zustand";
import type {
  CalibrationRecord,
  Equipment,
  EquipmentWithDue,
  VerificationRecord,
} from "@qualidade/types/calibration";
import type { Task } from "@qualidade/types/task";
import {
  calcularDueStatus,
  calcularProximaData,
} from "@qualidade/lib/utils/dates";
import { getQualidadeCurrentUserId } from "@qualidade/lib/current-user";
import {
  getNextRevision,
  INITIAL_REVISION,
} from "@qualidade/lib/documents/revision";

function calibrationTipoFromEquipment(
  tipo: Equipment["tipoCalibracao"]
): "interna" | "externa" {
  return tipo === "externa" ? "externa" : "interna";
}

interface CreateEquipmentInput {
  codigo: string;
  descricao: string;
  local: string;
  setorId?: string;
  responsavelId?: string;
  fornecedor?: string;
  tipoCalibracao: Equipment["tipoCalibracao"];
  frequenciaCalibracaoDias: number;
  frequenciaVerificacaoDias?: number;
  ultimaCalibracao?: string;
  ultimaVerificacao?: string;
  laudoNome?: string;
  laudoDataUrl?: string;
  anexos?: { nome: string; dataUrl: string; storagePath?: string }[];
}

interface UpdateEquipmentInput {
  descricao: string;
  local: string;
  setorId: string;
  responsavelId: string;
  fornecedor?: string;
  tipoCalibracao: Equipment["tipoCalibracao"];
  frequenciaCalibracaoDias: number;
  frequenciaVerificacaoDias: number;
  ultimaCalibracao?: string;
  ultimaVerificacao?: string;
  laudoNome?: string;
  laudoDataUrl?: string;
  anexos?: { nome: string; dataUrl: string; storagePath?: string }[];
  ativo: boolean;
}

interface RegisterCalibrationInput {
  data: string;
  proximaCalibracao: string;
  responsavelId: string;
  laudoNome: string;
  laudoDataUrl: string;
  anexos?: { nome: string; dataUrl: string; storagePath?: string }[];
}

interface CalibrationsState {
  equipment: Equipment[];
  calibrationRecords: CalibrationRecord[];
  verificationRecords: VerificationRecord[];
  tasks: Task[];
  getEquipmentWithDue: () => EquipmentWithDue[];
  getAllEquipmentWithDue: () => EquipmentWithDue[];
  getEquipmentById: (id: string) => Equipment | undefined;
  getPendingVerifications: () => EquipmentWithDue[];
  getPendingCalibrations: (tipo: "interna" | "externa") => EquipmentWithDue[];
  createEquipment: (input: CreateEquipmentInput) => string;
  updateEquipment: (id: string, input: UpdateEquipmentInput) => void;
  setEquipmentAtivo: (id: string, ativo: boolean) => void;
  removeEquipment: (id: string) => void;
  registerCalibration: (
    equipmentId: string,
    record: RegisterCalibrationInput
  ) => void;
  registerVerification: (
    equipmentId: string,
    record: Omit<VerificationRecord, "id" | "equipmentId">
  ) => void;
  getCalibrationRecords: (equipmentId: string) => CalibrationRecord[];
  getVerificationRecords: (equipmentId: string) => VerificationRecord[];
}

function enrichEquipment(eq: Equipment): EquipmentWithDue {
  const proximaCalibracao =
    eq.proximaCalibracao ??
    calcularProximaData(eq.ultimaCalibracao, eq.frequenciaCalibracaoDias);
  const proximaVerificacao = calcularProximaData(
    eq.ultimaVerificacao,
    eq.frequenciaVerificacaoDias
  );

  return {
    ...eq,
    proximaCalibracao,
    proximaVerificacao,
    statusCalibracao: calcularDueStatus(proximaCalibracao),
    statusVerificacao: calcularDueStatus(proximaVerificacao),
  };
}

function isDue(status: EquipmentWithDue["statusCalibracao"]): boolean {
  return status === "vencido" || status === "proximo";
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

export const useCalibrationsStore = create<CalibrationsState>()((set, get) => ({
      equipment: [],
      calibrationRecords: [],
      verificationRecords: [],
      tasks: [],

      getEquipmentWithDue: () =>
        get()
          .equipment.filter((e) => e.ativo)
          .map(enrichEquipment),

      getAllEquipmentWithDue: () => get().equipment.map(enrichEquipment),

      getEquipmentById: (id) => get().equipment.find((e) => e.id === id),

      getPendingVerifications: () =>
        get()
          .getEquipmentWithDue()
          .filter((e) => isDue(e.statusVerificacao)),

      getPendingCalibrations: (tipo) =>
        get()
          .getEquipmentWithDue()
          .filter((e) => {
            if (!isDue(e.statusCalibracao)) return false;
            if (tipo === "interna") {
              return e.tipoCalibracao === "interna" || e.tipoCalibracao === "ambos";
            }
            return e.tipoCalibracao === "externa" || e.tipoCalibracao === "ambos";
          }),

      createEquipment: (input) => {
        const id = generateId("eq");
        const eq: Equipment = {
          id,
          ...input,
          setorId: input.setorId ?? "",
          responsavelId: input.responsavelId ?? getQualidadeCurrentUserId(),
          fornecedor: input.fornecedor?.trim() || undefined,
          laudoNome: input.laudoNome?.trim() || undefined,
          laudoDataUrl: input.laudoDataUrl?.trim() || undefined,
          versaoLaudoAtual: input.laudoNome ? INITIAL_REVISION : undefined,
          anexos: input.anexos?.length ? input.anexos : undefined,
          laudoAnexos: input.anexos?.length ? input.anexos : undefined,
          frequenciaVerificacaoDias: input.frequenciaVerificacaoDias ?? 90,
          ativo: true,
        };
        set((state) => ({ equipment: [...state.equipment, eq] }));
        return id;
      },

      updateEquipment: (id, input) => {
        set((state) => ({
          equipment: state.equipment.map((e) => {
            if (e.id !== id) return e;

            const next: Equipment = {
              ...e,
              descricao: input.descricao,
              local: input.local,
              setorId: input.setorId,
              responsavelId: input.responsavelId,
              fornecedor: input.fornecedor?.trim() || undefined,
              tipoCalibracao: input.tipoCalibracao,
              frequenciaCalibracaoDias: input.frequenciaCalibracaoDias,
              frequenciaVerificacaoDias: input.frequenciaVerificacaoDias,
              ultimaCalibracao: input.ultimaCalibracao,
              ultimaVerificacao: input.ultimaVerificacao,
              ativo: input.ativo,
            };

            // Nunca zerar laudo ao salvar cadastro sem anexar arquivo de novo.
            if (input.laudoNome !== undefined) {
              next.laudoNome = input.laudoNome.trim() || undefined;
            }
            if (input.laudoDataUrl !== undefined) {
              next.laudoDataUrl = input.laudoDataUrl.trim() || undefined;
            }
            if (input.anexos !== undefined) {
              const anexos = input.anexos.length ? input.anexos : undefined;
              next.anexos = anexos;
              next.laudoAnexos = anexos;
            }

            return next;
          }),
        }));
      },

      setEquipmentAtivo: (id, ativo) => {
        set((state) => ({
          equipment: state.equipment.map((e) =>
            e.id === id ? { ...e, ativo } : e
          ),
        }));
      },

      removeEquipment: (id) => {
        set((state) => ({
          equipment: state.equipment.filter((e) => e.id !== id),
          calibrationRecords: state.calibrationRecords.filter(
            (r) => r.equipmentId !== id
          ),
          verificationRecords: state.verificationRecords.filter(
            (r) => r.equipmentId !== id
          ),
          tasks: state.tasks.filter((t) => t.referenciaId !== id),
        }));
      },

      registerCalibration: (equipmentId, record) => {
        const equipment = get().equipment.find((e) => e.id === equipmentId);
        if (!equipment) return;

        const historico = get().calibrationRecords.filter(
          (r) => r.equipmentId === equipmentId
        );
        const novosRegistros: CalibrationRecord[] = [];
        let versaoAtual = equipment.versaoLaudoAtual ?? INITIAL_REVISION;

        if (equipment.laudoNome && equipment.laudoDataUrl) {
          novosRegistros.push({
            id: generateId("cal"),
            equipmentId,
            versao: versaoAtual,
            data: equipment.ultimaCalibracao ?? record.data,
            tipo: calibrationTipoFromEquipment(equipment.tipoCalibracao),
            resultado: "aprovado",
            responsavelId: equipment.responsavelId,
            laboratorio: equipment.fornecedor,
            laudoNome: equipment.laudoNome,
            laudoDataUrl: equipment.laudoDataUrl,
            anexos: equipment.laudoAnexos?.length
              ? equipment.laudoAnexos
              : undefined,
          });
          versaoAtual = getNextRevision([
            ...historico.map((r) => r.versao),
            versaoAtual,
          ]);
        }

        set((state) => ({
          calibrationRecords: [
            ...state.calibrationRecords,
            ...novosRegistros,
          ],
          equipment: state.equipment.map((e) =>
            e.id === equipmentId
              ? {
                  ...e,
                  ultimaCalibracao: record.data,
                  proximaCalibracao: record.proximaCalibracao,
                  laudoNome: record.laudoNome,
                  laudoDataUrl: record.laudoDataUrl,
                  laudoAnexos: record.anexos?.length ? record.anexos : undefined,
                  versaoLaudoAtual: versaoAtual,
                }
              : e
          ),
          tasks: state.tasks.filter(
            (t) =>
              !(
                t.referenciaId === equipmentId &&
                t.tipo === "calibrar_equipamento" &&
                t.status === "pendente"
              )
          ),
        }));
      },

      registerVerification: (equipmentId, record) => {
        const id = generateId("ver-eq");
        set((state) => ({
          verificationRecords: [
            ...state.verificationRecords,
            { ...record, id, equipmentId },
          ],
          equipment: state.equipment.map((e) =>
            e.id === equipmentId
              ? { ...e, ultimaVerificacao: record.data }
              : e
          ),
          tasks: state.tasks.filter(
            (t) =>
              !(
                t.referenciaId === equipmentId &&
                t.tipo === "verificar_equipamento" &&
                t.status === "pendente"
              )
          ),
        }));
      },

      getCalibrationRecords: (equipmentId) =>
        get()
          .calibrationRecords.filter((r) => r.equipmentId === equipmentId)
          .sort((a, b) => b.versao.localeCompare(a.versao)),

      getVerificationRecords: (equipmentId) =>
        get()
          .verificationRecords.filter((r) => r.equipmentId === equipmentId)
          .sort((a, b) => b.data.localeCompare(a.data)),
}));
