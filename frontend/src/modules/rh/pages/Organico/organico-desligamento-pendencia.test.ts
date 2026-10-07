import { describe, expect, it } from "vitest";
import { ORGANICO_IDX } from "./organico-derive";
import { collectSecullumDesligamentoPendente } from "./organico-activity-log";
import type { OrganicoSheetRow } from "./useOrganicoImport";

function linha(status: string): OrganicoSheetRow {
  const row = Array.from({ length: ORGANICO_IDX.STATUS + 1 }, () => "");
  row[ORGANICO_IDX.STATUS] = status;
  return row;
}

describe("alerta de desligamento na sync Secullum", () => {
  it("abre pendência quando o colaborador passa a desligado", () => {
    const pendencia = collectSecullumDesligamentoPendente(linha("Ativo"), linha("Desligado"), {
      motivoPai: "Pedido de demissão",
      dataDemissao: "2026-10-06",
    });
    expect(pendencia).toMatchObject({
      tipo: "desligamento",
      valorAnterior: "Ativo",
      valorAtual: "Pedido de demissão",
      dataReferencia: "2026-10-06",
    });
  });

  it("não alerta quem já estava desligado nem cadastro novo já desligado", () => {
    expect(
      collectSecullumDesligamentoPendente(linha("Desligado"), linha("Desligado"), {
        motivoPai: "Pedido de demissão",
        dataDemissao: "2026-10-06",
      }),
    ).toBeNull();
    expect(
      collectSecullumDesligamentoPendente(null, linha("Desligado"), {
        motivoPai: "Pedido de demissão",
        dataDemissao: "2026-10-06",
      }),
    ).toBeNull();
  });
});