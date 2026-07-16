import type { ColaboradorAtivoResolver } from '../data/ativosMatriculas'
import {
  janelaUltimos6MesesJustificadas,
  topColaboradoresJustificadosAtencao6Meses,
  type AbsenceRow,
} from './absences'
import {
  downloadWorkbookSoAco,
  fmtDataBrFromDate,
  fmtQtdPlanilha,
  montarWorksheetRelatorioSoAco,
  type SecaoRelatorioExcel,
} from './relatorioExcelSoAco'
import { aplicarOrdenacaoExport, type OpcoesOrdenacaoExport } from './relatorioOrdenacao'

export type RelatorioColaboradorSecao = {
  nome: string
  matricula: number
  setor: string
  qtdAusencias: number
  diasPerdidos: number
  linhas: {
    data: string
    tipo: string
    quantidade: string
    localAtendimento: string
    medico: string
  }[]
}

export function montarRelatorioTopColaboradoresAtivos(
  rows: AbsenceRow[],
  isColaboradorAtivo: ColaboradorAtivoResolver,
  limit = 10,
): RelatorioColaboradorSecao[] {
  const janela = janelaUltimos6MesesJustificadas(rows)
  if (!janela) return []

  const top = topColaboradoresJustificadosAtencao6Meses(rows, limit, isColaboradorAtivo)
  const secoes: RelatorioColaboradorSecao[] = []

  for (const col of top) {
    const linhasRaw = rows.filter((r) => {
      if (r.categoria !== 'Justificada' || !r.data) return false
      if (r.matricula !== col.matricula) return false
      if (!isColaboradorAtivo(col.matricula)) return false
      const t = r.data.getTime()
      if (t < janela.tMin || t > janela.tMax) return false
      return true
    })

    linhasRaw.sort((a, b) => (b.data?.getTime() ?? 0) - (a.data?.getTime() ?? 0))

    const linhas = linhasRaw.map((r) => ({
      data: fmtDataBrFromDate(r.data),
      tipo: String(r.tipo ?? '').trim() || '(Sem tipo)',
      quantidade: fmtQtdPlanilha(r.qntdOriginal, r.qntd),
      localAtendimento: String(r.localAtendimento ?? '').trim() || '(Não informado)',
      medico: String(r.medicoResponsavel ?? '').trim() || '(Não informado)',
    }))

    secoes.push({
      nome: col.nome,
      matricula: col.matricula,
      setor: col.setor,
      qtdAusencias: linhasRaw.length,
      diasPerdidos: linhasRaw.reduce((s, r) => s + (Number.isFinite(r.qntd) ? r.qntd : 0), 0),
      linhas,
    })
  }

  return secoes
}

export function downloadRelatorioTopColaboradoresAtivosXlsx(
  rows: AbsenceRow[],
  isColaboradorAtivo: ColaboradorAtivoResolver,
  limit = 10,
  opcoes?: OpcoesOrdenacaoExport,
): void {
  const secoesBase = montarRelatorioTopColaboradoresAtivos(rows, isColaboradorAtivo, limit)
  const secoesDados = aplicarOrdenacaoExport(
    secoesBase,
    (s) => String(s.matricula),
    (s) => s.nome,
    opcoes,
  )
  const geradoEm = new Date().toLocaleString('pt-BR')
  const ordenacaoLabel =
    opcoes?.ordenacao === 'atual' ? 'Ordem atual do painel' : 'Dias perdidos (maior → menor)'

  const secoesExcel: SecaoRelatorioExcel[] = secoesDados.map((sec, idx) => ({
    tituloBloco: `${idx + 1}º — ${sec.nome}`,
    camposResumo: [
      { rotulo: 'Colaborador', valor: sec.nome },
      { rotulo: 'Setor', valor: sec.setor },
      { rotulo: 'Quantidade de ausências (registros)', valor: sec.qtdAusencias },
      { rotulo: 'Quantidade de dias perdidos', valor: sec.diasPerdidos },
    ],
    colunas: ['Data', 'Tipo de ausência', 'Quantidade', 'Local de atendimento', 'Médico'],
    linhas: sec.linhas.map((l) => [l.data, l.tipo, l.quantidade, l.localAtendimento, l.medico]),
  }))

  const sheet = montarWorksheetRelatorioSoAco(
    {
      tituloDocumento: 'Top 10 colaboradores ativos — ausências justificadas',
      subtitulo: 'Últimos 6 meses · Só Aço — Painel de RH',
      linhasMeta: [
        { rotulo: 'Gerado em', valor: geradoEm },
        { rotulo: 'Ordenação dos colaboradores', valor: ordenacaoLabel },
      ],
      observacao:
        'Ranking e detalhamento consideram apenas colaboradores ativos e ausências justificadas com data no período.',
    },
    secoesExcel,
  )

  const dataArq = new Date().toISOString().slice(0, 10)
  downloadWorkbookSoAco(sheet, 'Top 10 ativos', `Relatorio-top10-colaboradores-ativos-${dataArq}.xlsx`)
}
