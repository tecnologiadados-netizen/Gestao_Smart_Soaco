/** Valida e expande expressões cron de agendamento SMS (suporta múltiplas separadas por |). */

const CRON_DIARIO_RE = /^(\d{1,2})\s+([\d,]+)\s+\*\s+\*\s+\*$/;

export function listarExpressoesCronAgendamento(expr: string | null | undefined): string[] {
  const raw = expr?.trim();
  if (!raw) return [];
  return raw
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);
}

export function expressaoCronAgendamentoValida(expr: string): boolean {
  const partes = listarExpressoesCronAgendamento(expr);
  if (partes.length === 0) return false;
  return partes.every((p) => CRON_DIARIO_RE.test(p));
}

export function validarCronExpressaoAgendamento(expr: string | null | undefined): string | null {
  const partes = listarExpressoesCronAgendamento(expr);
  if (partes.length === 0) return 'Informe ao menos um horário de envio.';
  for (const parte of partes) {
    if (!CRON_DIARIO_RE.test(parte)) {
      return `Expressão cron inválida ou não suportada: "${parte}". Use horários diários (ex.: 0 18 * * *).`;
    }
  }
  return null;
}
