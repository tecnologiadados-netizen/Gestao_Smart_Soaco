import { useCallback, useState } from 'react';
import type { Pedido } from '../api/pedidos';
import ModalHistoricoPedido from './ModalHistoricoPedido';

function getField(row: Pedido, keys: string[]): string {
  for (const k of keys) {
    const v = row[k as keyof Pedido];
    if (v != null && String(v).length > 0) return String(v);
  }
  return '';
}

function formatDate(value: string | Date): string {
  if (value == null) return '—';
  const s = typeof value === 'string' ? value : value.toISOString?.() ?? '';
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function formatQtde(value: unknown): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return Math.round(n).toLocaleString('pt-BR');
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

const COLUMNS = [
  { id: 'pd', label: 'Pedido', keys: ['PD'] },
  { id: 'cliente', label: 'Cliente', keys: ['Cliente'] },
  { id: 'cod', label: 'Código', keys: ['Cod'] },
  { id: 'descricao', label: 'Descrição', keys: ['Descricao do produto'] },
  { id: 'qtde', label: 'Qtde pedida', keys: ['Qtde pedida'] },
  { id: 'status', label: 'Status (ERP)', keys: ['Stauts', 'Status'] },
  { id: 'data_original', label: 'Data original', keys: ['Data de entrega', 'dataParametro'] },
  { id: 'historico', label: 'Histórico', keys: [] as string[] },
] as const;

export interface PedidosEncerradosGradeProps {
  pedidos: Pedido[];
  loading?: boolean;
  /** true após o usuário clicar em Filtrar ao menos uma vez */
  buscaRealizada?: boolean;
  mensagemVazia?: string;
}

export default function PedidosEncerradosGrade({
  pedidos,
  loading = false,
  buscaRealizada = false,
  mensagemVazia = 'Nenhuma linha encerrada encontrada para este pedido.',
}: PedidosEncerradosGradeProps) {
  const [historicoPedido, setHistoricoPedido] = useState<Pedido | null>(null);
  const [historicoOpen, setHistoricoOpen] = useState(false);

  const onVerHistorico = useCallback((pedido: Pedido) => {
    setHistoricoPedido(pedido);
    setHistoricoOpen(true);
  }, []);

  const fecharHistorico = useCallback(() => {
    setHistoricoOpen(false);
    setHistoricoPedido(null);
  }, []);

  if (!buscaRealizada) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
        Informe o número do pedido (PD) e clique em Filtrar para consultar.
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">Carregando...</p>;
  }

  if (pedidos.length === 0) {
    return (
      <div className="card-panel p-8 text-center">
        <p className="font-medium text-soaco-navy dark:text-soaco-white">{mensagemVazia}</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-600">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-700/80 text-left text-slate-700 dark:text-slate-200">
              {COLUMNS.map((col) => (
                <th key={col.id} className="p-3 font-medium whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr
                key={p.id_pedido}
                className="border-t border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                {COLUMNS.map((col) => {
                  if (col.id === 'historico') {
                    return (
                      <td key={col.id} className="p-3">
                        <button
                          type="button"
                          onClick={() => onVerHistorico(p)}
                          className="rounded p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600/50 hover:text-slate-700 dark:hover:text-slate-200 transition"
                          title="Ver histórico de alterações"
                          aria-label="Ver histórico"
                        >
                          <ClockIcon />
                        </button>
                      </td>
                    );
                  }
                  const raw = getField(p, [...col.keys]);
                  let display: string;
                  if (col.id === 'data_original') {
                    display = formatDate(raw);
                  } else if (col.id === 'qtde') {
                    display = formatQtde(p['Qtde pedida']);
                  } else {
                    display = raw || '—';
                  }
                  return (
                    <td
                      key={col.id}
                      className={`p-3 text-slate-700 dark:text-slate-200 ${
                        col.id === 'descricao' || col.id === 'cliente' ? 'max-w-xs truncate' : ''
                      }`}
                      title={col.id === 'descricao' || col.id === 'cliente' ? display : undefined}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalHistoricoPedido pedido={historicoPedido} open={historicoOpen} onClose={fecharHistorico} />
    </>
  );
}
