import { useCallback, useMemo, useState } from 'react';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import { cellToYmd } from '../../utils/gradeFiltroData';
import { criarMatcherTextoLivre } from '../../utils/textoLivreBusca';
import type { PedidoDataEntregaAtualizar } from '../../api/acompanhamentoSolicitacao';
import PrazoEntregaBadge, { rotuloPrazoEntrega } from './PrazoEntregaBadge';

type FiltroPrazo = 'todos' | 'atrasados' | 'semana' | 'sem_data';

const FILTROS_PRAZO: { id: FiltroPrazo; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'atrasados', label: 'Atrasados' },
  { id: 'semana', label: 'Vencem em até 7 dias' },
  { id: 'sem_data', label: 'Sem data' },
];

type ColId = 'pedido' | 'fornecedor' | 'emissao' | 'situacao' | 'itens' | 'entrega' | 'prazo';

const COLUNAS: { id: ColId; label: string; alinhar?: 'right' }[] = [
  { id: 'pedido', label: 'Pedido' },
  { id: 'fornecedor', label: 'Fornecedor' },
  { id: 'emissao', label: 'Emissão' },
  { id: 'situacao', label: 'Situação dos itens' },
  { id: 'itens', label: 'Itens a atualizar', alinhar: 'right' },
  { id: 'entrega', label: 'Data de entrega' },
  { id: 'prazo', label: 'Prazo' },
];

const COL_IDS = COLUNAS.map((c) => c.id);
const COLUNAS_NUMERICAS = new Set<string>(['itens', 'prazo']);
const COLUNAS_DATA = ['emissao', 'entrega'];

/** Sem data fica antes de qualquer atraso na ordenação do prazo. */
const PESO_SEM_DATA = -1_000_000;

const CLASSE_FILTRO =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

function passaPrazo(p: PedidoDataEntregaAtualizar, filtro: FiltroPrazo): boolean {
  if (filtro === 'todos') return true;
  if (filtro === 'sem_data') return p.semData > 0;
  if (p.menorDias == null) return false;
  if (filtro === 'atrasados') return p.menorDias < 0;
  return p.menorDias >= 0;
}

function situacoes(p: PedidoDataEntregaAtualizar): string[] {
  const out: string[] = [];
  if (p.liberados > 0) out.push('Liberado');
  if (p.parciais > 0) out.push('Parcial');
  if (p.preEntradas > 0) out.push('Pré-entrada');
  return out;
}

function rotuloPrazoPedido(p: PedidoDataEntregaAtualizar): string {
  if (p.semData > 0) return rotuloPrazoEntrega(null);
  return rotuloPrazoEntrega(p.menorDias);
}

function textoCelula(p: PedidoDataEntregaAtualizar, colId: string): string {
  switch (colId as ColId) {
    case 'pedido':
      return p.pedido;
    case 'fornecedor':
      return p.fornecedor ?? '—';
    case 'emissao':
      return p.dataEmissao ?? '—';
    case 'situacao':
      return situacoes(p).join(', ') || '—';
    case 'itens':
      return String(p.itens);
    case 'entrega':
      return p.menorDataEntrega ?? 'Sem data';
    case 'prazo':
      return rotuloPrazoPedido(p);
    default:
      return '';
  }
}

function valorOrdenacao(p: PedidoDataEntregaAtualizar, colId: string): string | number {
  if (colId === 'itens') return p.itens;
  if (colId === 'prazo') return p.semData > 0 ? PESO_SEM_DATA : (p.menorDias ?? PESO_SEM_DATA);
  if (colId === 'emissao') return cellToYmd(p.dataEmissao) ?? '';
  if (colId === 'entrega') return cellToYmd(p.menorDataEntrega) ?? '';
  return textoCelula(p, colId);
}

function valoresFiltro(p: PedidoDataEntregaAtualizar, colId: string): string[] | null {
  if (colId !== 'situacao') return null;
  const lista = situacoes(p);
  return lista.length > 0 ? lista : ['—'];
}

function Situacao({ qtde, rotulo, classe }: { qtde: number; rotulo: string; classe: string }) {
  if (qtde <= 0) return null;
  return (
    <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${classe}`}>
      {qtde} {rotulo}
    </span>
  );
}

type Props = {
  pedidos: PedidoDataEntregaAtualizar[];
  carregando: boolean;
  erro: string | null;
  onAbrirPedido: (pedido: PedidoDataEntregaAtualizar) => void;
};

export default function DatasEntregaAtualizarPainel({ pedidos, carregando, erro, onAbrirPedido }: Props) {
  const [busca, setBusca] = useState('');
  const [prazo, setPrazo] = useState<FiltroPrazo>('todos');

  const preFiltrados = useMemo(() => {
    const match = criarMatcherTextoLivre(busca);
    const temBusca = busca.trim().length > 0;
    return pedidos.filter((p) => {
      if (temBusca && !match(p.pedido) && !match(p.fornecedor ?? '')) return false;
      return passaPrazo(p, prazo);
    });
  }, [pedidos, busca, prazo]);

  const grade = useGradeFiltrosExcel({
    rows: preFiltrados,
    columnIds: COL_IDS,
    getCellText: textoCelula,
    getCellFilterValues: valoresFiltro,
    valueForSort: valorOrdenacao,
    dateColumnIds: COLUNAS_DATA,
  });

  const visiveis = grade.rowsExibidas;
  const totalItens = useMemo(() => visiveis.reduce((acc, p) => acc + p.itens, 0), [visiveis]);

  const ordenar = useCallback(
    (colId: string, direction: 'asc' | 'desc') => {
      grade.setSortState({ key: colId, direction });
      grade.setSortLevels([]);
      grade.fecharFiltroExcel();
    },
    [grade]
  );

  return (
    <div className="flex flex-col gap-3 pb-4">
      <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100">
        Pedidos de compra com item Liberado, Atendido parcialmente ou Atendido totalmente com pré-entrada, cuja data de
        entrega está atrasada, vazia ou vence nos próximos 7 dias. A data de entrega desses itens precisa ser
        atualizada: abra o pedido e use <strong>Alterar data</strong> em cada item marcado.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[16rem] flex-1">
          <span className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Pedido ou fornecedor
          </span>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Qualquer um dos dois. Use % (ex.: PC27%)"
            className={CLASSE_FILTRO}
            aria-label="Filtrar por pedido ou fornecedor"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {FILTROS_PRAZO.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setPrazo(f.id)}
              aria-pressed={prazo === f.id}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                prazo === f.id
                  ? 'border-sky-600 bg-sky-50 text-sky-800 dark:border-sky-500 dark:bg-sky-500/15 dark:text-sky-100'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {visiveis.length} {visiveis.length === 1 ? 'pedido' : 'pedidos'} · {totalItens}{' '}
          {totalItens === 1 ? 'item' : 'itens'} a atualizar
        </span>
        {grade.temFiltrosOuOrdem ? (
          <button
            type="button"
            onClick={grade.limparFiltrosGrade}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            Limpar filtros da grade
          </button>
        ) : null}
      </div>

      {erro ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {erro}
        </p>
      ) : null}

      {carregando ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600">
          Lendo datas de entrega dos pedidos…
        </p>
      ) : preFiltrados.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600">
          Nenhum pedido com data de entrega a atualizar.
        </p>
      ) : (
        <div
          ref={grade.tableScrollRef}
          className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              <tr>
                {COLUNAS.map((col) => (
                  <th key={col.id} className="px-3 py-2 font-medium">
                    <div
                      className={`flex items-center gap-1.5 ${col.alinhar === 'right' ? 'justify-end' : 'justify-between'}`}
                    >
                      <span>{col.label}</span>
                      <GradeFiltroCabecalhoBtn
                        ativo={grade.colunaComFiltroAtivo(col.id)}
                        onClick={(e) => grade.abrirFiltroExcel(col.id, e)}
                      />
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2" aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 ? (
                <tr>
                  <td colSpan={COLUNAS.length + 1} className="px-3 py-6 text-center text-sm text-slate-500">
                    Nenhum pedido com os filtros da grade.
                  </td>
                </tr>
              ) : (
                visiveis.map((p) => (
                  <tr
                    key={p.idPedido}
                    onClick={() => onAbrirPedido(p)}
                    className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40"
                  >
                    <td className="px-3 py-2 font-semibold text-slate-900 dark:text-slate-50">{p.pedido}</td>
                    <td
                      className="max-w-[18rem] truncate px-3 py-2 text-slate-700 dark:text-slate-200"
                      title={p.fornecedor ?? ''}
                    >
                      {p.fornecedor ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-200">{p.dataEmissao ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap gap-1">
                        <Situacao
                          qtde={p.liberados}
                          rotulo={p.liberados === 1 ? 'liberado' : 'liberados'}
                          classe="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-100"
                        />
                        <Situacao
                          qtde={p.parciais}
                          rotulo={p.parciais === 1 ? 'parcial' : 'parciais'}
                          classe="border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-500/60 dark:bg-orange-500/15 dark:text-orange-100"
                        />
                        <Situacao
                          qtde={p.preEntradas}
                          rotulo="pré-entrada"
                          classe="border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-500/60 dark:bg-violet-500/20 dark:text-violet-100"
                        />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-50">{p.itens}</td>
                    <td
                      className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-200"
                      title={
                        p.semData > 0 && p.menorDataEntrega
                          ? 'Data mais antiga entre os itens com data; há também item sem data'
                          : p.itens > 1
                            ? 'Data mais antiga entre os itens a atualizar'
                            : undefined
                      }
                    >
                      {p.menorDataEntrega ?? 'Sem data'}
                      {p.semData > 0 && p.menorDataEntrega ? (
                        <span className="block text-[11px] text-red-600 dark:text-red-300">+ item sem data</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap gap-1">
                        {p.semData > 0 ? <PrazoEntregaBadge dias={null} /> : null}
                        {p.menorDias != null ? <PrazoEntregaBadge dias={p.menorDias} /> : null}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAbrirPedido(p);
                        }}
                        className="whitespace-nowrap rounded border border-sky-600 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100 dark:border-sky-500 dark:bg-sky-500/15 dark:text-sky-100 dark:hover:bg-sky-500/25"
                      >
                        Atualizar datas
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {grade.colunaFiltroAberta && grade.filtroAbertoRect ? (
        <GradeFiltroExcelPortal
          colunaAberta={grade.colunaFiltroAberta}
          rect={grade.filtroAbertoRect}
          dropdownRef={grade.filtroDropdownRef}
          excelFilterDrafts={grade.excelFilterDrafts}
          setExcelFilterDrafts={grade.setExcelFilterDrafts}
          valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
          onSortAsc={(colId) => ordenar(colId, 'asc')}
          onSortDesc={(colId) => ordenar(colId, 'desc')}
          onAplicar={grade.aplicarFiltroExcel}
          onCancelar={grade.fecharFiltroExcel}
          showNumericFilters={COLUNAS_NUMERICAS.has(grade.colunaFiltroAberta)}
          showDateRangeFilters={COLUNAS_DATA.includes(grade.colunaFiltroAberta)}
        />
      ) : null}
    </div>
  );
}
