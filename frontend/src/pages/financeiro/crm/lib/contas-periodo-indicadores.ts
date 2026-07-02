import type { ColunaIndicador, ContaFinanceira } from "./types";

export type PeriodoVencimentoConta =
  | "mesAtual"
  | "mesAnterior"
  | "anoAtual"
  | "demaisAnos"
  | "semData";

export interface IndicadorPeriodoConta {
  id: PeriodoVencimentoConta;
  label: string;
  descricao: string;
  quantidade: number;
  valor: number;
}

const PERIODOS: PeriodoVencimentoConta[] = [
  "mesAtual",
  "mesAnterior",
  "anoAtual",
  "demaisAnos",
];

function inicioDoDia(data: Date): Date {
  const copia = new Date(data);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function parseVencimento(dataVencimento: string | null): Date | null {
  if (!dataVencimento) return null;
  const vencimento = inicioDoDia(new Date(dataVencimento));
  return Number.isNaN(vencimento.getTime()) ? null : vencimento;
}

/** Vencimento cai no mês/ano de referência. */
export function venceNoMesAtual(
  dataVencimento: string | null,
  referencia: Date = new Date(),
): boolean {
  const vencimento = parseVencimento(dataVencimento);
  if (!vencimento) return false;
  return (
    vencimento.getFullYear() === referencia.getFullYear() &&
    vencimento.getMonth() === referencia.getMonth()
  );
}

/** Vencimento cai no mês calendário imediatamente anterior. */
export function venceNoMesAnterior(
  dataVencimento: string | null,
  referencia: Date = new Date(),
): boolean {
  const vencimento = parseVencimento(dataVencimento);
  if (!vencimento) return false;

  const mesAnterior = referencia.getMonth() === 0 ? 11 : referencia.getMonth() - 1;
  const anoMesAnterior =
    referencia.getMonth() === 0
      ? referencia.getFullYear() - 1
      : referencia.getFullYear();

  return (
    vencimento.getFullYear() === anoMesAnterior &&
    vencimento.getMonth() === mesAnterior
  );
}

/** Para contas em dia: vencimento no próximo mês calendário. */
export function venceNoProximoMes(
  dataVencimento: string | null,
  referencia: Date = new Date(),
): boolean {
  const vencimento = parseVencimento(dataVencimento);
  if (!vencimento) return false;

  const proximoMes = referencia.getMonth() === 11 ? 0 : referencia.getMonth() + 1;
  const anoProximoMes =
    referencia.getMonth() === 11
      ? referencia.getFullYear() + 1
      : referencia.getFullYear();

  return (
    vencimento.getFullYear() === anoProximoMes &&
    vencimento.getMonth() === proximoMes
  );
}

/** Vencimento no ano de referência (qualquer mês). */
export function venceNoAnoAtual(
  dataVencimento: string | null,
  referencia: Date = new Date(),
): boolean {
  const vencimento = parseVencimento(dataVencimento);
  if (!vencimento) return false;
  return vencimento.getFullYear() === referencia.getFullYear();
}

/** Vencimento no ano calendário imediatamente posterior. */
export function venceNoAnoSeguinte(
  dataVencimento: string | null,
  referencia: Date = new Date(),
): boolean {
  const vencimento = parseVencimento(dataVencimento);
  if (!vencimento) return false;
  return vencimento.getFullYear() === referencia.getFullYear() + 1;
}

export function venceEmAnosAnteriores(
  dataVencimento: string | null,
  referencia: Date = new Date(),
): boolean {
  const vencimento = parseVencimento(dataVencimento);
  if (!vencimento) return false;
  return vencimento.getFullYear() < referencia.getFullYear();
}

export function venceEmAnosPosteriores(
  dataVencimento: string | null,
  referencia: Date = new Date(),
): boolean {
  const vencimento = parseVencimento(dataVencimento);
  if (!vencimento) return false;
  return vencimento.getFullYear() > referencia.getFullYear();
}

function descricoesPorColuna(coluna: ColunaIndicador): Record<
  PeriodoVencimentoConta,
  string
> {
  if (coluna === "emDia") {
    return {
      mesAtual: "Vencimento no mês corrente",
      mesAnterior: "Vencimento no mês seguinte",
      anoAtual: "Vencimento no ano corrente",
      demaisAnos: "Vencimento no ano seguinte",
      semData: "Sem vencimento informado",
    };
  }

  if (coluna === "emAtraso") {
    return {
      mesAtual: "Vencimento no mês corrente",
      mesAnterior: "Vencimento no mês anterior",
      anoAtual: "Vencimento no ano corrente",
      demaisAnos: "Vencimento em anos anteriores",
      semData: "Sem vencimento informado",
    };
  }

  return {
    mesAtual: "Vencimento no mês corrente",
    mesAnterior: "Vencimento no mês anterior",
    anoAtual: "Vencimento no ano corrente",
    demaisAnos: "Vencimento em outros anos",
    semData: "Sem vencimento informado",
  };
}

export function contaPertenceAoPeriodo(
  conta: ContaFinanceira,
  periodo: PeriodoVencimentoConta,
  coluna: ColunaIndicador,
  referencia: Date = new Date(),
): boolean {
  const usaProximoMes = coluna === "emDia";

  switch (periodo) {
    case "mesAtual":
      return venceNoMesAtual(conta.dataVencimento, referencia);
    case "mesAnterior":
      return usaProximoMes
        ? venceNoProximoMes(conta.dataVencimento, referencia)
        : venceNoMesAnterior(conta.dataVencimento, referencia);
    case "anoAtual":
      return venceNoAnoAtual(conta.dataVencimento, referencia);
    case "demaisAnos":
      return usaProximoMes
        ? venceNoAnoSeguinte(conta.dataVencimento, referencia)
        : venceEmAnosAnteriores(conta.dataVencimento, referencia);
    case "semData":
      return parseVencimento(conta.dataVencimento) === null;
    default:
      return true;
  }
}

export function filtrarContasPorPeriodo(
  contas: ContaFinanceira[],
  periodo: PeriodoVencimentoConta,
  coluna: ColunaIndicador,
  referencia: Date = new Date(),
): ContaFinanceira[] {
  return contas.filter((conta) =>
    contaPertenceAoPeriodo(conta, periodo, coluna, referencia),
  );
}

export function calcularIndicadoresPeriodoContas(
  contas: ContaFinanceira[],
  coluna: ColunaIndicador,
  referencia: Date = new Date(),
): IndicadorPeriodoConta[] {
  const descricoes = descricoesPorColuna(coluna);
  const acumulado: Record<PeriodoVencimentoConta, { quantidade: number; valor: number }> =
    {
      mesAtual: { quantidade: 0, valor: 0 },
      mesAnterior: { quantidade: 0, valor: 0 },
      anoAtual: { quantidade: 0, valor: 0 },
      demaisAnos: { quantidade: 0, valor: 0 },
      semData: { quantidade: 0, valor: 0 },
    };

  const usaProximoMes = coluna === "emDia";

  for (const conta of contas) {
    const vencimento = parseVencimento(conta.dataVencimento);
    if (!vencimento) {
      acumulado.semData.quantidade += 1;
      acumulado.semData.valor += conta.valor;
      continue;
    }

    if (venceNoMesAtual(conta.dataVencimento, referencia)) {
      acumulado.mesAtual.quantidade += 1;
      acumulado.mesAtual.valor += conta.valor;
    }

    if (usaProximoMes) {
      if (venceNoProximoMes(conta.dataVencimento, referencia)) {
        acumulado.mesAnterior.quantidade += 1;
        acumulado.mesAnterior.valor += conta.valor;
      }
    } else if (venceNoMesAnterior(conta.dataVencimento, referencia)) {
      acumulado.mesAnterior.quantidade += 1;
      acumulado.mesAnterior.valor += conta.valor;
    }

    if (venceNoAnoAtual(conta.dataVencimento, referencia)) {
      acumulado.anoAtual.quantidade += 1;
      acumulado.anoAtual.valor += conta.valor;
    }

    const demaisAnos = usaProximoMes
      ? venceNoAnoSeguinte(conta.dataVencimento, referencia)
      : venceEmAnosAnteriores(conta.dataVencimento, referencia);

    if (demaisAnos) {
      acumulado.demaisAnos.quantidade += 1;
      acumulado.demaisAnos.valor += conta.valor;
    }
  }

  const labels = labelsPorColuna(coluna);

  return PERIODOS.map((id) => ({
    id,
    label: labels[id],
    descricao: descricoes[id],
    quantidade: acumulado[id].quantidade,
    valor: acumulado[id].valor,
  }));
}

function labelsPorColuna(
  coluna: ColunaIndicador,
): Record<PeriodoVencimentoConta, string> {
  if (coluna === "emDia") {
    return {
      mesAtual: "A receber no mês atual",
      mesAnterior: "A receber no mês seguinte",
      anoAtual: "A receber no ano atual",
      demaisAnos: "A receber no ano seguinte",
      semData: "Sem vencimento",
    };
  }

  if (coluna === "emAtraso") {
    return {
      mesAtual: "Inad. mês atual",
      mesAnterior: "Inad. mês anterior",
      anoAtual: "Inad. ano atual",
      demaisAnos: "Inad. demais anos",
      semData: "Sem vencimento",
    };
  }

  return {
    mesAtual: "Ind. mês atual",
    mesAnterior: "Ind. mês anterior",
    anoAtual: "Ind. ano atual",
    demaisAnos: "Ind. demais anos",
    semData: "Sem vencimento",
  };
}

export function labelPeriodoConta(
  coluna: ColunaIndicador,
  periodo: PeriodoVencimentoConta,
): string {
  return labelsPorColuna(coluna)[periodo];
}

export function exibirIndicadoresPeriodoContas(coluna: ColunaIndicador): boolean {
  return coluna === "emAtraso" || coluna === "emDia" || coluna === "total";
}
