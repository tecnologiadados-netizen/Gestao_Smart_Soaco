import { useState, useEffect } from 'react';
import { listarMotivosSugestao, type MotivoSugestao } from '../api/motivosSugestao';
import type { FiltrosOpcoes } from '../api/pedidos';
import MultiSelectWithSearch from './MultiSelectWithSearch';

export interface FiltrosPedidosState {
  cliente: string;
  observacoes: string;
  pd: string;
  cod: string;
  data_emissao_ini: string;
  data_emissao_fim: string;
  data_entrega_ini: string;
  data_entrega_fim: string;
  data_previsao_anterior_ini: string;
  data_previsao_anterior_fim: string;
  data_previsao_ini: string;
  data_previsao_fim: string;
  data_ini?: string;
  data_fim?: string;
  atrasados: boolean;
  grupo_produto: string;
  subgrupo1: string;
  subgrupo2: string;
  setor_producao: string;
  uf: string;
  municipio_entrega: string;
  motivo: string;
  vendedor: string;
  tipo_f: string;
  status: string;
  metodo: string;
  tipo_pedido: string;
  requisicao_loja: string;
  empresa: string;
  a_vista: string;
  /** Mais filtros: '' ou lista CSV 'sim' | 'nao' | 'branco' (multi). */
  previsao_confiavel: string;
}

export type FiltroPedidosVariant = 'completo' | 'modal';

/** z-index dos dropdowns dentro de modais (acima do backdrop z-50). */
const DROPDOWN_Z_MODAL = 10060;

/** Filtros do modal "Mais filtros" (Gerenciador de Pedidos) com valor preenchido. */
export function countFiltrosModalAtivos(f: FiltrosPedidosState): number {
  let n = 0;
  if (f.vendedor?.trim()) n++;
  if (f.status?.trim()) n++;
  if (f.metodo?.trim()) n++;
  if (f.previsao_confiavel?.trim()) n++;
  if (f.tipo_pedido?.trim()) n++;
  if (f.grupo_produto?.trim()) n++;
  if (f.subgrupo1?.trim()) n++;
  if (f.subgrupo2?.trim()) n++;
  if (f.requisicao_loja?.trim()) n++;
  if (f.empresa?.trim()) n++;
  if (f.tipo_f?.trim()) n++;
  if (f.a_vista?.trim()) n++;
  return n;
}

/** @deprecated Use countFiltrosModalAtivos */
export const countFiltrosAvancadosAtivos = countFiltrosModalAtivos;

interface FiltroPedidosProps {
  filtros: FiltrosPedidosState;
  onChange: (f: FiltrosPedidosState) => void;
  onAplicar: () => void;
  onLimpar?: () => void;
  /** `modal`: filtros analíticos do Gerenciador. `completo`: todos os filtros (outras telas). */
  variant?: FiltroPedidosVariant;
}

export const defaultFiltros: FiltrosPedidosState = {
  cliente: '',
  observacoes: '',
  pd: '',
  cod: '',
  data_emissao_ini: '',
  data_emissao_fim: '',
  data_entrega_ini: '',
  data_entrega_fim: '',
  data_previsao_anterior_ini: '',
  data_previsao_anterior_fim: '',
  data_previsao_ini: '',
  data_previsao_fim: '',
  atrasados: false,
  grupo_produto: '',
  subgrupo1: '',
  subgrupo2: '',
  setor_producao: '',
  uf: '',
  municipio_entrega: '',
  motivo: '',
  vendedor: '',
  tipo_f: '',
  status: '',
  metodo: '',
  tipo_pedido: '',
  requisicao_loja: '',
  empresa: '',
  a_vista: '',
  previsao_confiavel: '',
  data_ini: '',
  data_fim: '',
};

const btnPrimaryClass =
  'px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition shrink-0';

const defaultOpcoes: FiltrosOpcoes = {
  rotas: [],
  categorias: [],
  status: [],
  metodos: [],
  ufs: [],
  municipios: [],
  formasPagamento: [],
  gruposProduto: [],
  subgrupos1: [],
  subgrupos2: [],
  pds: [],
  setores: [],
  vendedores: [],
  clientes: [],
  codigos: [],
  requisicoes: [],
  tiposPedido: [],
  empresas: [],
  aVista: [],
};

/** Normaliza valor salvo: aceita vírgula ou pipe (legado) e envia vírgula ao backend. */
function normalizeMultiValue(v: string): string {
  if (!v?.trim()) return '';
  return v
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(',');
}

export default function FiltroPedidos({
  filtros,
  onChange,
  onAplicar,
  onLimpar,
  variant = 'completo',
}: FiltroPedidosProps) {
  const [opcoes, setOpcoes] = useState<FiltrosOpcoes>(defaultOpcoes);
  const [motivos, setMotivos] = useState<MotivoSugestao[]>([]);

  useEffect(() => {
    import('../api/pedidos')
      .then(({ obterFiltrosOpcoes }) => obterFiltrosOpcoes())
      .then(setOpcoes)
      .catch(() => setOpcoes(defaultOpcoes));
  }, []);

  useEffect(() => {
    if (variant !== 'completo') return;
    listarMotivosSugestao()
      .then(setMotivos)
      .catch(() => setMotivos([]));
  }, [variant]);

  const f = { ...defaultFiltros, ...filtros };
  const inputClass =
    'w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent';
  const labelClass = 'block text-xs text-slate-500 dark:text-slate-400 mb-1';

  const update = (key: keyof FiltrosPedidosState, value: string | boolean) => {
    onChange({ ...filtros, [key]: value });
  };

  const handleMultiChange = (key: keyof FiltrosPedidosState) => (value: string) => {
    update(key, normalizeMultiValue(value));
  };

  const isModal = variant === 'modal';
  const isCompleto = variant === 'completo';
  const wrapClass = isModal
    ? 'flex flex-wrap items-end gap-3'
    : 'flex flex-wrap items-end gap-3 p-4 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50';

  return (
    <div className={wrapClass}>
      {isModal && (
        <>
          <MultiSelectWithSearch
            label="Vendedor/Representante"
            placeholder="Todos"
            options={opcoes.vendedores}
            value={f.vendedor}
            onChange={handleMultiChange('vendedor')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="200px"
            optionLabel="vendedores"
            dropdownZIndex={DROPDOWN_Z_MODAL}
          />
          <MultiSelectWithSearch
            label="Status"
            placeholder="Todos"
            options={opcoes.status}
            value={f.status}
            onChange={handleMultiChange('status')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="140px"
            optionLabel="status"
            dropdownZIndex={DROPDOWN_Z_MODAL}
          />
          <MultiSelectWithSearch
            label="Método de entrega"
            placeholder="Todos"
            options={opcoes.metodos}
            value={f.metodo}
            onChange={handleMultiChange('metodo')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="200px"
            optionLabel="métodos de entrega"
            dropdownZIndex={DROPDOWN_Z_MODAL}
          />
          <MultiSelectWithSearch
            label="Tipo de pedido"
            placeholder="Todos"
            options={opcoes.tiposPedido}
            value={f.tipo_pedido}
            onChange={handleMultiChange('tipo_pedido')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="180px"
            optionLabel="tipos"
            dropdownZIndex={DROPDOWN_Z_MODAL}
          />
          <MultiSelectWithSearch
            label="Grupo de produto"
            placeholder="Todos"
            options={opcoes.gruposProduto}
            value={f.grupo_produto}
            onChange={handleMultiChange('grupo_produto')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="180px"
            optionLabel="grupos"
            dropdownZIndex={DROPDOWN_Z_MODAL}
          />
          <MultiSelectWithSearch
            label="Subgrupo1"
            placeholder="Todos"
            options={opcoes.subgrupos1}
            value={f.subgrupo1}
            onChange={handleMultiChange('subgrupo1')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="180px"
            optionLabel="subgrupos"
            dropdownZIndex={DROPDOWN_Z_MODAL}
          />
          <MultiSelectWithSearch
            label="Subgrupo2"
            placeholder="Todos"
            options={opcoes.subgrupos2}
            value={f.subgrupo2}
            onChange={handleMultiChange('subgrupo2')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="180px"
            optionLabel="subgrupos"
            dropdownZIndex={DROPDOWN_Z_MODAL}
          />
          <MultiSelectWithSearch
            label="Requisição"
            placeholder="Todos"
            options={opcoes.requisicoes}
            value={f.requisicao_loja}
            onChange={handleMultiChange('requisicao_loja')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="150px"
            optionLabel="opções"
            dropdownZIndex={DROPDOWN_Z_MODAL}
          />
          <MultiSelectWithSearch
            label="Venda por qual empresa?"
            placeholder="Todas"
            options={opcoes.empresas}
            value={f.empresa}
            onChange={handleMultiChange('empresa')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="190px"
            optionLabel="empresas"
            dropdownZIndex={DROPDOWN_Z_MODAL}
          />
          <MultiSelectWithSearch
            label="TipoF"
            placeholder="Todos"
            options={opcoes.categorias}
            value={f.tipo_f}
            onChange={handleMultiChange('tipo_f')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="150px"
            optionLabel="tipos"
            dropdownZIndex={DROPDOWN_Z_MODAL}
          />
          <MultiSelectWithSearch
            label="Entrada/A vista Ate 10d"
            placeholder="Todos"
            options={opcoes.aVista}
            value={f.a_vista}
            onChange={handleMultiChange('a_vista')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="190px"
            optionLabel="opções"
            dropdownZIndex={DROPDOWN_Z_MODAL}
          />
          <MultiSelectWithSearch
            label="Previsão confiável"
            placeholder="Todos"
            options={['sim', 'nao', 'branco']}
            labelByValue={{
              sim: 'Confiáveis',
              nao: 'Não confiáveis',
              branco: 'Em branco',
            }}
            value={f.previsao_confiavel}
            onChange={handleMultiChange('previsao_confiavel')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="180px"
            optionLabel="opções"
            dropdownZIndex={DROPDOWN_Z_MODAL}
          />
        </>
      )}
      {isCompleto && (
        <>
          <MultiSelectWithSearch
            label="Cliente"
            placeholder="Todos"
            options={opcoes.clientes}
            value={f.cliente}
            onChange={handleMultiChange('cliente')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="180px"
            optionLabel="clientes"
          />
          <MultiSelectWithSearch
            label="Rota"
            placeholder="Todas"
            options={opcoes.rotas}
            value={f.observacoes}
            onChange={handleMultiChange('observacoes')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="180px"
            optionLabel="rotas"
          />
          <MultiSelectWithSearch
            label="Pedido"
            placeholder="Todos"
            options={opcoes.pds}
            value={f.pd}
            onChange={handleMultiChange('pd')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="140px"
            optionLabel="pedidos"
          />
          <MultiSelectWithSearch
            label="Código do Produto"
            placeholder="Todos"
            options={opcoes.codigos}
            value={f.cod}
            onChange={handleMultiChange('cod')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="160px"
            optionLabel="códigos"
          />
          <MultiSelectWithSearch
            label="Setor de produção"
            placeholder="Todos"
            options={opcoes.setores}
            value={f.setor_producao}
            onChange={handleMultiChange('setor_producao')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="140px"
            optionLabel="setores"
          />
          <MultiSelectWithSearch
            label="UF"
            placeholder="Todas"
            options={opcoes.ufs}
            value={f.uf}
            onChange={handleMultiChange('uf')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="100px"
            optionLabel="UFs"
          />
          <MultiSelectWithSearch
            label="Município"
            placeholder="Todos"
            options={opcoes.municipios}
            value={f.municipio_entrega}
            onChange={handleMultiChange('municipio_entrega')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="160px"
            optionLabel="municípios"
          />
          <MultiSelectWithSearch
            label="Motivo"
            placeholder="Todos"
            options={motivos.map((m) => m.descricao)}
            value={f.motivo}
            onChange={handleMultiChange('motivo')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="180px"
            optionLabel="motivos"
          />
          <MultiSelectWithSearch
            label="Vendedor/Representante"
            placeholder="Todos"
            options={opcoes.vendedores}
            value={f.vendedor}
            onChange={handleMultiChange('vendedor')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="160px"
            optionLabel="vendedores"
          />
          <MultiSelectWithSearch
            label="Categoria"
            placeholder="Todas"
            options={opcoes.categorias}
            value={f.tipo_f}
            onChange={handleMultiChange('tipo_f')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="160px"
            optionLabel="categorias"
          />
          <MultiSelectWithSearch
            label="Status"
            placeholder="Todos"
            options={opcoes.status}
            value={f.status}
            onChange={handleMultiChange('status')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="120px"
            optionLabel="status"
          />
          <MultiSelectWithSearch
            label="Método de entrega"
            placeholder="Todos"
            options={opcoes.metodos}
            value={f.metodo}
            onChange={handleMultiChange('metodo')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="180px"
            optionLabel="métodos de entrega"
          />
          <MultiSelectWithSearch
            label="Grupo de produto"
            placeholder="Todos"
            options={opcoes.gruposProduto}
            value={f.grupo_produto}
            onChange={handleMultiChange('grupo_produto')}
            labelClass={labelClass}
            inputClass={inputClass}
            minWidth="160px"
            optionLabel="grupos"
          />
          <label className="flex shrink-0 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={f.atrasados}
              onChange={(e) => update('atrasados', e.target.checked)}
              className="rounded border-slate-400 bg-white text-primary-600 focus:ring-primary-600 dark:border-slate-600 dark:bg-slate-700"
            />
            <span className="text-sm text-slate-600 dark:text-slate-300">Somente atrasados</span>
          </label>
        </>
      )}
      <button type="button" onClick={onAplicar} className={btnPrimaryClass}>
        Filtrar
      </button>
      {onLimpar && (
        <button type="button" onClick={onLimpar} className={btnPrimaryClass} title="Limpar todos os filtros">
          Limpar filtros
        </button>
      )}
    </div>
  );
}
