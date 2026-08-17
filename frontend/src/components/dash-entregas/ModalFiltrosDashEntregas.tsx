import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  obterDashEntregasFiltrosOpcoes,
  type DashEntregasFiltrosOpcoes,
  type FiltrosPedidos,
} from '../../api/pedidos';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import MultiSelectWithSearch from '../MultiSelectWithSearch';

export type FiltrosDashEntregasState = {
  observacoes: string;
  uf: string;
  municipio_entrega: string;
  vendedor: string;
  tipo_f: string;
  metodo: string;
  requisicao_loja: string;
  tipo_pedido: string;
  cliente: string;
  grupo_produto: string;
  subgrupo1: string;
  subgrupo2: string;
};

export const defaultFiltrosDashEntregas: FiltrosDashEntregasState = {
  observacoes: '',
  uf: '',
  municipio_entrega: '',
  vendedor: '',
  tipo_f: '',
  metodo: '',
  requisicao_loja: '',
  tipo_pedido: '',
  cliente: '',
  grupo_produto: '',
  subgrupo1: '',
  subgrupo2: '',
};

const emptyOpcoes: DashEntregasFiltrosOpcoes = {
  rotas: [],
  ufs: [],
  municipios: [],
  vendedores: [],
  tiposF: [],
  metodos: [],
  requisicoes: [],
  tiposPedido: [],
  clientes: [],
  gruposProduto: [],
  subgrupos1: [],
  subgrupos2: [],
};

const DROPDOWN_Z = 13100;

const inputClass =
  'w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent';
const labelClass = 'block text-xs text-slate-500 dark:text-slate-400 mb-1';

function normalizeMultiValue(v: string): string {
  if (!v?.trim()) return '';
  return v
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(',');
}

function mergeSelected(options: string[], selectedCsv: string): string[] {
  const selected = selectedCsv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (selected.length === 0) return options;
  const set = new Set(options);
  for (const s of selected) set.add(s);
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function filtrosDashToApi(f: FiltrosDashEntregasState): Omit<FiltrosPedidos, 'page' | 'limit'> {
  const out: Omit<FiltrosPedidos, 'page' | 'limit'> = {};
  if (f.observacoes.trim()) out.observacoes = f.observacoes.trim();
  if (f.uf.trim()) out.uf = f.uf.trim();
  if (f.municipio_entrega.trim()) out.municipio_entrega = f.municipio_entrega.trim();
  if (f.vendedor.trim()) out.vendedor = f.vendedor.trim();
  if (f.tipo_f.trim()) out.tipo_f = f.tipo_f.trim();
  if (f.metodo.trim()) out.metodo = f.metodo.trim();
  if (f.requisicao_loja.trim()) out.requisicao_loja = f.requisicao_loja.trim();
  if (f.tipo_pedido.trim()) out.tipo_pedido = f.tipo_pedido.trim();
  if (f.cliente.trim()) out.cliente = f.cliente.trim();
  if (f.grupo_produto.trim()) out.grupo_produto = f.grupo_produto.trim();
  if (f.subgrupo1.trim()) out.subgrupo1 = f.subgrupo1.trim();
  if (f.subgrupo2.trim()) out.subgrupo2 = f.subgrupo2.trim();
  return out;
}

export function countFiltrosDashAtivos(f: FiltrosDashEntregasState): number {
  return Object.values(f).filter((v) => String(v ?? '').trim()).length;
}

type Props = {
  open: boolean;
  filtros: FiltrosDashEntregasState;
  onClose: () => void;
  onAplicar: (filtros: FiltrosDashEntregasState) => void;
};

export default function ModalFiltrosDashEntregas({ open, filtros, onClose, onAplicar }: Props) {
  const [draft, setDraft] = useState<FiltrosDashEntregasState>(filtros);
  const [opcoes, setOpcoes] = useState<DashEntregasFiltrosOpcoes>(emptyOpcoes);
  const [loadingOpcoes, setLoadingOpcoes] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (!open) return;
    setDraft(filtros);
  }, [open, filtros]);

  const cascataDeps = useMemo(
    () =>
      [
        draft.observacoes,
        draft.uf,
        draft.municipio_entrega,
        draft.vendedor,
        draft.tipo_f,
        draft.metodo,
        draft.requisicao_loja,
        draft.tipo_pedido,
        draft.cliente,
        draft.grupo_produto,
        draft.subgrupo1,
        draft.subgrupo2,
      ].join('\u0001'),
    [draft]
  );

  const carregarOpcoes = useCallback(async (f: FiltrosDashEntregasState) => {
    setLoadingOpcoes(true);
    try {
      const data = await obterDashEntregasFiltrosOpcoes(filtrosDashToApi(f));
      setOpcoes(data);
    } catch {
      setOpcoes(emptyOpcoes);
    } finally {
      setLoadingOpcoes(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      void carregarOpcoes(draftRef.current);
    }, 450);
    return () => window.clearTimeout(t);
  }, [open, cascataDeps, carregarOpcoes]);

  useRegisterModalEscape({
    id: 'dash-entregas-filtros',
    onClose,
    zIndex: 13050,
    enabled: open,
  });

  const update = (key: keyof FiltrosDashEntregasState) => (value: string) => {
    setDraft((prev) => ({ ...prev, [key]: normalizeMultiValue(value) }));
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[13050] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
        role="dialog"
        aria-modal
        aria-labelledby="dash-entregas-filtros-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2
              id="dash-entregas-filtros-titulo"
              className="text-lg font-semibold text-slate-800 dark:text-slate-100"
            >
              Filtros do painel
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              As opções de cada campo reagem às seleções dos demais.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MultiSelectWithSearch
              label="Rota"
              placeholder="Todos"
              options={mergeSelected(opcoes.rotas, draft.observacoes)}
              value={draft.observacoes}
              onChange={update('observacoes')}
              labelClass={labelClass}
              inputClass={inputClass}
              fillContainer
              optionLabel="rotas"
              dropdownZIndex={DROPDOWN_Z}
              optionsLoading={loadingOpcoes}
              dropdownPortal
            />
            <MultiSelectWithSearch
              label="UF"
              placeholder="Todos"
              options={mergeSelected(opcoes.ufs, draft.uf)}
              value={draft.uf}
              onChange={update('uf')}
              labelClass={labelClass}
              inputClass={inputClass}
              fillContainer
              optionLabel="UFs"
              dropdownZIndex={DROPDOWN_Z}
              optionsLoading={loadingOpcoes}
              dropdownPortal
            />
            <MultiSelectWithSearch
              label="Município"
              placeholder="Todos"
              options={mergeSelected(opcoes.municipios, draft.municipio_entrega)}
              value={draft.municipio_entrega}
              onChange={update('municipio_entrega')}
              labelClass={labelClass}
              inputClass={inputClass}
              fillContainer
              optionLabel="municípios"
              dropdownZIndex={DROPDOWN_Z}
              optionsLoading={loadingOpcoes}
              dropdownPortal
            />
            <MultiSelectWithSearch
              label="Vendedor/Representante"
              placeholder="Todos"
              options={mergeSelected(opcoes.vendedores, draft.vendedor)}
              value={draft.vendedor}
              onChange={update('vendedor')}
              labelClass={labelClass}
              inputClass={inputClass}
              fillContainer
              optionLabel="vendedores"
              dropdownZIndex={DROPDOWN_Z}
              optionsLoading={loadingOpcoes}
              dropdownPortal
            />
            <MultiSelectWithSearch
              label="TipoF"
              placeholder="Todos"
              options={mergeSelected(opcoes.tiposF, draft.tipo_f)}
              value={draft.tipo_f}
              onChange={update('tipo_f')}
              labelClass={labelClass}
              inputClass={inputClass}
              fillContainer
              optionLabel="tipos"
              dropdownZIndex={DROPDOWN_Z}
              optionsLoading={loadingOpcoes}
              dropdownPortal
            />
            <MultiSelectWithSearch
              label="Método"
              placeholder="Todos"
              options={mergeSelected(opcoes.metodos, draft.metodo)}
              value={draft.metodo}
              onChange={update('metodo')}
              labelClass={labelClass}
              inputClass={inputClass}
              fillContainer
              optionLabel="métodos"
              dropdownZIndex={DROPDOWN_Z}
              optionsLoading={loadingOpcoes}
              dropdownPortal
            />
            <MultiSelectWithSearch
              label="Requisição"
              placeholder="Todos"
              options={mergeSelected(opcoes.requisicoes, draft.requisicao_loja)}
              value={draft.requisicao_loja}
              onChange={update('requisicao_loja')}
              labelClass={labelClass}
              inputClass={inputClass}
              fillContainer
              optionLabel="valores"
              dropdownZIndex={DROPDOWN_Z}
              optionsLoading={loadingOpcoes}
              dropdownPortal
            />
            <MultiSelectWithSearch
              label="Tipo de pedido"
              placeholder="Todos"
              options={mergeSelected(opcoes.tiposPedido, draft.tipo_pedido)}
              value={draft.tipo_pedido}
              onChange={update('tipo_pedido')}
              labelClass={labelClass}
              inputClass={inputClass}
              fillContainer
              optionLabel="tipos"
              dropdownZIndex={DROPDOWN_Z}
              optionsLoading={loadingOpcoes}
              dropdownPortal
            />
            <MultiSelectWithSearch
              label="Cliente"
              placeholder="Todos"
              options={mergeSelected(opcoes.clientes, draft.cliente)}
              value={draft.cliente}
              onChange={update('cliente')}
              labelClass={labelClass}
              inputClass={inputClass}
              fillContainer
              optionLabel="clientes"
              dropdownZIndex={DROPDOWN_Z}
              optionsLoading={loadingOpcoes}
              dropdownPortal
            />
            <MultiSelectWithSearch
              label="Grupo de Produto"
              placeholder="Todos"
              options={mergeSelected(opcoes.gruposProduto, draft.grupo_produto)}
              value={draft.grupo_produto}
              onChange={update('grupo_produto')}
              labelClass={labelClass}
              inputClass={inputClass}
              fillContainer
              optionLabel="grupos"
              dropdownZIndex={DROPDOWN_Z}
              optionsLoading={loadingOpcoes}
              dropdownPortal
            />
            <MultiSelectWithSearch
              label="Subgrupo1"
              placeholder="Todos"
              options={mergeSelected(opcoes.subgrupos1, draft.subgrupo1)}
              value={draft.subgrupo1}
              onChange={update('subgrupo1')}
              labelClass={labelClass}
              inputClass={inputClass}
              fillContainer
              optionLabel="subgrupos"
              dropdownZIndex={DROPDOWN_Z}
              optionsLoading={loadingOpcoes}
              dropdownPortal
            />
            <MultiSelectWithSearch
              label="Subgrupo2"
              placeholder="Todos"
              options={mergeSelected(opcoes.subgrupos2, draft.subgrupo2)}
              value={draft.subgrupo2}
              onChange={update('subgrupo2')}
              labelClass={labelClass}
              inputClass={inputClass}
              fillContainer
              optionLabel="subgrupos"
              dropdownZIndex={DROPDOWN_Z}
              optionsLoading={loadingOpcoes}
              dropdownPortal
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setDraft({ ...defaultFiltrosDashEntregas })}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onAplicar(draft)}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Aplicar filtros
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
