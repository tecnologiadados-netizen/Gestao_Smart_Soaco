/**
 * Entrada por peso: o valor unitário é comparado sem tolerância de centavos.
 * A 10ª casa só elimina ruído de ponto flutuante. O card mostra 4 casas;
 * o texto completo guarda cada casa usada nessa comparação.
 */

const UNIDADES_PESO = new Set([
  'kg',
  'kgs',
  'quilo',
  'quilos',
  'quilograma',
  'quilogramas',
  'kilograma',
  'kilogramas',
  'g',
  'gr',
  'grama',
  'gramas',
  'mg',
  'miligrama',
  'miligramas',
  't',
  'ton',
  'tonelada',
  'toneladas',
  'lb',
  'libra',
  'libras',
]);

const CASAS_UNITARIO_EXATO = 10;

function normalizarUnidade(nome: string | null | undefined): string {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.\s]+/g, ' ')
    .trim();
}

const UNIDADES_TONELADA = new Set(['t', 'ton', 'tonelada', 'toneladas']);
const UNIDADES_QUILOGRAMA = new Set([
  'kg',
  'kgs',
  'quilo',
  'quilos',
  'quilograma',
  'quilogramas',
  'kilograma',
  'kilogramas',
]);

function tokenUnidade(nome: string | null | undefined): string {
  return normalizarUnidade(nome).split(' ')[0] ?? '';
}

export function unidadeEhPeso(nome: string | null | undefined): boolean {
  const n = normalizarUnidade(nome);
  if (!n) return false;
  if (UNIDADES_PESO.has(n)) return true;
  return UNIDADES_PESO.has(tokenUnidade(nome));
}

export function unidadeEhTonelada(nome: string | null | undefined): boolean {
  const n = normalizarUnidade(nome);
  return UNIDADES_TONELADA.has(n) || UNIDADES_TONELADA.has(tokenUnidade(nome));
}

export function unidadeEhQuilograma(nome: string | null | undefined): boolean {
  const n = normalizarUnidade(nome);
  return UNIDADES_QUILOGRAMA.has(n) || UNIDADES_QUILOGRAMA.has(tokenUnidade(nome));
}

/**
 * Nomus pode gravar a quantidade já em kg e manter o rótulo "TONELADA".
 * Nesses casos a legenda deve exibir kg + observação da origem.
 */
export function nfToneladaExibidaEmKg(umNF: string | null | undefined, umPC: string | null | undefined): boolean {
  return unidadeEhTonelada(umNF) && unidadeEhQuilograma(umPC);
}

/** 1 tonelada = 1000 kg. */
export const FATOR_KG_POR_TONELADA = 1000;

/**
 * Nomus costuma converter a quantidade TN→kg e manter o unitário em R$/t.
 * Se o unitário da NF ainda está ~1000× o do PC, dividimos por 1000 para comparar em R$/kg.
 * Ratio próximo de 1 = Nomus já alinhou o preço; não converte de novo.
 */
export function precisaConverterUnitarioTonParaKg(params: {
  unitarioNF: number;
  unitarioPC: number;
  umNF: string | null | undefined;
  umPC: string | null | undefined;
}): boolean {
  if (!nfToneladaExibidaEmKg(params.umNF, params.umPC)) return false;
  const nf = Number(params.unitarioNF);
  const pc = Number(params.unitarioPC);
  if (!Number.isFinite(nf) || !(nf > 0)) return false;
  if (!Number.isFinite(pc) || !(pc > 0)) return true;
  return nf / pc >= 100;
}

export function converterUnitarioTonParaKg(unitario: number): number {
  const v = Number(unitario);
  if (!Number.isFinite(v)) return 0;
  return v / FATOR_KG_POR_TONELADA;
}

export function entradaPorPeso(umNF: string | null | undefined, umPC: string | null | undefined): boolean {
  return unidadeEhPeso(umNF) || unidadeEhPeso(umPC);
}

/** Aceita o nome da unidade ou um texto como "124,8 QUILOGRAMA". */
export function textoContemUnidadePeso(texto: string | null | undefined): boolean {
  const n = normalizarUnidade(texto);
  if (!n) return false;
  return n.split(' ').some((token) => UNIDADES_PESO.has(token.replace(/[.,]/g, '')));
}

export function normalizarUnitarioExato(n: number | null | undefined): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  const f = 10 ** CASAS_UNITARIO_EXATO;
  return Math.round((v + Number.EPSILON) * f) / f;
}

export function unitariosExatosIguais(
  a: number | null | undefined,
  b: number | null | undefined
): boolean {
  return normalizarUnitarioExato(a) === normalizarUnitarioExato(b);
}

export function unitarioExatoNfMaior(
  nf: number | null | undefined,
  pc: number | null | undefined
): boolean {
  return normalizarUnitarioExato(nf) > normalizarUnitarioExato(pc);
}

/** Valor com cada casa usada na comparação. Mínimo de 4, para acompanhar o card. */
export function textoReaisCasasUtilizadas(n: number | null | undefined): string {
  const v = normalizarUnitarioExato(n);
  const negativo = v < 0;
  const abs = Math.abs(v);
  const fixo = abs.toFixed(CASAS_UNITARIO_EXATO);
  const [inteiro, fracaoBruta = ''] = fixo.split('.');
  const fracao = fracaoBruta.replace(/0+$/, '').padEnd(4, '0');
  const intFmt = Number(inteiro).toLocaleString('pt-BR');
  return `${negativo ? '−' : ''}R$ ${intFmt},${fracao}`;
}
