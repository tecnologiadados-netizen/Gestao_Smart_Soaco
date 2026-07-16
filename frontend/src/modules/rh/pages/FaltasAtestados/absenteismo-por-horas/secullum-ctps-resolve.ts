import type { SecullumFuncionario } from "@rh/lib/api-client";
import { parseCtpsToNumber } from "@rh/pages/Organico/organico-derive";
import type { CtpsSource } from "./types";
import { normalizeAbsenteismoNomeKey, normalizeMatriculaKey } from "./organico-match";

/** Mapa número da folha / matrícula → CTPS (API Secullum). */
export function buildCtpsByNumeroFolhaNormFromSecullum(rows: SecullumFuncionario[] | undefined | null): Map<string, number> {
  const m = new Map<string, number>();
  if (!rows?.length) return m;
  for (const f of rows) {
    const id = String(f.numeroFolha ?? "").trim();
    if (!id) continue;
    const key = normalizeMatriculaKey(id);
    if (!key) continue;
    m.set(key, parseCtpsToNumber(f.ctps));
  }
  return m;
}

/**
 * CTPS por nome normalizado na API — em homônimos, prioriza quem **não** está desligado na Secullum.
 */
export function buildCtpsByNomeNormFromSecullum(rows: SecullumFuncionario[] | undefined | null): Map<string, number> {
  const m = new Map<string, { ctps: number; rank: number }>();
  if (!rows?.length) return new Map();
  for (const f of rows) {
    const nome = String(f.nome ?? "").trim();
    if (!nome) continue;
    const key = normalizeAbsenteismoNomeKey(nome);
    if (!key) continue;
    const ctps = parseCtpsToNumber(f.ctps);
    const rank = f.desligado ? 1 : 0;
    const prev = m.get(key);
    if (!prev || rank < prev.rank) {
      m.set(key, { ctps, rank });
    }
  }
  const out = new Map<string, number>();
  for (const [k, v] of m) {
    out.set(k, v.ctps);
  }
  return out;
}

/**
 * CTPS para custo: **primeiro** API Secullum (matrícula planilha → matrícula orgânico → nome),
 * depois cadastro Orgânico (planilha/API rh) como fallback.
 */
export function resolveCtpsForAbsenteismoRow(p: {
  nomeKey: string;
  matriculaPlanilha: string;
  matriculaOrganico: string;
  secullumByMat: Map<string, number>;
  secullumByNome: Map<string, number>;
  organicoByMat: Map<string, number>;
  organicoByNome: Map<string, number>;
}): { ctps: number; source: CtpsSource } {
  const fromMat = (mat: string, map: Map<string, number>): number | null => {
    const k = normalizeMatriculaKey(mat);
    if (!k) return null;
    const c = map.get(k);
    return c != null && c > 0 ? c : null;
  };

  const s1 = fromMat(p.matriculaPlanilha, p.secullumByMat);
  if (s1 != null) return { ctps: s1, source: "secullum" };
  const s2 = fromMat(p.matriculaOrganico, p.secullumByMat);
  if (s2 != null) return { ctps: s2, source: "secullum" };

  const sNome = p.secullumByNome.get(p.nomeKey);
  if (sNome != null && sNome > 0) return { ctps: sNome, source: "secullum" };

  const o1 = fromMat(p.matriculaPlanilha, p.organicoByMat);
  if (o1 != null) return { ctps: o1, source: "organico" };
  const o2 = fromMat(p.matriculaOrganico, p.organicoByMat);
  if (o2 != null) return { ctps: o2, source: "organico" };

  const oNome = p.organicoByNome.get(p.nomeKey) ?? 0;
  if (oNome > 0) return { ctps: oNome, source: "organico" };
  return { ctps: 0, source: "organico" };
}
