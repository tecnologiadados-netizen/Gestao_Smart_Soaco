import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigate } from 'react-router-dom';
import { CheckCircle2, Eye, RefreshCw } from 'lucide-react';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import LoaderCirculo from '../../components/LoaderCirculo';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import GradeCelulaModalBtn from '../../components/pcp/GradeCelulaModalBtn';
import { useAuth } from '../../contexts/AuthContext';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import { podeAcessarDigitacaoConferencia } from '../../utils/recebimentoPermissoes';
import {
  fetchRecebimentoDigitacaoDocumento,
  fetchRecebimentoDigitacaoPendencias,
  postRecebimentoDigitacaoDevolver,
  postRecebimentoDigitacaoItem,
  type RecebimentoDigitacaoDetalhe,
  type RecebimentoPendenciaConferente,
  type RecebimentoProdutoConferente,
  type RecebimentoStatusCodigo,
} from '../../api/recebimento';

const COLUNAS = [
  { id: 'documento', label: 'Documento', align: 'left' as const },
  { id: 'nfe', label: 'NF-e', align: 'left' as const },
  { id: 'data', label: 'Data', align: 'left' as const },
  { id: 'fornecedor', label: 'Fornecedor', align: 'left' as const },
  { id: 'andamento', label: 'Andamento', align: 'left' as const },
  { id: 'atribuido', label: 'Atribuído em', align: 'left' as const },
] as const;

type ColId = (typeof COLUNAS)[number]['id'];
const COL_IDS: string[] = COLUNAS.map((c) => c.id);

const inputClass =
  'rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100';
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';
const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50';
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

function dataDocYmd(d: RecebimentoPendenciaConferente): string | null {
  return d.dataEntrada ?? d.dataEmissao ?? null;
}

function cellText(d: RecebimentoPendenciaConferente, col: ColId): string {
  switch (col) {
    case 'documento':
      return d.numeroDocumentoFiscal ?? '—';
    case 'nfe':
      return d.numeroNfe ?? '—';
    case 'data':
      return fmtDataBr(dataDocYmd(d));
    case 'fornecedor':
      return d.nomeParceiro ?? '—';
    case 'andamento':
      return d.statusLabel;
    case 'atribuido':
      return fmtDateTimeBr(d.atribuidoEm);
    default:
      return '';
  }
}

function sortValue(d: RecebimentoPendenciaConferente, col: ColId): string | number {
  switch (col) {
    case 'data':
      return dataDocYmd(d) ?? '';
    case 'atribuido':
      return d.atribuidoEm ?? '';
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
        : 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-200';
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function produtoLabel(p: RecebimentoProdutoConferente): string {
  const codigo = p.codigoProduto ?? `Item ${p.idItem}`;
  return p.descricaoProduto ? `${codigo} — ${p.descricaoProduto}` : codigo;
}

export default function DigitacaoConferenciaPage() {
  const { hasPermission } = useAuth();
  const pode = podeAcessarDigitacaoConferencia(hasPermission);

  const [pendencias, setPendencias] = useState<RecebimentoPendenciaConferente[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [modalDoc, setModalDoc] = useState<RecebimentoPendenciaConferente | null>(null);
  const [detalhe, setDetalhe] = useState<RecebimentoDigitacaoDetalhe | null>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [detalheErro, setDetalheErro] = useState<string | null>(null);
  const detalheCacheRef = useRef(new Map<number, RecebimentoDigitacaoDetalhe>());

  const [idItem, setIdItem] = useState<number | ''>('');
  const [qtde, setQtde] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [devolviendo, setDevolviendo] = useState(false);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [acaoOk, setAcaoOk] = useState<string | null>(null);
  const [feedbackRetorno, setFeedbackRetorno] = useState<'off' | 'loading' | 'ok'>('off');
  const [feedbackMsg, setFeedbackMsg] = useState('Conferência devolvida à Mesa');
  const qtdeRef = useRef<HTMLInputElement>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    detalheCacheRef.current.clear();
    setModalDoc(null);
    try {
      const r = await fetchRecebimentoDigitacaoPendencias();
      setPendencias(r.pendencias);
      if (r.erro) setErro(r.erro);
    } catch (e) {
      setPendencias([]);
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar as pendências.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pode) return;
    void carregar();
  }, [pode, carregar]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const grade = useGradeFiltrosExcel<RecebimentoPendenciaConferente>({
    rows: pendencias,
    columnIds: COL_IDS,
    getCellText: (r, c) => cellText(r, c as ColId),
    valueForSort: (r, c) => sortValue(r, c as ColId),
    defaultSortLevels: [{ id: 'atribuido', dir: 'desc' }],
    dateColumnIds: ['data'],
  });

  const filtrados = grade.rowsExibidas;
  const itensCarregados = !detalheLoading && detalhe != null;
  const produtos = detalhe?.produtos ?? [];
  const pendentes = produtos.filter((p) => !p.conferido);
  const todosConferidos = produtos.length > 0 && pendentes.length === 0;

  const selecionarProximoPendente = (lista: RecebimentoProdutoConferente[]) => {
    const next = lista.find((p) => !p.conferido);
    setIdItem(next ? next.idItem : '');
  };

  const abrirDetalhe = async (doc: RecebimentoPendenciaConferente) => {
    setModalDoc(doc);
    setDetalheErro(null);
    setAcaoErro(null);
    setAcaoOk(null);
    setQtde('');
    const cached = detalheCacheRef.current.get(doc.idDocumento);
    if (cached) {
      setDetalhe(cached);
      setDetalheLoading(false);
      selecionarProximoPendente(cached.produtos);
      return;
    }
    setDetalhe(null);
    setIdItem('');
    setDetalheLoading(true);
    try {
      const data = await fetchRecebimentoDigitacaoDocumento(doc.idDocumento);
      detalheCacheRef.current.set(doc.idDocumento, data);
      setDetalhe(data);
      selecionarProximoPendente(data.produtos);
    } catch (e) {
      setDetalheErro(e instanceof Error ? e.message : 'Não foi possível abrir a conferência.');
    } finally {
      setDetalheLoading(false);
    }
  };

  const atualizarProduto = (idDocumento: number, produto: RecebimentoProdutoConferente) => {
    setDetalhe((atual) => {
      if (!atual || atual.idDocumento !== idDocumento) return atual;
      const next = {
        ...atual,
        produtos: atual.produtos.map((p) => (p.idItem === produto.idItem ? produto : p)),
      };
      detalheCacheRef.current.set(idDocumento, next);
      return next;
    });
  };

  const fecharAposRetornoMesa = (mensagem: string) => {
    if (modalDoc) {
      detalheCacheRef.current.delete(modalDoc.idDocumento);
      setPendencias((prev) => prev.filter((p) => p.idDocumento !== modalDoc.idDocumento));
    }
    setModalDoc(null);
    setDetalhe(null);
    setFeedbackMsg(mensagem);
    setFeedbackRetorno('ok');
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedbackRetorno('off');
      feedbackTimerRef.current = null;
    }, 1400);
  };

  const adicionar = async () => {
    if (!modalDoc || !itensCarregados || idItem === '') return;
    const qtdeNum = Number(String(qtde).replace(',', '.'));
    if (!Number.isFinite(qtdeNum) || qtdeNum <= 0) {
      setAcaoErro('Informe uma quantidade maior que zero.');
      setAcaoOk(null);
      return;
    }
    setSalvando(true);
    setAcaoErro(null);
    setAcaoOk(null);
    try {
      const r = await postRecebimentoDigitacaoItem({
        idDocumento: modalDoc.idDocumento,
        idItem,
        qtde: qtdeNum,
      });
      atualizarProduto(modalDoc.idDocumento, r.produto);
      setQtde('');
      if (r.retornouMesa) {
        fecharAposRetornoMesa('Divergência: conferência devolvida à Mesa');
        return;
      }
      setFeedbackRetorno('off');
      if (r.acertou) {
        setAcaoOk('Quantidade conferida.');
        const restantes = (detalhe?.produtos ?? []).map((p) =>
          p.idItem === r.produto.idItem ? r.produto : p
        );
        selecionarProximoPendente(restantes);
        qtdeRef.current?.focus();
      } else {
        const restam = r.tentativasRestantes;
        setAcaoErro(
          restam === 1
            ? 'Quantidade divergente. Última tentativa.'
            : `Quantidade divergente. Você tem ${restam} tentativa(s).`
        );
        qtdeRef.current?.focus();
      }
    } catch (e) {
      setFeedbackRetorno('off');
      setAcaoErro(e instanceof Error ? e.message : 'Não foi possível gravar a contagem.');
    } finally {
      setSalvando(false);
    }
  };

  const devolver = async () => {
    if (!modalDoc || !itensCarregados || !todosConferidos) return;
    setDevolviendo(true);
    setAcaoErro(null);
    setFeedbackRetorno('loading');
    try {
      await postRecebimentoDigitacaoDevolver(modalDoc.idDocumento);
      fecharAposRetornoMesa('Conferência devolvida à Mesa');
    } catch (e) {
      setFeedbackRetorno('off');
      setAcaoErro(e instanceof Error ? e.message : 'Não foi possível devolver à Mesa.');
    } finally {
      setDevolviendo(false);
    }
  };

  if (!pode) return <Navigate to="/sem-acesso" replace />;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2">
      <CarregandoInformacoesOverlay show={loading} mode="contained" />

      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Recebimento · Perfil Conferente
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-800 dark:text-slate-100">
            Digitação conferência
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Pendências deliberadas pela Mesa para você. Selecione o produto do documento, informe a quantidade
            física (às cegas, 3 chances) e devolva à Mesa.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
                    : pendencias.length === 0
                      ? 'Nenhuma conferência atribuída a você. Quando a Mesa deliberar, a pendência aparece aqui.'
                      : 'Nenhuma pendência com os filtros da grade.'}
                </td>
              </tr>
            ) : (
              filtrados.map((d) => (
                <tr
                  key={d.idDocumento}
                  className="cursor-pointer border-l-4 border-l-sky-500 hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  onClick={() => void abrirDetalhe(d)}
                >
                  <td className="px-3 py-2 font-mono font-medium">{d.numeroDocumentoFiscal ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{d.numeroNfe ?? '—'}</td>
                  <td className="px-3 py-2">{fmtDataBr(dataDocYmd(d))}</td>
                  <td className="max-w-[16rem] truncate px-3 py-2" title={d.nomeParceiro ?? undefined}>
                    {d.nomeParceiro ?? '—'}
                  </td>
                  <td className="px-3 py-2">{badgeStatus(d.status, d.statusLabel)}</td>
                  <td className="px-3 py-2">{fmtDateTimeBr(d.atribuidoEm)}</td>
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <GradeCelulaModalBtn
                      align="center"
                      title="Conferir documento"
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
        {pendencias.length === 0
          ? null
          : filtrados.length === pendencias.length
            ? `${pendencias.length} pendência${pendencias.length === 1 ? '' : 's'}`
            : `${filtrados.length} de ${pendencias.length} pendência${pendencias.length === 1 ? '' : 's'}`}
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
              className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-600">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Conferência {modalDoc.numeroDocumentoFiscal ?? modalDoc.idDocumento}
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

              <div className="relative min-h-[10rem] flex-1 overflow-auto p-4">
                <CarregandoInformacoesOverlay show={detalheLoading} mode="contained" />
                {detalheErro && (
                  <p className="mb-3 text-sm text-rose-600" role="alert">
                    {detalheErro}
                  </p>
                )}
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                  Selecione o produto do documento e informe a quantidade física. A quantidade da NF não aparece
                  nesta tela. Cada item tem 3 chances; na terceira divergência a conferência volta para a Mesa.
                </p>
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900">
                    <tr>
                      <th className="px-2 py-2">Código</th>
                      <th className="px-2 py-2">Material</th>
                      <th className="px-2 py-2">UM</th>
                      <th className="px-2 py-2">Andamento</th>
                      <th className="px-2 py-2 text-right">Qtde física</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {produtos.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-2 py-6 text-center text-slate-500">
                          {detalheLoading ? 'Carregando…' : 'Nenhum item neste documento.'}
                        </td>
                      </tr>
                    ) : (
                      produtos.map((it) => (
                        <tr key={it.idItem}>
                          <td className="px-2 py-2 font-mono font-medium">{it.codigoProduto ?? '—'}</td>
                          <td className="px-2 py-2 text-slate-700 dark:text-slate-200">
                            {it.descricaoProduto ?? '—'}
                          </td>
                          <td className="px-2 py-2">{it.unidadeMedida ?? '—'}</td>
                          <td className="px-2 py-2">
                            {it.conferido ? (
                              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                Conferido
                              </span>
                            ) : it.tentativasUsadas > 0 ? (
                              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                                Tentativa {it.tentativasUsadas} de {it.tentativasMax}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">Pendente</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {it.conferido && it.qtdeInformada != null ? nfNum.format(it.qtdeInformada) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div
                className={`space-y-3 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-600 dark:bg-slate-900/40 ${
                  !itensCarregados ? 'pointer-events-none opacity-50' : ''
                }`}
                aria-busy={detalheLoading}
              >
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Incluir contagem</p>
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void adicionar();
                  }}
                >
                  <div className="min-w-[16rem] flex-1">
                    <label className={labelClass}>Produto do documento</label>
                    <select
                      className={`${inputClass} w-full`}
                      value={idItem === '' ? '' : String(idItem)}
                      onChange={(e) => setIdItem(e.target.value ? Number(e.target.value) : '')}
                      disabled={!itensCarregados || salvando || devolviendo || pendentes.length === 0}
                    >
                      <option value="">Selecione…</option>
                      {pendentes.map((p) => (
                        <option key={p.idItem} value={p.idItem}>
                          {produtoLabel(p)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-32">
                    <label className={labelClass}>Qtde física</label>
                    <input
                      ref={qtdeRef}
                      className={`${inputClass} w-full`}
                      value={qtde}
                      onChange={(e) => setQtde(e.target.value)}
                      disabled={!itensCarregados || salvando || devolviendo || idItem === ''}
                      inputMode="decimal"
                    />
                  </div>
                  <button
                    type="submit"
                    className={btnPrimary}
                    disabled={!itensCarregados || salvando || devolviendo || idItem === ''}
                  >
                    Adicionar
                  </button>
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={!itensCarregados || salvando || devolviendo || !todosConferidos}
                    onClick={() => void devolver()}
                  >
                    Devolver à Mesa
                  </button>
                </form>
                {todosConferidos && (
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    Todos os itens conferidos. Devolva o documento à Mesa.
                  </p>
                )}
                {acaoOk && (
                  <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
                    {acaoOk}
                  </p>
                )}
                {acaoErro && (
                  <p className="text-sm text-rose-600" role="alert">
                    {acaoErro}
                  </p>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {feedbackRetorno !== 'off' &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[10100] flex items-center justify-center bg-slate-950/45 backdrop-blur-md"
            role="status"
            aria-live="polite"
            aria-busy={feedbackRetorno === 'loading'}
          >
            <div className="flex flex-col items-center gap-4 px-8 py-10">
              {feedbackRetorno === 'loading' ? (
                <LoaderCirculo tamanho={48} cores={['#FFAD00', '#9BA3E8']} className="shrink-0" />
              ) : (
                <CheckCircle2 className="h-12 w-12 text-emerald-400" aria-hidden />
              )}
              <p className="max-w-sm text-center text-sm font-medium tracking-tight text-white/90">
                {feedbackRetorno === 'loading' ? 'Carregando...' : feedbackMsg}
              </p>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
