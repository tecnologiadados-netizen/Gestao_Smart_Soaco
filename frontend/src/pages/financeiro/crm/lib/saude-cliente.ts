import type { ContaFinanceira, IndicadoresResumo, Recebimento } from "../lib/types";
import {
  filtrarRecebimentosComTotalDias,
  isRecebimentoDesconsideradoPorDiaNaoUtil,
  isRecebimentoEfetivamenteAtrasado,
  isRecebimentoNoPrazoEfetivo,
} from "../lib/atraso-recebimento";
import { formatCurrency, formatNumber } from "../lib/formatters";

export const PESOS_SAUDE = {
  situacaoAtual: 0.28,
  pontualidade: 0.33,
  jurosAtraso: 0.28,
  severidade: 0.11,
} as const;

export type FaixaSaude = "excelente" | "bom" | "atencao" | "critico";

export interface FaixaSaudeInfo {
  faixa: FaixaSaude;
  rotulo: string;
  emoji: string;
}

export interface PilarDetalheItem {
  rotulo: string;
  valor: string;
}

export interface PilarDetalhes {
  resumo: string;
  itens: PilarDetalheItem[];
}

export interface PilarSaude {
  id: keyof typeof PESOS_SAUDE;
  legenda: string;
  descricao: string;
  score: number;
  peso: number;
  faixa: FaixaSaudeInfo;
  detalhes: PilarDetalhes;
}

export interface MediaGeralDetalhes {
  resumo: string;
  itens: PilarDetalheItem[];
}

export const DESCRICAO_MEDIA_GERAL =
  "Média aritmética dos quatro indicadores de saúde do cliente.";

export const DESCRICAO_MEDIA_GERAL_EMPRESA =
  "Média aritmética dos três indicadores de saúde do quadro de contas a receber.";

export interface SaudeClienteOptions {
  excluirSeveridade?: boolean;
  usarDetalhesAgregados?: boolean;
}

export interface SaudeClienteResult {
  pilares: PilarSaude[];
  mediaGeral: number;
  faixaGeral: FaixaSaudeInfo;
  detalhesMediaGeral: MediaGeralDetalhes;
}

export interface SaudeClienteInput {
  indicadoresReceber: IndicadoresResumo;
  contasReceberAtraso: ContaFinanceira[];
  contasReceberEmDia: ContaFinanceira[];
  recebimentos: Recebimento[];
}

export interface ResumoRecebimentosSaude {
  totalComPrazo: number;
  noPrazoEfetivo: number;
  atrasadosEfetivos: number;
  desconsiderados: number;
  atrasadosComJuros: number;
  atrasadosSemJuros: number;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function roundScore(score: number): number {
  return Math.round(clampScore(score));
}

export function getFaixaSaude(score: number): FaixaSaudeInfo {
  const s = clampScore(score);

  if (s >= 80) {
    return { faixa: "excelente", rotulo: "Excelente", emoji: "😊" };
  }
  if (s >= 60) {
    return { faixa: "bom", rotulo: "Bom", emoji: "🙂" };
  }
  if (s >= 40) {
    return { faixa: "atencao", rotulo: "Atenção", emoji: "😐" };
  }
  return { faixa: "critico", rotulo: "Crítico", emoji: "😟" };
}

/** Pilar 1 — Situação atual em aberto (Em atraso vs Em dia). */
export function calcPilarSituacaoAtual(indicadores: IndicadoresResumo): number {
  const { emAtraso, emDia } = indicadores;
  const total = emAtraso + emDia;
  if (total <= 0) return 100;
  return 100 * (1 - emAtraso / total);
}

/** Pilar 1 para cliente filtrado — usa as contas abertas reais, incluindo TITULO DESCONTADO. */
export function calcPilarSituacaoAtualContas(
  contasAtraso: ContaFinanceira[],
  contasEmDia: ContaFinanceira[],
): number {
  const total = contasAtraso.length + contasEmDia.length;
  if (total <= 0) return 100;
  return (100 * contasEmDia.length) / total;
}

/** Pilar 2 — Pontualidade histórica (total dias efetivo ≥ 0 = no prazo). */
export function calcPilarPontualidade(recebimentos: Recebimento[]): number {
  const comTotalDias = filtrarRecebimentosComTotalDias(recebimentos);
  if (comTotalDias.length === 0) return 100;
  const noPrazo = comTotalDias.filter(isRecebimentoNoPrazoEfetivo).length;
  return (100 * noPrazo) / comTotalDias.length;
}

/** Pilar 3 — Juros em atraso (% efetivamente atrasados com valorJuros > 0). */
export function calcPilarJurosAtraso(recebimentos: Recebimento[]): number {
  const atrasados = recebimentos.filter(isRecebimentoEfetivamenteAtrasado);
  if (atrasados.length === 0) return 100;
  const comJuros = atrasados.filter((r) => r.valorJuros > 0).length;
  return (100 * comJuros) / atrasados.length;
}

/** Pilar 4 — Severidade do atraso aberto (maior diasAtraso em contas vencidas). */
export function calcPilarSeveridade(contasAtraso: ContaFinanceira[]): number {
  if (contasAtraso.length === 0) return 100;
  const maiorDias = Math.max(...contasAtraso.map((c) => c.diasAtraso));
  return Math.max(0, 100 - 2 * maiorDias);
}

function pluralConta(qtd: number): string {
  return qtd === 1 ? "conta" : "contas";
}

function pluralRecebimento(qtd: number): string {
  return qtd === 1 ? "recebimento" : "recebimentos";
}

function pluralPagamento(qtd: number): string {
  return qtd === 1 ? "pagamento atrasado" : "pagamentos atrasados";
}

function formatCount(value: number): string {
  return formatNumber(value);
}

function buildDetalhesSituacaoAtualAgregado(
  indicadores: IndicadoresResumo,
): PilarDetalhes {
  const { emAtraso, emDia } = indicadores;
  const total = emAtraso + emDia;

  if (total <= 0) {
    return {
      resumo: "Nenhuma conta em aberto no momento.",
      itens: [
        { rotulo: "Saldo em atraso", valor: formatCurrency(0) },
        { rotulo: "Saldo a vencer", valor: formatCurrency(0) },
        { rotulo: "Total em aberto", valor: formatCurrency(0) },
      ],
    };
  }

  const pctEmDia = Math.round((100 * emDia) / total);

  return {
    resumo: `${formatCurrency(emDia)} a vencer (${pctEmDia}%) de ${formatCurrency(total)} em aberto.`,
    itens: [
      { rotulo: "Saldo em atraso", valor: formatCurrency(emAtraso) },
      { rotulo: "Saldo a vencer", valor: formatCurrency(emDia) },
      { rotulo: "Total em aberto", valor: formatCurrency(total) },
    ],
  };
}

function buildDetalhesSituacaoAtual(
  contasAtraso: ContaFinanceira[],
  contasEmDia: ContaFinanceira[],
): PilarDetalhes {
  const qtdVencidas = contasAtraso.length;
  const qtdEmDia = contasEmDia.length;
  const qtdAberto = qtdVencidas + qtdEmDia;
  const valorAtraso = contasAtraso.reduce((acc, conta) => acc + conta.valor, 0);
  const valorEmDia = contasEmDia.reduce((acc, conta) => acc + conta.valor, 0);
  const valorTotal = valorAtraso + valorEmDia;

  if (qtdAberto === 0) {
    return {
      resumo: "Nenhuma conta em aberto no momento.",
      itens: [
        { rotulo: "Contas vencidas", valor: "0" },
        { rotulo: "Contas a vencer", valor: "0" },
        { rotulo: "Saldo pendente", valor: formatCurrency(0) },
      ],
    };
  }

  return {
    resumo: `${formatCount(qtdEmDia)} ${pluralConta(qtdEmDia)} a vencer de ${formatCount(qtdAberto)} em aberto.`,
    itens: [
      {
        rotulo: "Contas vencidas",
        valor: `${formatCount(qtdVencidas)} ${pluralConta(qtdVencidas)} (${formatCurrency(valorAtraso)})`,
      },
      {
        rotulo: "Contas a vencer",
        valor: `${formatCount(qtdEmDia)} ${pluralConta(qtdEmDia)} (${formatCurrency(valorEmDia)})`,
      },
      {
        rotulo: "Total em aberto",
        valor: `${formatCount(qtdAberto)} ${pluralConta(qtdAberto)} (${formatCurrency(valorTotal)})`,
      },
    ],
  };
}

function buildDetalhesPontualidade(recebimentos: Recebimento[]): PilarDetalhes {
  const comTotalDias = filtrarRecebimentosComTotalDias(recebimentos);
  const noPrazo = comTotalDias.filter(isRecebimentoNoPrazoEfetivo);
  const atrasados = comTotalDias.filter(isRecebimentoEfetivamenteAtrasado);
  const desconsiderados = comTotalDias.filter(
    isRecebimentoDesconsideradoPorDiaNaoUtil,
  );

  if (comTotalDias.length === 0) {
    return {
      resumo: "Nenhum recebimento com prazo calculado no histórico.",
      itens: [
        { rotulo: "Recebimentos analisados", valor: "0" },
        { rotulo: "Pagos no prazo", valor: "0" },
        { rotulo: "Pagos com atraso", valor: "0" },
      ],
    };
  }

  const itens: PilarDetalheItem[] = [
    {
      rotulo: "Recebimentos analisados",
      valor: formatCount(comTotalDias.length),
    },
    {
      rotulo: "Pagos no prazo (regra efetiva)",
      valor: formatCount(noPrazo.length),
    },
    {
      rotulo: "Pagos com atraso efetivo",
      valor: formatCount(atrasados.length),
    },
  ];

  if (desconsiderados.length > 0) {
    itens.push({
      rotulo: "Desconsiderados (venc. sáb/dom/feriado NE)",
      valor: formatCount(desconsiderados.length),
    });
  }

  return {
    resumo: `${formatCount(noPrazo.length)} de ${formatCount(comTotalDias.length)} ${pluralRecebimento(comTotalDias.length)} pagos no prazo.`,
    itens,
  };
}

function buildDetalhesJurosAtraso(recebimentos: Recebimento[]): PilarDetalhes {
  const comTotalDias = filtrarRecebimentosComTotalDias(recebimentos);
  const totalAtrasos = comTotalDias.filter((r) => r.totalDias! < 0);
  const atrasadosEfetivos = comTotalDias.filter(isRecebimentoEfetivamenteAtrasado);
  const desconsiderados = comTotalDias.filter(
    isRecebimentoDesconsideradoPorDiaNaoUtil,
  );
  const comJuros = atrasadosEfetivos.filter((r) => r.valorJuros > 0);
  const semJuros = atrasadosEfetivos.length - comJuros.length;

  const itensBase: PilarDetalheItem[] = [
    {
      rotulo: 'Total de "atrasos"',
      valor: formatCount(totalAtrasos.length),
    },
    {
      rotulo: 'Total de atrasos "desconsiderados"',
      valor: formatCount(desconsiderados.length),
    },
    {
      rotulo: "Total de atrasos efetivos para o indicador",
      valor: formatCount(atrasadosEfetivos.length),
    },
  ];

  if (atrasadosEfetivos.length === 0) {
    return {
      resumo:
        desconsiderados.length > 0
          ? `Nenhum atraso efetivo — score 100%. ${formatCount(desconsiderados.length)} de ${formatCount(totalAtrasos.length)} atrasos desconsiderados.`
          : "Nenhum recebimento atrasado no histórico — score 100%.",
      itens: [
        ...itensBase,
        { rotulo: "Com juros pagos (valor > 0)", valor: "0" },
        { rotulo: "Sem juros pagos", valor: "0" },
      ],
    };
  }

  const percentual = Math.round((100 * comJuros.length) / atrasadosEfetivos.length);

  return {
    resumo: `${formatCount(comJuros.length)} de ${formatCount(atrasadosEfetivos.length)} atrasos efetivos pagaram juros -> ${percentual}%.`,
    itens: [
      ...itensBase,
      {
        rotulo: "Com juros pagos (valor > 0)",
        valor: formatCount(comJuros.length),
      },
      {
        rotulo: "Sem juros pagos",
        valor: formatCount(semJuros),
      },
    ],
  };
}

function buildDetalhesPontualidadeResumo(
  resumo: ResumoRecebimentosSaude,
): PilarDetalhes {
  if (resumo.totalComPrazo <= 0) {
    return {
      resumo: "Nenhum recebimento com prazo calculado no histórico.",
      itens: [
        { rotulo: "Recebimentos analisados", valor: "0" },
        { rotulo: "Pagos no prazo", valor: "0" },
        { rotulo: "Pagos com atraso", valor: "0" },
      ],
    };
  }

  const itens: PilarDetalheItem[] = [
    {
      rotulo: "Recebimentos analisados",
      valor: formatCount(resumo.totalComPrazo),
    },
    {
      rotulo: "Pagos no prazo (regra efetiva)",
      valor: formatCount(resumo.noPrazoEfetivo),
    },
    {
      rotulo: "Pagos com atraso efetivo",
      valor: formatCount(resumo.atrasadosEfetivos),
    },
  ];

  if (resumo.desconsiderados > 0) {
    itens.push({
      rotulo: "Desconsiderados (venc. sáb/dom/feriado NE)",
      valor: formatCount(resumo.desconsiderados),
    });
  }

  return {
    resumo: `${formatCount(resumo.noPrazoEfetivo)} de ${formatCount(resumo.totalComPrazo)} ${pluralRecebimento(resumo.totalComPrazo)} pagos no prazo.`,
    itens,
  };
}

function buildDetalhesJurosAtrasoResumo(
  resumo: ResumoRecebimentosSaude,
): PilarDetalhes {
  const totalAtrasos = resumo.atrasadosEfetivos;

  if (totalAtrasos === 0) {
    return {
      resumo: "Nenhum pagamento em atraso no histórico.",
      itens: [
        { rotulo: "Pagamentos atrasados", valor: "0" },
        { rotulo: "Com juros pagos", valor: "0" },
        { rotulo: "Sem juros pagos", valor: "0" },
      ],
    };
  }

  return {
    resumo: `${formatCount(resumo.atrasadosComJuros)} de ${formatCount(totalAtrasos)} ${pluralPagamento(totalAtrasos)} tiveram juros pagos.`,
    itens: [
      {
        rotulo: "Pagamentos efetivamente atrasados",
        valor: formatCount(totalAtrasos),
      },
      {
        rotulo: "Com juros pagos (valor > 0)",
        valor: formatCount(resumo.atrasadosComJuros),
      },
      {
        rotulo: "Sem juros pagos",
        valor: formatCount(resumo.atrasadosSemJuros),
      },
    ],
  };
}

function buildDetalhesSeveridade(contasAtraso: ContaFinanceira[]): PilarDetalhes {
  if (contasAtraso.length === 0) {
    return {
      resumo: "Nenhuma conta vencida em aberto.",
      itens: [
        { rotulo: "Contas vencidas abertas", valor: "0" },
        { rotulo: "Maior atraso", valor: "0 dias" },
      ],
    };
  }

  const maiorDias = Math.max(...contasAtraso.map((c) => c.diasAtraso));
  const piores = contasAtraso.filter((c) => c.diasAtraso === maiorDias);

  return {
    resumo: `Pior pendência: ${formatCount(maiorDias)} dias em atraso.`,
    itens: [
      {
        rotulo: "Contas vencidas abertas",
        valor: formatCount(contasAtraso.length),
      },
      {
        rotulo: "Maior atraso",
        valor: `${formatCount(maiorDias)} dias`,
      },
      {
        rotulo:
          piores.length === 1 ? "Conta mais atrasada" : "Contas no pior atraso",
        valor:
          piores.length === 1
            ? `#${piores[0]!.codigo} (${formatCurrency(piores[0]!.valor)})`
            : `${formatCount(piores.length)} ${pluralConta(piores.length)}`,
      },
    ],
  };
}

function buildDetalhesMediaGeral(pilares: PilarSaude[], mediaGeral: number): MediaGeralDetalhes {
  const soma = pilares.reduce((acc, pilar) => acc + pilar.score, 0);

  return {
    resumo: `Média aritmética: (${pilares.map((p) => p.score).join(" + ")}) ÷ ${pilares.length} = ${mediaGeral}%.`,
    itens: [
      ...pilares.map((pilar) => ({
        rotulo: pilar.legenda,
        valor: `${pilar.score}%`,
      })),
      {
        rotulo: "Soma dos indicadores",
        valor: formatCount(soma),
      },
      {
        rotulo: "Média final",
        valor: `${mediaGeral}%`,
      },
    ],
  };
}

export function calcularSaudeCliente(
  input: SaudeClienteInput,
  options?: SaudeClienteOptions,
): SaudeClienteResult {
  const excluirSeveridade = options?.excluirSeveridade ?? false;
  const usarDetalhesAgregados = options?.usarDetalhesAgregados ?? false;

  const scores = {
    situacaoAtual: roundScore(
      usarDetalhesAgregados
        ? calcPilarSituacaoAtual(input.indicadoresReceber)
        : calcPilarSituacaoAtualContas(
            input.contasReceberAtraso,
            input.contasReceberEmDia,
          ),
    ),
    pontualidade: roundScore(calcPilarPontualidade(input.recebimentos)),
    jurosAtraso: roundScore(calcPilarJurosAtraso(input.recebimentos)),
    severidade: roundScore(calcPilarSeveridade(input.contasReceberAtraso)),
  };

  const pilares: PilarSaude[] = [
    {
      id: "situacaoAtual",
      legenda: "Situação atual em aberto",
      descricao: "Do saldo pendente, quanto temos a vencer?",
      score: scores.situacaoAtual,
      peso: PESOS_SAUDE.situacaoAtual,
      faixa: getFaixaSaude(scores.situacaoAtual),
      detalhes: usarDetalhesAgregados
        ? buildDetalhesSituacaoAtualAgregado(input.indicadoresReceber)
        : buildDetalhesSituacaoAtual(
            input.contasReceberAtraso,
            input.contasReceberEmDia,
          ),
    },
    {
      id: "pontualidade",
      legenda: "Pontualidade histórica",
      descricao: "Quantos recebimentos foram pagos no prazo?",
      score: scores.pontualidade,
      peso: PESOS_SAUDE.pontualidade,
      faixa: getFaixaSaude(scores.pontualidade),
      detalhes: buildDetalhesPontualidade(input.recebimentos),
    },
    {
      id: "jurosAtraso",
      legenda: "Juros sobre atraso",
      descricao:
        "Dos pagamentos efetivamente atrasados, quantos pagaram juros?",
      score: scores.jurosAtraso,
      peso: PESOS_SAUDE.jurosAtraso,
      faixa: getFaixaSaude(scores.jurosAtraso),
      detalhes: buildDetalhesJurosAtraso(input.recebimentos),
    },
  ];

  if (!excluirSeveridade) {
    pilares.push({
      id: "severidade",
      legenda: "Severidade do atraso aberto",
      descricao: "Há quantos dias está a pior pendência vencida?",
      score: scores.severidade,
      peso: PESOS_SAUDE.severidade,
      faixa: getFaixaSaude(scores.severidade),
      detalhes: buildDetalhesSeveridade(input.contasReceberAtraso),
    });
  }

  const mediaBruta =
    pilares.reduce((acc, pilar) => acc + pilar.score, 0) / pilares.length;

  const mediaGeral = roundScore(mediaBruta);

  return {
    pilares,
    mediaGeral,
    faixaGeral: getFaixaSaude(mediaGeral),
    detalhesMediaGeral: buildDetalhesMediaGeral(pilares, mediaGeral),
  };
}

export function calcularSaudeEmpresaComResumo(
  indicadoresReceber: IndicadoresResumo,
  resumoRecebimentos: ResumoRecebimentosSaude,
): SaudeClienteResult {
  const pontualidade =
    resumoRecebimentos.totalComPrazo <= 0
      ? 100
      : (100 * resumoRecebimentos.noPrazoEfetivo) /
        resumoRecebimentos.totalComPrazo;
  const jurosAtraso =
    resumoRecebimentos.atrasadosEfetivos <= 0
      ? 100
      : (100 * resumoRecebimentos.atrasadosComJuros) /
        resumoRecebimentos.atrasadosEfetivos;

  const scores = {
    situacaoAtual: roundScore(calcPilarSituacaoAtual(indicadoresReceber)),
    pontualidade: roundScore(pontualidade),
    jurosAtraso: roundScore(jurosAtraso),
  };

  const pilares: PilarSaude[] = [
    {
      id: "situacaoAtual",
      legenda: "Situação atual em aberto",
      descricao: "Do saldo pendente, quanto temos a vencer?",
      score: scores.situacaoAtual,
      peso: PESOS_SAUDE.situacaoAtual,
      faixa: getFaixaSaude(scores.situacaoAtual),
      detalhes: buildDetalhesSituacaoAtualAgregado(indicadoresReceber),
    },
    {
      id: "pontualidade",
      legenda: "Pontualidade histórica",
      descricao: "Quantos recebimentos foram pagos no prazo?",
      score: scores.pontualidade,
      peso: PESOS_SAUDE.pontualidade,
      faixa: getFaixaSaude(scores.pontualidade),
      detalhes: buildDetalhesPontualidadeResumo(resumoRecebimentos),
    },
    {
      id: "jurosAtraso",
      legenda: "Juros sobre atraso",
      descricao:
        "Dos pagamentos efetivamente atrasados, quantos pagaram juros?",
      score: scores.jurosAtraso,
      peso: PESOS_SAUDE.jurosAtraso,
      faixa: getFaixaSaude(scores.jurosAtraso),
      detalhes: buildDetalhesJurosAtrasoResumo(resumoRecebimentos),
    },
  ];

  const mediaBruta =
    pilares.reduce((acc, pilar) => acc + pilar.score, 0) / pilares.length;
  const mediaGeral = roundScore(mediaBruta);

  return {
    pilares,
    mediaGeral,
    faixaGeral: getFaixaSaude(mediaGeral),
    detalhesMediaGeral: buildDetalhesMediaGeral(pilares, mediaGeral),
  };
}
