import { describe, expect, it } from "vitest";
import { normalizarMesFalta } from "./mes-falta";

describe("normalizarMesFalta", () => {
  it("mantém o padrão já usado na grade", () => {
    expect(normalizarMesFalta("set.")).toBe("set.");
    expect(normalizarMesFalta("ago.")).toBe("ago.");
    expect(normalizarMesFalta("fev.")).toBe("fev.");
  });

  it("converte mês por extenso, em qualquer caixa, para a abreviação", () => {
    expect(normalizarMesFalta("ABRIL")).toBe("abr.");
    expect(normalizarMesFalta("AGOSTO")).toBe("ago.");
    expect(normalizarMesFalta("DEZEMBRO")).toBe("dez.");
    expect(normalizarMesFalta("FEVEREIRO")).toBe("fev.");
    expect(normalizarMesFalta("MARÇO")).toBe("mar.");
    expect(normalizarMesFalta("Janeiro")).toBe("jan.");
    expect(normalizarMesFalta("maio")).toBe("mai.");
  });

  it("não altera texto que não é mês", () => {
    expect(normalizarMesFalta("")).toBe("");
    expect(normalizarMesFalta("  ")).toBe("");
    expect(normalizarMesFalta("N/A")).toBe("N/A");
  });
});
