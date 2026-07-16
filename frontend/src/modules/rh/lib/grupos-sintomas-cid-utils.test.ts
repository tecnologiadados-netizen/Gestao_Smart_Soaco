import { describe, expect, it } from "vitest";

import { buildGruposSintomasFromCadastro, GRUPO_SINTOMA_IDS } from "@rh/lib/grupos-sintomas-cid-default";
import { classificarLinhaCadastroCid, cidPertenceAoGrupo } from "@rh/lib/cid-grupos";
import { syncGruposSintomasComCadastro } from "@rh/lib/grupos-sintomas-cid-utils";
import { tituloGrupoSintoma } from "@rh/lib/grupos-sintomas-cid-titulos";

const CADASTRO = [
  "M40-M49, M53-M54 - Outras dorsopatias",
  "M50-M51 - Transtornos discais cervicais e outros transtornos discais",
  "M54 - Dorsalgia é caracterizada por dor na coluna torácica.",
  "M54.5 - Lombalgia",
  "J00 - Nasofaringite aguda [resfriado comum]",
  "A09- Diarreia e gastroenterite de origem infecciosa presumível",
  "J09-J11 - Influenza [gripe]",
  "M00-M99 - Doenças do sistema osteomuscular",
  "Z00.0 – Exame geral de rotina.",
  "J42 refere-se à Bronquite Crônica Não Especificada",
  "C18 - Neoplasia maligna do cólon",
  "V23.9-Motociclista traumatizado em colisão com automóvel.",
  "CID AUSENTE/NÃO CONSTA NO DOCUMENTO",
];

describe("GRUPO_SINTOMA_IDS", () => {
  it("expõe 19 grupos alinhados à planilha", () => {
    expect(GRUPO_SINTOMA_IDS).toHaveLength(19);
    expect(GRUPO_SINTOMA_IDS).toContain("cap-c-neoplasias");
    expect(GRUPO_SINTOMA_IDS).toContain("cap-b-parasitas");
    expect(GRUPO_SINTOMA_IDS).not.toContain("capitulos-agregados");
  });
});

describe("buildGruposSintomasFromCadastro", () => {
  it("agrupa osteomuscular (coluna + resto do M)", () => {
    const grupos = buildGruposSintomasFromCadastro(CADASTRO);
    const osteo = grupos.find((g) => g.id === "osteomuscular-m");
    expect(osteo?.cids).toEqual([
      "M00-M99 - Doenças do sistema osteomuscular",
      "M40-M49, M53-M54 - Outras dorsopatias",
      "M50-M51 - Transtornos discais cervicais e outros transtornos discais",
      "M54 - Dorsalgia é caracterizada por dor na coluna torácica.",
      "M54.5 - Lombalgia",
    ]);
  });

  it("subdivide neoplasias em cap-c-neoplasias", () => {
    const grupos = buildGruposSintomasFromCadastro(CADASTRO);
    const neo = grupos.find((g) => g.id === "cap-c-neoplasias");
    expect(neo?.cids).toContain("C18 - Neoplasia maligna do cólon");
    expect(neo?.titulo).toBe(tituloGrupoSintoma("cap-c-neoplasias"));
  });

  it("agrupa acidentes V com traumatismos S/T", () => {
    const grupos = buildGruposSintomasFromCadastro(CADASTRO);
    const trauma = grupos.find((g) => g.id === "traumatismos-st");
    expect(trauma?.cids).toContain("V23.9-Motociclista traumatizado em colisão com automóvel.");
  });

  it("cobre 100% das linhas do cadastro", () => {
    const grupos = buildGruposSintomasFromCadastro(CADASTRO);
    const atribuidos = new Set(grupos.flatMap((g) => g.cids));
    expect(atribuidos.size).toBe(CADASTRO.length);
    expect(CADASTRO.every((c) => atribuidos.has(c))).toBe(true);
  });

  it("classifica faixas nos grupos consolidados da planilha", () => {
    expect(classificarLinhaCadastroCid("J09-J11 - Influenza [gripe]").id).toBe("respiratorio");
    expect(classificarLinhaCadastroCid("M00-M99 - Doenças do sistema osteomuscular").id).toBe(
      "osteomuscular-m",
    );
    expect(classificarLinhaCadastroCid("A09- Diarreia e gastroenterite de origem infecciosa presumível").id).toBe(
      "digestivo",
    );
    expect(classificarLinhaCadastroCid("Z00.0 – Exame geral de rotina.").id).toBe("z-preventiva");
    expect(classificarLinhaCadastroCid("J42 refere-se à Bronquite Crônica Não Especificada").id).toBe(
      "respiratorio",
    );
    expect(classificarLinhaCadastroCid("CID AUSENTE/NÃO CONSTA NO DOCUMENTO").id).toBe(
      "cid-marcador-folha-sem-codigo",
    );
  });
});

describe("syncGruposSintomasComCadastro", () => {
  it("substitui cids sintéticos pelos do cadastro", () => {
    const grupos = [
      {
        id: "osteomuscular-m",
        ordem: 1,
        titulo: "Osteomuscular",
        cids: ["M41", "M42", "M54.5 - Lombalgia"],
      },
    ];
    const synced = syncGruposSintomasComCadastro(grupos, CADASTRO);
    expect(synced[0].cids).toEqual([
      "M00-M99 - Doenças do sistema osteomuscular",
      "M40-M49, M53-M54 - Outras dorsopatias",
      "M50-M51 - Transtornos discais cervicais e outros transtornos discais",
      "M54 - Dorsalgia é caracterizada por dor na coluna torácica.",
      "M54.5 - Lombalgia",
    ]);
  });
});

describe("cidPertenceAoGrupo com linhas de faixa", () => {
  it("correlaciona código de ausência com linha de faixa do grupo", () => {
    const grupoCids = ["M40-M49, M53-M54 - Outras dorsopatias"];
    expect(cidPertenceAoGrupo("M41", grupoCids)).toBe(true);
    expect(cidPertenceAoGrupo("M54.5", ["M54.5 - Lombalgia"])).toBe(true);
  });
});
