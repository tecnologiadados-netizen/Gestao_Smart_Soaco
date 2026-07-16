import * as XLSX from 'xlsx'
import { parseDataCell, toAnoMes } from './absences'

export type SancaoRow = {
  id: string
  matricula: string
  nome: string
  tipo: string
  dataAplicacao: string
  mes: string
  ano: number
  obs: string
}

export type SancaoVinculadaDetalhe = {
  id: string
  matricula: string
  nome: string
  tipo: string
  dataAplicacao: string
  obs: string
}

export type SancoesResumoOk = {
  ok: true
  /** Nome sugerido para referência no texto */
  arquivoLabel: string
  total: number
  aplicacoesAteFimDe2024: number
  aplicacoesDesde2025: number
  /** Anos com pelo menos um registro, ordenados */
  porAno: { ano: number; qtd: number }[]
  /** Sanções por mês (`YYYY-MM`), alinhado ao eixo da evolução de ausências. */
  porAnoMes: { anoMes: string; qtd: number }[]
  porAnoMesFaltaInjustificadaDesidia: { anoMes: string; qtd: number }[]
  detalhesPorAnoMesFaltaInjustificadaDesidia: Record<string, SancaoVinculadaDetalhe[]>
  totalFaltaInjustificadaDesidia: number
  tiposPrincipais: { label: string; qtd: number }[]
  motivosPrincipais: { label: string; qtd: number }[]
}

export type SancoesResumo = SancoesResumoOk | { ok: false; error: string }

const COL = {
  id: 'ID',
  nome: 'NOME',
  tipo: 'TIPO',
  data: 'DATA DA APLICAÇÃO',
  mes: 'MÊS',
  ano: 'ANO',
  obs: 'OBS',
} as const

function cell(r: Record<string, unknown>, key: string): string {
  const v = r[key]
  if (v == null) return ''
  return String(v).trim()
}

function parseAno(v: unknown): number {
  const n = Number.parseInt(String(v ?? '').trim(), 10)
  return Number.isFinite(n) ? n : NaN
}

/** Agrupa variações de advertência / suspensão para leitura executiva */
export function normalizarTipoSancao(tipo: string): string {
  const t = tipo.replace(/\s+/g, ' ').trim()
  const u = t.toUpperCase()
  if (u.includes('SUSPEN')) return 'Suspensão disciplinar'
  if (/^AD\.?\s*VERBAL/.test(u) || (u.startsWith('AD') && u.includes('VERBAL'))) return 'Advertência verbal'
  if (/^AD\.?\s*DISCIPLINAR/.test(u) || u.startsWith('AD.DISCIPLINAR')) return 'Advertência disciplinar'
  return t || 'Demais tipos'
}

function classificarMotivoObs(obs: string): string {
  const o = obs.toUpperCase()
  if (o.includes('FALTA INJUSTIFICADA')) return 'Falta injustificada'
  if (o.includes('FALTA')) return 'Falta / ausência'
  if (o.includes('ATRASO')) return 'Atraso'
  if (o.includes('DESACATO') || o.includes('INSUBORD')) return 'Desacato / insubordinação'
  if (o.includes('CONDUTA') || o.includes('COMPORTAMENTO')) return 'Conduta / comportamento'
  if (o.includes('EPIS') || o.includes(' EPI') || o.includes('EPI ')) return 'EPI / segurança'
  if (o.includes('ACIDENTE') || o.includes('SEGURAN')) return 'Segurança do trabalho'
  if (o.length > 4) return 'Outros motivos (ver observação)'
  return 'Não informado'
}

function topMap(map: Map<string, number>, n: number): { label: string; qtd: number }[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, qtd]) => ({ label, qtd }))
}

const MESES_NORM = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const

function stripDiacritics(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
}

/** Interpreta coluna MÊS (número, nome ou abreviação em pt-BR). */
function parseMesPortugues(mesRaw: string): number | null {
  const raw = mesRaw.trim()
  if (!raw) return null
  const low = stripDiacritics(raw)
  const asInt = Number.parseInt(low.replace(/^0+/, '') || '0', 10)
  if (asInt >= 1 && asInt <= 12) return asInt
  for (let i = 0; i < 12; i++) {
    if (low.includes(MESES_NORM[i]) || low.startsWith(MESES_ABREV[i])) return i + 1
  }
  return null
}

function parseDataAplicacaoSancao(raw: string): Date | null {
  const s = raw.trim()
  if (!s) return null
  const fromText = parseDataCell(s)
  if (fromText) return fromText
  const n = Number.parseFloat(s.replace(',', '.'))
  if (Number.isFinite(n) && n > 20000) return parseDataCell(n)
  return null
}

/** Mês `YYYY-MM` para cruzar com `MesAgg.anoMes` (prioriza data de aplicação). */
function resolveAnoMesSancao(r: SancaoRow): string | null {
  const d = parseDataAplicacaoSancao(r.dataAplicacao)
  if (d) return toAnoMes(d)
  const m = parseMesPortugues(r.mes)
  if (m != null && Number.isFinite(r.ano) && r.ano >= 1900) {
    return `${r.ano}-${String(m).padStart(2, '0')}`
  }
  return null
}

export function parseSancoesSheet(buf: ArrayBuffer): SancaoRow[] {
  const wb = XLSX.read(buf, { type: 'array', cellDates: false })
  const name = wb.SheetNames.find((n) => /san/i.test(n) || /hist/i.test(n)) ?? wb.SheetNames[0]
  if (!name) return []
  const sheet = wb.Sheets[name]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const out: SancaoRow[] = []
  for (const r of raw) {
    const ano = parseAno(r[COL.ano])
    if (!Number.isFinite(ano)) continue
    out.push({
      id: cell(r, COL.id),
      matricula: cell(r, COL.id),
      nome: cell(r, COL.nome),
      tipo: cell(r, COL.tipo),
      dataAplicacao: cell(r, COL.data),
      mes: cell(r, COL.mes),
      ano,
      obs: cell(r, COL.obs),
    })
  }
  return out
}

export function motivoVinculadoFaltaInjustificadaOuDesidia(obs: string): boolean {
  const n = stripDiacritics(String(obs ?? ''))
  if (!n) return false
  return n.includes('injustificad') || n.includes('desidia')
}

export function buildSancoesResumo(rows: SancaoRow[], arquivoLabel: string): SancoesResumoOk {
  const porAnoMap = new Map<number, number>()
  const porAnoMesMap = new Map<string, number>()
  const porAnoMesFaltaInjustificadaDesidiaMap = new Map<string, number>()
  const detalhesPorAnoMesFaltaInjustificadaDesidia: Record<string, SancaoVinculadaDetalhe[]> = {}
  const tipoMap = new Map<string, number>()
  const motivoMap = new Map<string, number>()
  let aplicacoesAteFimDe2024 = 0
  let aplicacoesDesde2025 = 0
  let totalFaltaInjustificadaDesidia = 0

  for (const r of rows) {
    const am = resolveAnoMesSancao(r)
    if (am) porAnoMesMap.set(am, (porAnoMesMap.get(am) ?? 0) + 1)
    porAnoMap.set(r.ano, (porAnoMap.get(r.ano) ?? 0) + 1)
    const nt = normalizarTipoSancao(r.tipo)
    tipoMap.set(nt, (tipoMap.get(nt) ?? 0) + 1)
    const m = classificarMotivoObs(r.obs)
    motivoMap.set(m, (motivoMap.get(m) ?? 0) + 1)
    if (am && motivoVinculadoFaltaInjustificadaOuDesidia(r.obs)) {
      porAnoMesFaltaInjustificadaDesidiaMap.set(
        am,
        (porAnoMesFaltaInjustificadaDesidiaMap.get(am) ?? 0) + 1,
      )
      if (!detalhesPorAnoMesFaltaInjustificadaDesidia[am]) {
        detalhesPorAnoMesFaltaInjustificadaDesidia[am] = []
      }
      detalhesPorAnoMesFaltaInjustificadaDesidia[am].push({
        id: r.id,
        matricula: r.matricula,
        nome: r.nome,
        tipo: r.tipo,
        dataAplicacao: r.dataAplicacao,
        obs: r.obs,
      })
      totalFaltaInjustificadaDesidia += 1
    }
    if (r.ano < 2025) aplicacoesAteFimDe2024 += 1
    else aplicacoesDesde2025 += 1
  }

  const porAno = [...porAnoMap.entries()]
    .map(([ano, qtd]) => ({ ano, qtd }))
    .sort((a, b) => a.ano - b.ano)

  const porAnoMes = [...porAnoMesMap.entries()]
    .map(([anoMes, qtd]) => ({ anoMes, qtd }))
    .sort((a, b) => a.anoMes.localeCompare(b.anoMes))
  const porAnoMesFaltaInjustificadaDesidia = [...porAnoMesFaltaInjustificadaDesidiaMap.entries()]
    .map(([anoMes, qtd]) => ({ anoMes, qtd }))
    .sort((a, b) => a.anoMes.localeCompare(b.anoMes))

  return {
    ok: true,
    arquivoLabel,
    total: rows.length,
    aplicacoesAteFimDe2024,
    aplicacoesDesde2025,
    porAno,
    porAnoMes,
    porAnoMesFaltaInjustificadaDesidia,
    detalhesPorAnoMesFaltaInjustificadaDesidia,
    totalFaltaInjustificadaDesidia,
    tiposPrincipais: topMap(tipoMap, 5),
    motivosPrincipais: topMap(motivoMap, 5),
  }
}

export async function loadSancoesResumoFromUrl(url: string, arquivoLabel: string): Promise<SancoesResumo> {
  try {
    const res = await fetch(url)
    if (!res.ok) return { ok: false, error: `Não foi possível carregar ${url} (${res.status}).` }
    const buf = await res.arrayBuffer()
    const rows = parseSancoesSheet(buf)
    if (!rows.length) return { ok: false, error: 'Planilha de sanções sem linhas reconhecíveis.' }
    return buildSancoesResumo(rows, arquivoLabel)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao ler planilha de sanções.' }
  }
}
