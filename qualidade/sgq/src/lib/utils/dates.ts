import { addDays, differenceInDays, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DueStatus } from "@/types/calibration";

export function calcularProximaData(
  ultimaData: string | undefined,
  frequenciaDias: number
): string | undefined {
  if (!ultimaData) return undefined;
  return addDays(parseISO(ultimaData), frequenciaDias).toISOString();
}

export function calcularDueStatus(proximaData: string | undefined): DueStatus {
  if (!proximaData) return "vencido";

  const dias = differenceInDays(parseISO(proximaData), new Date());

  if (dias < 0) return "vencido";
  if (dias <= 30) return "proximo";
  return "em_dia";
}

export function formatarData(data: string | undefined): string {
  if (!data) return "—";
  return format(parseISO(data), "dd/MM/yyyy", { locale: ptBR });
}

export function formatarDataHora(data: string | undefined): string {
  if (!data) return "—";
  return format(parseISO(data), "dd/MM/yyyy HH:mm", { locale: ptBR });
}
