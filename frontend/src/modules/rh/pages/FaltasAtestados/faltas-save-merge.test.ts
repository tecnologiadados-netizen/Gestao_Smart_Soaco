import { describe, expect, it } from "vitest";
import type { FaltaRow } from "@rh/types/api";
import { faltaDedupeKey, reconcileVisibleRowIntoMap } from "./faltas-save-merge";

function row(partial: Partial<FaltaRow> & Pick<FaltaRow, "id">): FaltaRow {
  return {
    data: "2026-06-22",
    mesFalta: "jun.",
    matricula: "1775",
    nomeFuncionario: "HEMILLY",
    endereco: "",
    area: "",
    setor: "PCP",
    lider: "",
    periodo: "INTEGRAL",
    qntd: "5",
    diasTurno: "",
    tipo: "ATESTADO",
    cid: "",
    localAtendimento: "",
    medicoResponsavel: "",
    observacoes: "",
    aprovado: "",
    reprovado: "",
    ...partial,
  };
}

describe("faltaDedupeKey", () => {
  it("gera chave estável para o mesmo lançamento", () => {
    const a = row({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" });
    const b = row({ id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" });
    expect(faltaDedupeKey(a)).toBe(faltaDedupeKey(b));
  });
});

describe("reconcileVisibleRowIntoMap", () => {
  it("reutiliza id existente quando UUID novo duplica matrícula+data+tipo", () => {
    const serverId = "11111111-1111-1111-1111-111111111111";
    const clientId = "22222222-2222-2222-2222-222222222222";
    const map = new Map<string, FaltaRow>([[serverId, row({ id: serverId })]]);
    const serverIds = new Set([serverId]);

    reconcileVisibleRowIntoMap(map, row({ id: clientId, nomeFuncionario: "HEMILLY ATUALIZADA" }), serverIds);

    expect(map.size).toBe(1);
    expect(map.has(serverId)).toBe(true);
    expect(map.get(serverId)?.nomeFuncionario).toBe("HEMILLY ATUALIZADA");
  });

  it("insere UUID novo quando não há equivalente no snapshot", () => {
    const clientId = "22222222-2222-2222-2222-222222222222";
    const map = new Map<string, FaltaRow>();
    const serverIds = new Set<string>();

    reconcileVisibleRowIntoMap(map, row({ id: clientId }), serverIds);

    expect(map.size).toBe(1);
    expect(map.has(clientId)).toBe(true);
  });
});
