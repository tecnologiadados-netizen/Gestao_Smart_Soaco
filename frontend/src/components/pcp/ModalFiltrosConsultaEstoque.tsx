import MultiSelectWithSearch from '../MultiSelectWithSearch';
import SingleSelectWithSearch, { type OptionItem } from '../SingleSelectWithSearch';
import CarregandoInformacoesOverlay from '../CarregandoInformacoesOverlay';
import type {
  EmpenhoEscopoConsultaEstoque,
  ModoPedidoConsultaEstoque,
  OpcoesFiltroConsultaEstoque,
} from '../../api/consultaEstoque';

const labelClass = 'block text-xs text-slate-500 dark:text-slate-400 mb-1';
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100';

const BTN_FILTRAR =
  'inline-flex items-center justify-center rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 px-4 py-2 text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-300 disabled:opacity-50';

const BTN_LIMPAR =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';

export type FiltroSimNaoTodos = 'todos' | 'sim' | 'nao';

export type FiltrosConsultaEstoqueState = {
  codigos: string;
  descricoes: string;
  tipos: string;
  grupos: string;
  coletas: string;
  setoresProducao: string;
  subgrupo1: string;
  subgrupo2: string;
  comEmpenho: FiltroSimNaoTodos;
  comSaldoEstoque: FiltroSimNaoTodos;
};

export type PedidoFiltroConsultaEstoque = {
  pedido: OptionItem | null;
  modoPedido: ModoPedidoConsultaEstoque | null;
  empenhoEscopo: EmpenhoEscopoConsultaEstoque | null;
};

type Props = {
  open: boolean;
  carregando: boolean;
  msgFiltro: string | null;
  filtros: FiltrosConsultaEstoqueState;
  pedidoFiltro: PedidoFiltroConsultaEstoque;
  opcoes: OpcoesFiltroConsultaEstoque;
  onBuscarPedido?: (term: string) => Promise<OptionItem[]>;
  onClose: () => void;
  onChange: (patch: Partial<FiltrosConsultaEstoqueState>) => void;
  onPedidoChange: (pedido: OptionItem | null) => void;
  onAlterarEscolhasPedido: () => void;
  onLimpar: () => void;
  onFiltrar: () => void;
  onBuscarCodigo?: (term: string) => Promise<string[]>;
  onBuscarDescricao?: (term: string) => Promise<string[]>;
};

function splitPipe(s: string): string[] {
  return s.split('|').map((x) => x.trim()).filter(Boolean);
}

export function filtrosConsultaTemAlgumSelecionado(
  f: FiltrosConsultaEstoqueState,
  pedido?: OptionItem | null
): boolean {
  return (
    pedido != null ||
    f.codigos.trim() !== '' ||
    f.descricoes.trim() !== '' ||
    f.tipos.trim() !== '' ||
    f.grupos.trim() !== '' ||
    f.coletas.trim() !== '' ||
    f.setoresProducao.trim() !== '' ||
    f.subgrupo1.trim() !== '' ||
    f.subgrupo2.trim() !== ''
  );
}

export function filtrosStateToPayload(
  f: FiltrosConsultaEstoqueState,
  pedidoFiltro?: PedidoFiltroConsultaEstoque
) {
  const base = {
    codigos: splitPipe(f.codigos),
    descricoes: splitPipe(f.descricoes),
    tipos: splitPipe(f.tipos),
    grupos: splitPipe(f.grupos),
    coletas: splitPipe(f.coletas),
    setoresProducao: splitPipe(f.setoresProducao),
    subgrupo1: splitPipe(f.subgrupo1),
    subgrupo2: splitPipe(f.subgrupo2),
    comEmpenho: f.comEmpenho,
    comSaldoEstoque: f.comSaldoEstoque,
  };
  if (!pedidoFiltro?.pedido) return base;
  return {
    ...base,
    idPedido: pedidoFiltro.pedido.id,
    modoPedido: pedidoFiltro.modoPedido ?? undefined,
    empenhoEscopo: pedidoFiltro.empenhoEscopo ?? undefined,
  };
}

export function rotuloModoPedido(modo: ModoPedidoConsultaEstoque): string {
  return modo === 'diretos' ? 'Itens diretos' : 'Componentes';
}

export function rotuloEmpenhoEscopo(escopo: EmpenhoEscopoConsultaEstoque): string {
  return escopo === 'pedido' ? 'Somente deste pedido' : 'Todos os pedidos';
}

export default function ModalFiltrosConsultaEstoque({
  open,
  carregando,
  msgFiltro,
  filtros,
  pedidoFiltro,
  opcoes,
  onBuscarPedido,
  onClose,
  onChange,
  onPedidoChange,
  onAlterarEscolhasPedido,
  onLimpar,
  onFiltrar,
  onBuscarCodigo,
  onBuscarDescricao,
}: Props) {
  if (!open) return null;

  const pedidoCompleto =
    pedidoFiltro.pedido != null &&
    pedidoFiltro.modoPedido != null &&
    pedidoFiltro.empenhoEscopo != null;

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-600 dark:bg-slate-800 dark:shadow-black/40 overflow-x-hidden overflow-y-auto"
        style={{
          resize: 'both',
          overflowX: 'hidden',
          overflowY: 'auto',
          width: 'min(calc(100vw - 2rem), 72rem)',
          height: 'min(calc(100vh - 4rem), 36rem)',
          minWidth: '20rem',
          minHeight: '16rem',
          maxWidth: 'calc(100vw - 2rem)',
          maxHeight: 'calc(100vh - 2rem)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Filtros — consulta de estoque"
      >
        <div className="relative min-h-[14rem]">
          <CarregandoInformacoesOverlay
            show={carregando}
            mensagem="Carregando opções de filtro…"
            mode="contained"
            className="rounded-lg"
          />
          <div className={carregando ? 'pointer-events-none opacity-50' : undefined}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Filtros
              </p>
              <button
                type="button"
                onClick={onClose}
                className="ml-2 flex items-center justify-center w-6 h-6 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors"
                aria-label="Fechar painel de filtros"
              >
                ×
              </button>
            </div>

            <div className="grid min-w-0 grid-cols-1 items-end gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="min-w-0 xl:col-span-3">
                <SingleSelectWithSearch
                  label="Pedido de venda"
                  placeholder="Todos"
                  options={pedidoFiltro.pedido ? [pedidoFiltro.pedido] : []}
                  value={pedidoFiltro.pedido}
                  onChange={onPedidoChange}
                  labelClass={labelClass}
                  inputClass={inputClass}
                  onSearchAsync={onBuscarPedido}
                  fillContainer
                  listMaxHeight="200px"
                />
                {pedidoFiltro.pedido && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {pedidoCompleto ? (
                      <>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          Visualização:{' '}
                          <strong>{rotuloModoPedido(pedidoFiltro.modoPedido!)}</strong>
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          Empenho:{' '}
                          <strong>{rotuloEmpenhoEscopo(pedidoFiltro.empenhoEscopo!)}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={onAlterarEscolhasPedido}
                          className="text-primary-600 hover:underline dark:text-primary-400"
                        >
                          Alterar
                        </button>
                      </>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-300">
                        Selecione como visualizar o pedido e como calcular o empenho.
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <MultiSelectWithSearch
                  label="Código do Produto"
                  placeholder="Todos"
                  options={opcoes.codigos}
                  value={filtros.codigos}
                  onChange={(v) => onChange({ codigos: v })}
                  labelClass={labelClass}
                  inputClass={inputClass}
                  optionLabel="códigos"
                  valueSeparator="|"
                  fillContainer
                  minSearchChars={2}
                  onSearchAsync={onBuscarCodigo}
                />
              </div>
              <div className="min-w-0">
                <MultiSelectWithSearch
                  label="Descrição do Produto"
                  placeholder="Todas"
                  options={opcoes.descricoes}
                  value={filtros.descricoes}
                  onChange={(v) => onChange({ descricoes: v })}
                  labelClass={labelClass}
                  inputClass={inputClass}
                  optionLabel="descrições"
                  valueSeparator="|"
                  fillContainer
                  minSearchChars={2}
                  onSearchAsync={onBuscarDescricao}
                />
              </div>
              <div className="min-w-0">
                <MultiSelectWithSearch
                  label="Tipo de produto"
                  placeholder="Todos"
                  options={opcoes.tipos}
                  value={filtros.tipos}
                  onChange={(v) => onChange({ tipos: v })}
                  labelClass={labelClass}
                  inputClass={inputClass}
                  optionLabel="tipos"
                  valueSeparator="|"
                  fillContainer
                />
              </div>
              <div className="min-w-0">
                <MultiSelectWithSearch
                  label="Grupo de produto"
                  placeholder="Todos"
                  options={opcoes.grupos}
                  value={filtros.grupos}
                  onChange={(v) => onChange({ grupos: v })}
                  labelClass={labelClass}
                  inputClass={inputClass}
                  optionLabel="grupos"
                  valueSeparator="|"
                  fillContainer
                />
              </div>
              <div className="min-w-0">
                <MultiSelectWithSearch
                  label="Nome da coleta"
                  placeholder="Todas"
                  options={opcoes.coletas}
                  value={filtros.coletas}
                  onChange={(v) => onChange({ coletas: v })}
                  labelClass={labelClass}
                  inputClass={inputClass}
                  optionLabel="coletas"
                  valueSeparator="|"
                  fillContainer
                />
              </div>
              <div className="min-w-0">
                <MultiSelectWithSearch
                  label="Setor produção"
                  placeholder="Todos"
                  options={opcoes.setoresProducao}
                  value={filtros.setoresProducao}
                  onChange={(v) => onChange({ setoresProducao: v })}
                  labelClass={labelClass}
                  inputClass={inputClass}
                  optionLabel="setores"
                  valueSeparator="|"
                  fillContainer
                />
              </div>
              <div className="min-w-0">
                <MultiSelectWithSearch
                  label="Subgrupo 1"
                  placeholder="Todos"
                  options={opcoes.subgrupo1}
                  value={filtros.subgrupo1}
                  onChange={(v) => onChange({ subgrupo1: v })}
                  labelClass={labelClass}
                  inputClass={inputClass}
                  valueSeparator="|"
                  fillContainer
                />
              </div>
              <div className="min-w-0">
                <MultiSelectWithSearch
                  label="Subgrupo 2"
                  placeholder="Todos"
                  options={opcoes.subgrupo2}
                  value={filtros.subgrupo2}
                  onChange={(v) => onChange({ subgrupo2: v })}
                  labelClass={labelClass}
                  inputClass={inputClass}
                  valueSeparator="|"
                  fillContainer
                />
              </div>
              <div className="min-w-0">
                <label className={labelClass} htmlFor="filtro-com-empenho">
                  Com empenho?
                </label>
                <select
                  id="filtro-com-empenho"
                  className={inputClass}
                  value={filtros.comEmpenho}
                  onChange={(e) => onChange({ comEmpenho: e.target.value as FiltroSimNaoTodos })}
                >
                  <option value="todos">Todos</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
              <div className="min-w-0">
                <label className={labelClass} htmlFor="filtro-com-saldo-estoque">
                  Com saldo de estoque?
                </label>
                <select
                  id="filtro-com-saldo-estoque"
                  className={inputClass}
                  value={filtros.comSaldoEstoque}
                  onChange={(e) =>
                    onChange({ comSaldoEstoque: e.target.value as FiltroSimNaoTodos })
                  }
                >
                  <option value="todos">Todos</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={onFiltrar} disabled={carregando} className={BTN_FILTRAR}>
                Filtrar
              </button>
              <button type="button" onClick={onLimpar} disabled={carregando} className={BTN_LIMPAR}>
                Limpar filtros
              </button>
            </div>

            {msgFiltro && (
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-300" role="alert">
                {msgFiltro}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
