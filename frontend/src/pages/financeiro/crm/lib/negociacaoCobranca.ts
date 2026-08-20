import {
  CATEGORIA_NEGOCIAR_ID,
  FILHO_ACORDO_NEGOCIACAO_ID,
  TIPO_TRATATIVA_NEGOCIACAO,
  TIPO_TRATATIVA_PADRAO,
  montarTextoTratativa,
} from './tratativasCobranca';

export type FormaPagamentoNegociacao = 'pix' | 'cartao';
export type PeriodicidadeNegociacao = 'semanal' | 'quinzenal' | 'mensal';

export type ParcelaNegociacao = {
  n: number;
  tipo: 'entrada' | 'parcela';
  data: string;
  valor: number;
  forma: FormaPagamentoNegociacao;
};

/** Schema persistido em crm_inadimplente_tarefa_contato.meta_json (versao 1). */
export type MetaNegociacaoCobranca = {
  kind: 'negociacao';
  versao: 1;
  valorOriginal: number;
  percentualJuros: number;
  diasAtraso: number;
  jurosPorDia: number;
  valorJuros: number;
  valorNegociado: number;
  entrada: { valor: number; forma: FormaPagamentoNegociacao };
  restante: {
    valor: number;
    periodicidade: PeriodicidadeNegociacao;
    quantidadeParcelas: number;
    forma: FormaPagamentoNegociacao;
    dataPrimeiraParcela: string;
  };
  parcelas: ParcelaNegociacao[];
  observacao: string;
};

export type NegociacaoFormState = {
  percentualJuros: number;
  valorNegociado: number;
  entradaValor: number;
  entradaForma: FormaPagamentoNegociacao;
  periodicidade: PeriodicidadeNegociacao;
  quantidadeParcelas: number;
  restanteForma: FormaPagamentoNegociacao;
  dataPrimeiraParcela: string;
  detalhe: string;
};

export const FORMAS_PAGAMENTO_NEGOCIACAO: { id: FormaPagamentoNegociacao; nome: string }[] = [
  { id: 'pix', nome: 'Pix' },
  { id: 'cartao', nome: 'Cartão de crédito' },
];

export const PERIODICIDADES_NEGOCIACAO: { id: PeriodicidadeNegociacao; nome: string }[] = [
  { id: 'semanal', nome: 'Semanal' },
  { id: 'quinzenal', nome: 'Quinzenal' },
  { id: 'mensal', nome: 'Mensal' },
];

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calcularJurosMora(
  valorOriginal: number,
  percentualAoMes: number,
  diasAtraso: number,
): {
  percentualJuros: number;
  diasAtraso: number;
  jurosPorDia: number;
  valorJuros: number;
  valorTotal: number;
} {
  const pct = Number.isFinite(percentualAoMes) ? Math.max(0, percentualAoMes) : 0;
  const base = Number.isFinite(valorOriginal) ? Math.max(0, valorOriginal) : 0;
  const dias = Number.isFinite(diasAtraso) ? Math.max(0, Math.trunc(diasAtraso)) : 0;
  /** Mesma regra da planilha: principal * (taxa mensal / 30) * dias. */
  const jurosPorDia = base * (pct / 100) / 30;
  const valorJuros = roundMoney(jurosPorDia * dias);
  return {
    percentualJuros: pct,
    diasAtraso: dias,
    jurosPorDia,
    valorJuros,
    valorTotal: roundMoney(base + valorJuros),
  };
}

export function estadoNegociacaoInicial(
  valorOriginal: number,
  dataContatoYmd: string,
): NegociacaoFormState {
  const valor = roundMoney(valorOriginal);
  return {
    percentualJuros: 0,
    valorNegociado: valor,
    entradaValor: 0,
    entradaForma: 'pix',
    periodicidade: 'mensal',
    quantidadeParcelas: 1,
    restanteForma: 'pix',
    dataPrimeiraParcela: dataContatoYmd,
    detalhe: '',
  };
}

function ymdToDateLocal(ymd: string): Date {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function dateToYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addPeriodicidade(ymd: string, indice: number, per: PeriodicidadeNegociacao): string {
  const d = ymdToDateLocal(ymd);
  if (per === 'semanal') d.setDate(d.getDate() + 7 * indice);
  else if (per === 'quinzenal') d.setDate(d.getDate() + 15 * indice);
  else d.setMonth(d.getMonth() + indice);
  return dateToYmd(d);
}

export function rotuloForma(forma: FormaPagamentoNegociacao): string {
  return FORMAS_PAGAMENTO_NEGOCIACAO.find((f) => f.id === forma)?.nome ?? forma;
}

export function rotuloPeriodicidade(per: PeriodicidadeNegociacao): string {
  return PERIODICIDADES_NEGOCIACAO.find((p) => p.id === per)?.nome ?? per;
}

export function moneyBr(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function moneyBrAte4(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function montarParcelasNegociacao(
  state: NegociacaoFormState,
  dataContatoYmd: string,
): ParcelaNegociacao[] {
  const valorNegociado = roundMoney(state.valorNegociado);
  const entrada = roundMoney(Math.max(0, Math.min(state.entradaValor, valorNegociado)));
  const restante = roundMoney(valorNegociado - entrada);
  const out: ParcelaNegociacao[] = [];
  if (entrada > 0.009) {
    out.push({
      n: 1,
      tipo: 'entrada',
      data: dataContatoYmd,
      valor: entrada,
      forma: state.entradaForma,
    });
  }
  if (restante <= 0.009) return out;
  const qtd = Math.max(1, Math.floor(state.quantidadeParcelas) || 1);
  const base = roundMoney(restante / qtd);
  const somaExcetoUltima = roundMoney(base * (qtd - 1));
  const ultima = roundMoney(restante - somaExcetoUltima);
  const data1 = state.dataPrimeiraParcela || dataContatoYmd;
  for (let i = 0; i < qtd; i += 1) {
    out.push({
      n: out.length + 1,
      tipo: 'parcela',
      data: addPeriodicidade(data1, i, state.periodicidade),
      valor: i === qtd - 1 ? ultima : base,
      forma: state.restanteForma,
    });
  }
  return out;
}

export function montarMetaNegociacao(
  state: NegociacaoFormState,
  valorOriginal: number,
  dataContatoYmd: string,
  diasAtraso: number,
): MetaNegociacaoCobranca {
  const juros = calcularJurosMora(valorOriginal, state.percentualJuros, diasAtraso);
  const valorNegociado = roundMoney(state.valorNegociado);
  const entrada = roundMoney(Math.max(0, Math.min(state.entradaValor, valorNegociado)));
  const restante = roundMoney(valorNegociado - entrada);
  const qtd = restante <= 0.009 ? 0 : Math.max(1, Math.floor(state.quantidadeParcelas) || 1);
  return {
    kind: 'negociacao',
    versao: 1,
    valorOriginal: roundMoney(valorOriginal),
    percentualJuros: juros.percentualJuros,
    diasAtraso: juros.diasAtraso,
    jurosPorDia: juros.jurosPorDia,
    valorJuros: juros.valorJuros,
    valorNegociado,
    entrada: { valor: entrada, forma: state.entradaForma },
    restante: {
      valor: restante,
      periodicidade: state.periodicidade,
      quantidadeParcelas: qtd,
      forma: state.restanteForma,
      dataPrimeiraParcela: state.dataPrimeiraParcela || dataContatoYmd,
    },
    parcelas: montarParcelasNegociacao(state, dataContatoYmd),
    observacao: state.detalhe.trim(),
  };
}

export function textoResumoNegociacao(meta: MetaNegociacaoCobranca, detalhe: string): string {
  const linhas: string[] = [
    `Principal: ${moneyBr(meta.valorOriginal)}`,
    meta.percentualJuros > 0
      ? `Juros: ${moneyBr(meta.valorJuros ?? 0)} (${meta.percentualJuros.toLocaleString('pt-BR')}% a.m. · ${meta.diasAtraso.toLocaleString('pt-BR')} dia(s))`
      : `Juros: ${moneyBr(0)}`,
    `Novo valor negociado: ${moneyBr(meta.valorNegociado)}`,
  ];
  if (meta.entrada.valor > 0.009) {
    linhas.push(`Entrada à vista: ${moneyBr(meta.entrada.valor)} via ${rotuloForma(meta.entrada.forma)}`);
  } else {
    linhas.push('Sem entrada');
  }
  if (meta.restante.valor > 0.009 && meta.restante.quantidadeParcelas > 0) {
    const parcelaMedia = roundMoney(meta.restante.valor / meta.restante.quantidadeParcelas);
    linhas.push(
      `Restante: ${meta.restante.quantidadeParcelas}x ${rotuloPeriodicidade(meta.restante.periodicidade).toLowerCase()} de ~${moneyBr(parcelaMedia)} via ${rotuloForma(meta.restante.forma)} (1ª em ${meta.restante.dataPrimeiraParcela.split('-').reverse().join('/')})`,
    );
  }
  const extra = (detalhe.trim() || meta.observacao || '').trim();
  return montarTextoTratativa('Negociar com cliente', 'Acordo', [...linhas, extra].filter(Boolean).join('\n'));
}

export function parseMetaNegociacao(raw: unknown): MetaNegociacaoCobranca | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.kind !== 'negociacao' || o.versao !== 1) return null;
  if (typeof o.valorNegociado !== 'number') return null;
  return raw as MetaNegociacaoCobranca;
}

export function estadoDeMeta(
  meta: MetaNegociacaoCobranca,
  detalhe: string,
  dataContatoYmd: string,
): NegociacaoFormState {
  return {
    percentualJuros: meta.percentualJuros ?? 0,
    valorNegociado: meta.valorNegociado,
    entradaValor: meta.entrada?.valor ?? 0,
    entradaForma: meta.entrada?.forma === 'cartao' ? 'cartao' : 'pix',
    periodicidade: meta.restante?.periodicidade ?? 'mensal',
    quantidadeParcelas: Math.max(1, meta.restante?.quantidadeParcelas || 1),
    restanteForma: meta.restante?.forma === 'cartao' ? 'cartao' : 'pix',
    dataPrimeiraParcela: meta.restante?.dataPrimeiraParcela || dataContatoYmd,
    detalhe: detalhe || meta.observacao || '',
  };
}

export function validarNegociacao(state: NegociacaoFormState): string | null {
  if (!Number.isFinite(state.valorNegociado) || state.valorNegociado <= 0) {
    return 'Informe o valor negociado.';
  }
  if (state.entradaValor < 0) return 'A entrada não pode ser negativa.';
  if (state.entradaValor - state.valorNegociado > 0.009) {
    return 'A entrada não pode ser maior que o valor negociado.';
  }
  const restante = roundMoney(state.valorNegociado - state.entradaValor);
  if (restante > 0.009) {
    const qtd = Math.floor(state.quantidadeParcelas);
    if (!Number.isFinite(qtd) || qtd < 1) return 'Informe a quantidade de parcelas do restante.';
    if (!state.dataPrimeiraParcela) return 'Informe a data da 1ª parcela do restante.';
  }
  return null;
}

export function tipoTratativaPorCategoria(categoriaId: number | null): string {
  return categoriaId === CATEGORIA_NEGOCIAR_ID ? TIPO_TRATATIVA_NEGOCIACAO : TIPO_TRATATIVA_PADRAO;
}

export {
  CATEGORIA_NEGOCIAR_ID,
  FILHO_ACORDO_NEGOCIACAO_ID,
  TIPO_TRATATIVA_NEGOCIACAO,
  TIPO_TRATATIVA_PADRAO,
};
