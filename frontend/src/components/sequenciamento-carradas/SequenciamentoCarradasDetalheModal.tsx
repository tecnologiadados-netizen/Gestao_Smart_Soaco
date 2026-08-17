import { useCallback, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { SequenciamentoCarradaAgregada } from '../../api/sequenciamentoCarradas';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import GradeCelulaModalBtn from '../../components/pcp/GradeCelulaModalBtn';
import ModalConsultaEstoqueEmbed from '../../components/pcp/ModalConsultaEstoqueEmbed';
import CopiarTextoBtn, { numeroPedidoLimpo } from '../CopiarTextoBtn';
import TogglePrevisaoConfiavel, { type PrevisaoConfiavelTri } from '../TogglePrevisaoConfiavel';
import {
  agregarPedidosVenda,
  agregarProdutosVinculados,
  filtrarLinhasCarrada,
  formatDateBr,
  formatMoeda,
  formatQtde,
  isCarradaOrdemFinal,
  listarItensPedido,
  SUBTOTAL_ROW_CLASS,
  type ItemPedidoRow,
  type PedidoVendaRow,
  type ProdutoVinculadoRow,
} from './sequenciamentoCarradasUtils';

type AbaDetalhe = 'pedidos' | 'itens' | 'produtos';

type Props = {
  carrada: SequenciamentoCarradaAgregada;
  linhas: Record<string, unknown>[];
  aoVivo?: boolean;
  editavel?: boolean;
  previsaoConfiavelPorId?: Record<string, boolean | null>;
  /** Persiste somente ao confirmar "Salvar e sair". */
  onSalvarConfiabilidade?: (
    alteracoes: Record<string, PrevisaoConfiavelTri>
  ) => Promise<void> | void;
  onClose: () => void;
  /** Empilha acima de outros modais (ex.: calendário de produção). */
  zIndex?: number;
};

const TH = 'py-2 px-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap';
const TD = 'py-2 px-2 text-slate-700 dark:text-slate-200';

const PEDIDOS_COLS = ['confiavel', 'pedido', 'cliente', 'emissao', 'municipio', 'uf', 'total'] as const;
const ITENS_COLS = [
  'confiavel',
  'pedido',
  'cliente',
  'emissao',
  'codigo',
  'descricao',
  'qtdeRomaneada',
  'precoUnitario',
  'total',
  'status',
] as const;
const PRODUTOS_COLS = ['codigo', 'descricao', 'qtdeRomaneada'] as const;

const PEDIDOS_LABELS: Record<(typeof PEDIDOS_COLS)[number], string> = {
  confiavel: 'Confiável',
  pedido: 'Pedido',
  cliente: 'Cliente',
  emissao: 'Data de emissão',
  municipio: 'Município',
  uf: 'UF',
  total: 'Total',
};

const ITENS_LABELS: Record<(typeof ITENS_COLS)[number], string> = {
  confiavel: 'Confiável',
  pedido: 'Pedido',
  cliente: 'Cliente',
  emissao: 'Data de emissão',
  codigo: 'Código',
  descricao: 'Descrição',
  qtdeRomaneada: 'Qtde romaneada',
  precoUnitario: 'Preço unitário',
  total: 'Total',
  status: 'Status',
};

const PRODUTOS_LABELS: Record<(typeof PRODUTOS_COLS)[number], string> = {
  codigo: 'Código do produto',
  descricao: 'Descrição do produto',
  qtdeRomaneada: 'Qtde romaneada',
};

const NUM_PEDIDOS = new Set(['total']);
const NUM_ITENS = new Set(['qtdeRomaneada', 'precoUnitario', 'total']);
const NUM_PRODUTOS = new Set(['qtdeRomaneada']);

function textoPedido(r: PedidoVendaRow, col: string): string {
  switch (col) {
    case 'confiavel':
      return '';
    case 'pedido':
      return r.pedido;
    case 'cliente':
      return r.cliente;
    case 'emissao':
      return formatDateBr(r.emissao);
    case 'municipio':
      return r.municipio;
    case 'uf':
      return r.uf;
    case 'total':
      return formatMoeda(r.total);
    default:
      return '';
  }
}

function sortPedido(r: PedidoVendaRow, col: string): string | number {
  if (col === 'total') return r.total;
  return textoPedido(r, col);
}

function textoItem(r: ItemPedidoRow, col: string): string {
  switch (col) {
    case 'confiavel':
      return '';
    case 'pedido':
      return r.pedido;
    case 'cliente':
      return r.cliente;
    case 'emissao':
      return formatDateBr(r.emissao);
    case 'codigo':
      return r.codigo;
    case 'descricao':
      return r.descricao;
    case 'qtdeRomaneada':
      return formatQtde(r.qtdeRomaneada);
    case 'precoUnitario':
      return formatMoeda(r.precoUnitario);
    case 'total':
      return formatMoeda(r.total);
    case 'status':
      return r.status;
    default:
      return '';
  }
}

function sortItem(r: ItemPedidoRow, col: string): string | number {
  if (col === 'qtdeRomaneada') return r.qtdeRomaneada;
  if (col === 'precoUnitario') return r.precoUnitario;
  if (col === 'total') return r.total;
  return textoItem(r, col);
}

function textoProduto(r: ProdutoVinculadoRow, col: string): string {
  if (col === 'codigo') return r.codigo;
  if (col === 'descricao') return r.descricao;
  if (col === 'qtdeRomaneada') return formatQtde(r.qtdeRomaneada);
  return '';
}

function sortProduto(r: ProdutoVinculadoRow, col: string): string | number {
  if (col === 'qtdeRomaneada') return r.qtdeRomaneada;
  return textoProduto(r, col);
}

export default function SequenciamentoCarradasDetalheModal({
  carrada,
  linhas,
  aoVivo = false,
  editavel = false,
  previsaoConfiavelPorId = {},
  onSalvarConfiabilidade,
  onClose,
  zIndex = 130,
}: Props) {
  const [aba, setAba] = useState<AbaDetalhe>('pedidos');
  const [consultaCodigo, setConsultaCodigo] = useState<string | null>(null);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const zConfirm = zIndex + 15;
  const zConsulta = zIndex + 10;

  const linhasFiltradas = useMemo(() => filtrarLinhasCarrada(linhas, carrada), [linhas, carrada]);
  const especialSemRomaneio = isCarradaOrdemFinal(carrada.carrada);
  const labelQtde = especialSemRomaneio ? 'Qtde pendente real' : 'Qtde romaneada';
  const pedidos = useMemo(() => agregarPedidosVenda(linhasFiltradas), [linhasFiltradas]);
  const itens = useMemo(() => listarItensPedido(linhasFiltradas), [linhasFiltradas]);
  const produtos = useMemo(() => agregarProdutosVinculados(linhasFiltradas), [linhasFiltradas]);
  const idsNoModal = useMemo(
    () =>
      [...new Set(linhasFiltradas.map((r) => String(r.id_pedido ?? r.idChave ?? '').trim()).filter(Boolean))],
    [linhasFiltradas]
  );
  const valoresIniciais = useMemo(
    () =>
      Object.fromEntries(
        idsNoModal.map((id) => {
          const override = previsaoConfiavelPorId[id];
          if (override === true || override === false) return [id, override];
          const row = linhasFiltradas.find(
            (linha) => String(linha.id_pedido ?? linha.idChave ?? '').trim() === id
          );
          const original = row?.previsao_atual_confiavel;
          return [id, original === true || original === false ? original : null];
        })
      ) as Record<string, PrevisaoConfiavelTri>,
    [idsNoModal, linhasFiltradas, previsaoConfiavelPorId]
  );
  const valoresIniciaisRef = useRef<Record<string, PrevisaoConfiavelTri> | null>(null);
  if (!valoresIniciaisRef.current) {
    valoresIniciaisRef.current = valoresIniciais;
  }
  const [confiabilidadeLocal, setConfiabilidadeLocal] = useState<Record<string, PrevisaoConfiavelTri>>(
    () => valoresIniciaisRef.current ?? {}
  );
  const valorConfiavel = useCallback(
    (ids: string[]): PrevisaoConfiavelTri => {
      if (ids.length === 0) return null;
      const valores = new Set(ids.map((id) => confiabilidadeLocal[id] ?? null));
      return valores.size === 1 ? [...valores][0]! : null;
    },
    [confiabilidadeLocal]
  );
  const alterarConfiabilidade = useCallback((ids: string[], valor: PrevisaoConfiavelTri) => {
    if (!editavel || ids.length === 0) return;
    setConfiabilidadeLocal((anterior) => {
      const proximo = { ...anterior };
      for (const id of ids) proximo[id] = valor;
      return proximo;
    });
  }, [editavel]);
  const houveAlteracao = useMemo(
    () =>
      idsNoModal.some(
        (id) => (confiabilidadeLocal[id] ?? null) !== (valoresIniciaisRef.current?.[id] ?? null)
      ),
    [confiabilidadeLocal, idsNoModal]
  );
  const solicitarFechamento = useCallback(() => {
    if (houveAlteracao) setConfirmarSaida(true);
    else onClose();
  }, [houveAlteracao, onClose]);
  const sairSemSalvar = useCallback(() => {
    setConfirmarSaida(false);
    onClose();
  }, [onClose]);
  const salvarESair = useCallback(async () => {
    if (!onSalvarConfiabilidade) {
      onClose();
      return;
    }
    setSalvando(true);
    setErroSalvar(null);
    try {
      const alteracoes = Object.fromEntries(
        idsNoModal
          .filter(
            (id) =>
              (confiabilidadeLocal[id] ?? null) !== (valoresIniciaisRef.current?.[id] ?? null)
          )
          .map((id) => [id, confiabilidadeLocal[id] ?? null])
      );
      await onSalvarConfiabilidade(alteracoes);
      setConfirmarSaida(false);
      onClose();
    } catch (error) {
      setErroSalvar(error instanceof Error ? error.message : 'Não foi possível salvar as alterações.');
    } finally {
      setSalvando(false);
    }
  }, [confiabilidadeLocal, idsNoModal, onClose, onSalvarConfiabilidade]);

  useRegisterModalEscape({
    id: 'seq-carradas-detalhe',
    onClose: solicitarFechamento,
    zIndex,
    enabled: !consultaCodigo && !confirmarSaida && !salvando,
  });

  const gradePedidos = useGradeFiltrosExcel<PedidoVendaRow>({
    rows: pedidos,
    columnIds: [...PEDIDOS_COLS],
    getCellText: textoPedido,
    valueForSort: sortPedido,
    defaultSortLevels: [],
  });

  const gradeItens = useGradeFiltrosExcel<ItemPedidoRow>({
    rows: itens,
    columnIds: [...ITENS_COLS],
    getCellText: textoItem,
    valueForSort: sortItem,
    defaultSortLevels: [],
  });

  const gradeProdutos = useGradeFiltrosExcel<ProdutoVinculadoRow>({
    rows: produtos,
    columnIds: [...PRODUTOS_COLS],
    getCellText: textoProduto,
    valueForSort: sortProduto,
    defaultSortLevels: [],
  });

  const gradeAtiva =
    aba === 'pedidos' ? gradePedidos : aba === 'itens' ? gradeItens : gradeProdutos;

  const subtotalPedidos = useMemo(
    () =>
      Math.round(gradePedidos.rowsExibidas.reduce((s, r) => s + r.total, 0) * 100) / 100,
    [gradePedidos.rowsExibidas]
  );
  const subtotalItens = useMemo(
    () => ({
      qtde: gradeItens.rowsExibidas.reduce((s, r) => s + r.qtdeRomaneada, 0),
      total:
        Math.round(gradeItens.rowsExibidas.reduce((s, r) => s + r.total, 0) * 100) / 100,
    }),
    [gradeItens.rowsExibidas]
  );
  const subtotalProdutos = useMemo(
    () => gradeProdutos.rowsExibidas.reduce((s, r) => s + r.qtdeRomaneada, 0),
    [gradeProdutos.rowsExibidas]
  );

  const renderTh = (
    colId: string,
    label: string,
    grade: {
      colunaComFiltroAtivo: (coluna: string) => boolean;
      abrirFiltroExcel: (coluna: string, event: MouseEvent<HTMLButtonElement>) => void;
    },
    numeric: boolean
  ) => (
    <th key={colId} className={`${TH} ${numeric ? 'text-right' : ''}`}>
      <div className={`flex items-center gap-1 ${numeric ? 'justify-end' : 'justify-between'}`}>
        <span>{label}</span>
        <GradeFiltroCabecalhoBtn
          ativo={grade.colunaComFiltroAtivo(colId)}
          onClick={(e) => grade.abrirFiltroExcel(colId, e)}
        />
      </div>
    </th>
  );
  const renderThConfiavel = (ids: string[]) => (
    <th key="confiavel" className={`${TH} min-w-[10.5rem]`}>
      <div className="flex flex-col items-center gap-1">
        <span>Confiável</span>
        {editavel ? (
          <TogglePrevisaoConfiavel
            value={valorConfiavel(ids)}
            onChange={(valor) => alterarConfiabilidade(ids, valor)}
            compact
            showHelp={false}
            className="w-[9.5rem]"
          />
        ) : (
          <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">Somente leitura</span>
        )}
      </div>
    </th>
  );
  const renderConfiavel = (ids: string[]) =>
    editavel ? (
      <TogglePrevisaoConfiavel
        value={valorConfiavel(ids)}
        onChange={(valor) => alterarConfiabilidade(ids, valor)}
        compact
        showHelp={false}
        className="min-w-[9.5rem]"
      />
    ) : (
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {valorConfiavel(ids) === true
          ? 'Sim'
          : valorConfiavel(ids) === false
            ? 'Não'
            : '—'}
      </span>
    );

  return createPortal(
    <>
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/70 p-4"
      style={{ zIndex }}
      role="presentation"
      onClick={solicitarFechamento}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[96vw] flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="seq-carrada-detalhe-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div>
            <h2 id="seq-carrada-detalhe-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Carrada — {carrada.carrada}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Romaneio (Cód): <span className="font-medium">{carrada.cod}</span> ·{' '}
              {editavel ? 'Edição de Confiável no rascunho' : 'Somente leitura'}
              {aoVivo ? ' (consulta ao vivo)' : ' (snapshot)'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                gradePedidos.limparFiltrosGrade();
                gradeItens.limparFiltrosGrade();
                gradeProdutos.limparFiltrosGrade();
              }}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Limpar filtros
            </button>
            <button
              type="button"
              onClick={solicitarFechamento}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Fechar
            </button>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Detalhes da carrada"
          className="flex shrink-0 gap-1 border-b border-slate-200 px-4 dark:border-slate-600"
        >
          {(
            [
              ['pedidos', 'Pedidos de venda vinculados'],
              ['itens', 'Itens de pedidos vinculados'],
              ['produtos', 'Produtos vinculados'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={aba === id}
              onClick={() => setAba(id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                aba === id
                  ? 'border-primary-600 text-primary-700 dark:border-primary-400 dark:text-primary-300'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4" role="tabpanel">
          {aba === 'pedidos' && (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                  {PEDIDOS_COLS.map((col) =>
                    col === 'confiavel'
                      ? renderThConfiavel(
                          gradePedidos.rowsExibidas.flatMap((row) => row.idsPedido)
                        )
                      : renderTh(col, PEDIDOS_LABELS[col], gradePedidos, NUM_PEDIDOS.has(col))
                  )}
                </tr>
              </thead>
              <tbody>
                {gradePedidos.rowsExibidas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-500 dark:text-slate-400">
                      Nenhum pedido nesta carrada.
                    </td>
                  </tr>
                ) : (
                  <>
                    {gradePedidos.rowsExibidas.map((r) => (
                      <tr key={r.pedido} className="border-b border-slate-100 dark:border-slate-700">
                        <td className={`${TD} text-center`}>{renderConfiavel(r.idsPedido)}</td>
                        <td className={TD}>
                          <span className="inline-flex items-center gap-1">
                            {r.pedido}
                            <CopiarTextoBtn texto={numeroPedidoLimpo(r.pedido)} title="Copiar número do pedido" />
                          </span>
                        </td>
                        <td className={TD}>{r.cliente || '—'}</td>
                        <td className={`${TD} whitespace-nowrap`}>{formatDateBr(r.emissao)}</td>
                        <td className={TD}>{r.municipio || '—'}</td>
                        <td className={TD}>{r.uf || '—'}</td>
                        <td className={`${TD} text-right tabular-nums`}>{formatMoeda(r.total)}</td>
                      </tr>
                    ))}
                    <tr className={SUBTOTAL_ROW_CLASS}>
                      <td className={TD} colSpan={6}>
                        Subtotal
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{formatMoeda(subtotalPedidos)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          )}

          {aba === 'itens' && (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                  {ITENS_COLS.map((col) =>
                    col === 'confiavel'
                      ? renderThConfiavel(
                          [...new Set(gradeItens.rowsExibidas.flatMap((row) => row.idsPedido))]
                        )
                      : renderTh(
                          col,
                          col === 'qtdeRomaneada' ? labelQtde : ITENS_LABELS[col],
                          gradeItens,
                          NUM_ITENS.has(col)
                        )
                  )}
                </tr>
              </thead>
              <tbody>
                {gradeItens.rowsExibidas.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-4 text-center text-slate-500 dark:text-slate-400">
                      Nenhum item nesta carrada.
                    </td>
                  </tr>
                ) : (
                  <>
                    {gradeItens.rowsExibidas.map((r, i) => (
                      <tr key={`${r.pedido}-${r.codigo}-${i}`} className="border-b border-slate-100 dark:border-slate-700">
                        <td className={`${TD} text-center`}>{renderConfiavel(r.idsPedido)}</td>
                        <td className={TD}>
                          <span className="inline-flex items-center gap-1">
                            {r.pedido}
                            <CopiarTextoBtn texto={numeroPedidoLimpo(r.pedido)} title="Copiar número do pedido" />
                          </span>
                        </td>
                        <td className={TD}>{r.cliente || '—'}</td>
                        <td className={`${TD} whitespace-nowrap`}>{formatDateBr(r.emissao)}</td>
                        <td className={TD}>
                          {r.codigo ? (
                            <span className="inline-flex items-center gap-1">
                              <GradeCelulaModalBtn
                                onClick={() => setConsultaCodigo(r.codigo)}
                                title={`Consultar estoque de ${r.codigo}`}
                                align="left"
                              >
                                {r.codigo}
                              </GradeCelulaModalBtn>
                              <CopiarTextoBtn texto={r.codigo} title="Copiar código do produto" />
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className={TD}>{r.descricao || '—'}</td>
                        <td className={`${TD} text-right tabular-nums`}>{formatQtde(r.qtdeRomaneada)}</td>
                        <td className={`${TD} text-right tabular-nums`}>{formatMoeda(r.precoUnitario)}</td>
                        <td className={`${TD} text-right tabular-nums`}>{formatMoeda(r.total)}</td>
                        <td className={TD}>{r.status || '—'}</td>
                      </tr>
                    ))}
                    <tr className={SUBTOTAL_ROW_CLASS}>
                      <td className={TD} colSpan={6}>
                        Subtotal
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{formatQtde(subtotalItens.qtde)}</td>
                      <td className={TD} />
                      <td className={`${TD} text-right tabular-nums`}>{formatMoeda(subtotalItens.total)}</td>
                      <td className={TD} />
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          )}

          {aba === 'produtos' && (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                  {PRODUTOS_COLS.map((col) =>
                    renderTh(
                      col,
                      col === 'qtdeRomaneada' ? labelQtde : PRODUTOS_LABELS[col],
                      gradeProdutos,
                      NUM_PRODUTOS.has(col)
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {gradeProdutos.rowsExibidas.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-slate-500 dark:text-slate-400">
                      Nenhum produto nesta carrada.
                    </td>
                  </tr>
                ) : (
                  <>
                    {gradeProdutos.rowsExibidas.map((r) => (
                      <tr key={r.codigo} className="border-b border-slate-100 dark:border-slate-700">
                        <td className={TD}>
                          {r.codigo ? (
                            <span className="inline-flex items-center gap-1">
                              <GradeCelulaModalBtn
                                onClick={() => setConsultaCodigo(r.codigo)}
                                title={`Consultar estoque de ${r.codigo}`}
                                align="left"
                              >
                                {r.codigo}
                              </GradeCelulaModalBtn>
                              <CopiarTextoBtn texto={r.codigo} title="Copiar código do produto" />
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className={TD}>{r.descricao || '—'}</td>
                        <td className={`${TD} text-right tabular-nums`}>{formatQtde(r.qtdeRomaneada)}</td>
                      </tr>
                    ))}
                    <tr className={SUBTOTAL_ROW_CLASS}>
                      <td className={TD} colSpan={2}>
                        Subtotal
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{formatQtde(subtotalProdutos)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {gradeAtiva.colunaFiltroAberta && gradeAtiva.filtroAbertoRect && (
        <GradeFiltroExcelPortal
          colunaAberta={gradeAtiva.colunaFiltroAberta}
          rect={gradeAtiva.filtroAbertoRect}
          dropdownRef={gradeAtiva.filtroDropdownRef}
          excelFilterDrafts={gradeAtiva.excelFilterDrafts}
          setExcelFilterDrafts={gradeAtiva.setExcelFilterDrafts}
          valoresUnicosPorColuna={gradeAtiva.valoresUnicosPorColuna}
          onSortAsc={(colId) => {
            gradeAtiva.setSortState({ key: colId, direction: 'asc' });
            gradeAtiva.setSortLevels([]);
            gradeAtiva.fecharFiltroExcel();
          }}
          onSortDesc={(colId) => {
            gradeAtiva.setSortState({ key: colId, direction: 'desc' });
            gradeAtiva.setSortLevels([]);
            gradeAtiva.fecharFiltroExcel();
          }}
          onAplicar={gradeAtiva.aplicarFiltroExcel}
          onCancelar={gradeAtiva.fecharFiltroExcel}
          showNumericFilters={
            aba === 'pedidos'
              ? NUM_PEDIDOS.has(gradeAtiva.colunaFiltroAberta ?? '')
              : aba === 'itens'
                ? NUM_ITENS.has(gradeAtiva.colunaFiltroAberta ?? '')
                : NUM_PRODUTOS.has(gradeAtiva.colunaFiltroAberta ?? '')
          }
        />
      )}
    </div>
    {confirmarSaida ? (
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
        style={{ zIndex: zConfirm }}
        role="presentation"
        onClick={() => !salvando && setConfirmarSaida(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="seq-carrada-confirmar-saida-titulo"
          className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          <h3
            id="seq-carrada-confirmar-saida-titulo"
            className="text-base font-semibold text-slate-800 dark:text-slate-100"
          >
            Salvar alterações de Confiável?
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Há alterações nesta carrada. Deseja gravá-las no rascunho antes de sair?
          </p>
          {erroSalvar ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-300" role="alert">
              {erroSalvar}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={salvando}
              onClick={() => setConfirmarSaida(false)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={sairSemSalvar}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              Não salvar e sair
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={() => void salvarESair()}
              className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : 'Salvar e sair'}
            </button>
          </div>
        </div>
      </div>
    ) : null}
    {consultaCodigo ? (
      <ModalConsultaEstoqueEmbed
        codigo={consultaCodigo}
        onClose={() => setConsultaCodigo(null)}
        zIndexBase={zConsulta}
      />
    ) : null}
    </>,
    document.body
  );
}
