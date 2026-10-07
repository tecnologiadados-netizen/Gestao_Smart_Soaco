import { describe, expect, it } from "vitest";
import {
  escolherComplementoDesligamento,
  filhosDoMotivoPai,
  normalizarMotivoPai,
} from "./motivo-desligamento";

describe("motivos filhos do desligamento", () => {
  it("agrupa filhos pelo motivo pai mesmo com acento diferente", () => {
    const filhos = filhosDoMotivoPai(
      [
        { motivoPai: "Pedido de Demissão", descricao: "Salário" },
        { motivoPai: "Justa causa", descricao: "Falta grave" },
      ],
      "pedido de demissao",
    );
    expect(normalizarMotivoPai("Pedido de Demissão")).toBe("pedido de demissao");
    expect(filhos.map((item) => item.descricao)).toEqual(["Salário"]);
  });

  it("escolhe o complemento da mesma data de demissão", () => {
    const lista = [
      {
        colaboradorMatricula: "12",
        dataDemissao: "2026-01-10",
        motivoPai: "Pedido de demissão",
        motivoFilho: "Mudança de cidade",
        motivoTexto: "Foi para outro estado",
      },
      {
        colaboradorMatricula: "0012",
        dataDemissao: "2026-08-02",
        motivoPai: "Pedido de demissão",
        motivoFilho: "Proposta externa",
        motivoTexto: "Aceitou outro emprego",
      },
    ];
    expect(escolherComplementoDesligamento(lista, "12", "2026-08-02")?.motivoFilho).toBe("Proposta externa");
    expect(escolherComplementoDesligamento(lista, "99", "2026-08-02")).toBeNull();
  });
});
