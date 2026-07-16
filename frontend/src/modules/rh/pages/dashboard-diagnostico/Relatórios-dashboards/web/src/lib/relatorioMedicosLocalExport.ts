import type { ColaboradorAtivoResolver } from '../data/ativosMatriculas'
import type { AbsenceRow } from './absences'
import { janelaUltimos6MesesJustificadas, tipoIncluiNoRankingCid } from './absences'
import {
  downloadWorkbookSoAco,
  fmtDataBrFromDate,
  fmtQtdPlanilha,
  montarWorksheetRelatorioSoAco,
  slugNomeArquivo,
  type CampoResumoRelatorio,
  type SecaoRelatorioExcel,
} from './relatorioExcelSoAco'
import { aplicarOrdenacaoExport, type OpcoesOrdenacaoExport } from './relatorioOrdenacao'

const CHAVE_AGREGACAO_SEM_MEDICO_INFORMADO = '__sem_medico_informado__'
export const ROTULO_SEM_MEDICO_INFORMADO = '(Sem médico informado)'

function normalizeKeyText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function canonicalizarLocalAtendimento(value: string): string {
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

function medicoAusenciaSemInformacaoNoCadastro(raw: string): boolean {
  const medicoRaw = String(raw ?? '').trim() || '(Não informado)'
  return isCampoNaoInformado(medicoRaw) || !chaveMedicoResponsavelAgregacao(medicoRaw)
}

function deveFundirChaveMedicoPrefixo(curta: string, longa: string): boolean {
  if (curta.length >= longa.length) return false
  const tokensCurta = curta.split(/\s+/).filter(Boolean)
  if (tokensCurta.length < 3) return false
  if (!longa.startsWith(curta + ' ')) return false
  const extra = longa.slice(curta.length + 1).trim()
  const nExtra = extra.split(/\s+/).filter(Boolean).length
  return nExtra >= 1 && nExtra <= 2
}

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

function linhaPertenceLocalCanonico(r: AbsenceRow, localCanonico: string): boolean {
  const rawLocal = String(r.localAtendimento ?? '').trim() || '(Não informado)'
  const canonicalLocal = canonicalizarLocalAtendimento(rawLocal)
  if (isCampoNaoInformado(rawLocal) || isCampoNaoInformado(canonicalLocal)) return false
  if (canonicalLocal !== localCanonico) return false
  return true
}

function filtrarLinhasLocalAtestadoDeclaracao(rows: AbsenceRow[], localCanonico: string): AbsenceRow[] {
  return rows.filter(
    (r) => linhaPertenceLocalCanonico(r, localCanonico) && tipoIncluiNoRankingCid(r.tipo),
  )
}

function formatarIntervaloDatas(min: Date | null, max: Date | null): string {
  if (!min || !max) return '—'
  const de = fmtDataBrFromDate(min)
  const ate = fmtDataBrFromDate(max)
  return de === ate ? de : `${de} a ${ate}`
}

function calcularPeriodoRecortePainel(linhas: AbsenceRow[]): string {
  const datas = linhas.map((r) => r.data).filter((d): d is Date => d != null)
  if (!datas.length) return '—'
  const tMin = Math.min(...datas.map((d) => d.getTime()))
  const tMax = Math.max(...datas.map((d) => d.getTime()))
  return formatarIntervaloDatas(new Date(tMin), new Date(tMax))
}

export function montarResumoRelatorioMedicosLocal(
  rows: AbsenceRow[],
  localCanonico: string,
  isColaboradorAtivo: ColaboradorAtivoResolver,
): CampoResumoRelatorio[] {
  const linhasLocal = filtrarLinhasLocalAtestadoDeclaracao(rows, localCanonico)
  const periodoRecorte = calcularPeriodoRecortePainel(linhasLocal)
  const totalAusenciasComDesligados = linhasLocal.length
  const totalDiasComDesligados = linhasLocal.reduce(
    (s, r) => s + (Number.isFinite(r.qntd) ? r.qntd : 0),
    0,
  )

  const janela = janelaUltimos6MesesJustificadas(rows)
  const referenciaUltimos6Meses = janela
    ? formatarIntervaloDatas(new Date(janela.tMin), new Date(janela.tMax))
    : '—'

  const linhasUlt6Ativos =
    janela == null
      ? []
      : linhasLocal.filter((r) => {
          if (!r.data) return false
          if (!isColaboradorAtivo(Number(r.matricula) || 0)) return false
          const t = r.data.getTime()
          return t >= janela.tMin && t <= janela.tMax
        })

  const ausenciasUlt6MesesAtivos = linhasUlt6Ativos.length
  const diasPerdidosUlt6MesesAtivos = linhasUlt6Ativos.reduce(
    (s, r) => s + (Number.isFinite(r.qntd) ? r.qntd : 0),
    0,
  )

  const rankingUlt6 = rankingMedicosPorLocal(linhasUlt6Ativos, localCanonico)
  const medicoTop = rankingUlt6.sort((a, b) => b.qtdAusencias - a.qtdAusencias || b.dias - a.dias)[0]

  return [
    { rotulo: 'Período das ausências (recorte do painel)', valor: periodoRecorte },
    {
      rotulo: 'Total de ausências no local (Contando com desligados)',
      valor: totalAusenciasComDesligados,
    },
    {
      rotulo: 'Total de dias perdidos no local (Contando com desligados)',
      valor: totalDiasComDesligados,
    },
    { rotulo: 'Últimos 6 meses (referência)', valor: referenciaUltimos6Meses },
    {
      rotulo: 'Ausências no local - últ.6 meses (Apenas ativos)',
      valor: ausenciasUlt6MesesAtivos,
    },
    {
      rotulo: 'Dias perdidos- últ.6 meses (Apenas ativos)',
      valor: diasPerdidosUlt6MesesAtivos,
    },
    {
      rotulo: 'Médico com + atestados/ declarações - últ.6 meses (Apenas ativos)',
      valor: medicoTop?.name ?? '—',
    },
    {
      rotulo: 'Registros deste médico - últ.6 meses (Apenas ativos)',
      valor: medicoTop?.qtdAusencias ?? 0,
    },
    {
      rotulo: 'Dias perdidos deste médico - últ.6 meses (soma QNTD, ativos)',
      valor: medicoTop?.dias ?? 0,
    },
  ]
}

function linhaPertenceMedicoNoLocal(medicoRotulo: string, medicoResponsavelRaw: string): boolean {
  if (medicoRotulo === ROTULO_SEM_MEDICO_INFORMADO) {
    return medicoAusenciaSemInformacaoNoCadastro(medicoResponsavelRaw)
  }
  if (medicoAusenciaSemInformacaoNoCadastro(medicoResponsavelRaw)) return false
  return medicosRepresentamMesmaPessoa(medicoResponsavelRaw, medicoRotulo)
}

export type RelatorioMedicoLocalSecao = {
  medico: string
  local: string
  qtdRegistros: number
  diasPerdidos: number
  linhas: {
    data: string
    nomeColaborador: string
    setor: string
    qntd: string
    tipo: string
    cid: string
    status: string
  }[]
}

export function rankingMedicosPorLocal(
  rows: AbsenceRow[],
  localCanonico: string,
): { name: string; dias: number; qtdAusencias: number }[] {
  const map = new Map<string, { dias: number; qtdAusencias: number; rotulo: string }>()
  for (const r of rows) {
    const rawLocal = String(r.localAtendimento ?? '').trim() || '(Não informado)'
    const canonicalLocal = canonicalizarLocalAtendimento(rawLocal)
    if (isCampoNaoInformado(rawLocal) || isCampoNaoInformado(canonicalLocal)) continue
    if (canonicalLocal !== localCanonico) continue
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
  return [...fusao.values()]
    .map((agg) => ({ name: agg.rotulo, dias: agg.dias, qtdAusencias: agg.qtdAusencias }))
    .sort((a, b) => b.dias - a.dias)
}

export function montarRelatorioMedicosLocal(
  rows: AbsenceRow[],
  localCanonico: string,
  isColaboradorAtivo: ColaboradorAtivoResolver,
  opcoes?: { somenteColaboradoresAtivos?: boolean },
): RelatorioMedicoLocalSecao[] {
  const somenteAtivos = opcoes?.somenteColaboradoresAtivos !== false
  const medicos = rankingMedicosPorLocal(rows, localCanonico)
  const secoes: RelatorioMedicoLocalSecao[] = []

  for (const med of medicos) {
    const linhasRaw = rows.filter((r) => {
      const rawLocal = String(r.localAtendimento ?? '').trim() || '(Não informado)'
      const canonicalLocal = canonicalizarLocalAtendimento(rawLocal)
      if (isCampoNaoInformado(rawLocal) || isCampoNaoInformado(canonicalLocal)) return false
      if (canonicalLocal !== localCanonico) return false
      const medicoResponsavelRaw = String(r.medicoResponsavel ?? '').trim() || '(Não informado)'
      if (!linhaPertenceMedicoNoLocal(med.name, medicoResponsavelRaw)) return false
      if (!tipoIncluiNoRankingCid(r.tipo)) return false
      if (somenteAtivos && !isColaboradorAtivo(Number(r.matricula) || 0)) return false
      return true
    })

    linhasRaw.sort((a, b) => (b.data?.getTime() ?? 0) - (a.data?.getTime() ?? 0))

    const linhas = linhasRaw.map((r) => ({
      data: fmtDataBrFromDate(r.data),
      nomeColaborador: String(r.nome ?? '').trim() || '(Não informado)',
      setor: String(r.setor ?? '').trim() || '(Não informado)',
      qntd: fmtQtdPlanilha(r.qntdOriginal, r.qntd),
      tipo: String(r.tipo ?? '').trim() || '(Sem tipo)',
      cid: String(r.cid ?? '').trim() || '(Sem CID)',
      status: isColaboradorAtivo(Number(r.matricula) || 0) ? 'Ativo' : 'Inativo',
    }))

    const diasPerdidos = linhasRaw.reduce((s, r) => s + (Number.isFinite(r.qntd) ? r.qntd : 0), 0)

    secoes.push({
      medico: med.name,
      local: localCanonico,
      qtdRegistros: linhasRaw.length,
      diasPerdidos,
      linhas,
    })
  }

  return secoes
}

export function downloadRelatorioMedicosLocalXlsx(
  rows: AbsenceRow[],
  localCanonico: string,
  isColaboradorAtivo: ColaboradorAtivoResolver,
  opcoes?: { somenteColaboradoresAtivos?: boolean } & OpcoesOrdenacaoExport,
): void {
  const secoesBase = montarRelatorioMedicosLocal(rows, localCanonico, isColaboradorAtivo, opcoes)
  const secoes = aplicarOrdenacaoExport(
    secoesBase,
    (s) => s.medico,
    (s) => s.medico,
    opcoes,
  )
  const geradoEm = new Date().toLocaleString('pt-BR')
  const somenteAtivos = opcoes?.somenteColaboradoresAtivos !== false
  const ordenacaoLabel =
    opcoes?.ordenacao === 'atual' ? 'Ordem atual do painel' : 'Dias perdidos (maior → menor)'

  const secoesExcel: SecaoRelatorioExcel[] = secoes.map((sec) => ({
    tituloBloco: sec.medico,
    camposResumo: [
      { rotulo: 'Médico responsável', valor: sec.medico },
      { rotulo: 'Local de atendimento', valor: sec.local },
      { rotulo: 'Quantidade de registros (atestados/documentos)', valor: sec.qtdRegistros },
      { rotulo: 'Quantidade de dias perdidos', valor: sec.diasPerdidos },
    ],
    colunas: ['Data', 'Nome do colaborador', 'Setor', 'QNTD', 'Tipo', 'CID', 'Status'],
    linhas: sec.linhas.map((l) => [
      l.data,
      l.nomeColaborador,
      l.setor,
      l.qntd,
      l.tipo,
      l.cid,
      l.status,
    ]),
  }))

  const resumoInicial = montarResumoRelatorioMedicosLocal(rows, localCanonico, isColaboradorAtivo)

  const sheet = montarWorksheetRelatorioSoAco(
    {
      tituloDocumento: 'Médicos por local de atendimento',
      subtitulo: `Local: ${localCanonico} · Só Aço — Painel de RH`,
      linhasMeta: [
        { rotulo: 'Gerado em', valor: geradoEm },
        { rotulo: 'Ordenação dos médicos', valor: ordenacaoLabel },
      ],
      observacao: somenteAtivos
        ? 'Detalhamento e totais por médico: colaboradores ativos e registros do tipo atestado/declaração.'
        : 'Detalhamento inclui todos os colaboradores com atestado/declaração.',
      tituloResumoInicial: 'Resumo do local',
      resumoInicial,
    },
    secoesExcel,
  )

  const dataArq = new Date().toISOString().slice(0, 10)
  downloadWorkbookSoAco(
    sheet,
    'Médicos por local',
    `Relatorio-medicos-${slugNomeArquivo(localCanonico)}-${dataArq}.xlsx`,
  )
}
