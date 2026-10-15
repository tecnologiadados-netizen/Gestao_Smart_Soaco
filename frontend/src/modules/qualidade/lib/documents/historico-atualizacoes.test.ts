import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { montarAtualizacoesExternas } from "./historico-atualizacoes.ts";

describe("montarAtualizacoesExternas", () => {
  it("deixa o vigente de fora e ordena as anteriores da mais antiga para a mais recente", () => {
    const lista = montarAtualizacoesExternas({
      versaoAtual: "02",
      vigentes: [{ nome: "Invoice-OJFZNY-00009.pdf", storagePath: "/uploads/qualidade/invoice.pdf" }],
      historico: [
        { nome: "TUV 21.0998 - CABO EPR 750V.pdf" },
        { nome: "Certificado De Conformidade Rev. 01.pdf" },
        { nome: "Certificado De Conformidade Rev. 01 (1).pdf" },
        { nome: "Cert_TNBR-29339 Plugue 2P+T 3A-10A 180°-90°.pdf" },
      ],
      versoes: [
        {
          id: "v02",
          versao: "02",
          dataAprovacao: "2026-10-16T15:00:00.000Z",
          arquivos: [
            { nome: "Invoice-OJFZNY-00009.pdf", storagePath: "/uploads/qualidade/invoice.pdf" },
          ],
        },
        {
          id: "v01",
          versao: "01",
          dataAprovacao: "2026-10-15T15:00:00.000Z",
          arquivos: [{ nome: "Fluxograma Skip lot (1).pdf" }],
        },
        {
          id: "v00",
          versao: "00",
          dataAprovacao: "2026-07-23T17:04:48.524Z",
          arquivos: [{ nome: "Cert_TNBR-29339 Plugue 2P+T 3A-10A 180°-90° (1).pdf" }],
        },
      ],
    });

    assert.deepEqual(
      lista.map((item) => item.nome),
      [
        "TUV 21.0998 - CABO EPR 750V.pdf",
        "Certificado De Conformidade Rev. 01.pdf",
        "Certificado De Conformidade Rev. 01 (1).pdf",
        "Cert_TNBR-29339 Plugue 2P+T 3A-10A 180°-90°.pdf",
        "Cert_TNBR-29339 Plugue 2P+T 3A-10A 180°-90° (1).pdf",
        "Fluxograma Skip lot (1).pdf",
      ]
    );
    assert.equal(
      lista.some((item) => item.nome === "Invoice-OJFZNY-00009.pdf"),
      false
    );
  });
});
