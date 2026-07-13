import { colaboradorAtivo, type ColaboradorAtivoResolver } from '../data/ativosMatriculas'
import {
  acumularCidPlanilha,
  resolverGrupoCid,
  type CidAgregadoPlanilha,
} from './cidGrupos'

type CidAgregadoAcc = CidAgregadoPlanilha & { melhorLinhaQtd: number }

export type Categoria = 'Injustificada' | 'Justificada' | 'Não classificado'

const INJUSTIFICADA = new Set<string>([
  'FALTA INJUSTIFICADA PELO COLABORADOR',
  'FALTA INJUSTIFICADA PROCEDENTE',
  'FALTA JUSTIFICADA PELO COLABORADOR',
])

/** Suspensão disciplinar é medida aplicada (ausência justificada no sentido operacional do painel). */
function tipoEhSuspensaoDisciplinar(tipo: string): boolean {
  const raw = (tipo || '').trim()
  if (!raw) return false
  const n = raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
  return n.includes('SUSPEN') && n.includes('DISCIPLINAR')
}

export function classifyTipo(tipo: string): Categoria {
  const t = (tipo || '').trim()
  if (!t) return 'Não classificado'
  if (tipoEhSuspensaoDisciplinar(t)) return 'Justificada'
  if (INJUSTIFICADA.has(t)) return 'Injustificada'
  return 'Justificada'
}

export interface AbsenceRow {
  data: Date | null
  matricula: number
  nome: string
  area: string
  setor: string
  lider: string
  qntd: number
  tipo: string
  /** Coluna CID da planilha (índice 11 na aba padrão de 14 colunas). */
  cid: string
  endereco: string
  localAtendimento: string
  medicoResponsavel: string
  qntdOriginal: string
  contaIndicadores?: boolean
  exibirNoDetalhamento?: boolean
  categoria: Categoria
  anoMes: string
}

/** Converte célula de data (Excel serial, Date ou string dd/mm/aaaa). */
export function parseDataCell(v: unknown): Date | null {
  if (v == null || v === '') return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v
  if (typeof v === 'number' && v > 20000) {
    const epoch = Date.UTC(1899, 11, 30)
    const ms = epoch + Math.round(v) * 86400000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof v === 'string') {
    const s = v.trim()
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (m) {
      const day = Number(m[1])
      const month = Number(m[2]) - 1
      const year = Number(m[3])
      const d = new Date(year, month, day)
      return Number.isNaN(d.getTime()) ? null : d
    }
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export function toAnoMes(d: Date | null): string {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Colunas da aba padrão (alinhadas ao `_COL_ORDER` do Python RH). */
const COL_QTD = 8
const COL_DIAS_HORAS = 9

/**
 * Número a partir da célula QNTD: aceita número, string "344", "0,5", "34,25" (pt-BR).
 */
function parseQtdCell(v: unknown): number | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return null
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null
    return v
  }
  const s = String(v).trim()
  if (!s) return null
  let t = s
  if (/^\d+[.,]\d+/.test(t)) {
    t = t.replace(/\./g, '').replace(',', '.')
  } else {
    t = t.replace(',', '.')
  }
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? n : null
}

/**
 * Quando QNTD (I) vem vazia, muitos arquivos RH colocam a quantidade só em DIAS/HORAS (J), ex.: "20 DIA", "0,5 TURNO".
 * Extrai apenas o primeiro valor numérico do início da string para não contaminar totais em 0.
 */
function parseQtdFromDiasHoras(v: unknown): number | null {
  const s = String(v ?? '').trim()
  if (!s) return null
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*/i)
  if (!m) return null
  let num = m[1]
  if (/^\d+[.,]\d+/.test(num)) {
    num = num.replace(/\./g, '').replace(',', '.')
  } else {
    num = num.replace(',', '.')
  }
  const n = Number.parseFloat(num)
  return Number.isFinite(n) ? n : null
}

/**
 * Resolve quantidade por linha: prioriza QNTD (col I); se vazio/ inválido, usa número inicial em DIAS/HORAS (col J).
 */
export function resolveLinhaPlanilhaQtd(row: unknown[]): number {
  const dhStr = String(row[COL_DIAS_HORAS] ?? '').trim()
  const qtdParsed = parseQtdCell(row[COL_QTD])
  const dhParsed = parseQtdFromDiasHoras(row[COL_DIAS_HORAS])
  const qtdBlank =
    row[COL_QTD] == null || String(row[COL_QTD]).trim() === '' || qtdParsed === null
  /** Excel às vezes grava 0 na QNTD enquanto o valor real está em DIAS/HORAS ("20 DIA"). */
  const zeroMasDiasHorasTemValor =
    qtdParsed === 0 &&
    dhParsed != null &&
    dhParsed > 0 &&
    /DIA|TURNO|HORA/i.test(dhStr)

  if (qtdBlank && dhParsed != null && dhParsed >= 0) return dhParsed
  if (zeroMasDiasHorasTemValor) return dhParsed
  if (qtdParsed != null && Number.isFinite(qtdParsed)) return Math.max(0, qtdParsed)
  if (dhParsed != null && dhParsed >= 0) return dhParsed
  return 0
}

export function normalizeRows(matrix: unknown[][]): AbsenceRow[] {
  const out: AbsenceRow[] = []
  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i]
    if (!Array.isArray(r) || r.length < 11) continue
    const data = parseDataCell(r[0])
    const matricula = Number(r[1]) || 0
    const nome = String(r[2] ?? '').trim() || `Mat. ${matricula || '?'}`
    const area = String(r[4] ?? '').trim() || '(Não informado)'
    const setor = String(r[5] ?? '').trim() || '(Não informado)'
    const lider = String(r[6] ?? '').trim() || '(Não informado)'
    const qntd = resolveLinhaPlanilhaQtd(r)
    const tipo = String(r[10] ?? '').trim()
    const cidRaw = r.length > 11 ? r[11] : null
    const cid =
      cidRaw != null && String(cidRaw).trim() !== '' ? String(cidRaw).trim() : '(Sem CID)'
    const endereco = String(r[3] ?? '').trim()
    const localAtendimento = String(r[12] ?? '').trim()
    const medicoResponsavel = String(r[13] ?? '').trim()
    const categoria = classifyTipo(tipo)
    const anoMes = toAnoMes(data)
    out.push({
      data,
      matricula,
      nome,
      area,
      setor,
      lider,
      qntd,
      tipo,
      cid,
      endereco,
      localAtendimento,
      medicoResponsavel,
      qntdOriginal: String(r[8] ?? '').trim(),
      contaIndicadores: true,
      exibirNoDetalhamento: true,
      categoria,
      anoMes,
    })
  }
  return out
}

export function filterRows(
  rows: AbsenceRow[],
  opts: {
    from: Date | null
    to: Date | null
    areas: string[]
    setores: string[]
    lideres: string[]
  },
): AbsenceRow[] {
  return rows.filter((row) => {
    if (opts.from && row.data && row.data < startOfDay(opts.from)) return false
    if (opts.to && row.data && row.data > endOfDay(opts.to)) return false
    if (opts.areas.length && !opts.areas.includes(row.area)) return false
    if (opts.setores.length && !opts.setores.includes(row.setor)) return false
    if (opts.lideres.length && !opts.lideres.includes(row.lider)) return false
    return true
  })
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function kpis(rows: AbsenceRow[]) {
  let total = 0
  let inj = 0
  let jus = 0
  let nao = 0
  for (const r of rows) {
    total += r.qntd
    if (r.categoria === 'Injustificada') inj += r.qntd
    else if (r.categoria === 'Justificada') jus += r.qntd
    else nao += r.qntd
  }
  const pctInj = total > 0 ? (inj / total) * 100 : 0
  const pctJus = total > 0 ? (jus / total) * 100 : 0
  return { total, inj, jus, nao, pctInj, pctJus, ocorrencias: rows.length }
}

export interface MesAgg {
  anoMes: string
  injust: number
  just: number
  nao: number
}

export function aggregateMonthly(rows: AbsenceRow[]): MesAgg[] {
  const map = new Map<string, MesAgg>()
  for (const r of rows) {
    if (!r.anoMes) continue
    const cur = map.get(r.anoMes) ?? { anoMes: r.anoMes, injust: 0, just: 0, nao: 0 }
    if (r.categoria === 'Injustificada') cur.injust += r.qntd
    else if (r.categoria === 'Justificada') cur.just += r.qntd
    else cur.nao += r.qntd
    map.set(r.anoMes, cur)
  }
  return [...map.values()].sort((a, b) => a.anoMes.localeCompare(b.anoMes))
}

/** Percentual de dias justificados no mês: just / (injust + just + nao) × 100. */
export function pctJustificadasPorMes(monthly: MesAgg[]): { anoMes: string; pct: number }[] {
  return monthly.map((m) => {
    const tot = m.injust + m.just + m.nao
    const pct = tot > 0 ? (m.just / tot) * 100 : 0
    return { anoMes: m.anoMes, pct }
  })
}

/**
 * Média aritmética dos percentuais mensais acima (apenas meses com total de dias > 0).
 * Corresponde à “média do % geral” pedida no cartão executivo.
 */
export function mediaPctJustificadasMensais(monthly: MesAgg[]): number {
  const vals: number[] = []
  for (const m of monthly) {
    const tot = m.injust + m.just + m.nao
    if (tot > 0) vals.push((m.just / tot) * 100)
  }
  if (!vals.length) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

/** Distribuição de QNTD para o donut: atestados (coluna tipo), faltas injustificadas, restantes justificados/outros. */
export interface DistribuicaoDiasPerdidosTipo {
  atestados: number
  faltasInjustificadas: number
  declaracoesOutrosJustificados: number
}

/**
 * Soma QNTD por grupo visual: injustificadas → “faltas”; tipo normalizado começa por ATESTADO → atestados;
 * demais linhas (justificadas ou não classificado que não caiu nas anteriores) → declarações / outros justificados.
 */
export function distribuicaoDiasPerdidosPorTipo(rows: AbsenceRow[]): DistribuicaoDiasPerdidosTipo {
  let atestados = 0
  let faltasInjustificadas = 0
  let declaracoesOutrosJustificados = 0
  for (const r of rows) {
    if (r.categoria === 'Injustificada') {
      faltasInjustificadas += r.qntd
      continue
    }
    const k = normalizeTipoParaCidKey(r.tipo)
    if (k.startsWith('ATESTADO')) atestados += r.qntd
    else declaracoesOutrosJustificados += r.qntd
  }
  return { atestados, faltasInjustificadas, declaracoesOutrosJustificados }
}

/** Top N valores distintos da coluna **tipo**, só linhas classificadas como justificadas, ordenado por soma QNTD. */
export function topByTipoJustificadas(rows: AbsenceRow[], n = 10): { name: string; qntd: number }[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    if (r.categoria !== 'Justificada') continue
    const t = r.tipo.trim() || '(Sem tipo)'
    map.set(t, (map.get(t) ?? 0) + r.qntd)
  }
  return [...map.entries()]
    .map(([name, qntd]) => ({ name, qntd }))
    .sort((a, b) => b.qntd - a.qntd)
    .slice(0, n)
}

/** Ordem exibição: segunda → domingo (para leitura semanal). */
const DIA_SEMANA_SEG_DOM = [1, 2, 3, 4, 5, 6, 0] as const
const LABEL_DIA_CURTO: Record<number, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
  0: 'Domingo',
}

/** Soma de QNTD por dia da semana da data do registro (segunda a domingo). */
export function qntdPorDiaSemana(rows: AbsenceRow[]): { name: string; qntd: number }[] {
  const totals = new Map<number, number>()
  for (const dow of DIA_SEMANA_SEG_DOM) totals.set(dow, 0)
  for (const r of rows) {
    if (!r.data) continue
    const dow = r.data.getDay()
    totals.set(dow, (totals.get(dow) ?? 0) + r.qntd)
  }
  const monSun = DIA_SEMANA_SEG_DOM.map((dow) => ({
    name: LABEL_DIA_CURTO[dow],
    qntd: totals.get(dow) ?? 0,
  }))
  /** No gráfico horizontal, o último item fica no topo — segunda no topo. */
  return [...monSun].reverse()
}

/** Top N tipos de ausência (coluna tipo), todas as categorias. */
export function topTiposAusencia(rows: AbsenceRow[], n = 5): { name: string; qntd: number }[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    const t = r.tipo.trim() || '(Sem tipo)'
    map.set(t, (map.get(t) ?? 0) + r.qntd)
  }
  return [...map.entries()]
    .map(([name, qntd]) => ({ name, qntd }))
    .sort((a, b) => b.qntd - a.qntd)
    .slice(0, n)
}

/** Normaliza texto para comparar tipo de ausência (acentos opcionais). */
function normalizeTipoParaCidKey(t: string): string {
  return t
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Apenas estas linhas entram no ranking de CID (coluna tipo da planilha). */
export function tipoIncluiNoRankingCid(tipo: string): boolean {
  const k = normalizeTipoParaCidKey(tipo)
  if (
    k === 'DECLARACAO ACOMPANHAMENTO' ||
    k === 'DECLARACAO COMPARECIMENTO'
  ) {
    return true
  }
  if (k.startsWith('ATESTADO')) return true
  return false
}

/** CID ignorado no ranking: vazio, placeholder da folha ou “sem CID”. */
export function cidValidoParaRanking(cid: string): boolean {
  const c = cid.trim()
  if (!c) return false
  const u = c.toUpperCase().normalize('NFD').replace(/\p{M}/gu, '')
  /** Texto explícito na célula (atestado/declaração com marcador de folha, não “célula vazia”). */
  const marcadorCidAusenteNaFolha =
    (u.includes('CID') && u.includes('AUSENTE')) ||
    (u.includes('CID') && u.includes('INEXISTENTE'))
  if (marcadorCidAusenteNaFolha) return true
  if (u === '(SEM CID)') return false
  if (u.includes('SEM CID')) return false
  if (u.includes('AUSENTE')) return false
  if (u.includes('NAO CONSTA') || u.includes('NÃO CONSTA')) return false
  if (u === '-' || u === '—') return false
  return true
}

/**
 * Top N CIDs por QNTD, só a partir de registros tipo ATESTADO* ou declarações
 * de comparecimento/acompanhamento, e apenas com CID preenchido (não placeholders).
 */
export function topCids(rows: AbsenceRow[], n = 15): { name: string; qntd: number }[] {
  const map = new Map<string, CidAgregadoAcc>()
  for (const r of rows) {
    if (!tipoIncluiNoRankingCid(r.tipo)) continue
    if (!cidValidoParaRanking(r.cid)) continue
    acumularCidPlanilha(map, r.cid, r.qntd)
  }
  return [...map.values()]
    .map(({ rotulo, qntd }) => ({ name: rotulo, qntd }))
    .sort((a, b) => b.qntd - a.qntd)
    .slice(0, n)
}

export interface DetalheCidNoGrupo {
  cid: string
  qntd: number
}

export interface GrupoSintomaCid {
  /** Chave estável do grupo (família CID). */
  id: string
  /** Cabeçalho explicativo do agrupamento. */
  titulo: string
  /** Soma de QNTD de todos os registros naquele grupo. */
  qntd: number
  /** CIDs conforme aparecem na planilha, com dias respectivos (ordenados). */
  cids: DetalheCidNoGrupo[]
}

/**
 * Ranking por grupos clínicos (CID-10), mesmos filtros de `topCids`; cada grupo agrega vários códigos.
 */
export function topGruposSintomaCid(rows: AbsenceRow[], n = 15): GrupoSintomaCid[] {
  const byCid = new Map<string, CidAgregadoAcc>()
  for (const r of rows) {
    if (!tipoIncluiNoRankingCid(r.tipo)) continue
    if (!cidValidoParaRanking(r.cid)) continue
    acumularCidPlanilha(byCid, r.cid, r.qntd)
  }

  const grupos = new Map<string, { titulo: string; cids: Map<string, { rotulo: string; qntd: number }> }>()
  for (const ag of byCid.values()) {
    const cidRef = ag.chave.startsWith('livre:') ? ag.rotulo : ag.chave
    const { id, titulo } = resolverGrupoCid(cidRef)
    let g = grupos.get(id)
    if (!g) {
      g = { titulo, cids: new Map() }
      grupos.set(id, g)
    }
    g.cids.set(ag.chave, { rotulo: ag.rotulo, qntd: ag.qntd })
  }

  return [...grupos.entries()]
    .map(([id, { titulo, cids }]) => ({
      id,
      titulo,
      qntd: [...cids.values()].reduce((a, x) => a + x.qntd, 0),
      cids: [...cids.values()]
        .map(({ rotulo, qntd }) => ({ cid: rotulo, qntd }))
        .sort((a, b) => b.qntd - a.qntd),
    }))
    .sort((a, b) => b.qntd - a.qntd)
    .slice(0, n)
}

export function topDim(rows: AbsenceRow[], key: 'setor' | 'lider', n = 10) {
  const map = new Map<string, number>()
  for (const r of rows) {
    const k = r[key]
    map.set(k, (map.get(k) ?? 0) + r.qntd)
  }
  return [...map.entries()]
    .map(([name, qntd]) => ({ name, qntd }))
    .sort((a, b) => b.qntd - a.qntd)
    .slice(0, n)
}

const LIDER_IGNORADOS = new Set(['(Não informado)', '-', ''])

export interface LiderSetorRank {
  /** Nome do líder que mais vezes aparece na coluna líder nas linhas daquele setor. */
  name: string
  /** Setor ao qual o cartão se refere (um líder pode ter dois cartões se for predominante em dois setores). */
  setorPrincipal: string
  /** Soma de QNTD de **todo** o setor na visão atual (mesmo critério do painel). */
  diasNoSetor: number
  /** Soma de QNTD justificadas no mesmo setor (detalhe do cartão). */
  diasJustificadosNoSetor: number
  /** Soma de QNTD injustificadas no mesmo setor (detalhe do cartão). */
  diasInjustificadosNoSetor: number
}

/**
 * Ranking de líderes pelo volume de dias perdidos no **setor**:
 * por cada setor, o “líder” mostrado é quem **mais vezes** aparece na coluna líder
 * (contagem de linhas, não soma de QNTD). Empate: desempate alfabético.
 * Uma linha por setor; totais do cartão = todo o setor (como antes).
 */
export function rankLideresPorDiasNoSetor(rows: AbsenceRow[], limit = 10): LiderSetorRank[] {
  /** Por setor: quantas linhas têm cada nome na coluna líder */
  const contagensLiderPorSetor = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const L = r.lider.trim()
    if (!L || LIDER_IGNORADOS.has(L)) continue
    const S = r.setor.trim() || '(Não informado)'
    if (!contagensLiderPorSetor.has(S)) contagensLiderPorSetor.set(S, new Map())
    const m = contagensLiderPorSetor.get(S)!
    m.set(L, (m.get(L) ?? 0) + 1)
  }

  const totaisPorSetor = new Map<string, number>()
  const justPorSetor = new Map<string, number>()
  const injustPorSetor = new Map<string, number>()
  for (const r of rows) {
    const S = r.setor.trim() || '(Não informado)'
    totaisPorSetor.set(S, (totaisPorSetor.get(S) ?? 0) + r.qntd)
    if (r.categoria === 'Justificada') justPorSetor.set(S, (justPorSetor.get(S) ?? 0) + r.qntd)
    else if (r.categoria === 'Injustificada') injustPorSetor.set(S, (injustPorSetor.get(S) ?? 0) + r.qntd)
  }

  const out: LiderSetorRank[] = []
  for (const [setorPrincipal, liderCounts] of contagensLiderPorSetor) {
    let name = ''
    let best = -1
    for (const [L, cnt] of liderCounts) {
      if (cnt > best || (cnt === best && L.localeCompare(name, 'pt-BR') < 0)) {
        best = cnt
        name = L
      }
    }
    if (!name) continue
    out.push({
      name,
      setorPrincipal,
      diasNoSetor: totaisPorSetor.get(setorPrincipal) ?? 0,
      diasJustificadosNoSetor: justPorSetor.get(setorPrincipal) ?? 0,
      diasInjustificadosNoSetor: injustPorSetor.get(setorPrincipal) ?? 0,
    })
  }

  out.sort(
    (a, b) =>
      b.diasNoSetor - a.diasNoSetor ||
      a.setorPrincipal.localeCompare(b.setorPrincipal, 'pt-BR'),
  )
  return out.slice(0, limit)
}

export interface FaltanteNoMes {
  nome: string
  matricula: number
  dias: number
  /** true se a matrícula consta na base de ativos informada pelo RH. */
  ativo: boolean
}

type FaltanteAgg = Omit<FaltanteNoMes, 'ativo'>

/** Top N colaboradores por soma de QNTD no mês e categoria (justificada / injustificada). */
export function topFaltantesNoMes(
  rows: AbsenceRow[],
  anoMes: string,
  categoria: 'Justificada' | 'Injustificada',
  limit = 5,
  isAtivo: ColaboradorAtivoResolver = colaboradorAtivo,
): FaltanteNoMes[] {
  const map = new Map<number, FaltanteAgg>()
  for (const r of rows) {
    if (r.anoMes !== anoMes || r.categoria !== categoria) continue
    const cur = map.get(r.matricula) ?? {
      nome: r.nome.trim() || `Mat. ${r.matricula}`,
      matricula: r.matricula,
      dias: 0,
    }
    cur.dias += r.qntd
    if (r.nome.trim()) cur.nome = r.nome.trim()
    map.set(r.matricula, cur)
  }
  return [...map.values()]
    .map((row) => ({ ...row, ativo: isAtivo(row.matricula) }))
    .sort((a, b) => b.dias - a.dias)
    .slice(0, limit)
}

/**
 * Intervalo [tMin, tMax] em ms: dos últimos 6 meses até a data mais recente com ausência **justificada** e data
 * preenchida (alinhado ao resumo executivo). Sem essas linhas devolve `null`.
 */
export function janelaUltimos6MesesJustificadas(rows: AbsenceRow[]): { tMin: number; tMax: number } | null {
  const candidatas = rows.filter((r) => r.data && r.categoria === 'Justificada')
  if (!candidatas.length) return null
  const maxT = Math.max(...candidatas.map((r) => r.data!.getTime()))
  const refAte = new Date(maxT)
  const refDe = new Date(refAte)
  refDe.setMonth(refDe.getMonth() - 6)
  return { tMin: refDe.getTime(), tMax: refAte.getTime() }
}

/** Primeira parte do título longo do grupo CID (alinhado ao cartão executivo). */
function tituloGrupoCurtoGestao(titulo: string, max = 90): string {
  const base = (titulo.split('·')[0] ?? titulo).trim()
  return base.length > max ? `${base.slice(0, max - 1)}…` : base
}

export type ColaboradorAtencaoGestao6m = {
  nome: string
  matricula: number
  setor: string
  diasPerdidosJustificados: number
  principalGrupoSintomas: string
  ativo: boolean
}

/**
 * Colaboradores **ativos** com maior soma de dias (QNTD) em ausências **justificadas** na janela dos últimos 6 meses
 * (âncora: data mais recente com justificada e data preenchida — igual a `janelaUltimos6MesesJustificadas`).
 * Desligados (`isAtivo` = false) não entram no ranking. Setor = setor onde acumulou mais dias nesse período;
 * grupo de sintomas = maior soma entre linhas com CID rankeável.
 */
export function topColaboradoresJustificadosAtencao6Meses(
  rows: AbsenceRow[],
  limit = 10,
  isAtivo: ColaboradorAtivoResolver = colaboradorAtivo,
): ColaboradorAtencaoGestao6m[] {
  const janela = janelaUltimos6MesesJustificadas(rows)
  if (!janela) return []

  type Agg = {
    nome: string
    matricula: number
    diasTotal: number
    porSetor: Map<string, number>
    gruposCid: Map<string, { titulo: string; qntd: number }>
  }

  const map = new Map<number, Agg>()

  for (const r of rows) {
    if (r.categoria !== 'Justificada' || !r.data) continue
    const t = r.data.getTime()
    if (t < janela.tMin || t > janela.tMax) continue

    const m = r.matricula
    const setor = (r.setor ?? '').trim() || '(Sem setor)'
    const nome = r.nome.trim() || `Mat. ${m}`

    let cur = map.get(m)
    if (!cur) {
      cur = { nome, matricula: m, diasTotal: 0, porSetor: new Map(), gruposCid: new Map() }
      map.set(m, cur)
    }
    cur.diasTotal += r.qntd
    if (r.nome.trim()) cur.nome = r.nome.trim()
    cur.porSetor.set(setor, (cur.porSetor.get(setor) ?? 0) + r.qntd)

    if (tipoIncluiNoRankingCid(r.tipo) && cidValidoParaRanking(r.cid)) {
      const g = resolverGrupoCid(r.cid)
      const ex = cur.gruposCid.get(g.id) ?? { titulo: g.titulo, qntd: 0 }
      ex.qntd += r.qntd
      ex.titulo = g.titulo
      cur.gruposCid.set(g.id, ex)
    }
  }

  const out: ColaboradorAtencaoGestao6m[] = []

  for (const cur of map.values()) {
    if (cur.diasTotal <= 0) continue
    if (!isAtivo(cur.matricula)) continue

    let setorPrincipal = ''
    let bestSetorDias = -1
    for (const [s, d] of cur.porSetor) {
      if (
        d > bestSetorDias ||
        (d === bestSetorDias && (setorPrincipal === '' || s.localeCompare(setorPrincipal, 'pt-BR') < 0))
      ) {
        bestSetorDias = d
        setorPrincipal = s
      }
    }

    let principalGrupo = 'Sem grupo identificado'
    let bestG = -1
    let bestTitulo = ''
    for (const { titulo, qntd } of cur.gruposCid.values()) {
      if (qntd > bestG || (qntd === bestG && titulo.localeCompare(bestTitulo, 'pt-BR') < 0)) {
        bestG = qntd
        bestTitulo = titulo
      }
    }
    if (bestG > 0) principalGrupo = tituloGrupoCurtoGestao(bestTitulo)

    out.push({
      nome: cur.nome,
      matricula: cur.matricula,
      setor: setorPrincipal,
      diasPerdidosJustificados: cur.diasTotal,
      principalGrupoSintomas: principalGrupo,
      ativo: isAtivo(cur.matricula),
    })
  }

  out.sort(
    (a, b) =>
      b.diasPerdidosJustificados - a.diasPerdidosJustificados ||
      a.nome.localeCompare(b.nome, 'pt-BR'),
  )
  return out.slice(0, limit)
}

/** Top N colaboradores por soma de QNTD no setor e categoria; opcionalmente só linhas com `data` na janela [tMin,tMax]. */
export function topFaltantesNoSetor(
  rows: AbsenceRow[],
  setor: string,
  categoria: 'Justificada' | 'Injustificada',
  limit = 5,
  janelaData?: { tMin: number; tMax: number } | null,
  isAtivo: ColaboradorAtivoResolver = colaboradorAtivo,
): FaltanteNoMes[] {
  const s = setor.trim()
  if (!s) return []
  const map = new Map<number, FaltanteAgg>()
  for (const r of rows) {
    if (r.setor.trim() !== s || r.categoria !== categoria) continue
    if (janelaData) {
      if (!r.data) continue
      const t = r.data.getTime()
      if (t < janelaData.tMin || t > janelaData.tMax) continue
    }
    const cur = map.get(r.matricula) ?? {
      nome: r.nome.trim() || `Mat. ${r.matricula}`,
      matricula: r.matricula,
      dias: 0,
    }
    cur.dias += r.qntd
    if (r.nome.trim()) cur.nome = r.nome.trim()
    map.set(r.matricula, cur)
  }
  return [...map.values()]
    .map((row) => ({ ...row, ativo: isAtivo(row.matricula) }))
    .sort((a, b) => b.dias - a.dias)
    .slice(0, limit)
}

export function uniqueSorted(rows: AbsenceRow[], key: 'area' | 'setor' | 'lider') {
  return [...new Set(rows.map((r) => r[key]))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
