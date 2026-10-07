export const NIVEIS_ESCOLARIDADE = [
  { id: "sem_instrucao", rotulo: "Sem instrução", contaNaBasica: false },
  { id: "fundamental_incompleto", rotulo: "Fundamental incompleto", contaNaBasica: false },
  { id: "fundamental_completo", rotulo: "Fundamental completo", contaNaBasica: false },
  { id: "medio_incompleto", rotulo: "Médio incompleto", contaNaBasica: false },
  { id: "medio_completo", rotulo: "Médio completo", contaNaBasica: true },
  { id: "superior_incompleto", rotulo: "Superior incompleto", contaNaBasica: true },
  { id: "superior_completo", rotulo: "Superior completo", contaNaBasica: true },
  { id: "pos_graduacao", rotulo: "Pós-graduação", contaNaBasica: true },
  { id: "nao_informado", rotulo: "Não informado", contaNaBasica: false },
] as const;

export type NivelEscolaridadeId = (typeof NIVEIS_ESCOLARIDADE)[number]["id"];
export type GeneroEscolaridade = "masculino" | "feminino";

export type EscolaridadeNivelResumo = {
  id: NivelEscolaridadeId;
  rotulo: string;
  contaNaBasica: boolean;
  homens: number;
  mulheres: number;
  homensPct: number;
  mulheresPct: number;
  homensMedia: number;
  mulheresMedia: number;
  homensComSalario: number;
  mulheresComSalario: number;
};

export type EscolaridadeResumo = {
  niveis: EscolaridadeNivelResumo[];
  homensTotal: number;
  mulheresTotal: number;
  semSexo: number;
  basica: {
    homens: number;
    mulheres: number;
    homensPct: number;
    mulheresPct: number;
  };
};

function semAcento(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function emAndamento(texto: string): boolean {
  return texto.includes("INCOMPLET") || texto.includes("ANDAMENTO") || texto.includes("CURSANDO");
}

/** Agrupa o texto livre de "Grau Instrução" nas faixas do gráfico. */
export function classificarEscolaridade(raw: unknown): NivelEscolaridadeId {
  const texto = semAcento(String(raw ?? ""));
  if (!texto) return "nao_informado";
  if (texto.includes("ANALFAB") || texto.includes("SEM INSTRU") || texto.includes("NAO ALFAB")) {
    return "sem_instrucao";
  }
  if (
    texto.includes("POS GRAD") ||
    texto.includes("POSGRAD") ||
    texto.includes("MESTRADO") ||
    texto.includes("DOUTORADO") ||
    texto.includes("MBA")
  ) {
    return "pos_graduacao";
  }
  if (texto.includes("SUPERIOR") || texto.includes("GRADUAC") || texto.includes("BACHAREL") || texto.includes("FACULDADE")) {
    return emAndamento(texto) ? "superior_incompleto" : "superior_completo";
  }
  if (texto.includes("TECNIC") || /(^| )TEC( |$)/.test(texto) || texto.includes("MEDIO") || texto.includes("SEGUNDO GRAU")) {
    return emAndamento(texto) ? "medio_incompleto" : "medio_completo";
  }
  if (texto.includes("FUNDAMENTAL") || texto.includes("PRIMEIRO GRAU") || texto.includes("PRIMARIO")) {
    return emAndamento(texto) ? "fundamental_incompleto" : "fundamental_completo";
  }
  return "nao_informado";
}

export function generoDoSexo(sexo: unknown): GeneroEscolaridade | null {
  const valor = semAcento(String(sexo ?? ""));
  if (valor === "M" || valor.startsWith("MASC")) return "masculino";
  if (valor === "F" || valor.startsWith("FEM")) return "feminino";
  return null;
}

export function rotuloNivelEscolaridade(id: NivelEscolaridadeId): string {
  return NIVEIS_ESCOLARIDADE.find((nivel) => nivel.id === id)?.rotulo ?? id;
}

function percentual(quantidade: number, total: number): number {
  if (quantidade <= 0 || total <= 0) return 0;
  return Math.round((quantidade / total) * 1000) / 10;
}

function media(soma: number, quantidade: number): number {
  if (quantidade <= 0 || soma <= 0) return 0;
  return Math.round((soma / quantidade) * 100) / 100;
}

type ContagemNivel = {
  homens: number;
  mulheres: number;
  homensSoma: number;
  mulheresSoma: number;
  homensComSalario: number;
  mulheresComSalario: number;
};

function contagemVazia(): ContagemNivel {
  return { homens: 0, mulheres: 0, homensSoma: 0, mulheresSoma: 0, homensComSalario: 0, mulheresComSalario: 0 };
}

export function montarEscolaridade(
  pessoas: Array<{ grau: unknown; genero: GeneroEscolaridade | null; salario?: number }>,
): EscolaridadeResumo {
  const contagem = new Map<NivelEscolaridadeId, ContagemNivel>();
  for (const nivel of NIVEIS_ESCOLARIDADE) contagem.set(nivel.id, contagemVazia());

  let homensTotal = 0;
  let mulheresTotal = 0;
  let semSexo = 0;
  for (const pessoa of pessoas) {
    const nivel = classificarEscolaridade(pessoa.grau);
    const bucket = contagem.get(nivel);
    if (!bucket) continue;
    const salario = Number(pessoa.salario);
    const salarioValido = Number.isFinite(salario) && salario > 0;
    if (pessoa.genero === "masculino") {
      bucket.homens += 1;
      homensTotal += 1;
      if (salarioValido) {
        bucket.homensSoma += salario;
        bucket.homensComSalario += 1;
      }
    } else if (pessoa.genero === "feminino") {
      bucket.mulheres += 1;
      mulheresTotal += 1;
      if (salarioValido) {
        bucket.mulheresSoma += salario;
        bucket.mulheresComSalario += 1;
      }
    } else {
      semSexo += 1;
    }
  }

  const niveis = NIVEIS_ESCOLARIDADE.map((nivel) => {
    const qtd = contagem.get(nivel.id) ?? contagemVazia();
    return {
      id: nivel.id,
      rotulo: nivel.rotulo,
      contaNaBasica: nivel.contaNaBasica,
      homens: qtd.homens,
      mulheres: qtd.mulheres,
      homensPct: percentual(qtd.homens, homensTotal),
      mulheresPct: percentual(qtd.mulheres, mulheresTotal),
      homensMedia: media(qtd.homensSoma, qtd.homensComSalario),
      mulheresMedia: media(qtd.mulheresSoma, qtd.mulheresComSalario),
      homensComSalario: qtd.homensComSalario,
      mulheresComSalario: qtd.mulheresComSalario,
    };
  });

  const basicaHomens = niveis.filter((nivel) => nivel.contaNaBasica).reduce((acc, nivel) => acc + nivel.homens, 0);
  const basicaMulheres = niveis.filter((nivel) => nivel.contaNaBasica).reduce((acc, nivel) => acc + nivel.mulheres, 0);

  return {
    niveis,
    homensTotal,
    mulheresTotal,
    semSexo,
    basica: {
      homens: basicaHomens,
      mulheres: basicaMulheres,
      homensPct: percentual(basicaHomens, homensTotal),
      mulheresPct: percentual(basicaMulheres, mulheresTotal),
    },
  };
}
