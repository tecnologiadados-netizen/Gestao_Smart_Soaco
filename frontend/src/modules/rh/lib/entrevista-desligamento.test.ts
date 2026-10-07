import { describe, expect, it } from "vitest";
import { encontrarPastaDesligamento, ehPastaDesligamento } from "./entrevista-desligamento";
import type { OrganicoArchiveFolder } from "./organico-documents-api";

function pasta(parcial: Partial<OrganicoArchiveFolder> & Pick<OrganicoArchiveFolder, "id" | "name" | "scope">): OrganicoArchiveFolder {
  return { children: [], documents: [], ...parcial };
}

describe("pasta da entrevista de desligamento", () => {
  it("prefere a pasta global da raiz", () => {
    expect(ehPastaDesligamento(" desligamento ")).toBe(true);
    const global = pasta({ id: "g1", name: "Desligamento", scope: "global" });
    const local = pasta({ id: "l1", name: "Desligamento", scope: "local" });
    expect(encontrarPastaDesligamento([local, global])?.id).toBe("g1");
  });

  it("ignora uma pasta local com o mesmo nome", () => {
    const local = pasta({ id: "l1", name: "Desligamento", scope: "local" });
    expect(encontrarPastaDesligamento([local])).toBeNull();
  });
});
