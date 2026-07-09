/**
 * Regras de datas SGQ — espelho do frontend:
 * frontend/src/modules/qualidade/lib/documents/validity.ts
 * frontend/src/modules/qualidade/lib/utils/dates.ts
 */

export const MARCOS_ALERTA_VALIDADE = [30, 20, 10, 5, 3, 1, 0] as const;
export type ValidadeMarcoDias = (typeof MARCOS_ALERTA_VALIDADE)[number];

export const MARCOS_ALERTA_TAREFA = [7, 3, 1, 0] as const;
export type TarefaMarcoDias = (typeof MARCOS_ALERTA_TAREFA)[number];

export type DueStatus = 'em_dia' | 'proximo' | 'vencido';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseIsoDate(iso: string): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Data inválida: ${iso}`);
  return d;
}

export function calcularDiasRestantes(dataIso: string | undefined, referencia = new Date()): number | null {
  if (!dataIso) return null;
  const alvo = startOfDay(parseIsoDate(dataIso));
  const ref = startOfDay(referencia);
  return Math.round((alvo.getTime() - ref.getTime()) / 86_400_000);
}

export function marcosAlertaAplicaveis(diasRestantes: number): ValidadeMarcoDias[] {
  return MARCOS_ALERTA_VALIDADE.filter((marco) => diasRestantes <= marco);
}

export function marcosTarefaAplicaveis(diasRestantes: number): TarefaMarcoDias[] {
  return MARCOS_ALERTA_TAREFA.filter((marco) => diasRestantes <= marco);
}

export function calcularProximaData(ultimaData: string | undefined, frequenciaDias: number): string | undefined {
  if (!ultimaData) return undefined;
  const d = parseIsoDate(ultimaData);
  d.setDate(d.getDate() + frequenciaDias);
  return d.toISOString();
}

export function calcularDueStatus(proximaData: string | undefined): DueStatus {
  const dias = calcularDiasRestantes(proximaData);
  if (dias === null) return 'vencido';
  if (dias < 0) return 'vencido';
  if (dias <= 30) return 'proximo';
  return 'em_dia';
}

export function formatarDataBr(iso: string | undefined): string {
  if (!iso) return '—';
  const d = parseIsoDate(iso);
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function mensagemAlertaValidade(
  codigo: string,
  marco: ValidadeMarcoDias,
  diasRestantes: number
): string {
  if (diasRestantes <= 0) return `${codigo} — validade vencida. Revalidação necessária.`;
  if (marco === 0) return `${codigo} — validade vence hoje.`;
  return `${codigo} — validade vence em ${diasRestantes} dia(s) (alerta ${marco}d).`;
}
