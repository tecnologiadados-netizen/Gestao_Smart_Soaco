/**
 * Diretrizes comerciais (parcelas após faturamento) + entrada configurável.
 * Retirada “fábrica” = classificação Observacoes === '1-Retirada na So Aço'.
 * Condição de pagamento: extrai dias numéricos do nome cadastrado no Nomus.
 * O prazo concedido é conforme quando não é pior que o pacote da faixa, parcela a parcela:
 * menos parcelas ou dias menores/iguais na mesma posição favorecem a empresa (benigno) e contam como conforme.
 * Entrada no piso da política (alvo − tolerância) ou acima conta como conforme; acima da faixa é benigno.
 * Abaixo do piso é não conforme. Desconto até o teto (ou 4% na retirada Só Aço) também conta como conforme.
 *
 * À vista: em qualquer valor dispensa exigência de % de entrada; prazos de pacote não se aplicam.
 * Acima do limite da faixa 1 (mínimo para parcelamento) também segue assim. Até esse limite (inclusive)
 * → exige condição à vista; parcelamento não permitido.
 */

export type FaixaTicket = 'ate_3000' | 'entre_3001_10000' | 'acima_10000';

export interface PoliticaComercialParams {
  /** Limite superior (R$) da primeira faixa de ticket. */
  limiteFaixa1Reais: number;
  /** Limite superior (R$) da segunda faixa (acima disso = terceira faixa). */
  limiteFaixa2Reais: number;
  diasParcelasFaixa1: number[];
  diasParcelasFaixa2: number[];
  diasParcelasFaixa3: number[];
  /** Entrada alvo em fração (ex.: 0.3 = 30%). */
  pctEntradaAlvo: number;
  /** Tolerância em pontos percentuais em fração (ex.: 0.035 = ±3,5 p.p.). */
  pctEntradaTolerancia: number;
  /** Prazo mínimo (dias) aceito ao extrair números do nome da condição. */
  diasCondicaoMin: number;
  /** Prazo máximo (dias) aceito ao extrair números do nome da condição. */
  diasCondicaoMax: number;
  /**
   * Teto de desconto sobre o valor total, em fração (ex.: 0.05 = 5%).
   * `null` = não avalia desconto, exceto retirada Só Aço (teto de 4%).
   * Desconto menor ou igual ao teto é conforme; maior é descumprimento.
   */
  pctDescontoMaximo: number | null;
}

export const DEFAULT_POLITICA_COMERCIAL: PoliticaComercialParams = {
  limiteFaixa1Reais: 3000,
  limiteFaixa2Reais: 10000,
  diasParcelasFaixa1: [20, 30, 40],
  diasParcelasFaixa2: [30, 45, 60],
  diasParcelasFaixa3: [30, 45, 60, 75],
  pctEntradaAlvo: 0.3,
  pctEntradaTolerancia: 0.035,
  diasCondicaoMin: 8,
  /** Teto para ler dias no nome da condição (ex.: parcelas 210…300); evita ruído de quantidades fora de prazo. */
  diasCondicaoMax: 365,
  pctDescontoMaximo: null,
};

/** Faixas de valor total do pedido (R$), conforme política. */
export function faixaTicket(total: number, politica: PoliticaComercialParams = DEFAULT_POLITICA_COMERCIAL): FaixaTicket {
  if (total <= politica.limiteFaixa1Reais) return 'ate_3000';
  if (total <= politica.limiteFaixa2Reais) return 'entre_3001_10000';
  return 'acima_10000';
}

export function labelFaixa(
  f: FaixaTicket,
  politica: PoliticaComercialParams = DEFAULT_POLITICA_COMERCIAL
): string {
  const f1 = politica.limiteFaixa1Reais;
  const f2 = politica.limiteFaixa2Reais;
  const fmt = (n: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
  switch (f) {
    case 'ate_3000':
      return `Até ${fmt(f1)}`;
    case 'entre_3001_10000':
      return `${fmt(f1 + 1)} – ${fmt(f2)}`;
    default:
      return `Acima de ${fmt(f2)}`;
  }
}

/** Dias esperados para o saldo (parcelas), ordenados, conforme faixa de ticket. */
export function diasEsperadosParcelas(
  total: number,
  politica: PoliticaComercialParams = DEFAULT_POLITICA_COMERCIAL
): number[] {
  if (total <= politica.limiteFaixa1Reais) return [...politica.diasParcelasFaixa1];
  if (total <= politica.limiteFaixa2Reais) return [...politica.diasParcelasFaixa2];
  return [...politica.diasParcelasFaixa3];
}

export function isFormaCartao(forma: string): boolean {
  return /^cart/i.test(String(forma ?? '').trim());
}

export function isCondicaoAVista(nomeCondicao: string): boolean {
  const t = String(nomeCondicao ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (/VISTA|A VISTA|AVISTA|0\s*\+\s*0|SEM\s+PARCELA/i.test(t)) return true;
  if (/\b0\s*\/\s*0\b/.test(t)) return true;
  return false;
}

/**
 * Extrai possíveis dias de vencimento do texto da condição (ex.: "30+45+60", "30 / 45 / 60 DIAS").
 * Ignora números fora do intervalo configurado (evita ano, quantidade, etc.).
 */
export function extrairDiasDaCondicao(
  nomeCondicao: string,
  politica: PoliticaComercialParams = DEFAULT_POLITICA_COMERCIAL
): number[] {
  const t = String(nomeCondicao ?? '');
  const found: number[] = [];
  const re = /\b(\d{2,3})\b/g;
  let m: RegExpExecArray | null;
  const minN = politica.diasCondicaoMin;
  const maxN = politica.diasCondicaoMax;
  while ((m = re.exec(t)) !== null) {
    const n = parseInt(m[1], 10);
    if (n >= minN && n <= maxN) found.push(n);
  }
  return [...new Set(found)].sort((a, b) => a - b);
}

export function arraysDiasIguais(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

/** Média aritmética dos dias de parcela (saldo). Array vazio → 0. */
export function mediaPrazoDias(dias: number[]): number {
  if (!dias.length) return 0;
  return dias.reduce((s, d) => s + d, 0) / dias.length;
}

/**
 * Conforme se o prazo médio do cadastro é ≤ ao da política (referência).
 * Igual ou abaixo → conforme; acima → não conforme.
 */
export function prazoMedioParcelasConforme(obtidos: number[], esperados: number[]): boolean {
  if (!obtidos.length || !esperados.length) return false;
  const mObtidos = mediaPrazoDias(obtidos);
  const mRef = mediaPrazoDias(esperados);
  return mObtidos <= mRef + 1e-9;
}

/** Desconto previsto na retirada Só Aço quando a política não define outro teto. */
export const PCT_DESCONTO_RETIRADA_SO_ACO = 0.04;

/**
 * Prazo concedido não é pior para a empresa do que o pacote da política.
 * Cada parcela do cadastro é comparada à parcela da mesma posição (ordenadas).
 * Menos parcelas é permitido. Parcela extra não pode passar do último dia do pacote.
 */
export function prazoConcedidoNaoPior(obtidos: number[], esperados: number[]): boolean {
  if (!obtidos.length || !esperados.length) return false;
  const o = [...obtidos].sort((a, b) => a - b);
  const e = [...esperados].sort((a, b) => a - b);
  const ultimoPermitido = e[e.length - 1]!;
  for (let i = 0; i < o.length; i++) {
    const limite = i < e.length ? e[i]! : ultimoPermitido;
    if (o[i]! > limite + 1e-9) return false;
  }
  return true;
}

export function pctDescontoPedido(valorTotal: number, valorDesconto: number): number {
  if (!(valorTotal > 0)) return 0;
  return valorDesconto / valorTotal;
}

/** Conforme a partir do piso (alvo − tolerância). Acima da faixa também é conforme. */
export function pctEntradaOk(
  pct: number,
  politica: PoliticaComercialParams = DEFAULT_POLITICA_COMERCIAL
): boolean {
  const alvo = politica.pctEntradaAlvo;
  const tol = politica.pctEntradaTolerancia;
  return pct >= alvo - tol - 1e-9;
}

/** Acima do teto da faixa (alvo + tolerância): mais entrada favorece a empresa. */
export function entradaAcimaDaFaixa(
  pct: number,
  politica: PoliticaComercialParams = DEFAULT_POLITICA_COMERCIAL
): boolean {
  const alvo = politica.pctEntradaAlvo;
  const tol = politica.pctEntradaTolerancia;
  return pct > alvo + tol + 1e-9;
}

/** Retirada na fábrica (Só Aço) — critério único acordado. */
export function isRetiradaSoAco(observacoes: string): boolean {
  return String(observacoes ?? '').trim() === '1-Retirada na So Aço';
}

export type StatusConformidade = 'ok' | 'alerta' | 'nao_conforme' | 'excluido_politica';

export interface AnaliseConformidadePedido {
  entradaOk: boolean;
  /** Acima da faixa de entrada, porém maior — conta como conforme. */
  entradaBenigna: boolean;
  prazosOk: boolean;
  /** Cadastro diferente do pacote, porém prazo menor ou igual — conta como conforme. */
  prazosBenignos: boolean;
  prazosIndeterminados: boolean;
  descontoOk: boolean;
  retiradaSoAco: boolean;
  motivos: string[];
  status: StatusConformidade;
}

export function analisarConformidade(
  input: {
    totalPedido: number;
    somaEntrada: number;
    formaPagamento: string;
    nomeCondicao: string;
    observacoesTipicas: string;
    valorTotal?: number;
    valorDesconto?: number;
  },
  politica: PoliticaComercialParams = DEFAULT_POLITICA_COMERCIAL
): AnaliseConformidadePedido {
  const motivos: string[] = [];
  const cartao = isFormaCartao(input.formaPagamento);
  const aVista = isCondicaoAVista(input.nomeCondicao);
  const retiradaSoAco = isRetiradaSoAco(input.observacoesTipicas);

  if (cartao) {
    return {
      entradaOk: true,
      entradaBenigna: false,
      prazosOk: true,
      prazosBenignos: false,
      prazosIndeterminados: false,
      descontoOk: true,
      retiradaSoAco,
      motivos: ['Cartão: política de parcelas/entrada da tabela não se aplica da mesma forma.'],
      status: 'excluido_politica',
    };
  }

  const total = input.totalPedido;
  const lim1 = politica.limiteFaixa1Reais;
  const pctEntrada = total > 0 ? input.somaEntrada / total : 0;
  /** Condição à vista: não exige percentual mínimo de entrada (política de parcelas não se aplica ao saldo). */
  const entradaOk = total <= 0 ? false : aVista ? true : pctEntradaOk(pctEntrada, politica);
  const entradaBenigna = !aVista && total > 0 && entradaOk && entradaAcimaDaFaixa(pctEntrada, politica);

  if (!entradaOk && total > 0) {
    const piso = (politica.pctEntradaAlvo - politica.pctEntradaTolerancia) * 100;
    motivos.push(
      `Entrada ${(pctEntrada * 100).toFixed(1)}% abaixo do mínimo da política (${piso.toFixed(1)}%, alvo ${(politica.pctEntradaAlvo * 100).toFixed(0)}% − tolerância ${(politica.pctEntradaTolerancia * 100).toFixed(1)} p.p.). Entrada maior que a faixa conta como conforme.`
    );
  } else if (entradaBenigna) {
    motivos.push(
      `Entrada ${(pctEntrada * 100).toFixed(1)}% acima da política (benigno — conta como conforme): esperado ~${(politica.pctEntradaAlvo * 100).toFixed(0)}% do total (tolerância ±${(politica.pctEntradaTolerancia * 100).toFixed(1)} p.p.). Mais entrada favorece a empresa.`
    );
  }

  const esperados = diasEsperadosParcelas(total, politica);
  const obtidos = extrairDiasDaCondicao(input.nomeCondicao, politica);
  let prazosIndeterminados = obtidos.length === 0 && !aVista;
  let prazosOk = true;

  const fmtLim1 = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(lim1);

  if (total > 0 && total <= lim1 && !aVista) {
    prazosOk = false;
    prazosIndeterminados = false;
    motivos.push(
      `Até ${fmtLim1} a política exige condição de pagamento à vista (sem parcelamento após faturamento).`
    );
  } else if (aVista) {
    prazosOk = true;
  } else if (prazosIndeterminados) {
    prazosOk = false;
    motivos.push(
      'Não foi possível inferir os dias de parcelas pelo nome da condição — cadastre números explícitos (ex.: 30+45+60) no Nomus.'
    );
  } else if (!prazoConcedidoNaoPior(obtidos, esperados)) {
    prazosOk = false;
    const fx = faixaTicket(total, politica);
    motivos.push(
      `Prazo acima da política (${labelFaixa(fx, politica)}): cadastro ${fmtParcelas(obtidos)} supera o pacote ${fmtParcelas(esperados)} em alguma parcela. Prazo menor ou com menos parcelas conta como conforme.`
    );
  }

  const prazosBenignos =
    !aVista &&
    total > lim1 &&
    obtidos.length > 0 &&
    prazosOk &&
    !arraysDiasIguais(obtidos, esperados);

  if (prazosBenignos) {
    motivos.push(
      `Prazo menor que a política (benigno — conta como conforme): cadastro ${fmtParcelas(obtidos)}, referência ${fmtParcelas(esperados)}. Menos prazo favorece a empresa.`
    );
  }

  const pctDesconto = pctDescontoPedido(input.valorTotal ?? 0, input.valorDesconto ?? 0);
  const tetoGeral = politica.pctDescontoMaximo;
  const tetoRetirada = retiradaSoAco ? PCT_DESCONTO_RETIRADA_SO_ACO : null;
  const tetoDesconto =
    tetoGeral != null && tetoRetirada != null ? Math.min(tetoGeral, tetoRetirada) : (tetoGeral ?? tetoRetirada);
  let descontoOk = true;
  if (tetoDesconto != null && pctDesconto > tetoDesconto + 1e-9) {
    descontoOk = false;
    const usouTetoRetirada =
      retiradaSoAco && tetoDesconto === PCT_DESCONTO_RETIRADA_SO_ACO && (tetoGeral == null || tetoGeral >= PCT_DESCONTO_RETIRADA_SO_ACO);
    const origem = usouTetoRetirada ? 'da retirada Só Aço' : 'da política';
    motivos.push(
      `Desconto ${(pctDesconto * 100).toFixed(1)}% acima do máximo ${origem} (${(tetoDesconto * 100).toFixed(1)}%). Desconto menor ou igual ao teto conta como conforme.`
    );
  }

  let status: StatusConformidade = 'ok';
  if (total > 0 && total <= lim1 && !aVista) status = 'nao_conforme';
  else if (!entradaOk && total > 0) status = 'nao_conforme';
  else if (!aVista && obtidos.length > 0 && !prazoConcedidoNaoPior(obtidos, esperados)) status = 'nao_conforme';
  else if (!descontoOk) status = 'nao_conforme';
  else if (!aVista && prazosIndeterminados) status = 'alerta';

  return {
    entradaOk,
    entradaBenigna,
    prazosOk: aVista ? true : prazosOk,
    prazosBenignos,
    prazosIndeterminados,
    descontoOk,
    retiradaSoAco,
    motivos,
    status,
  };
}

function fmtParcelas(dias: number[]): string {
  return dias.join('/');
}
