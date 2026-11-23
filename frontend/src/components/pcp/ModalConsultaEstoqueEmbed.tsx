import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CarregandoInformacoesOverlay from '../CarregandoInformacoesOverlay';
import GradeFiltroCabecalhoBtn from '../grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../grade/GradeFiltroExcelPortal';
import GradeCelulaModalBtn from './GradeCelulaModalBtn';
import ModalConsultaEstoqueDetalhe, { fmtQtde } from './ModalConsultaEstoqueDetalhe';
import TabelaDetalheCotacao from './TabelaDetalheCotacao';
import TabelaDetalheSolicitacao from './TabelaDetalheSolicitacao';
import ModalPcPendDetalhes from '../ressupAlmox/ModalPcPendDetalhes';
import ModalEscolhasConsultaEstoque from './ModalEscolhasConsultaEstoque';
import {
  OPCOES_EMPENHO_PRODUTO_CONSULTA,
  avisoEscopoEmpenhoProduto,
  devePerguntarEmpenhoProduto,
  escolhaAutomaticaProdutoConsulta,
  opcoesModoProdutoConsulta,
  rotuloEmpenhoProdutoEscopo,
  rotuloModoProduto,
} from './ModalFiltrosConsultaEstoque';
import CopiarTextoBtn from '../CopiarTextoBtn';
import EmpenhoLiquidoPainel from '../ressupAlmox/EmpenhoLiquidoPainel';
import RotuloComDica from '../ressupAlmox/RotuloComDica';
import { DICA_EMPENHO_LIQ_GRADE, DICA_ESTOQUE_ATUAL_GRADE, DICA_ESTOQUE_PA_SALDO, isSetorEstoquePa } from '../ressupAlmox/empenhoModalUtils';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import {
  consultarEstoque,
  obterCotacaoDetalhe,
  obterSaldoDetalhe,
  obterScDetalhe,
  verificarProdutoFiltroTemBom,
  type ConsultaEstoqueLinha,
  type CotacaoDetalhe,
  type EmpenhoProdutoEscopoConsultaEstoque,
  type ModoProdutoConsultaEstoque,
  type SaldoSetorDetalhe,
  type ScDetalhe,
} from '../../api/consultaEstoque';
import {
  obterRessupAlmoxPcPendDetalhes,
  obterRessupEmpenhoPorPedido,
  type RessupAlmoxPcPendLinha,
  type RessupEmpenhoPedidoResultado,
} from '../../api/compras';
import { SETOR_ALMOX_SECUNDARIO } from '../../utils/ressupNaoAlmoxColetas';
import {
  getOrderLabelsForConsultaEstoqueCol,
  isConsultaEstoqueColNumeric,
  SORT_DEFAULT_CONSULTA_ESTOQUE,
} from '../../utils/consultaEstoqueGradeSort';

const COLS = [
  { key: 'codigo', label: 'Código', align: 'left' as const, clickable: false },
  { key: 'descricao', label: 'Descrição', align: 'left' as const, clickable: false },
  { key: 'und', label: 'Und', align: 'left' as const, clickable: false },
  { key: 'empenho', label: 'Empenho', align: 'center' as const, clickable: true },
  { key: 'saldo', label: 'Estoque atual', align: 'center' as const, clickable: true },
  { key: 'solicitacao', label: 'Solicitação', align: 'center' as const, clickable: true },
  { key: 'cotacao', label: 'Pré Compra', align: 'center' as const, clickable: true },
  { key: 'pedidoCompra', label: 'Pedido compra', align: 'center' as const, clickable: true },
  { key: 'saldoProjetado', label: 'Saldo projetado', align: 'center' as const, clickable: false },
] as const;

type ColKey = (typeof COLS)[number]['key'];
const COL_KEYS: ColKey[] = COLS.map((c) => c.key);
const NUM_KEYS = ['empenho', 'saldo', 'solicitacao', 'cotacao', 'pedidoCompra', 'saldoProjetado'] as const;

function detalheTipoDaColuna(k: ColKey): 'saldo' | 'empenho' | 'solicitacao' | 'cotacao' | 'pc' | null {
  if (k === 'saldo' || k === 'empenho' || k === 'solicitacao' || k === 'cotacao') return k;
  if (k === 'pedidoCompra') return 'pc';
  return null;
}

const SALDO_PROJETADO_NEG_CLASS = 'bg-red-50 dark:bg-red-950/40';
const Z_MAIN_DEFAULT = 132;

type EscolhasProdutoEmbed = {
  modoProduto: ModoProdutoConsultaEstoque;
  empenhoEscopo: EmpenhoProdutoEscopoConsultaEstoque;
};

type DetalheModal =
  | { tipo: 'saldo'; linha: ConsultaEstoqueLinha }
  | { tipo: 'empenho'; linha: ConsultaEstoqueLinha }
  | { tipo: 'solicitacao'; linha: ConsultaEstoqueLinha }
  | { tipo: 'cotacao'; linha: ConsultaEstoqueLinha }
  | { tipo: 'pc'; linha: ConsultaEstoqueLinha };

type DetalheCachePayload =
  | SaldoSetorDetalhe[]
  | ScDetalhe[]
  | CotacaoDetalhe[]
  | RessupEmpenhoPedidoResultado;

function detalheModalCacheKey(
  tipo: DetalheModal['tipo'],
  idProduto: number,
  considerarRequisicoes: boolean
): string {
  return `${tipo}-${idProduto}-${considerarRequisicoes ? '1' : '0'}`;
}

/** Fontes injetáveis: permitem servir a consulta de um snapshot congelado em vez do Nomus ao vivo. */
export type FontesConsultaEstoqueEmbed = {
  consultar: (
    codigo: string,
    considerarRequisicoes: boolean
  ) => Promise<{ data: ConsultaEstoqueLinha[]; error?: string }>;
  saldoDetalhe: (idProduto: number) => Promise<{ data: SaldoSetorDetalhe[]; error?: string }>;
  empenhoPorPedido: (
    idProduto: number,
    considerarRequisicoes: boolean
  ) => Promise<{ data: RessupEmpenhoPedidoResultado | null; error?: string }>;
};

type Props = {
  codigo: string;
  onClose: () => void;
  /** Base de empilhamento (padrão 132). Use valor maior quando aberto sobre outro modal alto. */
  zIndexBase?: number;
  /** Substitui as consultas ao vivo (ex.: snapshot de sequência com valores congelados). */
  fontes?: FontesConsultaEstoqueEmbed;
  /** Texto do subtítulo; padrão avisa que a visualização é em tempo real. */
  legenda?: string;
};

export default function ModalConsultaEstoqueEmbed({
  codigo,
  onClose,
  zIndexBase = Z_MAIN_DEFAULT,
  fontes,
  legenda,
}: Props) {
  const zMain = zIndexBase;
  const zDetalhe = zIndexBase + 1;
  const zEscolhas = zIndexBase + 2;
  const [linhas, setLinhas] = useState<ConsultaEstoqueLinha[]>([]);
  const [loading, setLoading] = useState(false);
  const [erroApi, setErroApi] = useState<string | null>(null);
  const [considerarRequisicoes, setConsiderarRequisicoes] = useState(true);
  const [escolhasProduto, setEscolhasProduto] = useState<EscolhasProdutoEmbed | null>(null);
  const [confirmEscolhasAberto, setConfirmEscolhasAberto] = useState(!fontes);
  const [escolhaModoTemp, setEscolhaModoTemp] = useState<ModoProdutoConsultaEstoque | null>(null);
  const [produtoTemBom, setProdutoTemBom] = useState(true);
  const [produtoBomCarregando, setProdutoBomCarregando] = useState(false);
  const [idsProdutosPaiEscopo, setIdsProdutosPaiEscopo] = useState<number[]>([]);
  const [detalhe, setDetalhe] = useState<DetalheModal | null>(null);
  const [detalheSaldo, setDetalheSaldo] = useState<SaldoSetorDetalhe[]>([]);
  const [detalheEmpenhoLiquido, setDetalheEmpenhoLiquido] = useState<RessupEmpenhoPedidoResultado | null>(
    null
  );
  const [detalheSc, setDetalheSc] = useState<ScDetalhe[]>([]);
  const [detalheCotacao, setDetalheCotacao] = useState<CotacaoDetalhe[]>([]);
  const [detalhePcCascata, setDetalhePcCascata] = useState<RessupAlmoxPcPendLinha[]>([]);

  const detalheCacheRef = useRef(new Map<string, DetalheCachePayload>());
  const pcDetalheCacheRef = useRef(new Map<number, RessupAlmoxPcPendLinha[]>());
  const considerarRef = useRef(considerarRequisicoes);
  const escolhasRef = useRef(escolhasProduto);
  const idsPaisEscopoRef = useRef(idsProdutosPaiEscopo);
  considerarRef.current = considerarRequisicoes;
  escolhasRef.current = escolhasProduto;
  idsPaisEscopoRef.current = idsProdutosPaiEscopo;

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
      case 'solicitacao':
        return fmtQtde(row.solicitacao ?? 0);
      case 'cotacao':
        return fmtQtde(row.cotacao ?? 0);
      case 'pedidoCompra':
        return fmtQtde(row.pedidoCompra ?? 0);
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

  const carregarConsulta = useCallback(
    async (req: boolean, escolhas?: EscolhasProdutoEmbed | null) => {
      const e = escolhas ?? escolhasRef.current;
      if (!fontes && !e) return;

      detalheCacheRef.current.clear();
      pcDetalheCacheRef.current.clear();
      setDetalhe(null);
      setLoading(true);
      setErroApi(null);
      const r = fontes
        ? await fontes.consultar(codigo.trim(), req)
        : await consultarEstoque({
            filtros: {
              codigos: [codigo.trim()],
              modoProduto: e!.modoProduto,
              empenhoProdutoEscopo: e!.empenhoEscopo,
            },
            considerarRequisicoes: req,
          });
      setLoading(false);
      if (r.error) {
        setErroApi(r.error);
        setLinhas([]);
        return;
      }
      if (!fontes) setIdsProdutosPaiEscopo(r.idsProdutosPaiEscopo ?? []);
      setLinhas(r.data);
    },
    [codigo, fontes]
  );

  useEffect(() => {
    if (fontes) {
      void carregarConsulta(considerarRef.current);
      return;
    }
    setEscolhasProduto(null);
    setConfirmEscolhasAberto(false);
    setEscolhaModoTemp(null);
    setProdutoTemBom(true);
    setProdutoBomCarregando(true);
    setIdsProdutosPaiEscopo([]);
    setLinhas([]);
    setErroApi(null);
    setLoading(false);
    let cancelled = false;
    void verificarProdutoFiltroTemBom({ codigos: [codigo.trim()] }).then((r) => {
      if (cancelled) return;
      setProdutoTemBom(r.temBom);
      setProdutoBomCarregando(false);
      const automatica = r.error
        ? null
        : escolhaAutomaticaProdutoConsulta({
            temBom: r.temBom,
            todosComprados: r.todosComprados,
          });
      if (automatica) {
        setEscolhasProduto(automatica);
        setConfirmEscolhasAberto(false);
        setEscolhaModoTemp(null);
        return;
      }
      setConfirmEscolhasAberto(true);
      setEscolhaModoTemp(null);
    });
    return () => {
      cancelled = true;
    };
  }, [codigo, fontes, carregarConsulta]);

  useEffect(() => {
    if (fontes || !escolhasProduto) return;
    void carregarConsulta(considerarRequisicoes, escolhasProduto);
  }, [carregarConsulta, considerarRequisicoes, escolhasProduto, fontes]);

  const confirmarEscolhasProduto = (escopo: EmpenhoProdutoEscopoConsultaEstoque) => {
    if (!escolhaModoTemp) return;
    const modo =
      !produtoTemBom && escolhaModoTemp === 'componentes' ? 'diretos' : escolhaModoTemp;
    setEscolhasProduto({ modoProduto: modo, empenhoEscopo: escopo });
    setConfirmEscolhasAberto(false);
  };

  const cancelarEscolhasProduto = () => {
    if (escolhasProduto) {
      setConfirmEscolhasAberto(false);
      return;
    }
    onClose();
  };

  const abrirAlterarEscolhas = () => {
    setProdutoBomCarregando(true);
    void verificarProdutoFiltroTemBom({ codigos: [codigo.trim()] }).then((r) => {
      setProdutoTemBom(r.temBom);
      setProdutoBomCarregando(false);
      const automatica = r.error
        ? null
        : escolhaAutomaticaProdutoConsulta({
            temBom: r.temBom,
            todosComprados: r.todosComprados,
          });
      if (automatica && !r.temBom) {
        setConfirmEscolhasAberto(false);
        setEscolhaModoTemp(null);
        setEscolhasProduto((atual) =>
          atual?.modoProduto === automatica.modoProduto &&
          atual.empenhoEscopo === automatica.empenhoEscopo
            ? atual
            : automatica
        );
        return;
      }
      setEscolhaModoTemp(escolhasProduto?.modoProduto ?? null);
      setConfirmEscolhasAberto(true);
    });
  };

  const detailKey =
    detalhe != null && detalhe.tipo !== 'pc'
      ? detalheModalCacheKey(detalhe.tipo, detalhe.linha.idProduto, considerarRequisicoes)
      : null;

  const carregarDetalheModal = useCallback(async (): Promise<{ error?: string }> => {
    if (!detalhe || detalhe.tipo === 'pc') return {};
    const id = detalhe.linha.idProduto;
    const carregarPcCascata = async (idProduto: number): Promise<RessupAlmoxPcPendLinha[]> => {
      const emCache = pcDetalheCacheRef.current.get(idProduto);
      if (emCache) return emCache;
      const r = await obterRessupAlmoxPcPendDetalhes(idProduto);
      if (r.error) return [];
      pcDetalheCacheRef.current.set(idProduto, r.data);
      return r.data;
    };
    const cacheKey = detalheModalCacheKey(detalhe.tipo, id, considerarRef.current);
    const cached = detalheCacheRef.current.get(cacheKey);
    if (cached) {
      if (detalhe.tipo === 'saldo') setDetalheSaldo(cached as SaldoSetorDetalhe[]);
      else if (detalhe.tipo === 'empenho') {
        setDetalheEmpenhoLiquido(cached as RessupEmpenhoPedidoResultado);
        if (!fontes) setDetalhePcCascata(await carregarPcCascata(id));
      } else if (detalhe.tipo === 'solicitacao') setDetalheSc(cached as ScDetalhe[]);
      else setDetalheCotacao(cached as CotacaoDetalhe[]);
      return {};
    }
    if (detalhe.tipo === 'saldo') {
      const r = fontes ? await fontes.saldoDetalhe(id) : await obterSaldoDetalhe(id);
      if (!r.error) detalheCacheRef.current.set(cacheKey, r.data);
      setDetalheSaldo(r.data);
      return { error: r.error };
    }
    if (detalhe.tipo === 'empenho') {
      const paisEscopo =
        escolhasRef.current?.empenhoEscopo === 'produto' ? idsPaisEscopoRef.current : undefined;
      const [rLiquido, pcs] = await Promise.all([
        fontes
          ? fontes.empenhoPorPedido(id, considerarRef.current)
          : obterRessupEmpenhoPorPedido(id, considerarRef.current, false, undefined, paisEscopo),
        fontes ? Promise.resolve([] as RessupAlmoxPcPendLinha[]) : carregarPcCascata(id),
      ]);
      if (!rLiquido.error && rLiquido.data) detalheCacheRef.current.set(cacheKey, rLiquido.data);
      setDetalheEmpenhoLiquido(rLiquido.data);
      setDetalhePcCascata(pcs);
      return { error: rLiquido.error };
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
  }, [detalhe, fontes]);

  useEffect(() => {
    if (!detalhe || detalhe.tipo === 'pc') {
      setDetalheSaldo([]);
      setDetalheEmpenhoLiquido(null);
      setDetalhePcCascata([]);
      setDetalheSc([]);
      setDetalheCotacao([]);
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
          <h2 className="inline-flex items-center gap-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
            Consulta de estoque — {codigo}
            <CopiarTextoBtn texto={codigo} title="Copiar código do produto" />
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {legenda ?? 'Visualização em tempo real.'} Clique em Empenho, Estoque, Solicitação, Pré Compra ou Pedido compra para detalhar.
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
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {!fontes && escolhasProduto && (
            <span className="text-slate-700 dark:text-slate-200">
              Produto filtrado:{' '}
              <strong>{rotuloModoProduto(escolhasProduto.modoProduto)}</strong>
              <span className="mx-1.5 text-slate-400">·</span>
              Empenho: <strong>{rotuloEmpenhoProdutoEscopo(escolhasProduto.empenhoEscopo)}</strong>
              {produtoTemBom && (
                <button
                  type="button"
                  className="ml-2 text-primary-600 hover:underline dark:text-primary-400"
                  onClick={abrirAlterarEscolhas}
                >
                  Alterar
                </button>
              )}
            </span>
          )}
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <button
              type="button"
              role="switch"
              aria-checked={considerarRequisicoes}
              aria-label="Considerar requisições de loja no empenho"
              disabled={loading}
              onClick={() => setConsiderarRequisicoes((v) => !v)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 ${
                considerarRequisicoes ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
                  considerarRequisicoes ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="font-medium">Requisições de loja</span>
          </div>
        </div>
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
        <table className="w-full min-w-[980px] border-collapse text-xs">
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
                        ) : c.key === 'saldo' ? (
                          <span className="inline-flex justify-center">
                            <RotuloComDica rotulo={c.label} dica={DICA_ESTOQUE_ATUAL_GRADE} headerClaro />
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
                  const val = row[k] ?? 0;
                  const tipoDetalhe = detalheTipoDaColuna(k);
                  const saldoNegativo = k === 'saldoProjetado' && val <= 0;
                  return (
                    <td
                      key={k}
                      className={`px-2 py-1.5 text-center tabular-nums ${
                        saldoNegativo ? SALDO_PROJETADO_NEG_CLASS : ''
                      }`}
                    >
                      {tipoDetalhe ? (
                        <GradeCelulaModalBtn onClick={() => setDetalhe({ tipo: tipoDetalhe, linha: row })}>
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

      {detalhe?.tipo === 'pc' && (
        <ModalPcPendDetalhes
          open
          overlayFixed
          idProduto={detalhe.linha.idProduto}
          codigo={detalhe.linha.codigo}
          descricao={detalhe.linha.descricao}
          onClose={() => setDetalhe(null)}
          cacheRef={pcDetalheCacheRef}
        />
      )}

      {detalhe && detalhe.tipo !== 'pc' && (
        <ModalConsultaEstoqueDetalhe
          open
          backdropMode="fixed"
          zIndex={zDetalhe}
          rotuloFechar="Voltar"
          titulo={
            detalhe.tipo === 'saldo'
              ? `Estoque atual — ${detalhe.linha.codigo}`
              : detalhe.tipo === 'empenho'
                ? `Empenho — ${detalhe.linha.codigo}`
                : detalhe.tipo === 'solicitacao'
                  ? `Solicitação de compra — ${detalhe.linha.codigo}`
                  : `Pré Compra — ${detalhe.linha.codigo}`
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
              const saldoEstoquePa = detalheSaldo
                .filter((s) => isSetorEstoquePa(s.idSetor))
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
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        <RotuloComDica rotulo="Estoque em PA" dica={DICA_ESTOQUE_PA_SALDO} />
                      </div>
                      <div className="text-sm font-medium tabular-nums">{fmtQtde(saldoEstoquePa)}</div>
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
                          <td className="py-1.5">{s.setor}</td>
                          <td className="py-1.5 text-right tabular-nums">{fmtQtde(s.saldo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              );
            }
            if (detalhe.tipo === 'empenho') {
              const saldoAtual = detalhe.linha.saldo;
              if (!detalheEmpenhoLiquido) {
                return <p className="text-slate-500">Sem empenho.</p>;
              }
              return (
                <EmpenhoLiquidoPainel
                  detalhe={detalheEmpenhoLiquido}
                  codigo={detalhe.linha.codigo}
                  descricao={detalhe.linha.descricao}
                  saldoAtual={saldoAtual}
                  rotuloTotal="Empenho líquido"
                  mostrarCards
                  layoutSticky
                  exibirTogglesPedidoCompra={!fontes}
                  pedidosCompra={detalhePcCascata}
                />
              );
            }
            if (detalhe.tipo === 'solicitacao') {
              return <TabelaDetalheSolicitacao linhas={detalheSc} />;
            }
            return (
              <TabelaDetalheCotacao
                linhas={detalheCotacao}
                idProduto={detalhe.linha.idProduto}
                codigo={detalhe.linha.codigo}
                descricao={detalhe.linha.descricao}
                zIndexSc={zDetalhe + 1}
              />
            );
          }}
        </ModalConsultaEstoqueDetalhe>
      )}
    </>
  );

  return (
    <>
      {createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/70 p-4"
          style={{ zIndex: zMain }}
          role="presentation"
          onClick={onClose}
        >
          <div
            className="relative flex max-h-[min(92vh,820px)] w-full max-w-[min(96vw,1200px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
            role="dialog"
            aria-modal
            aria-labelledby="consulta-estoque-embed-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            {conteudo}
          </div>
        </div>,
        document.body
      )}

      {!fontes && (
        <ModalEscolhasConsultaEstoque
          open={confirmEscolhasAberto}
          zIndex={zEscolhas}
          contexto={
            <>
              Produto <strong>{codigo}</strong>
            </>
          }
          perguntaModo="Como visualizar os produtos?"
          opcoesModo={opcoesModoProdutoConsulta(produtoTemBom).map((op) =>
            op.valor === 'diretos'
              ? { ...op, descricao: 'O próprio produto informado' }
              : op
          )}
          modoSelecionado={escolhaModoTemp}
          onSelecionarModo={setEscolhaModoTemp}
          perguntaEscopo="Como calcular o empenho?"
          opcoesEscopo={
            devePerguntarEmpenhoProduto({
              temPedidoSelecionado: false,
              modo: escolhaModoTemp,
            })
              ? OPCOES_EMPENHO_PRODUTO_CONSULTA
              : []
          }
          escopoAutomatico="todos"
          avisoModo={
            !produtoBomCarregando && !produtoTemBom
              ? 'Este item não possui ficha técnica (BOM). A consulta será do próprio item.'
              : null
          }
          avisoEscopo={avisoEscopoEmpenhoProduto({
            temPedidoSelecionado: false,
            modo: escolhaModoTemp,
          })}
          carregando={produtoBomCarregando}
          onConfirmar={confirmarEscolhasProduto}
          onCancelar={cancelarEscolhasProduto}
        />
      )}
    </>
  );
}
