import { describe, expect, it } from "vitest";
import type { FaltaRow } from "@rh/types/api";
import { CATALOGO_REGRAS_ALERTA_DEFAULT } from "@rh/lib/ausencia-inconsistencias/regras-catalogo";
import { validarAusenciaLancamento } from "@rh/lib/ausencia-inconsistencias/validar-ausencia";

function linha(partial: Partial<FaltaRow> & Pick<FaltaRow, "id" | "data" | "matricula" | "tipo">): FaltaRow {
  return {
    mesFalta: "",
    nomeFuncionario: "Teste",
    endereco: "",
    area: "",
    setor: "",
    lider: "",
    periodo: "INTEGRAL",
    qntd: "1",
    diasTurno: "",
    cid: "",
    localAtendimento: "",
    medicoResponsavel: "",
    observacoes: "",
    aprovado: "",
    reprovado: "",
    ...partial,
  };
}

const regras = CATALOGO_REGRAS_ALERTA_DEFAULT.map((r) => ({ ...r, updatedAt: new Date().toISOString() }));

describe("validarAusenciaLancamento", () => {
  it("detecta soma de CID acima de 15 dias em 60 dias", () => {
    const historico = [
      linha({
        id: "h1",
        data: "2026-06-01",
        matricula: "100",
        tipo: "Atestado",
        cid: "M54",
        qntd: "10",
      }),
    ];
    const atual = linha({
      id: "n1",
      data: "2026-06-15",
      matricula: "100",
      tipo: "Atestado",
      cid: "M54.5",
      qntd: "6",
    });
    const alertas = validarAusenciaLancamento({ linha: atual, historico, regras });
    expect(alertas.some((a) => a.regraId === "prev-soma-60-grupo-cid")).toBe(true);
  });

  it("ignora regras inativas", () => {
    const regrasOff = regras.map((r) =>
      r.id === "dup-mesmo-dia" ? { ...r, ativa: false } : r,
    );
    const atual = linha({
      id: "n2",
      data: "2026-06-15",
      matricula: "101",
      tipo: "Atestado",
      cid: "J11",
    });
    const historico = [
      linha({
        id: "h-dup",
        data: "2026-06-15",
        matricula: "101",
        tipo: "Falta",
        qntd: "1",
      }),
    ];
    const alertas = validarAusenciaLancamento({ linha: atual, historico, regras: regrasOff });
    expect(alertas.some((a) => a.regraId === "dup-mesmo-dia")).toBe(false);
  });

  it("detecta declaração acima de 3 dias em 12 meses", () => {
    const historico = [
      linha({
        id: "d1",
        data: "2026-01-10",
        matricula: "200",
        tipo: "DECLARACAO COMPARECIMENTO",
        qntd: "2",
      }),
      linha({
        id: "d2",
        data: "2026-03-10",
        matricula: "200",
        tipo: "DECLARACAO COMPARECIMENTO",
        qntd: "1",
      }),
    ];
    const atual = linha({
      id: "d3",
      data: "2026-06-10",
      matricula: "200",
      tipo: "DECLARACAO COMPARECIMENTO",
      qntd: "1",
    });
    const alertas = validarAusenciaLancamento({ linha: atual, historico, regras });
    expect(alertas.some((a) => a.regraId === "pol-declaracao-3-dias")).toBe(true);
  });

  it("detecta doação de sangue com mais de 1 dia", () => {
    const atual = linha({
      id: "s1",
      data: "2026-06-20",
      matricula: "1724",
      tipo: "DOAÇÃO DE SANGUE",
      periodo: "INTEGRAL",
      qntd: "5",
    });
    const alertas = validarAusenciaLancamento({ linha: atual, historico: [], regras });
    expect(alertas.some((a) => a.regraId === "clt-473-iv")).toBe(true);
    expect(alertas.find((a) => a.regraId === "clt-473-iv")?.motivo).toMatch(/5/);
  });
});
