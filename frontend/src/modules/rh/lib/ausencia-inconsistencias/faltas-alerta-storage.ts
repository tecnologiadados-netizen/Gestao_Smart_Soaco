import type {
  FaltaAlertaEnquadramentoRow,
  FaltaAlertaRegraRow,
  FaltaAusenciaInconsistenciaRow,
  FaltaRow,
} from "@rh/types/api";
import type { AusenciaAlertaDetectado } from "@rh/lib/ausencia-inconsistencias/regras-catalogo";
import { CATALOGO_REGRAS_ALERTA_DEFAULT } from "@rh/lib/ausencia-inconsistencias/regras-catalogo";
import {
  fetchFaltasAlertaEnquadramentosApi,
  fetchFaltasAlertaInconsistenciasApi,
  fetchFaltasAlertaRegrasApi,
  isApiConfigured,
  registrarFaltasAlertaAusenciaApi,
  removerFaltasAlertaPorFaltasApi,
  setFaltasAlertaRegraAtivaApi,
  updateFaltasAlertaInconsistenciaApi,
} from "@rh/lib/api-client";
import { readPersistedJson, writePersistedJson } from "@rh/lib/ui-filter-persistence";
import { randomUUID } from "@rh/lib/utils";
import { getCurrentUser } from "@rh/lib/auth";

const REGRAS_KEY = "rh-faltas-alerta-regras-v1";
const ENQUADRAMENTOS_KEY = "rh-faltas-alerta-enquadramentos-v1";
const INCONSISTENCIAS_KEY = "rh-faltas-ausencia-inconsistencias-v1";

export const FALTAS_ALERTAS_CHANGED_EVENT = "rh-faltas-alertas-changed";

function notifyChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FALTAS_ALERTAS_CHANGED_EVENT));
}

const REGRAS_REMOVIDAS = new Set(["doc-atestado-sem-cid"]);

function readRegrasLocal(): FaltaAlertaRegraRow[] {
  const saved = readPersistedJson<FaltaAlertaRegraRow[]>(REGRAS_KEY, "local");
  if (saved?.length) {
    const filtradas = saved.filter((r) => !REGRAS_REMOVIDAS.has(r.id));
    if (filtradas.length !== saved.length) {
      writePersistedJson(REGRAS_KEY, filtradas, "local");
    }
    return filtradas.sort((a, b) => a.ordem - b.ordem);
  }
  const now = new Date().toISOString();
  return CATALOGO_REGRAS_ALERTA_DEFAULT.map((r) => ({ ...r, updatedAt: now }));
}

function writeRegrasLocal(regras: FaltaAlertaRegraRow[]): void {
  writePersistedJson(REGRAS_KEY, regras, "local");
  notifyChanged();
}

function readEnquadramentosLocal(): FaltaAlertaEnquadramentoRow[] {
  return readPersistedJson<FaltaAlertaEnquadramentoRow[]>(ENQUADRAMENTOS_KEY, "local") ?? [];
}

function writeEnquadramentosLocal(rows: FaltaAlertaEnquadramentoRow[]): void {
  writePersistedJson(ENQUADRAMENTOS_KEY, rows, "local");
  notifyChanged();
}

function readInconsistenciasLocal(): FaltaAusenciaInconsistenciaRow[] {
  return readPersistedJson<FaltaAusenciaInconsistenciaRow[]>(INCONSISTENCIAS_KEY, "local") ?? [];
}

function writeInconsistenciasLocal(rows: FaltaAusenciaInconsistenciaRow[]): void {
  writePersistedJson(INCONSISTENCIAS_KEY, rows, "local");
  notifyChanged();
}

function faltaIdSet(ids: Iterable<string>): Set<string> {
  return new Set([...ids].map((id) => String(id).trim().toLowerCase()).filter(Boolean));
}

function chaveAusenciaOperacional(matricula: string, dataAusencia: string): string {
  return `${String(matricula ?? "").trim()}|${String(dataAusencia ?? "").trim().slice(0, 10)}`;
}

type IndiceAusenciasAtivas = {
  ids: Set<string>;
  chaves: Set<string>;
  idPorChave: Map<string, string>;
};

function indiceAusenciasAtivas(
  faltas: Array<{ id: number | string; matricula: string; data: string }>,
): IndiceAusenciasAtivas {
  const ids = new Set<string>();
  const chaves = new Set<string>();
  const idPorChave = new Map<string, string>();
  for (const f of faltas) {
    const id = String(f.id ?? "").trim();
    const idNorm = id.toLowerCase();
    if (idNorm) ids.add(idNorm);
    const chave = chaveAusenciaOperacional(f.matricula, f.data);
    chaves.add(chave);
    if (id) idPorChave.set(chave, id);
  }
  return { ids, chaves, idPorChave };
}

function faltaIdExisteNoIndice(faltaId: string, indice: IndiceAusenciasAtivas): boolean {
  const norm = String(faltaId ?? "").trim().toLowerCase();
  return norm !== "" && indice.ids.has(norm);
}

function faltaExistePorChaveOperacional(
  matricula: string,
  dataAusencia: string,
  indice: IndiceAusenciasAtivas,
): boolean {
  return indice.chaves.has(chaveAusenciaOperacional(matricula, dataAusencia));
}

/**
 * Remove alertas vinculados às ausências excluídas.
 */
export async function removerAlertasPorFaltaIds(faltaIds: Iterable<string>): Promise<number> {
  const alvo = faltaIdSet(faltaIds);
  if (alvo.size === 0) return 0;

  if (isApiConfigured()) {
    const removidos = await removerFaltasAlertaPorFaltasApi([...alvo]);
    notifyChanged();
    return removidos;
  }

  const inconsistencias = readInconsistenciasLocal();
  const removidas = inconsistencias.filter((i) => alvo.has(String(i.faltaId).trim().toLowerCase()));
  if (removidas.length === 0) {
    const enquadramentosAntes = readEnquadramentosLocal().length;
    const enquadramentos = readEnquadramentosLocal().filter((e) =>
      alvo.has(String(e.faltaId).trim().toLowerCase()),
    );
    if (enquadramentos.length !== enquadramentosAntes) {
      writeEnquadramentosLocal(enquadramentos);
    }
    return enquadramentosAntes - enquadramentos.length;
  }

  const inconsistenciaIds = new Set(removidas.map((i) => i.id));
  const enquadramentoIds = new Set(
    removidas.map((i) => i.enquadramentoId).filter((id): id is string => Boolean(id)),
  );

  writeInconsistenciasLocal(inconsistencias.filter((i) => !inconsistenciaIds.has(i.id)));

  const enquadramentos = readEnquadramentosLocal().filter((e) => {
    if (alvo.has(String(e.faltaId).trim().toLowerCase())) return false;
    if (inconsistenciaIds.has(String(e.inconsistenciaId ?? ""))) return false;
    if (enquadramentoIds.has(e.id)) return false;
    return true;
  });
  writeEnquadramentosLocal(enquadramentos);

  return removidas.length;
}

export function purgarAlertasOrfaos(
  faltasAtivas: Array<{ id: number | string; matricula: string; data: string }>,
): number {
  if (faltasAtivas.length === 0) return 0;
  if (isApiConfigured()) return 0;
  return reconciliarAlertasComAusencias(faltasAtivas);
}

export function reconciliarAlertasComAusencias(
  faltasAtivas: Array<{ id: number | string; matricula: string; data: string }>,
): number {
  if (faltasAtivas.length === 0) return 0;
  if (isApiConfigured()) return 0;

  const indice = indiceAusenciasAtivas(faltasAtivas);
  const inconsistencias = readInconsistenciasLocal();
  const nextInc: FaltaAusenciaInconsistenciaRow[] = [];
  let removidos = 0;
  let relinked = false;

  for (const inc of inconsistencias) {
    const faltaId = String(inc.faltaId ?? "").trim();
    if (faltaIdExisteNoIndice(faltaId, indice)) {
      nextInc.push(inc);
      continue;
    }
    const idAtual = indice.idPorChave.get(chaveAusenciaOperacional(inc.matricula, inc.dataAusencia));
    if (idAtual) {
      if (idAtual !== faltaId) relinked = true;
      nextInc.push({ ...inc, faltaId: idAtual });
      continue;
    }
    if (faltaExistePorChaveOperacional(inc.matricula, inc.dataAusencia, indice)) {
      nextInc.push(inc);
      continue;
    }
    removidos += 1;
  }

  const incIds = new Set(nextInc.map((i) => i.id));
  const incByEnqId = new Map(
    nextInc.filter((i) => i.enquadramentoId).map((i) => [String(i.enquadramentoId), i]),
  );

  const enquadramentosAntes = readEnquadramentosLocal();
  const enquadramentos = enquadramentosAntes
    .filter((e) => {
      if (e.inconsistenciaId && !incIds.has(e.inconsistenciaId)) return false;
      if (incByEnqId.has(e.id)) return true;
      if (faltaIdExisteNoIndice(String(e.faltaId ?? ""), indice)) return true;
      return faltaExistePorChaveOperacional(e.matricula, e.dataAusencia, indice);
    })
    .map((e) => {
      const inc =
        (e.inconsistenciaId ? nextInc.find((i) => i.id === e.inconsistenciaId) : undefined)
        ?? incByEnqId.get(e.id);
      if (!inc) return e;
      return {
        ...e,
        faltaId: inc.faltaId,
        inconsistenciaId: e.inconsistenciaId ?? inc.id,
        statusResolucao: inc.status,
        resolvidaEm: inc.resolvidaEm,
        resolucaoNotas: inc.resolucaoNotas,
        resolvidoPor: inc.resolvidoPor ?? e.resolvidoPor,
      };
    });

  const incChanged = removidos > 0 || relinked || nextInc.length !== inconsistencias.length;
  const enqChanged =
    enquadramentos.length !== enquadramentosAntes.length
    || JSON.stringify(enquadramentos) !== JSON.stringify(enquadramentosAntes);

  if (incChanged) writeInconsistenciasLocal(nextInc);
  if (enqChanged) writeEnquadramentosLocal(enquadramentos);

  return removidos;
}

export async function getFaltasAusenciaInconsistenciasSincronizadas(
  faltasAtivas: Array<{ id: number | string; matricula: string; data: string }>,
): Promise<FaltaAusenciaInconsistenciaRow[]> {
  if (isApiConfigured()) {
    const rows = await fetchFaltasAlertaInconsistenciasApi(faltasAtivas);
    notifyChanged();
    return rows;
  }
  reconciliarAlertasComAusencias(faltasAtivas);
  return getFaltasAusenciaInconsistencias();
}

export async function getFaltasAlertaRegras(): Promise<FaltaAlertaRegraRow[]> {
  if (isApiConfigured()) {
    const rows = await fetchFaltasAlertaRegrasApi();
    return rows.filter((r) => !REGRAS_REMOVIDAS.has(r.id)).sort((a, b) => a.ordem - b.ordem);
  }
  return readRegrasLocal();
}

export async function setFaltaAlertaRegraAtiva(
  regraId: string,
  ativa: boolean,
  updatedBy?: string,
): Promise<FaltaAlertaRegraRow[]> {
  if (isApiConfigured()) {
    const regras = await setFaltasAlertaRegraAtivaApi(regraId, ativa);
    notifyChanged();
    return regras.filter((r) => !REGRAS_REMOVIDAS.has(r.id)).sort((a, b) => a.ordem - b.ordem);
  }

  const regras = readRegrasLocal();
  const now = new Date().toISOString();
  const user = updatedBy ?? getCurrentUser() ?? "Operador RH";
  const next = regras.map((r) =>
    r.id === regraId ? { ...r, ativa, updatedAt: now, updatedBy: user } : r,
  );
  writeRegrasLocal(next);
  return next;
}

export async function getFaltasAlertaEnquadramentos(regraId?: string): Promise<FaltaAlertaEnquadramentoRow[]> {
  if (isApiConfigured()) {
    return fetchFaltasAlertaEnquadramentosApi(regraId);
  }

  const inconsistencias = readInconsistenciasLocal();
  const inconsistenciasById = new Map(inconsistencias.map((i) => [i.id, i]));
  const enquadramentosById = new Map(readEnquadramentosLocal().map((e) => [e.id, e]));
  const linkedInconsistenciaIds = new Set<string>();

  const findInconsistencia = (e: FaltaAlertaEnquadramentoRow): FaltaAusenciaInconsistenciaRow | undefined => {
    if (e.inconsistenciaId) {
      const byId = inconsistenciasById.get(e.inconsistenciaId);
      if (byId) return byId;
    }
    return inconsistencias.find((i) => i.enquadramentoId === e.id);
  };

  const enrich = (e: FaltaAlertaEnquadramentoRow): FaltaAlertaEnquadramentoRow => {
    const inc = findInconsistencia(e);
    if (inc) linkedInconsistenciaIds.add(inc.id);
    if (!inc) {
      return e.statusResolucao != null ? e : { ...e, statusResolucao: "pendente" as const };
    }
    return {
      ...e,
      inconsistenciaId: e.inconsistenciaId ?? inc.id,
      statusResolucao: inc.status ?? e.statusResolucao ?? "pendente",
      resolvidaEm: inc.resolvidaEm ?? e.resolvidaEm,
      resolucaoNotas: inc.resolucaoNotas ?? e.resolucaoNotas,
      resolvidoPor: e.resolvidoPor ?? inc.resolvidoPor,
    };
  };

  const fromEnquadramentos = readEnquadramentosLocal().map(enrich);

  const orphanLogs: FaltaAlertaEnquadramentoRow[] = inconsistencias
    .filter((inc) => !linkedInconsistenciaIds.has(inc.id))
    .filter((inc) => !inc.enquadramentoId || !enquadramentosById.has(inc.enquadramentoId))
    .map((inc) => ({
      id: inc.enquadramentoId ?? inc.id,
      regraId: inc.regraId,
      faltaId: inc.faltaId,
      inconsistenciaId: inc.id,
      matricula: inc.matricula,
      nomeFuncionario: inc.nomeFuncionario,
      dataAusencia: inc.dataAusencia,
      tipo: "",
      motivo: inc.descricao,
      lancadoPor: inc.lancadoPor ?? "—",
      detectadaEm: inc.detectadaEm,
      statusResolucao: inc.status,
      resolvidaEm: inc.resolvidaEm,
      resolucaoNotas: inc.resolucaoNotas,
      resolvidoPor: inc.resolvidoPor,
    }));

  const all = [...fromEnquadramentos, ...orphanLogs];
  if (!regraId) return [...all].sort((a, b) => b.detectadaEm.localeCompare(a.detectadaEm));
  return all.filter((e) => e.regraId === regraId).sort((a, b) => b.detectadaEm.localeCompare(a.detectadaEm));
}

export async function getFaltasAusenciaInconsistencias(): Promise<FaltaAusenciaInconsistenciaRow[]> {
  if (isApiConfigured()) {
    return fetchFaltasAlertaInconsistenciasApi();
  }
  return [...readInconsistenciasLocal()].sort((a, b) => b.detectadaEm.localeCompare(a.detectadaEm));
}

export async function updateFaltaAusenciaInconsistenciaStatus(
  id: string,
  status: FaltaAusenciaInconsistenciaRow["status"],
  resolucaoNotas?: string,
): Promise<FaltaAusenciaInconsistenciaRow[]> {
  if (isApiConfigured()) {
    const rows = await updateFaltasAlertaInconsistenciaApi(id, status, resolucaoNotas);
    notifyChanged();
    return rows;
  }

  const now = new Date().toISOString();
  const resolvidoPor = getCurrentUser() ?? "Operador RH";
  const target = readInconsistenciasLocal().find((row) => row.id === id);

  const next = readInconsistenciasLocal().map((row) => {
    if (row.id !== id) return row;
    return {
      ...row,
      status,
      resolucaoNotas: resolucaoNotas ?? row.resolucaoNotas,
      resolvidaEm: status === "resolvida" || status === "ignorada" ? now : row.resolvidaEm,
      resolvidoPor: status === "resolvida" || status === "ignorada" ? resolvidoPor : row.resolvidoPor,
    };
  });
  writeInconsistenciasLocal(next);

  if (target) {
    const enquadramentoId = target.enquadramentoId;
    const enquadramentos = readEnquadramentosLocal().map((e) => {
      const linked = e.inconsistenciaId === id || (enquadramentoId != null && e.id === enquadramentoId);
      if (!linked) return e;
      return {
        ...e,
        statusResolucao: status,
        resolucaoNotas: resolucaoNotas ?? e.resolucaoNotas,
        resolvidaEm: status === "resolvida" || status === "ignorada" ? now : e.resolvidaEm,
        resolvidoPor: status === "resolvida" || status === "ignorada" ? resolvidoPor : e.resolvidoPor,
      };
    });
    writeEnquadramentosLocal(enquadramentos);
  }

  return next;
}

export type RegistrarAlertasInput = {
  linha: FaltaRow;
  alertas: AusenciaAlertaDetectado[];
  lancadoPor?: string;
};

export type RegistrarAlertasResult = {
  enquadramentos: FaltaAlertaEnquadramentoRow[];
  inconsistencias: FaltaAusenciaInconsistenciaRow[];
};

export async function registrarAlertasAusencia(
  input: RegistrarAlertasInput,
): Promise<RegistrarAlertasResult> {
  const { linha, alertas } = input;
  if (!alertas.length) return { enquadramentos: [], inconsistencias: [] };

  const lancadoPor = input.lancadoPor ?? getCurrentUser() ?? "Operador RH";

  if (isApiConfigured()) {
    const result = await registrarFaltasAlertaAusenciaApi({
      linha,
      alertas: alertas.map((a) => ({
        regraId: a.regraId,
        titulo: a.titulo,
        motivo: a.motivo,
        baseLegal: a.baseLegal,
        severidade: a.severidade,
        contexto: a.contexto,
      })),
      lancadoPor,
    });
    notifyChanged();
    return result;
  }

  const detectadaEm = new Date().toISOString();
  const enquadramentosNovos: FaltaAlertaEnquadramentoRow[] = [];
  const inconsistenciasNovas: FaltaAusenciaInconsistenciaRow[] = [];

  for (const alerta of alertas) {
    const inconsistenciaId = randomUUID();
    const enquadramentoId = randomUUID();
    const ctx = alerta.contexto ?? {};

    enquadramentosNovos.push({
      id: enquadramentoId,
      regraId: alerta.regraId,
      faltaId: String(linha.id),
      inconsistenciaId,
      matricula: String(linha.matricula ?? ""),
      nomeFuncionario: String(linha.nomeFuncionario ?? ""),
      dataAusencia: String(linha.data ?? "").slice(0, 10),
      tipo: String(linha.tipo ?? ""),
      cid: String(linha.cid ?? "").trim() || undefined,
      motivo: alerta.motivo,
      contexto: ctx,
      lancadoPor,
      detectadaEm,
      statusResolucao: "pendente",
    });

    inconsistenciasNovas.push({
      id: inconsistenciaId,
      faltaId: String(linha.id),
      enquadramentoId,
      regraId: alerta.regraId,
      titulo: alerta.titulo,
      descricao: alerta.motivo,
      baseLegal: alerta.baseLegal,
      severidade: alerta.severidade,
      status: "pendente",
      matricula: String(linha.matricula ?? ""),
      nomeFuncionario: String(linha.nomeFuncionario ?? ""),
      dataAusencia: String(linha.data ?? "").slice(0, 10),
      diasAcumulados: typeof ctx.diasAcumulados === "number" ? ctx.diasAcumulados : undefined,
      limiteDias: typeof ctx.limiteDias === "number" ? ctx.limiteDias : undefined,
      grupoCidId: typeof ctx.grupoCidId === "string" ? ctx.grupoCidId : undefined,
      grupoCidTitulo: typeof ctx.grupoCidTitulo === "string" ? ctx.grupoCidTitulo : undefined,
      detectadaEm,
      lancadoPor,
    });
  }

  writeEnquadramentosLocal([...enquadramentosNovos, ...readEnquadramentosLocal()]);
  writeInconsistenciasLocal([...inconsistenciasNovas, ...readInconsistenciasLocal()]);

  return { enquadramentos: enquadramentosNovos, inconsistencias: inconsistenciasNovas };
}

export function contarEnquadramentosPorRegra(regraId: string, dias = 30): number {
  const desde = Date.now() - dias * 24 * 60 * 60 * 1000;
  return readEnquadramentosLocal().filter((e) => {
    if (e.regraId !== regraId) return false;
    const t = Date.parse(e.detectadaEm);
    return Number.isFinite(t) && t >= desde;
  }).length;
}

export function contarInconsistenciasPendentesPorRegra(regraId: string): number {
  return readInconsistenciasLocal().filter(
    (i) => i.regraId === regraId && (i.status === "pendente" || i.status === "em_analise"),
  ).length;
}

export function contarInconsistenciasPendentes(): number {
  return readInconsistenciasLocal().filter((i) => i.status === "pendente" || i.status === "em_analise").length;
}
