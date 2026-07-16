/**
 * Liga ausências “suspensão disciplinar” ao sync com Sanções sem colunas novas nas tabelas.
 * Observações da ausência: bloco técnico (tipo de sanção cadastrado + data da aplicação + propagação) + texto do motivo.
 */

export const AUSENCIA_PREFIXO_LINHA_TIPO_SANCAO = "*_T_S_*:" as const;
const AUSENCIA_PREFIXO_DATA_APP = "*_APP_*:" as const;
const AUSENCIA_PREFIXO_PROPAGAR_SANCAO = "*_PROP_*:" as const;

/** Sanções geradas pela ausência legado ou sufixo ⟦auto:falta…⟧ — para separar lançamentos manuais. */
export const SANCAO_EVID_AUTOM_MARKER = "\n· Sanção registada automaticamente a partir da ausência.";
const REG_SANCAO_TAIL_AUTO = /\n⟦auto:falta:[^⟧]+⟧\s*$/i;

export type SuspensaoAusenciaDecoded = {
  tipoCadastro: string;
  motivo: string;
  /** ISO yyyy-mm-dd da data de aplicação da sanção; ausente em registros antigos. */
  dataAplicacaoSancaoIso?: string;
  /** Se false, a ausência grava só em Faltas (não gera linha em Sanções ao sync). */
  propagarParaSancoes: boolean;
};

export function encodeAusenciaSuspensaoObservacoes(
  tipoDesdeCadastro: string,
  motivoHumano: string,
  options?: { dataAplicacaoIso?: string; propagarParaSancoes?: boolean },
): string {
  const tipo = String(tipoDesdeCadastro ?? "").trim();
  const motivo = String(motivoHumano ?? "").trim();
  const propagate = options?.propagarParaSancoes !== false;
  const dataIso = String(options?.dataAplicacaoIso ?? "").trim().slice(0, 10);
  const dataOk = /^\d{4}-\d{2}-\d{2}$/.test(dataIso);

  const head: string[] = [`${AUSENCIA_PREFIXO_LINHA_TIPO_SANCAO}${tipo}`];
  if (dataOk) {
    head.push(`${AUSENCIA_PREFIXO_DATA_APP}${dataIso}`);
  }
  if (!propagate) {
    head.push(`${AUSENCIA_PREFIXO_PROPAGAR_SANCAO}0`);
  }
  return `${head.join("\n")}\n${motivo}`.trim();
}

function parsePropagacaoValor(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (["0", "nao", "não", "n", "false", "nao_propagar", "somente_ausencia"].includes(v)) return false;
  return true;
}

/** Decodifica bloco de suspensão em observações da ausência. */
export function decodeAusenciaSuspensaoObservacoes(obs: string): SuspensaoAusenciaDecoded | null {
  const s = String(obs ?? "").trim();
  if (!s.startsWith(AUSENCIA_PREFIXO_LINHA_TIPO_SANCAO)) return null;

  const lines = s.split("\n");
  const tipoCadastro = lines[0].slice(AUSENCIA_PREFIXO_LINHA_TIPO_SANCAO.length).trim();

  let i = 1;
  let dataAplicacaoSancaoIso: string | undefined;
  let propagarParaSancoes = true;

  while (i < lines.length) {
    const lineRaw = lines[i];
    const line = lineRaw.trim();

    if (line.startsWith(AUSENCIA_PREFIXO_DATA_APP)) {
      const d = line.slice(AUSENCIA_PREFIXO_DATA_APP.length).trim().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) dataAplicacaoSancaoIso = d;
      i += 1;
      continue;
    }
    if (line.startsWith(AUSENCIA_PREFIXO_PROPAGAR_SANCAO)) {
      const v = line.slice(AUSENCIA_PREFIXO_PROPAGAR_SANCAO.length);
      propagarParaSancoes = parsePropagacaoValor(v);
      i += 1;
      continue;
    }
    break;
  }

  const motivo = lines.slice(i).join("\n").trim();
  return { tipoCadastro, motivo, dataAplicacaoSancaoIso, propagarParaSancoes };
}

/** Texto útil para grade/lista de ausências (esconde linhas técnicas). */
export function displayAusenciaObservacoesLista(obs: string): string {
  const dec = decodeAusenciaSuspensaoObservacoes(obs);
  if (!dec) return String(obs ?? "");
  const parts: string[] = [];
  if (dec.dataAplicacaoSancaoIso && /^\d{4}-\d{2}-\d{2}$/.test(dec.dataAplicacaoSancaoIso)) {
    const isoMm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dec.dataAplicacaoSancaoIso);
    if (isoMm) parts.push(`Aplicação da sanção: ${isoMm[3]}/${isoMm[2]}/${isoMm[1]}`);
  }
  const m = dec.motivo.trim();
  const t = dec.tipoCadastro.trim();
  if (!dec.propagarParaSancoes) {
    parts.push("Sem registro na aba Sanções (somente ausência)");
  }
  if (m) parts.push(m);
  else if (t) parts.push(`Tipo (cadastro de sanções): ${t}`);
  return parts.join("\n").trim();
}

export function sanctionRowIsGeradaPelaAusencia(obs: string): boolean {
  const t = String(obs ?? "").trim();
  if (/^\s*\[AUTO:FALTA:/i.test(t)) return true;
  if (/⟦auto:falta:[^⟧]+⟧/i.test(t)) return true;
  const norm = t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  const evid = SANCAO_EVID_AUTOM_MARKER.trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (evid && norm.includes(evid)) return true;
  if (/automaticamente\s+a\s+partir\s+da\s+aus[eè]ncia/i.test(norm)) return true;
  return REG_SANCAO_TAIL_AUTO.test(t);
}

/** Id da falta quando a sanção foi gerada pelo fluxo ausência → sincronização (`⟦auto:falta:id⟧` ou legado `[AUTO:FALTA:id]`). */
export function extractAutoFaltaIdFromSancaoObservacoes(obs: string): string | null {
  const s = String(obs ?? "");
  const matches = [...s.matchAll(/⟦auto:falta:([^⟧]+)⟧/gi)];
  if (matches.length > 0) {
    return String(matches[matches.length - 1][1] ?? "").trim();
  }
  const legacy = /\[AUTO:FALTA:\s*([^\]\s]+)\s*\]/i.exec(s);
  return legacy ? String(legacy[1]).trim() : null;
}

/** Texto principal do motivo na aba sanções — remove marcas automáticas e evidência discreta. */
/** Motivo gerado pela automação legada (Período / Quantidade / Líder), antes do formulário *_T_S_*. */
export function isSancaoMotivoLegadoAutomacaoLog(obsRaw: string): boolean {
  const m = stripMarcaGeradaAusenciaMotivo(obsRaw);
  return /^Per[ií]odo:\s*/i.test(m) && /Quantidade:\s*/i.test(m) && /L[ií]der:\s*/i.test(m);
}

export function stripMarcaGeradaAusenciaMotivo(obsRaw: string): string {
  let s = String(obsRaw ?? "").trim();
  if (/^\s*\[[^\]]*AUTO[^\]]*\]\s*/i.test(s)) {
    s = s.replace(/^\s*\[[^\]]+\]\s*/i, "").trim();
  }
  s = s.replace(REG_SANCAO_TAIL_AUTO, "").trim();
  s = s.replace(new RegExp(`\\s*${escapeRegex(SANCAO_EVID_AUTOM_MARKER.trim())}\\s*$`, "i"), "").trim();
  return s.trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
