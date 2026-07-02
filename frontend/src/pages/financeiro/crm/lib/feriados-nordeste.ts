import { parseLocalDate } from "../lib/datas-locais";

/** Feriados estaduais e culturais mais observados no Nordeste (dia/mês fixos). */
export const FERIADOS_NORDESTE_POPULARES = [
  {
    dia: 6,
    mes: 3,
    nome: "Revolução Pernambucana",
    uf: "PE",
    tipo: "estadual",
  },
  {
    dia: 25,
    mes: 3,
    nome: "Abolição da escravatura no Ceará",
    uf: "CE",
    tipo: "estadual",
  },
  {
    dia: 24,
    mes: 6,
    nome: "São João",
    uf: "NE",
    tipo: "cultural",
  },
  {
    dia: 29,
    mes: 6,
    nome: "São Pedro",
    uf: "NE",
    tipo: "cultural",
  },
  {
    dia: 2,
    mes: 7,
    nome: "Independência da Bahia",
    uf: "BA",
    tipo: "estadual",
  },
  {
    dia: 8,
    mes: 7,
    nome: "Independência de Sergipe",
    uf: "SE",
    tipo: "estadual",
  },
  {
    dia: 28,
    mes: 7,
    nome: "Adesão do Maranhão",
    uf: "MA",
    tipo: "estadual",
  },
  {
    dia: 5,
    mes: 8,
    nome: "Fundação da Paraíba",
    uf: "PB",
    tipo: "estadual",
  },
  {
    dia: 16,
    mes: 9,
    nome: "Emancipação política de Alagoas",
    uf: "AL",
    tipo: "estadual",
  },
  {
    dia: 3,
    mes: 10,
    nome: "Mártires de Cunhaú e Uruaçu",
    uf: "RN",
    tipo: "estadual",
  },
  {
    dia: 19,
    mes: 10,
    nome: "Criação do Estado do Piauí",
    uf: "PI",
    tipo: "estadual",
  },
] as const;

function isFixedFeriadoNordeste(date: Date): boolean {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return FERIADOS_NORDESTE_POPULARES.some(
    (feriado) => feriado.mes === month && feriado.dia === day,
  );
}

export function isFeriadoNordestePopular(
  value: string | null | undefined,
): boolean {
  if (!value) return false;
  const date = parseLocalDate(value);
  if (!date) return false;
  return isFixedFeriadoNordeste(date);
}
