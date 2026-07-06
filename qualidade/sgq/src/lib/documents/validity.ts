import { addDays, differenceInDays, parseISO, startOfDay } from "date-fns";
import type { DueStatus } from "@/types/calibration";
import type {
  Document,
  DocumentValidadeAlerta,
  ValidadeMarcoDias,
} from "@/types/document";

export const MARCOS_ALERTA_VALIDADE: ValidadeMarcoDias[] = [
  30, 20, 10, 5, 3, 1, 0,
];

export function calcularDiasRestantesValidade(
  dataValidade: string | undefined,
  referencia: Date = new Date()
): number | null {
  if (!dataValidade) return null;
  return differenceInDays(
    startOfDay(parseISO(dataValidade)),
    startOfDay(referencia)
  );
}

export function calcularValidadeStatus(
  diasRestantes: number | null
): DueStatus | null {
  if (diasRestantes === null) return null;
  if (diasRestantes <= 0) return "vencido";
  if (diasRestantes <= 30) return "proximo";
  return "em_dia";
}

export function calcularProximaDataValidade(
  fromIso: string,
  periodoDias: number
): string {
  return addDays(parseISO(fromIso), periodoDias).toISOString();
}

export function severidadeAlertaValidade(
  marco: ValidadeMarcoDias,
  diasRestantes: number
): DocumentValidadeAlerta["severidade"] {
  if (diasRestantes <= 0 || marco === 0) return "danger";
  if (marco <= 3) return "danger";
  if (marco <= 10) return "warning";
  return "info";
}

export function mensagemAlertaValidade(
  doc: Document,
  marco: ValidadeMarcoDias,
  diasRestantes: number
): string {
  if (diasRestantes <= 0) {
    return `${doc.codigo} — validade vencida. Revalidação necessária.`;
  }
  if (marco === 0) {
    return `${doc.codigo} — validade vence hoje.`;
  }
  return `${doc.codigo} — validade vence em ${diasRestantes} dia(s) (alerta ${marco}d).`;
}

export function marcosAlertaAplicaveis(
  diasRestantes: number
): ValidadeMarcoDias[] {
  return MARCOS_ALERTA_VALIDADE.filter((marco) => diasRestantes <= marco);
}

export function documentoExigeRevalidacao(doc: Document): boolean {
  if (doc.status !== "vigente" || !doc.validade?.ativa || !doc.validade.dataValidade) {
    return false;
  }
  const dias = calcularDiasRestantesValidade(doc.validade.dataValidade);
  return dias !== null && dias <= 0;
}

export type RevalidacaoQuadroSituacao = "disponivel" | "vencida";

export function situacaoRevalidacaoQuadro(
  dataValidade: string | undefined
): RevalidacaoQuadroSituacao | null {
  const dias = calcularDiasRestantesValidade(dataValidade);
  if (dias === null || dias > 0) return null;
  return dias === 0 ? "disponivel" : "vencida";
}

export const revalidacaoQuadroSituacaoLabels: Record<
  RevalidacaoQuadroSituacao,
  string
> = {
  disponivel: "Disponível",
  vencida: "Vencida",
};
