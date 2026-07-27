/**
 * Normalização de destino WhatsApp: telefone (dígitos) ou JID de grupo (@g.us).
 */

/** Aceita JIDs novos (só dígitos) e legados (com hífen), ex.: 5586...-1610...@g.us */
const GROUP_JID_RE = /^([0-9]+(?:-[0-9]+)*)@g\.us$/i;

/** True se o valor parece JID de grupo WhatsApp. */
export function isWhatsAppGroupJid(raw: string | null | undefined): boolean {
  return Boolean(normalizarJidGrupoWhatsApp(raw));
}

/** Normaliza JID de grupo; retorna null se inválido. */
export function normalizarJidGrupoWhatsApp(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const compact = s.replace(/\s+/g, '');
  const m = compact.match(GROUP_JID_RE);
  if (!m) return null;
  return `${m[1]}@g.us`;
}

/**
 * Destino para Evolution sendText:
 * - grupo → `123@g.us` (não remover @g.us)
 * - telefone → só dígitos, com 55 se DDD local
 */
export function normalizarDestinoEnvioWhatsApp(raw: string | null | undefined): string | null {
  const jid = normalizarJidGrupoWhatsApp(raw);
  if (jid) return jid;

  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}
