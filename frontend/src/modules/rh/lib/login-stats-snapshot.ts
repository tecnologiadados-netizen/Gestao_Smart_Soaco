/**
 * Indicadores exibidos na tela de login (colaboradores ativos / setores) sem chamar API protegida.
 * Gravados após uma sessão autenticada que já carregou o orgânico (ex.: Dashboard).
 */
const KEY = "rh_login_stats_snapshot_v1";

export type LoginStatsSnapshot = {
  totalColaboradores: number;
  setoresAtivos: number;
  savedAt: string;
};

export function readLoginStatsSnapshot(): LoginStatsSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<LoginStatsSnapshot>;
    const totalColaboradores = Number(j?.totalColaboradores);
    const setoresAtivos = Number(j?.setoresAtivos);
    const savedAt = typeof j?.savedAt === "string" ? j.savedAt : "";
    if (!Number.isFinite(totalColaboradores) || !Number.isFinite(setoresAtivos) || totalColaboradores < 0 || setoresAtivos < 0) {
      return null;
    }
    if (!savedAt) return null;
    return { totalColaboradores, setoresAtivos, savedAt };
  } catch {
    return null;
  }
}

export function writeLoginStatsSnapshot(input: { totalColaboradores: number; setoresAtivos: number }): void {
  if (typeof window === "undefined") return;
  try {
    const payload: LoginStatsSnapshot = {
      totalColaboradores: Math.max(0, Math.floor(input.totalColaboradores)),
      setoresAtivos: Math.max(0, Math.floor(input.setoresAtivos)),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}
