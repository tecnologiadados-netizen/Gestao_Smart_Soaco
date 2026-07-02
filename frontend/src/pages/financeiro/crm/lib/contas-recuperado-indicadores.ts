import type { PeriodoVencimentoConta, IndicadorPeriodoConta } from "./contas-periodo-indicadores";
import {
  venceEmAnosAnteriores,
  venceNoAnoAtual,
  venceNoMesAnterior,
  venceNoMesAtual,
} from "./contas-periodo-indicadores";
import type { Recebimento } from "./types";

const PERIODOS: PeriodoVencimentoConta[] = [
  "mesAtual",
  "mesAnterior",
  "anoAtual",
  "demaisAnos",
];

const LABELS: Record<PeriodoVencimentoConta, string> = {
  mesAtual: "Recuperado mês atual",
  mesAnterior: "Recuperado mês anterior",
  anoAtual: "Recuperado ano atual",
  demaisAnos: "Recuperado demais anos",
  semData: "Sem data de recebimento",
};

const DESCRICOES: Record<PeriodoVencimentoConta, string> = {
  mesAtual: "Vencimento e recebimento no mês corrente (após vencimento)",
  mesAnterior: "Vencimento e recebimento no mês anterior (após vencimento)",
  anoAtual: "Vencimento e recebimento no ano corrente (após vencimento)",
  demaisAnos: "Vencimento e recebimento em anos anteriores (após vencimento)",
  semData: "Sem data de recebimento",
};

/** Pagamento efetuado após a data de vencimento. */
export function isRecuperado(recebimento: Recebimento): boolean {
  if (!recebimento.dataRecebimento || !recebimento.dataVencimento) {
    return false;
  }

  if (recebimento.totalDias != null && recebimento.totalDias < 0) {
    return true;
  }

  const vencimento = new Date(recebimento.dataVencimento);
  const recebimentoData = new Date(recebimento.dataRecebimento);
  vencimento.setHours(0, 0, 0, 0);
  recebimentoData.setHours(0, 0, 0, 0);

  if (Number.isNaN(vencimento.getTime()) || Number.isNaN(recebimentoData.getTime())) {
    return false;
  }

  return recebimentoData > vencimento;
}

/** Vencimento e recebimento no mesmo período calendário (inadimplência + recuperação). */
function vencimentoERecebimentoNoPeriodo(
  dataVencimento: string,
  dataRecebimento: string,
  periodo: PeriodoVencimentoConta,
  referencia: Date,
): boolean {
  switch (periodo) {
    case "mesAtual":
      return (
        venceNoMesAtual(dataVencimento, referencia) &&
        venceNoMesAtual(dataRecebimento, referencia)
      );
    case "mesAnterior":
      return (
        venceNoMesAnterior(dataVencimento, referencia) &&
        venceNoMesAnterior(dataRecebimento, referencia)
      );
    case "anoAtual":
      return (
        venceNoAnoAtual(dataVencimento, referencia) &&
        venceNoAnoAtual(dataRecebimento, referencia)
      );
    case "demaisAnos":
      return (
        venceEmAnosAnteriores(dataVencimento, referencia) &&
        venceEmAnosAnteriores(dataRecebimento, referencia)
      );
    default:
      return false;
  }
}

export function recebimentoRecuperadoNoPeriodo(
  recebimento: Recebimento,
  periodo: PeriodoVencimentoConta,
  referencia: Date = new Date(),
): boolean {
  if (
    !isRecuperado(recebimento) ||
    !recebimento.dataRecebimento ||
    !recebimento.dataVencimento
  ) {
    return false;
  }

  return vencimentoERecebimentoNoPeriodo(
    recebimento.dataVencimento,
    recebimento.dataRecebimento,
    periodo,
    referencia,
  );
}

export function filtrarRecuperadosPorPeriodo(
  recebimentos: Recebimento[],
  periodo: PeriodoVencimentoConta,
  referencia: Date = new Date(),
): Recebimento[] {
  return recebimentos.filter((item) =>
    recebimentoRecuperadoNoPeriodo(item, periodo, referencia),
  );
}

export function calcularIndicadoresRecuperado(
  recebimentos: Recebimento[],
  referencia: Date = new Date(),
): IndicadorPeriodoConta[] {
  const acumulado: Record<
    PeriodoVencimentoConta,
    { quantidade: number; valor: number }
  > = {
    mesAtual: { quantidade: 0, valor: 0 },
    mesAnterior: { quantidade: 0, valor: 0 },
    anoAtual: { quantidade: 0, valor: 0 },
    demaisAnos: { quantidade: 0, valor: 0 },
    semData: { quantidade: 0, valor: 0 },
  };

  for (const recebimento of recebimentos) {
    if (!isRecuperado(recebimento)) continue;

    for (const periodo of PERIODOS) {
      if (recebimentoRecuperadoNoPeriodo(recebimento, periodo, referencia)) {
        acumulado[periodo].quantidade += 1;
        acumulado[periodo].valor += recebimento.valorRecebido;
      }
    }
  }

  return PERIODOS.map((id) => ({
    id,
    label: LABELS[id],
    descricao: DESCRICOES[id],
    quantidade: acumulado[id].quantidade,
    valor: acumulado[id].valor,
  }));
}

export function labelPeriodoRecuperado(periodo: PeriodoVencimentoConta): string {
  return LABELS[periodo];
}

export function exibirIndicadoresRecuperado(
  coluna: string,
  tipo: "receber" | "pagar",
): boolean {
  return coluna === "emAtraso" && tipo === "receber";
}
