import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigate } from 'react-router-dom';
import { Eye, RefreshCw } from 'lucide-react';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import GradeCelulaModalBtn from '../../components/pcp/GradeCelulaModalBtn';
import { useAuth } from '../../contexts/AuthContext';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import { podeAcessarGestaoMesa } from '../../utils/recebimentoPermissoes';
import { criarMatcherTextoLivre, PLACEHOLDER_BUSCA_TEXTO_LIVRE } from '../../utils/textoLivreBusca';
import {
  fetchRecebimentoMesaConferentes,
  fetchRecebimentoMesaDocumentos,
  fetchRecebimentoMesaItens,
  postRecebimentoMesaDeliberar,
  type RecebimentoConferenteOpcao,
  type RecebimentoDetalhe,
  type RecebimentoDocumentoGrade,
  type RecebimentoStatusCodigo,
} from '../../api/recebimento';

const COLUNAS = [
  { id: 'documento', label: 'Documento', align: 'left' as const },
  { id: 'nfe', label: 'NF-e', align: 'left' as const },
  { id: 'data', label: 'Data', align: 'left' as const },
  { id: 'fornecedor', label: 'Fornecedor', align: 'left' as const },
  { id: 'tipo', label: 'Tipo', align: 'left' as const },
  { id: 'andamento', label: 'Andamento', align: 'left' as const },
  { id: 'conferente', label: 'Conferente', align: 'left' as const },
  { id: 'itens', label: 'Itens', align: 'right' as const },
  { id: 'qtde', label: 'Qtde', align: 'right' as const },
] as const;

type ColId = (typeof COLUNAS)[number]['id'];
const COL_IDS: string[] = COLUNAS.map((c) => c.id);
const COLS_NUMERICAS = new Set<ColId>(['itens', 'qtde']);

const inputClass =
  'rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100';
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';
const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50';

const nfBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const nfNum = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

function fmtDataBr(ymd: string | null): string {
  if (!ymd) return '—';
  const [y, m, d] = ymd.slice(0, 10).split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function conferenteLabel(nome: string | null, login: string | null): string {
  if (nome && login) return `${nome} (${login})`;
  return nome || login || '—';
}

function dataDocYmd(d: RecebimentoDocumentoGrade): string | null {
  return d.dataEntrada ?? d.dataEmissao ?? null;
}

function cellText(d: RecebimentoDocumentoGrade, col: ColId): string {
  switch (col) {
    case 'documento':
      return d.numeroDocumentoFiscal ?? '—';
    case 'nfe':
      return d.numeroNfe ?? '—';
    case 'data':
      return fmtDataBr(dataDocYmd(d));
    case 'fornecedor':
      return d.nomeParceiro ?? '—';
    case 'tipo':
      return d.tipoMovimentacao ?? '—';
    case 'andamento':
      return d.statusLabel;
    case 'conferente':
      return conferenteLabel(d.conferenteNome, d.conferenteLogin);
    case 'itens':
      return String(d.qtdeItens);
    case 'qtde':
      return nfNum.format(d.qtdeTotal);
    default:
      return '';
  }
}

function sortValue(d: RecebimentoDocumentoGrade, col: ColId): string | number {
  switch (col) {
    case 'data':
      return dataDocYmd(d) ?? '';
    case 'itens':
      return d.qtdeItens;
    case 'qtde':
      return d.qtdeTotal;
    case 'nfe':
      return Number(d.numeroNfe) || d.numeroNfe || '';
    default:
      return cellText(d, col).toLowerCase();
  }
}

function badgeStatus(status: RecebimentoStatusCodigo, label: string) {
  const cls =
    status === 'AGUARDANDO_CONFERENTE'
      ? 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-200'
      : status === 'EM_CONFERENCIA'
        ? 'border-sky-400 bg-sky-50 text-sky-800 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-200'
        : status === 'DIVERGENCIA'
          ? 'border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-200'
          : status === 'FINALIZADO'
            ? 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
            : 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200';
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

export default function GestaoMesaPage() {
  const { hasPermission } = useAuth();
  const podeMesa = podeAcessarGestaoMesa(hasPermission);

  const [documentos, setDocumentos] = useState<RecebimentoDocumentoGrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [modalDoc, setModalDoc] = useState<RecebimentoDocumentoGrade | null>(null);
  const [detalhe, setDetalhe] = useState<RecebimentoDetalhe | null>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);
  const detalheCacheRef = useRef(new Map<number, RecebimentoDetalhe>());

  const [conferentes, setConferentes] = useState<RecebimentoConferenteOpcao[]>([]);
  const [conferenteBusca, setConferenteBusca] = useState('');
  const [conferenteId, setConferenteId] = useState<number | ''>('');
  const [deliberando, setDeliberando] = useState(false);
  const [deliberarErro, setDeliberarErro] = useState<string | null>(null);

  const filtrar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    detalheCacheRef.current.clear();
    setModalDoc(null);
    try {
      const r = await fetchRecebimentoMesaDocumentos();
      setDocumentos(r.documentos);
      if (r.erro) setErro(r.erro);
    } catch (e) {
      setDocumentos([]);
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar os documentos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!podeMesa) return;
    void filtrar();
    // carga inicial; Atualizar dispara de novo e limpa o cache
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podeMesa]);

  useEffect(() => {
    if (!podeMesa) return;
    void fetchRecebimentoMesaConferentes()
      .then(setConferentes)
      .catch(() => setConferentes([]));
  }, [podeMesa]);

  const grade = useGradeFiltrosExcel<RecebimentoDocumentoGrade>({
    rows: documentos,
    columnIds: COL_IDS,
    getCellText: (r, c) => cellText(r, c as ColId),
    valueForSort: (r, c) => sortValue(r, c as ColId),
    defaultSortLevels: [{ id: 'data', dir: 'desc' }],
    dateColumnIds: ['data'],
  });

  const filtrados = grade.rowsExibidas;

  const abrirDetalhe = async (doc: RecebimentoDocumentoGrade) => {
    setModalDoc(doc);
    setDetalheErro(null);
    setDeliberarErro(null);
    setConferenteBusca('');
    setConferenteId(doc.conferenteUsuarioId ?? '');
    const cached = detalheCacheRef.current.get(doc.idDocumento);
    if (cached) {
      setDetalhe(cached);
      return;
    }
    setDetalhe(null);
    setDetalheLoading(true);
    try {
      const data = await fetchRecebimentoMesaItens(doc.idDocumento);
      detalheCacheRef.current.set(doc.idDocumento, data);
      setDetalhe(data);
    } catch (e) {
      setDetalheErro(e instanceof Error ? e.message : 'Não foi possível carregar os itens.');
    } finally {
      setDetalheLoading(false);
    }
  };

  const conferenteMatch = useMemo(
    () => criarMatcherTextoLivre(conferenteBusca),
    [conferenteBusca]
  );
  const conferentesFiltrados = conferentes.filter(
    (c) => conferenteMatch(c.nome ?? '') || conferenteMatch(c.login)
  );

  const somaQtdeModal = detalhe?.itens.reduce((acc, it) => acc + it.qtde, 0) ?? 0;

  const aplicarDeliberacaoNaGrade = (
    idDocumento: number,
    patch: Pick<
      RecebimentoDocumentoGrade,
      | 'status'
      | 'statusLabel'
      | 'conferenteUsuarioId'
      | 'conferenteLogin'
      | 'conferenteNome'
      | 'atribuidoEm'
    >
  ) => {
    setDocumentos((prev) => prev.map((d) => (d.idDocumento === idDocumento ? { ...d, ...patch } : d)));
    setModalDoc((atual) => (atual && atual.idDocumento === idDocumento ? { ...atual, ...patch } : atual));
    const cached = detalheCacheRef.current.get(idDocumento);
    if (cached) {
      const next = { ...cached, ...patch };
      detalheCacheRef.current.set(idDocumento, next);
      setDetalhe(next);
    }
  };

  const deliberar = async () => {
    if (!modalDoc || conferenteId === '' || detalheLoading || !detalhe) return;
    setDeliberando(true);
    setDeliberarErro(null);
    try {
      const r = await postRecebimentoMesaDeliberar({
        idDocumento: modalDoc.idDocumento,
        conferenteUsuarioId: conferenteId,
        numeroDocumento: modalDoc.numeroDocumentoFiscal,
      });
      aplicarDeliberacaoNaGrade(modalDoc.idDocumento, {
        status: r.status,
        statusLabel: r.statusLabel,
        conferenteUsuarioId: r.conferenteUsuarioId,
        conferenteLogin: r.conferenteLogin,
        conferenteNome: r.conferenteNome,
        atribuidoEm: r.atribuidoEm,
      });
    } catch (e) {
      setDeliberarErro(e instanceof Error ? e.message : 'Não foi possível deliberar o conferente.');
    } finally {
      setDeliberando(false);
    }
  };

  if (!podeMesa) return <Navigate to="/sem-acesso" replace />;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2">
      <CarregandoInformacoesOverlay show={loading} mode="contained" />

      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Recebimento · Perfil Mesa
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-800 dark:text-slate-100">Gestão Mesa</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Documentos de pré-entrada da SÓ AÇO INDUSTRIAL. Clique na linha para ver materiais e deliberar o
            conferente. Filtros e período ficam no cabeçalho da grade.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {grade.temFiltrosOuOrdem && (
            <button type="button" className={btnSecondary} onClick={() => grade.limparFiltrosGrade()}>
              Limpar filtros da grade
            </button>
          )}
          <button
            type="button"
            className={btnSecondary}
            onClick={() => void filtrar()}
            disabled={loading}
            title="Atualizar do Nomus"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>
      {erro && (
        <p className="shrink-0 text-sm text-rose-600 dark:text-rose-400" role="alert">
          {erro}
        </p>
      )}

      <div
        ref={grade.tableScrollRef}
        className="min-h-[calc(100vh-11rem)] flex-1 overflow-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/40"
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
                    className={`border border-primary-500/40 px-2 py-2 font-semibold whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    <div
                      className={`flex min-w-0 items-center gap-1 ${
                        col.align === 'right' ? 'justify-end' : 'justify-between'
                      }`}
                    >
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
                    : documentos.length === 0
                      ? 'Nenhum documento de pré-entrada da SÓ AÇO INDUSTRIAL.'
                      : 'Nenhum documento com os filtros da grade. Ajuste ou limpe os filtros por coluna.'}
                </td>
              </tr>
            ) : (
              filtrados.map((d) => (
                <tr
                  key={d.idDocumento}
                  className={`cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                    d.status === 'AGUARDANDO_CONFERENTE'
                      ? 'border-l-4 border-l-amber-400'
                      : 'border-l-4 border-l-sky-500'
                  }`}
                  onClick={() => void abrirDetalhe(d)}
                >
                  <td className="px-3 py-2 font-mono font-medium">{d.numeroDocumentoFiscal ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{d.numeroNfe ?? '—'}</td>
                  <td className="px-3 py-2">{fmtDataBr(dataDocYmd(d))}</td>
                  <td className="max-w-[16rem] truncate px-3 py-2" title={d.nomeParceiro ?? undefined}>
                    {d.nomeParceiro ?? '—'}
                  </td>
                  <td className="max-w-[14rem] truncate px-3 py-2 text-xs" title={d.tipoMovimentacao ?? undefined}>
                    {d.tipoMovimentacao ?? '—'}
                  </td>
                  <td className="px-3 py-2">{badgeStatus(d.status, d.statusLabel)}</td>
                  <td className="px-3 py-2">{conferenteLabel(d.conferenteNome, d.conferenteLogin)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{d.qtdeItens}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{nfNum.format(d.qtdeTotal)}</td>
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <GradeCelulaModalBtn
                      align="center"
                      title="Ver documento"
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
        {documentos.length === 0
          ? null
          : filtrados.length === documentos.length
            ? `${documentos.length} documento${documentos.length === 1 ? '' : 's'}`
            : `${filtrados.length} de ${documentos.length} documento${documentos.length === 1 ? '' : 's'}`}
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
          showNumericFilters={COLS_NUMERICAS.has(grade.colunaFiltroAberta as ColId)}
          showDateRangeFilters={grade.colunaFiltroAberta === 'data'}
          sortAscLabel={
            COLS_NUMERICAS.has(grade.colunaFiltroAberta as ColId) ? 'Menor para Maior' : undefined
          }
          sortDescLabel={
            COLS_NUMERICAS.has(grade.colunaFiltroAberta as ColId) ? 'Maior para Menor' : undefined
          }
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
                    Documento {modalDoc.numeroDocumentoFiscal ?? modalDoc.idDocumento}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    NF-e {modalDoc.numeroNfe ?? '—'} · {fmtDataBr(dataDocYmd(modalDoc))} ·{' '}
                    {modalDoc.nomeParceiro ?? '—'}
                  </p>
                  <div className="mt-2">{badgeStatus(modalDoc.status, modalDoc.statusLabel)}</div>
                </div>
                <button type="button" className={btnSecondary} onClick={() => setModalDoc(null)}>
                  Fechar
                </button>
              </div>

              <div className="relative min-h-[12rem] flex-1 overflow-auto p-4">
                <CarregandoInformacoesOverlay show={detalheLoading} mode="contained" />
                {detalheErro && (
                  <p className="mb-3 text-sm text-rose-600" role="alert">
                    {detalheErro}
                  </p>
                )}
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900">
                    <tr>
                      <th className="px-2 py-2">Material</th>
                      <th className="px-2 py-2">UM</th>
                      <th className="px-2 py-2 text-right">Qtde</th>
                      <th className="px-2 py-2 text-right">Vl. unit.</th>
                      <th className="px-2 py-2 text-right">Vl. total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {(detalhe?.itens ?? []).map((it) => (
                      <tr key={it.idItem}>
                        <td className="px-2 py-2">
                          <div className="font-medium text-slate-800 dark:text-slate-100">
                            {it.codigoProduto ?? it.idProduto}
                          </div>
                          <div className="line-clamp-2 text-xs text-slate-500">{it.descricaoProduto ?? '—'}</div>
                        </td>
                        <td className="px-2 py-2">{it.unidadeMedida ?? '—'}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{nfNum.format(it.qtde)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{nfBrl.format(it.valorUnitario)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{nfBrl.format(it.valorTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detalhe && (
                  <p className="mt-3 text-xs text-slate-500">
                    {detalhe.itens.length} item(ns) · qtde total {nfNum.format(somaQtdeModal)}
                    {Math.abs(somaQtdeModal - modalDoc.qtdeTotal) > 0.0001
                      ? ` (grade: ${nfNum.format(modalDoc.qtdeTotal)})`
                      : ''}
                  </p>
                )}
              </div>

              <div
                className={`space-y-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-600 dark:bg-slate-900/40 ${
                  detalheLoading || !detalhe ? 'pointer-events-none opacity-50' : ''
                }`}
                aria-busy={detalheLoading}
              >
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Deliberar conferente</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[12rem]">
                    <label className={labelClass}>Buscar conferente</label>
                    <input
                      className={`${inputClass} w-full`}
                      value={conferenteBusca}
                      onChange={(e) => setConferenteBusca(e.target.value)}
                      placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
                      disabled={detalheLoading || !detalhe}
                    />
                  </div>
                  <div className="min-w-[16rem] flex-1">
                    <label className={labelClass}>Conferente</label>
                    <select
                      className={`${inputClass} w-full`}
                      value={conferenteId === '' ? '' : String(conferenteId)}
                      onChange={(e) => setConferenteId(e.target.value ? Number(e.target.value) : '')}
                      disabled={detalheLoading || !detalhe}
                    >
                      <option value="">Selecione…</option>
                      {conferentesFiltrados.map((c) => (
                        <option key={c.id} value={c.id}>
                          {conferenteLabel(c.nome, c.login)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={detalheLoading || !detalhe || conferenteId === '' || deliberando}
                    onClick={() => void deliberar()}
                  >
                    {modalDoc.conferenteUsuarioId ? 'Alterar conferente' : 'Deliberar conferente'}
                  </button>
                </div>
                {conferentes.length === 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Nenhum usuário com permissão de conferente. Marque o módulo “Recebimento” no grupo.
                  </p>
                )}
                {deliberarErro && (
                  <p className="text-sm text-rose-600" role="alert">
                    {deliberarErro}
                  </p>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
