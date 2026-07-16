/**
 * Cliente de API do GESTÃO RH SO.
 *
 * SEGURANÇA: Este módulo usa APENAS fetch() para URLs configuradas.
 * Não há cliente Supabase, nomes de tabelas nem queries expostos no bundle.
 * No console (F12) não é possível executar consultas indevidas ao banco.
 */

import type {
  DashboardData,
  CargosData,
  OrganicoRow,
  OrganicoComentario,
  OrganicoComentarioResumo,
  OrganicoFoto,
  OrganicoFotoResumo,
  OrganicoAlteracaoPendente,
  OrganicoTrajetoriaImportResult,
  OrganicoTrajetoriaImportRow,
  OrganicoTrajetoriaItem,
  OrganicoTrajetoriaParseResult,
  OrganicoReplaceRow,
  FaltaRow,
  FaltaReplaceRow,
  FaltaCadastrosData,
  FaltaCadastrosReplacePayload,
  FaltaCadastroItem,
  SancaoDisciplinarRow,
  SancaoDisciplinarReplaceRow,
  FaltaAlertaRegraRow,
  FaltaAlertaEnquadramentoRow,
  FaltaAusenciaInconsistenciaRow,
  FaltaAusenciaInconsistenciaStatus,
} from "@rh/types/api";
import { DEFAULT_DOCUMENT_CATEGORY_LABELS } from "@rh/lib/organico-documents";
import { normalizeOrganicoApiRows } from "@rh/lib/organico-normalize-api";
import { getLocalConfigValue, setLocalConfigValue } from "@rh/lib/config";
import { randomUUID } from "@rh/lib/utils";
import type { RhGroupPermissions } from "@rh/lib/rh-permissions";
import type { OrganicoActivityDraft } from "@rh/pages/Organico/organico-activity-log";
import type { OrganicoRepresentanteDraft } from "@rh/pages/Organico/OrganicoRepresentanteCard";
import {
  buildRepresentanteKey,
  representanteNomesDistintos,
  shouldIncludeOrganicoRepresentante,
  splitRepresentanteNames,
} from "@rh/lib/organico-representantes-policy";

import {
  getRequiredRhSessionToken,
  isRhApiConfigured,
  rhFetch,
  rhFetchJson,
} from "@rh/lib/rh-fetch";

function isApiConfigured(): boolean {
  return isRhApiConfigured();
}

async function secureFetch<T>(path: string): Promise<T> {
  return rhFetchJson<T>(path, { method: "GET" });
}

/** Tenta a API; em caso de falha (rede, URL inválida, etc.) usa o fallback mock. */
async function fetchWithMockFallback<T>(path: string, mock: T): Promise<T> {
  try {
    return await secureFetch<T>(path);
  } catch {
    return mock;
  }
}

async function securePost<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
  return rhFetchJson<TResponse>(path, { method: "POST", body });
}

async function secureProtectedPost<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
  return securePost<TResponse, TBody>(path, body);
}

async function secureProtectedFormPost<TResponse>(path: string, body: FormData): Promise<TResponse> {
  return rhFetchJson<TResponse>(path, { method: "POST", body });
}

async function secureProtectedGet(path: string): Promise<Response> {
  return rhFetch(path, { method: "GET" });
}

async function secureProtectedJson<T>(path: string): Promise<T> {
  return rhFetchJson<T>(path, { method: "GET" });
}

/** Backup lógico completo (JSON). Só master; exige Edge Function `rh-backup-export` deployada. */
export async function downloadRhFullBackupFile(): Promise<void> {
  const res = await secureProtectedGet("rh-backup-export");
  if (!res.ok) {
    let msg = `API rh-backup-export: ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (typeof j?.error === "string" && j.error.trim()) msg = j.error;
    } catch {
      /* ignorar */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `people-s-rh-backup-${stamp}.json`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

/** Restaura backup lógico completo (JSON). Só master; substitui dados no schema rh. */
export async function importRhFullBackupPayload(payload: unknown): Promise<{
  ok: boolean;
  tablesRestored?: number;
  totalRows?: number;
}> {
  return secureProtectedPost("rh-backup-import", payload);
}

// --- Dashboard (mock local quando API não configurada) ---
const MOCK_DASHBOARD: DashboardData = {
  turnoverData: [
    { month: "Jan", value: 3.2 }, { month: "Fev", value: 2.8 }, { month: "Mar", value: 4.1 },
    { month: "Abr", value: 3.5 }, { month: "Mai", value: 3.9 }, { month: "Jun", value: 5.2 },
    { month: "Jul", value: 4.8 }, { month: "Ago", value: 3.6 }, { month: "Set", value: 4.2 },
    { month: "Out", value: 3.1 }, { month: "Nov", value: 2.9 }, { month: "Dez", value: 3.4 },
  ],
  headcountData: [
    { sector: "Produção", count: 1420 }, { sector: "Administrativo", count: 680 },
    { sector: "Comercial", count: 520 }, { sector: "TI", count: 340 }, { sector: "RH", count: 180 },
    { sector: "Financeiro", count: 290 }, { sector: "Logística", count: 480 }, { sector: "Qualidade", count: 220 },
  ],
  sectorCostData: [
    { name: "Produção", value: 35 }, { name: "Administrativo", value: 18 }, { name: "Comercial", value: 15 },
    { name: "TI", value: 12 }, { name: "Logística", value: 10 }, { name: "Outros", value: 10 },
  ],
  alerts: [
    { message: "Turnover acima de 5% no setor Produção", severity: "red", sector: "Produção" },
    { message: "Absenteísmo elevado no setor Logística", severity: "yellow", sector: "Logística" },
    { message: "3 cargos sem faixa salarial definida", severity: "yellow", sector: "RH" },
  ],
};

export async function getDashboard(): Promise<DashboardData> {
  if (isApiConfigured()) {
    return fetchWithMockFallback("get-dashboard", MOCK_DASHBOARD);
  }
  return Promise.resolve(MOCK_DASHBOARD);
}

// --- Cargos ---
const MOCK_CARGOS: CargosData = {
  cargos: [
    { cargo: "Diretor", faixaMin: null, faixaMax: null, media: 18900, count: 4 },
    { cargo: "Gerente", faixaMin: null, faixaMax: null, media: 11850, count: 12 },
    { cargo: "Coordenador", faixaMin: null, faixaMax: null, media: 8700, count: 24 },
    { cargo: "Analista Sr.", faixaMin: null, faixaMax: null, media: 7800, count: 86 },
    { cargo: "Analista Pl.", faixaMin: null, faixaMax: null, media: 5600, count: 142 },
    { cargo: "Analista Jr.", faixaMin: null, faixaMax: null, media: 3800, count: 210 },
    { cargo: "Assistente", faixaMin: null, faixaMax: null, media: 3100, count: 380 },
    { cargo: "Operador", faixaMin: null, faixaMax: null, media: 3200, count: 1420 },
    { cargo: "Técnico", faixaMin: null, faixaMax: null, media: 4500, count: 340 },
    { cargo: "Supervisor", faixaMin: null, faixaMax: null, media: 7100, count: 56 },
  ],
  inconsistencias: [
    {
      matricula: "0012",
      nome: "Carlos Eduardo Silva",
      cargo: "Operador de Máquinas",
      setor: "Produção",
      area: "Operacional",
      salario: 4100,
      faixaMin: 1800,
      faixaMax: 3500,
      problema: "Salário 17,14% acima da faixa máxima",
      severity: "red",
    },
    {
      matricula: "0038",
      nome: "João Pedro Lima",
      cargo: "Analista Jr.",
      setor: "TI",
      area: "Administrativa",
      salario: 2600,
      faixaMin: 3000,
      faixaMax: 5000,
      problema: "Salário 13,33% abaixo da faixa mínima",
      severity: "red",
    },
  ],
  salaryBySetor: [
    { setor: "Produção", media: 4200 }, { setor: "TI", media: 8800 }, { setor: "Comercial", media: 6400 },
    { setor: "RH", media: 5900 }, { setor: "Financeiro", media: 7600 }, { setor: "Logística", media: 5100 },
    { setor: "Qualidade", media: 6800 }, { setor: "Administrativo", media: 4100 },
  ],
  areas: ["Administrativa", "Operacional"],
};

export async function getCargos(areas: string[] = []): Promise<CargosData> {
  const params = new URLSearchParams();
  for (const area of areas) {
    const v = area.trim();
    if (v) params.append("areas", v);
  }
  const path = params.toString() ? `get-cargos?${params.toString()}` : "get-cargos";
  if (isApiConfigured()) {
    return secureProtectedJson<CargosData>(path);
  }
  return Promise.resolve(MOCK_CARGOS);
}

export async function setCargoFaixa(input: {
  cargo: string;
  faixaMin: number | null;
  faixaMax: number | null;
  updatedBy: string;
}): Promise<{ ok: boolean }> {
  if (isApiConfigured()) {
    return secureProtectedPost<{ ok: boolean }, { cargo: string; faixaMin: number | null; faixaMax: number | null; updatedBy: string }>(
      "set-cargo-faixa",
      input
    );
  }
  return Promise.resolve({ ok: true });
}

// --- Orgânico (planilha): quando API está configurada, sempre lê do banco (sem fallback para não esconder erro) ---
const MOCK_ORGANICO: OrganicoRow[] = [];

let loginStatsSnapshotTimer: ReturnType<typeof setTimeout> | null = null;

export async function getOrganico(): Promise<OrganicoRow[]> {
  if (isApiConfigured()) {
    const raw = await secureProtectedJson<OrganicoRow[]>("get-organico");
    const rows = normalizeOrganicoApiRows(Array.isArray(raw) ? raw : []);
    /** Snapshot para login: debounce — várias queries compartilham `["organico"]` e podem refetch quase juntas. */
    if (typeof window !== "undefined") {
      if (loginStatsSnapshotTimer != null) clearTimeout(loginStatsSnapshotTimer);
      loginStatsSnapshotTimer = setTimeout(() => {
        loginStatsSnapshotTimer = null;
        void Promise.all([import("@rh/lib/dashboard-from-organico"), import("@rh/lib/login-stats-snapshot")])
          .then(([{ buildDashboardFromOrganico }, { writeLoginStatsSnapshot }]) => {
            const d = buildDashboardFromOrganico(rows);
            writeLoginStatsSnapshot({
              totalColaboradores: d.totalColaboradores,
              setoresAtivos: d.setoresAtivos,
            });
          })
          .catch(() => {});
      }, 500);
    }
    return rows;
  }
  return Promise.resolve(MOCK_ORGANICO);
}

export async function replaceOrganico(rows: OrganicoReplaceRow[], options?: { allowEmpty?: boolean }): Promise<void> {
  if (!isApiConfigured()) return;
  await secureProtectedPost<void, { rows: OrganicoReplaceRow[]; allowEmpty?: boolean }>("replace-organico", {
    rows,
    allowEmpty: options?.allowEmpty === true,
  });
}

export async function getOrganicoComentarios(input: {
  matricula?: string | null;
  nome: string;
}): Promise<OrganicoComentario[]> {
  const nome = String(input.nome ?? "").trim();
  const matricula = String(input.matricula ?? "").trim();
  if (!nome && !matricula) return [];
  if (!isApiConfigured()) return [];

  const params = new URLSearchParams();
  if (nome) params.set("nome", nome);
  if (matricula) params.set("matricula", matricula);
  const raw = await secureProtectedJson<OrganicoComentario[]>(`get-organico-comentarios?${params.toString()}`);
  return Array.isArray(raw) ? raw : [];
}

export async function getOrganicoComentariosResumo(): Promise<OrganicoComentarioResumo[]> {
  if (!isApiConfigured()) return [];
  const raw = await secureProtectedJson<OrganicoComentarioResumo[]>("get-organico-comentarios?summary=1");
  return Array.isArray(raw) ? raw : [];
}

export async function addOrganicoComentario(input: {
  matricula?: string | null;
  colaboradorNome: string;
  comentario: string;
  createdBy: string;
  tagCode: string;
  visibility: "public" | "restricted" | "confidential";
}): Promise<OrganicoComentario> {
  const body = {
    matricula: String(input.matricula ?? "").trim(),
    colaboradorNome: String(input.colaboradorNome ?? "").trim(),
    comentario: String(input.comentario ?? "").trim(),
    createdBy: String(input.createdBy ?? "").trim(),
    tagCode: String(input.tagCode ?? "").trim(),
    visibility: input.visibility,
  };
  if (!body.colaboradorNome) {
    throw new Error("Nome do colaborador é obrigatório.");
  }
  if (!body.comentario) {
    throw new Error("Comentário é obrigatório.");
  }
  if (!body.createdBy) {
    throw new Error("Usuário é obrigatório.");
  }
  if (!body.tagCode) {
    throw new Error("Categoria do comentário é obrigatória.");
  }
  if (!body.visibility) {
    throw new Error("Visibilidade do comentário é obrigatória.");
  }
  if (!isApiConfigured()) {
    return {
      id: randomUUID(),
      colaboradorNome: body.colaboradorNome,
      colaboradorMatricula: body.matricula || null,
      comentario: body.comentario,
      tipo: "comentario",
      categoria: "geral",
      tagCode: body.tagCode,
      visibility: body.visibility,
      campoAlterado: null,
      valorAnterior: null,
      valorAtual: null,
      createdBy: body.createdBy,
      createdAt: new Date().toISOString(),
    };
  }
  return secureProtectedPost<OrganicoComentario, typeof body>("add-organico-comentario", body);
}

export async function getOrganicoAlteracoesPendentes(): Promise<OrganicoAlteracaoPendente[]> {
  if (!isApiConfigured()) return [];
  try {
    const raw = await secureProtectedJson<OrganicoAlteracaoPendente[]>("get-organico-alteracoes-pendentes");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

type UpsertOrganicoAlteracaoPendenteItem = {
  matricula: string;
  colaboradorNome: string;
  setor: string;
  tipo: "ctps" | "cargo";
  campoLabel: string;
  valorAnterior: string;
  valorAtual: string;
  /** YYYY-MM-DD — data na trajetória; opcional (usa data da detecção / hoje). */
  dataReferencia?: string | null;
};

export async function upsertOrganicoAlteracoesPendentes(input: {
  items: UpsertOrganicoAlteracaoPendenteItem[];
}): Promise<{ ok: boolean; upserted: number }> {
  const body = { items: input.items };
  if (!isApiConfigured()) {
    return { ok: true, upserted: input.items.length };
  }
  return secureProtectedPost<{ ok: boolean; upserted: number }, { items: UpsertOrganicoAlteracaoPendenteItem[] }>(
    "upsert-organico-alteracoes-pendentes",
    body,
  );
}

export async function resolveOrganicoAlteracaoPendente(input: { id: string; motivo: string }): Promise<{ ok: boolean }> {
  const body = { id: String(input.id ?? "").trim(), motivo: String(input.motivo ?? "").trim() };
  if (!body.id || !body.motivo) {
    throw new Error("Identificador e motivo são obrigatórios.");
  }
  if (!isApiConfigured()) {
    return { ok: true };
  }
  return secureProtectedPost<{ ok: boolean }, typeof body>("resolve-organico-alteracao-pendente", body);
}

/** Remove pendência aberta (órfã ou ainda listada). Só master — Edge `delete-organico-alteracao-pendente`. */
export async function deleteOrganicoAlteracaoPendente(input: { id: string }): Promise<{ ok: boolean }> {
  const body = { id: String(input.id ?? "").trim() };
  if (!body.id) {
    throw new Error("Pendência inválida.");
  }
  if (!isApiConfigured()) {
    return { ok: true };
  }
  return secureProtectedPost<{ ok: boolean }, typeof body>("delete-organico-alteracao-pendente", body);
}

export async function addOrganicoAtividades(input: {
  matricula?: string | null;
  colaboradorNome: string;
  createdBy: string;
  entries: OrganicoActivityDraft[];
}): Promise<OrganicoComentario[]> {
  const body = {
    matricula: String(input.matricula ?? "").trim(),
    colaboradorNome: String(input.colaboradorNome ?? "").trim(),
    createdBy: String(input.createdBy ?? "").trim(),
    entries: Array.isArray(input.entries) ? input.entries : [],
  };
  if (!body.colaboradorNome) {
    throw new Error("Nome do colaborador é obrigatório.");
  }
  if (!body.createdBy) {
    throw new Error("Usuário é obrigatório.");
  }
  if (body.entries.length === 0) {
    return [];
  }
  if (!isApiConfigured()) {
    return body.entries.map((entry) => ({
      id: randomUUID(),
      colaboradorNome: body.colaboradorNome,
      colaboradorMatricula: body.matricula || null,
      comentario: String(entry.comentario ?? "").trim(),
      tipo: entry.tipo,
      categoria: entry.categoria,
      tagCode: "10",
      visibility: "public",
      campoAlterado: entry.campoAlterado?.trim() || null,
      valorAnterior: entry.valorAnterior?.trim() || null,
      valorAtual: entry.valorAtual?.trim() || null,
      createdBy: body.createdBy,
      createdAt: new Date().toISOString(),
    }));
  }
  return secureProtectedPost<OrganicoComentario[], typeof body>("add-organico-comentario", body);
}

export async function deleteOrganicoComentario(input: { id: string }): Promise<{ ok: boolean }> {
  const body = { id: String(input.id ?? "").trim() };
  if (!body.id) {
    throw new Error("Comentário inválido.");
  }
  if (!isApiConfigured()) {
    return { ok: true };
  }
  return secureProtectedPost<{ ok: boolean }, typeof body>("delete-organico-comentario", body);
}

/** Remove um evento da trajetória. Só usuário master (Edge Function `delete-organico-trajetoria`). */
export async function deleteOrganicoTrajetoria(input: { id: string }): Promise<{ ok: boolean }> {
  const body = { id: String(input.id ?? "").trim() };
  if (!body.id) {
    throw new Error("Evento de trajetória inválido.");
  }
  if (!isApiConfigured()) {
    return { ok: true };
  }
  return secureProtectedPost<{ ok: boolean }, typeof body>("delete-organico-trajetoria", body);
}

export async function getOrganicoTrajetoria(input: {
  matricula?: string | null;
  nome?: string | null;
}): Promise<OrganicoTrajetoriaItem[]> {
  const matricula = String(input.matricula ?? "").trim();
  const nome = String(input.nome ?? "").trim();
  if (!matricula && !nome) return [];
  if (!isApiConfigured()) return [];

  const params = new URLSearchParams();
  if (matricula) params.set("matricula", matricula);
  if (nome) params.set("nome", nome);
  const raw = await secureProtectedJson<OrganicoTrajetoriaItem[]>(`get-organico-trajetoria?${params.toString()}`);
  return Array.isArray(raw) ? raw : [];
}

export async function importOrganicoTrajetoria(rows: OrganicoTrajetoriaImportRow[]): Promise<OrganicoTrajetoriaImportResult> {
  const body = {
    rows: Array.isArray(rows) ? rows : [],
  };
  if (body.rows.length === 0) {
    throw new Error("Nenhuma movimentação foi informada para importação.");
  }
  if (!isApiConfigured()) {
    return {
      ok: true,
      inserted: body.rows.length,
      affectedMatriculas: new Set(body.rows.map((row) => row.matricula.trim()).filter(Boolean)).size,
      skippedRows: 0,
      unresolvedCollaborators: [],
    };
  }
  return secureProtectedPost<OrganicoTrajetoriaImportResult, typeof body>("import-organico-trajetoria", body);
}

function sanitizeUploadFilename(fileName: string): string {
  const normalized = String(fileName ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "upload.pdf";
}

export async function parseOrganicoTrajetoriaPdfUpload(file: File): Promise<OrganicoTrajetoriaParseResult> {
  if (!isApiConfigured()) {
    throw new Error("API não configurada");
  }
  const form = new FormData();
  form.append("file", file, sanitizeUploadFilename(file.name));
  return secureProtectedFormPost<OrganicoTrajetoriaParseResult>("parse-organico-trajetoria-pdf", form);
}

export async function getOrganicoFoto(input: {
  matricula: string;
  nome?: string | null;
}): Promise<OrganicoFoto | null> {
  const matricula = String(input.matricula ?? "").trim();
  const nome = String(input.nome ?? "").trim();
  if (!matricula) return null;
  if (!isApiConfigured()) return null;

  const params = new URLSearchParams({ matricula });
  if (nome) params.set("nome", nome);
  const raw = await secureProtectedJson<OrganicoFoto | { value: null }>(`get-organico-foto?${params.toString()}`);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if ("value" in raw && raw.value === null) return null;
  const foto = raw as Partial<OrganicoFoto>;
  if (!foto.fotoBase64 || !foto.colaboradorMatricula) return null;
  return {
    colaboradorMatricula: String(foto.colaboradorMatricula),
    colaboradorNome: String(foto.colaboradorNome ?? nome),
    fotoBase64: String(foto.fotoBase64),
    mimeType: foto.mimeType == null ? null : String(foto.mimeType),
    updatedBy: foto.updatedBy == null ? null : String(foto.updatedBy),
    updatedAt: foto.updatedAt == null ? null : String(foto.updatedAt),
  };
}

export async function getOrganicoFotosResumo(): Promise<OrganicoFotoResumo[]> {
  if (!isApiConfigured()) return [];
  const raw = await secureProtectedJson<OrganicoFotoResumo[]>("get-organico-foto?summary=1");
  return Array.isArray(raw) ? raw : [];
}

export async function setOrganicoFoto(input: {
  matricula: string;
  nome: string;
  fotoBase64: string;
  mimeType?: string | null;
  updatedBy: string;
}): Promise<{ ok: boolean }> {
  const body = {
    matricula: String(input.matricula ?? "").trim(),
    nome: String(input.nome ?? "").trim(),
    fotoBase64: String(input.fotoBase64 ?? "").trim(),
    mimeType: input.mimeType == null ? null : String(input.mimeType).trim(),
    updatedBy: String(input.updatedBy ?? "").trim(),
  };
  if (!body.matricula) throw new Error("Matrícula do colaborador é obrigatória.");
  if (!body.nome) throw new Error("Nome do colaborador é obrigatório.");
  if (!body.fotoBase64) throw new Error("Foto do colaborador é obrigatória.");
  if (!body.updatedBy) throw new Error("Usuário é obrigatório.");
  if (!isApiConfigured()) return { ok: true };
  return secureProtectedPost<{ ok: boolean }, typeof body>("set-organico-foto", body);
}

export async function deleteOrganicoFoto(input: {
  matricula: string;
}): Promise<{ ok: boolean }> {
  const body = {
    matricula: String(input.matricula ?? "").trim(),
  };
  if (!body.matricula) throw new Error("Matrícula do colaborador é obrigatória.");
  if (!isApiConfigured()) return { ok: true };
  return secureProtectedPost<{ ok: boolean }, typeof body>("delete-organico-foto", body);
}

// --- Config (logo e outras configurações) ---
export async function getConfig(key: string): Promise<{ value: string | null }> {
  if (isApiConfigured()) {
    return secureFetch<{ value: string | null }>(`get-config?key=${encodeURIComponent(key)}`);
  }
  return Promise.resolve({ value: getLocalConfigValue(key) });
}

export async function setConfig(key: string, value: string): Promise<{ ok: boolean }> {
  if (isApiConfigured()) {
    return securePost<{ ok: boolean }, { key: string; value: string }>("set-config", { key, value });
  }
  setLocalConfigValue(key, value);
  return Promise.resolve({ ok: true });
}

// --- Faltas e atestados ---
const MOCK_FALTAS: FaltaRow[] = [
  { id: 1, data: "2025-03-10", mesFalta: "Março", matricula: "001", nomeFuncionario: "Carlos Silva", endereco: "Rua A, 123", area: "Linha 1", setor: "Produção", lider: "João Mendes", periodo: "Integral", qntd: "1", diasTurno: "1/3", tipo: "Atestado", cid: "J11", localAtendimento: "UPA Central", medicoResponsavel: "Dr. Souza", observacoes: "", aprovado: "Sim", reprovado: "" },
  { id: 2, data: "2025-03-12", mesFalta: "Março", matricula: "003", nomeFuncionario: "Pedro Santos", endereco: "Av B, 456", area: "Expedição", setor: "Logística", lider: "Roberto Alves", periodo: "Manhã", qntd: "2", diasTurno: "2/3", tipo: "Falta", cid: "", localAtendimento: "", medicoResponsavel: "", observacoes: "", aprovado: "", reprovado: "Sim" },
];

/**
 * @param months Lista `YYYY-MM`. Se omitido ou vazio, retorna todos os registros (uso em merge ao salvar / exportação completa).
 */
export async function getFaltasAtestados(months?: string[]): Promise<FaltaRow[]> {
  const m = months?.filter((x) => x && /^\d{4}-\d{2}$/.test(x.trim()));
  if (isApiConfigured()) {
    const path =
      m && m.length > 0
        ? `get-faltas-atestados?months=${m.map((x) => encodeURIComponent(x.trim())).join(",")}`
        : "get-faltas-atestados";
    const raw = await secureProtectedJson<FaltaRow[]>(path);
    if (!Array.isArray(raw)) return [];
    return raw.map((r) => ({ ...r, observacoes: r.observacoes ?? "" }));
  }
  let rows = [...MOCK_FALTAS];
  if (m && m.length > 0) {
    const set = new Set(m);
    rows = rows.filter((r) => {
      const ym = r.data?.slice(0, 7);
      return ym && set.has(ym);
    });
  }
  return rows;
}

/**
 * Registros cuja data não cai em nenhum dos meses `YYYY-MM` listados.
 * Não usar como única base para `merge` + `replace-faltas-atestados` (truncate): o merge exige o snapshot completo do servidor.
 */
export async function getFaltasAtestadosExcludingMonths(omitMonths: string[]): Promise<FaltaRow[]> {
  const omit = (omitMonths ?? []).map((x) => x.trim()).filter((x) => /^\d{4}-\d{2}$/.test(x));
  if (!isApiConfigured()) {
    const set = new Set(omit);
    return MOCK_FALTAS.filter((r) => {
      const ym = r.data?.slice(0, 7);
      return ym && !set.has(ym);
    });
  }
  if (omit.length === 0) {
    return getFaltasAtestados();
  }
  const path = `get-faltas-atestados?omitMonths=${omit.map((x) => encodeURIComponent(x)).join(",")}`;
  const raw = await secureProtectedJson<FaltaRow[]>(path);
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({ ...r, observacoes: r.observacoes ?? "" }));
}

/** Meses distintos que possuem registros (YYYY-MM), mais recentes primeiro. */
export async function getFaltasAtestadosMonthList(): Promise<string[]> {
  if (isApiConfigured()) {
    const raw = await secureProtectedJson<unknown>("get-faltas-atestados?distinctMonths=1");
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      if (typeof o.error === "string") {
        return [];
      }
      const m = o.months;
      if (Array.isArray(m)) {
        return m
          .filter((x): x is string => typeof x === "string" && /^\d{4}-\d{2}$/.test(x.trim()))
          .map((x) => x.trim());
      }
    }
    return [];
  }
  const set = new Set<string>();
  for (const r of MOCK_FALTAS) {
    const ym = r.data?.slice(0, 7);
    if (ym) set.add(ym);
  }
  return [...set].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

export async function replaceFaltasAtestados(
  rows: FaltaReplaceRow[],
  options?: { allowEmpty?: boolean },
): Promise<{ ok: boolean; inserted: number; snapshotId?: string | null }> {
  if (!isApiConfigured()) {
    return { ok: true, inserted: rows.length };
  }
  return secureProtectedPost<
    { ok: boolean; inserted: number; snapshotId?: string | null },
    { rows: FaltaReplaceRow[]; allowEmpty?: boolean }
  >(
    "replace-faltas-atestados",
    { rows, allowEmpty: options?.allowEmpty === true },
  );
}

/** Ausências de uma matrícula em intervalo (validação de regras — até 12 meses). */
export async function getFaltasAtestadosHistoricoMatricula(
  matricula: string,
  desde: string,
  ate: string,
): Promise<FaltaRow[]> {
  if (!isApiConfigured()) return [];
  const m = encodeURIComponent(String(matricula ?? "").trim());
  const d = encodeURIComponent(desde);
  const a = encodeURIComponent(ate);
  const raw = await secureProtectedJson<FaltaRow[]>(
    `get-faltas-atestados?matricula=${m}&desde=${d}&ate=${a}`,
  );
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({ ...r, observacoes: r.observacoes ?? "" }));
}

// --- Regras de alerta / inconsistências ---
export async function fetchFaltasAlertaRegrasApi(): Promise<FaltaAlertaRegraRow[]> {
  if (!isApiConfigured()) return [];
  const raw = await secureProtectedJson<FaltaAlertaRegraRow[]>("get-faltas-alerta-regras");
  return Array.isArray(raw) ? raw : [];
}

export async function setFaltasAlertaRegraAtivaApi(
  regraId: string,
  ativa: boolean,
): Promise<FaltaAlertaRegraRow[]> {
  const res = await secureProtectedPost<
    { regras: FaltaAlertaRegraRow[] },
    { regraId: string; ativa: boolean }
  >("set-faltas-alerta-regra-ativa", { regraId, ativa });
  return res.regras ?? [];
}

export async function fetchFaltasAlertaInconsistenciasApi(
  faltasAtivas?: Array<{ id: number | string; matricula: string; data: string }>,
): Promise<FaltaAusenciaInconsistenciaRow[]> {
  if (!isApiConfigured()) return [];
  if (faltasAtivas?.length) {
    return secureProtectedPost<FaltaAusenciaInconsistenciaRow[], { faltasAtivas: typeof faltasAtivas }>(
      "get-faltas-alerta-inconsistencias",
      { faltasAtivas },
    );
  }
  return secureProtectedJson<FaltaAusenciaInconsistenciaRow[]>("get-faltas-alerta-inconsistencias");
}

export async function fetchFaltasAlertaEnquadramentosApi(
  regraId?: string,
): Promise<FaltaAlertaEnquadramentoRow[]> {
  if (!isApiConfigured()) return [];
  const path = regraId
    ? `get-faltas-alerta-enquadramentos?regraId=${encodeURIComponent(regraId)}`
    : "get-faltas-alerta-enquadramentos";
  const raw = await secureProtectedJson<FaltaAlertaEnquadramentoRow[]>(path);
  return Array.isArray(raw) ? raw : [];
}

export async function registrarFaltasAlertaAusenciaApi(input: {
  linha: FaltaRow;
  alertas: Array<{
    regraId: string;
    titulo: string;
    motivo: string;
    baseLegal: string;
    severidade: string;
    contexto?: Record<string, unknown>;
  }>;
  lancadoPor?: string;
}): Promise<{ enquadramentos: FaltaAlertaEnquadramentoRow[]; inconsistencias: FaltaAusenciaInconsistenciaRow[] }> {
  return secureProtectedPost("registrar-faltas-alerta-ausencia", input);
}

export async function updateFaltasAlertaInconsistenciaApi(
  id: string,
  status: FaltaAusenciaInconsistenciaStatus,
  resolucaoNotas?: string,
): Promise<FaltaAusenciaInconsistenciaRow[]> {
  return secureProtectedPost<
    FaltaAusenciaInconsistenciaRow[],
    { id: string; status: FaltaAusenciaInconsistenciaStatus; resolucaoNotas?: string }
  >("update-faltas-alerta-inconsistencia", { id, status, resolucaoNotas });
}

export async function removerFaltasAlertaPorFaltasApi(faltaIds: string[]): Promise<number> {
  const res = await secureProtectedPost<{ removidos: number }, { faltaIds: string[] }>(
    "remover-faltas-alerta-por-faltas",
    { faltaIds },
  );
  return res.removidos ?? 0;
}

// --- Sanções disciplinares ---
const MOCK_SANCOES: SancaoDisciplinarRow[] = [
  {
    id: 1,
    matricula: "100",
    nomeFuncionario: "Exemplo Colaborador",
    tipo: "Advertência",
    dataAplicacao: "2025-06-15",
    mes: "jun.",
    ano: "2025",
    observacoes: "",
  },
];

export async function getSancoesDisciplinares(months?: string[]): Promise<SancaoDisciplinarRow[]> {
  const m = months?.filter((x) => x && /^\d{4}-\d{2}$/.test(x.trim()));
  if (isApiConfigured()) {
    const path =
      m && m.length > 0
        ? `get-sancoes-disciplinares?months=${m.map((x) => encodeURIComponent(x.trim())).join(",")}`
        : "get-sancoes-disciplinares";
    const raw = await secureProtectedJson<SancaoDisciplinarRow[]>(path);
    if (!Array.isArray(raw)) return [];
    return raw.map((r) => ({
      ...r,
      observacoes: r.observacoes ?? "",
      dataAplicacao: r.dataAplicacao ? String(r.dataAplicacao).slice(0, 10) : "",
    }));
  }
  let rows = [...MOCK_SANCOES];
  if (m && m.length > 0) {
    const set = new Set(m);
    rows = rows.filter((r) => {
      const ym = r.dataAplicacao?.slice(0, 7);
      return ym && set.has(ym);
    });
  }
  return rows;
}

/** Não usar sozinho para merge + replace (truncate); o merge precisa da lista completa do servidor. */
export async function getSancoesDisciplinaresExcludingMonths(omitMonths: string[]): Promise<SancaoDisciplinarRow[]> {
  const omit = (omitMonths ?? []).map((x) => x.trim()).filter((x) => /^\d{4}-\d{2}$/.test(x));
  if (!isApiConfigured()) {
    const set = new Set(omit);
    return MOCK_SANCOES.filter((r) => {
      const ym = r.dataAplicacao?.slice(0, 7);
      return ym && !set.has(ym);
    });
  }
  if (omit.length === 0) {
    return getSancoesDisciplinares();
  }
  const path = `get-sancoes-disciplinares?omitMonths=${omit.map((x) => encodeURIComponent(x)).join(",")}`;
  const raw = await secureProtectedJson<SancaoDisciplinarRow[]>(path);
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => ({
    ...r,
    observacoes: r.observacoes ?? "",
    dataAplicacao: r.dataAplicacao ? String(r.dataAplicacao).slice(0, 10) : "",
  }));
}

export async function getSancoesDisciplinaresMonthList(): Promise<string[]> {
  if (isApiConfigured()) {
    const raw = await secureProtectedJson<unknown>("get-sancoes-disciplinares?distinctMonths=1");
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      if (typeof o.error === "string") return [];
      const months = o.months;
      if (Array.isArray(months)) {
        return months
          .filter((x): x is string => typeof x === "string" && /^\d{4}-\d{2}$/.test(x.trim()))
          .map((x) => x.trim());
      }
    }
    return [];
  }
  const set = new Set<string>();
  for (const r of MOCK_SANCOES) {
    const ym = r.dataAplicacao?.slice(0, 7);
    if (ym) set.add(ym);
  }
  return [...set].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

export async function replaceSancoesDisciplinares(
  rows: SancaoDisciplinarReplaceRow[],
  options?: { allowEmpty?: boolean },
): Promise<{ ok: boolean; inserted: number; snapshotId?: string | null }> {
  if (!isApiConfigured()) {
    return { ok: true, inserted: rows.length };
  }
  return secureProtectedPost<
    { ok: boolean; inserted: number; snapshotId?: string | null },
    { rows: SancaoDisciplinarReplaceRow[]; allowEmpty?: boolean }
  >(
    "replace-sancoes-disciplinares",
    { rows, allowEmpty: options?.allowEmpty === true },
  );
}

function normalizeFaltaCadastroItem(r: unknown): FaltaCadastroItem | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  return {
    id: String(o.id ?? ""),
    ordem: typeof o.ordem === "number" ? o.ordem : Number(o.ordem) || 0,
    valor: o.valor != null ? String(o.valor) : "",
    contabilizaIndicadores:
      typeof o.contabilizaIndicadores === "boolean"
        ? o.contabilizaIndicadores
        : typeof o.contabiliza_indicadores === "boolean"
          ? (o.contabiliza_indicadores as boolean)
          : undefined,
    classificacaoIndicador:
      typeof o.classificacaoIndicador === "string"
        ? (o.classificacaoIndicador as "justificada" | "injustificada")
        : typeof o.classificacao_indicador === "string"
          ? (o.classificacao_indicador as "justificada" | "injustificada")
          : null,
    exibirNoDetalhamento:
      typeof o.exibirNoDetalhamento === "boolean"
        ? o.exibirNoDetalhamento
        : typeof o.exibir_no_detalhamento === "boolean"
          ? (o.exibir_no_detalhamento as boolean)
          : undefined,
  };
}

function defaultCategoriasDocumentosCadastro(): FaltaCadastroItem[] {
  return DEFAULT_DOCUMENT_CATEGORY_LABELS.map((valor, index) => ({
    id: `def-doc-cat-${index}`,
    ordem: index + 1,
    valor,
  }));
}

function normalizeFaltaCadastrosData(raw: unknown): FaltaCadastrosData {
  if (!raw || typeof raw !== "object") {
    return { periodos: [], tipos: [], cids: [], tiposSancoes: [], categoriasDocumentos: defaultCategoriasDocumentosCadastro() };
  }
  const o = raw as Record<string, unknown>;
  const list = (k: "periodos" | "tipos" | "cids" | "tiposSancoes" | "categoriasDocumentos") => {
    const a = o[k];
    if (!Array.isArray(a)) return [];
    return a.map(normalizeFaltaCadastroItem).filter((x): x is FaltaCadastroItem => x != null);
  };
  const categoriasFromApi = list("categoriasDocumentos");
  const categoriasDocumentos = Object.prototype.hasOwnProperty.call(o, "categoriasDocumentos")
    ? categoriasFromApi
    : categoriasFromApi.length > 0
      ? categoriasFromApi
      : defaultCategoriasDocumentosCadastro();
  return {
    periodos: list("periodos"),
    tipos: list("tipos"),
    cids: list("cids"),
    tiposSancoes: list("tiposSancoes"),
    categoriasDocumentos,
  };
}

export async function getFaltasCadastros(): Promise<FaltaCadastrosData> {
  if (isApiConfigured()) {
    const raw = await secureProtectedJson<unknown>("get-faltas-cadastros");
    return normalizeFaltaCadastrosData(raw);
  }
  return { periodos: [], tipos: [], cids: [], tiposSancoes: [], categoriasDocumentos: defaultCategoriasDocumentosCadastro() };
}

export async function replaceFaltasCadastros(
  payload: FaltaCadastrosReplacePayload,
  options?: { allowEmpty?: boolean },
): Promise<{ ok: boolean; inserted: number; snapshotId?: string | null }> {
  const body: FaltaCadastrosReplacePayload = {
    periodos: Array.isArray(payload.periodos) ? payload.periodos : [],
    tipos: Array.isArray(payload.tipos) ? payload.tipos : [],
    cids: Array.isArray(payload.cids) ? payload.cids : [],
    tiposSancoes: Array.isArray(payload.tiposSancoes) ? payload.tiposSancoes : [],
    categoriasDocumentos: Array.isArray(payload.categoriasDocumentos) ? payload.categoriasDocumentos : [],
    tiposRegras: Array.isArray(payload.tiposRegras) ? payload.tiposRegras : [],
  };
  const inserted =
    body.periodos.map((s) => String(s).trim()).filter(Boolean).length +
    body.tipos.map((s) => String(s).trim()).filter(Boolean).length +
    body.cids.map((s) => String(s).trim()).filter(Boolean).length +
    body.tiposSancoes.map((s) => String(s).trim()).filter(Boolean).length +
    body.categoriasDocumentos.map((s) => String(s).trim()).filter(Boolean).length;
  if (!isApiConfigured()) {
    return { ok: true, inserted };
  }
  return secureProtectedPost<
    { ok: boolean; inserted: number; snapshotId?: string | null },
    FaltaCadastrosReplacePayload & { allowEmpty?: boolean }
  >(
    "replace-faltas-cadastros",
    { ...body, allowEmpty: options?.allowEmpty === true },
  );
}

// --- Secullum (integração ponto) ---
export type SecullumFuncionario = {
  numeroFolha: string;
  nome: string;
  empresaId: number | null;
  empresaNome: string;
  desligado: boolean;
  demissao: string;
  /** Motivo de demissão (API Pessoas / Integração Externa Secullum). */
  motivoDemissao: string;
  statusFuncionario: string;
  statusDetalhado: string;
  cpf: string;
  rg: string;
  pis: string;
  nascimento: string;
  admissao: string;
  cargo: string;
  setor: string;
  area: string;
  telefone: string;
  telefoneEmergencial: string;
  sexo: string;
  ctps: string;
  endereco: string;
};

export type OrganicoRepresentante = {
  representanteKey?: string;
  /** Nome fantasia (Nomus: campo nome). */
  nome: string;
  /** Razão social (Nomus: nomeRazaoSocial). */
  nomeRazaoSocial: string;
} & Partial<OrganicoRepresentanteDraft>;

const ORGANICO_REPRESENTANTE_DEFAULT_SETOR = "VENDAS - REPRESENTANTES";

function normalizeOrganicoRepresentante(
  raw: Partial<OrganicoRepresentante> & { nomeRazaoSocial?: string },
): OrganicoRepresentante {
  const names = splitRepresentanteNames(raw);
  const representanteKey = raw.representanteKey || buildRepresentanteKey(names.nome, names.nomeRazaoSocial);
  return {
    ...(raw as OrganicoRepresentante),
    ...names,
    representanteKey,
  };
}

function mergeRepresentanteNames(
  fromNomus: { nome: string; nomeRazaoSocial: string },
  fromDb: { nome: string; nomeRazaoSocial: string } | null,
): { nome: string; nomeRazaoSocial: string } {
  const nomusDistinto = representanteNomesDistintos(fromNomus.nome, fromNomus.nomeRazaoSocial);
  if (nomusDistinto) return fromNomus;
  return {
    nome: fromNomus.nome || fromDb?.nome || "",
    nomeRazaoSocial: fromNomus.nomeRazaoSocial || fromDb?.nomeRazaoSocial || fromNomus.nome || fromDb?.nome || "",
  };
}

function isOrganicoRepresentanteExcluido(
  rep: Pick<OrganicoRepresentante, "nome" | "nomeRazaoSocial" | "representanteKey">,
): boolean {
  return !shouldIncludeOrganicoRepresentante(rep.nome, rep.nomeRazaoSocial);
}

async function syncOrganicoRepresentantesAtivos(representantes: OrganicoRepresentante[]): Promise<void> {
  if (!isApiConfigured() || representantes.length === 0) return;
  await secureProtectedPost<{ ok: boolean; synced?: number }, {
    representantes: Array<{ representanteKey: string; nome: string; nomeRazaoSocial: string }>;
    updatedBy: string;
  }>("sync-organico-representantes", {
    representantes: representantes
      .filter((rep) => !isOrganicoRepresentanteExcluido(rep))
      .map((rep) => ({
        representanteKey: rep.representanteKey || buildRepresentanteKey(rep.nome, rep.nomeRazaoSocial),
        nome: rep.nome,
        nomeRazaoSocial: rep.nomeRazaoSocial,
      }))
      .filter((rep) => rep.representanteKey && (rep.nome || rep.nomeRazaoSocial)),
    updatedBy: "sync-representantes",
  });
}

async function getOrganicoRepresentantesDadosSalvos(): Promise<Map<string, OrganicoRepresentante>> {
  if (!isApiConfigured()) return new Map();
  try {
    const raw = await secureProtectedJson<{ representantes?: OrganicoRepresentante[] }>("get-organico-representantes-dados");
    const map = new Map<string, OrganicoRepresentante>();
    for (const rep of (raw?.representantes ?? []).filter((item) => !isOrganicoRepresentanteExcluido(item))) {
      const normalized = normalizeOrganicoRepresentante(rep);
      const key = normalized.representanteKey || buildRepresentanteKey(normalized.nome, normalized.nomeRazaoSocial);
      if (key) map.set(key, normalized);
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function getOrganicoRepresentantesAtivos(): Promise<OrganicoRepresentante[]> {
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  const mergeSaved = async (base: OrganicoRepresentante[]): Promise<OrganicoRepresentante[]> => {
    try {
      await syncOrganicoRepresentantesAtivos(base);
    } catch {
      // A listagem não deve falhar caso a sincronização em lote encontre instabilidade momentânea.
    }
    const saved = await getOrganicoRepresentantesDadosSalvos();
    return base.filter((rep) => !isOrganicoRepresentanteExcluido(rep)).map((rep) => {
      const fromNomus = splitRepresentanteNames(rep);
      const key = rep.representanteKey || buildRepresentanteKey(fromNomus.nome, fromNomus.nomeRazaoSocial);
      const persisted = saved.get(key);
      const names = mergeRepresentanteNames(
        fromNomus,
        persisted ? splitRepresentanteNames(persisted) : null,
      );
      return {
        ...persisted,
        ...rep,
        representanteKey: key,
        nome: names.nome,
        nomeRazaoSocial: names.nomeRazaoSocial,
        setor: ORGANICO_REPRESENTANTE_DEFAULT_SETOR,
      };
    });
  };

  if (isRhApiConfigured()) {
    try {
      const raw = await secureProtectedJson<{ representantes?: OrganicoRepresentante[] }>("get-organico-representantes");
      if (Array.isArray(raw?.representantes)) {
        return mergeSaved(raw.representantes.map((item) => normalizeOrganicoRepresentante(item)));
      }
    } catch {
      const saved = await getOrganicoRepresentantesDadosSalvos();
      if (saved.size > 0) return Array.from(saved.values());
      throw new Error("Não foi possível carregar representantes na integração nem no banco.");
    }
  }

  if (!isLocalhost) return Array.from((await getOrganicoRepresentantesDadosSalvos()).values());

  return [];
}

export async function setOrganicoRepresentante(input: {
  representanteKey: string;
  nome: string;
  nomeRazaoSocial: string;
  draft: OrganicoRepresentanteDraft;
  updatedBy: string;
}): Promise<{ ok: boolean }> {
  if (!isApiConfigured()) return { ok: true };
  return secureProtectedPost<{ ok: boolean }, typeof input>("set-organico-representante", input);
}

/** Resposta de get-pontualidade-ponto (snapshot JSON no schema rh). */
export type PontualidadePontoRemote = {
  rows: unknown[];
  dateRangeStart: string;
  dateRangeEnd: string;
  updatedAt: string | null;
};

export async function getPontualidadePonto(): Promise<PontualidadePontoRemote> {
  if (!isApiConfigured()) {
    return { rows: [], dateRangeStart: "", dateRangeEnd: "", updatedAt: null };
  }
  return secureFetch<PontualidadePontoRemote>("get-pontualidade-ponto");
}

export async function replacePontualidadePonto(payload: {
  rows: unknown[];
  dateRangeStart?: string;
  dateRangeEnd?: string;
  allowEmpty?: boolean;
}): Promise<{ ok: boolean; count: number; snapshotId?: string | null }> {
  const body = {
    rows: Array.isArray(payload.rows) ? payload.rows : [],
    dateRangeStart: typeof payload.dateRangeStart === "string" ? payload.dateRangeStart : "",
    dateRangeEnd: typeof payload.dateRangeEnd === "string" ? payload.dateRangeEnd : "",
    allowEmpty: payload.allowEmpty === true,
  };
  if (!isApiConfigured()) {
    return { ok: true, count: body.rows.length };
  }
  return secureProtectedPost<{ ok: boolean; count: number; snapshotId?: string | null }, typeof body>(
    "replace-pontualidade-ponto",
    body,
  );
}

export async function getSecullumFuncionarios(): Promise<SecullumFuncionario[]> {
  const data = await rhFetchJson<{ funcionarios?: SecullumFuncionario[] }>("secullum-funcionarios", {
    method: "GET",
  });
  return Array.isArray(data.funcionarios) ? data.funcionarios : [];
}

/**
 * Nº folha/Matrícula: apenas dígitos, sem zeros à esquerda ("000093" ≡ "93").
 * Usado para cruzar Orgânico ↔ Secullum quando o formato difere.
 */
export function normalizeMatriculaFolha(value: string): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.replace(/^0+/, "") || "0";
}

/** True se algum valor do set corresponde à matrícula (mesma regra da integração Secullum). */
export function secullumMatriculaSetMatchesOrganico(set: Set<string>, matriculaOrg: string): boolean {
  const m = String(matriculaOrg ?? "").trim();
  if (!m) return false;
  if (set.has(m)) return true;
  const target = normalizeMatriculaFolha(m);
  if (!target || target === "0") return false;
  for (const entry of set) {
    if (normalizeMatriculaFolha(String(entry)) === target) return true;
  }
  return false;
}

/** Busca em mapa API (demissão, etc.) quando a chave é nº folha Secullum sem bater string com o Orgânico. */
export function lookupValueByMatriculaFolha<T>(record: Record<string, T>, matriculaOrg: string): T | undefined {
  const m = String(matriculaOrg ?? "").trim();
  if (!m) return undefined;
  const direct = record[m];
  if (direct !== undefined && direct !== null && String(direct).trim() !== "") return direct;
  const target = normalizeMatriculaFolha(m);
  if (!target || target === "0") return undefined;
  for (const [k, val] of Object.entries(record)) {
    if (normalizeMatriculaFolha(k) === target) return val;
  }
  return undefined;
}

/** Localiza funcionário da lista Secullum por matrícula (nº folha), com fallback por dígitos. */
export function findSecullumFuncionarioByMatricula(
  list: SecullumFuncionario[],
  matricula: string,
): SecullumFuncionario | undefined {
  const m = String(matricula ?? "").trim();
  if (!m) return undefined;
  const direct = list.find((f) => String(f.numeroFolha).trim() === m);
  if (direct) return direct;
  const target = normalizeMatriculaFolha(m);
  if (!target || target === "0") return undefined;
  return list.find((f) => normalizeMatriculaFolha(String(f.numeroFolha ?? "")) === target);
}

/** Usuário do app (tabela rh.app_users), sem senha. */
export type RhAppUserGroupPublic = {
  id: string;
  name: string;
  description: string;
  permissions: RhGroupPermissions;
  createdAt: string;
  updatedAt: string;
};

export type RhAppUserPublic = {
  id: string;
  username: string;
  groupId: string;
  groupName: string;
  permissions: RhGroupPermissions;
  createdAt: string;
};

export type RhLoginResult = {
  token: string;
  username: string;
  role: "master" | "user";
  permissions?: RhGroupPermissions;
};

async function secureRhPost<TResponse, TBody>(
  path: string,
  _sessionToken: string,
  body: TBody,
): Promise<TResponse> {
  return rhFetchJson<TResponse>(path, { method: "POST", body });
}

/** Login legado — autenticação é feita pelo Gestor. */
export async function rhLogin(_username: string, _password: string): Promise<RhLoginResult> {
  throw new Error("Use o login do Gestor de Pedidos para acessar o módulo RH.");
}

/** Permissões atuais do grupo no banco — alinha o espelho local (`rh_route_permissions`) após alterações em Configurações. */
export async function getRhSessionPermissions(): Promise<RhGroupPermissions> {
  const json = (await secureProtectedJson<{ permissions?: RhGroupPermissions; master?: boolean }>(
    "rh-session-permissions",
  )) as { permissions?: RhGroupPermissions; master?: boolean };
  if (json.master) {
    throw new Error("Sessão master não utiliza permissões de grupo.");
  }
  if (!json.permissions) {
    throw new Error("Permissões indisponíveis.");
  }
  return json.permissions;
}

export async function rhUsersList(sessionToken: string): Promise<RhAppUserPublic[]> {
  const data = await secureRhPost<{ users: RhAppUserPublic[] }, Record<string, never>>(
    "rh-users-list",
    sessionToken,
    {},
  );
  return Array.isArray(data.users) ? data.users : [];
}

export async function rhUsersCreate(
  sessionToken: string,
  payload: { username: string; password: string; groupId: string },
): Promise<RhAppUserPublic> {
  const data = await secureRhPost<{ user: RhAppUserPublic }, typeof payload>("rh-users-create", sessionToken, payload);
  if (!data.user) throw new Error("Resposta inválida");
  return data.user;
}

export async function rhUsersUpdate(
  sessionToken: string,
  payload: { id: string; password?: string; groupId?: string },
): Promise<RhAppUserPublic> {
  const data = await secureRhPost<{ user: RhAppUserPublic }, typeof payload>("rh-users-update", sessionToken, payload);
  if (!data.user) throw new Error("Resposta inválida");
  return data.user;
}

export async function rhUsersDelete(sessionToken: string, id: string): Promise<void> {
  await secureRhPost<{ ok: boolean }, { id: string }>("rh-users-delete", sessionToken, { id });
}

export async function rhUserGroupsList(sessionToken: string): Promise<RhAppUserGroupPublic[]> {
  const data = await secureRhPost<{ groups: RhAppUserGroupPublic[] }, Record<string, never>>(
    "rh-user-groups-list",
    sessionToken,
    {},
  );
  return Array.isArray(data.groups) ? data.groups : [];
}

export async function rhUserGroupsCreate(
  sessionToken: string,
  payload: { name: string; description?: string; permissions: RhGroupPermissions },
): Promise<RhAppUserGroupPublic> {
  const data = await secureRhPost<{ group: RhAppUserGroupPublic }, typeof payload>("rh-user-groups-create", sessionToken, payload);
  if (!data.group) throw new Error("Resposta inválida");
  return data.group;
}

export async function rhUserGroupsUpdate(
  sessionToken: string,
  payload: { id: string; name?: string; description?: string; permissions?: RhGroupPermissions },
): Promise<RhAppUserGroupPublic> {
  const data = await secureRhPost<{ group: RhAppUserGroupPublic }, typeof payload>("rh-user-groups-update", sessionToken, payload);
  if (!data.group) throw new Error("Resposta inválida");
  return data.group;
}

export async function rhUserGroupsDelete(sessionToken: string, id: string): Promise<void> {
  await secureRhPost<{ ok: boolean }, { id: string }>("rh-user-groups-delete", sessionToken, { id });
}

export { isApiConfigured, getRequiredRhSessionToken };
