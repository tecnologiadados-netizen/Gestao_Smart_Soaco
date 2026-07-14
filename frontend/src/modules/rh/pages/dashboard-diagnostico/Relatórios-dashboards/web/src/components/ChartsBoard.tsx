import {
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronDown,
  Download,
  Filter,
  Rocket,
  Search,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  AbsenceRow,
  DistribuicaoDiasPerdidosTipo,
  FaltanteNoMes,
  GrupoSintomaCid,
  LiderSetorRank,
  MesAgg,
} from '../lib/absences'
import {
  cidValidoParaRanking,
  janelaUltimos6MesesJustificadas,
  tipoIncluiNoRankingCid,
  topColaboradoresJustificadosAtencao6Meses,
  topFaltantesNoMes,
  topFaltantesNoSetor,
} from '../lib/absences'
import { DialogOrdenacaoExportRelatorio } from './DialogOrdenacaoExportRelatorio'
import { downloadRelatorioMedicosLocalXlsx } from '../lib/relatorioMedicosLocalExport'
import type { OrdenacaoExportRelatorio } from '../lib/relatorioOrdenacao'
import { downloadRelatorioTopColaboradoresAtivosXlsx } from '../lib/relatorioTopColaboradoresExport'
import {
  chaveAgregacaoCidPlanilha,
  primeiroTokenCid,
  resolverGrupoCid,
  rotuloCidPlanilhaExibicao,
} from '../lib/cidGrupos'
import { formatMesCurto } from '../lib/formatMes'
import { normalizeSearchText, textIncludesSearch } from '../lib/normalizeSearchText'
import type { SancaoRow, SancoesResumo } from '../lib/sancoes'
import { colaboradorAtivo, type ColaboradorAtivoResolver } from '../data/ativosMatriculas'
import { Popover, PopoverContent, PopoverTrigger } from '../../../../../../components/ui/popover'

/** Primeira parte do título longo do grupo CID (cartão executivo). */
function tituloGrupoResumo(titulo: string, max = 120): string {
  const base = (titulo.split('·')[0] ?? titulo).trim()
  return base.length > max ? `${base.slice(0, max - 1)}…` : base
}

type Props = {
  monthly: MesAgg[]
  lideres: LiderSetorRank[]
  diasSemana: { name: string; qntd: number }[]
  /** Donut: atestados vs faltas injustificadas vs declarações/outros justificados (soma QNTD no filtro). */
  distribuicaoDiasTipo: DistribuicaoDiasPerdidosTipo
  /** Top grupos de sintomas (CID-10 agregados), com breakdown por CID da planilha. */
  topGruposCid: GrupoSintomaCid[]
  rows: AbsenceRow[]
  /** Resumo derivado de `web/public/sancoes-disciplinares.xlsx` (histórico disciplinar). */
  sancoesResumo: SancoesResumo | null
  sancoesRows: SancaoRow[]
  /** Status ativo/inativo alinhado ao Secullum (`desligado`); fallback: lista estática. */
  isColaboradorAtivo?: ColaboradorAtivoResolver
}

/** Linhas de evolução (estilo relatório): azul = justificadas, vermelho = injustificadas. */
const LINE = {
  just: '#1a56db',
  inj: '#ef4444',
}

/** Altura fixa das caixas de dados em “Recomendações de ação” (scroll interno). */
const RECOM_ACAO_LISTA_H = 'h-[232px]'

type PrioridadePlano = 'PRIORIDADE MÁXIMA' | 'ALTA' | 'MÉDIA'
type TipoAcaoPlano = 'Estrutural' | 'Dinâmica/Engajamento'

type AcaoPlanoExecutivo = {
  bloco: 'Controle' | 'Gestão Ativa e Ergonomia' | 'Engajamento Operacional'
  prioridade: PrioridadePlano
  tipo: TipoAcaoPlano
  titulo: string
  oQue: string
  como: string
  responsavel: string
  prazo: string
  kpi: string
}

const PRIORIDADE_ORDEM: Record<PrioridadePlano, number> = {
  'PRIORIDADE MÁXIMA': 0,
  ALTA: 1,
  MÉDIA: 2,
}

function fmtPt(n: number) {
  return Math.round(n).toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

/** Dias (QNTD) sem arredondar cada linha — evita 0,5 virar 1 na lista de faltantes. */
function fmtDiasQntd(n: number) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '0'
  const hasFrac = Math.abs(x % 1) > 0.0001
  return x.toLocaleString('pt-BR', {
    minimumFractionDigits: hasFrac ? 1 : 0,
    maximumFractionDigits: 2,
  })
}

function pctFmt(pct: number) {
  return pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function compareTextPtBr(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true })
}

function normalizeKeyText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function canonicalizarLocalAtendimento(value: string): string {
  const base = normalizeKeyText(value)
  if (!base) return '(Não informado)'
  const semStopwords = base
    .split(' ')
    .filter((t) => !['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'].includes(t))
    .join(' ')

  const norm = semStopwords
    .replace(/\bPRONTO ATENDIMENTO\b/g, 'PA')
    .replace(/\bPRONTO SOCORRO\b/g, 'PS')
    .replace(/\bHOSPITAL\b/g, 'HOSP')
    .replace(/\bUNIDADE DE PRONTO ATENDIMENTO\b/g, 'UPA')
    .replace(/\bUNIDADE BASICA DE SAUDE\b/g, 'UBS')
    .replace(/\bPOSTO DE SAUDE\b/g, 'UBS')
    .replace(/\s+/g, ' ')
    .trim()

  return norm || '(Não informado)'
}

function isCampoNaoInformado(value: string): boolean {
  const norm = normalizeKeyText(value)
  return (
    !norm ||
    norm === 'NAO INFORMADO' ||
    norm === 'NAO INFORMADA' ||
    norm === 'SEM INFORMACAO' ||
    norm === 'SEM INFORMACAO DISPONIVEL' ||
    norm === 'N A'
  )
}

/**
 * Agrupa grafias equivalentes vindas da planilha/RH (caixa, acentos, espaços, prefixos tipo DR/DRA).
 * Não substitui revisão cadastral: dois médicos homônimos distintos seguem linhas diferentes.
 */
function chaveMedicoResponsavelAgregacao(raw: string): string | null {
  const s = String(raw ?? '').trim() || '(Não informado)'
  if (isCampoNaoInformado(s)) return null
  let k = normalizeKeyText(s)
  k = k
    .replace(/\bDRA\b/g, '')
    .replace(/\bDR\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return k.length > 0 ? k : null
}

const CHAVE_AGREGACAO_SEM_MEDICO_INFORMADO = '__sem_medico_informado__'
const ROTULO_SEM_MEDICO_INFORMADO = '(Sem médico informado)'

function medicoAusenciaSemInformacaoNoCadastro(raw: string): boolean {
  const medicoRaw = String(raw ?? '').trim() || '(Não informado)'
  return isCampoNaoInformado(medicoRaw) || !chaveMedicoResponsavelAgregacao(medicoRaw)
}

/**
 * Chaves já no formato de {@link chaveMedicoResponsavelAgregacao}. Une nome completo incompleto com o mesmo prefixo —
 * ex.: "ALAN DE SOUSA" absorvido em "ALAN DE SOUSA LIRA".
 * Pedido pelo menos 3 tokens no nome curto; até 2 tokens só no trecho extra (evita saltos grandes ambíguos).
 */
function deveFundirChaveMedicoPrefixo(curta: string, longa: string): boolean {
  if (curta.length >= longa.length) return false
  const tokensCurta = curta.split(/\s+/).filter(Boolean)
  if (tokensCurta.length < 3) return false
  if (!longa.startsWith(curta + ' ')) return false
  const extra = longa.slice(curta.length + 1).trim()
  const nExtra = extra.split(/\s+/).filter(Boolean).length
  return nExtra >= 1 && nExtra <= 2
}

function fundirMapaMedicosValorRotulo(map: Map<string, { value: number; rotulo: string }>): Map<string, { value: number; rotulo: string }> {
  const keys = [...map.keys()]
  if (keys.length <= 1) return map
  const ordenLongFirst = [...keys].sort((a, b) => b.length - a.length || a.localeCompare(b))
  const representante = new Map<string, string>()
  for (const k of keys) {
    let rep = k
    for (const cand of ordenLongFirst) {
      if (cand.length <= k.length) continue
      if (deveFundirChaveMedicoPrefixo(k, cand)) {
        rep = cand
        break
      }
    }
    representante.set(k, rep)
  }
  const out = new Map<string, { value: number; rotulo: string }>()
  for (const [k, v] of map) {
    const rep = representante.get(k) ?? k
    const atual = out.get(rep)
    if (!atual) {
      out.set(rep, { value: v.value, rotulo: v.rotulo })
    } else {
      atual.value += v.value
      atual.rotulo = escolherRotuloMedicoPreferido(atual.rotulo, v.rotulo)
    }
  }
  return out
}

function fundirMapaMedicosLocalRotulo(
  map: Map<string, { dias: number; qtdAusencias: number; rotulo: string }>,
): Map<string, { dias: number; qtdAusencias: number; rotulo: string }> {
  const keys = [...map.keys()]
  if (keys.length <= 1) return map
  const ordenLongFirst = [...keys].sort((a, b) => b.length - a.length || a.localeCompare(b))
  const representante = new Map<string, string>()
  for (const k of keys) {
    if (k === CHAVE_AGREGACAO_SEM_MEDICO_INFORMADO) {
      representante.set(k, k)
      continue
    }
    let rep = k
    for (const cand of ordenLongFirst) {
      if (cand === CHAVE_AGREGACAO_SEM_MEDICO_INFORMADO) continue
      if (cand.length <= k.length) continue
      if (deveFundirChaveMedicoPrefixo(k, cand)) {
        rep = cand
        break
      }
    }
    representante.set(k, rep)
  }
  const out = new Map<string, { dias: number; qtdAusencias: number; rotulo: string }>()
  for (const [k, v] of map) {
    const rep = representante.get(k) ?? k
    const atual = out.get(rep)
    if (!atual) {
      out.set(rep, { dias: v.dias, qtdAusencias: v.qtdAusencias, rotulo: v.rotulo })
    } else {
      atual.dias += v.dias
      atual.qtdAusencias += v.qtdAusencias
      atual.rotulo = escolherRotuloMedicoPreferido(atual.rotulo, v.rotulo)
    }
  }
  return out
}

function medicosRepresentamMesmaPessoa(ma: string, mb: string): boolean {
  const ka = chaveMedicoResponsavelAgregacao(ma)
  const kb = chaveMedicoResponsavelAgregacao(mb)
  if (!ka || !kb) return false
  if (ka === kb) return true
  if (ka.length < kb.length && deveFundirChaveMedicoPrefixo(ka, kb)) return true
  if (kb.length < ka.length && deveFundirChaveMedicoPrefixo(kb, ka)) return true
  return false
}

/** Preferir o texto mais descritivo entre sinónimos de mesma chave. */
function escolherRotuloMedicoPreferido(anterior: string, candidato: string): string {
  const a = anterior.trim()
  const b = candidato.trim()
  if (!a) return b
  if (!b) return a
  if (b.length > a.length) return b
  if (b.length < a.length) return a
  const score = (s: string) => [...s].filter((ch) => ch >= 'a' && ch <= 'z').length
  return score(b) >= score(a) ? b : a
}

type DonutTopItem = {
  key: string
  name: string
  value: number
  fill: string
}

type RankingItem = {
  name: string
  value: number
}

type RankingMedicoNoLocalItem = {
  name: string
  dias: number
  qtdAusencias: number
  semMedicoInformado?: boolean
}

type AusenciaMedicoLocalDetalheRow = {
  data: string
  dataTimestamp: number | null
  nomeColaborador: string
  setor: string
  qntd: string
  qntdValor: number
  tipo: string
  cid: string
  statusColaborador: 'Ativo' | 'Inativo'
}

type SortDirection = 'asc' | 'desc'
type AusenciaMedicoLocalSortKey = 'data' | 'nomeColaborador' | 'setor' | 'qntd' | 'tipo' | 'cid' | 'statusColaborador'
type AusenciaMedicoLocalSort = { key: AusenciaMedicoLocalSortKey; direction: SortDirection }
type AusenciaMedicoLocalFilters = Partial<Record<AusenciaMedicoLocalSortKey, string[] | undefined>>

type ColaboradorResumoMedicoItem = {
  matricula: string
  nome: string
  dias: number
  /** Uma entrada por ausência/registo — mesma convenção dos tooltips por local */
  qtdAusencias: number
  status: 'Ativo' | 'Inativo'
}

function PainelFiltroColunaAusencias({
  colKey,
  buscaFiltroColuna,
  setBuscaFiltroColuna,
  opcoesColuna,
  filtroColuna,
  alternarValorFiltroAusenciasMedicoLocal,
  selecionarTodosFiltroAusenciasMedicoLocal,
  desmarcarTodosFiltroAusenciasMedicoLocal,
}: {
  colKey: AusenciaMedicoLocalSortKey
  buscaFiltroColuna: string
  setBuscaFiltroColuna: Dispatch<SetStateAction<string>>
  opcoesColuna: string[]
  filtroColuna: string[]
  alternarValorFiltroAusenciasMedicoLocal: (key: AusenciaMedicoLocalSortKey, valor: string) => void
  selecionarTodosFiltroAusenciasMedicoLocal: (key: AusenciaMedicoLocalSortKey) => void
  desmarcarTodosFiltroAusenciasMedicoLocal: (key: AusenciaMedicoLocalSortKey) => void
}) {
  const opcoesFiltradas = opcoesColuna.filter(
    (v) => compareTextPtBr(v, buscaFiltroColuna) === 0 || textIncludesSearch(v, buscaFiltroColuna),
  )

  return (
    <>
      <div className="mb-2">
        <input
          type="text"
          value={buscaFiltroColuna}
          onChange={(e) => setBuscaFiltroColuna(e.target.value)}
          placeholder="Pesquisar valor..."
          className="w-full rounded-md border border-black/10 px-2 py-1 text-[11px] font-normal text-brand-ink outline-none focus:border-brand-blue"
        />
      </div>
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-black/10 pb-2">
        <button
          type="button"
          className="text-[11px] font-semibold text-brand-blue hover:underline"
          onClick={() => selecionarTodosFiltroAusenciasMedicoLocal(colKey)}
        >
          Selecionar todos
        </button>
        <button
          type="button"
          className="text-[11px] font-semibold text-brand-blue hover:underline"
          onClick={() => desmarcarTodosFiltroAusenciasMedicoLocal(colKey)}
        >
          Desmarcar todos
        </button>
      </div>
      <div className="max-h-[min(220px,40vh)] space-y-1 overflow-y-auto overscroll-contain pr-1 text-[11px]">
        {opcoesFiltradas.length === 0 ? (
          <p className="py-2 text-xs text-brand-gray">Sem valores para filtrar.</p>
        ) : (
          opcoesFiltradas.map((valor) => {
            const checked = filtroColuna.includes(valor)
            return (
              <label
                key={`${colKey}-${valor}`}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-black/[0.03]"
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 shrink-0"
                  checked={checked}
                  onChange={() => alternarValorFiltroAusenciasMedicoLocal(colKey, valor)}
                />
                <span className="line-clamp-2 break-words text-brand-ink">{valor}</span>
              </label>
            )
          })
        )}
      </div>
    </>
  )
}

/** Tabela detalhe (Data … Status) com ordenação multi-critério e filtros por coluna — reusada nos modais de ausências por local/médico e por médico/colaborador. */
function TabelaAusenciasIndicadoresComFiltros({
  linhasOrdenadas,
  sortAusenciasMedicoLocal,
  alternarOrdenacaoAusenciasMedicoLocal,
  filtrosAusenciasMedicoLocal,
  opcoesFiltrosAusenciasMedicoLocal,
  colunaFiltroAberta,
  setColunaFiltroAberta,
  buscaFiltroColuna,
  setBuscaFiltroColuna,
  alternarValorFiltroAusenciasMedicoLocal,
  selecionarTodosFiltroAusenciasMedicoLocal,
  desmarcarTodosFiltroAusenciasMedicoLocal,
  mensagemVazia,
}: {
  linhasOrdenadas: AusenciaMedicoLocalDetalheRow[]
  sortAusenciasMedicoLocal: AusenciaMedicoLocalSort[]
  alternarOrdenacaoAusenciasMedicoLocal: (key: AusenciaMedicoLocalSortKey, append: boolean) => void
  filtrosAusenciasMedicoLocal: AusenciaMedicoLocalFilters
  opcoesFiltrosAusenciasMedicoLocal: Partial<Record<AusenciaMedicoLocalSortKey, string[]>>
  colunaFiltroAberta: AusenciaMedicoLocalSortKey | null
  setColunaFiltroAberta: Dispatch<SetStateAction<AusenciaMedicoLocalSortKey | null>>
  buscaFiltroColuna: string
  setBuscaFiltroColuna: Dispatch<SetStateAction<string>>
  alternarValorFiltroAusenciasMedicoLocal: (key: AusenciaMedicoLocalSortKey, valor: string) => void
  selecionarTodosFiltroAusenciasMedicoLocal: (key: AusenciaMedicoLocalSortKey) => void
  desmarcarTodosFiltroAusenciasMedicoLocal: (key: AusenciaMedicoLocalSortKey) => void
  mensagemVazia: string
}) {
  return (
    <table className="w-full min-w-[1080px] table-auto text-left text-sm">
      <thead>
        <tr className="border-b border-black/10 text-[11px] uppercase tracking-wide text-brand-gray">
          {([
            { key: 'data', label: 'Data' },
            { key: 'nomeColaborador', label: 'Nome do colaborador' },
            { key: 'setor', label: 'Setor' },
            { key: 'qntd', label: 'QNTD' },
            { key: 'tipo', label: 'Tipo' },
            { key: 'cid', label: 'CID' },
            { key: 'statusColaborador', label: 'Status' },
          ] as { key: AusenciaMedicoLocalSortKey; label: string }[]).map((col, idx) => {
            const criterio = sortAusenciasMedicoLocal.find((c) => c.key === col.key)
            const prioridade = sortAusenciasMedicoLocal.findIndex((c) => c.key === col.key)
            const opcoesColuna = opcoesFiltrosAusenciasMedicoLocal[col.key] ?? []
            const filtroColuna = filtrosAusenciasMedicoLocal[col.key] ?? []
            const filtroAtivo = filtroColuna.length > 0
            const isLast = idx === 6
            const filtroAberto = colunaFiltroAberta === col.key
            const alinharPopover = idx <= 2 ? 'start' : 'end'
            return (
              <th key={col.key} className={isLast ? 'pb-2 font-semibold' : 'pb-2 pr-2 font-semibold'}>
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left hover:text-navy"
                    onClick={(e) => alternarOrdenacaoAusenciasMedicoLocal(col.key, e.ctrlKey)}
                    title="Clique para ordenar | Ctrl+clique para multi-ordenação"
                  >
                    <span>{col.label}</span>
                    {criterio ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-navy">
                        {criterio.direction === 'asc' ? '▲' : '▼'}
                        {sortAusenciasMedicoLocal.length > 1 ? <span>{prioridade + 1}</span> : null}
                      </span>
                    ) : null}
                  </button>
                  <Popover
                    open={filtroAberto}
                    onOpenChange={(open) => {
                      if (open) {
                        setColunaFiltroAberta(col.key)
                      } else {
                        setColunaFiltroAberta(null)
                        setBuscaFiltroColuna('')
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={`rounded border p-1 ${filtroAtivo ? 'border-brand-blue bg-brand-blue/10 text-brand-blue' : 'border-black/10 bg-page text-brand-ink hover:bg-white'}`}
                        title="Filtrar valores da coluna"
                        aria-expanded={filtroAberto}
                        aria-haspopup="dialog"
                      >
                        <Filter className="h-3 w-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align={alinharPopover}
                      side="bottom"
                      sideOffset={6}
                      collisionPadding={12}
                      className="z-[200] w-[min(280px,calc(100vw-2.5rem))] border-black/10 bg-white p-2 shadow-xl"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      <PainelFiltroColunaAusencias
                        colKey={col.key}
                        buscaFiltroColuna={buscaFiltroColuna}
                        setBuscaFiltroColuna={setBuscaFiltroColuna}
                        opcoesColuna={opcoesColuna}
                        filtroColuna={filtroColuna}
                        alternarValorFiltroAusenciasMedicoLocal={alternarValorFiltroAusenciasMedicoLocal}
                        selecionarTodosFiltroAusenciasMedicoLocal={selecionarTodosFiltroAusenciasMedicoLocal}
                        desmarcarTodosFiltroAusenciasMedicoLocal={desmarcarTodosFiltroAusenciasMedicoLocal}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {linhasOrdenadas.length === 0 ? (
          <tr>
            <td colSpan={7} className="py-3 text-xs text-brand-gray">
              {mensagemVazia}
            </td>
          </tr>
        ) : (
          linhasOrdenadas.map((l, i) => (
            <tr
              key={`${l.data}-${l.nomeColaborador}-${l.tipo}-${i}`}
              className={`border-b border-black/5 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-brand-blue/5`}
            >
              <td className="whitespace-nowrap py-2 pr-2 align-top text-brand-ink">{l.data}</td>
              <td className="break-words py-2 pr-2 align-top text-brand-ink">{l.nomeColaborador}</td>
              <td className="break-words py-2 pr-2 align-top text-brand-ink">{l.setor}</td>
              <td className="whitespace-nowrap py-2 pr-2 align-top tabular-nums text-brand-ink">{l.qntd}</td>
              <td className="break-words py-2 pr-2 align-top text-brand-ink">{l.tipo}</td>
              <td className="break-words py-2 pr-2 align-top text-brand-ink">{l.cid}</td>
              <td className="whitespace-nowrap py-2 align-top">
                <span
                  className={
                    l.statusColaborador === 'Ativo'
                      ? 'inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900'
                      : 'inline-block rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900'
                  }
                >
                  {l.statusColaborador}
                </span>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}

function DistribuicaoDiasDonut({ d }: { d: DistribuicaoDiasPerdidosTipo }) {
  const total = d.atestados + d.faltasInjustificadas + d.declaracoesOutrosJustificados
  const sliceDefs = [
    { key: 'a', name: 'Atestados', value: d.atestados, fill: LINE.just },
    { key: 'f', name: 'Faltas injustificadas', value: d.faltasInjustificadas, fill: LINE.inj },
    {
      key: 'o',
      name: 'Declaração / outros',
      value: d.declaracoesOutrosJustificados,
      fill: '#94a3b8',
    },
  ]
  const pieData = sliceDefs.filter((s) => s.value > 0)

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="relative mx-auto aspect-square w-full max-w-[min(280px,88%)] shrink-0">
        {pieData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="68%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke="#fff"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${fmtPt(Number(value ?? 0))} dias`, 'QNTD']}
                  contentStyle={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6">
              <span className="text-3xl font-bold tabular-nums leading-none text-navy sm:text-4xl">{fmtPt(total)}</span>
              <span className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-brand-gray sm:text-[11px]">
                Dias perdidos
              </span>
            </div>
          </>
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-dashed border-black/10 bg-page px-4 text-center text-sm text-brand-gray">
            Sem dados no filtro
          </div>
        )}
      </div>
      <ul className="flex w-full flex-col gap-3">
        {sliceDefs.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0
          return (
            <li key={s.key} className="flex min-w-0 items-start gap-3">
              <span
                className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/5 sm:mt-1.5 sm:h-4 sm:w-4"
                style={{ backgroundColor: s.fill }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold leading-snug text-brand-ink">{s.name}</p>
                <p className="mt-1 text-sm tabular-nums text-brand-gray">
                  {fmtPt(s.value)} ({pctFmt(pct)}%)
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function DonutTop3({
  items,
  ranking,
  selectedKey,
  onSliceClick,
  onContinuacaoRowClick,
}: {
  items: DonutTopItem[]
  ranking: RankingItem[]
  selectedKey?: string | null
  onSliceClick?: (item: DonutTopItem) => void
  /** Abre o mesmo fluxo da fatia correspondente ao nome no ranking após o 3º lugar. */
  onContinuacaoRowClick?: (row: RankingItem) => void
}) {
  const total = ranking.reduce((sum, item) => sum + item.value, 0)
  const pieData = items.filter((s) => s.value > 0)
  const continuacao = ranking.slice(3)

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-6">
        <div className="relative mx-auto aspect-square w-full max-w-[min(280px,88%)] shrink-0">
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="68%"
                    outerRadius="88%"
                    paddingAngle={2}
                    stroke="#fff"
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={entry.fill}
                        fillOpacity={!selectedKey || selectedKey === entry.key ? 1 : 0.35}
                        style={{ cursor: onSliceClick ? 'pointer' : 'default' }}
                        onClick={() => onSliceClick?.(entry)}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${fmtPt(Number(value ?? 0))} dias`, 'QNTD']}
                    contentStyle={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6">
                <span className="text-3xl font-bold tabular-nums leading-none text-navy sm:text-4xl">{fmtPt(total)}</span>
                <span className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-brand-gray sm:text-[11px]">
                  Dias perdidos
                </span>
              </div>
            </>
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-dashed border-black/10 bg-page px-4 text-center text-sm text-brand-gray">
              Sem dados no filtro
            </div>
          )}
        </div>
        <ul className="flex w-full flex-col gap-3">
          {items.map((s) => {
            const pct = total > 0 ? (s.value / total) * 100 : 0
            return (
              <li key={s.key} className="flex min-w-0 items-start gap-3">
                <span
                  className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/5 sm:mt-1.5 sm:h-4 sm:w-4"
                  style={{ backgroundColor: s.fill }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold leading-snug text-brand-ink">{s.name}</p>
                  <p className="mt-1 text-sm tabular-nums text-brand-gray">
                    {fmtPt(s.value)} ({pctFmt(pct)}%)
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
      <div className="mt-4 rounded-xl border border-black/10 bg-page p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-gray">Continuação do ranking</p>
        <div className="mt-2 max-h-[180px] overflow-y-auto pr-1">
          <table className="w-full min-w-[420px] table-auto text-left text-xs">
            <thead className="sticky top-0 bg-page">
              <tr className="border-b border-black/10 uppercase tracking-wide text-brand-gray">
                <th className="pb-2 pr-2 font-semibold">Pos.</th>
                <th className="pb-2 pr-2 font-semibold">Nome</th>
                <th className="pb-2 pr-2 text-right font-semibold">Dias</th>
                <th className="pb-2 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {continuacao.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-xs text-brand-gray">
                    Não há mais resultados além do Top 3 no filtro atual.
                  </td>
                </tr>
              ) : (
                continuacao.map((row, idx) => {
                  const pct = total > 0 ? (row.value / total) * 100 : 0
                  const interativo = Boolean(onContinuacaoRowClick)
                  return (
                    <tr
                      key={`${row.name}-${idx}`}
                      role={interativo ? 'button' : undefined}
                      tabIndex={interativo ? 0 : undefined}
                      title={interativo ? 'Ver detalhe (mesmo que clicar na fatia do ranking)' : undefined}
                      className={`border-b border-black/5 text-brand-ink last:border-0 ${interativo ? 'cursor-pointer hover:bg-brand-blue/5' : ''}`}
                      onClick={interativo ? () => onContinuacaoRowClick?.(row) : undefined}
                      onKeyDown={
                        interativo
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                onContinuacaoRowClick?.(row)
                              }
                            }
                          : undefined
                      }
                    >
                      <td className="py-2 pr-2 tabular-nums">{idx + 4}º</td>
                      <td className="py-2 pr-2">{row.name}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{fmtPt(row.value)}</td>
                      <td className="py-2 text-right tabular-nums">{pctFmt(pct)}%</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function medalhaRowClass(rank: number): string {
  if (rank === 1) return 'border-l-[5px] border-[#FFD700] bg-[#FFD700]/14'
  if (rank === 2) return 'border-l-[5px] border-[#C0C0C0] bg-[#C0C0C0]/20'
  if (rank === 3) return 'border-l-[5px] border-[#CD7F32] bg-[#CD7F32]/16'
  return 'border-l-[5px] border-transparent bg-page/60'
}

function SeloPosicao({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="rounded-full bg-[#FFD700]/35 px-2.5 py-1 text-[11px] font-bold text-amber-950">1º</span>
    )
  }
  if (rank === 2) {
    return (
      <span className="rounded-full bg-[#C0C0C0]/50 px-2.5 py-1 text-[11px] font-bold text-slate-800">2º</span>
    )
  }
  if (rank === 3) {
    return (
      <span className="rounded-full bg-[#CD7F32]/35 px-2.5 py-1 text-[11px] font-bold text-amber-950">3º</span>
    )
  }
  return (
    <span className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-brand-gray">{rank}º</span>
  )
}

type OpcaoCidBusca = { cid: string; token: string; grupoId: string; grupoTitulo: string }

function RankingGruposCidLista({ lista, rows }: { lista: GrupoSintomaCid[]; rows: AbsenceRow[] }) {
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false)
  const [ativoSugIdx, setAtivoSugIdx] = useState(0)
  const [destaqueGrupoId, setDestaqueGrupoId] = useState<string | null>(null)
  const [destaqueCid, setDestaqueCid] = useState<string | null>(null)
  const [msgForaTop, setMsgForaTop] = useState<string | null>(null)

  const listaRef = useRef<HTMLUListElement>(null)
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map())
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const rankPorGrupoId = useMemo(() => {
    const m = new Map<string, number>()
    lista.forEach((g, i) => m.set(g.id, i + 1))
    return m
  }, [lista])

  const opcoesCid = useMemo(() => {
    const visto = new Set<string>()
    const out: OpcaoCidBusca[] = []
    for (const r of rows) {
      if (!tipoIncluiNoRankingCid(r.tipo)) continue
      if (!cidValidoParaRanking(r.cid)) continue
      const bruto = r.cid.trim()
      if (!bruto) continue
      const chave = chaveAgregacaoCidPlanilha(bruto)
      if (visto.has(chave)) continue
      visto.add(chave)
      const cid = rotuloCidPlanilhaExibicao(bruto, chave)
      const { id, titulo } = resolverGrupoCid(chave.startsWith('livre:') ? bruto : chave)
      out.push({ cid, token: primeiroTokenCid(bruto), grupoId: id, grupoTitulo: titulo })
    }
    out.sort((a, b) => a.cid.localeCompare(b.cid, 'pt-BR', { sensitivity: 'base' }))
    return out
  }, [rows])

  const sugestoesFiltradas = useMemo(() => {
    const q = normalizeSearchText(query).trim()
    if (!q) return opcoesCid.slice(0, 40)
    const hit = opcoesCid.filter(
      (o) => textIncludesSearch(o.cid, query) || textIncludesSearch(o.token, query),
    )
    hit.sort((a, b) => {
      const ta = normalizeSearchText(a.token)
      const tb = normalizeSearchText(b.token)
      const pa = ta.startsWith(q) ? 0 : 1
      const pb = tb.startsWith(q) ? 0 : 1
      if (pa !== pb) return pa - pb
      return a.cid.localeCompare(b.cid, 'pt-BR', { sensitivity: 'base' })
    })
    return hit.slice(0, 40)
  }, [opcoesCid, query])

  const scrollParaGrupo = (grupoId: string) => {
    requestAnimationFrame(() => {
      const el = itemRefs.current.get(grupoId)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  const aplicarSelecao = (cid: string, grupoId: string, grupoTitulo: string) => {
    setQuery(cid)
    setSugestoesAbertas(false)
    setMsgForaTop(null)
    setDestaqueCid(cid)

    const grupoNaLista = lista.find((g) => g.id === grupoId)
    if (!grupoNaLista) {
      setDestaqueGrupoId(null)
      setMsgForaTop(
        `O CID está no grupo «${grupoTitulo.slice(0, 72)}${grupoTitulo.length > 72 ? '…' : ''}», que não entra no top 15 deste período.`,
      )
      return
    }

    setDestaqueGrupoId(grupoId)
    setAbertoId(grupoId)
    scrollParaGrupo(grupoId)
  }

  useEffect(() => {
    setAtivoSugIdx(0)
  }, [query, sugestoesFiltradas.length])

  useEffect(() => {
    if (!sugestoesAbertas) return
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node | null
      if (t && searchWrapRef.current?.contains(t)) return
      setSugestoesAbertas(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [sugestoesAbertas])

  useEffect(() => {
    if (!abertoId) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbertoId(null)
        setSugestoesAbertas(false)
      }
    }
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node | null
      if (t && listaRef.current?.contains(t)) return
      if (t && searchWrapRef.current?.contains(t)) return
      setAbertoId(null)
      setSugestoesAbertas(false)
    }
    window.addEventListener('keydown', onEsc)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onEsc)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [abertoId])

  if (!lista.length) {
    return <p className="py-8 text-center text-sm text-brand-gray">Sem CIDs com dados no filtro atual.</p>
  }

  return (
    <div className="space-y-3">
      <div ref={searchWrapRef} className="relative">
        <label htmlFor="busca-cid-grupo" className="sr-only">
          Pesquisar CID para localizar o grupo no ranking
        </label>
        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-3.5 h-4 w-4 text-brand-gray"
            strokeWidth={2.2}
            aria-hidden
          />
          <input
            id="busca-cid-grupo"
            ref={inputRef}
            type="search"
            autoComplete="off"
            placeholder="Pesquisar por CID (texto da planilha)…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSugestoesAbertas(true)
              setMsgForaTop(null)
            }}
            onFocus={() => setSugestoesAbertas(true)}
            onKeyDown={(e) => {
              if (!sugestoesAbertas || sugestoesFiltradas.length === 0) {
                if (e.key === 'Escape') setSugestoesAbertas(false)
                return
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setAtivoSugIdx((i) => Math.min(i + 1, sugestoesFiltradas.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setAtivoSugIdx((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                const o = sugestoesFiltradas[ativoSugIdx]
                if (o) aplicarSelecao(o.cid, o.grupoId, o.grupoTitulo)
              } else if (e.key === 'Escape') {
                setSugestoesAbertas(false)
              }
            }}
            role="combobox"
            aria-expanded={sugestoesAbertas}
            aria-controls="lista-sugestoes-cid"
            aria-autocomplete="list"
            className="w-full rounded-xl border border-black/10 bg-page py-2.5 pl-10 pr-10 text-sm text-brand-ink shadow-inner outline-none ring-navy placeholder:text-brand-gray/80 focus:border-navy/20 focus:ring-2"
          />
          {query ? (
            <button
              type="button"
              className="absolute right-2 rounded-lg p-1.5 text-brand-gray hover:bg-black/5 hover:text-brand-ink"
              aria-label="Limpar pesquisa e destaque"
              onClick={() => {
                setQuery('')
                setSugestoesAbertas(false)
                setDestaqueGrupoId(null)
                setDestaqueCid(null)
                setMsgForaTop(null)
                inputRef.current?.focus()
              }}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
        {sugestoesAbertas && query.trim() && sugestoesFiltradas.length === 0 ? (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[60] rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-brand-gray shadow-lg ring-1 ring-black/5">
            Nenhum CID encontrado para «{query.trim()}».
          </div>
        ) : null}
        {sugestoesAbertas && sugestoesFiltradas.length > 0 ? (
          <ul
            id="lista-sugestoes-cid"
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-[60] max-h-[min(280px,40vh)] overflow-y-auto rounded-xl border border-black/10 bg-white py-1 shadow-lg ring-1 ring-black/5"
          >
            {sugestoesFiltradas.map((o, idx) => {
              const rnk = rankPorGrupoId.get(o.grupoId)
              return (
                <li key={o.cid} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={idx === ativoSugIdx}
                    className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm transition ${
                      idx === ativoSugIdx ? 'bg-navy/8' : 'hover:bg-black/[0.03]'
                    }`}
                    onMouseEnter={() => setAtivoSugIdx(idx)}
                    onClick={() => aplicarSelecao(o.cid, o.grupoId, o.grupoTitulo)}
                  >
                    <span className="font-semibold text-brand-ink">{o.cid}</span>
                    <span className="text-xs leading-snug text-brand-gray">
                      {rnk ? (
                        <>
                          Grupo no ranking: <span className="font-medium text-brand-ink">{rnk}º</span>
                          {' · '}
                        </>
                      ) : (
                        <span className="text-amber-800">Fora do top 15 · </span>
                      )}
                      <span className="line-clamp-2">{o.grupoTitulo}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>

      {msgForaTop ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">{msgForaTop}</p>
      ) : null}

      <ul ref={listaRef} className="max-h-[460px] space-y-2 overflow-y-auto overflow-x-visible pr-1 pb-8">
        {lista.map((row, i) => {
          const rank = i + 1
          const expandido = abertoId === row.id
          const emDestaque = destaqueGrupoId === row.id
          return (
            <li
              key={`${row.id}-${rank}`}
              ref={(el) => {
                if (el) itemRefs.current.set(row.id, el)
                else itemRefs.current.delete(row.id)
              }}
              className={`relative scroll-mt-2 ${expandido ? 'z-50' : 'z-0'} ${
                emDestaque ? 'rounded-xl ring-2 ring-brand-blue ring-offset-2 ring-offset-white' : ''
              }`}
            >
              <button
                type="button"
                aria-expanded={expandido}
                aria-controls={`detalhe-cid-grupo-${row.id}`}
                className={`flex w-full items-center gap-3 rounded-xl border py-3 pl-4 pr-3 text-left shadow-sm outline-none ring-navy transition hover:bg-black/[0.02] focus-visible:ring-2 ${
                  emDestaque ? 'border-brand-blue/40 bg-brand-blue/10' : 'border-black/10'
                } ${medalhaRowClass(rank)}`}
                onClick={() => {
                  setAbertoId((cur) => (cur === row.id ? null : row.id))
                  if (destaqueGrupoId && destaqueGrupoId !== row.id) {
                    setDestaqueGrupoId(null)
                    setDestaqueCid(null)
                  }
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold leading-snug text-brand-ink" title={row.titulo}>
                    {row.titulo}
                  </p>
                  <p className="mt-0.5 text-xs text-brand-gray">
                    Volume total de dias (QNTD) no período
                    {emDestaque && destaqueCid ? (
                      <span className="mt-0.5 block font-medium text-brand-blue">
                        Selecionado: {destaqueCid} · {rank}º no ranking
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 flex-row items-center gap-2">
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p className="text-lg font-bold tabular-nums text-navy">{fmtPt(row.qntd)}</p>
                    <SeloPosicao rank={rank} />
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-brand-gray transition-transform ${expandido ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </div>
              </button>
              {expandido ? (
                <div
                  id={`detalhe-cid-grupo-${row.id}`}
                  role="region"
                  className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 max-h-[min(260px,50vh)] overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg ring-1 ring-black/5"
                >
                  <div className="border-b border-black/5 px-4 py-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-brand-gray">
                      CIDs neste grupo (texto da planilha)
                    </p>
                  </div>
                  <ul className="max-h-[200px] space-y-0 overflow-y-auto p-3 text-sm">
                    {row.cids.map((d) => {
                      const linhaDestaque = destaqueGrupoId === row.id && destaqueCid === d.cid
                      return (
                        <li
                          key={d.cid}
                          className={`flex items-start justify-between gap-4 border-b border-black/[0.04] py-2 last:border-0 ${
                            linhaDestaque ? 'rounded-md bg-brand-blue/10 ring-1 ring-brand-blue/25' : ''
                          }`}
                        >
                          <span className="min-w-0 break-words font-medium leading-snug text-brand-ink">{d.cid}</span>
                          <span className="shrink-0 tabular-nums font-semibold text-navy">{fmtPt(d.qntd)} dias</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

type LineDatum = {
  name: string
  anoMes: string
  Justificadas: number
  Injustificadas: number
  /** Sanções no mês (`porAnoMes` da planilha disciplinar), alinhado a `anoMes`. */
  sancoes: number
  /** Soma das sanções do primeiro mês do gráfico até este mês (mesmo critério: falta injustificada/desídia). */
  sancoesAcumulado: number
}

type SancaoDetalheMesRow = {
  matricula: string
  nome: string
  tipo: string
  dataAplicacao: string
  observacoes: string
}

type SancaoHistoricoRow = {
  matricula: string
  nome: string
  tipo: string
  dataAplicacao: string
  obs: string
}

type JustificadaLinhaDetalhe = {
  data: string
  quantidade: string
  tipo: string
  cid: string
  endereco: string
  localAtendimento: string
  medicoResponsavel: string
}

function TabelaTopFaltantes({
  titulo,
  cor,
  lista,
  textoSemDados = 'Sem registros neste mês.',
  onRowClick,
}: {
  titulo: string
  cor: string
  lista: FaltanteNoMes[]
  textoSemDados?: string
  onRowClick?: (row: FaltanteNoMes) => void
}) {
  return (
    <div className="min-w-0 w-full flex-1 rounded-xl border border-black/10 bg-page p-4 lg:min-w-[min(560px,38%)]">
      <h4 className="text-sm font-bold text-navy" style={{ borderLeft: `4px solid ${cor}`, paddingLeft: 8 }}>
        {titulo}
      </h4>
      <div className="mt-3 max-h-[280px] overflow-y-auto pr-1">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[62%]" />
            <col className="w-[22%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-black/10 text-[11px] uppercase tracking-wide text-brand-gray">
              <th className="pb-2 pr-2 font-semibold">Nome</th>
              <th className="pb-2 pr-2 font-semibold">Status</th>
              <th className="pb-2 text-right font-semibold">Dias (QNTD)</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-3 text-xs text-brand-gray">
                  {textoSemDados}
                </td>
              </tr>
            ) : (
              lista.map((row, i) => (
                <tr
                  key={`${row.matricula}-${i}`}
                  className={`border-b border-black/5 last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-black/[0.03]' : ''}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  <td className="break-words py-2 pr-3 align-top font-medium leading-snug text-brand-ink" title={row.nome}>
                    {row.nome}
                  </td>
                  <td className="py-2 pr-2 align-top">
                    <span
                      className={
                        row.ativo
                          ? 'inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900'
                          : 'inline-block rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900'
                      }
                    >
                      {row.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-2 text-right align-top tabular-nums text-brand-ink">
                    {fmtDiasQntd(row.dias)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {lista.length > 0 ? (
          <p className="mt-2 border-t border-black/5 pt-2 text-xs text-brand-gray">
            Soma na lista:{' '}
            <strong className="tabular-nums text-brand-ink">
              {fmtDiasQntd(lista.reduce((s, r) => s + r.dias, 0))} dias
            </strong>{' '}
            · {lista.length} colaborador{lista.length === 1 ? '' : 'es'}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function fmtQtdOriginal(value: string, fallbackQtd: number): string {
  const raw = String(value ?? '').trim()
  if (raw) return raw
  const n = Number(fallbackQtd)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: n % 1 === 0 ? 0 : 1, maximumFractionDigits: 2 })
}

function fmtDataBr(value: string): string {
  const raw = String(value ?? '').trim()
  if (!raw) return '-'
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return raw
  return `${m[3]}/${m[2]}/${m[1]}`
}

function normalizeMatricula(value: unknown): string {
  const raw = String(value ?? '').trim()
  const digits = raw.replace(/\D/g, '')
  if (!digits) return raw
  return digits.replace(/^0+/, '') || '0'
}

function stripDiacriticsLocal(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
}

function motivoVinculadoFaltaInjustificadaOuDesidiaLocal(obs: string): boolean {
  const n = stripDiacriticsLocal(String(obs ?? ''))
  if (!n) return false
  return n.includes('injustificad') || n.includes('desidia')
}

function parseMesPortuguesLocal(mesRaw: string): number | null {
  const raw = String(mesRaw ?? '').trim()
  if (!raw) return null
  const low = stripDiacriticsLocal(raw)
  const asInt = Number.parseInt(low.replace(/^0+/, '') || '0', 10)
  if (asInt >= 1 && asInt <= 12) return asInt
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const nomes = [
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
  ]
  for (let i = 0; i < 12; i++) {
    if (low.includes(nomes[i]) || low.startsWith(meses[i])) return i + 1
  }
  return null
}

function parseDataAplicacaoLocal(raw: string): Date | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (br) {
    const d = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const n = Number.parseFloat(s.replace(',', '.'))
  if (Number.isFinite(n) && n > 20000) {
    const epoch = Date.UTC(1899, 11, 30)
    const ms = epoch + Math.round(n) * 86400000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

function resolveAnoMesSancaoLocal(r: SancaoRow): string | null {
  const d = parseDataAplicacaoLocal(r.dataAplicacao)
  if (d) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const m = parseMesPortuguesLocal(r.mes)
  if (m != null && Number.isFinite(r.ano) && r.ano >= 1900) {
    return `${r.ano}-${String(m).padStart(2, '0')}`
  }
  return null
}

function TabelaSancoesMes({ rows }: { rows: SancaoDetalheMesRow[] }) {
  return (
    <div className="min-w-0 w-full rounded-xl border border-black/10 bg-page p-4 lg:min-w-[min(520px,34%)]">
      <h4 className="text-sm font-bold text-navy" style={{ borderLeft: `4px solid ${LINE.inj}`, paddingLeft: 8 }}>
        Sanções disciplinares (mês)
      </h4>
      <div className="mt-3 max-h-[280px] overflow-y-auto pr-1">
        <table className="w-full table-auto text-left text-sm">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[21%]" />
            <col className="w-[23%]" />
            <col className="w-[14%]" />
            <col className="w-[28%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-black/10 text-[11px] uppercase tracking-wide text-brand-gray">
              <th className="pb-2 pr-2 font-semibold">Matrícula</th>
              <th className="pb-2 pr-2 font-semibold">Nome</th>
              <th className="pb-2 pr-2 font-semibold">Tipo</th>
              <th className="pb-2 pr-2 font-semibold">Data aplicação</th>
              <th className="pb-2 font-semibold">Observações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-3 text-xs text-brand-gray">
                  Sem sanções vinculadas a falta injustificada/desídia no mês.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.matricula}-${r.dataAplicacao}-${i}`} className="border-b border-black/5 last:border-0">
                  <td className="py-2 pr-2 align-top tabular-nums text-brand-ink">{r.matricula}</td>
                  <td className="break-words py-2 pr-2 align-top text-brand-ink">{r.nome}</td>
                  <td className="break-words py-2 pr-2 align-top text-brand-ink">{r.tipo}</td>
                  <td className="py-2 pr-2 align-top tabular-nums text-brand-ink">{r.dataAplicacao}</td>
                  <td className="break-words py-2 align-top text-brand-ink">{r.observacoes || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function buildClickableDot(stroke: string, onPick: (anoMes: string) => void) {
  return (props: Record<string, unknown>) => {
    const cx = Number(props.cx)
    const cy = Number(props.cy)
    const payload = props.payload as LineDatum | undefined
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !payload?.anoMes) return null
    const label = `Ver top faltantes em ${payload.name}`
    return (
      <g
        className="cursor-pointer outline-none"
        role="button"
        tabIndex={0}
        aria-label={label}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onPick(payload.anoMes)
          }
        }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={18}
          fill="transparent"
          onClick={(e) => {
            e.stopPropagation()
            onPick(payload.anoMes)
          }}
        />
        <circle cx={cx} cy={cy} r={6} fill={stroke} stroke="#fff" strokeWidth={1} pointerEvents="none" />
      </g>
    )
  }
}

export function ChartsBoard({
  monthly,
  distribuicaoDiasTipo,
  topGruposCid,
  rows,
  sancoesResumo,
  sancoesRows,
  isColaboradorAtivo = colaboradorAtivo,
}: Props) {
  const [mesDetalhe, setMesDetalhe] = useState<string | null>(null)
  const [detalheSetor, setDetalheSetor] = useState<{ setor: string; nomeLider: string } | null>(null)
  const [detalheJustificada, setDetalheJustificada] = useState<{ matricula: number; nome: string; anoMes: string } | null>(null)
  const [detalheSancoesColaborador, setDetalheSancoesColaborador] = useState<{ matricula: number; nome: string } | null>(null)
  const [detalheMedicosPorLocal, setDetalheMedicosPorLocal] = useState<string | null>(null)
  const [pedidoExportRelatorio, setPedidoExportRelatorio] = useState<'medicos-local' | 'top-colaboradores' | null>(
    null,
  )
  const [detalheAusenciasMedicoLocal, setDetalheAusenciasMedicoLocal] = useState<{ local: string; medico: string } | null>(null)
  const [sortAusenciasMedicoLocal, setSortAusenciasMedicoLocal] = useState<AusenciaMedicoLocalSort[]>([{ key: 'data', direction: 'desc' }])
  const [filtrosAusenciasMedicoLocal, setFiltrosAusenciasMedicoLocal] = useState<AusenciaMedicoLocalFilters>({})
  const [colunaFiltroAberta, setColunaFiltroAberta] = useState<AusenciaMedicoLocalSortKey | null>(null)
  const [buscaFiltroColuna, setBuscaFiltroColuna] = useState('')
  const [medicoTopSelecionado, setMedicoTopSelecionado] = useState<string | null>(null)
  const [detalheColaboradoresMedicoTop, setDetalheColaboradoresMedicoTop] = useState<string | null>(null)
  const [detalheAusenciasColaboradorNoMedicoTop, setDetalheAusenciasColaboradorNoMedicoTop] = useState<{
    medico: string
    matricula: string
    nome: string
  } | null>(null)
  const [sortAusenciasColabMedicoTop, setSortAusenciasColabMedicoTop] = useState<AusenciaMedicoLocalSort[]>([
    { key: 'data', direction: 'desc' },
  ])
  const [filtrosAusenciasColabMedicoTop, setFiltrosAusenciasColabMedicoTop] = useState<AusenciaMedicoLocalFilters>({})
  const [colunaFiltroAbertaColabMedicoTop, setColunaFiltroAbertaColabMedicoTop] =
    useState<AusenciaMedicoLocalSortKey | null>(null)
  const [buscaFiltroColunaColabMedicoTop, setBuscaFiltroColunaColabMedicoTop] = useState('')
  const [detalheSetorSintoma, setDetalheSetorSintoma] = useState<string | null>(null)
  const [detalheAusenciasSetorColaborador, setDetalheAusenciasSetorColaborador] = useState<{
    matricula: string
    nome: string
    setor: string
  } | null>(null)

  const pickMesDetalhe = useCallback((anoMes: string) => {
    setDetalheSetor(null)
    setMesDetalhe(anoMes)
  }, [])

  const rowsIndicadores = useMemo(() => rows.filter((r) => r.contaIndicadores !== false), [rows])

  const sancoesPorMes = useMemo(() => {
    const fromResumo = new Map<string, number>()
    if (sancoesResumo?.ok) {
      for (const { anoMes, qtd } of sancoesResumo.porAnoMesFaltaInjustificadaDesidia) {
        fromResumo.set(anoMes, qtd)
      }
    }

    const fromRows = new Map<string, number>()
    for (const r of sancoesRows) {
      if (!motivoVinculadoFaltaInjustificadaOuDesidiaLocal(r.obs)) continue
      const am = resolveAnoMesSancaoLocal(r)
      if (!am) continue
      fromRows.set(am, (fromRows.get(am) ?? 0) + 1)
    }

    // Regra defensiva: quando houver divergência de parsing, usa o maior valor mensal
    const merged = new Map(fromResumo)
    for (const [am, qtdRows] of fromRows.entries()) {
      const qtdResumo = merged.get(am) ?? 0
      merged.set(am, Math.max(qtdResumo, qtdRows))
    }
    return merged
  }, [sancoesResumo, sancoesRows])

  const sancoesPlanilhaOk = sancoesResumo?.ok === true

  const lineData: LineDatum[] = useMemo(() => {
    let acum = 0
    return monthly.map((m) => {
      const sancoes = sancoesPorMes.get(m.anoMes) ?? 0
      acum += sancoes
      return {
        name: formatMesCurto(m.anoMes),
        anoMes: m.anoMes,
        Justificadas: m.just,
        Injustificadas: m.injust,
        sancoes,
        sancoesAcumulado: acum,
      }
    })
  }, [monthly, sancoesPorMes])

  const topJust = useMemo(
    () =>
      mesDetalhe
        ? topFaltantesNoMes(rowsIndicadores, mesDetalhe, 'Justificada', Number.MAX_SAFE_INTEGER, isColaboradorAtivo)
        : [],
    [rowsIndicadores, mesDetalhe, isColaboradorAtivo],
  )
  const topInj = useMemo(
    () =>
      mesDetalhe
        ? topFaltantesNoMes(rowsIndicadores, mesDetalhe, 'Injustificada', Number.MAX_SAFE_INTEGER, isColaboradorAtivo)
        : [],
    [rowsIndicadores, mesDetalhe, isColaboradorAtivo],
  )
  const aggMesDetalhe = useMemo(
    () => (mesDetalhe ? monthly.find((m) => m.anoMes === mesDetalhe) : undefined),
    [monthly, mesDetalhe],
  )
  const sancoesDetalheMes = useMemo<SancaoDetalheMesRow[]>(() => {
    if (!mesDetalhe) return []

    // Fonte primária: apuração direta das sanções em memória para evitar falhas de detalhe por parsing no resumo.
    const direto = sancoesRows
      .filter((r) => motivoVinculadoFaltaInjustificadaOuDesidiaLocal(r.obs))
      .filter((r) => resolveAnoMesSancaoLocal(r) === mesDetalhe)
      .map((r) => ({
        matricula: r.matricula,
        nome: r.nome,
        tipo: r.tipo,
        dataAplicacao: fmtDataBr(r.dataAplicacao),
        observacoes: r.obs,
      }))

    if (direto.length > 0) return direto

    // Fallback: mantém compatibilidade com o resumo pré-computado quando existir.
    if (!sancoesResumo?.ok) return []
    const detalhes = sancoesResumo.detalhesPorAnoMesFaltaInjustificadaDesidia[mesDetalhe] ?? []
    return detalhes.map((d) => ({
      matricula: d.matricula,
      nome: d.nome,
      tipo: d.tipo,
      dataAplicacao: fmtDataBr(d.dataAplicacao),
      observacoes: d.obs,
    }))
  }, [mesDetalhe, sancoesRows, sancoesResumo])

  /** Últimos 6 meses (âncora: data mais recente com ausência justificada + data), alinhado ao resumo executivo. */
  const janela6Just = useMemo(() => janelaUltimos6MesesJustificadas(rows), [rows])

  const topJustSetor = useMemo(() => {
    if (!detalheSetor || !janela6Just) return []
    return topFaltantesNoSetor(rows, detalheSetor.setor, 'Justificada', 5, janela6Just, isColaboradorAtivo)
  }, [rows, detalheSetor, janela6Just, isColaboradorAtivo])

  const topInjSetor = useMemo(() => {
    if (!detalheSetor || !janela6Just) return []
    return topFaltantesNoSetor(rows, detalheSetor.setor, 'Injustificada', 5, janela6Just, isColaboradorAtivo)
  }, [rows, detalheSetor, janela6Just, isColaboradorAtivo])
  const linhasDetalheJustificada = useMemo<JustificadaLinhaDetalhe[]>(() => {
    if (!detalheJustificada) return []
    return rows
      .filter(
        (r) =>
          r.categoria === 'Justificada' &&
          r.anoMes === detalheJustificada.anoMes &&
          Number(r.matricula) === detalheJustificada.matricula &&
          r.exibirNoDetalhamento !== false,
      )
      .sort((a, b) => (b.data?.getTime() ?? 0) - (a.data?.getTime() ?? 0))
      .map((r) => ({
        data: r.data ? r.data.toLocaleDateString('pt-BR') : '-',
        quantidade: fmtQtdOriginal(r.qntdOriginal, r.qntd),
        tipo: r.tipo,
        cid: r.cid,
        endereco: r.endereco,
        localAtendimento: r.localAtendimento,
        medicoResponsavel: r.medicoResponsavel,
      }))
  }, [detalheJustificada, rows])
  const linhasSancoesColaborador = useMemo<SancaoHistoricoRow[]>(() => {
    if (!detalheSancoesColaborador) return []
    const matricula = normalizeMatricula(detalheSancoesColaborador.matricula)
    return sancoesRows
      .filter((s) => normalizeMatricula(s.matricula) === matricula)
      .sort((a, b) => String(b.dataAplicacao).localeCompare(String(a.dataAplicacao)))
      .map((s) => ({
        matricula: s.matricula,
        nome: s.nome,
        tipo: s.tipo,
        dataAplicacao: fmtDataBr(s.dataAplicacao),
        obs: s.obs,
      }))
  }, [detalheSancoesColaborador, sancoesRows])

  useEffect(() => {
    if (
      !mesDetalhe &&
      !detalheSetor &&
      !detalheJustificada &&
      !detalheSancoesColaborador &&
      !detalheMedicosPorLocal &&
      !detalheSetorSintoma &&
      !detalheAusenciasSetorColaborador
    )
      return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMesDetalhe(null)
      setDetalheSetor(null)
      setDetalheJustificada(null)
      setDetalheSancoesColaborador(null)
      setDetalheMedicosPorLocal(null)
      setDetalheSetorSintoma(null)
      setDetalheAusenciasSetorColaborador(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    mesDetalhe,
    detalheSetor,
    detalheJustificada,
    detalheSancoesColaborador,
    detalheMedicosPorLocal,
    detalheSetorSintoma,
    detalheAusenciasSetorColaborador,
  ])
  const algumModalAberto = Boolean(
    mesDetalhe ||
      detalheSetor ||
      detalheJustificada ||
      detalheSancoesColaborador ||
      detalheMedicosPorLocal ||
      detalheSetorSintoma ||
      detalheAusenciasSetorColaborador ||
      pedidoExportRelatorio,
  )
  useEffect(() => {
    if (!algumModalAberto) return
    const prevOverflow = document.body.style.overflow
    const prevOverscroll = document.body.style.overscrollBehavior
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.overscrollBehavior = prevOverscroll
    }
  }, [algumModalAberto])

  const dotJust = useMemo(() => buildClickableDot(LINE.just, pickMesDetalhe), [pickMesDetalhe])
  const dotInj = useMemo(() => buildClickableDot(LINE.inj, pickMesDetalhe), [pickMesDetalhe])
  const [localTopSelecionado, setLocalTopSelecionado] = useState<string | null>(null)

  const rankingLocaisAtendimento = useMemo<RankingItem[]>(() => {
    const map = new Map<string, number>()
    for (const r of rowsIndicadores) {
      const raw = String(r.localAtendimento ?? '').trim() || '(Não informado)'
      const canonical = canonicalizarLocalAtendimento(raw)
      if (isCampoNaoInformado(raw) || isCampoNaoInformado(canonical)) continue
      map.set(canonical, (map.get(canonical) ?? 0) + r.qntd)
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [rowsIndicadores])

  const rankingMedicos = useMemo<RankingItem[]>(() => {
    const map = new Map<string, { value: number; rotulo: string }>()
    for (const r of rowsIndicadores) {
      const medicoRaw = String(r.medicoResponsavel ?? '').trim() || '(Não informado)'
      if (isCampoNaoInformado(medicoRaw)) continue
      const chave = chaveMedicoResponsavelAgregacao(medicoRaw)
      if (!chave) continue
      const atual = map.get(chave) ?? { value: 0, rotulo: medicoRaw }
      atual.value += r.qntd
      atual.rotulo = escolherRotuloMedicoPreferido(atual.rotulo, medicoRaw)
      map.set(chave, atual)
    }
    const fusao = fundirMapaMedicosValorRotulo(map)
    return [...fusao.values()]
      .map(({ rotulo, value }) => ({ name: rotulo, value }))
      .sort((a, b) => b.value - a.value)
  }, [rowsIndicadores])

  const topLocaisAtendimento = useMemo(() => rankingLocaisAtendimento.slice(0, 3), [rankingLocaisAtendimento])
  const topMedicos = useMemo(() => rankingMedicos.slice(0, 3), [rankingMedicos])
  const topMedicosKeys = useMemo(() => topMedicos.map((medico, i) => `medico-${i}-${medico.name}`), [topMedicos])
  const medicoTopSelecionadoIndex = useMemo(
    () => (medicoTopSelecionado ? topMedicos.findIndex((m) => m.name === medicoTopSelecionado) : -1),
    [topMedicos, medicoTopSelecionado],
  )
  const medicoTopSelecionadoKeyValue =
    medicoTopSelecionadoIndex >= 0 && medicoTopSelecionado ? `medico-${medicoTopSelecionadoIndex}-${medicoTopSelecionado}` : null
  const topLocaisKeys = useMemo(
    () => topLocaisAtendimento.map((local) => `local-${local.name}`),
    [topLocaisAtendimento],
  )
  const localTopSelecionadoKey = useMemo(
    () => (localTopSelecionado ? `local-${localTopSelecionado}` : null),
    [localTopSelecionado],
  )

  useEffect(() => {
    if (!topLocaisAtendimento.length) {
      setLocalTopSelecionado(null)
      return
    }
    if (localTopSelecionado && !topLocaisAtendimento.some((local) => local.name === localTopSelecionado)) {
      setLocalTopSelecionado(null)
    }
  }, [topLocaisAtendimento, localTopSelecionado])

  useEffect(() => {
    if (!topMedicos.length) {
      setMedicoTopSelecionado(null)
      return
    }
    if (medicoTopSelecionado && !topMedicos.some((medico) => medico.name === medicoTopSelecionado)) {
      setMedicoTopSelecionado(null)
    }
  }, [topMedicos, medicoTopSelecionado])

  useEffect(() => {
    setDetalheAusenciasColaboradorNoMedicoTop(null)
    setSortAusenciasColabMedicoTop([{ key: 'data', direction: 'desc' }])
    setFiltrosAusenciasColabMedicoTop({})
    setColunaFiltroAbertaColabMedicoTop(null)
    setBuscaFiltroColunaColabMedicoTop('')
  }, [detalheColaboradoresMedicoTop])

  const totaisLocalAtendimentoSelecionado = useMemo(() => {
    if (!detalheMedicosPorLocal) return { totalDias: 0, totalAusencias: 0 }
    let totalDias = 0
    let totalAusencias = 0
    for (const r of rowsIndicadores) {
      const rawLocal = String(r.localAtendimento ?? '').trim() || '(Não informado)'
      const canonicalLocal = canonicalizarLocalAtendimento(rawLocal)
      if (isCampoNaoInformado(rawLocal) || isCampoNaoInformado(canonicalLocal)) continue
      if (canonicalLocal !== detalheMedicosPorLocal) continue
      totalDias += r.qntd
      totalAusencias += 1
    }
    return { totalDias, totalAusencias }
  }, [rowsIndicadores, detalheMedicosPorLocal])

  const rankingMedicosNoLocalSelecionado = useMemo<RankingMedicoNoLocalItem[]>(() => {
    if (!detalheMedicosPorLocal) return []
    const map = new Map<string, { dias: number; qtdAusencias: number; rotulo: string }>()
    for (const r of rowsIndicadores) {
      const rawLocal = String(r.localAtendimento ?? '').trim() || '(Não informado)'
      const canonicalLocal = canonicalizarLocalAtendimento(rawLocal)
      if (isCampoNaoInformado(rawLocal) || isCampoNaoInformado(canonicalLocal)) continue
      if (canonicalLocal !== detalheMedicosPorLocal) continue
      const medicoRaw = String(r.medicoResponsavel ?? '').trim() || '(Não informado)'
      const chave = chaveMedicoResponsavelAgregacao(medicoRaw)
      if (!chave) {
        const atual = map.get(CHAVE_AGREGACAO_SEM_MEDICO_INFORMADO) ?? {
          dias: 0,
          qtdAusencias: 0,
          rotulo: ROTULO_SEM_MEDICO_INFORMADO,
        }
        atual.dias += r.qntd
        atual.qtdAusencias += 1
        map.set(CHAVE_AGREGACAO_SEM_MEDICO_INFORMADO, atual)
        continue
      }
      const atual = map.get(chave) ?? { dias: 0, qtdAusencias: 0, rotulo: medicoRaw }
      atual.dias += r.qntd
      atual.qtdAusencias += 1
      atual.rotulo = escolherRotuloMedicoPreferido(atual.rotulo, medicoRaw)
      map.set(chave, atual)
    }
    const fusao = fundirMapaMedicosLocalRotulo(map)
    return [...fusao.entries()]
      .map(([chave, agg]) => ({
        name: agg.rotulo,
        dias: agg.dias,
        qtdAusencias: agg.qtdAusencias,
        semMedicoInformado: chave === CHAVE_AGREGACAO_SEM_MEDICO_INFORMADO,
      }))
      .sort((a, b) => b.dias - a.dias)
  }, [rowsIndicadores, detalheMedicosPorLocal])

  const resumoMedicosNoLocalSelecionado = useMemo(() => {
    const diasSemMedico =
      rankingMedicosNoLocalSelecionado.find((item) => item.semMedicoInformado)?.dias ?? 0
    const totalMedicos = rankingMedicosNoLocalSelecionado.filter((item) => !item.semMedicoInformado).length
    return {
      totalDias: totaisLocalAtendimentoSelecionado.totalDias,
      totalAusencias: totaisLocalAtendimentoSelecionado.totalAusencias,
      totalMedicos,
      diasSemMedico,
    }
  }, [rankingMedicosNoLocalSelecionado, totaisLocalAtendimentoSelecionado])

  const linhasAusenciasMedicoLocal = useMemo<AusenciaMedicoLocalDetalheRow[]>(() => {
    if (!detalheAusenciasMedicoLocal) return []
    const { local, medico } = detalheAusenciasMedicoLocal
    return rowsIndicadores
      .filter((r) => {
        const rawLocal = String(r.localAtendimento ?? '').trim() || '(Não informado)'
        const canonicalLocal = canonicalizarLocalAtendimento(rawLocal)
        if (isCampoNaoInformado(rawLocal) || isCampoNaoInformado(canonicalLocal)) return false
        if (canonicalLocal !== local) return false
        const medicoResponsavelRaw = String(r.medicoResponsavel ?? '').trim() || '(Não informado)'
        if (medico === ROTULO_SEM_MEDICO_INFORMADO) {
          return medicoAusenciaSemInformacaoNoCadastro(medicoResponsavelRaw)
        }
        if (medicoAusenciaSemInformacaoNoCadastro(medicoResponsavelRaw)) return false
        return medicosRepresentamMesmaPessoa(medicoResponsavelRaw, medico)
      })
      .sort((a, b) => (b.data?.getTime() ?? 0) - (a.data?.getTime() ?? 0))
      .map((r) => ({
        data: r.data
          ? fmtDataBr(
              `${r.data.getFullYear()}-${String(r.data.getMonth() + 1).padStart(2, '0')}-${String(r.data.getDate()).padStart(2, '0')}`,
            )
          : '-',
        dataTimestamp: r.data?.getTime?.() ?? null,
        nomeColaborador: String(r.nome ?? '').trim() || '(Não informado)',
        setor: String(r.setor ?? '').trim() || '(Não informado)',
        qntd: fmtQtdOriginal(r.qntdOriginal, r.qntd),
        qntdValor: Number.isFinite(r.qntd) ? r.qntd : 0,
        tipo: String(r.tipo ?? '').trim() || '(Sem tipo)',
        cid: String(r.cid ?? '').trim() || '(Sem CID)',
        statusColaborador: isColaboradorAtivo(Number(r.matricula) || 0) ? 'Ativo' : 'Inativo',
      }))
  }, [rowsIndicadores, detalheAusenciasMedicoLocal])

  const getAusenciaMedicoLocalCellValue = useCallback(
    (row: AusenciaMedicoLocalDetalheRow, key: AusenciaMedicoLocalSortKey): string => {
      if (key === 'data') return row.data
      if (key === 'nomeColaborador') return row.nomeColaborador
      if (key === 'setor') return row.setor
      if (key === 'qntd') return row.qntd
      if (key === 'tipo') return row.tipo
      if (key === 'cid') return row.cid
      return row.statusColaborador
    },
    [],
  )

  const opcoesFiltrosAusenciasMedicoLocal = useMemo(() => {
    const keys: AusenciaMedicoLocalSortKey[] = ['data', 'nomeColaborador', 'setor', 'qntd', 'tipo', 'cid', 'statusColaborador']
    const out: Partial<Record<AusenciaMedicoLocalSortKey, string[]>> = {}
    for (const key of keys) {
      const uniq = new Set<string>()
      for (const row of linhasAusenciasMedicoLocal) {
        const v = getAusenciaMedicoLocalCellValue(row, key)
        uniq.add(String(v ?? '').trim() || '-')
      }
      out[key] = [...uniq].sort((a, b) => compareTextPtBr(a, b))
    }
    return out
  }, [linhasAusenciasMedicoLocal, getAusenciaMedicoLocalCellValue])

  const linhasAusenciasMedicoLocalFiltradas = useMemo(() => {
    return linhasAusenciasMedicoLocal.filter((row) => {
      for (const [k, values] of Object.entries(filtrosAusenciasMedicoLocal) as [AusenciaMedicoLocalSortKey, string[] | undefined][]) {
        if (!values || values.length === 0) continue
        const cellValue = getAusenciaMedicoLocalCellValue(row, k)
        if (!values.includes(cellValue)) return false
      }
      return true
    })
  }, [linhasAusenciasMedicoLocal, filtrosAusenciasMedicoLocal, getAusenciaMedicoLocalCellValue])

  const linhasAusenciasMedicoLocalOrdenadas = useMemo(() => {
    if (sortAusenciasMedicoLocal.length === 0) return linhasAusenciasMedicoLocalFiltradas
    return [...linhasAusenciasMedicoLocalFiltradas].sort((a, b) => {
      for (const criterio of sortAusenciasMedicoLocal) {
        let cmp = 0
        if (criterio.key === 'data') {
          cmp = (a.dataTimestamp ?? Number.NEGATIVE_INFINITY) - (b.dataTimestamp ?? Number.NEGATIVE_INFINITY)
        } else if (criterio.key === 'nomeColaborador') {
          cmp = compareTextPtBr(a.nomeColaborador, b.nomeColaborador)
        } else if (criterio.key === 'setor') {
          cmp = compareTextPtBr(a.setor, b.setor)
        } else if (criterio.key === 'qntd') {
          cmp = a.qntdValor - b.qntdValor
        } else if (criterio.key === 'tipo') {
          cmp = compareTextPtBr(a.tipo, b.tipo)
        } else if (criterio.key === 'cid') {
          cmp = compareTextPtBr(a.cid, b.cid)
        } else if (criterio.key === 'statusColaborador') {
          cmp = compareTextPtBr(a.statusColaborador, b.statusColaborador)
        }
        if (cmp !== 0) return criterio.direction === 'asc' ? cmp : -cmp
      }
      return 0
    })
  }, [linhasAusenciasMedicoLocalFiltradas, sortAusenciasMedicoLocal])

  const linhasAusenciasColaboradorNoMedicoTop = useMemo<AusenciaMedicoLocalDetalheRow[]>(() => {
    if (!detalheAusenciasColaboradorNoMedicoTop) return []
    const { medico, matricula, nome } = detalheAusenciasColaboradorNoMedicoTop
    return rowsIndicadores
      .filter((r) => {
        const medicoLinha = String(r.medicoResponsavel ?? '').trim() || '(Não informado)'
        if (isCampoNaoInformado(medicoLinha) || !medicosRepresentamMesmaPessoa(medicoLinha, medico)) return false
        const m = normalizeMatricula(r.matricula)
        const n = String(r.nome ?? '').trim() || '(Não informado)'
        return m === matricula && n === nome
      })
      .sort((a, b) => (b.data?.getTime() ?? 0) - (a.data?.getTime() ?? 0))
      .map((r) => ({
        data: r.data
          ? fmtDataBr(
              `${r.data.getFullYear()}-${String(r.data.getMonth() + 1).padStart(2, '0')}-${String(r.data.getDate()).padStart(2, '0')}`,
            )
          : '-',
        dataTimestamp: r.data?.getTime?.() ?? null,
        nomeColaborador: String(r.nome ?? '').trim() || '(Não informado)',
        setor: String(r.setor ?? '').trim() || '(Não informado)',
        qntd: fmtQtdOriginal(r.qntdOriginal, r.qntd),
        qntdValor: Number.isFinite(r.qntd) ? r.qntd : 0,
        tipo: String(r.tipo ?? '').trim() || '(Sem tipo)',
        cid: String(r.cid ?? '').trim() || '(Sem CID)',
        statusColaborador: isColaboradorAtivo(Number(r.matricula) || 0) ? 'Ativo' : 'Inativo',
      }))
  }, [rowsIndicadores, detalheAusenciasColaboradorNoMedicoTop])

  const opcoesFiltrosAusenciasColabMedicoTop = useMemo(() => {
    const keys: AusenciaMedicoLocalSortKey[] = ['data', 'nomeColaborador', 'setor', 'qntd', 'tipo', 'cid', 'statusColaborador']
    const out: Partial<Record<AusenciaMedicoLocalSortKey, string[]>> = {}
    for (const key of keys) {
      const uniq = new Set<string>()
      for (const row of linhasAusenciasColaboradorNoMedicoTop) {
        const v = getAusenciaMedicoLocalCellValue(row, key)
        uniq.add(String(v ?? '').trim() || '-')
      }
      out[key] = [...uniq].sort((a, b) => compareTextPtBr(a, b))
    }
    return out
  }, [linhasAusenciasColaboradorNoMedicoTop, getAusenciaMedicoLocalCellValue])

  const linhasAusenciasColabMedicoTopFiltradas = useMemo(() => {
    return linhasAusenciasColaboradorNoMedicoTop.filter((row) => {
      for (const [k, values] of Object.entries(filtrosAusenciasColabMedicoTop) as [
        AusenciaMedicoLocalSortKey,
        string[] | undefined,
      ][]) {
        if (!values || values.length === 0) continue
        const cellValue = getAusenciaMedicoLocalCellValue(row, k)
        if (!values.includes(cellValue)) return false
      }
      return true
    })
  }, [linhasAusenciasColaboradorNoMedicoTop, filtrosAusenciasColabMedicoTop, getAusenciaMedicoLocalCellValue])

  const linhasAusenciasColabMedicoTopOrdenadas = useMemo(() => {
    if (sortAusenciasColabMedicoTop.length === 0) return linhasAusenciasColabMedicoTopFiltradas
    return [...linhasAusenciasColabMedicoTopFiltradas].sort((a, b) => {
      for (const criterio of sortAusenciasColabMedicoTop) {
        let cmp = 0
        if (criterio.key === 'data') {
          cmp = (a.dataTimestamp ?? Number.NEGATIVE_INFINITY) - (b.dataTimestamp ?? Number.NEGATIVE_INFINITY)
        } else if (criterio.key === 'nomeColaborador') {
          cmp = compareTextPtBr(a.nomeColaborador, b.nomeColaborador)
        } else if (criterio.key === 'setor') {
          cmp = compareTextPtBr(a.setor, b.setor)
        } else if (criterio.key === 'qntd') {
          cmp = a.qntdValor - b.qntdValor
        } else if (criterio.key === 'tipo') {
          cmp = compareTextPtBr(a.tipo, b.tipo)
        } else if (criterio.key === 'cid') {
          cmp = compareTextPtBr(a.cid, b.cid)
        } else if (criterio.key === 'statusColaborador') {
          cmp = compareTextPtBr(a.statusColaborador, b.statusColaborador)
        }
        if (cmp !== 0) return criterio.direction === 'asc' ? cmp : -cmp
      }
      return 0
    })
  }, [linhasAusenciasColabMedicoTopFiltradas, sortAusenciasColabMedicoTop])

  const alternarOrdenacaoAusenciasColabMedicoTop = useCallback((key: AusenciaMedicoLocalSortKey, append: boolean) => {
    setSortAusenciasColabMedicoTop((prev) => {
      const idx = prev.findIndex((c) => c.key === key)
      const nextDirection: SortDirection = idx >= 0 && prev[idx].direction === 'asc' ? 'desc' : 'asc'
      if (append) {
        if (idx >= 0) {
          return prev.map((c, i) => (i === idx ? { ...c, direction: nextDirection } : c))
        }
        return [...prev, { key, direction: 'asc' }]
      }
      return [{ key, direction: nextDirection }]
    })
  }, [])

  const alternarValorFiltroAusenciasColabMedicoTop = useCallback((key: AusenciaMedicoLocalSortKey, valor: string) => {
    setFiltrosAusenciasColabMedicoTop((prev) => {
      const atuais = prev[key] ?? []
      const existe = atuais.includes(valor)
      const proximo = existe ? atuais.filter((v) => v !== valor) : [...atuais, valor]
      return { ...prev, [key]: proximo }
    })
  }, [])

  const selecionarTodosFiltroAusenciasColabMedicoTop = useCallback(
    (key: AusenciaMedicoLocalSortKey) => {
      const todos = opcoesFiltrosAusenciasColabMedicoTop[key] ?? []
      setFiltrosAusenciasColabMedicoTop((prev) => ({ ...prev, [key]: [...todos] }))
    },
    [opcoesFiltrosAusenciasColabMedicoTop],
  )

  const desmarcarTodosFiltroAusenciasColabMedicoTop = useCallback((key: AusenciaMedicoLocalSortKey) => {
    setFiltrosAusenciasColabMedicoTop((prev) => ({ ...prev, [key]: [] }))
  }, [])

  const fecharAusenciasColaboradorNoMedicoTop = useCallback(() => {
    setDetalheAusenciasColaboradorNoMedicoTop(null)
    setSortAusenciasColabMedicoTop([{ key: 'data', direction: 'desc' }])
    setFiltrosAusenciasColabMedicoTop({})
    setColunaFiltroAbertaColabMedicoTop(null)
    setBuscaFiltroColunaColabMedicoTop('')
  }, [])

  const detalheColaboradoresPorMedicoTop = useMemo<ColaboradorResumoMedicoItem[]>(() => {
    if (!detalheColaboradoresMedicoTop) return []
    const map = new Map<string, ColaboradorResumoMedicoItem>()
    for (const r of rowsIndicadores) {
      const medico = String(r.medicoResponsavel ?? '').trim() || '(Não informado)'
      if (
        isCampoNaoInformado(medico) ||
        !detalheColaboradoresMedicoTop ||
        !medicosRepresentamMesmaPessoa(medico, detalheColaboradoresMedicoTop)
      )
        continue
      const matricula = normalizeMatricula(r.matricula)
      const nome = String(r.nome ?? '').trim() || '(Não informado)'
      const key = `${matricula}__${nome.toUpperCase()}`
      const cur = map.get(key) ?? {
        matricula,
        nome,
        dias: 0,
        qtdAusencias: 0,
        status: isColaboradorAtivo(Number(r.matricula) || 0) ? 'Ativo' : 'Inativo',
      }
      cur.dias += r.qntd
      cur.qtdAusencias += 1
      map.set(key, cur)
    }
    return [...map.values()].sort((a, b) => b.dias - a.dias)
  }, [rowsIndicadores, detalheColaboradoresMedicoTop])

  const alternarOrdenacaoAusenciasMedicoLocal = useCallback((key: AusenciaMedicoLocalSortKey, append: boolean) => {
    setSortAusenciasMedicoLocal((prev) => {
      const idx = prev.findIndex((c) => c.key === key)
      const nextDirection: SortDirection = idx >= 0 && prev[idx].direction === 'asc' ? 'desc' : 'asc'
      if (append) {
        if (idx >= 0) {
          return prev.map((c, i) => (i === idx ? { ...c, direction: nextDirection } : c))
        }
        return [...prev, { key, direction: 'asc' }]
      }
      return [{ key, direction: nextDirection }]
    })
  }, [])

  const alternarValorFiltroAusenciasMedicoLocal = useCallback((key: AusenciaMedicoLocalSortKey, valor: string) => {
    setFiltrosAusenciasMedicoLocal((prev) => {
      const atuais = prev[key] ?? []
      const existe = atuais.includes(valor)
      const proximo = existe ? atuais.filter((v) => v !== valor) : [...atuais, valor]
      return { ...prev, [key]: proximo }
    })
  }, [])

  const selecionarTodosFiltroAusenciasMedicoLocal = useCallback(
    (key: AusenciaMedicoLocalSortKey) => {
      const todos = opcoesFiltrosAusenciasMedicoLocal[key] ?? []
      setFiltrosAusenciasMedicoLocal((prev) => ({ ...prev, [key]: [...todos] }))
    },
    [opcoesFiltrosAusenciasMedicoLocal],
  )

  const desmarcarTodosFiltroAusenciasMedicoLocal = useCallback((key: AusenciaMedicoLocalSortKey) => {
    setFiltrosAusenciasMedicoLocal((prev) => ({ ...prev, [key]: [] }))
  }, [])

  const cenarioFaltasPainel = useMemo(() => {
    const totalDias = rows.reduce((s, r) => s + r.qntd, 0)
    let injDias = 0
    const setorInj = new Map<string, number>()
    let justDias = 0
    const setorJust = new Map<string, number>()
    for (const r of rows) {
      if (r.categoria === 'Injustificada') {
        injDias += r.qntd
        setorInj.set(r.setor, (setorInj.get(r.setor) ?? 0) + r.qntd)
      } else if (r.categoria === 'Justificada') {
        justDias += r.qntd
        setorJust.set(r.setor, (setorJust.get(r.setor) ?? 0) + r.qntd)
      }
    }
    const topSetores = [...setorInj.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    const topSetoresJust = [...setorJust.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    const pct = totalDias > 0 ? (injDias / totalDias) * 100 : 0
    const [topJ] = topSetoresJust
    const concJustTop1 = justDias > 0 && topJ ? (topJ[1] / justDias) * 100 : 0
    return { totalDias, injDias, justDias, pct, topSetores, topSetoresJust, concJustTop1 }
  }, [rows])

  /** Métricas para o fluxo executivo (contexto, problema, interpretação). */
  const fluxoExecutivo = useMemo(() => {
    const { atestados, faltasInjustificadas, declaracoesOutrosJustificados } = distribuicaoDiasTipo
    const totalTipo = atestados + faltasInjustificadas + declaracoesOutrosJustificados
    const pctAtest = totalTipo > 0 ? (atestados / totalTipo) * 100 : 0
    const pctInjustTipo = totalTipo > 0 ? (faltasInjustificadas / totalTipo) * 100 : 0
    const pctOutros = totalTipo > 0 ? (declaracoesOutrosJustificados / totalTipo) * 100 : 0
    const pctJustificadas = totalTipo > 0 ? ((atestados + declaracoesOutrosJustificados) / totalTipo) * 100 : 0

    const n = monthly.length
    const mid = Math.max(1, Math.floor(n / 2))
    const first = monthly.slice(0, mid)
    const second = monthly.slice(mid)
    const sumK = (arr: MesAgg[], key: 'just' | 'injust') => arr.reduce((s, m) => s + m[key], 0)
    const just1 = sumK(first, 'just')
    const just2 = sumK(second, 'just')
    const inj1 = sumK(first, 'injust')
    const inj2 = sumK(second, 'injust')
    const varJustPct = just1 > 0 ? ((just2 - just1) / just1) * 100 : just2 > 0 ? 100 : 0
    const varInjPct = inj1 > 0 ? ((inj2 - inj1) / inj1) * 100 : inj2 > 0 ? 100 : 0

    const concJustTop1Setor = cenarioFaltasPainel.concJustTop1

    const topCidGrupo = topGruposCid[0]?.titulo ?? ''

    return {
      totalTipo,
      pctAtest,
      pctInjustTipo,
      pctOutros,
      pctJustificadas,
      varJustPct,
      varInjPct,
      nMeses: n,
      concJustTop1Setor,
      topCidGrupo,
    }
  }, [distribuicaoDiasTipo, monthly, cenarioFaltasPainel, topGruposCid])

  /** Últimos 6 meses relativos à data mais recente do filtro: dias justificados e grupo de sintomas (CID). */
  const insightJustificadas6Meses = useMemo(() => {
    const janela = janelaUltimos6MesesJustificadas(rows)
    if (!janela) return null

    let total = 0
    let diasRankeaveis = 0
    const porGrupo = new Map<string, { titulo: string; qntd: number }>()

    for (const r of rows) {
      if (r.categoria !== 'Justificada' || !r.data) continue
      const t = r.data.getTime()
      if (t < janela.tMin || t > janela.tMax) continue
      total += r.qntd

      if (!tipoIncluiNoRankingCid(r.tipo)) continue
      if (!cidValidoParaRanking(r.cid)) continue

      diasRankeaveis += r.qntd
      const g = resolverGrupoCid(r.cid)
      const cur = porGrupo.get(g.id) ?? { titulo: g.titulo, qntd: 0 }
      cur.qntd += r.qntd
      cur.titulo = g.titulo
      porGrupo.set(g.id, cur)
    }

    if (total <= 0) {
      return {
        total: 0,
        diasRankeaveis: 0,
        topGrupoId: null as string | null,
        topGrupoTitulo: null as string | null,
        topGrupoDias: 0,
        topGrupoPctSub: 0,
      }
    }

    const sorted = [...porGrupo.entries()].sort((a, b) => b[1].qntd - a[1].qntd)
    const topEntry = sorted[0]
    const topGrupoId = topEntry?.[0] ?? null
    const first = topEntry?.[1]
    const topGrupoTitulo = first?.titulo ?? null
    const topGrupoDias = first?.qntd ?? 0
    const topGrupoPctSub = diasRankeaveis > 0 ? (topGrupoDias / diasRankeaveis) * 100 : 0

    return { total, diasRankeaveis, topGrupoId, topGrupoTitulo, topGrupoDias, topGrupoPctSub }
  }, [rows])

  /** Top 5 setores por dias (QNTD) no grupo de sintomas principal (maior volume na janela de 6 meses). */
  const topSetoresPorGrupoPrincipal = useMemo(() => {
    const grupoId = insightJustificadas6Meses?.topGrupoId
    const janela = janelaUltimos6MesesJustificadas(rows)
    if (!grupoId || !janela) return []

    const map = new Map<string, number>()
    for (const r of rows) {
      if (r.categoria !== 'Justificada' || !r.data) continue
      const t = r.data.getTime()
      if (t < janela.tMin || t > janela.tMax) continue
      if (!tipoIncluiNoRankingCid(r.tipo)) continue
      if (!cidValidoParaRanking(r.cid)) continue
      const { id } = resolverGrupoCid(r.cid)
      if (id !== grupoId) continue
      const setor = (r.setor ?? '').trim() || '(Sem setor)'
      map.set(setor, (map.get(setor) ?? 0) + r.qntd)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [rows, insightJustificadas6Meses])
  const colaboradoresPorSetorSintoma = useMemo(() => {
    if (!detalheSetorSintoma) return []
    const grupoId = insightJustificadas6Meses?.topGrupoId
    const janela = janelaUltimos6MesesJustificadas(rows)
    if (!grupoId || !janela) return []

    const map = new Map<
      string,
      {
        matricula: string
        nome: string
        setor: string
        dias: number
        status: 'Ativo' | 'Inativo'
      }
    >()

    for (const r of rows) {
      if (r.categoria !== 'Justificada' || !r.data) continue
      const setor = (r.setor ?? '').trim() || '(Sem setor)'
      if (setor !== detalheSetorSintoma) continue
      const t = r.data.getTime()
      if (t < janela.tMin || t > janela.tMax) continue
      if (!tipoIncluiNoRankingCid(r.tipo)) continue
      if (!cidValidoParaRanking(r.cid)) continue
      const { id } = resolverGrupoCid(r.cid)
      if (id !== grupoId) continue

      const matricula = normalizeMatricula(r.matricula)
      const nome = String(r.nome ?? '').trim() || '(Sem nome)'
      const key = `${matricula}__${nome.toUpperCase()}`
      const current = map.get(key) ?? {
        matricula,
        nome,
        setor,
        dias: 0,
        status: isColaboradorAtivo(Number(r.matricula) || 0) ? 'Ativo' : 'Inativo',
      }
      current.dias += r.qntd
      map.set(key, current)
    }

    return [...map.values()].sort(
      (a, b) =>
        b.dias - a.dias || a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
    )
  }, [rows, detalheSetorSintoma, insightJustificadas6Meses, isColaboradorAtivo])
  const linhasAusenciasSetorColaborador = useMemo<JustificadaLinhaDetalhe[]>(() => {
    if (!detalheAusenciasSetorColaborador) return []
    const grupoId = insightJustificadas6Meses?.topGrupoId
    const janela = janelaUltimos6MesesJustificadas(rows)
    if (!grupoId || !janela) return []

    const alvoMatricula = normalizeMatricula(detalheAusenciasSetorColaborador.matricula)
    const alvoSetor = detalheAusenciasSetorColaborador.setor

    return rows
      .filter((r) => r.categoria === 'Justificada' && r.data && r.exibirNoDetalhamento !== false)
      .filter((r) => {
        const setor = (r.setor ?? '').trim() || '(Sem setor)'
        if (setor !== alvoSetor) return false
        if (normalizeMatricula(r.matricula) !== alvoMatricula) return false
        const t = r.data.getTime()
        if (t < janela.tMin || t > janela.tMax) return false
        if (!tipoIncluiNoRankingCid(r.tipo)) return false
        if (!cidValidoParaRanking(r.cid)) return false
        const { id } = resolverGrupoCid(r.cid)
        return id === grupoId
      })
      .sort((a, b) => (b.data?.getTime() ?? 0) - (a.data?.getTime() ?? 0))
      .map((r) => ({
        data: r.data ? r.data.toLocaleDateString('pt-BR') : '-',
        quantidade: fmtQtdOriginal(r.qntdOriginal, r.qntd),
        tipo: r.tipo,
        cid: r.cid,
        endereco: r.endereco,
        localAtendimento: r.localAtendimento,
        medicoResponsavel: r.medicoResponsavel,
      }))
  }, [rows, detalheAusenciasSetorColaborador, insightJustificadas6Meses])

  /** Priorização no pilar Gestão: mais dias justificados na mesma janela de 6 meses do executivo. */
  const gestaoAtencaoColaboradores6m = useMemo(
    () => topColaboradoresJustificadosAtencao6Meses(rows, 10, isColaboradorAtivo),
    [rows, isColaboradorAtivo],
  )

  /** Exibição por impacto: maior número de dias perdidos primeiro (empate: nome). */
  const gestaoAtencaoPorDiasDesc = useMemo(
    () =>
      [...gestaoAtencaoColaboradores6m].sort(
        (a, b) =>
          b.diasPerdidosJustificados - a.diasPerdidosJustificados ||
          a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
      ),
    [gestaoAtencaoColaboradores6m],
  )

  const executarExportMedicosLocal = useCallback(
    (ordenacao: OrdenacaoExportRelatorio) => {
      if (!detalheMedicosPorLocal) return
      try {
        downloadRelatorioMedicosLocalXlsx(rowsIndicadores, detalheMedicosPorLocal, isColaboradorAtivo, {
          somenteColaboradoresAtivos: true,
          ordenacao,
          ordemAtualChaves: rankingMedicosNoLocalSelecionado.map((m) => m.name),
        })
      } catch (err) {
        console.error('Falha ao exportar relatório de médicos', err)
        window.alert('Não foi possível gerar a planilha. Tente novamente ou use outro navegador.')
        return
      }
      setPedidoExportRelatorio(null)
    },
    [detalheMedicosPorLocal, rowsIndicadores, isColaboradorAtivo, rankingMedicosNoLocalSelecionado],
  )

  const executarExportTopColaboradores = useCallback(
    (ordenacao: OrdenacaoExportRelatorio) => {
      try {
        downloadRelatorioTopColaboradoresAtivosXlsx(rows, isColaboradorAtivo, 10, {
          ordenacao,
          ordemAtualChaves: gestaoAtencaoPorDiasDesc.map((c) => String(c.matricula)),
        })
      } catch (err) {
        console.error('Falha ao exportar relatório de colaboradores', err)
        window.alert('Não foi possível gerar a planilha. Tente novamente ou use outro navegador.')
        return
      }
      setPedidoExportRelatorio(null)
    },
    [rows, isColaboradorAtivo, gestaoAtencaoPorDiasDesc],
  )

  const planoExecutivoAcoes = useMemo<AcaoPlanoExecutivo[]>(
    () => [
      {
        bloco: 'Controle',
        prioridade: 'PRIORIDADE MÁXIMA',
        tipo: 'Estrutural',
        titulo: 'Monitoramento de recorrência',
        oQue: 'Criar um alerta para identificar colaboradores que, em um período de 60 dias, acumulem mais de 15 dias de afastamento por atestados médicos relacionados ao mesmo grupo de sintomas.',
        como: 'Rodar revisão quinzenal com RH e liderança, com encaminhamento de plano individual quando houver reincidência.',
        responsavel: 'Davi (indicador e alerta), RH e líderes (rotina de condução).',
        prazo: 'Imediato.',
        kpi: '% de colaboradores reincidentes.',
      },
      {
        bloco: 'Controle',
        prioridade: 'PRIORIDADE MÁXIMA',
        tipo: 'Estrutural',
        titulo: 'Entrevista de retorno obrigatória',
        oQue: 'Realizar conversa estruturada no retorno de todo colaborador afastado.',
        como: 'Aplicar roteiro padrão para identificar causa raiz (saúde, trabalho e comportamento) e registrar ação de acompanhamento.',
        responsavel: 'Líder direto e RH.',
        prazo: 'Imediato.',
        kpi: '% de retornos com entrevista concluída e plano registrado.',
      },
      {
        bloco: 'Controle',
        prioridade: 'PRIORIDADE MÁXIMA',
        tipo: 'Estrutural',
        titulo: 'Investigação formal',
        oQue: 'Realizar investigação formal, por terceiro imparcial contratado, para avaliar a veracidade dos atestados do top 5 colaboradores dos últimos 6 meses.',
        como: 'Contratar um especialista externo no tema para conduzir a apuração técnica.',
        responsavel: 'RH.',
        prazo: 'Imediato.',
        kpi: 'N/A.',
      },
      {
        bloco: 'Gestão Ativa e Ergonomia',
        prioridade: 'ALTA',
        tipo: 'Estrutural',
        titulo: 'Intervenção no setor crítico',
        oQue: 'Mapear postos dos 5 setores mais afetados por sintomas da coluna (CID M40–M54).',
        como: 'Executar análise ergonômica e ajustar postura, carga e movimentos repetitivos nos postos críticos.',
        responsavel: 'SST.',
        prazo: '30 a 60 dias.',
        kpi: 'Redução de atestados por CID no setor.',
      },
      {
        bloco: 'Gestão Ativa e Ergonomia',
        prioridade: 'ALTA',
        tipo: 'Estrutural',
        titulo: 'Reunião executiva mensal de absenteísmo',
        oQue: 'Revisar top colaboradores, setores críticos e ações em andamento.',
        como: 'Conduzir rito mensal para decisão executiva e ajustes de prioridade no plano.',
        responsavel: 'RH (apresentar para Diretoria/Presidência).',
        prazo: 'Mensal.',
        kpi: 'Redução geral de dias perdidos.',
      },
      {
        bloco: 'Engajamento Operacional',
        prioridade: 'MÉDIA',
        tipo: 'Dinâmica/Engajamento',
        titulo: 'Desafio Zero Ausência',
        oQue: 'Transformar ergonomia em competição positiva entre setores.',
        como: 'Pontuar setores por menos atestados, zero ausência; reconhecer setor destaque do mês.',
        responsavel: 'RH, líderes e SST.',
        prazo: 'Piloto em 30 dias.',
        kpi: 'Setores com melhores taxas de absenteísmo dentro da meta estabelecida',
      },
      {
        bloco: 'Engajamento Operacional',
        prioridade: 'MÉDIA',
        tipo: 'Dinâmica/Engajamento',
        titulo: 'Raio-X do Setor',
        oQue: 'Captar percepção dos operadores sobre os principais pontos de desgaste.',
        como: 'Aplicar pergunta direta, votação simples e consolidar top 3 causas por setor para plano de ação local.',
        responsavel: 'Líderes e RH.',
        prazo: 'Ciclo mensal.',
        kpi: '% de setores com top 3 causas mapeadas e tratadas.',
      },
    ],
    [],
  )

  const planoExecutivoKanban = useMemo(() => {
    const ordemColunas: AcaoPlanoExecutivo['bloco'][] = [
      'Controle',
      'Gestão Ativa e Ergonomia',
      'Engajamento Operacional',
    ]
    const agrupado = new Map<AcaoPlanoExecutivo['bloco'], AcaoPlanoExecutivo[]>()
    for (const c of ordemColunas) agrupado.set(c, [])
    for (const acao of planoExecutivoAcoes) {
      const arr = agrupado.get(acao.bloco)
      if (arr) arr.push(acao)
    }
    for (const c of ordemColunas) {
      agrupado.get(c)?.sort((a, b) => PRIORIDADE_ORDEM[a.prioridade] - PRIORIDADE_ORDEM[b.prioridade])
    }
    return ordemColunas.map((coluna) => ({ coluna, acoes: agrupado.get(coluna) ?? [] }))
  }, [planoExecutivoAcoes])

  return (
    <div className="space-y-6">
      <section className="w-full rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
          <div className="mb-4">
            <h2 className="text-base font-bold uppercase tracking-wide text-navy">
              Evolução mensal — dias por categoria
            </h2>
            <p className="mt-1 text-sm text-brand-gray">
              Soma de QNTD: justificadas vs injustificadas.{' '}
              <span className="font-medium text-brand-ink">Clique num ponto</span> da linha para o top 5 de
              colaboradores naquele mês.
            </p>
            <div className="mt-4 flex flex-wrap gap-6 text-sm">
              <span className="inline-flex items-center gap-2 font-medium text-[#1a56db]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#1a56db]" aria-hidden />
                Justificadas
              </span>
              <span className="inline-flex items-center gap-2 font-medium text-[#ef4444]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" aria-hidden />
                Injustificadas
              </span>
            </div>
          </div>
          <div className="h-[360px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 28, right: 24, left: 8, bottom: 4 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  dy={6}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                  width={44}
                  domain={[0, 'auto']}
                />
                <Tooltip
                  cursor={{ stroke: 'rgba(148, 163, 184, 0.35)', strokeWidth: 1 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const row = payload[0].payload as LineDatum
                    const sancoesTxt = sancoesPlanilhaOk ? fmtPt(row.sancoes) : '—'
                    const sancoesAcTxt = sancoesPlanilhaOk ? fmtPt(row.sancoesAcumulado) : '—'
                    return (
                      <div
                        className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm shadow-md"
                        style={{ outline: 'none' }}
                      >
                        <div className="font-semibold text-navy">{label}</div>
                        <ul className="mt-2 space-y-1.5">
                          <li className="flex items-center gap-2 font-medium text-[#ef4444]">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-[#ef4444]" aria-hidden />
                            Injustificadas: <span className="tabular-nums">{fmtDiasQntd(row.Injustificadas)}</span>
                          </li>
                          <li className="flex items-center gap-2 font-medium text-[#1a56db]">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-[#1a56db]" aria-hidden />
                            Justificadas: <span className="tabular-nums">{fmtDiasQntd(row.Justificadas)}</span>
                          </li>
                          <li className="border-t border-black/10 pt-2 text-brand-ink">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-navy">Sanções</p>
                            <p className="mt-1 text-[12px] font-medium text-brand-ink">{label}</p>
                            <p className="mt-1 text-[13px] font-medium leading-snug text-brand-ink">
                              {`Sanções recebidas: ${sancoesTxt} para ${fmtPt(row.Injustificadas)} ausências`}
                            </p>
                            <p className="text-[13px] font-medium leading-snug text-brand-ink">
                              {`Sanções acumuladas: ${sancoesAcTxt}`}
                            </p>
                            {!sancoesPlanilhaOk ? (
                              <span className="mt-0.5 block text-[11px] font-normal text-brand-gray">
                                Planilha de sanções não carregada ou indisponível.
                              </span>
                            ) : null}
                          </li>
                        </ul>
                      </div>
                    )
                  }}
                />
                <Legend display="none" />
                <Line
                  type="monotone"
                  dataKey="Justificadas"
                  name="Justificadas"
                  stroke={LINE.just}
                  strokeWidth={2.5}
                  dot={dotJust}
                  activeDot={{ r: 9, stroke: '#fff', strokeWidth: 1 }}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="Justificadas"
                    position="top"
                    offset={10}
                    content={(props) => {
                      const p = props as { x?: number | string; y?: number | string; value?: number | string }
                      const x = Number(p.x)
                      const y = Number(p.y)
                      const value = p.value
                      if (!Number.isFinite(x) || !Number.isFinite(y) || value == null) return <></>
                      return (
                        <text
                          x={x}
                          y={y}
                          dy={-12}
                          fill={LINE.just}
                          fontSize={11}
                          fontWeight={700}
                          textAnchor="middle"
                        >
                          {fmtDiasQntd(Number(value))}
                        </text>
                      )
                    }}
                  />
                </Line>
                <Line
                  type="monotone"
                  dataKey="Injustificadas"
                  name="Injustificadas"
                  stroke={LINE.inj}
                  strokeWidth={2.5}
                  dot={dotInj}
                  activeDot={{ r: 9, stroke: '#fff', strokeWidth: 1 }}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="Injustificadas"
                    position="top"
                    offset={10}
                    content={(props) => {
                      const p = props as { x?: number | string; y?: number | string; value?: number | string }
                      const x = Number(p.x)
                      const y = Number(p.y)
                      const value = p.value
                      if (!Number.isFinite(x) || !Number.isFinite(y) || value == null) return <></>
                      return (
                        <text
                          x={x}
                          y={y}
                          dy={-12}
                          fill={LINE.inj}
                          fontSize={11}
                          fontWeight={700}
                          textAnchor="middle"
                        >
                          {fmtDiasQntd(Number(value))}
                        </text>
                      )
                    }}
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>

          {mesDetalhe ? (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setMesDetalhe(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="mes-detalhe-titulo"
                className="max-h-[90vh] w-full max-w-[min(1680px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-black/10 bg-white p-6 shadow-2xl sm:p-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-4">
                  <div>
                    <h3 id="mes-detalhe-titulo" className="text-lg font-bold text-navy">
                      Faltantes — {formatMesCurto(mesDetalhe)}
                    </h3>
                    <p className="mt-1 text-xs text-brand-gray">
                      Soma de dias (QNTD) por colaborador neste mês — mesma base do gráfico (tipos que contabilizam nos
                      indicadores). Uso interno (dados pessoais).
                      {aggMesDetalhe ? (
                        <>
                          {' '}
                          Totais do mês no gráfico:{' '}
                          <strong className="text-brand-ink">
                            {fmtDiasQntd(aggMesDetalhe.injust)} injustificadas
                          </strong>
                          , <strong className="text-brand-ink">{fmtDiasQntd(aggMesDetalhe.just)} justificadas</strong>.
                        </>
                      ) : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-xl border border-black/10 bg-page px-3 py-1.5 text-sm font-semibold text-brand-ink hover:bg-white"
                    onClick={() => setMesDetalhe(null)}
                  >
                    Fechar
                  </button>
                </div>
                <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:overflow-x-auto lg:pb-1">
                  <TabelaSancoesMes rows={sancoesDetalheMes} />
                  <TabelaTopFaltantes
                    titulo="Justificadas"
                    cor={LINE.just}
                    lista={topJust}
                    onRowClick={(row) =>
                      setDetalheJustificada({ matricula: row.matricula, nome: row.nome, anoMes: mesDetalhe })
                    }
                  />
                  <TabelaTopFaltantes
                    titulo="Injustificadas"
                    cor={LINE.inj}
                    lista={topInj}
                    onRowClick={(row) =>
                      setDetalheSancoesColaborador({ matricula: row.matricula, nome: row.nome })
                    }
                  />
                </div>
              </div>
            </div>
          ) : null}

          {detalheSetor ? (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setDetalheSetor(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="setor-detalhe-titulo"
                className="max-h-[90vh] w-full max-w-[min(1680px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-black/10 bg-white p-6 shadow-2xl sm:p-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-4">
                  <div>
                    <h3 id="setor-detalhe-titulo" className="text-lg font-bold text-navy">
                      Top 5 faltantes — Setor: {detalheSetor.setor}
                    </h3>
                    <p className="mt-1 text-xs text-brand-gray">
                      Soma de dias (QNTD) por colaborador neste setor, nos{' '}
                      <strong className="text-brand-ink">últimos 6 meses</strong> (face à data mais recente com ausência
                      justificada no filtro). Líder de referência no ranking:{' '}
                      <span className="font-medium text-brand-ink">{detalheSetor.nomeLider}</span>. Uso interno (dados
                      pessoais).
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-xl border border-black/10 bg-page px-3 py-1.5 text-sm font-semibold text-brand-ink hover:bg-white"
                    onClick={() => setDetalheSetor(null)}
                  >
                    Fechar
                  </button>
                </div>
                {!janela6Just ? (
                  <p className="mt-4 rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-xs leading-snug text-amber-950">
                    Não há ausências <strong>justificadas com data</strong> no filtro — não é possível ancorar os
                    últimos 6 meses; os rankings abaixo permanecem vazios.
                  </p>
                ) : null}
                <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start">
                  <TabelaTopFaltantes
                    titulo="Justificadas"
                    cor={LINE.just}
                    lista={topJustSetor}
                    textoSemDados="Sem registros justificados neste setor nos últimos 6 meses."
                  />
                  <TabelaTopFaltantes
                    titulo="Injustificadas"
                    cor={LINE.inj}
                    lista={topInjSetor}
                    textoSemDados="Sem registros injustificados neste setor nos últimos 6 meses."
                  />
                </div>
              </div>
            </div>
          ) : null}
          {detalheJustificada ? (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4" onClick={() => setDetalheJustificada(null)}>
              <div
                role="dialog"
                aria-modal="true"
                className="max-h-[90vh] w-full max-w-[min(1480px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-black/10 bg-white p-6 shadow-2xl sm:p-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-navy">
                      Ausências justificadas — {detalheJustificada.nome}
                    </h3>
                    <p className="mt-1 text-xs text-brand-gray">Detalhes do mês {formatMesCurto(detalheJustificada.anoMes)}.</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-xl border border-black/10 bg-page px-3 py-1.5 text-sm font-semibold text-brand-ink hover:bg-white"
                    onClick={() => setDetalheJustificada(null)}
                  >
                    Fechar
                  </button>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[1240px] table-auto text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/10 text-[11px] uppercase tracking-wide text-brand-gray">
                        <th className="pb-2 pr-2 font-semibold">Data</th>
                        <th className="pb-2 pr-2 font-semibold">Quantidade</th>
                        <th className="pb-2 pr-2 font-semibold">Tipo</th>
                        <th className="pb-2 pr-2 font-semibold">CID</th>
                        <th className="pb-2 pr-2 font-semibold">Endereço</th>
                        <th className="pb-2 pr-2 font-semibold">Local de atendimento</th>
                        <th className="pb-2 font-semibold">Médico</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhasDetalheJustificada.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-3 text-xs text-brand-gray">
                            Sem registros de ausência justificadas para este colaborador no mês selecionado.
                          </td>
                        </tr>
                      ) : (
                        linhasDetalheJustificada.map((l, i) => (
                          <tr key={`${l.data}-${l.tipo}-${i}`} className="border-b border-black/5 last:border-0">
                            <td className="whitespace-nowrap py-2 pr-2 align-top text-brand-ink">{l.data}</td>
                            <td className="whitespace-nowrap py-2 pr-2 align-top tabular-nums text-brand-ink">{l.quantidade}</td>
                            <td className="break-words py-2 pr-2 align-top text-brand-ink">{l.tipo}</td>
                            <td className="break-words py-2 pr-2 align-top text-brand-ink">{l.cid}</td>
                            <td className="break-words py-2 pr-2 align-top text-brand-ink">{l.endereco || '-'}</td>
                            <td className="break-words py-2 pr-2 align-top text-brand-ink">{l.localAtendimento || '-'}</td>
                            <td className="break-words py-2 align-top text-brand-ink">{l.medicoResponsavel || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
          {detalheSancoesColaborador ? (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4" onClick={() => setDetalheSancoesColaborador(null)}>
              <div
                role="dialog"
                aria-modal="true"
                className="max-h-[90vh] w-full max-w-[min(1680px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-black/10 bg-white p-6 shadow-2xl sm:p-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-navy">
                      Histórico completo de sanções — {detalheSancoesColaborador.nome}
                    </h3>
                    <p className="mt-1 text-xs text-brand-gray">Todas as sanções disciplinares do colaborador (sem filtro de período).</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-xl border border-black/10 bg-page px-3 py-1.5 text-sm font-semibold text-brand-ink hover:bg-white"
                    onClick={() => setDetalheSancoesColaborador(null)}
                  >
                    Fechar
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-black/10 bg-page/60 px-3 py-2 text-xs text-brand-gray">
                  <span>Registros no histórico</span>
                  <span className="font-semibold tabular-nums text-navy">{fmtPt(linhasSancoesColaborador.length)}</span>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <div className="max-h-[58vh] overflow-y-auto rounded-xl border border-black/10 bg-page/40 pr-1">
                    <table className="w-full min-w-[1120px] table-fixed text-left text-sm">
                      <colgroup>
                        <col className="w-[10%]" />
                        <col className="w-[24%]" />
                        <col className="w-[18%]" />
                        <col className="w-[12%]" />
                        <col className="w-[36%]" />
                      </colgroup>
                      <thead className="sticky top-0 z-10 bg-white">
                        <tr className="border-b border-black/10 text-[11px] uppercase tracking-wide text-brand-gray">
                          <th className="px-3 py-2 font-semibold">Matrícula</th>
                          <th className="px-3 py-2 font-semibold">Nome</th>
                          <th className="px-3 py-2 font-semibold">Tipo</th>
                          <th className="px-3 py-2 font-semibold">Data aplicação</th>
                          <th className="px-3 py-2 font-semibold">Observações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhasSancoesColaborador.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-xs text-brand-gray">
                              Nenhuma sanção encontrada para este colaborador.
                            </td>
                          </tr>
                        ) : (
                          linhasSancoesColaborador.map((item, idx) => (
                            <tr
                              key={`${item.matricula}-${item.dataAplicacao}-${idx}`}
                              className="border-b border-black/5 text-brand-ink odd:bg-white even:bg-page/35 hover:bg-navy/[0.03] last:border-0"
                            >
                              <td className="px-3 py-2 align-top tabular-nums">{item.matricula}</td>
                              <td className="px-3 py-2 align-top leading-snug">{item.nome}</td>
                              <td className="px-3 py-2 align-top leading-snug">{item.tipo}</td>
                              <td className="px-3 py-2 align-top tabular-nums">{item.dataAplicacao}</td>
                              <td className="px-3 py-2 align-top leading-snug">{item.obs || '(Sem observações)'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {detalheMedicosPorLocal ? (
            <div
              className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4"
              onClick={() => {
                setDetalheMedicosPorLocal(null)
                setLocalTopSelecionado(null)
                setDetalheAusenciasMedicoLocal(null)
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                className="max-h-[90vh] w-full max-w-[min(980px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-black/10 bg-white p-6 shadow-2xl sm:p-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-navy">
                      Médicos por local — {detalheMedicosPorLocal}
                    </h3>
                    <p className="mt-1 text-xs text-brand-gray">
                      Soma de dias perdidos (QNTD) por médico para o local selecionado (mesmo critério do gráfico de
                      locais).
                    </p>
                    {resumoMedicosNoLocalSelecionado.totalDias > 0 ? (
                      <p className="mt-1 text-xs text-brand-ink">
                        <span className="font-semibold text-navy">Total do local:</span>{' '}
                        <span className="tabular-nums">{fmtPt(resumoMedicosNoLocalSelecionado.totalDias)}</span> dias
                        {' '}·{' '}
                        <span className="tabular-nums">{fmtPt(resumoMedicosNoLocalSelecionado.totalAusencias)}</span> ausências
                        {' '}·{' '}
                        <span className="tabular-nums">{fmtPt(resumoMedicosNoLocalSelecionado.totalMedicos)}</span> médicos
                        {resumoMedicosNoLocalSelecionado.diasSemMedico > 0 ? (
                          <>
                            {' '}·{' '}
                            <span className="tabular-nums">{fmtPt(resumoMedicosNoLocalSelecionado.diasSemMedico)}</span> dias
                            sem médico informado
                          </>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#041E42]/20 bg-[#041E42] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1E22AA]"
                      onClick={() => {
                        if (!detalheMedicosPorLocal) return
                        setPedidoExportRelatorio('medicos-local')
                      }}
                      title="Baixar planilha com um bloco por médico: totais e lista de ausências (somente colaboradores ativos)"
                    >
                      <Download className="h-4 w-4" aria-hidden />
                      Exportar planilha
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-black/10 bg-page px-3 py-1.5 text-sm font-semibold text-brand-ink hover:bg-white"
                      onClick={() => {
                        setDetalheMedicosPorLocal(null)
                        setLocalTopSelecionado(null)
                        setDetalheAusenciasMedicoLocal(null)
                      }}
                    >
                      Fechar
                    </button>
                  </div>
                </div>
                <div className="mt-4 max-h-[58vh] overflow-y-auto pr-1">
                  <table className="w-full min-w-[760px] table-auto text-left text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-black/10 text-[11px] uppercase tracking-wide text-brand-gray">
                        <th className="pb-2 pr-2 font-semibold">Pos.</th>
                        <th className="pb-2 pr-2 font-semibold">Médico</th>
                        <th className="pb-2 pr-2 text-right font-semibold">Dias</th>
                        <th className="pb-2 pr-2 text-right font-semibold">QTD AUS.</th>
                        <th className="pb-2 text-right font-semibold">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankingMedicosNoLocalSelecionado.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-3 text-xs text-brand-gray">
                            Sem médicos com dias perdidos para o local selecionado no filtro atual.
                          </td>
                        </tr>
                      ) : (
                        rankingMedicosNoLocalSelecionado.map((row, idx) => {
                          const pct =
                            resumoMedicosNoLocalSelecionado.totalDias > 0
                              ? (row.dias / resumoMedicosNoLocalSelecionado.totalDias) * 100
                              : 0
                          return (
                            <tr
                              key={`${row.name}-${idx}`}
                              className="cursor-pointer border-b border-black/5 text-brand-ink transition hover:bg-black/[0.03] last:border-0"
                              onClick={() =>
                                setDetalheAusenciasMedicoLocal({
                                  local: detalheMedicosPorLocal,
                                  medico: row.name,
                                })
                              }
                              title={`Ver ausências vinculadas ao médico ${row.name}`}
                            >
                              <td className="py-2 pr-2 tabular-nums">{idx + 1}º</td>
                              <td className={`py-2 pr-2 ${row.semMedicoInformado ? 'italic text-brand-gray' : ''}`}>
                                {row.name}
                              </td>
                              <td className="py-2 pr-2 text-right tabular-nums">{fmtPt(row.dias)}</td>
                              <td className="py-2 pr-2 text-right tabular-nums">{fmtPt(row.qtdAusencias)}</td>
                              <td className="py-2 text-right tabular-nums">{pctFmt(pct)}%</td>
                            </tr>
                          )
                        })
                      )}
                      {rankingMedicosNoLocalSelecionado.length > 0 ? (
                        <tr className="border-t border-black/10 bg-page/60 font-semibold text-brand-ink">
                          <td className="py-2 pr-2" colSpan={2}>
                            Total
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums">{fmtPt(resumoMedicosNoLocalSelecionado.totalDias)}</td>
                          <td className="py-2 pr-2 text-right tabular-nums">{fmtPt(resumoMedicosNoLocalSelecionado.totalAusencias)}</td>
                          <td className="py-2 text-right tabular-nums">100%</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
          {detalheAusenciasMedicoLocal ? (
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
              onClick={() => {
                setDetalheAusenciasMedicoLocal(null)
                setSortAusenciasMedicoLocal([{ key: 'data', direction: 'desc' }])
                setFiltrosAusenciasMedicoLocal({})
                setColunaFiltroAberta(null)
                setBuscaFiltroColuna('')
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                className="h-[90vh] w-full max-w-[min(1380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-black/10 bg-white p-6 shadow-2xl sm:p-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-navy">
                      Ausências do médico — {detalheAusenciasMedicoLocal.medico}
                    </h3>
                    <p className="mt-1 text-xs text-brand-gray">
                      Registros da aba de faltas e atestados para o local {detalheAusenciasMedicoLocal.local}.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-xl border border-black/10 bg-page px-3 py-1.5 text-sm font-semibold text-brand-ink hover:bg-white"
                    onClick={() => {
                      setDetalheAusenciasMedicoLocal(null)
                      setSortAusenciasMedicoLocal([{ key: 'data', direction: 'desc' }])
                      setFiltrosAusenciasMedicoLocal({})
                      setColunaFiltroAberta(null)
                      setBuscaFiltroColuna('')
                    }}
                  >
                    Fechar
                  </button>
                </div>
                <div className="mt-4 h-[calc(90vh-170px)] overflow-x-auto overflow-y-auto overscroll-contain">
                  <TabelaAusenciasIndicadoresComFiltros
                    linhasOrdenadas={linhasAusenciasMedicoLocalOrdenadas}
                    sortAusenciasMedicoLocal={sortAusenciasMedicoLocal}
                    alternarOrdenacaoAusenciasMedicoLocal={alternarOrdenacaoAusenciasMedicoLocal}
                    filtrosAusenciasMedicoLocal={filtrosAusenciasMedicoLocal}
                    opcoesFiltrosAusenciasMedicoLocal={opcoesFiltrosAusenciasMedicoLocal}
                    colunaFiltroAberta={colunaFiltroAberta}
                    setColunaFiltroAberta={setColunaFiltroAberta}
                    buscaFiltroColuna={buscaFiltroColuna}
                    setBuscaFiltroColuna={setBuscaFiltroColuna}
                    alternarValorFiltroAusenciasMedicoLocal={alternarValorFiltroAusenciasMedicoLocal}
                    selecionarTodosFiltroAusenciasMedicoLocal={selecionarTodosFiltroAusenciasMedicoLocal}
                    desmarcarTodosFiltroAusenciasMedicoLocal={desmarcarTodosFiltroAusenciasMedicoLocal}
                    mensagemVazia="Sem ausências para este médico/local no recorte atual."
                  />
                </div>
              </div>
            </div>
          ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
          <h2 className="text-base font-bold uppercase tracking-wide text-navy">
            Distribuição dos dias perdidos por tipo
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-brand-gray">
            Soma de QNTD no período: atestados, faltas injustificadas e demais tipos justificados.
          </p>
          <DistribuicaoDiasDonut d={distribuicaoDiasTipo} />
        </section>

        <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
          <h2 className="text-lg font-bold text-navy">Quais os principais CIDs?</h2>
          <p className="mt-1 text-sm leading-relaxed text-brand-gray">
            Top 15 grupos CID-10 por dias perdidos.{' '}
            <span className="font-medium text-brand-ink">Clique num grupo</span> para ver cada CID e os dias
            respectivos.
          </p>
          <div className="mt-4">
            <RankingGruposCidLista lista={topGruposCid} rows={rows} />
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
          <h2 className="text-base font-bold uppercase tracking-wide text-navy">
            Top 3 locais de atendimento
          </h2>
          <p className="mt-1 text-sm text-brand-gray">
            Participação dos 3 locais com maior soma de QNTD no período (desconsiderando não informados).
          </p>
          <DonutTop3
            items={topLocaisAtendimento.map((local, i) => ({
              key: `local-${local.name}`,
              name: local.name,
              value: local.value,
              fill: i === 0 ? LINE.just : i === 1 ? LINE.inj : '#94a3b8',
            }))}
            ranking={rankingLocaisAtendimento}
            selectedKey={topLocaisKeys.includes(localTopSelecionadoKey ?? '') ? localTopSelecionadoKey : null}
            onSliceClick={(item) => {
              if (localTopSelecionado === item.name) {
                setLocalTopSelecionado(null)
                setDetalheMedicosPorLocal(null)
                return
              }
              setLocalTopSelecionado(item.name)
              setDetalheMedicosPorLocal(item.name)
            }}
            onContinuacaoRowClick={(row) => {
              if (localTopSelecionado === row.name) {
                setLocalTopSelecionado(null)
                setDetalheMedicosPorLocal(null)
                return
              }
              setLocalTopSelecionado(row.name)
              setDetalheMedicosPorLocal(row.name)
            }}
          />
        </section>

        <section className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
          <h2 className="text-base font-bold uppercase tracking-wide text-navy">
            Top 3 médicos
          </h2>
          <p className="mt-1 text-sm text-brand-gray">
            Participação dos 3 médicos com maior soma de QNTD no período (desconsiderando não informados).
          </p>
          <DonutTop3
            items={topMedicos.map((medico, i) => ({
              key: `medico-${i}-${medico.name}`,
              name: medico.name,
              value: medico.value,
              fill: i === 0 ? LINE.just : i === 1 ? LINE.inj : '#94a3b8',
            }))}
            ranking={rankingMedicos}
            selectedKey={topMedicosKeys.includes(medicoTopSelecionadoKeyValue ?? '') ? medicoTopSelecionadoKeyValue : null}
            onSliceClick={(item) => {
              if (medicoTopSelecionado === item.name) {
                setMedicoTopSelecionado(null)
              } else {
                setMedicoTopSelecionado(item.name)
              }
              setDetalheColaboradoresMedicoTop(item.name)
            }}
            onContinuacaoRowClick={(row) => {
              if (medicoTopSelecionado === row.name) {
                setMedicoTopSelecionado(null)
              } else {
                setMedicoTopSelecionado(row.name)
              }
              setDetalheColaboradoresMedicoTop(row.name)
            }}
          />
        </section>
      </div>
      {detalheColaboradoresMedicoTop ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setDetalheColaboradoresMedicoTop(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-[min(980px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-black/10 bg-white p-6 shadow-2xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-4">
              <div>
                <h3 className="text-lg font-bold text-navy">
                  Colaboradores atendidos por — {detalheColaboradoresMedicoTop}
                </h3>
                <p className="mt-1 text-xs text-brand-gray">
                  Soma de dias perdidos (QNTD) e quantidade de ausências por colaborador no filtro atual (mesma regra dos detalhes por local).
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-xl border border-black/10 bg-page px-3 py-1.5 text-sm font-semibold text-brand-ink hover:bg-white"
                onClick={() => setDetalheColaboradoresMedicoTop(null)}
              >
                Fechar
              </button>
            </div>
            <div className="mt-4 max-h-[58vh] overflow-y-auto pr-1">
              <table className="w-full min-w-[680px] table-auto text-left text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-black/10 text-[11px] uppercase tracking-wide text-brand-gray">
                    <th className="pb-2 pr-2 font-semibold">Pos.</th>
                    <th className="pb-2 pr-2 font-semibold">Colaborador</th>
                    <th className="pb-2 pr-2 text-right font-semibold">Dias</th>
                    <th className="pb-2 pr-2 text-right font-semibold">QNTD AUS</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detalheColaboradoresPorMedicoTop.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-xs text-brand-gray">
                        Sem colaboradores para este médico no recorte atual.
                      </td>
                    </tr>
                  ) : (
                    detalheColaboradoresPorMedicoTop.map((row, idx) => (
                      <tr
                        key={`${row.nome}-${idx}`}
                        role="button"
                        tabIndex={0}
                        className={`cursor-pointer border-b border-black/5 text-brand-ink last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-brand-blue/5`}
                        title="Ver registros de ausência deste colaborador com este médico"
                        onClick={() => {
                          if (!detalheColaboradoresMedicoTop) return
                          setDetalheAusenciasColaboradorNoMedicoTop({
                            medico: detalheColaboradoresMedicoTop,
                            matricula: row.matricula,
                            nome: row.nome,
                          })
                          setSortAusenciasColabMedicoTop([{ key: 'data', direction: 'desc' }])
                          setFiltrosAusenciasColabMedicoTop({})
                          setColunaFiltroAbertaColabMedicoTop(null)
                          setBuscaFiltroColunaColabMedicoTop('')
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            e.currentTarget.click()
                          }
                        }}
                      >
                        <td className="py-2 pr-2 tabular-nums">{idx + 1}º</td>
                        <td className="py-2 pr-2">{row.nome}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{fmtPt(row.dias)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{fmtPt(row.qtdAusencias)}</td>
                        <td className="py-2">
                          <span
                            className={
                              row.status === 'Ativo'
                                ? 'inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900'
                                : 'inline-block rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900'
                            }
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
      {detalheAusenciasColaboradorNoMedicoTop ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-4"
          onClick={fecharAusenciasColaboradorNoMedicoTop}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="h-[90vh] w-full max-w-[min(1380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-black/10 bg-white p-6 shadow-2xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-4">
              <div>
                <h3 className="text-lg font-bold text-navy">
                  Ausências do colaborador — {detalheAusenciasColaboradorNoMedicoTop.nome}
                </h3>
                <p className="mt-1 text-xs text-brand-gray">
                  Registros da aba de faltas e atestados para o médico{' '}
                  <span className="font-semibold text-brand-ink">{detalheAusenciasColaboradorNoMedicoTop.medico}</span>, no mesmo
                  recorte de filtros do painel (todos os locais).
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-xl border border-black/10 bg-page px-3 py-1.5 text-sm font-semibold text-brand-ink hover:bg-white"
                onClick={fecharAusenciasColaboradorNoMedicoTop}
              >
                Fechar
              </button>
            </div>
            <div className="mt-4 h-[calc(90vh-170px)] overflow-x-auto overflow-y-auto overscroll-contain">
              <TabelaAusenciasIndicadoresComFiltros
                linhasOrdenadas={linhasAusenciasColabMedicoTopOrdenadas}
                sortAusenciasMedicoLocal={sortAusenciasColabMedicoTop}
                alternarOrdenacaoAusenciasMedicoLocal={alternarOrdenacaoAusenciasColabMedicoTop}
                filtrosAusenciasMedicoLocal={filtrosAusenciasColabMedicoTop}
                opcoesFiltrosAusenciasMedicoLocal={opcoesFiltrosAusenciasColabMedicoTop}
                colunaFiltroAberta={colunaFiltroAbertaColabMedicoTop}
                setColunaFiltroAberta={setColunaFiltroAbertaColabMedicoTop}
                buscaFiltroColuna={buscaFiltroColunaColabMedicoTop}
                setBuscaFiltroColuna={setBuscaFiltroColunaColabMedicoTop}
                alternarValorFiltroAusenciasMedicoLocal={alternarValorFiltroAusenciasColabMedicoTop}
                selecionarTodosFiltroAusenciasMedicoLocal={selecionarTodosFiltroAusenciasColabMedicoTop}
                desmarcarTodosFiltroAusenciasMedicoLocal={desmarcarTodosFiltroAusenciasColabMedicoTop}
                mensagemVazia="Sem ausências para este colaborador e médico no recorte atual."
              />
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-black/6 bg-white p-6 shadow-soft">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-gray">Painel executivo</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-navy">Insights Retirados do Painel</h2>
        <p className="mt-1 max-w-4xl text-sm leading-relaxed text-brand-gray">
        </p>

        {/* 1 — Contexto executivo (full width) */}
        <div className="mt-6 rounded-xl border border-navy/10 bg-gradient-to-br from-[#f8fafc] via-white to-page p-5 shadow-sm">
          <div className="flex flex-wrap items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy/10 text-navy">
              <BarChart3 className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-navy">Resumo do Painel</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="flex gap-2.5 rounded-lg border border-emerald-200/70 bg-emerald-50/50 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  <p className="text-sm leading-snug text-brand-ink">
                    {fluxoExecutivo.varInjPct < -3 ? (
                      <>
                        <span className="font-semibold text-navy">Após inicio de aplicação de sanções disciplinares, ausências Injustificadas entraram em queda</span>
                        , o que evidencia que tal medida está surtindo efeito. Porém, com essa queda, ainda é possivel notar que o cenário de ausencias justificadas continuou predominante e em progressão.
                      </>
                    ) : fluxoExecutivo.varInjPct > 5 ? (
                      <>
                        <span className="font-semibold text-amber-900">Injustificadas a subir</span> na 2.ª metade (
                        {fluxoExecutivo.varInjPct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%) — priorizar
                        líderes e setores em destaque.
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-navy">Injustificadas estáveis</span> entre metades do
                        período — manter sanções, dosimetria e comunicação para consolidar o controlo.
                      </>
                    )}
                  </p>
                </div>
                <div
                  className={`flex gap-2.5 rounded-lg border p-3 ${
                    fluxoExecutivo.varJustPct > 5 || fluxoExecutivo.pctJustificadas > 72
                      ? 'border-amber-300/80 bg-amber-50/70'
                      : 'border-slate-200/80 bg-white'
                  }`}
                >
                  <AlertTriangle
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      fluxoExecutivo.varJustPct > 5 || fluxoExecutivo.pctJustificadas > 72
                        ? 'text-amber-600'
                        : 'text-slate-400'
                    }`}
                    aria-hidden
                  />
                  <p className="text-sm leading-snug text-brand-ink">
                    <span className="font-semibold text-navy">Ausências justificadas</span> somam{' '}
                    <span className="font-bold text-navy">
                      {fluxoExecutivo.pctJustificadas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                    </span>{' '}
                    dos dias (atestados + demais com cobertura formal).
                    {insightJustificadas6Meses && insightJustificadas6Meses.total > 0 ? (
                      <>
                        {' '}
                        Nos <strong>últimos seis meses</strong>, as ausências justificadas acumulam{' '}
                        <strong>{insightJustificadas6Meses.total.toLocaleString('pt-BR')}</strong> dias perdidos e
                        {insightJustificadas6Meses.diasRankeaveis > 0 && insightJustificadas6Meses.topGrupoTitulo ? (
                          <>
                            {' '}
                            o <strong>grupo de sintomas</strong> com maior peso é{' '}
                            <span
                              className="font-semibold text-navy"
                              title={insightJustificadas6Meses.topGrupoTitulo}
                            >
                              {tituloGrupoResumo(insightJustificadas6Meses.topGrupoTitulo)}
                            </span>{' '}
                            ({insightJustificadas6Meses.topGrupoDias.toLocaleString('pt-BR')} dias, ≈{' '}
                            {insightJustificadas6Meses.topGrupoPctSub.toLocaleString('pt-BR', {
                              maximumFractionDigits: 1,
                            })}
                            % desse subconjunto), o que reforça a necessidade de{' '}
                            <strong>medidas voltadas para</strong>— ergonomia, pausas, saúde ocupacional e envolvimento
                            dos líderes de setor.
                          </>
                        ) : (
                          <>
                            {' '}
                            <span className="text-brand-gray">
                              Não há dados de CID suficientes neste recorte para apontar um grupo de sintomas.
                            </span>
                          </>
                        )}
                      </>
                    ) : insightJustificadas6Meses && insightJustificadas6Meses.total === 0 ? (
                      <>
                        {' '}
                        Nos últimos seis meses face à data mais recente do filtro não há dias justificados contabilizados
                        — alargue o intervalo ou confirme o carregamento da planilha.
                      </>
                    ) : (
                      <>
                        {' '}
                        Sem datas válidas para calcular o recorte dos últimos seis meses — verifique a coluna de data
                        nos registos.
                      </>
                    )}
                  </p>
                </div>
                <div className="flex gap-2.5 rounded-lg border border-slate-200/80 bg-white p-3">
                  <Brain className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" aria-hidden />
                  <p className="text-sm leading-snug text-brand-ink">
                    <span className="font-semibold text-navy">Próximo foco:</span> manter o que já funcionou em{' '}
                    <strong>injustificadas</strong> e dar <strong>ênfase</strong> a ações voltadas para as{' '}
                    <strong>ausências justificadas</strong>. Perfil no período:{' '}
                    {fluxoExecutivo.pctJustificadas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% justificadas
                    · {fluxoExecutivo.pctInjustTipo.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% faltas
                    injustificadas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2–4 — Três colunas */}
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="min-w-0 rounded-xl border border-black/6 bg-page/60 p-5">
            <div className="flex items-center gap-2 text-navy">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              <h3 className="text-sm font-bold uppercase tracking-wide">Ações já implementadas</h3>
            </div>
            <ul className="mt-4 list-none space-y-2.5 text-sm leading-relaxed text-brand-ink">
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-amber" aria-hidden />
                <span className="min-w-0 flex-1 break-words">
                  Manual de dosimetria com trilhas de sanção até desligamento por justa causa.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-amber" aria-hidden />
                <span className="min-w-0 flex-1 break-words">
                  Criação de dashboards / painéis / relatórios voltados para acompanhamento de ausências e suporte à
                  tomada de medidas.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-amber" aria-hidden />
                <span className="min-w-0 flex-1 break-words">
                  Acompanhamento de faltas injustificadas semanalmente (com aplicação de sanção sempre que pertinente).
                </span>
              </li>
            </ul>
          </div>

          <div className="min-w-0 rounded-xl border border-red-200/70 bg-gradient-to-b from-red-50/50 to-white p-5 ring-1 ring-red-100/80">
            <div className="flex items-center gap-2 text-red-900">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide">Problema atual identificado</h3>
                <p className="mt-1 text-xs font-medium leading-snug text-red-950/90">
                  Injustificadas mitigadas pelo quadro de sanções; o desafio passa a ser o volume de{' '}
                  <strong>ausências justificadas</strong> (atestados, ergonomia, CIDs, retorno ao trabalho).
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-800/80">
                  Ausências justificadas (painel)
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums leading-none text-red-700">
                  {fluxoExecutivo.pctJustificadas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                </p>
                <p className="mt-1 text-xs text-red-900/80">dos dias no filtro — eixo prioritário de ação</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-800/80">Atestados</p>
                <p className="mt-1 text-2xl font-bold tabular-nums leading-none text-navy">
                  {fluxoExecutivo.pctAtest.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                </p>
                <p className="mt-1 text-xs text-brand-gray">
                  {distribuicaoDiasTipo.atestados.toLocaleString('pt-BR')} dias · total filtrado{' '}
                  {fluxoExecutivo.totalTipo.toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-800/80">
                  Declarações e outros tipos justificados
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums leading-none text-navy">
                  {fluxoExecutivo.pctOutros.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                </p>
                <p className="mt-1 text-xs text-brand-gray">
                  {distribuicaoDiasTipo.declaracoesOutrosJustificados.toLocaleString('pt-BR')} dias · total filtrado{' '}
                  {fluxoExecutivo.totalTipo.toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-800/80">
                  Concentração (justificadas)
                </p>
                {cenarioFaltasPainel.topSetoresJust[0] ? (
                  <>
                    <p className="mt-1 text-lg font-bold text-navy">{cenarioFaltasPainel.topSetoresJust[0][0]}</p>
                    <p className="text-xs text-brand-gray">
                      ≈{' '}
                      <span className="font-semibold text-red-800">
                        {fluxoExecutivo.concJustTop1Setor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
                      </span>{' '}
                      dos dias justificados só neste setor
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-brand-gray">Sem dias justificados no filtro.</p>
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-brand-blue/15 bg-[#f5f6fc] p-5">
            <div className="flex items-center gap-2 text-navy">
              <Brain className="h-4 w-4 shrink-0 text-brand-blue" aria-hidden />
              <h3 className="text-sm font-bold uppercase tracking-wide">Interpretação dos dados</h3>
            </div>
            <ul className="mt-4 list-none space-y-3 text-sm leading-relaxed text-brand-ink">
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" aria-hidden />
                <span className="min-w-0 flex-1 break-words">
                  Percebe-se <strong>controle</strong> da empresa sobre as <strong>ausências injustificadas</strong> a
                  partir do momento em que se instalam rotinas para aplicação de penalidades por tais tipos de ausência
                  (mediante análise do histórico do colaborador).
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" aria-hidden />
                <span className="min-w-0 flex-1 break-words">
                  Como <strong>não houve</strong> ações por parte da empresa voltadas para as{' '}
                  <strong>ausências justificadas</strong>, o quadro de tal categoria de ausências manteve-se{' '}
                  <strong>contínuo</strong>, representando um problema a ser analisado e solucionado.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" aria-hidden />
                <span className="min-w-0 flex-1 break-words">
                  {fluxoExecutivo.topCidGrupo ? (
                    <>
                      <strong>Principal agrupamento de sintomas:</strong>{' '}
                      <span className="font-medium text-navy" title={fluxoExecutivo.topCidGrupo}>
                        {tituloGrupoResumo(fluxoExecutivo.topCidGrupo)}
                      </span>
                      . Vemos um padrão a partir deste sintoma.
                    </>
                  ) : (
                    <>
                      Sem um <strong>agrupamento de sintomas</strong> destacado no filtro atual, convém ampliar o
                      período ou melhorar o registo de CID para identificar padrões e orientar <strong>pausas</strong> e{' '}
                      <strong>alongamentos</strong>, reduzindo desgaste por <strong>ergonomia física</strong>.
                    </>
                  )}
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* 5 — Plano executivo de ação */}
        <div className="mt-5 rounded-2xl border border-navy/12 bg-gradient-to-b from-slate-50/90 via-white to-white p-5 shadow-md ring-1 ring-black/[0.04] md:p-6">
          <div className="flex flex-wrap items-start gap-3 border-b border-navy/10 pb-4 text-navy">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-amber/25 to-brand-amber/10 shadow-inner ring-1 ring-brand-amber/20">
              <Rocket className="h-5 w-5 text-amber-800" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold uppercase tracking-wide text-navy">Plano de Redução de Absenteísmo</h3>
              <p className="mt-0.5 text-xs leading-snug text-brand-gray">
                Priorização executiva de ações estruturais e de engajamento para decisão da diretoria.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-brand-blue/15 bg-[#f8f9fe] p-3 text-xs text-brand-ink">
            <span className="font-bold text-navy">Hierarquia de prioridade:</span>{' '}
            <span className="rounded-md bg-red-100 px-2 py-0.5 font-semibold text-red-800">PRIORIDADE MÁXIMA</span>{' '}
            <span className="rounded-md bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">ALTA</span>{' '}
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">MÉDIA</span>
          </div>

          <div className="mt-5 rounded-xl border border-navy/12 bg-white p-4 shadow-sm ring-1 ring-navy/[0.05]">
            <h4 className="text-xs font-bold uppercase tracking-wide text-navy">Painel Kanban executivo de ações</h4>
            <p className="mt-1 text-xs text-brand-gray">
              Estrutural e engajamento operacional no mesmo quadro, com leitura rápida por bloco estratégico.
            </p>
            <div className="mt-3 overflow-x-auto pb-1">
              <div className="grid min-w-[840px] grid-cols-3 gap-3">
                {planoExecutivoKanban.map(({ coluna, acoes }) => (
                  <div key={coluna} className="rounded-lg border border-black/10 bg-[#f8f9fc] p-2.5">
                    <div className="mb-2 rounded-md border border-black/10 bg-white px-2 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-gray">
                        {coluna === 'Engajamento Operacional' ? 'Dinâmicas' : 'Estrutural'}
                      </p>
                      <p className="text-xs font-bold uppercase tracking-wide text-navy">{coluna}</p>
                    </div>

                    <div className="space-y-2.5">
                      {acoes.map((acao, i) => (
                        <article key={`${coluna}-${acao.titulo}-${i}`} className="rounded-md border border-black/10 bg-white p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <h5 className="min-w-0 flex-1 text-[12px] font-bold leading-snug text-brand-ink">{acao.titulo}</h5>
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                acao.prioridade === 'PRIORIDADE MÁXIMA'
                                  ? 'bg-red-100 text-red-800'
                                  : acao.prioridade === 'ALTA'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {acao.prioridade}
                            </span>
                          </div>

                          <p className="mt-1 text-[11px] leading-snug text-brand-gray">
                            <span className="font-semibold text-navy">O que:</span> {acao.oQue}
                          </p>
                          <p className="mt-1 text-[11px] leading-snug text-brand-gray">
                            <span className="font-semibold text-navy">Como:</span> {acao.como}
                          </p>

                          <div className="mt-2 grid grid-cols-1 gap-1 text-[10px] leading-snug text-brand-gray">
                            <p>
                              <span className="font-semibold text-navy">Responsável:</span> {acao.responsavel}
                            </p>
                            <p>
                              <span className="font-semibold text-navy">Prazo:</span> {acao.prazo}
                            </p>
                            <p>
                              <span className="font-semibold text-navy">KPI:</span> {acao.kpi}
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
            <div className="min-w-0 rounded-lg border border-navy/10 bg-[#f7f8fb] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-gray">
                    Top 10 colaboradores ativos com mais atestados (últimos 6 meses)
                  </p>
                  <p className="mt-1 text-xs text-brand-gray">
                    Colaboradores ativos com maior volume de dias perdidos por ausência justificada. Desligados não
                    entram no ranking.
                  </p>
                </div>
                {gestaoAtencaoColaboradores6m.length > 0 ? (
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#041E42]/20 bg-[#041E42] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1E22AA]"
                    onClick={() => setPedidoExportRelatorio('top-colaboradores')}
                    title="Baixar planilha formatada (Só Aço) com resumo e detalhe por colaborador"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Exportar planilha
                  </button>
                ) : null}
              </div>
              {gestaoAtencaoColaboradores6m.length > 0 ? (
                <div
                  className={`mt-3 ${RECOM_ACAO_LISTA_H} shrink-0 overflow-hidden rounded-md border border-navy/10 bg-white`}
                >
                  <div className="h-full min-h-0 overflow-y-auto overflow-x-auto overscroll-y-contain">
                    <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-xs">
                      <colgroup>
                        <col className="w-[34%]" />
                        <col className="w-[20%]" />
                        <col className="w-[14%]" />
                        <col className="w-[32%]" />
                      </colgroup>
                      <thead className="sticky top-0 z-[2] shadow-[0_1px_0_0_rgba(15,23,42,0.08)]">
                        <tr className="text-[10px] font-bold uppercase tracking-wide text-brand-gray">
                          <th className="border-b border-navy/10 bg-slate-100 px-2.5 py-2.5 font-semibold text-brand-gray">
                            Nome
                          </th>
                          <th className="border-b border-navy/10 bg-slate-100 px-2.5 py-2.5 font-semibold text-brand-gray">
                            Setor
                          </th>
                          <th className="border-b border-navy/10 bg-slate-100 px-2.5 py-2.5 text-right font-semibold text-brand-gray">
                            Dias perdidos
                          </th>
                          <th className="border-b border-navy/10 bg-slate-100 px-2.5 py-2.5 font-semibold text-brand-gray">
                            Principal grupo de sintomas
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {gestaoAtencaoPorDiasDesc.map((c) => (
                          <tr key={c.matricula} className="border-b border-black/[0.06] last:border-0">
                            <td className="px-2.5 py-2 align-top">
                              <span className="break-words font-medium leading-snug text-brand-ink" title={c.nome}>
                                {c.nome}
                              </span>
                            </td>
                            <td className="px-2.5 py-2 align-top">
                              <span className="break-words uppercase tracking-wide text-navy" title={c.setor}>
                                {c.setor}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-2.5 py-2 text-right align-top tabular-nums font-semibold text-navy">
                              {fmtPt(c.diasPerdidosJustificados)}
                            </td>
                            <td className="px-2.5 py-2 align-top text-[11px] leading-snug text-brand-ink">
                              <span className="break-words" title={c.principalGrupoSintomas}>{c.principalGrupoSintomas}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div
                  className={`mt-3 flex ${RECOM_ACAO_LISTA_H} shrink-0 flex-col justify-center rounded-md border border-dashed border-navy/15 bg-white/80 px-2`}
                >
                  <p className="text-xs leading-snug text-brand-gray">
                    Sem dados nesta janela (ausências justificadas com data) — alargue o filtro ou verifique o período.
                  </p>
                </div>
              )}
            </div>

            <div className="min-w-0 rounded-lg border border-emerald-900/12 bg-[#f5fcf7] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-gray">Top 5 setores (últimos 6 meses)</p>
              <p className="mt-1 text-xs text-brand-gray">
                Setores com maior volume de dias em ausências justificadas do{' '}
                <span className="font-medium text-brand-ink">grupo de sintomas principal</span>
                {insightJustificadas6Meses?.topGrupoTitulo ? (
                  <>
                    {' '}
                    —{' '}
                    <span title={insightJustificadas6Meses.topGrupoTitulo}>
                      {tituloGrupoResumo(insightJustificadas6Meses.topGrupoTitulo, 80)}
                    </span>
                  </>
                ) : null}
                .
              </p>
              {topSetoresPorGrupoPrincipal.length > 0 ? (
                <div
                  className={`mt-3 ${RECOM_ACAO_LISTA_H} shrink-0 overflow-hidden rounded-md border border-emerald-900/10 bg-white`}
                >
                  <div className="h-full min-h-0 overflow-y-auto overflow-x-auto overscroll-y-contain">
                    <table className="w-full min-w-[420px] border-separate border-spacing-0 text-left text-xs">
                      <colgroup>
                        <col className="w-[24%]" />
                        <col className="w-[52%]" />
                        <col className="w-[24%]" />
                      </colgroup>
                      <thead className="sticky top-0 z-[2] shadow-[0_1px_0_0_rgba(16,78,45,0.12)]">
                        <tr className="text-[10px] font-bold uppercase tracking-wide text-brand-gray">
                          <th className="border-b border-emerald-900/10 bg-emerald-50 px-2.5 py-2.5 font-semibold text-brand-gray">
                            Ranking
                          </th>
                          <th className="border-b border-emerald-900/10 bg-emerald-50 px-2.5 py-2.5 font-semibold text-brand-gray">
                            Setor
                          </th>
                          <th className="border-b border-emerald-900/10 bg-emerald-50 px-2.5 py-2.5 text-right font-semibold text-brand-gray">
                            Dias
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {topSetoresPorGrupoPrincipal.map(([setor, qntd], i) => (
                          <tr
                            key={`${setor}-${i}`}
                            className="cursor-pointer border-b border-black/[0.06] transition hover:bg-emerald-50/60 last:border-0"
                            onClick={() => setDetalheSetorSintoma(setor)}
                            title={`Ver colaboradores que compõem o total do setor ${setor}`}
                          >
                            <td className="whitespace-nowrap px-2.5 py-2 align-top text-brand-ink">{i + 1}º</td>
                            <td className="px-2.5 py-2 align-top">
                              <span className="break-words font-medium uppercase tracking-wide text-navy" title={setor}>
                                {setor}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-2.5 py-2 text-right align-top tabular-nums font-semibold text-emerald-900">
                              {qntd.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div
                  className={`mt-3 flex ${RECOM_ACAO_LISTA_H} shrink-0 flex-col justify-center rounded-md border border-dashed border-emerald-900/20 bg-white/80 px-2`}
                >
                  <p className="text-xs leading-snug text-brand-gray">
                    Sem dados nesta janela de 6 meses para o grupo de sintomas principal do período.
                  </p>
                </div>
              )}
            </div>
          </div>
          {detalheSetorSintoma ? (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4" onClick={() => setDetalheSetorSintoma(null)}>
              <div
                role="dialog"
                aria-modal="true"
                className="max-h-[90vh] w-full max-w-[min(1180px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-black/10 bg-white p-6 shadow-2xl sm:p-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-navy">
                      Colaboradores do setor — {detalheSetorSintoma}
                    </h3>
                    <p className="mt-1 text-xs text-brand-gray">
                      Colaboradores que compõem o total do setor no grupo de sintomas principal
                      {insightJustificadas6Meses?.topGrupoTitulo ? (
                        <>
                          {' '}
                          (
                          <span title={insightJustificadas6Meses.topGrupoTitulo}>
                            {tituloGrupoResumo(insightJustificadas6Meses.topGrupoTitulo, 80)}
                          </span>
                          )
                        </>
                      ) : null}{' '}
                      — justificadas, últimos 6 meses.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-xl border border-black/10 bg-page px-3 py-1.5 text-sm font-semibold text-brand-ink hover:bg-white"
                    onClick={() => setDetalheSetorSintoma(null)}
                  >
                    Fechar
                  </button>
                </div>
                <div className="mt-4 max-h-[58vh] overflow-y-auto overflow-x-auto pr-1">
                  <table className="w-full min-w-[980px] table-auto text-left text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-black/10 text-[11px] uppercase tracking-wide text-brand-gray">
                        <th className="pb-2 pr-2 font-semibold">Pos.</th>
                        <th className="pb-2 pr-2 font-semibold">Matrícula</th>
                        <th className="pb-2 pr-2 font-semibold">Colaborador</th>
                        <th className="pb-2 pr-2 font-semibold">Setor</th>
                        <th className="pb-2 pr-2 text-right font-semibold">Dias perdidos</th>
                        <th className="pb-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {colaboradoresPorSetorSintoma.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-3 text-xs text-brand-gray">
                            Sem colaboradores para este setor no recorte atual.
                          </td>
                        </tr>
                      ) : (
                        colaboradoresPorSetorSintoma.map((row, idx) => (
                          <tr
                            key={`${row.matricula}-${row.nome}-${idx}`}
                            className={`cursor-pointer border-b border-black/5 transition last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-emerald-50/60`}
                            onClick={() =>
                              setDetalheAusenciasSetorColaborador({
                                matricula: row.matricula,
                                nome: row.nome,
                                setor: row.setor,
                              })
                            }
                            title={`Ver ausências de ${row.nome}`}
                          >
                            <td className="whitespace-nowrap py-2 pr-2 align-top tabular-nums text-brand-ink">{idx + 1}º</td>
                            <td className="whitespace-nowrap py-2 pr-2 align-top tabular-nums text-brand-ink">{row.matricula}</td>
                            <td className="break-words py-2 pr-2 align-top leading-snug text-brand-ink">{row.nome}</td>
                            <td className="break-words py-2 pr-2 align-top leading-snug text-brand-ink">{row.setor}</td>
                            <td className="whitespace-nowrap py-2 pr-2 text-right align-top tabular-nums font-semibold text-emerald-900">
                              {fmtPt(row.dias)}
                            </td>
                            <td className="whitespace-nowrap py-2 align-top">
                              <span
                                className={
                                  row.status === 'Ativo'
                                    ? 'inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900'
                                    : 'inline-block rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900'
                                }
                              >
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
          {detalheAusenciasSetorColaborador ? (
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
              onClick={() => setDetalheAusenciasSetorColaborador(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                className="max-h-[90vh] w-full max-w-[min(1480px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-black/10 bg-white p-6 shadow-2xl sm:p-8"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-navy">
                      Ausências do colaborador — {detalheAusenciasSetorColaborador.nome}
                    </h3>
                    <p className="mt-1 text-xs text-brand-gray">
                      Registros do colaborador no setor {detalheAusenciasSetorColaborador.setor}, grupo de sintomas
                      principal e últimos 6 meses (justificadas com CID rankeável).
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-xl border border-black/10 bg-page px-3 py-1.5 text-sm font-semibold text-brand-ink hover:bg-white"
                    onClick={() => setDetalheAusenciasSetorColaborador(null)}
                  >
                    Fechar
                  </button>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[1240px] table-auto text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/10 text-[11px] uppercase tracking-wide text-brand-gray">
                        <th className="pb-2 pr-2 font-semibold">Data</th>
                        <th className="pb-2 pr-2 font-semibold">Quantidade</th>
                        <th className="pb-2 pr-2 font-semibold">Tipo</th>
                        <th className="pb-2 pr-2 font-semibold">CID</th>
                        <th className="pb-2 pr-2 font-semibold">Endereço</th>
                        <th className="pb-2 pr-2 font-semibold">Local de atendimento</th>
                        <th className="pb-2 font-semibold">Médico</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhasAusenciasSetorColaborador.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-3 text-xs text-brand-gray">
                            Sem ausências para este colaborador no recorte atual.
                          </td>
                        </tr>
                      ) : (
                        linhasAusenciasSetorColaborador.map((l, i) => (
                          <tr key={`${l.data}-${l.tipo}-${i}`} className="border-b border-black/5 last:border-0">
                            <td className="whitespace-nowrap py-2 pr-2 align-top text-brand-ink">{l.data}</td>
                            <td className="whitespace-nowrap py-2 pr-2 align-top tabular-nums text-brand-ink">{l.quantidade}</td>
                            <td className="break-words py-2 pr-2 align-top text-brand-ink">{l.tipo}</td>
                            <td className="break-words py-2 pr-2 align-top text-brand-ink">{l.cid}</td>
                            <td className="break-words py-2 pr-2 align-top text-brand-ink">{l.endereco || '-'}</td>
                            <td className="break-words py-2 pr-2 align-top text-brand-ink">{l.localAtendimento || '-'}</td>
                            <td className="break-words py-2 align-top text-brand-ink">{l.medicoResponsavel || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {pedidoExportRelatorio === 'medicos-local' ? (
        <DialogOrdenacaoExportRelatorio
          titulo="Exportar relatório de médicos"
          descricao="Escolha como ordenar os blocos de cada médico na planilha."
          onEscolher={executarExportMedicosLocal}
          onCancelar={() => setPedidoExportRelatorio(null)}
        />
      ) : null}
      {pedidoExportRelatorio === 'top-colaboradores' ? (
        <DialogOrdenacaoExportRelatorio
          titulo="Exportar relatório de colaboradores"
          descricao="Escolha como ordenar os blocos de cada colaborador na planilha."
          onEscolher={executarExportTopColaboradores}
          onCancelar={() => setPedidoExportRelatorio(null)}
        />
      ) : null}
    </div>
  )
}
