import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CarregandoInformacoesOverlay from '../CarregandoInformacoesOverlay';
import GradeFiltroCabecalhoBtn from '../grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../grade/GradeFiltroExcelPortal';
import GradeCelulaModalBtn from './GradeCelulaModalBtn';
import ModalConsultaEstoqueDetalhe, { fmtQtde } from './ModalConsultaEstoqueDetalhe';
import EmpenhoLiquidoPainel from '../ressupAlmox/EmpenhoLiquidoPainel';
import RotuloComDica from '../ressupAlmox/RotuloComDica';
import { DICA_EMPENHO_LIQ_GRADE } from '../ressupAlmox/empenhoModalUtils';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import {
  consultarEstoque,
  obterSaldoDetalhe,
  type ConsultaEstoqueLinha,
  type SaldoSetorDetalhe,
} from '../../api/consultaEstoque';
import { obterRessupEmpenhoPorPedido, type RessupEmpenhoPedidoResultado } from '../../api/compras';
import { SETOR_ALMOX_SECUNDARIO } from '../../utils/ressupNaoAlmoxColetas';
import {
  getOrderLabelsForConsultaEstoqueCol,
  isConsultaEstoqueColNumeric,
  SORT_DEFAULT_CONSULTA_ESTOQUE,
} from '../../utils/consultaEstoqueGradeSort';

const COLS = [
  { key: 'codigo', label: 'Código', align: 'left' as const },
  { key: 'descricao', label: 'Descrição', align: 'left' as const },
  { key: 'und', label: 'Und', align: 'left' as const },
  { key: 'empenho', label: 'Empenho', align: 'center' as const, clickable: true },
  { key: 'saldo', label: 'Estoque atual', align: 'center' as const, clickable: true },
  { key: 'saldoProjetado', label: 'Saldo projetado', align: 'center' as const, clickable: false },
] as const;

type ColKey = (typeof COLS)[number]['key'];
const COL_KEYS: ColKey[] = COLS.map((c) => c.key);
const NUM_KEYS = ['empenho', 'saldo', 'saldoProjetado'] as const;

const SALDO_PROJETADO_NEG_CLASS = 'bg-red-50 dark:bg-red-950/40';
const Z_MAIN_DEFAULT = 132;

type DetalheModal =
  | { tipo: 'saldo'; linha: ConsultaEstoqueLinha }
  | { tipo: 'empenho'; linha: ConsultaEstoqueLinha };

type DetalheCachePayload = SaldoSetorDetalhe[] | RessupEmpenhoPedidoResultado;

function detalheModalCacheKey(
  tipo: DetalheModal['tipo'],
  idProduto: number,
  considerarRequisicoes: boolean
): string {
  return `${tipo}-${idProduto}-${considerarRequisicoes ? '1' : '0'}`;
}

type Props = {
  codigo: string;
  onClose: () => void;
  /** Base de empilhamento (padrão 132). Use valor maior quando aberto sobre outro modal alto. */
  zIndexBase?: number;
};

export default function ModalConsultaEstoqueEmbed({ codigo, onClose, zIndexBase = Z_MAIN_DEFAULT }: Props) {
  const zMain = zIndexBase;
  const zDetalhe = zIndexBase + 1;
  const [linhas, setLinhas] = useState<ConsultaEstoqueLinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroApi, setErroApi] = useState<string | null>(null);
  const [considerarRequisicoes, setConsiderarRequisicoes] = useState(false);
  const [detalhe, setDetalhe] = useState<DetalheModal | null>(null);
  const [detalheSaldo, setDetalheSaldo] = useState<SaldoSetorDetalhe[]>([]);
  const [detalheEmpenhoLiquido, setDetalheEmpenhoLiquido] = useState<RessupEmpenhoPedidoResultado | null>(
    null
  );

  const detalheCacheRef = useRef(new Map<string, DetalheCachePayload>());
  const considerarRef = useRef(considerarRequisicoes);
  considerarRef.current = considerarRequisicoes;

  const getCellText = useCallback((row: ConsultaEstoqueLinha, colId: string): string => {
    switch (colId) {
      case 'codigo':
        return row.codigo;
      case 'descricao':
        return row.descricao;
      case 'und':
        return row.unidadeMedida || '—';
      case 'empenho':
        return fmtQtde(row.empenho);
      case 'saldo':
        return fmtQtde(row.saldo);
      case 'saldoProjetado':
        return fmtQtde(row.saldoProjetado);
      default:
        return '—';
    }
  }, []);

  const valueForSort = useCallback(
    (row: ConsultaEstoqueLinha, colId: string): string | number => {
      if (isConsultaEstoqueColNumeric(colId)) {
        const v = row[colId as keyof ConsultaEstoqueLinha];
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : NaN;
      }
      if (colId === 'und') return row.unidadeMedida || '';
      return getCellText(row, colId);
    },
    [getCellText]
  );

  const grade = useGradeFiltrosExcel({
    rows: linhas,
    columnIds: COL_KEYS,
    getCellText,
    valueForSort,
    defaultSortLevels: SORT_DEFAULT_CONSULTA_ESTOQUE,
  });

  const carregarConsulta = useCallback(async (req: boolean) => {
    detalheCacheRef.current.clear();
    setDetalhe(null);
    setLoading(true);
    setErroApi(null);
    const r = await consultarEstoque({
      filtros: { codigos: [codigo.trim()] },
      considerarRequisicoes: req,
      confirmLarge: true,
    });
    setLoading(false);
    if (r.error) {
      setErroApi(r.error);
      setLinhas([]);
      return;
    }
    setLinhas(r.data);
  }, [codigo]);

  useEffect(() => {
    void carregarConsulta(considerarRequisicoes);
  }, [carregarConsulta, considerarRequisicoes]);

  const detailKey =
    detalhe != null
      ? detalheModalCacheKey(detalhe.tipo, detalhe.linha.idProduto, considerarRequisicoes)
      : null;

  const carregarDetalheModal = useCallback(async (): Promise<{ error?: string }> => {
    if (!detalhe) return {};
    const id = detalhe.linha.idProduto;
    const cacheKey = detalheModalCacheKey(detalhe.tipo, id, considerarRef.current);
    const cached = detalheCacheRef.current.get(cacheKey);
    if (cached) {
      if (detalhe.tipo === 'saldo') setDetalheSaldo(cached as SaldoSetorDetalhe[]);
      else setDetalheEmpenhoLiquido(cached as RessupEmpenhoPedidoResultado);
      return {};
    }
    if (detalhe.tipo === 'saldo') {
      const r = await obterSaldoDetalhe(id);
      if (!r.error) detalheCacheRef.current.set(cacheKey, r.data);
      setDetalheSaldo(r.data);
      return { error: r.error };
    }
    const rLiquido = await obterRessupEmpenhoPorPedido(id, considerarRef.current, false);
    if (!rLiquido.error && rLiquido.data) detalheCacheRef.current.set(cacheKey, rLiquido.data);
    setDetalheEmpenhoLiquido(rLiquido.data);
    return { error: rLiquido.error };
  }, [detalhe]);

  useEffect(() => {
    if (!detalhe) {
      setDetalheSaldo([]);
      setDetalheEmpenhoLiquido(null);
    }
  }, [detalhe]);

  const handleEscapeMain = () => {
    if (grade.colunaFiltroAberta) {
      grade.fecharFiltroExcel();
      return;
    }
    if (detalhe) {
      setDetalhe(null);
      return;
    }
    onClose();
  };

  useRegisterModalEscape({
    id: 'consulta-estoque-embed',
    onClose: handleEscapeMain,
    zIndex: zMain,
    enabled: !detalhe,
  });

  const cellNum = (n: number) => fmtQtde(n);

  const conteudo = (
    <>
      <CarregandoInformacoesOverlay show={loading} mensagem="Consultando estoque no Nomus…" mode="contained" />

      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Consulta de estoque — {codigo}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Visualização em tempo real. Clique em Empenho ou Estoque para detalhar.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700"
          aria-label="Voltar"
        >
          ×
        </button>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2 text-xs dark:border-slate-600">
        <label className="inline-flex cursor-pointer items-center gap-2 text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={considerarRequisicoes}
            onChange={(e) => setConsiderarRequisicoes(e.target.checked)}
            className="rounded border-slate-300"
          />
          Considerar requisições de loja no empenho
        </label>
        {linhas.length > 0 && (
          <span className="tabular-nums text-slate-500 dark:text-slate-400">
            {grade.rowsExibidas.length === linhas.length
              ? `${linhas.length} produto${linhas.length === 1 ? '' : 's'}`
              : `${grade.rowsExibidas.length} de ${linhas.length}`}
          </span>
        )}
      </div>

      {erroApi && (
        <p className="shrink-0 px-4 py-2 text-sm text-red-600 dark:text-red-300" role="alert">
          {erroApi}
        </p>
      )}

      <div ref={grade.tableScrollRef} className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[640px] border-collapse text-xs">
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
                      className={`flex min-w-0 items-start gap-1 ${
                        c.align === 'center' ? 'justify-center' : 'justify-between'
                      }`}
                    >
                      <span className="min-w-0 flex-1 leading-tight">
                        {c.key === 'empenho' ? (
                          <span className="inline-flex justify-center">
                            <RotuloComDica rotulo={c.label} dica={DICA_EMPENHO_LIQ_GRADE} headerClaro />
                          </span>
                        ) : (
                          c.label
                        )}
                      </span>
                      <GradeFiltroCabecalhoBtn
                        ativo={grade.colunaComFiltroAtivo(c.key) || sortAtivo}
                        onClick={(e) => grade.abrirFiltroExcel(c.key, e)}
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {!loading && linhas.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="py-8 text-center text-slate-500">
                  Nenhum produto encontrado para o código informado.
                </td>
              </tr>
            )}
            {linhas.length > 0 && grade.rowsExibidas.length === 0 && !loading && (
              <tr>
                <td colSpan={COLS.length} className="py-8 text-center text-slate-500">
                  Nenhum produto com os filtros da grade.
                </td>
              </tr>
            )}
            {grade.rowsExibidas.map((row) => (
              <tr
                key={row.idProduto}
                className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
              >
                <td className="px-2 py-1.5 font-mono">{row.codigo}</td>
                <td className="max-w-[240px] truncate px-2 py-1.5" title={row.descricao}>
                  {row.descricao}
                </td>
                <td className="px-2 py-1.5">{row.unidadeMedida || '—'}</td>
                {NUM_KEYS.map((k) => {
                  const clickable = k === 'empenho' || k === 'saldo';
                  const val = row[k];
                  const saldoNegativo = k === 'saldoProjetado' && val <= 0;
                  return (
                    <td
                      key={k}
                      className={`px-2 py-1.5 text-center tabular-nums ${
                        saldoNegativo ? SALDO_PROJETADO_NEG_CLASS : ''
                      }`}
                    >
                      {clickable ? (
                        <GradeCelulaModalBtn onClick={() => setDetalhe({ tipo: k, linha: row })}>
                          {cellNum(val)}
                        </GradeCelulaModalBtn>
                      ) : (
                        <span className="font-medium">{cellNum(val)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {grade.colunaFiltroAberta && grade.filtroAbertoRect && (
        <GradeFiltroExcelPortal
          colunaAberta={grade.colunaFiltroAberta}
          rect={grade.filtroAbertoRect}
          dropdownRef={grade.filtroDropdownRef}
          excelFilterDrafts={grade.excelFilterDrafts}
          setExcelFilterDrafts={grade.setExcelFilterDrafts}
          valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
          sortAscLabel={getOrderLabelsForConsultaEstoqueCol(grade.colunaFiltroAberta).asc}
          sortDescLabel={getOrderLabelsForConsultaEstoqueCol(grade.colunaFiltroAberta).desc}
          showNumericFilters={isConsultaEstoqueColNumeric(grade.colunaFiltroAberta)}
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

      <div className="flex shrink-0 justify-end border-t border-slate-200 px-4 py-3 dark:border-slate-600">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Voltar
        </button>
      </div>

      {detalhe && (
        <ModalConsultaEstoqueDetalhe
          open
          backdropMode="fixed"
          zIndex={zDetalhe}
          rotuloFechar="Voltar"
          titulo={
            detalhe.tipo === 'saldo'
              ? `Estoque atual — ${detalhe.linha.codigo}`
              : `Empenho — ${detalhe.linha.codigo}`
          }
          subtitulo={detalhe.linha.descricao}
          onClose={() => setDetalhe(null)}
          detailKey={detailKey}
          onLoad={carregarDetalheModal}
          largo={detalhe.tipo === 'empenho'}
        >
          {({ carregando, erro }) => {
            if (carregando) return <p className="py-6 text-center text-slate-500">Carregando…</p>;
            if (erro) return <p className="text-red-600">{erro}</p>;
            if (detalhe.tipo === 'saldo') {
              if (detalheSaldo.length === 0) {
                return <p className="text-slate-500">Sem saldo nos setores aplicáveis.</p>;
              }
              const saldoSetor2 = detalheSaldo
                .filter((s) => s.idSetor === SETOR_ALMOX_SECUNDARIO)
                .reduce((acc, s) => acc + s.saldo, 0);
              const saldoMpp = detalheSaldo
                .filter((s) => s.idSetor !== SETOR_ALMOX_SECUNDARIO)
                .reduce((acc, s) => acc + s.saldo, 0);
              const destacarAlmoxSec = saldoSetor2 > 0;
              const totalSaldo = detalhe.linha.saldo;
              return (
                <>
                  <div
                    className={`mb-3 grid gap-2 ${
                      destacarAlmoxSec ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'
                    }`}
                  >
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900/40">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Estoque MPP</div>
                      <div className="text-sm font-medium tabular-nums">{fmtQtde(saldoMpp)}</div>
                    </div>
                    {destacarAlmoxSec && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50/90 px-3 py-2 dark:border-amber-700 dark:bg-amber-900/25">
                        <div className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                          Almox secundário
                        </div>
                        <div className="text-sm font-semibold tabular-nums text-amber-900 dark:text-amber-100">
                          {fmtQtde(saldoSetor2)}
                        </div>
                      </div>
                    )}
                    <div className="rounded-lg border border-primary-200 bg-primary-50/80 px-3 py-2 dark:border-primary-800 dark:bg-primary-900/30">
                      <div className="text-[11px] font-medium text-primary-700 dark:text-primary-300">
                        Total
                      </div>
                      <div className="text-sm font-semibold tabular-nums">{fmtQtde(totalSaldo)}</div>
                    </div>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-slate-50 dark:bg-slate-900/50">
                        <th className="py-2 text-left">Setor</th>
                        <th className="py-2 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalheSaldo.map((s) => (
                        <tr
                          key={s.idSetor}
                          className={`border-b border-slate-100 dark:border-slate-700 ${
                            s.idSetor === SETOR_ALMOX_SECUNDARIO
                              ? 'bg-amber-50/60 dark:bg-amber-900/15'
                              : ''
                          }`}
                        >
                          <td className="py-1.5">
                            {s.setor}
                            {s.idSetor === SETOR_ALMOX_SECUNDARIO ? (
                              <span className="ml-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                (almox secundário)
                              </span>
                            ) : null}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{fmtQtde(s.saldo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              );
            }
            const saldoAtual = detalhe.linha.saldo;
            if (!detalheEmpenhoLiquido) {
              return <p className="text-slate-500">Sem empenho.</p>;
            }
            return (
              <EmpenhoLiquidoPainel
                detalhe={detalheEmpenhoLiquido}
                saldoAtual={saldoAtual}
                rotuloTotal="Empenho líquido"
                mostrarCards
                layoutSticky
              />
            );
          }}
        </ModalConsultaEstoqueDetalhe>
      )}
    </>
  );

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/70 p-4"
      style={{ zIndex: zMain }}
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[min(90vh,720px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal
        aria-labelledby="consulta-estoque-embed-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        {conteudo}
      </div>
    </div>,
    document.body
  );
}
