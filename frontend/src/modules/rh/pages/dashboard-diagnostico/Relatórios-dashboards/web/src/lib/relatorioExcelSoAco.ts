/**
 * Formatação de planilhas — Manual da Marca Só Aço (identidade visual).
 * Cores: #041E42, #1E22AA, #FFAD00, #808080, #2E2D2C, #FFFFFF
 */
import XLSX from 'xlsx-js-style'

export const SO_ACO_CORES = {
  navy: '041E42',
  blue: '1E22AA',
  gold: 'FFAD00',
  gray: '808080',
  ink: '2E2D2C',
  white: 'FFFFFF',
  page: 'F4F6FA',
  zebra: 'E8ECF4',
} as const

type AlignH = 'left' | 'center' | 'right'

type CellStyle = {
  font?: { name?: string; sz?: number; bold?: boolean; color?: { rgb: string } }
  fill?: { fgColor?: { rgb: string }; patternType?: string }
  alignment?: { horizontal?: AlignH; vertical?: string; wrapText?: boolean }
  border?: {
    top?: { style?: string; color?: { rgb: string } }
    bottom?: { style?: string; color?: { rgb: string } }
    left?: { style?: string; color?: { rgb: string } }
    right?: { style?: string; color?: { rgb: string } }
  }
}

function estiloBase(partial: CellStyle): CellStyle {
  return {
    font: { name: 'Calibri', sz: 11, color: { rgb: SO_ACO_CORES.ink }, ...partial.font },
    alignment: { vertical: 'center', wrapText: true, ...partial.alignment },
    ...partial,
  }
}

export const estilosSoAco = {
  tituloDoc: estiloBase({
    font: { sz: 16, bold: true, color: { rgb: SO_ACO_CORES.white } },
    fill: { fgColor: { rgb: SO_ACO_CORES.navy }, patternType: 'solid' },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  }),
  subtituloDoc: estiloBase({
    font: { sz: 10, color: { rgb: SO_ACO_CORES.white } },
    fill: { fgColor: { rgb: SO_ACO_CORES.blue }, patternType: 'solid' },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  }),
  metaRotulo: estiloBase({
    font: { bold: true, color: { rgb: SO_ACO_CORES.navy } },
    fill: { fgColor: { rgb: SO_ACO_CORES.page }, patternType: 'solid' },
    border: {
      bottom: { style: 'thin', color: { rgb: SO_ACO_CORES.gray } },
      right: { style: 'thin', color: { rgb: SO_ACO_CORES.gray } },
    },
  }),
  metaValor: estiloBase({
    fill: { fgColor: { rgb: SO_ACO_CORES.white }, patternType: 'solid' },
    border: {
      bottom: { style: 'thin', color: { rgb: SO_ACO_CORES.gray } },
    },
  }),
  observacao: estiloBase({
    font: { sz: 10, color: { rgb: SO_ACO_CORES.gray } },
    fill: { fgColor: { rgb: SO_ACO_CORES.page }, patternType: 'solid' },
    alignment: { horizontal: 'left', wrapText: true },
  }),
  secaoTitulo: estiloBase({
    font: { sz: 12, bold: true, color: { rgb: SO_ACO_CORES.white } },
    fill: { fgColor: { rgb: SO_ACO_CORES.blue }, patternType: 'solid' },
    alignment: { horizontal: 'left', vertical: 'center' },
  }),
  resumoRotulo: estiloBase({
    font: { bold: true, color: { rgb: SO_ACO_CORES.ink } },
    fill: { fgColor: { rgb: SO_ACO_CORES.gold }, patternType: 'solid' },
    border: {
      right: { style: 'thin', color: { rgb: SO_ACO_CORES.gray } },
      bottom: { style: 'thin', color: { rgb: SO_ACO_CORES.gray } },
    },
  }),
  resumoValor: estiloBase({
    font: { bold: true, color: { rgb: SO_ACO_CORES.navy } },
    fill: { fgColor: { rgb: SO_ACO_CORES.white }, patternType: 'solid' },
    border: {
      bottom: { style: 'thin', color: { rgb: SO_ACO_CORES.gray } },
    },
  }),
  cabecalhoTabela: estiloBase({
    font: { bold: true, color: { rgb: SO_ACO_CORES.navy } },
    fill: { fgColor: { rgb: SO_ACO_CORES.gold }, patternType: 'solid' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'medium', color: { rgb: SO_ACO_CORES.navy } },
      bottom: { style: 'thin', color: { rgb: SO_ACO_CORES.navy } },
      left: { style: 'thin', color: { rgb: SO_ACO_CORES.gray } },
      right: { style: 'thin', color: { rgb: SO_ACO_CORES.gray } },
    },
  }),
  linhaTabela: (zebra: boolean) =>
    estiloBase({
      fill: { fgColor: { rgb: zebra ? SO_ACO_CORES.zebra : SO_ACO_CORES.white }, patternType: 'solid' },
      border: {
        bottom: { style: 'hair', color: { rgb: SO_ACO_CORES.gray } },
        left: { style: 'hair', color: { rgb: SO_ACO_CORES.gray } },
        right: { style: 'hair', color: { rgb: SO_ACO_CORES.gray } },
      },
    }),
  linhaVazia: estiloBase({
    font: { color: { rgb: SO_ACO_CORES.gray } },
    fill: { fgColor: { rgb: SO_ACO_CORES.page }, patternType: 'solid' },
  }),
  rodapeMarca: estiloBase({
    font: { sz: 9, color: { rgb: SO_ACO_CORES.gray } },
    fill: { fgColor: { rgb: SO_ACO_CORES.page }, patternType: 'solid' },
    alignment: { horizontal: 'right' },
  }),
}

export type CampoResumoRelatorio = { rotulo: string; valor: string | number }
export type SecaoRelatorioExcel = {
  tituloBloco: string
  camposResumo: CampoResumoRelatorio[]
  colunas: string[]
  linhas: (string | number)[][]
}

export type MetaRelatorioExcel = {
  tituloDocumento: string
  subtitulo?: string
  linhasMeta?: CampoResumoRelatorio[]
  observacao?: string
  /** Bloco de resumo antes das seções detalhadas (ex.: totais do local). */
  tituloResumoInicial?: string
  resumoInicial?: CampoResumoRelatorio[]
}

function tipoCelula(v: string | number): 's' | 'n' {
  return typeof v === 'number' ? 'n' : 's'
}

function setCell(ws: XLSX.WorkSheet, r: number, c: number, v: string | number, s: CellStyle) {
  const addr = XLSX.utils.encode_cell({ r, c })
  ws[addr] = { v, t: tipoCelula(v), s }
}

function mergeRow(ws: XLSX.WorkSheet, r: number, c0: number, c1: number) {
  if (!ws['!merges']) ws['!merges'] = []
  ws['!merges'].push({ s: { r, c: c0 }, e: { r, c: c1 } })
}

function largurasColunas(nCols: number): { wch: number }[] {
  const base = [42, 22, 14, 12, 28, 48, 12]
  return Array.from({ length: nCols }, (_, i) => ({ wch: base[i] ?? 18 }))
}

/**
 * Monta uma aba formatada com blocos (resumo + tabela) por seção.
 */
export function montarWorksheetRelatorioSoAco(
  meta: MetaRelatorioExcel,
  secoes: SecaoRelatorioExcel[],
): XLSX.WorkSheet {
  const maxCols = Math.max(
    7,
    ...secoes.map((s) => Math.max(s.colunas.length, 2)),
    ...(meta.linhasMeta?.length ? [2] : [0]),
  )
  const lastCol = maxCols - 1
  const ws: XLSX.WorkSheet = {}
  let r = 0

  setCell(ws, r, 0, meta.tituloDocumento, estilosSoAco.tituloDoc)
  mergeRow(ws, r, 0, lastCol)
  r++

  if (meta.subtitulo) {
    setCell(ws, r, 0, meta.subtitulo, estilosSoAco.subtituloDoc)
    mergeRow(ws, r, 0, lastCol)
    r++
  }

  for (const linha of meta.linhasMeta ?? []) {
    setCell(ws, r, 0, linha.rotulo, estilosSoAco.metaRotulo)
    setCell(ws, r, 1, linha.valor, estilosSoAco.metaValor)
    r++
  }

  if (meta.observacao) {
    setCell(ws, r, 0, meta.observacao, estilosSoAco.observacao)
    mergeRow(ws, r, 0, lastCol)
    r++
  }

  r++

  if (meta.resumoInicial?.length) {
    setCell(ws, r, 0, meta.tituloResumoInicial ?? 'Resumo', estilosSoAco.secaoTitulo)
    mergeRow(ws, r, 0, lastCol)
    r++

    for (const campo of meta.resumoInicial) {
      setCell(ws, r, 0, campo.rotulo, estilosSoAco.resumoRotulo)
      setCell(ws, r, 1, campo.valor, estilosSoAco.resumoValor)
      r++
    }

    r++
  }

  for (const sec of secoes) {
    setCell(ws, r, 0, sec.tituloBloco, estilosSoAco.secaoTitulo)
    mergeRow(ws, r, 0, lastCol)
    r++

    for (const campo of sec.camposResumo) {
      setCell(ws, r, 0, campo.rotulo, estilosSoAco.resumoRotulo)
      setCell(ws, r, 1, campo.valor, estilosSoAco.resumoValor)
      r++
    }

    r++

    sec.colunas.forEach((col, c) => {
      setCell(ws, r, c, col, estilosSoAco.cabecalhoTabela)
    })
    r++

    if (sec.linhas.length === 0) {
      setCell(ws, r, 0, '(Sem registros neste recorte)', estilosSoAco.linhaVazia)
      mergeRow(ws, r, 0, lastCol)
      r++
    } else {
      sec.linhas.forEach((linha, idx) => {
        const est = estilosSoAco.linhaTabela(idx % 2 === 1)
        linha.forEach((val, c) => {
          setCell(ws, r, c, val, est)
        })
        r++
      })
    }

    r++
  }

  setCell(ws, r, 0, 'Só Aço — Relatório gerado pelo painel de RH', estilosSoAco.rodapeMarca)
  mergeRow(ws, r, 0, lastCol)

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: lastCol } })
  ws['!cols'] = largurasColunas(maxCols)
  ws['!rows'] = [{ hpt: 28 }, { hpt: 22 }]

  return ws
}

export function downloadWorkbookSoAco(
  sheet: XLSX.WorkSheet,
  nomeAba: string,
  nomeArquivo: string,
): void {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, nomeAba.slice(0, 31))
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function slugNomeArquivo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'relatorio'
}

export function fmtDataBrFromDate(d: Date | null): string {
  if (!d) return '-'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export function fmtQtdPlanilha(value: string, fallbackQtd: number): string {
  const raw = String(value ?? '').trim()
  if (raw) return raw
  const n = Number(fallbackQtd)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: n % 1 === 0 ? 0 : 1, maximumFractionDigits: 2 })
}
