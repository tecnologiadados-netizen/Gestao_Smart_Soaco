export type FaltaAlertaBaseLegal = 'clt' | 'previdenciario' | 'politica_interna' | 'operacional';
export type FaltaAlertaSeveridade = 'alta' | 'media' | 'baixa';
export type FaltaAusenciaInconsistenciaStatus = 'pendente' | 'em_analise' | 'resolvida' | 'ignorada';

function s(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function isoDate(v: unknown): string {
  const raw = s(v);
  if (!raw) return '';
  return raw.slice(0, 10);
}

function isoDateTime(v: unknown): string {
  const raw = s(v);
  if (!raw) return new Date().toISOString();
  return raw;
}

export function mapRegraRow(r: Record<string, unknown>) {
  return {
    id: s(r.id),
    titulo: s(r.titulo),
    descricao: s(r.descricao),
    baseLegal: s(r.base_legal) as FaltaAlertaBaseLegal,
    referenciaLegal: s(r.referencia_legal) || undefined,
    limiteResumo: s(r.limite_resumo),
    ativa: r.ativa !== false,
    ordem: typeof r.ordem === 'number' ? r.ordem : Number(r.ordem) || 0,
    severidadePadrao: (s(r.severidade_padrao) || 'media') as FaltaAlertaSeveridade,
    updatedAt: r.updated_at ? String(r.updated_at) : undefined,
    updatedBy: s(r.updated_by) || undefined,
  };
}

export function mapInconsistenciaRow(r: Record<string, unknown>) {
  return {
    id: s(r.id),
    faltaId: s(r.falta_id),
    enquadramentoId: s(r.enquadramento_id) || undefined,
    regraId: s(r.regra_id),
    titulo: s(r.titulo),
    descricao: s(r.descricao),
    baseLegal: s(r.base_legal) as FaltaAlertaBaseLegal,
    severidade: (s(r.severidade) || 'media') as FaltaAlertaSeveridade,
    status: (s(r.status) || 'pendente') as FaltaAusenciaInconsistenciaStatus,
    matricula: s(r.matricula),
    nomeFuncionario: s(r.nome_funcionario),
    dataAusencia: isoDate(r.data_ausencia),
    diasAcumulados: r.dias_acumulados == null ? undefined : Number(r.dias_acumulados),
    limiteDias: r.limite_dias == null ? undefined : Number(r.limite_dias),
    grupoCidId: s(r.grupo_cid_id) || undefined,
    grupoCidTitulo: s(r.grupo_cid_titulo) || undefined,
    detectadaEm: isoDateTime(r.detectada_em),
    resolvidaEm: r.resolvida_em ? String(r.resolvida_em) : undefined,
    resolucaoNotas: s(r.resolucao_notas) || undefined,
    resolvidoPor: s(r.resolvido_por) || undefined,
    lancadoPor: s(r.lancado_por) || undefined,
  };
}

export function mapEnquadramentoRow(
  r: Record<string, unknown>,
  inc?: ReturnType<typeof mapInconsistenciaRow>,
) {
  return {
    id: s(r.id),
    regraId: s(r.regra_id),
    faltaId: s(r.falta_id),
    inconsistenciaId: s(r.inconsistencia_id) || inc?.id || undefined,
    matricula: s(r.matricula),
    nomeFuncionario: s(r.nome_funcionario),
    dataAusencia: isoDate(r.data_ausencia),
    tipo: s(r.tipo),
    cid: s(r.cid) || undefined,
    motivo: s(r.motivo),
    contexto: (r.contexto && typeof r.contexto === 'object' ? r.contexto : undefined) as
      | Record<string, unknown>
      | undefined,
    lancadoPor: s(r.lancado_por),
    detectadaEm: isoDateTime(r.detectada_em),
    statusResolucao: (inc?.status ?? 'pendente') as FaltaAusenciaInconsistenciaStatus,
    resolvidaEm: inc?.resolvidaEm,
    resolucaoNotas: inc?.resolucaoNotas,
    resolvidoPor: inc?.resolvidoPor,
  };
}

export function normalizeMatriculaAusencia(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/^0+/, '')
    .toUpperCase();
}

export type AusenciaAtivaRef = { id: string | number; matricula: string; data: string };

function faltaIdSet(ids: Iterable<string>): Set<string> {
  return new Set([...ids].map((id) => String(id).trim().toLowerCase()).filter(Boolean));
}

function chaveAusenciaOperacional(matricula: string, dataAusencia: string): string {
  return `${String(matricula ?? '').trim()}|${String(dataAusencia ?? '').trim().slice(0, 10)}`;
}

function indiceAusenciasAtivas(faltas: AusenciaAtivaRef[]) {
  const ids = new Set<string>();
  const chaves = new Set<string>();
  const idPorChave = new Map<string, string>();
  for (const f of faltas) {
    const id = String(f.id ?? '').trim();
    const idNorm = id.toLowerCase();
    if (idNorm) ids.add(idNorm);
    const chave = chaveAusenciaOperacional(f.matricula, f.data);
    chaves.add(chave);
    if (id) idPorChave.set(chave, id);
  }
  return { ids, chaves, idPorChave };
}

export function reconciliarInconsistenciasDb<
  T extends {
    id: string;
    faltaId: string;
    matricula: string;
    dataAusencia: string;
    enquadramentoId?: string;
    status: FaltaAusenciaInconsistenciaStatus;
    resolvidaEm?: string;
    resolucaoNotas?: string;
    resolvidoPor?: string;
  },
>(
  inconsistencias: T[],
  faltasAtivas: AusenciaAtivaRef[],
): { next: T[]; removidos: number } {
  if (faltasAtivas.length === 0) return { next: inconsistencias, removidos: 0 };

  const indice = indiceAusenciasAtivas(faltasAtivas);
  const next: T[] = [];
  let removidos = 0;

  for (const inc of inconsistencias) {
    const faltaId = String(inc.faltaId ?? '').trim();
    const faltaIdNorm = faltaId.toLowerCase();
    if (faltaIdNorm && indice.ids.has(faltaIdNorm)) {
      next.push(inc);
      continue;
    }
    const idAtual = indice.idPorChave.get(chaveAusenciaOperacional(inc.matricula, inc.dataAusencia));
    if (idAtual) {
      next.push({ ...inc, faltaId: idAtual });
      continue;
    }
    if (indice.chaves.has(chaveAusenciaOperacional(inc.matricula, inc.dataAusencia))) {
      next.push(inc);
      continue;
    }
    removidos += 1;
  }

  return { next, removidos };
}

export function enquadramentoIdsOrfaos(
  enquadramentos: Array<{ id: string; faltaId: string; matricula: string; dataAusencia: string; inconsistenciaId?: string }>,
  inconsistencias: Array<{ id: string; enquadramentoId?: string }>,
  faltasAtivas: AusenciaAtivaRef[],
): Set<string> {
  if (faltasAtivas.length === 0) return new Set();
  const incIds = new Set(inconsistencias.map((i) => i.id));
  const indice = indiceAusenciasAtivas(faltasAtivas);
  const orphan = new Set<string>();

  for (const e of enquadramentos) {
    if (e.inconsistenciaId && !incIds.has(e.inconsistenciaId)) {
      orphan.add(e.id);
      continue;
    }
    const faltaIdNorm = String(e.faltaId ?? '').trim().toLowerCase();
    if (faltaIdNorm && indice.ids.has(faltaIdNorm)) continue;
    if (indice.chaves.has(chaveAusenciaOperacional(e.matricula, e.dataAusencia))) continue;
    orphan.add(e.id);
  }
  return orphan;
}

export function idsParaRemoverPorFaltas(faltaIds: Iterable<string>): Set<string> {
  return faltaIdSet(faltaIds);
}
