import { addDays, differenceInDays, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DueStatus } from "@qualidade/types/calibration";

export function calcularProximaData(
  ultimaData: string | undefined,
  frequenciaDias: number
): string | undefined {
  const d = parseDataSegura(ultimaData);
  if (!d) return undefined;
  return addDays(d, frequenciaDias).toISOString();
}

export function calcularDueStatus(proximaData: string | undefined): DueStatus {
  const d = parseDataSegura(proximaData);
  if (!d) return "vencido";

  const dias = differenceInDays(d, new Date());

  if (dias < 0) return "vencido";
  if (dias <= 30) return "proximo";
  return "em_dia";
}

function parseDataSegura(data: string | undefined): Date | null {
  if (!data?.trim()) return null;
  try {
    const d = parseISO(data.trim());
    if (Number.isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

export function formatarData(data: string | undefined): string {
  const d = parseDataSegura(data);
  if (!d) return "—";
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

export function formatarDataHora(data: string | undefined): string {
  const d = parseDataSegura(data);
  if (!d) return "—";
  return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
}
