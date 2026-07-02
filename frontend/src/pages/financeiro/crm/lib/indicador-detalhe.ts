import { filtrarRecebimentosSemTituloDescontado } from "./titulo-descontado";
import type {
  ColunaIndicador,
  ContaFinanceira,
  DashboardDetalhesData,
  Recebimento,
} from "./types";

export const COLUNA_INDICADOR_LABEL: Record<ColunaIndicador, string> = {
  total: "Total pendente",
  emAtraso: "Em atraso",
  emDia: "A vencer",
  recebido30d: "Últimos 30 dias",
  recebido90d: "Últimos 90 dias",
  recebidoAno: "Último ano",
  recebidoHistorico: "Total histórico",
};

export function isColunaContas(coluna: ColunaIndicador): boolean {
  return coluna === "total" || coluna === "emAtraso" || coluna === "emDia";
}

function filtrarPorClassificacao<T extends { classificacao: string | null }>(
  items: T[],
  classificacao: string | null,
): T[] {
  if (!classificacao) return items;
  return items.filter(
    (item) => (item.classificacao ?? "Sem classificação") === classificacao,
  );
}

export function recebimentosParaRecuperado(
  detalhes: DashboardDetalhesData,
  tipo: "receber" | "pagar",
  classificacao: string | null,
): Recebimento[] {
  const recebimentos =
    tipo === "receber" ? detalhes.recebimentos : detalhes.pagamentos;
  return filtrarRecebimentosSemTituloDescontado(
    filtrarPorClassificacao(recebimentos, classificacao),
  );
}

function filtrarRecebimentosPorPeriodo(
  recebimentos: Recebimento[],
  coluna: ColunaIndicador,
): Recebimento[] {
  if (coluna === "recebidoHistorico") return recebimentos;

  const dias =
    coluna === "recebido30d" ? 30 : coluna === "recebido90d" ? 90 : 365;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - dias);

  return recebimentos.filter((item) => {
    if (!item.dataRecebimento) return false;
    const data = new Date(item.dataRecebimento);
    data.setHours(0, 0, 0, 0);
    return data >= cutoff;
  });
}

export function filtrarDetalheLocal(
  detalhes: DashboardDetalhesData,
  tipo: "receber" | "pagar",
  coluna: ColunaIndicador,
  classificacao: string | null,
): { modo: "contas"; dados: ContaFinanceira[] } | { modo: "recebimentos"; dados: Recebimento[] } {
  if (isColunaContas(coluna)) {
    const atraso =
      tipo === "receber"
        ? detalhes.contasReceberAtraso
        : detalhes.contasPagarAtraso;
    const emDia =
      tipo === "receber"
        ? detalhes.contasReceberEmDia
        : detalhes.contasPagarEmDia;

    let contas: ContaFinanceira[];
    if (coluna === "total") {
      contas = [...atraso, ...emDia];
    } else if (coluna === "emAtraso") {
      contas = atraso;
    } else {
      contas = emDia;
    }

    return {
      modo: "contas",
      dados: filtrarPorClassificacao(contas, classificacao),
    };
  }

  const recebimentos =
    tipo === "receber" ? detalhes.recebimentos : detalhes.pagamentos;

  const filtrados = filtrarPorClassificacao(recebimentos, classificacao);
  return {
    modo: "recebimentos",
    dados: filtrarRecebimentosSemTituloDescontado(
      filtrarRecebimentosPorPeriodo(filtrados, coluna),
    ),
  };
}

export function tituloModalDetalhe(
  tipo: "receber" | "pagar",
  coluna: ColunaIndicador,
): string {
  const grupo =
    tipo === "receber"
      ? isColunaContas(coluna)
        ? "Contas a receber"
        : "Recebimentos"
      : isColunaContas(coluna)
        ? "Contas a pagar"
        : "Pagamentos";

  return `${grupo} — ${COLUNA_INDICADOR_LABEL[coluna]}`;
}

export function destaqueModalDetalhe(
  coluna: ColunaIndicador,
): "danger" | "success" | "default" {
  if (coluna === "emAtraso") return "danger";
  if (coluna === "emDia") return "success";
  return "default";
}
