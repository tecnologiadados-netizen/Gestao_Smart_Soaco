/**
 * Nomus grava a quantidade já na unidade do pedido e pode manter o preço
 * na unidade informada na nota (caixa, tonelada, metro…).
 * O fator vem de qtdeConversaoPrincipal / qtdeConversaoSecundaria.
 * 1 caixa = 41.250 unidades, 1 tonelada = 1.000 kg.
 */

export type ConversaoUnidadeNf = {
  /** Unidade em que a nota foi informada (CAIXA, TONELADA). */
  origem: string;
  /** Unidade do pedido, na qual a quantidade já está. */
  destino: string;
  /** Quantas unidades de destino cabem em uma unidade de origem. */
  fator: number;
  /** Quantidade digitada na unidade de origem (4 caixas, 2,122 t). */
  qtdeInformada: number | null;
  quantidadeConvertida: boolean;
  /** O preço da NF ainda estava na unidade de origem e deve ser dividido pelo fator. */
  precoConvertido: boolean;
};

function normalizarUnidade(nome: string | null | undefined): string {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.\s]+/g, ' ')
    .trim();
}

function unidadesDiferentes(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizarUnidade(a);
  const nb = normalizarUnidade(b);
  return Boolean(na && nb && na !== nb);
}

function fatorDaLinha(params: {
  qtde: number;
  qtdeInformada: number;
  qtdeConversaoPrincipal: number;
  qtdeConversaoSecundaria: number;
}): number | null {
  const principal = Number(params.qtdeConversaoPrincipal);
  const secundaria = Number(params.qtdeConversaoSecundaria);
  if (principal > 0 && secundaria > 0) {
    const fator = principal / secundaria;
    if (Number.isFinite(fator) && fator > 0) return fator;
  }
  const qtde = Number(params.qtde);
  const informada = Number(params.qtdeInformada);
  if (informada > 0 && qtde > 0) {
    const fator = qtde / informada;
    if (Number.isFinite(fator) && fator > 0) return fator;
  }
  return null;
}

function quantidadeBateComFator(qtde: number, qtdeInformada: number, fator: number): boolean {
  if (!(qtdeInformada > 0) || !(qtde > 0) || !(fator > 0)) return false;
  const obtido = qtde / qtdeInformada;
  const tolerancia = Math.max(Math.abs(fator) * 0.02, 1e-6);
  return Math.abs(obtido - fator) <= tolerancia;
}

/**
 * O preço ainda está na unidade informada quando NF/PC fica perto do fator.
 * Perto de 1, o Nomus já alinhou o preço à unidade do pedido.
 */
export function precoAindaNaUnidadeInformada(params: {
  unitarioNF: number;
  unitarioPC: number;
  fator: number;
}): boolean {
  const nf = Number(params.unitarioNF);
  const pc = Number(params.unitarioPC);
  const fator = Number(params.fator);
  if (!(nf > 0) || !(fator > 0) || Math.abs(fator - 1) < 1e-6) return false;
  if (!(pc > 0)) return true;
  const ratio = nf / pc;
  if (!(ratio > 0)) return false;
  const distFator = Math.abs(Math.log(ratio) - Math.log(fator));
  const distIdentidade = Math.abs(Math.log(ratio));
  return distFator + 1e-9 < distIdentidade;
}

export function resolverConversaoUnidadeNf(params: {
  umNF: string | null | undefined;
  umPC: string | null | undefined;
  qtde: number;
  qtdeInformada: number;
  qtdeConversaoPrincipal: number;
  qtdeConversaoSecundaria: number;
  unitarioNF: number;
  unitarioPC: number;
}): ConversaoUnidadeNf | null {
  if (!unidadesDiferentes(params.umNF, params.umPC)) return null;
  const fator = fatorDaLinha(params);
  if (fator == null || Math.abs(fator - 1) < 1e-6) return null;
  const qtdeInformada = Number(params.qtdeInformada);
  if (!quantidadeBateComFator(Number(params.qtde), qtdeInformada, fator)) return null;
  const precoConvertido = precoAindaNaUnidadeInformada({
    unitarioNF: params.unitarioNF,
    unitarioPC: params.unitarioPC,
    fator,
  });
  return {
    origem: String(params.umNF ?? '').trim() || 'origem',
    destino: String(params.umPC ?? '').trim() || 'destino',
    fator,
    qtdeInformada: qtdeInformada > 0 ? qtdeInformada : null,
    quantidadeConvertida: true,
    precoConvertido,
  };
}

export function converterUnitarioPeloFator(unitario: number, fator: number): number {
  const v = Number(unitario);
  const f = Number(fator);
  if (!Number.isFinite(v)) return 0;
  if (!Number.isFinite(f) || !(f > 0)) return v;
  return v / f;
}

/** Preço que some em 2 casas (R$ 0,00) e precisa das casas do pedido. */
export function unitarioPrecisaCasasAltas(
  unitarioNF: number,
  unitarioPC: number
): boolean {
  return [unitarioNF, unitarioPC].some((n) => {
    const v = Number(n);
    return Number.isFinite(v) && v !== 0 && Math.abs(v) < 0.005;
  });
}
