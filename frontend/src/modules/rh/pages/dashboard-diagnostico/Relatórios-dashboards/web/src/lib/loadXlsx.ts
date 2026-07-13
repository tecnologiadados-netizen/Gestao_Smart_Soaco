import * as XLSX from 'xlsx'
import { normalizeRows, type AbsenceRow } from './absences'

export async function loadAbsencesFromUrl(url: string): Promise<AbsenceRow[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Falha ao carregar ${url}`)
  const buf = await res.arrayBuffer()
  return parseAbsencesBuffer(buf)
}

export function parseAbsencesBuffer(buf: ArrayBuffer): AbsenceRow[] {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const name = wb.SheetNames[0]
  if (!name) return []
  const sheet = wb.Sheets[name]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }) as unknown[][]
  return normalizeRows(matrix)
}
