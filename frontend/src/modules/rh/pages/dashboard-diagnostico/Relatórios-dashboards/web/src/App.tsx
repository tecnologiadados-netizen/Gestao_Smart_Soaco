import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getFaltasAtestados,
  getFaltasCadastros,
  getSancoesDisciplinares,
  getSecullumFuncionarios,
  isApiConfigured,
} from '@rh/lib/api-client'
import type { FaltaRow, SancaoDisciplinarRow } from '@rh/types/api'
import {
  buildFaltasTiposRegrasMap,
  classificarTipoFallback,
  findRegraByTipo,
  rowContaNosIndicadores,
  rowExibeNoDetalhamento,
  type FaltaTipoRegra,
} from '@rh/pages/FaltasAtestados/faltas-tipos-regras'
import { diasPerdidosEquivalentes, parseLooseNumber } from '@rh/pages/FaltasAtestados/faltas-dias-equivalentes'
import {
  aggregateMonthly,
  filterRows,
  kpis,
  qntdPorDiaSemana,
  rankLideresPorDiasNoSetor,
  topGruposSintomaCid,
  distribuicaoDiasPerdidosPorTipo,
  uniqueSorted,
  type AbsenceRow,
} from './lib/absences'
import { loadAbsencesFromUrl, parseAbsencesBuffer } from './lib/loadXlsx'
import { buildSancoesResumo, type SancaoRow, type SancoesResumo } from './lib/sancoes'
import { formatMesCurto } from './lib/formatMes'
import {
  clearImportedSpreadsheetCache,
  getImportedSpreadsheetCache,
} from './lib/spreadsheetCache'
import { FloatingFiltersPanel } from './components/FloatingFiltersPanel'
import { KpiRow } from './components/KpiRow'
import { ChartsBoard } from './components/ChartsBoard'
import { createColaboradorAtivoResolver } from './data/ativosMatriculas'
import type { SecullumFuncionario } from '@rh/lib/api-client'

const DASHBOARD_AUSENCIAS_UPDATED_EVENT = 'rh-dashboard-ausencias-updated'
const DASHBOARD_SANCOES_UPDATED_EVENT = 'rh-dashboard-sancoes-updated'

function toDate(s: string) {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function normalizeMatricula(value: unknown): string {
  const raw = String(value ?? '').trim()
  const digits = raw.replace(/\D/g, '')
  if (!digits) return raw
  return digits.replace(/^0+/, '') || '0'
}

function resolveQtdParaDashboard(row: FaltaRow): number {
  const periodo = String(row.periodo ?? '').toUpperCase()
  const qtdRaw = parseLooseNumber(row.qntd)
  if (periodo.includes('PARCIAL') && qtdRaw != null && qtdRaw > 0 && qtdRaw <= 1) return qtdRaw
  return diasPerdidosEquivalentes(row).value
}

function normalizeAnoMes(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const yyyymm = raw.match(/^(\d{4})[-/](\d{1,2})$/)
  if (yyyymm) {
    const y = yyyymm[1]
    const m = String(Number(yyyymm[2])).padStart(2, '0')
    return `${y}-${m}`
  }
  const mmYYYY = raw.match(/^(\d{1,2})[-/](\d{4})$/)
  if (mmYYYY) {
    const y = mmYYYY[2]
    const m = String(Number(mmYYYY[1])).padStart(2, '0')
    return `${y}-${m}`
  }
  const monthMap: Record<string, string> = {
    jan: '01',
    janeiro: '01',
    fev: '02',
    fevereiro: '02',
    mar: '03',
    marco: '03',
    abril: '04',
    abr: '04',
    mai: '05',
    maio: '05',
    jun: '06',
    junho: '06',
    jul: '07',
    julho: '07',
    ago: '08',
    agosto: '08',
    set: '09',
    setembro: '09',
    out: '10',
    outubro: '10',
    nov: '11',
    novembro: '11',
    dez: '12',
    dezembro: '12',
  }
  const normalizedText = raw
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\./g, '')
    .trim()
  const monthYearText = normalizedText.match(/^([a-z]+)[-/\s]+(\d{4})$/)
  if (monthYearText) {
    const m = monthMap[monthYearText[1]]
    if (m) return `${monthYearText[2]}-${m}`
  }
  if (monthMap[normalizedText]) {
    return ''
  }
  const dateLike = toDate(raw)
  if (dateLike) {
    const y = dateLike.getFullYear()
    const m = String(dateLike.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }
  return ''
}

function toAbsenceRowsFromSistema(rows: FaltaRow[], regrasMap: Map<string, FaltaTipoRegra>): AbsenceRow[] {
  return rows.map((r) => {
    const data = toDate(String(r.data ?? ''))
    const regra = findRegraByTipo(regrasMap, r.tipo)
    const classificacao = regra?.classificacao ?? classificarTipoFallback(r.tipo)
    const categoria =
      classificacao === 'injustificada'
        ? 'Injustificada'
        : classificacao === 'justificada'
          ? 'Justificada'
          : 'Não classificado'
    return {
      data,
      matricula: Number(normalizeMatricula(r.matricula)) || 0,
      nome: String(r.nomeFuncionario ?? '').trim() || `Mat. ${r.matricula ?? '?'}`,
      area: String(r.area ?? '').trim() || '(Não informado)',
      setor: String(r.setor ?? '').trim() || '(Não informado)',
      lider: String(r.lider ?? '').trim() || '(Não informado)',
      qntd: resolveQtdParaDashboard(r),
      tipo: String(r.tipo ?? '').trim(),
      cid: String(r.cid ?? '').trim() || '(Sem CID)',
      endereco: String(r.endereco ?? '').trim(),
      localAtendimento: String(r.localAtendimento ?? '').trim(),
      medicoResponsavel: String(r.medicoResponsavel ?? '').trim(),
      qntdOriginal: String(r.qntd ?? '').trim(),
      contaIndicadores: rowContaNosIndicadores(r, regrasMap),
      exibirNoDetalhamento: rowExibeNoDetalhamento(r, regrasMap),
      categoria,
      anoMes: normalizeAnoMes(r.mesFalta) || (data ? `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}` : ''),
    }
  })
}

function toSancaoRowsFromSistema(rows: SancaoDisciplinarRow[]): SancaoRow[] {
  return rows.map((r) => ({
    id: String(r.id ?? '').trim(),
    matricula: normalizeMatricula(r.matricula),
    nome: String(r.nomeFuncionario ?? '').trim(),
    tipo: String(r.tipo ?? '').trim(),
    dataAplicacao: String(r.dataAplicacao ?? '').trim(),
    mes: String(r.mes ?? '').trim(),
    ano: Number.parseInt(String(r.ano ?? '').trim(), 10) || 0,
    obs: String(r.observacoes ?? '').trim(),
  }))
}

export default function App({ embedded = false }: { embedded?: boolean }) {
  const [allRows, setAllRows] = useState<AbsenceRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [setorFilter, setSetorFilter] = useState('')
  const [liderFilter, setLiderFilter] = useState('')
  const [colaboradoresAtivosOptions, setColaboradoresAtivosOptions] = useState<{ matricula: string; nome: string }[]>([])
  const [colaboradoresAtivosSelecionados, setColaboradoresAtivosSelecionados] = useState<string[]>([])
  const [secullumFuncionarios, setSecullumFuncionarios] = useState<SecullumFuncionario[]>([])
  const [sancoesResumo, setSancoesResumo] = useState<SancoesResumo | null>(null)
  const [sancoesRows, setSancoesRows] = useState<SancaoRow[]>([])
  const [refreshTick, setRefreshTick] = useState(0)

  const bootstrapDates = useCallback((rows: AbsenceRow[]) => {
    const ds = rows.map((r) => r.data).filter((d): d is Date => !!d)
    if (!ds.length) return
    const t = (x: Date) => x.getTime()
    const minD = new Date(Math.min(...ds.map(t)))
    const maxD = new Date(Math.max(...ds.map(t)))
    const f = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setFrom(f(minD))
    setTo(f(maxD))
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [faltas, cadastros] = await Promise.all([getFaltasAtestados(), getFaltasCadastros()])
        const regras = (cadastros?.tipos ?? []).map((t) => ({
          tipo: t.valor,
          contabilizaIndicadores: t.contabilizaIndicadores !== false,
          classificacao:
            t.classificacaoIndicador === 'justificada' || t.classificacaoIndicador === 'injustificada'
              ? t.classificacaoIndicador
              : null,
          exibirNoDetalhamento: t.exibirNoDetalhamento !== false,
        }))
        const regrasMap = buildFaltasTiposRegrasMap(regras)
        const rowsSistema = toAbsenceRowsFromSistema(faltas, regrasMap)
        if (!cancelled) {
          setAllRows(rowsSistema)
          if (rowsSistema.length > 0) bootstrapDates(rowsSistema)
          setLoadError(null)
          return
        }
      } catch {
        if (embedded || isApiConfigured()) {
          if (!cancelled) {
            setLoadError('Não foi possível carregar os dados de ausências do sistema.')
            setAllRows([])
          }
          return
        }
      }

      if (embedded) return

      try {
        const cached = await getImportedSpreadsheetCache()
        if (cached && !cancelled) {
          try {
            const rows = parseAbsencesBuffer(cached.buffer)
            if (rows.length > 0) {
              setAllRows(rows)
              bootstrapDates(rows)
              setLoadError(null)
              return
            }
            await clearImportedSpreadsheetCache()
          } catch {
            await clearImportedSpreadsheetCache()
          }
        }
      } catch {
        /* IndexedDB indisponível ou vazio — segue para o ficheiro público */
      }

      try {
        const rows = await loadAbsencesFromUrl('/faltas-atestados.xlsx')
        if (cancelled) return
        setAllRows(rows)
        bootstrapDates(rows)
        setLoadError(null)
      } catch (e) {
        if (cancelled) return
        setLoadError(e instanceof Error ? e.message : 'Erro ao carregar dados')
        setAllRows([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bootstrapDates, embedded, refreshTick])

  useEffect(() => {
    let cancelled = false
    const loadSancoes = async () => {
      try {
        const rowsSistema = await getSancoesDisciplinares()
        const sancoes = toSancaoRowsFromSistema(rowsSistema)
        if (!cancelled) {
          setSancoesRows(sancoes)
          setSancoesResumo(buildSancoesResumo(sancoes, 'sistema'))
          return
        }
      } catch {
        // sem sanções
      }
      if (!cancelled) {
        setSancoesRows([])
        setSancoesResumo({ ok: false, error: 'Não foi possível carregar sanções disciplinares.' })
      }
    }

    void loadSancoes()

    const onFocus = () => {
      void loadSancoes()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadSancoes()
      }
    }
    // Revalidação periódica para refletir novos lançamentos sem depender só do evento.
    const intervalId = window.setInterval(() => {
      void loadSancoes()
    }, 15000)

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refreshTick])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const funcionarios = await getSecullumFuncionarios()
        if (cancelled) return
        setSecullumFuncionarios(funcionarios)
        const ativos = funcionarios
          .filter((f) => !f.desligado)
          .map((f) => ({
            matricula: normalizeMatricula(f.numeroFolha),
            nome: String(f.nome ?? '').trim(),
          }))
          .filter((f) => f.matricula && f.nome)
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        setColaboradoresAtivosOptions(ativos)
      } catch {
        if (!cancelled) {
          setColaboradoresAtivosOptions([])
          setSecullumFuncionarios([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshTick])

  const isColaboradorAtivo = useMemo(
    () => createColaboradorAtivoResolver(secullumFuncionarios),
    [secullumFuncionarios],
  )

  useEffect(() => {
    const onRefresh = () => setRefreshTick((v) => v + 1)
    window.addEventListener(DASHBOARD_AUSENCIAS_UPDATED_EVENT, onRefresh)
    window.addEventListener(DASHBOARD_SANCOES_UPDATED_EVENT, onRefresh)
    return () => {
      window.removeEventListener(DASHBOARD_AUSENCIAS_UPDATED_EVENT, onRefresh)
      window.removeEventListener(DASHBOARD_SANCOES_UPDATED_EVENT, onRefresh)
    }
  }, [])

  const areaOptions = useMemo(() => uniqueSorted(allRows, 'area'), [allRows])
  const setorOptions = useMemo(() => uniqueSorted(allRows, 'setor'), [allRows])
  const liderOptions = useMemo(() => uniqueSorted(allRows, 'lider'), [allRows])

  const limparFiltrosDimensao = useCallback(() => {
    setAreaFilter('')
    setSetorFilter('')
    setLiderFilter('')
    setColaboradoresAtivosSelecionados([])
    bootstrapDates(allRows)
  }, [allRows, bootstrapDates])

  const filteredBase = useMemo(() => {
    const df = toDate(from)
    const dt = toDate(to)
    return filterRows(allRows, {
      from: df,
      to: dt,
      areas: areaFilter ? [areaFilter] : [],
      setores: setorFilter ? [setorFilter] : [],
      lideres: liderFilter ? [liderFilter] : [],
    })
  }, [allRows, from, to, areaFilter, setorFilter, liderFilter])
  const filtered = useMemo(() => {
    if (colaboradoresAtivosSelecionados.length === 0) return filteredBase
    const selected = new Set(colaboradoresAtivosSelecionados.map((m) => normalizeMatricula(m)))
    return filteredBase.filter((r) => selected.has(normalizeMatricula(r.matricula)))
  }, [filteredBase, colaboradoresAtivosSelecionados])
  const sancoesRowsContexto = useMemo(() => {
    if (colaboradoresAtivosSelecionados.length === 0) return sancoesRows
    const selected = new Set(colaboradoresAtivosSelecionados.map((m) => normalizeMatricula(m)))
    return sancoesRows.filter((r) => selected.has(normalizeMatricula(r.matricula)))
  }, [sancoesRows, colaboradoresAtivosSelecionados])
  const sancoesResumoContexto = useMemo(() => {
    if (colaboradoresAtivosSelecionados.length === 0) return sancoesResumo
    // Se a fonte de sanções falhou globalmente, mantém o erro original.
    if (sancoesResumo?.ok === false && sancoesRows.length === 0) return sancoesResumo
    return buildSancoesResumo(sancoesRowsContexto, 'sistema (filtro de colaborador)')
  }, [colaboradoresAtivosSelecionados.length, sancoesResumo, sancoesRows.length, sancoesRowsContexto])
  const filteredIndicadores = useMemo(
    () => filtered.filter((r) => r.contaIndicadores !== false),
    [filtered],
  )

  const stats = useMemo(() => kpis(filteredIndicadores), [filteredIndicadores])
  const monthly = useMemo(() => aggregateMonthly(filteredIndicadores), [filteredIndicadores])
  const heroJustificadas = useMemo(() => {
    const total = stats.total
    // Alinha com o indicador executivo: "justificadas (painel)" = todas as não-injustificadas.
    const pct = total > 0 ? ((stats.jus + stats.nao) / total) * 100 : 0
    return {
      mediaMensal: pct,
      serie: monthly.map((m) => {
        const totalMes = m.injust + m.just + m.nao
        const pctMes = totalMes > 0 ? ((m.just + m.nao) / totalMes) * 100 : 0
        return {
          mes: formatMesCurto(m.anoMes),
          pct: pctMes,
        }
      }),
    }
  }, [monthly, stats])
  const lideresRank = useMemo(() => rankLideresPorDiasNoSetor(filteredIndicadores, 10), [filteredIndicadores])
  const diasSemanaRank = useMemo(() => qntdPorDiaSemana(filteredIndicadores), [filteredIndicadores])
  const distribuicaoDiasTipo = useMemo(() => distribuicaoDiasPerdidosPorTipo(filteredIndicadores), [filteredIndicadores])
  const topGruposCidRank = useMemo(() => topGruposSintomaCid(filteredIndicadores, 15), [filteredIndicadores])

  return (
    <div className={`flex flex-col ${embedded ? 'min-h-0 bg-transparent' : 'min-h-screen bg-page'}`}>
      {!embedded ? (
        <header className="relative z-20 w-full shrink-0 border-b border-white/10 bg-[#071426] text-white shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-5 px-5 py-4 sm:px-8 sm:py-5 lg:px-10">
            <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
              <img
                src="/logo-so-aco.png"
                alt="Só Aço"
                className="h-9 w-auto max-h-11 max-w-[min(100%,220px)] shrink-0 object-contain object-left sm:h-11 sm:max-w-[260px]"
                width={220}
                height={44}
                decoding="async"
              />
              <span className="shrink-0 select-none px-0.5 text-2xl font-extralight leading-none text-brand-amber" aria-hidden>
                |
              </span>
              <h1 className="min-w-0 text-lg font-bold leading-tight tracking-tight text-white sm:text-xl lg:text-2xl">
                Análise de ausências e medidas corretivas
              </h1>
            </div>
          </div>
        </header>
      ) : null}

      <div className={`flex min-h-0 min-w-0 flex-1 flex-col gap-6 ${embedded ? 'pt-0' : 'pt-6'}`}>
        <FloatingFiltersPanel
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          areaOptions={areaOptions}
          setorOptions={setorOptions}
          liderOptions={liderOptions}
          areaFilter={areaFilter}
          setorFilter={setorFilter}
          liderFilter={liderFilter}
          colaboradoresAtivosOptions={colaboradoresAtivosOptions}
          colaboradoresAtivosSelecionados={colaboradoresAtivosSelecionados}
          onAreaChange={setAreaFilter}
          onSetorChange={setSetorFilter}
          onLiderChange={setLiderFilter}
          onColaboradoresAtivosSelecionadosChange={setColaboradoresAtivosSelecionados}
          onClearFilters={limparFiltrosDimensao}
        />

        <main className={`flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto ${embedded ? 'px-0 pb-2' : 'px-6 pb-6 sm:px-8 sm:pb-8'}`}>

          {loadError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {loadError}
              {embedded ? (
                <span className="mt-1 block text-muted-foreground">
                  Verifique a conexão com o servidor ou importe registros em Faltas e Atestados.
                </span>
              ) : (
                <span className="mt-1 block text-muted-foreground">
                  Coloque <code className="rounded bg-muted px-1">faltas-atestados.xlsx</code> em{' '}
                  <code className="rounded bg-muted px-1">web/public/</code> ou confira os dados de ausências no sistema RH.
                </span>
              )}
            </div>
          ) : null}

          <KpiRow kpis={stats} heroJustificadas={heroJustificadas} />

          <ChartsBoard
            monthly={monthly}
            lideres={lideresRank}
            diasSemana={diasSemanaRank}
            distribuicaoDiasTipo={distribuicaoDiasTipo}
            topGruposCid={topGruposCidRank}
            rows={filtered}
            sancoesResumo={sancoesResumoContexto}
            sancoesRows={sancoesRowsContexto}
            isColaboradorAtivo={isColaboradorAtivo}
          />
        </main>
      </div>
    </div>
  )
}
