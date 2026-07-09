export const CRITERIOS_AVALIACAO = [
  { id: "qualidade", label: "Qualidade do produto/serviço" },
  { id: "compromisso", label: "Compromisso" },
  { id: "prazo", label: "Prazo de entrega" },
  { id: "atendimento", label: "Atendimento" },
  { id: "preco", label: "Preço / competitividade" },
  { id: "documentacao", label: "Documentação e conformidade" },
  { id: "recursos", label: "Recursos" },
] as const;

export type CriterioId = (typeof CRITERIOS_AVALIACAO)[number]["id"];

export const NOTA_MIN = 1;
export const NOTA_MAX = 5;

export function criarNotasVazias(): Record<CriterioId, number | ""> {
  return CRITERIOS_AVALIACAO.reduce(
    (acc, criterio) => {
      acc[criterio.id] = "";
      return acc;
    },
    {} as Record<CriterioId, number | "">
  );
}

export function calcularMediaNotas(
  notas: Record<CriterioId, number>
): number {
  const valores = CRITERIOS_AVALIACAO.map((c) => notas[c.id]);
  const soma = valores.reduce((total, nota) => total + nota, 0);
  return Math.round((soma / valores.length) * 10) / 10;
}

export function validarNotas(
  notas: Record<CriterioId, number | "">
): notas is Record<CriterioId, number> {
  return CRITERIOS_AVALIACAO.every((criterio) => {
    const nota = notas[criterio.id];
    return (
      typeof nota === "number" &&
      nota >= NOTA_MIN &&
      nota <= NOTA_MAX &&
      Number.isInteger(nota)
    );
  });
}
