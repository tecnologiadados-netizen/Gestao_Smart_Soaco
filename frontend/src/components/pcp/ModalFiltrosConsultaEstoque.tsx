import MultiSelectWithSearch from '../MultiSelectWithSearch';
import SingleSelectWithSearch, { type OptionItem } from '../SingleSelectWithSearch';
import CarregandoInformacoesOverlay from '../CarregandoInformacoesOverlay';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
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
  /** Pipe-separated — só Cobertura. */
  familias: string;
  comEmpenho: FiltroSimNaoTodos;
  comSaldoEstoque: FiltroSimNaoTodos;
};

export const ORIGENS_EMPENHO_COBERTURA = ['Pedidos de venda', 'Requisições de loja'] as const;
export const ORIGENS_EMPENHO_COBERTURA_TODAS = ORIGENS_EMPENHO_COBERTURA.join('|');

export function origensEmpenhoIncluiRequisicoes(origens: string): boolean {
  const sel = origens.split('|').map((s) => s.trim()).filter(Boolean);
  if (sel.length === 0) return true;
  return sel.includes('Requisições de loja');
}

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
  /** `cobertura` oculta pedido, tipo, grupo, setor, subgrupos e sim/não de empenho/saldo. */
  modo?: 'consulta' | 'cobertura';
  origensEmpenho?: string;
  onOrigensEmpenhoChange?: (v: string) => void;
  somenteComEmpenho?: boolean;
  onSomenteComEmpenhoChange?: (v: boolean) => void;
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
    f.familias.trim() !== '' ||
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
    familias: splitPipe(f.familias),
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
  modo = 'consulta',
  origensEmpenho = '',
  onOrigensEmpenhoChange,
  somenteComEmpenho = false,
  onSomenteComEmpenhoChange,
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
  useRegisterModalEscape({
    id: modo === 'cobertura' ? 'cobertura-estoque-filtros' : 'consulta-estoque-filtros',
    onClose,
    zIndex: 10040,
    enabled: open,
  });

  if (!open) return null;

  const isCobertura = modo === 'cobertura';
  const pedidoCompleto =
    pedidoFiltro.pedido != null &&
    pedidoFiltro.modoPedido != null &&
    pedidoFiltro.empenhoEscopo != null;

  return (
    <div
      className="fixed inset-0 z-[10040] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[min(100vh-2rem,40rem)] w-[min(calc(100vw-2rem),72rem)] min-w-[20rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800 dark:shadow-black/40"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isCobertura ? 'Filtros — cobertura de estoque' : 'Filtros — consulta de estoque'}
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <CarregandoInformacoesOverlay
            show={carregando}
            mensagem="Carregando opções de filtro…"
            mode="contained"
            className="rounded-lg"
          />
          <div
            className={`flex min-h-0 flex-1 flex-col overflow-hidden ${carregando ? 'pointer-events-none opacity-50' : ''}`}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-600">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Filtros
              </p>
              <button
                type="button"
                onClick={onClose}
                className="ml-2 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                aria-label="Fechar painel de filtros"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
              <div className="grid min-w-0 grid-cols-1 items-end gap-4 md:grid-cols-2 xl:grid-cols-3">
                {!isCobertura && (
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
                    dropdownPortal
                    dropdownZIndex={10100}
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
                )}
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
                    dropdownPortal
                    dropdownZIndex={10100}
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
                    dropdownPortal
                    dropdownZIndex={10100}
                    minSearchChars={2}
                    onSearchAsync={onBuscarDescricao}
                  />
                </div>
                {!isCobertura && (
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
                    dropdownPortal
                    dropdownZIndex={10100}
                    />
                  </div>
                )}
                {!isCobertura && (
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
                    dropdownPortal
                    dropdownZIndex={10100}
                    />
                  </div>
                )}
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
                    dropdownPortal
                    dropdownZIndex={10100}
                  />
                </div>
                {isCobertura && (
                  <div className="min-w-0">
                    <MultiSelectWithSearch
                      label="Família"
                      placeholder="Todas"
                      options={opcoes.familias ?? []}
                      value={filtros.familias}
                      onChange={(v) => onChange({ familias: v })}
                      labelClass={labelClass}
                      inputClass={inputClass}
                      optionLabel="famílias"
                      valueSeparator="|"
                      fillContainer
                      dropdownPortal
                      dropdownZIndex={10100}
                    />
                  </div>
                )}
                {isCobertura && (
                  <div className="min-w-0 xl:col-span-3">
                    <p className={labelClass}>Universo do painel</p>
                    <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-600 dark:bg-slate-900/40">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={somenteComEmpenho}
                        aria-label="Considerar somente produtos com empenho"
                        disabled={carregando}
                        onClick={() => onSomenteComEmpenhoChange?.(!somenteComEmpenho)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 ${
                          somenteComEmpenho ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
                            somenteComEmpenho ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        Considerar somente produtos com empenho?
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Desligado (padrão): inclui itens com e sem empenho. Ligado: restringe a empenho &gt; 0.
                    </p>
                  </div>
                )}
                {!isCobertura && (
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
                    dropdownPortal
                    dropdownZIndex={10100}
                    />
                  </div>
                )}
                {!isCobertura && (
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
                    dropdownPortal
                    dropdownZIndex={10100}
                    />
                  </div>
                )}
                {!isCobertura && (
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
                    dropdownPortal
                    dropdownZIndex={10100}
                    />
                  </div>
                )}
                {!isCobertura && (
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
                )}
                {!isCobertura && (
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
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-600">
              <button type="button" onClick={onFiltrar} disabled={carregando} className={BTN_FILTRAR}>
                Filtrar
              </button>
              <button type="button" onClick={onLimpar} disabled={carregando} className={BTN_LIMPAR}>
                Limpar filtros
              </button>
              {msgFiltro && (
                <p className="w-full text-sm text-amber-700 dark:text-amber-300" role="alert">
                  {msgFiltro}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
