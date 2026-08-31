import { createPortal } from 'react-dom';

export type OpcaoEscolhaConsulta<T extends string> = {
  valor: T;
  titulo: string;
  descricao?: string;
};

type Props<TModo extends string, TEscopo extends string> = {
  open: boolean;
  zIndex: number;
  /** Linha de contexto no topo (ex.: "Pedido PD 50126" ou "Produto filtrado"). */
  contexto: React.ReactNode;
  perguntaModo: string;
  opcoesModo: OpcaoEscolhaConsulta<TModo>[];
  modoSelecionado: TModo | null;
  onSelecionarModo: (modo: TModo) => void;
  perguntaEscopo: string;
  opcoesEscopo: OpcaoEscolhaConsulta<TEscopo>[];
  onConfirmar: (escopo: TEscopo) => void;
  onCancelar: () => void;
};

/**
 * Modal de duas perguntas (como visualizar / como calcular o empenho) usado tanto pelo filtro
 * de pedido de venda quanto pelo filtro por produto da Consulta de Estoque.
 */
export default function ModalEscolhasConsultaEstoque<
  TModo extends string,
  TEscopo extends string,
>({
  open,
  zIndex,
  contexto,
  perguntaModo,
  opcoesModo,
  modoSelecionado,
  onSelecionarModo,
  perguntaEscopo,
  opcoesEscopo,
  onConfirmar,
  onCancelar,
}: Props<TModo, TEscopo>) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 p-4" style={{ zIndex }}>
      <div className="max-w-lg rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{contexto}</p>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">{perguntaModo}</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          {opcoesModo.map((op) => (
            <button
              key={op.valor}
              type="button"
              className={`flex-1 rounded-lg border px-3 py-2 text-sm text-left ${
                modoSelecionado === op.valor
                  ? 'border-primary-500 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/30'
                  : 'border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700'
              }`}
              onClick={() => onSelecionarModo(op.valor)}
            >
              <span className="font-medium">{op.titulo}</span>
              {op.descricao && (
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  {op.descricao}
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-700 dark:text-slate-200">{perguntaEscopo}</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          {opcoesEscopo.map((op) => (
            <button
              key={op.valor}
              type="button"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-left hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700"
              onClick={() => onConfirmar(op.valor)}
              disabled={!modoSelecionado}
            >
              <span className="font-medium">{op.titulo}</span>
              {op.descricao && (
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  {op.descricao}
                </span>
              )}
            </button>
          ))}
        </div>
        {!modoSelecionado && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            Escolha primeiro como visualizar os produtos.
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={onCancelar}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
