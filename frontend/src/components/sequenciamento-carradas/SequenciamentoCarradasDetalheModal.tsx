import { useMemo, useState } from 'react';
import type { SequenciamentoCarradaAgregada } from '../../api/sequenciamentoCarradas';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import GradeCelulaModalBtn from '../../components/pcp/GradeCelulaModalBtn';
import ModalConsultaEstoqueEmbed from '../../components/pcp/ModalConsultaEstoqueEmbed';
import {
  agregarPedidosVenda,
  agregarProdutosVinculados,
  filtrarLinhasCarrada,
  formatDateBr,
  formatMoeda,
  formatQtde,
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
  onClose: () => void;
};

const TH = 'py-2 px-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap';
const TD = 'py-2 px-2 text-slate-700 dark:text-slate-200';

const PEDIDOS_COLS = ['pedido', 'cliente', 'emissao', 'municipio', 'uf', 'total'] as const;
const ITENS_COLS = [
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
  pedido: 'Pedido',
  cliente: 'Cliente',
  emissao: 'Data de emissão',
  municipio: 'Município',
  uf: 'UF',
  total: 'Total',
};

const ITENS_LABELS: Record<(typeof ITENS_COLS)[number], string> = {
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
  onClose,
}: Props) {
  const [aba, setAba] = useState<AbaDetalhe>('pedidos');
  const [consultaCodigo, setConsultaCodigo] = useState<string | null>(null);

  useRegisterModalEscape({
    id: 'seq-carradas-detalhe',
    onClose,
    zIndex: 130,
    enabled: !consultaCodigo,
  });

  const linhasFiltradas = useMemo(() => filtrarLinhasCarrada(linhas, carrada), [linhas, carrada]);
  const pedidos = useMemo(() => agregarPedidosVenda(linhasFiltradas), [linhasFiltradas]);
  const itens = useMemo(() => listarItensPedido(linhasFiltradas), [linhasFiltradas]);
  const produtos = useMemo(() => agregarProdutosVinculados(linhasFiltradas), [linhasFiltradas]);

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
    grade: typeof gradePedidos,
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

  return (
    <>
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
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
              Romaneio (Cód): <span className="font-medium">{carrada.cod}</span> · Somente leitura
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
              onClick={onClose}
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
                    renderTh(col, PEDIDOS_LABELS[col], gradePedidos, NUM_PEDIDOS.has(col))
                  )}
                </tr>
              </thead>
              <tbody>
                {gradePedidos.rowsExibidas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-500 dark:text-slate-400">
                      Nenhum pedido nesta carrada.
                    </td>
                  </tr>
                ) : (
                  <>
                    {gradePedidos.rowsExibidas.map((r) => (
                      <tr key={r.pedido} className="border-b border-slate-100 dark:border-slate-700">
                        <td className={TD}>{r.pedido}</td>
                        <td className={TD}>{r.cliente || '—'}</td>
                        <td className={`${TD} whitespace-nowrap`}>{formatDateBr(r.emissao)}</td>
                        <td className={TD}>{r.municipio || '—'}</td>
                        <td className={TD}>{r.uf || '—'}</td>
                        <td className={`${TD} text-right tabular-nums`}>{formatMoeda(r.total)}</td>
                      </tr>
                    ))}
                    <tr className={SUBTOTAL_ROW_CLASS}>
                      <td className={TD} colSpan={5}>
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
                    renderTh(col, ITENS_LABELS[col], gradeItens, NUM_ITENS.has(col))
                  )}
                </tr>
              </thead>
              <tbody>
                {gradeItens.rowsExibidas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-4 text-center text-slate-500 dark:text-slate-400">
                      Nenhum item nesta carrada.
                    </td>
                  </tr>
                ) : (
                  <>
                    {gradeItens.rowsExibidas.map((r, i) => (
                      <tr key={`${r.pedido}-${r.codigo}-${i}`} className="border-b border-slate-100 dark:border-slate-700">
                        <td className={TD}>{r.pedido}</td>
                        <td className={TD}>{r.cliente || '—'}</td>
                        <td className={`${TD} whitespace-nowrap`}>{formatDateBr(r.emissao)}</td>
                        <td className={TD}>
                          {r.codigo ? (
                            <GradeCelulaModalBtn
                              onClick={() => setConsultaCodigo(r.codigo)}
                              title={`Consultar estoque de ${r.codigo}`}
                              align="left"
                            >
                              {r.codigo}
                            </GradeCelulaModalBtn>
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
                      <td className={TD} colSpan={5}>
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
                    renderTh(col, PRODUTOS_LABELS[col], gradeProdutos, NUM_PRODUTOS.has(col))
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
                            <GradeCelulaModalBtn
                              onClick={() => setConsultaCodigo(r.codigo)}
                              title={`Consultar estoque de ${r.codigo}`}
                              align="left"
                            >
                              {r.codigo}
                            </GradeCelulaModalBtn>
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
    {consultaCodigo ? (
      <ModalConsultaEstoqueEmbed
        codigo={consultaCodigo}
        onClose={() => setConsultaCodigo(null)}
        zIndexBase={140}
      />
    ) : null}
    </>
  );
}
