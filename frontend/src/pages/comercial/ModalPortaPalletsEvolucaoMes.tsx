import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  DetalhePortaPallets,
  IndicadorPortaPallets,
  LinhaPedidoGerado,
  LinhaPropostaItem,
  MesPortaPallets,
} from '../../api/portaPalletsComercial';
import { formatMoeda, formatNumero } from '../../components/painel-comercial/painelComercialUtils';
import { Tabela } from './ModalPortaPalletsDetalhe';

export type AbaEvolucaoMes = 'propostas' | 'pedidos';

const INDICADOR: Record<AbaEvolucaoMes, IndicadorPortaPallets> = {
  propostas: 'propostas',
  pedidos: 'pedidos_gerados',
};

type EstadoAba = { detalhe: DetalhePortaPallets | null; loading: boolean; erro: string | null };
const ESTADO_INICIAL: EstadoAba = { detalhe: null, loading: false, erro: null };

/** Monte com `key` por mês/recorte: o estado das guias vale só para a abertura atual. */
type Props = {
  /** Mês clicado, com os valores da barra (usados na conferência). */
  mes: MesPortaPallets;
  titulo: string;
  abaInicial: AbaEvolucaoMes;
  buscar: (indicador: IndicadorPortaPallets) => Promise<DetalhePortaPallets>;
  onClose: () => void;
};

export default function ModalPortaPalletsEvolucaoMes({ mes, titulo, abaInicial, buscar, onClose }: Props) {
  const [aba, setAba] = useState<AbaEvolucaoMes>(abaInicial);
  const [estado, setEstado] = useState<Record<AbaEvolucaoMes, EstadoAba>>({
    propostas: ESTADO_INICIAL,
    pedidos: ESTADO_INICIAL,
  });
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  useEffect(() => {
    const atual = estado[aba];
    if (atual.detalhe || atual.loading || atual.erro) return;
    setEstado((s) => ({ ...s, [aba]: { detalhe: null, loading: true, erro: null } }));
    buscar(INDICADOR[aba])
      .then((detalhe) => {
        if (!montadoRef.current) return;
        setEstado((s) => ({ ...s, [aba]: { detalhe, loading: false, erro: null } }));
      })
      .catch((e: unknown) => {
        if (!montadoRef.current) return;
        const erro = e instanceof Error ? e.message : 'Erro ao carregar o detalhe.';
        setEstado((s) => ({ ...s, [aba]: { detalhe: null, loading: false, erro } }));
      });
  }, [aba, buscar, estado]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  const atual = estado[aba];
  const abas: Array<{ id: AbaEvolucaoMes; label: string; resumo: string }> = [
    {
      id: 'propostas',
      label: 'Propostas',
      resumo: `${formatNumero(mes.qtdPropostas)} · ${formatMoeda(mes.valorPropostas, true)}`,
    },
    {
      id: 'pedidos',
      label: 'Pedidos gerados',
      resumo: `${formatNumero(mes.qtdPedidosGerados)} · ${formatMoeda(mes.valorPedidosGerados, true)}`,
    },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[10040] flex items-center justify-center bg-black/70 p-3 sm:p-4 dark:bg-slate-950/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[min(92vh,860px)] w-full max-w-7xl min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="porta-pallets-evolucao-titulo"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 pt-3 dark:border-slate-600">
          <div className="min-w-0">
            <h2 id="porta-pallets-evolucao-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {titulo}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1" role="tablist">
              {abas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={aba === a.id}
                  onClick={() => setAba(a.id)}
                  className={`-mb-px rounded-t-lg border border-b-0 px-3 py-1.5 text-sm transition ${
                    aba === a.id
                      ? 'border-slate-200 bg-white font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {a.label}
                  <span className="ml-1.5 text-xs font-normal tabular-nums text-slate-400">{a.resumo}</span>
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {atual.loading && <p className="py-8 text-sm text-slate-500">Carregando origem…</p>}
          {!atual.loading && atual.erro && <p className="py-8 text-sm text-rose-700 dark:text-rose-300">{atual.erro}</p>}
          {!atual.loading && !atual.erro && atual.detalhe && (
            <>
              {atual.detalhe.indicador === 'propostas' ? (
                <ResumoPropostas rows={atual.detalhe.rows} mes={mes} />
              ) : atual.detalhe.indicador === 'pedidos_gerados' ? (
                <ResumoPedidos rows={atual.detalhe.rows} mes={mes} />
              ) : null}
              {atual.detalhe.rows.length === 0 ? (
                <p className="py-8 text-sm text-slate-500">Nenhum registro neste mês.</p>
              ) : (
                <Tabela detalhe={atual.detalhe} tituloExportacao={`Porta-pallets - ${titulo} - ${abas.find((a) => a.id === aba)?.label}`} />
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Conferencia({ ok, esperado }: { ok: boolean; esperado: string }) {
  return ok ? (
    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-300">
      confere com a barra
    </span>
  ) : (
    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300">
      diferente da barra ({esperado})
    </span>
  );
}

function ResumoPropostas({ rows, mes }: { rows: LinhaPropostaItem[]; mes: MesPortaPallets }) {
  const r = useMemo(() => {
    const propostas = new Map<number, { cliente: string; convertida: boolean }>();
    const porCliente = new Map<string, { propostas: Set<number>; valor: number }>();
    let valor = 0;
    for (const row of rows) {
      valor += row.valor;
      propostas.set(row.idProposta, { cliente: row.cliente, convertida: row.propostaConvertida });
      const c = porCliente.get(row.cliente) ?? { propostas: new Set<number>(), valor: 0 };
      c.propostas.add(row.idProposta);
      c.valor += row.valor;
      porCliente.set(row.cliente, c);
    }
    const convertidas = [...propostas.values()].filter((p) => p.convertida).length;
    const repetidos = [...porCliente.entries()]
      .filter(([, c]) => c.propostas.size > 1)
      .sort((a, b) => b[1].valor - a[1].valor)
      .slice(0, 3);
    return { qtd: propostas.size, valor: Math.round(valor * 100) / 100, convertidas, repetidos };
  }, [rows]);
  const ok = r.qtd === mes.qtdPropostas && Math.abs(r.valor - mes.valorPropostas) < 0.01;
  const maior = r.repetidos[0];

  return (
    <div className="mb-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="tabular-nums">
          <b>{formatNumero(r.qtd)}</b> propostas · {formatNumero(rows.length)} itens · <b>{formatMoeda(r.valor)}</b> ·{' '}
          {formatNumero(r.convertidas)} viraram pedido
        </span>
        <Conferencia ok={ok} esperado={`${formatNumero(mes.qtdPropostas)} · ${formatMoeda(mes.valorPropostas)}`} />
      </p>
      {maior && r.valor > 0 ? (
        <p className="rounded-md bg-amber-500/10 px-2 py-1 text-amber-800 ring-1 ring-amber-500/25 dark:text-amber-200">
          Cliente com mais de uma proposta no mês:{' '}
          {r.repetidos
            .map(
              ([cliente, c]) =>
                `${cliente} (${formatNumero(c.propostas.size)} propostas, ${formatMoeda(c.valor, true)} = ${Math.round(
                  (c.valor / r.valor) * 100
                )}% do mês)`
            )
            .join('; ')}
          . Opções alternativas do mesmo projeto somam como propostas separadas — confira a coluna Observação.
        </p>
      ) : null}
    </div>
  );
}

function ResumoPedidos({ rows, mes }: { rows: LinhaPedidoGerado[]; mes: MesPortaPallets }) {
  const valor = Math.round(rows.reduce((s, r) => s + r.valorVendido, 0) * 100) / 100;
  const ok = rows.length === mes.qtdPedidosGerados && Math.abs(valor - mes.valorPedidosGerados) < 0.01;
  return (
    <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
      <span className="tabular-nums">
        <b>{formatNumero(rows.length)}</b> pedidos gerados pelas propostas do mês · <b>{formatMoeda(valor)}</b> vendido ·{' '}
        {formatNumero(mes.qtdConvertidas)} de {formatNumero(mes.qtdPropostas)} propostas viraram pedido
      </span>
      <Conferencia ok={ok} esperado={`${formatNumero(mes.qtdPedidosGerados)} · ${formatMoeda(mes.valorPedidosGerados)}`} />
    </p>
  );
}
