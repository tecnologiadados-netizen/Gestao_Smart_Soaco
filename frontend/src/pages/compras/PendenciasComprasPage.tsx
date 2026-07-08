import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import ModalPcPendDetalhes from '../../components/ressupAlmox/ModalPcPendDetalhes';
import GradeCelulaModalBtn from '../../components/pcp/GradeCelulaModalBtn';
import ModalConsultaEstoqueDetalhe, { fmtQtde } from '../../components/pcp/ModalConsultaEstoqueDetalhe';
import TabelaDetalheSolicitacao from '../../components/pcp/TabelaDetalheSolicitacao';
import TabelaDetalheCotacao from '../../components/pcp/TabelaDetalheCotacao';
import SingleSelectWithSearch, { type OptionItem } from '../../components/SingleSelectWithSearch';
import {
  consultarPendenciasCompras,
  listarCompradoresPendencias,
  removerPrioridadeFixaPendencias,
  salvarPrioridadeFixaPendencias,
  type PendenciasComprasLinha,
} from '../../api/pendenciasCompras';
import {
  obterCotacaoDetalhe,
  obterSaldoDetalhe,
  obterScDetalhe,
  type CotacaoDetalhe,
  type SaldoSetorDetalhe,
  type ScDetalhe,
} from '../../api/consultaEstoque';
import type { RessupAlmoxPcPendLinha } from '../../api/compras';
import {
  ESTOQUE_VERIFICAR_PCP_TEXTO,
  LEGENDA_PENDENCIAS,
  classeDestaqueAgPag,
  classeDestaqueCodigo,
  classeDestaquePc,
} from '../../utils/pendenciasComprasDestaques';
import { downloadPendenciasComprasPdf } from '../../utils/exportPendenciasComprasPdf';
import PendenciasPdfGeneratingOverlay from '../../components/compras/PendenciasPdfGeneratingOverlay';
import PrioridadeFixaSelect from '../../components/compras/PrioridadeFixaSelect';
import {
  anexarPrioridadeFixaNasLinhas,
  aplicarPrioridadesFixasPendenciasCompras,
  opcoesPrioridadeGrupo,
  prioridadesFixasDeLinhas,
} from '../../utils/pendenciasComprasOrdenacao';

const COLS = [
  { key: 'codigo', label: 'Cód', clickable: false, align: 'left' as const },
  { key: 'descricao', label: 'Descrição', clickable: false, align: 'left' as const },
  { key: 'dataEmissao', label: 'Emissão da SC', clickable: false, align: 'center' as const },
  { key: 'dataNecessidade', label: 'Necessidade da SC', clickable: false, align: 'center' as const },
  { key: 'solicitacao', label: 'Solicitação', clickable: true as const, align: 'center' as const },
  { key: 'agPag', label: 'Ag Pag', clickable: true as const, align: 'center' as const },
  { key: 'pedidoCompra', label: 'PC', clickable: true as const, align: 'center' as const },
  { key: 'estoqueAtual', label: 'Estoque Atual', clickable: true as const, align: 'center' as const },
] as const;

const COL_PRIORIDADE_FIXA = { key: 'prioridadeFixa', label: 'Prioridade Fixa', align: 'center' as const };

type ColKey = (typeof COLS)[number]['key'];
const COL_KEYS: ColKey[] = COLS.map((c) => c.key);
const NUM_KEYS = ['solicitacao', 'agPag', 'pedidoCompra', 'estoqueAtual'] as const;

const BTN_PRIMARY =
  'inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50';

const BTN_PDF =
  'inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-red-700 bg-red-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 hover:border-red-800 disabled:opacity-50 disabled:hover:bg-red-600';

const labelClass = 'text-sm font-medium text-slate-700 dark:text-slate-300';
const inputClass =
  'rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100';

type DetalheModal =
  | { tipo: 'saldo'; linha: PendenciasComprasLinha }
  | { tipo: 'solicitacao'; linha: PendenciasComprasLinha }
  | { tipo: 'cotacao'; linha: PendenciasComprasLinha }
  | { tipo: 'pc'; linha: PendenciasComprasLinha };

type DetalheCachePayload = SaldoSetorDetalhe[] | ScDetalhe[] | CotacaoDetalhe[] | RessupAlmoxPcPendLinha[];

function detalheModalCacheKey(tipo: Exclude<DetalheModal['tipo'], 'pc'>, idProduto: number): string {
  return `${tipo}-${idProduto}`;
}

export default function PendenciasComprasPage() {
  const [compradores, setCompradores] = useState<string[]>([]);
  const [comprador, setComprador] = useState<OptionItem | null>(null);
  const [linhas, setLinhas] = useState<PendenciasComprasLinha[]>([]);
  const [loading, setLoading] = useState(false);
  const [erroApi, setErroApi] = useState<string | null>(null);
  const [consultaRealizada, setConsultaRealizada] = useState(false);
  const [detalhe, setDetalhe] = useState<DetalheModal | null>(null);
  const [detalheSaldo, setDetalheSaldo] = useState<SaldoSetorDetalhe[]>([]);
  const [detalheSc, setDetalheSc] = useState<ScDetalhe[]>([]);
  const [detalheCotacao, setDetalheCotacao] = useState<CotacaoDetalhe[]>([]);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [salvandoPrioridadeId, setSalvandoPrioridadeId] = useState<number | null>(null);
  const detalheCacheRef = useRef(new Map<string, DetalheCachePayload>());
  const pcCacheRef = useRef(new Map<number, RessupAlmoxPcPendLinha[]>());
  const ajudaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ajudaAberta) return;
    const handler = (e: MouseEvent) => {
      if (ajudaRef.current && !ajudaRef.current.contains(e.target as Node)) {
        setAjudaAberta(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ajudaAberta]);

  const compradorOptions = useMemo<OptionItem[]>(
    () =>
      compradores.map((nome, i) => ({
        id: i + 1,
        nome,
        uniqueKey: `comprador-${nome}`,
      })),
    [compradores]
  );

  useEffect(() => {
    void listarCompradoresPendencias()
      .then(setCompradores)
      .catch(() => setCompradores([]));
  }, []);

  const getCellText = useCallback((row: PendenciasComprasLinha, key: string): string => {
    if (key === 'dataEmissao') return row.dataEmissao ?? '—';
    if (key === 'dataNecessidade') return row.dataNecessidade ?? '—';
    if (key === 'estoqueAtual' && row.estoqueVerificarPcp) return ESTOQUE_VERIFICAR_PCP_TEXTO;
    const val = row[key as keyof PendenciasComprasLinha];
    if (typeof val === 'number') return fmtQtde(val);
    return String(val ?? '');
  }, []);

  const valueForSort = useCallback((row: PendenciasComprasLinha, key: string): string | number => {
    if (key === 'estoqueAtual' && row.estoqueVerificarPcp) return ESTOQUE_VERIFICAR_PCP_TEXTO;
    if (NUM_KEYS.includes(key as (typeof NUM_KEYS)[number])) {
      return row[key as (typeof NUM_KEYS)[number]];
    }
    return getCellText(row, key);
  }, [getCellText]);

  const grade = useGradeFiltrosExcel({
    rows: linhas,
    columnIds: COL_KEYS,
    getCellText,
    valueForSort,
  });

  const opcoesGrupoPrioridade = useMemo(() => opcoesPrioridadeGrupo(linhas), [linhas]);

  const reordenarComPrioridades = useCallback(
    (linhasAtuais: PendenciasComprasLinha[], prioridades: Map<number, number>) => {
      const ordemAuto = [...linhasAtuais].sort(
        (a, b) => a.indiceOrdemAutomatica - b.indiceOrdemAutomatica
      );
      const reordenadas = aplicarPrioridadesFixasPendenciasCompras(ordemAuto, prioridades);
      return anexarPrioridadeFixaNasLinhas(reordenadas, prioridades);
    },
    []
  );

  const handlePrioridadeFixaChange = useCallback(
    async (row: PendenciasComprasLinha, valor: string) => {
      if (!comprador?.nome) return;

      const prioridadesAtuais = prioridadesFixasDeLinhas(linhas);

      if (valor === '') {
        prioridadesAtuais.delete(row.idProduto);
      } else {
        const prioridade = Number(valor);
        const maxGrupo = opcoesGrupoPrioridade.at(-1) ?? 0;
        if (!Number.isInteger(prioridade) || prioridade < 1 || prioridade > maxGrupo) return;
        prioridadesAtuais.set(row.idProduto, prioridade);
      }

      setSalvandoPrioridadeId(row.idProduto);
      setErroApi(null);

      const r =
        valor === ''
          ? await removerPrioridadeFixaPendencias({
              comprador: comprador.nome,
              idProduto: row.idProduto,
            })
          : await salvarPrioridadeFixaPendencias({
              comprador: comprador.nome,
              idProduto: row.idProduto,
              prioridade: Number(valor),
            });

      setSalvandoPrioridadeId(null);

      if (r.error) {
        setErroApi(r.error);
        return;
      }

      setLinhas(reordenarComPrioridades(linhas, prioridadesAtuais));
    },
    [comprador?.nome, linhas, opcoesGrupoPrioridade, reordenarComPrioridades]
  );

  const handlePrioridadeFixaSelect = useCallback(
    (row: PendenciasComprasLinha, prioridade: number | null) => {
      void handlePrioridadeFixaChange(row, prioridade == null ? '' : String(prioridade));
    },
    [handlePrioridadeFixaChange]
  );

  const executarConsulta = useCallback(async (compradorNome: string) => {
    setLoading(true);
    setErroApi(null);
    detalheCacheRef.current.clear();
    pcCacheRef.current.clear();
    setDetalhe(null);
    try {
      const r = await consultarPendenciasCompras(compradorNome);
      if (r.error) {
        setErroApi(r.error);
        setLinhas([]);
      } else {
        setLinhas(r.linhas);
      }
      setConsultaRealizada(true);
      grade.limparFiltrosGrade();
    } finally {
      setLoading(false);
    }
  }, [grade]);

  const handleFiltrar = () => {
    if (!comprador?.nome) {
      setErroApi('Selecione o comprador.');
      return;
    }
    void executarConsulta(comprador.nome);
  };

  const handleExportarPdf = useCallback(async () => {
    if (!comprador?.nome || grade.rowsExibidas.length === 0 || gerandoPdf) return;
    setGerandoPdf(true);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    try {
      await downloadPendenciasComprasPdf({
        comprador: comprador.nome,
        linhas: grade.rowsExibidas.map((row) => ({
          codigo: row.codigo,
          descricao: row.descricao,
          dataEmissao: getCellText(row, 'dataEmissao'),
          dataNecessidade: getCellText(row, 'dataNecessidade'),
          solicitacao: getCellText(row, 'solicitacao'),
          agPag: getCellText(row, 'agPag'),
          pedidoCompra: getCellText(row, 'pedidoCompra'),
          estoqueAtual: getCellText(row, 'estoqueAtual'),
          prioridadeFixa:
            row.prioridadeFixa != null ? String(row.prioridadeFixa) : '—',
          destaques: row.destaques,
        })),
      });
    } finally {
      setGerandoPdf(false);
    }
  }, [comprador?.nome, gerandoPdf, grade.rowsExibidas, getCellText]);

  const carregarDetalheModal = useCallback(async (): Promise<{ error?: string }> => {
    if (!detalhe || detalhe.tipo === 'pc') return {};
    const id = detalhe.linha.idProduto;
    const cacheKey = detalheModalCacheKey(detalhe.tipo, id);
    const cached = detalheCacheRef.current.get(cacheKey);
    if (cached) {
      if (detalhe.tipo === 'saldo') setDetalheSaldo(cached as SaldoSetorDetalhe[]);
      else if (detalhe.tipo === 'solicitacao') setDetalheSc(cached as ScDetalhe[]);
      else setDetalheCotacao(cached as CotacaoDetalhe[]);
      return {};
    }
    if (detalhe.tipo === 'saldo') {
      const r = await obterSaldoDetalhe(id);
      if (!r.error) detalheCacheRef.current.set(cacheKey, r.data);
      setDetalheSaldo(r.data);
      return { error: r.error };
    }
    if (detalhe.tipo === 'solicitacao') {
      const r = await obterScDetalhe(id);
      if (!r.error) detalheCacheRef.current.set(cacheKey, r.data);
      setDetalheSc(r.data);
      return { error: r.error };
    }
    const r = await obterCotacaoDetalhe(id);
    if (!r.error) detalheCacheRef.current.set(cacheKey, r.data);
    setDetalheCotacao(r.data);
    return { error: r.error };
  }, [detalhe]);

  const detailKey =
    detalhe && detalhe.tipo !== 'pc'
      ? detalheModalCacheKey(detalhe.tipo, detalhe.linha.idProduto)
      : null;

  const cellNum = (n: number) => fmtQtde(n);

  return (
    <div className="relative flex flex-1 min-h-0 flex-col gap-3 overflow-hidden p-3 md:p-4">
      {gerandoPdf && (
        <PendenciasPdfGeneratingOverlay
          mensagem="Gerando relatório PDF…"
          subtitulo={comprador?.nome ? `Comprador: ${comprador.nome}` : undefined}
        />
      )}
      <CarregandoInformacoesOverlay
        show={loading}
        mensagem="Consultando pendências no Nomus…"
        mode="contained"
      />

      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Pendências compras</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Produtos com solicitações ou Ag Pag em aberto, por comprador.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            className={BTN_PDF}
            disabled={loading || gerandoPdf || !consultaRealizada || grade.rowsExibidas.length === 0}
            onClick={() => void handleExportarPdf()}
            title="Emitir relatório PDF em paisagem"
            aria-label="Emitir relatório PDF"
          >
            <FileText className="size-4 shrink-0" aria-hidden />
            PDF
          </button>
          <div className="w-64">
            <SingleSelectWithSearch
              label="Comprador"
              placeholder="Selecione o comprador…"
              options={compradorOptions}
              value={comprador}
              onChange={setComprador}
              labelClass={labelClass}
              inputClass={inputClass}
              minWidth="100%"
              listMaxHeight="280px"
              clearable
            />
          </div>
          <div className="relative" ref={ajudaRef}>
            <button
              type="button"
              onClick={() => setAjudaAberta((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              title="Legenda das cores"
              aria-label="Ajuda — legenda das cores"
              aria-expanded={ajudaAberta}
            >
              ?
            </button>
            {ajudaAberta && (
              <div className="absolute right-0 top-full z-[80] mt-1 w-[26rem] max-w-[90vw] rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-xl dark:border-slate-600 dark:bg-slate-800">
                <p className="mb-2 font-medium text-slate-700 dark:text-slate-200">Legenda das cores</p>
                <ul className="grid gap-1.5">
                  {LEGENDA_PENDENCIAS.map((item) => (
                    <li key={item.texto} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span className={`inline-block h-4 w-8 shrink-0 rounded border border-slate-300/60 ${item.classe}`} />
                      <span>
                        <strong>{item.coluna}:</strong> {item.texto}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <button type="button" className={BTN_PRIMARY} disabled={loading} onClick={handleFiltrar}>
            Filtrar
          </button>
        </div>
      </div>

      {erroApi && (
        <p className="shrink-0 text-sm text-red-600 dark:text-red-300" role="alert">
          {erroApi}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600">
        {consultaRealizada && (
          <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
            {grade.rowsExibidas.length} de {linhas.length} produto(s)
            {comprador ? (
              <>
                {' '}
                — comprador: <strong>{comprador.nome}</strong>
              </>
            ) : null}
          </div>
        )}

        <div ref={grade.tableScrollRef} className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1040px] border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-primary-600 text-white">
                {COLS.map((c) => {
                  const sortAtivo =
                    grade.sortState?.key === c.key || grade.sortLevels.some((l) => l.id === c.key);
                  return (
                    <th
                      key={c.key}
                      className={`relative border border-primary-500/40 bg-primary-600 px-2 py-2 font-semibold ${
                        c.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      <div
                        className={`flex items-center gap-1 ${
                          c.align === 'center' ? 'justify-center' : 'justify-between'
                        }`}
                      >
                        <span>{c.label}</span>
                        <GradeFiltroCabecalhoBtn
                          ativo={grade.colunaComFiltroAtivo(c.key) || sortAtivo}
                          onClick={(e) => grade.abrirFiltroExcel(c.key, e)}
                        />
                      </div>
                    </th>
                  );
                })}
                <th
                  className={`border border-primary-500/40 bg-primary-600 px-2 py-2 font-semibold ${
                    COL_PRIORIDADE_FIXA.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {COL_PRIORIDADE_FIXA.label}
                </th>
              </tr>
            </thead>
            <tbody>
              {!consultaRealizada && (
                <tr>
                  <td colSpan={COLS.length + 1} className="py-12 text-center text-slate-500">
                    Selecione o comprador e clique em Filtrar.
                  </td>
                </tr>
              )}
              {consultaRealizada && linhas.length === 0 && !loading && (
                <tr>
                  <td colSpan={COLS.length + 1} className="py-8 text-center text-slate-500">
                    Nenhuma pendência encontrada para este comprador.
                  </td>
                </tr>
              )}
              {consultaRealizada &&
                grade.rowsExibidas.map((row) => (
                  <tr
                    key={row.idProduto}
                    className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
                  >
                    <td className={`px-2 py-1.5 font-mono ${classeDestaqueCodigo(row.destaques)}`}>
                      {row.codigo}
                    </td>
                    <td className="px-2 py-1.5 max-w-[280px] truncate" title={row.descricao}>
                      {row.descricao}
                    </td>
                    <td className="px-2 py-1.5 text-center">{row.dataEmissao ?? '—'}</td>
                    <td className="px-2 py-1.5 text-center">{row.dataNecessidade ?? '—'}</td>
                    {NUM_KEYS.map((k) => {
                      const val = row[k];
                      const destaqueClass =
                        k === 'agPag'
                          ? classeDestaqueAgPag(row.destaques)
                          : k === 'pedidoCompra'
                            ? classeDestaquePc(row.destaques)
                            : '';
                      const modalTipo =
                        k === 'solicitacao'
                          ? 'solicitacao'
                          : k === 'agPag'
                            ? 'cotacao'
                            : k === 'pedidoCompra'
                              ? 'pc'
                              : 'saldo';
                      const estoqueVerificarPcp = k === 'estoqueAtual' && row.estoqueVerificarPcp;
                      return (
                        <td
                          key={k}
                          className={`px-2 py-1.5 text-center tabular-nums ${destaqueClass}`}
                        >
                          <GradeCelulaModalBtn
                            onClick={() =>
                              setDetalhe({
                                tipo: modalTipo,
                                linha: row,
                              })
                            }
                          >
                            {estoqueVerificarPcp ? (
                              <span className="whitespace-nowrap text-[10px] font-normal italic text-white">
                                {ESTOQUE_VERIFICAR_PCP_TEXTO}
                              </span>
                            ) : (
                              cellNum(val)
                            )}
                          </GradeCelulaModalBtn>
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-center">
                      <PrioridadeFixaSelect
                        value={row.prioridadeFixa}
                        opcoesGrupo={opcoesGrupoPrioridade}
                        disabled={salvandoPrioridadeId === row.idProduto}
                        onChange={(prioridade) => handlePrioridadeFixaSelect(row, prioridade)}
                        ariaLabel={`Prioridade fixa de ${row.codigo}`}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {grade.colunaFiltroAberta && grade.filtroAbertoRect && (
        <GradeFiltroExcelPortal
          colunaAberta={grade.colunaFiltroAberta}
          rect={grade.filtroAbertoRect}
          dropdownRef={grade.filtroDropdownRef}
          excelFilterDrafts={grade.excelFilterDrafts}
          setExcelFilterDrafts={grade.setExcelFilterDrafts}
          valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
          showNumericFilters={NUM_KEYS.includes(
            grade.colunaFiltroAberta as (typeof NUM_KEYS)[number]
          )}
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
        />
      )}

      <ModalConsultaEstoqueDetalhe
        open={detalhe != null && detalhe.tipo !== 'pc'}
        detailKey={detailKey}
        titulo={
          detalhe?.tipo === 'saldo'
            ? `Estoque — ${detalhe.linha.codigo}`
            : detalhe?.tipo === 'solicitacao'
              ? `Solicitação — ${detalhe.linha.codigo}`
              : detalhe?.tipo === 'cotacao'
                ? `Ag Pag — ${detalhe.linha.codigo}`
                : ''
        }
        subtitulo={detalhe?.linha.descricao ?? ''}
        onClose={() => setDetalhe(null)}
        onLoad={carregarDetalheModal}
      >
        {({ carregando, erro }) => {
          if (carregando) return <p className="text-slate-500">Carregando…</p>;
          if (erro) return <p className="text-red-600">{erro}</p>;
          if (!detalhe || detalhe.tipo === 'pc') return null;
          if (detalhe.tipo === 'saldo') {
            if (detalheSaldo.length === 0) {
              return (
                <>
                  {detalhe.linha.estoqueVerificarPcp ? (
                    <p className="mb-3 text-xs text-slate-600 dark:text-slate-300">
                      O estoque padrão deste item não é o almox secundário. Consulte o PCP para o
                      saldo correto.
                    </p>
                  ) : null}
                  <p className="text-slate-500">Sem saldo nos setores aplicáveis.</p>
                </>
              );
            }
            return (
              <>
                {detalhe.linha.estoqueVerificarPcp ? (
                  <p className="mb-3 text-xs text-slate-600 dark:text-slate-300">
                    O estoque padrão deste item não é o almox secundário. Consulte o PCP para o
                    saldo correto. Detalhe por setor abaixo:
                  </p>
                ) : null}
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50 dark:bg-slate-900/50">
                      <th className="py-2 text-left">Setor</th>
                      <th className="py-2 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalheSaldo.map((s) => (
                      <tr key={s.idSetor} className="border-b border-slate-100 dark:border-slate-700">
                        <td className="py-1.5">{s.setor}</td>
                        <td className="py-1.5 text-right tabular-nums">{fmtQtde(s.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            );
          }
          if (detalhe.tipo === 'solicitacao') {
            return <TabelaDetalheSolicitacao linhas={detalheSc} />;
          }
          return <TabelaDetalheCotacao linhas={detalheCotacao} />;
        }}
      </ModalConsultaEstoqueDetalhe>

      <ModalPcPendDetalhes
        open={detalhe?.tipo === 'pc'}
        idProduto={detalhe?.tipo === 'pc' ? detalhe.linha.idProduto : null}
        codigo={detalhe?.tipo === 'pc' ? detalhe.linha.codigo : ''}
        descricao={detalhe?.tipo === 'pc' ? detalhe.linha.descricao : ''}
        onClose={() => setDetalhe(null)}
        cacheRef={pcCacheRef}
      />
    </div>
  );
}
