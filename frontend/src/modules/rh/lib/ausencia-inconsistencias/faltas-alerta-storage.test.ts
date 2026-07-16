import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FaltaAlertaEnquadramentoRow, FaltaAusenciaInconsistenciaRow } from "@rh/types/api";

const store = new Map<string, unknown>();

vi.mock("@/lib/ui-filter-persistence", () => ({
  readPersistedJson: <T,>(key: string) => (store.get(key) as T | undefined) ?? null,
  writePersistedJson: (key: string, value: unknown) => {
    store.set(key, value);
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => "tester",
}));

vi.mock("@/lib/api-client", () => ({
  isApiConfigured: () => false,
}));

const INCONSISTENCIAS_KEY = "rh-faltas-ausencia-inconsistencias-v1";
const ENQUADRAMENTOS_KEY = "rh-faltas-alerta-enquadramentos-v1";

describe("removerAlertasPorFaltaIds", () => {
  beforeEach(() => {
    store.clear();
    vi.resetModules();
  });

  async function loadStorage() {
    return import("@/lib/ausencia-inconsistencias/faltas-alerta-storage");
  }

  it("remove inconsistência resolvida e enquadramento ligados à ausência excluída", async () => {
    const inconsistencias: FaltaAusenciaInconsistenciaRow[] = [
      {
        id: "inc-1",
        faltaId: "falta-99",
        enquadramentoId: "enq-1",
        regraId: "regra-a",
        titulo: "Alerta teste",
        descricao: "Motivo",
        baseLegal: "clt",
        severidade: "media",
        status: "resolvida",
        matricula: "1724",
        nomeFuncionario: "Colaborador",
        dataAusencia: "2026-08-19",
        detectadaEm: "2026-06-19T10:00:00.000Z",
        resolvidaEm: "2026-06-19T11:00:00.000Z",
      },
    ];
    const enquadramentos: FaltaAlertaEnquadramentoRow[] = [
      {
        id: "enq-1",
        regraId: "regra-a",
        faltaId: "falta-99",
        inconsistenciaId: "inc-1",
        matricula: "1724",
        nomeFuncionario: "Colaborador",
        dataAusencia: "2026-08-19",
        tipo: "DECLARACAO",
        motivo: "Motivo",
        lancadoPor: "tester",
        detectadaEm: "2026-06-19T10:00:00.000Z",
        statusResolucao: "resolvida",
      },
    ];
    store.set(INCONSISTENCIAS_KEY, inconsistencias);
    store.set(ENQUADRAMENTOS_KEY, enquadramentos);

    const { removerAlertasPorFaltaIds, getFaltasAusenciaInconsistencias, getFaltasAlertaEnquadramentos } =
      await loadStorage();

    const removidos = await removerAlertasPorFaltaIds(["falta-99"]);
    expect(removidos).toBe(1);
    expect(await getFaltasAusenciaInconsistencias()).toHaveLength(0);
    expect(await getFaltasAlertaEnquadramentos()).toHaveLength(0);
  });

  it("purgarAlertasOrfaos remove alertas cuja ausência não está no cadastro", async () => {
    store.set(INCONSISTENCIAS_KEY, [
      {
        id: "inc-2",
        faltaId: "falta-antiga",
        regraId: "regra-b",
        titulo: "Orfão",
        descricao: "x",
        baseLegal: "operacional",
        severidade: "baixa",
        status: "pendente",
        matricula: "1",
        nomeFuncionario: "A",
        dataAusencia: "2026-01-01",
        detectadaEm: "2026-06-19T10:00:00.000Z",
      },
    ]);
    store.set(ENQUADRAMENTOS_KEY, []);

    const { purgarAlertasOrfaos, getFaltasAusenciaInconsistencias } = await loadStorage();
    const n = purgarAlertasOrfaos([{ id: "falta-ativa", matricula: "2", data: "2026-02-01" }]);
    expect(n).toBe(1);
    expect(await getFaltasAusenciaInconsistencias()).toHaveLength(0);
  });

  it("purgarAlertasOrfaos não apaga alertas quando cadastro de ausências vem vazio", async () => {
    store.set(INCONSISTENCIAS_KEY, [
      {
        id: "inc-3",
        faltaId: "falta-x",
        regraId: "regra-c",
        titulo: "Preservar",
        descricao: "x",
        baseLegal: "operacional",
        severidade: "baixa",
        status: "pendente",
        matricula: "1724",
        nomeFuncionario: "Colaborador",
        dataAusencia: "2026-06-19",
        detectadaEm: "2026-06-19T10:00:00.000Z",
      },
    ]);

    const { purgarAlertasOrfaos, getFaltasAusenciaInconsistencias } = await loadStorage();
    const n = purgarAlertasOrfaos([]);
    expect(n).toBe(0);
    expect(await getFaltasAusenciaInconsistencias()).toHaveLength(1);
  });

  it("reconciliar mantém alerta por matrícula+data mesmo com faltaId divergente", async () => {
    store.set(INCONSISTENCIAS_KEY, [
      {
        id: "inc-4",
        faltaId: "id-desatualizado",
        regraId: "regra-d",
        titulo: "Relink",
        descricao: "x",
        baseLegal: "clt",
        severidade: "media",
        status: "pendente",
        matricula: "1724",
        nomeFuncionario: "Davi",
        dataAusencia: "2026-06-19",
        detectadaEm: "2026-06-19T10:00:00.000Z",
      },
    ]);
    store.set(ENQUADRAMENTOS_KEY, []);

    const { reconciliarAlertasComAusencias, getFaltasAusenciaInconsistencias } = await loadStorage();
    reconciliarAlertasComAusencias([
      { id: "uuid-real-no-banco", matricula: "1724", data: "2026-06-19" },
    ]);
    const rows = await getFaltasAusenciaInconsistencias();
    expect(rows).toHaveLength(1);
    expect(rows[0].faltaId).toBe("uuid-real-no-banco");
  });
});
