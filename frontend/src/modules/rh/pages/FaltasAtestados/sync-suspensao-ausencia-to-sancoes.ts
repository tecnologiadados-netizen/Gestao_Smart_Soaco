import { format, parseISO } from "date-fns";

import { ptBR } from "date-fns/locale";

import type { FaltaRow, SancaoDisciplinarReplaceRow, SancaoDisciplinarRow } from "@rh/types/api";

import { getFaltasAtestados, getSancoesDisciplinares, isApiConfigured, replaceSancoesDisciplinares } from "@rh/lib/api-client";

import { normalizeText } from "@rh/pages/FaltasAtestados/faltas-dias-equivalentes";

import {

  SANCAO_EVID_AUTOM_MARKER,

  decodeAusenciaSuspensaoObservacoes,

  extractAutoFaltaIdFromSancaoObservacoes,

  sanctionRowIsGeradaPelaAusencia,

} from "@rh/pages/FaltasAtestados/suspensao-ausencia-encoding";



export function isSuspensaoDisciplinarAusenciaTipo(tipo: string): boolean {

  const n = normalizeText(tipo);

  return n.includes("SUSPENS") && (n.includes("DISCIPLINAR") || n.includes("DISCIPLINARIA"));

}



function manualSancoesKept(rows: SancaoDisciplinarRow[]): SancaoDisciplinarRow[] {

  return rows.filter((r) => !sanctionRowIsGeradaPelaAusencia(String(r.observacoes ?? "")));

}



function mesAnoDisplayFromIso(dateStr: string): { mes: string; ano: string } {

  const s = String(dateStr ?? "").trim().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { mes: "", ano: "" };

  try {

    const d = parseISO(s);

    return { mes: format(d, "LLL.", { locale: ptBR }), ano: format(d, "yyyy") };

  } catch {

    return { mes: "", ano: "" };

  }

}



/** Escolhe um tipo de sanção do cadastro; fallback quando a ausência ainda não traz texto codificado. */

export function pickTipoSancaoParaSuspensao(tiposSancoes: readonly string[]): string {

  const list = [...new Set(tiposSancoes.map((x) => String(x ?? "").trim()).filter(Boolean))].sort((a, b) =>

    a.localeCompare(b, "pt-BR", { sensitivity: "base" }),

  );

  const comSusp =

    list.find((t) => normalizeText(t).includes("SUSPENS")) ??

    list.find((t) => normalizeText(t).includes("DISCIPLIN"));

  return comSusp ?? "Suspensão disciplinar";

}



function faltaToAutoSancoReplace(falta: FaltaRow, tipoSancoPadrao: string): SancaoDisciplinarReplaceRow | null {

  const idFalta = String(falta.id ?? "").trim();

  const faltaObs = String(falta.observacoes ?? "").trim();

  const decoded = decodeAusenciaSuspensaoObservacoes(faltaObs);

  const ausenciaIso = String(falta.data ?? "").trim().slice(0, 10);



  /** Ausência atual com bloco novo: só propaga texto humano para Sanções — sem “log” Período/Quantidade/Líder. */

  if (decoded) {

    if (!decoded.propagarParaSancoes) return null;



    let tipoSanco = tipoSancoPadrao;

    if (decoded.tipoCadastro.trim()) tipoSanco = decoded.tipoCadastro.trim();



    const app = decoded.dataAplicacaoSancaoIso?.trim().slice(0, 10) ?? "";

    const dataAplicacao = /^\d{4}-\d{2}-\d{2}$/.test(app) ? app : ausenciaIso;



    let motivoBase = decoded.motivo.trim();

    if (!motivoBase) motivoBase = "Suspensão disciplinar registada a partir da ausência.";



    const observacoes = `${motivoBase.trim()}${SANCAO_EVID_AUTOM_MARKER}\n⟦auto:falta:${idFalta}⟧`.trim();

    const { mes, ano } = mesAnoDisplayFromIso(dataAplicacao);



    return {

      matricula: String(falta.matricula ?? "").trim() || "—",

      nomeFuncionario: String(falta.nomeFuncionario ?? "").trim() || "—",

      tipo: tipoSanco,

      dataAplicacao: dataAplicacao || falta.data,

      mes,

      ano,

      observacoes,

    };

  }

  /** Ausência sem bloco *_T_S_* (formulário atual): não propaga — evita log «Período · Quantidade · Líder». */
  return null;
}



/** Reconstrói o snapshot de Sanções: mantém todas as linhas **manuais** e acrescenta as **automáticas** derivadas das ausências — não sobrescreve registos manuais; só volta a gerar as automáticas a partir das faltas. */

export function buildSancoesReplaceComSuspensaoDasAusencias(

  todasAusencias: FaltaRow[],

  todasSancoesServidor: SancaoDisciplinarRow[],

  tiposSancoesCadastro: readonly string[],

): SancaoDisciplinarReplaceRow[] {

  const manualBruto = manualSancoesKept(Array.isArray(todasSancoesServidor) ? todasSancoesServidor : []);

  const tipoPref = pickTipoSancaoParaSuspensao(tiposSancoesCadastro);

  const auto: SancaoDisciplinarReplaceRow[] = [];

  const visto = new Set<string>();

  /** Faltas de suspensão com id persistido que entram neste ciclo (para não manter linhas antigas ligadas pelo mesmo vínculo). */
  const idsFaltaSuspensaoPersistida = new Set<string>();



  for (const falta of todasAusencias ?? []) {

    if (!String(falta?.data ?? "").trim()) continue;

    if (!isSuspensaoDisciplinarAusenciaTipo(String(falta.tipo ?? ""))) continue;

    const idF = String(falta.id ?? "").trim();

    if (!idF || idF.startsWith("temp-")) continue;

    if (idF.startsWith("import-")) continue;

    idsFaltaSuspensaoPersistida.add(idF);


  }



  /** Não repetir linha antiga ligada por ⟦auto:falta:id⟧ quando a ausência correspondente existe e será tratada aqui (nova linha ou removida pela propagação). */
  const manual = manualBruto.filter((r) => {
    const lid = extractAutoFaltaIdFromSancaoObservacoes(String(r.observacoes ?? ""));
    if (lid && idsFaltaSuspensaoPersistida.has(lid)) return false;

    return true;

  });


  for (const falta of todasAusencias ?? []) {

    if (!String(falta?.data ?? "").trim()) continue;

    if (!isSuspensaoDisciplinarAusenciaTipo(String(falta.tipo ?? ""))) continue;

    const idF = String(falta.id ?? "").trim();

    if (!idF || idF.startsWith("temp-")) continue;

    if (idF.startsWith("import-")) continue;

    if (visto.has(idF)) continue;

    visto.add(idF);



    const rowAuto = faltaToAutoSancoReplace(falta, tipoPref);

    if (rowAuto) auto.push(rowAuto);

  }



  function rowToReplace(r: SancaoDisciplinarRow): SancaoDisciplinarReplaceRow {

    const { id: _id, ...rest } = r;

    return rest;

  }



  return [...manual.filter((r) => r.dataAplicacao && String(r.dataAplicacao).trim()).map(rowToReplace), ...auto];

}



/** Após gravar/remover ausências na API: reconstrói sanções automáticas a partir das suspensões. */

export async function syncSuspensaoAusenciasParaSancoesPadrao(

  tiposSancoesCadastro: readonly string[],

): Promise<{ ok: true } | { ok: false; message: string }> {

  if (!isApiConfigured()) return { ok: true };



  try {

    const [ausencias, sancoes] = await Promise.all([getFaltasAtestados(), getSancoesDisciplinares()]);

    const rows = buildSancoesReplaceComSuspensaoDasAusencias(ausencias, sancoes, tiposSancoesCadastro);

    await replaceSancoesDisciplinares(rows, { allowEmpty: rows.length === 0 });

    return { ok: true };

  } catch (e) {

    return { ok: false, message: e instanceof Error ? e.message : String(e) };

  }

}

