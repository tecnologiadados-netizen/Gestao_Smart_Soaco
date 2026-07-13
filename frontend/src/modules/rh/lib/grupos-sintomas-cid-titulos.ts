/** Títulos legíveis dos grupos de sintomas — alinhados à planilha cids_agrupados.xlsx e ao painel de diagnóstico. */
export const TITULOS_GRUPO_SINTOMA_CID: Record<string, string> = {
  "osteomuscular-m":
    "Osteomuscular · coluna, articulações, tecidos moles, artrose, tendinite, fibromialgia e demais do cap. M (M00–M99)",
  digestivo:
    "Digestivo · diarreia, gastroenterite, gastrite, úlcera, refluxo, hérnia e demais cap. K + infecções intestinais A04–A09",
  "sintomas-sinais":
    "Sintomas e sinais · dor de cabeça, enxaqueca, dor torácica/abdominal, tontura, febre e demais cap. R + G43–G44",
  respiratorio:
    "Respiratório · resfriado, IVAS, gripe, pneumonia, bronquite, asma, DPOC, COVID-19 e demais cap. J + U07",
  "infeccoes-virais":
    "Infecções virais · dengue, meningite viral, varicela, herpes, mononucleose e demais vírus (cap. A/B selecionados)",
  "saude-mental":
    "Saúde mental e comportamento · ansiedade, depressão, stress, demência, esquizofrenia e demais cap. F (F00–F99)",
  "traumatismos-st":
    "Traumatismos e acidentes · entorses, fraturas, cortes, queimaduras, politrauma e demais do cap. S/T · acidentes de trânsito e causas externas V/W/X/Y",
  "z-preventiva":
    "Saúde preventiva e fatores de risco · rastreios, exames de rotina, vigilância e demais cap. Z",
  "o-gravidez":
    "Gravidez, parto e puerpério · licenças e complicações obstétricas (cap. O)",
  "cap-c-neoplasias":
    "Outros capítulos · Neoplasias malignas e in situ (C00–C97)",
  "cap-d-sangue":
    "Outros capítulos · Sangue, anemia e imunidade (D50–D89)",
  "cap-e-endocrino":
    "Outros capítulos · Endócrino, metabólico e nutricional (E00–E66)",
  "cap-g-nervoso":
    "Outros capítulos · Sistema nervoso (G00–G99, exc. enxaqueca G43–G44)",
  "cap-h-olho-ouvido":
    "Outros capítulos · Olho, ouvido e anexos (H00–H95)",
  "cap-i-circulatorio":
    "Outros capítulos · Aparelho circulatório (I00–I99)",
  "cap-l-pele":
    "Outros capítulos · Pele e tecido subcutâneo (L00–L99)",
  "cap-n-urinario":
    "Outros capítulos · Aparelho urinário e genital (N00–N99)",
  "cap-b-parasitas":
    "Outros capítulos · Parasitas, micoses e sequelas infecciosas (B35–B94)",
  /** Fallback para capítulos sem subgrupo dedicado (P, Q, U exc. U07, etc.). */
  "capitulos-agregados":
    "Outros capítulos CID-10 · códigos especiais e capítulos sem grupo dedicado no cadastro",
  "cid-marcador-folha-sem-codigo":
    "Ausência de código CID na folha · atestados/declarações com marcador «CID ausente» ou equivalente (célula preenchida, sem código diagnóstico)",
};

export const ID_CAPITULOS_AGREGADOS = "capitulos-agregados";

/** Ordem de exibição — espelha a planilha cids_agrupados.xlsx. */
export const GRUPO_SINTOMA_CATALOGO_IDS = [
  "osteomuscular-m",
  "digestivo",
  "sintomas-sinais",
  "respiratorio",
  "infeccoes-virais",
  "saude-mental",
  "traumatismos-st",
  "z-preventiva",
  "o-gravidez",
  "cap-c-neoplasias",
  "cap-d-sangue",
  "cap-e-endocrino",
  "cap-g-nervoso",
  "cap-h-olho-ouvido",
  "cap-i-circulatorio",
  "cap-l-pele",
  "cap-n-urinario",
  "cap-b-parasitas",
  "cid-marcador-folha-sem-codigo",
] as const;

export type GrupoSintomaCatalogoId = (typeof GRUPO_SINTOMA_CATALOGO_IDS)[number];

/** Letra CID-10 → id do subgrupo «Outros capítulos». */
export const SUBCAPITULO_POR_LETRA: Partial<Record<string, GrupoSintomaCatalogoId>> = {
  C: "cap-c-neoplasias",
  D: "cap-d-sangue",
  E: "cap-e-endocrino",
  G: "cap-g-nervoso",
  H: "cap-h-olho-ouvido",
  I: "cap-i-circulatorio",
  L: "cap-l-pele",
  N: "cap-n-urinario",
  B: "cap-b-parasitas",
};

export function tituloGrupoSintoma(id: string, fallback = ""): string {
  if (id.startsWith("cap-") && id.length === 5) {
    return TITULOS_GRUPO_SINTOMA_CID[ID_CAPITULOS_AGREGADOS];
  }
  return TITULOS_GRUPO_SINTOMA_CID[id] ?? fallback;
}

/** Detecta títulos corrompidos por encoding (mojibake). */
export function tituloGrupoPrecisaReparo(titulo: string): boolean {
  return /├|ÔÇ|┬À|Ã|â€™|â€"/.test(titulo);
}

/** IDs de grupos descontinuados — usados na migração do localStorage. */
export const GRUPOS_SINTOMAS_LEGADOS = [
  "dorsopatias",
  "luxacao-entorse",
  "fratura-membros-outros",
  "gastro-enterite-a04-a09",
  "virais-varias",
  "ivas",
  "influenza",
  "covid",
  "cefaleia",
  "saude-mental-stress",
  "m-outros",
  "s-t-outros",
  "j-outros",
  "k-outros",
  "r-outros",
  "z-outros",
  "o-outros",
  "f-outros",
] as const;

export function grupoSintomasUsaCatalogoLegado(id: string): boolean {
  return (
    (GRUPOS_SINTOMAS_LEGADOS as readonly string[]).includes(id)
    || id === ID_CAPITULOS_AGREGADOS
    || (id.startsWith("cap-") && id.length === 5)
  );
}
