import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, RefreshCw } from 'lucide-react';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import GradeCelulaModalBtn from '../../components/pcp/GradeCelulaModalBtn';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import {
  fetchRecebimentoDigitacaoHistorico,
  fetchRecebimentoDigitacaoHistoricoDocumento,
  type RecebimentoHistoricoConferencia,
  type RecebimentoHistoricoEnvio,
  type RecebimentoHistoricoEnvioDetalhe,
  type RecebimentoStatusCodigo,
} from '../../api/recebimento';

const COLUNAS = [
  { id: 'documento', label: 'Documento' },
  { id: 'nfe', label: 'NF-e' },
  { id: 'data', label: 'Data' },
  { id: 'fornecedor', label: 'Fornecedor' },
  { id: 'conferente', label: 'Conferente' },
  { id: 'andamento', label: 'Andamento' },
  { id: 'enviado', label: 'Enviado em' },
  { id: 'voltas', label: 'Voltas' },
] as const;

type ColId = (typeof COLUNAS)[number]['id'];
const COL_IDS: string[] = COLUNAS.map((c) => c.id);

const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50';

const nfNum = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

function fmtDataBr(ymd: string | null): string {
  if (!ymd) return '—';
  const [y, m, d] = ymd.slice(0, 10).split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function fmtDateTimeBr(iso: string | null): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function conferenteLabel(nome: string | null, login: string | null): string {
  if (nome && login) return `${nome} (${login})`;
  return nome || login || '—';
}

function dataDocYmd(d: RecebimentoHistoricoEnvio): string | null {
  return d.dataEntrada ?? d.dataEmissao ?? null;
}

function cellText(d: RecebimentoHistoricoEnvio, col: ColId): string {
  switch (col) {
    case 'documento':
      return d.numeroDocumentoFiscal ?? '—';
    case 'nfe':
      return d.numeroNfe ?? '—';
    case 'data':
      return fmtDataBr(dataDocYmd(d));
    case 'fornecedor':
      return d.nomeParceiro ?? '—';
    case 'conferente':
      return conferenteLabel(d.conferenteNome, d.conferenteLogin);
    case 'andamento':
      return d.statusLabel;
    case 'enviado':
      return fmtDateTimeBr(d.enviadoEm);
    case 'voltas':
      return String(d.qtdeVoltas);
    default:
      return '';
  }
}

function sortValue(d: RecebimentoHistoricoEnvio, col: ColId): string | number {
  switch (col) {
    case 'data':
      return dataDocYmd(d) ?? '';
    case 'enviado':
      return d.enviadoEm ?? '';
    case 'voltas':
      return d.qtdeVoltas;
    case 'nfe':
      return Number(d.numeroNfe) || d.numeroNfe || '';
    default:
      return cellText(d, col).toLowerCase();
  }
}

function badgeStatus(status: RecebimentoStatusCodigo, label: string) {
  const cls =
    status === 'EM_CONFERENCIA'
      ? 'border-sky-400 bg-sky-50 text-sky-800 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-200'
      : status === 'DIVERGENCIA'
        ? 'border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-200'
        : status === 'FINALIZADO' || status === 'DEVOLUCAO_VINCULADA'
          ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200'
          : 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-200';
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function tituloVolta(indice: number, total: number): string {
  if (total <= 1) return 'Retorno à Mesa';
  return `${indice + 1}ª volta à Mesa`;
}

function HistoricoVolta({ volta, titulo }: { volta: RecebimentoHistoricoConferencia; titulo: string }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-600">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2 dark:bg-slate-900/60">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{titulo}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Conferiu: {conferenteLabel(volta.conferenteNome, volta.conferenteLogin)} ·{' '}
            {fmtDateTimeBr(volta.retornadoEm)}
          </p>
        </div>
        {badgeStatus(volta.status, volta.statusLabel)}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100/70 text-left text-xs uppercase text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-3 py-2">Material</th>
              <th className="px-3 py-2 text-right">Qtde NF</th>
              <th className="px-3 py-2 text-right">Última qtde física</th>
              <th className="px-3 py-2 text-center">Tentativas</th>
              <th className="px-3 py-2 text-center">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {volta.itens.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-5 text-center text-slate-500">
                  Nenhuma contagem registrada.
                </td>
              </tr>
            ) : (
              volta.itens.map((item, index) => (
                <tr key={item.idItem ?? `${item.codigoProduto ?? 'item'}-${index}`}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800 dark:text-slate-100">
                      {item.codigoProduto ?? '—'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.descricaoProduto ?? '—'}
                      {item.unidadeMedida ? ` · ${item.unidadeMedida}` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {item.qtdeDocumento == null ? '—' : nfNum.format(item.qtdeDocumento)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{nfNum.format(item.qtdeInformada)}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{item.tentativas}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${
                        item.conferido
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-600 dark:bg-rose-950/40 dark:text-rose-300'
                      }`}
                    >
                      {item.conferido ? 'Conferido' : 'Divergência'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Campo({ rotulo, valor, horario }: { rotulo: string; valor: string; horario: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-600">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{rotulo}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{valor}</dd>
      <dd className="mt-0.5 text-sm tabular-nums text-slate-600 dark:text-slate-300">{horario}</dd>
    </div>
  );
}

export default function DigitacaoConferenciaHistorico() {
  const [conferencias, setConferencias] = useState<RecebimentoHistoricoEnvio[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [modalDoc, setModalDoc] = useState<RecebimentoHistoricoEnvio | null>(null);
  const [detalhe, setDetalhe] = useState<RecebimentoHistoricoEnvioDetalhe | null>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);
  const detalheCacheRef = useRef(new Map<number, RecebimentoHistoricoEnvioDetalhe>());

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    detalheCacheRef.current.clear();
    setModalDoc(null);
    try {
      const r = await fetchRecebimentoDigitacaoHistorico();
      setConferencias(r.conferencias);
      if (r.erro) setErro(r.erro);
    } catch (e) {
      setConferencias([]);
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o histórico.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const grade = useGradeFiltrosExcel<RecebimentoHistoricoEnvio>({
    rows: conferencias,
    columnIds: COL_IDS,
    getCellText: (r, c) => cellText(r, c as ColId),
    valueForSort: (r, c) => sortValue(r, c as ColId),
    defaultSortLevels: [{ id: 'enviado', dir: 'desc' }],
    dateColumnIds: ['data'],
  });

  const abrirDetalhe = async (doc: RecebimentoHistoricoEnvio) => {
    setModalDoc(doc);
    setDetalheErro(null);
    const cached = detalheCacheRef.current.get(doc.idDocumento);
    if (cached) {
      setDetalhe(cached);
      setDetalheLoading(false);
      return;
    }
    setDetalhe(null);
    setDetalheLoading(true);
    try {
      const data = await fetchRecebimentoDigitacaoHistoricoDocumento(doc.idDocumento);
      detalheCacheRef.current.set(doc.idDocumento, data);
      setDetalhe(data);
      if (data.erro) setDetalheErro(data.erro);
    } catch (e) {
      setDetalhe(null);
      setDetalheErro(e instanceof Error ? e.message : 'Não foi possível carregar a conferência.');
    } finally {
      setDetalheLoading(false);
    }
  };

  const filtrados = grade.rowsExibidas;
  const voltas = detalhe ? [...detalhe.historicosConferencia].reverse() : [];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2">
      <CarregandoInformacoesOverlay show={loading} mode="contained" />
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {grade.temFiltrosOuOrdem && (
          <button type="button" className={btnSecondary} onClick={() => grade.limparFiltrosGrade()}>
            Limpar filtros da grade
          </button>
        )}
        <button type="button" className={btnSecondary} onClick={() => void carregar()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>
      {erro && (
        <p className="shrink-0 text-sm text-rose-600 dark:text-rose-400" role="alert">
          {erro}
        </p>
      )}
      <div
        ref={grade.tableScrollRef}
        className="min-h-[calc(100vh-14rem)] flex-1 overflow-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40"
      >
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-primary-600 text-white">
              {COLUNAS.map((col) => {
                const sortAtivo =
                  grade.sortState?.key === col.id || grade.sortLevels.some((l) => l.id === col.id);
                return (
                  <th
                    key={col.id}
                    className="border border-primary-500/40 px-2 py-2 text-left font-semibold whitespace-nowrap"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-1">
                      <span className="min-w-0 truncate text-[11px] uppercase leading-tight tracking-wide">
                        {col.label}
                      </span>
                      <GradeFiltroCabecalhoBtn
                        ativo={grade.colunaComFiltroAtivo(col.id) || sortAtivo}
                        onClick={(e) => grade.abrirFiltroExcel(col.id, e)}
                      />
                    </div>
                  </th>
                );
              })}
              <th className="border border-primary-500/40 px-2 py-2 text-center font-semibold whitespace-nowrap text-[11px] uppercase tracking-wide">
                Ação
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={COLUNAS.length + 1} className="px-3 py-8 text-center text-slate-500">
                  {loading
                    ? 'Carregando…'
                    : conferencias.length === 0
                      ? 'Nenhuma conferência enviada ainda.'
                      : 'Nenhuma conferência com os filtros da grade.'}
                </td>
              </tr>
            ) : (
              filtrados.map((d) => (
                <tr
                  key={d.idDocumento}
                  className="cursor-pointer border-l-4 border-l-emerald-500 hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  onClick={() => void abrirDetalhe(d)}
                >
                  <td className="px-3 py-2 font-mono font-medium">{d.numeroDocumentoFiscal ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{d.numeroNfe ?? '—'}</td>
                  <td className="px-3 py-2">{fmtDataBr(dataDocYmd(d))}</td>
                  <td className="max-w-[16rem] truncate px-3 py-2" title={d.nomeParceiro ?? undefined}>
                    {d.nomeParceiro ?? '—'}
                  </td>
                  <td className="px-3 py-2">{conferenteLabel(d.conferenteNome, d.conferenteLogin)}</td>
                  <td className="px-3 py-2">{badgeStatus(d.status, d.statusLabel)}</td>
                  <td className="px-3 py-2">{fmtDateTimeBr(d.enviadoEm)}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{d.qtdeVoltas}</td>
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <GradeCelulaModalBtn
                      align="center"
                      title="Ver histórico da conferência"
                      onClick={() => void abrirDetalhe(d)}
                    >
                      <Eye className="h-4 w-4" />
                    </GradeCelulaModalBtn>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
        {conferencias.length === 0
          ? null
          : filtrados.length === conferencias.length
            ? `${conferencias.length} conferência${conferencias.length === 1 ? '' : 's'} enviada${conferencias.length === 1 ? '' : 's'}`
            : `${filtrados.length} de ${conferencias.length} conferências enviadas`}
      </p>

      {grade.colunaFiltroAberta && grade.filtroAbertoRect && (
        <GradeFiltroExcelPortal
          colunaAberta={grade.colunaFiltroAberta}
          rect={grade.filtroAbertoRect}
          dropdownRef={grade.filtroDropdownRef}
          excelFilterDrafts={grade.excelFilterDrafts}
          setExcelFilterDrafts={grade.setExcelFilterDrafts}
          valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
          onSortAsc={(colId) => {
            grade.setSortState({ key: colId, direction: 'asc' });
            grade.setSortLevels([]);
            grade.fecharFiltroExcel();
          }}
          onSortDesc={(colId) => {
            grade.setSortState({ key: colId, direction: 'desc' });
            grade.setSortLevels([]);
            grade.fecharFiltroExcel();
          }}
          onAplicar={grade.aplicarFiltroExcel}
          onCancelar={grade.fecharFiltroExcel}
          showDateRangeFilters={grade.colunaFiltroAberta === 'data'}
        />
      )}

      {modalDoc &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[1px]"
            role="dialog"
            aria-modal="true"
            onClick={() => setModalDoc(null)}
          >
            <div
              className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-600">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Histórico {modalDoc.numeroDocumentoFiscal ?? modalDoc.idDocumento}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    NF-e {modalDoc.numeroNfe ?? '—'} · {fmtDataBr(dataDocYmd(modalDoc))} ·{' '}
                    {modalDoc.nomeParceiro ?? '—'}
                  </p>
                  <div className="mt-2">
                    {badgeStatus(detalhe?.status ?? modalDoc.status, detalhe?.statusLabel ?? modalDoc.statusLabel)}
                  </div>
                </div>
                <button type="button" className={btnSecondary} onClick={() => setModalDoc(null)}>
                  Fechar
                </button>
              </div>
              <div className="relative min-h-[12rem] flex-1 space-y-4 overflow-auto p-4">
                <CarregandoInformacoesOverlay show={detalheLoading} mode="contained" />
                {detalheErro && (
                  <p className="text-sm text-rose-600" role="alert">
                    {detalheErro}
                  </p>
                )}
                {detalhe && (
                  <>
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <Campo
                        rotulo="Deliberou"
                        valor={detalhe.atribuidoPorLogin ?? '—'}
                        horario={fmtDateTimeBr(detalhe.atribuidoEm)}
                      />
                      <Campo
                        rotulo="Conferiu"
                        valor={conferenteLabel(detalhe.conferenteNome, detalhe.conferenteLogin)}
                        horario={fmtDateTimeBr(detalhe.enviadoEm)}
                      />
                    </dl>
                    {detalhe.emNovaConferencia && (
                      <p className="rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-800 dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-200">
                        Este documento está em uma nova conferência. As voltas abaixo são as que já foram
                        enviadas à Mesa.
                      </p>
                    )}
                    {detalhe.mesaAceiteJustificativa && (
                      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-100">
                        <p className="font-semibold">Aceito como está</p>
                        <p className="mt-1 whitespace-pre-wrap">{detalhe.mesaAceiteJustificativa}</p>
                      </div>
                    )}
                    {detalhe.devolucao && (
                      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                        <p className="font-semibold">Documento de devolução</p>
                        <p className="mt-1">
                          Documento{' '}
                          {detalhe.devolucao.numeroDocumentoFiscal ?? detalhe.devolucao.idDocumento}
                          {detalhe.devolucao.numeroNfe ? ` · NF-e ${detalhe.devolucao.numeroNfe}` : ''}
                          {detalhe.devolucao.vinculadaEm
                            ? ` · ${fmtDateTimeBr(detalhe.devolucao.vinculadaEm)}`
                            : ''}
                        </p>
                      </div>
                    )}
                    <div className="space-y-4">
                      {voltas.map((volta, indice) => (
                        <HistoricoVolta
                          key={`${volta.retornadoEm ?? 'volta'}-${indice}`}
                          volta={volta}
                          titulo={tituloVolta(voltas.length - 1 - indice, voltas.length)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
