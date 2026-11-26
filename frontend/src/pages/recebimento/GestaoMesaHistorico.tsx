import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import GradeCelulaModalBtn from '../../components/pcp/GradeCelulaModalBtn';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import {
  fetchRecebimentoMesaHistorico,
  fetchRecebimentoMesaHistoricoDocumento,
  type RecebimentoHistoricoEnvioDetalhe,
  type RecebimentoMesaDeliberacao,
} from '../../api/recebimento';
import HistoricoConferenciaResumoModal, {
  badgeStatus,
  conferenteLabel,
  fmtDataBr,
  fmtDateTimeBr,
} from './HistoricoConferenciaResumoModal';

const COLUNAS = [
  { id: 'documento', label: 'Documento' },
  { id: 'nfe', label: 'NF-e' },
  { id: 'data', label: 'Data' },
  { id: 'fornecedor', label: 'Fornecedor' },
  { id: 'conferente', label: 'Conferente' },
  { id: 'deliberado', label: 'Deliberado em' },
  { id: 'deliberadoPor', label: 'Deliberado por' },
  { id: 'andamento', label: 'Andamento' },
] as const;

type ColId = (typeof COLUNAS)[number]['id'];
const COL_IDS: string[] = COLUNAS.map((c) => c.id);

const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50';

function dataDocYmd(d: RecebimentoMesaDeliberacao): string | null {
  return d.dataEntrada ?? d.dataEmissao ?? null;
}

function cellText(d: RecebimentoMesaDeliberacao, col: ColId): string {
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
    case 'deliberado':
      return fmtDateTimeBr(d.deliberadoEm);
    case 'deliberadoPor':
      return d.deliberadoPor ?? '—';
    case 'andamento':
      return d.statusLabel;
    default:
      return '';
  }
}

function sortValue(d: RecebimentoMesaDeliberacao, col: ColId): string | number {
  switch (col) {
    case 'data':
      return dataDocYmd(d) ?? '';
    case 'deliberado':
      return d.deliberadoEm ?? '';
    case 'nfe':
      return Number(d.numeroNfe) || d.numeroNfe || '';
    default:
      return cellText(d, col).toLowerCase();
  }
}

export default function GestaoMesaHistorico() {
  const [deliberacoes, setDeliberacoes] = useState<RecebimentoMesaDeliberacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modalDoc, setModalDoc] = useState<RecebimentoMesaDeliberacao | null>(null);
  const detalheCacheRef = useRef(new Map<number, RecebimentoHistoricoEnvioDetalhe>());

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    detalheCacheRef.current.clear();
    setModalDoc(null);
    try {
      const r = await fetchRecebimentoMesaHistorico();
      setDeliberacoes(r.deliberacoes);
      if (r.erro) setErro(r.erro);
    } catch (e) {
      setDeliberacoes([]);
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o histórico.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const grade = useGradeFiltrosExcel<RecebimentoMesaDeliberacao>({
    rows: deliberacoes,
    columnIds: COL_IDS,
    getCellText: (r, c) => cellText(r, c as ColId),
    valueForSort: (r, c) => sortValue(r, c as ColId),
    defaultSortLevels: [{ id: 'deliberado', dir: 'desc' }],
    dateColumnIds: ['data', 'deliberado'],
  });

  const filtrados = grade.rowsExibidas;

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
                    : deliberacoes.length === 0
                      ? 'Nenhuma deliberação registrada ainda.'
                      : 'Nenhuma deliberação com os filtros da grade.'}
                </td>
              </tr>
            ) : (
              filtrados.map((d) => (
                <tr
                  key={d.idDocumento}
                  className="cursor-pointer border-l-4 border-l-emerald-500 hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  onClick={() => setModalDoc(d)}
                >
                  <td className="px-3 py-2 font-mono font-medium">{d.numeroDocumentoFiscal ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{d.numeroNfe ?? '—'}</td>
                  <td className="px-3 py-2">{fmtDataBr(dataDocYmd(d))}</td>
                  <td className="max-w-[16rem] truncate px-3 py-2" title={d.nomeParceiro ?? undefined}>
                    {d.nomeParceiro ?? '—'}
                  </td>
                  <td className="px-3 py-2">{conferenteLabel(d.conferenteNome, d.conferenteLogin)}</td>
                  <td className="px-3 py-2">{fmtDateTimeBr(d.deliberadoEm)}</td>
                  <td className="px-3 py-2">{d.deliberadoPor ?? '—'}</td>
                  <td className="px-3 py-2">{badgeStatus(d.status, d.statusLabel)}</td>
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <GradeCelulaModalBtn
                      align="center"
                      title="Ver histórico da deliberação"
                      onClick={() => setModalDoc(d)}
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
        {deliberacoes.length === 0
          ? null
          : filtrados.length === deliberacoes.length
            ? `${deliberacoes.length} deliberação${deliberacoes.length === 1 ? '' : 'ões'}`
            : `${filtrados.length} de ${deliberacoes.length} deliberações`}
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
          showDateRangeFilters={grade.colunaFiltroAberta === 'data' || grade.colunaFiltroAberta === 'deliberado'}
        />
      )}

      {modalDoc && (
        <HistoricoConferenciaResumoModal
          idDocumento={modalDoc.idDocumento}
          resumoInicial={modalDoc}
          cacheRef={detalheCacheRef}
          carregar={fetchRecebimentoMesaHistoricoDocumento}
          onClose={() => setModalDoc(null)}
        />
      )}
    </div>
  );
}
