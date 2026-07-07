import MultiSelectWithSearch from '../MultiSelectWithSearch';

export type SycroOrderFiltrosState = {
  pedido: string;
  criadoPor: string;
  ultimaRespostaPor: string;
  formaEntrega: string;
  responsavel: string;
  vendedor: string;
  acao: string;
  entrega7d: 'todos' | 'sim' | 'nao';
  leitura: 'todos' | 'lidos' | 'nao_lidos';
};

type SycroOrderFiltrosBarProps = {
  /** `inline`: na mesma linha do título, sem caixa separada. */
  variant?: 'bar' | 'inline';
  /** Oculta Faturado/Entregue e Novo Card (renderizados no cabeçalho da página). */
  hideActionButtons?: boolean;
  filtros: SycroOrderFiltrosState;
  opcoes: {
    pedido: string[];
    criadoPor: string[];
    ultimaRespostaPor: string[];
    formaEntrega: string[];
    responsavel: string[];
    vendedor: string[];
    acao: string[];
  };
  temFiltro: boolean;
  onChange: React.Dispatch<React.SetStateAction<SycroOrderFiltrosState>>;
  onLimpar: () => void;
  onFaturadoEntregue?: () => void;
  faturadoCount?: number;
  onNovoCard: () => void;
};

const inputClass =
  'w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent';
const labelClass = 'block text-xs text-slate-500 dark:text-slate-400 mb-1';

function segmentBtn(active: boolean) {
  return `px-2.5 py-2 rounded-lg border text-xs font-medium transition whitespace-nowrap ${
    active
      ? 'bg-primary-600 border-primary-600 text-white'
      : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
  }`;
}

export default function SycroOrderFiltrosBar({
  variant = 'bar',
  hideActionButtons = false,
  filtros,
  opcoes,
  temFiltro,
  onChange,
  onLimpar,
  onFaturadoEntregue,
  faturadoCount = 0,
  onNovoCard,
}: SycroOrderFiltrosBarProps) {
  const inline = variant === 'inline';
  const setMulti = (
    key: keyof Pick<
      SycroOrderFiltrosState,
      'pedido' | 'criadoPor' | 'ultimaRespostaPor' | 'formaEntrega' | 'responsavel' | 'vendedor' | 'acao'
    >
  ) => (value: string) => {
    onChange((p) => ({ ...p, [key]: value }));
  };

  const content = (
    <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
      <MultiSelectWithSearch
        label="Pedido"
        placeholder="Todos"
        options={opcoes.pedido}
        value={filtros.pedido}
        onChange={setMulti('pedido')}
        labelClass={labelClass}
        inputClass={inputClass}
        minWidth="130px"
        optionLabel="pedidos"
      />
      <MultiSelectWithSearch
        label="Criado por"
        placeholder="Todos"
        options={opcoes.criadoPor}
        value={filtros.criadoPor}
        onChange={setMulti('criadoPor')}
        labelClass={labelClass}
        inputClass={inputClass}
        minWidth="150px"
        optionLabel="criadores"
      />
      <MultiSelectWithSearch
        label="Última resposta por"
        placeholder="Todos"
        options={opcoes.ultimaRespostaPor}
        value={filtros.ultimaRespostaPor}
        onChange={setMulti('ultimaRespostaPor')}
        labelClass={labelClass}
        inputClass={inputClass}
        minWidth="160px"
        optionLabel="respondentes"
      />
      <MultiSelectWithSearch
        label="Forma de entrega"
        placeholder="Todas"
        options={opcoes.formaEntrega}
        value={filtros.formaEntrega}
        onChange={setMulti('formaEntrega')}
        labelClass={labelClass}
        inputClass={inputClass}
        minWidth="180px"
        optionLabel="formas"
      />
      <MultiSelectWithSearch
        label="Responsável por responder"
        placeholder="Todos"
        options={opcoes.responsavel}
        value={filtros.responsavel}
        onChange={setMulti('responsavel')}
        labelClass={labelClass}
        inputClass={inputClass}
        minWidth="160px"
        optionLabel="responsáveis"
      />
      <MultiSelectWithSearch
        label="Vendedor/Representante"
        placeholder="Todos"
        options={opcoes.vendedor}
        value={filtros.vendedor}
        onChange={setMulti('vendedor')}
        labelClass={labelClass}
        inputClass={inputClass}
        minWidth="180px"
        optionLabel="vendedores"
      />
      <MultiSelectWithSearch
        label="Ação"
        placeholder="Todas"
        options={opcoes.acao}
        value={filtros.acao}
        onChange={setMulti('acao')}
        labelClass={labelClass}
        inputClass={inputClass}
        minWidth="160px"
        optionLabel="ações"
      />
      <div className="shrink-0">
        <span className={labelClass}>Leitura</span>
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => onChange((p) => ({ ...p, leitura: 'nao_lidos' }))} className={segmentBtn(filtros.leitura === 'nao_lidos')}>
            Não lidos
          </button>
          <button type="button" onClick={() => onChange((p) => ({ ...p, leitura: 'lidos' }))} className={segmentBtn(filtros.leitura === 'lidos')}>
            Lidos
          </button>
          <button type="button" onClick={() => onChange((p) => ({ ...p, leitura: 'todos' }))} className={segmentBtn(filtros.leitura === 'todos')}>
            Todos
          </button>
        </div>
      </div>
      <div className="shrink-0">
        <span className={labelClass}>Entrega em 7 dias</span>
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => onChange((p) => ({ ...p, entrega7d: 'sim' }))} className={segmentBtn(filtros.entrega7d === 'sim')}>
            Sim
          </button>
          <button type="button" onClick={() => onChange((p) => ({ ...p, entrega7d: 'nao' }))} className={segmentBtn(filtros.entrega7d === 'nao')}>
            Não
          </button>
          <button type="button" onClick={() => onChange((p) => ({ ...p, entrega7d: 'todos' }))} className={segmentBtn(filtros.entrega7d === 'todos')}>
            Todos
          </button>
        </div>
      </div>
      {temFiltro && (
        <button type="button" onClick={onLimpar} className="shrink-0 pb-2 text-sm text-primary-600 hover:underline dark:text-primary-400">
          Limpar filtros
        </button>
      )}
      {!hideActionButtons && (
      <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
        {onFaturadoEntregue && (
          <button
            type="button"
            onClick={onFaturadoEntregue}
            className="inline-flex items-center gap-2 rounded-lg border border-green-600 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 transition hover:bg-green-100 dark:border-green-500 dark:bg-green-950/40 dark:text-green-200 dark:hover:bg-green-900/50"
          >
            Faturado/Entregue
          </button>
        )}
        <button
          type="button"
          onClick={onNovoCard}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
        >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
          + Novo Card
        </button>
      </div>
      )}
    </div>
  );

  if (inline) return content;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-3">
      {content}
    </div>
  );
}
