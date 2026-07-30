/** Validação compartilhada de datas de reprogramação (previsão / produção). */

/** YYYY-MM-DD de hoje em UTC-noon friendly local date via ISO slice of local calendar. */
export function hojeIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toIsoDateOnly(value: string | Date | null | undefined): string {
  if (value == null) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * - previsão ≥ produção (quando ambas informadas)
 * - cada data *nova* informada ≥ hoje (quando exigirNaoAnteriorHoje !== false)
 *
 * `exigirProducaoNaoAnteriorHoje: false` quando `producaoIso` é só a produção já gravada
 * (checagem de ordem previsão ≥ produção) — não bloquear reprogramação de previsão
 * porque a produção atual já está no passado.
 */
export function validarDatasReprogramacao(opts: {
  previsaoIso?: string | Date | null;
  producaoIso?: string | Date | null;
  exigirNaoAnteriorHoje?: boolean;
  /** Default: mesmo valor de `exigirNaoAnteriorHoje`. */
  exigirProducaoNaoAnteriorHoje?: boolean;
}): string | null {
  const previsao = toIsoDateOnly(opts.previsaoIso);
  const producao = toIsoDateOnly(opts.producaoIso);
  const exigirHoje = opts.exigirNaoAnteriorHoje !== false;
  const exigirProdHoje = opts.exigirProducaoNaoAnteriorHoje ?? exigirHoje;
  const hoje = hojeIsoLocal();

  if (exigirProdHoje && producao && producao < hoje) {
    return 'A data de produção não pode ser anterior à data de hoje.';
  }
  if (exigirHoje && previsao && previsao < hoje) {
    return 'A data de previsão não pode ser anterior à data de hoje.';
  }
  if (previsao && producao && previsao < producao) {
    return 'A nova data de previsão não pode ser anterior à data de produção.';
  }
  return null;
}
