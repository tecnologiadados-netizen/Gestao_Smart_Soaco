/** Prazo civil de prescrição da cobrança (CC art. 206 §5º I): 5 anos a partir do vencimento. */
export const ANOS_PRESCRICAO_TITULO = 5;

function hojeLocal(ref: Date): Date {
  return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
}

/** True quando o vencimento já completou 5 anos — cliente não deve ser priorizado nem negativado. */
export function isTituloPrescrito(vencimentoYmd: string | null | undefined, hoje = new Date()): boolean {
  const s = String(vencimentoYmd ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return false;
  const limite = new Date(Number(m[1]) + ANOS_PRESCRICAO_TITULO, Number(m[2]) - 1, Number(m[3]));
  return hojeLocal(hoje).getTime() >= limite.getTime();
}
