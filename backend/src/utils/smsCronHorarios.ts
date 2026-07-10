/** Valida e expande expressões cron de agendamento (suporta múltiplas separadas por |). */

const CRON_AGENDAMENTO_RE =
  /^(\d{1,2})\s+([\d,\-]+|\d{1,2})\s+\*\s+\*\s+(\*|[\d,\-]+)$/;

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
  return partes.every((p) => CRON_AGENDAMENTO_RE.test(p));
}

export function validarCronExpressaoAgendamento(expr: string | null | undefined): string | null {
  const partes = listarExpressoesCronAgendamento(expr);
  if (partes.length === 0) return 'Informe ao menos um horário de envio.';
  for (const parte of partes) {
    if (!CRON_AGENDAMENTO_RE.test(parte)) {
      return `Expressão cron inválida ou não suportada: "${parte}". Use horários diários (ex.: 0 18 * * * ou 0 18 * * 1-5).`;
    }
  }
  return null;
}
