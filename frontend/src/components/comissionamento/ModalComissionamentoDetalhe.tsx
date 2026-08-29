import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  EQUIPE_LABEL,
  listarComissionamentoDetalhe,
  type ComissionamentoDetalheRow,
  type DetalheComissionamentoContexto,
  type FiltrosComissionamento,
} from '../../api/comissionamento';
import { formatMoeda, formatNumero, formatYmdBr } from '../painel-comercial/painelComercialUtils';

const PAGE_SIZE = 50;

type Props = {
  aberto: boolean;
  titulo: string;
  subtitulo?: string;
  filtros: FiltrosComissionamento;
  contexto?: DetalheComissionamentoContexto;
  onClose: () => void;
};

function resumo(rows: ComissionamentoDetalheRow[]) {
  const pedidos = new Set(rows.map((r) => r.pdId));
  const clientes = new Set(rows.map((r) => r.cliente));
  const produtos = new Set(rows.map((r) => r.codigoProduto || String(r.idItem)));
  let valor = 0;
  let qtde = 0;
  let custo = 0;
  let margem = 0;
  let comCusto = 0;
  for (const r of rows) {
    valor += r.valorVendido;
    qtde += r.qtde;
    if (r.custoTotal != null) {
      custo += r.custoTotal;
      margem += r.margem ?? r.valorVendido - r.custoTotal;
      comCusto += r.valorVendido;
    }
  }
  return {
    pedidos: pedidos.size,
    clientes: clientes.size,
    produtos: produtos.size,
    valor,
    qtde,
    itens: rows.length,
    custo,
    margem,
    margemPct: comCusto > 0 ? (margem / comCusto) * 100 : null,
  };
}

export default function ModalComissionamentoDetalhe({
  aberto,
  titulo,
  subtitulo,
  filtros,
  contexto,
  onClose,
}: Props) {
  const [rows, setRows] = useState<ComissionamentoDetalheRow[]>([]);
  const [truncado, setTruncado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(1);

  const carregar = useCallback(async () => {
    if (!aberto) return;
    setLoading(true);
    setErro(null);
    setPage(1);
    try {
      const data = await listarComissionamentoDetalhe(filtros, contexto);
      setRows(data.rows ?? []);
      setTruncado(Boolean(data.truncado));
      if (data.erro) setErro(data.erro);
    } catch (e) {
      setRows([]);
      setErro(e instanceof Error ? e.message : 'Erro ao carregar detalhe.');
    } finally {
      setLoading(false);
    }
  }, [aberto, filtros, contexto]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR');
    if (!q) return rows;
    return rows.filter((r) => {
      const blob = [
        r.pdCodigo,
        r.cliente,
        r.vendedor,
        r.codigoProduto,
        r.descricaoProduto,
        r.grupoProduto,
        r.status,
        EQUIPE_LABEL[r.equipe] ?? r.equipe,
      ]
        .join(' ')
        .toLocaleLowerCase('pt-BR');
      return blob.includes(q);
    });
  }, [rows, busca]);

  const tot = useMemo(() => resumo(filtradas), [filtradas]);
  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pagina = filtradas.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  if (!aberto) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/70">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{titulo}</h2>
            {subtitulo ? (
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{subtitulo}</p>
            ) : null}
            <p className="mt-1 text-xs text-slate-500">
              {formatYmdBr(filtros.dataIni)} — {formatYmdBr(filtros.dataFim)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-slate-100 px-4 py-2 sm:grid-cols-3 lg:grid-cols-8 dark:border-slate-700">
          <div className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-700/40">
            <div className="text-[10px] uppercase text-slate-500">Venda</div>
            <div className="text-sm font-semibold tabular-nums">{formatMoeda(tot.valor)}</div>
          </div>
          <div className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-700/40">
            <div className="text-[10px] uppercase text-slate-500">Custo</div>
            <div className="text-sm font-semibold tabular-nums">{formatMoeda(tot.custo)}</div>
          </div>
          <div className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-700/40">
            <div className="text-[10px] uppercase text-slate-500">Margem</div>
            <div className="text-sm font-semibold tabular-nums">{formatMoeda(tot.margem)}</div>
          </div>
          <div className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-700/40">
            <div className="text-[10px] uppercase text-slate-500">Margem %</div>
            <div className="text-sm font-semibold tabular-nums">
              {tot.margemPct != null ? `${tot.margemPct.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-700/40">
            <div className="text-[10px] uppercase text-slate-500">Pedidos</div>
            <div className="text-sm font-semibold tabular-nums">{formatNumero(tot.pedidos)}</div>
          </div>
          <div className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-700/40">
            <div className="text-[10px] uppercase text-slate-500">Clientes</div>
            <div className="text-sm font-semibold tabular-nums">{formatNumero(tot.clientes)}</div>
          </div>
          <div className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-700/40">
            <div className="text-[10px] uppercase text-slate-500">Qtde</div>
            <div className="text-sm font-semibold tabular-nums">{formatNumero(tot.qtde)}</div>
          </div>
          <div className="rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-700/40">
            <div className="text-[10px] uppercase text-slate-500">Itens</div>
            <div className="text-sm font-semibold tabular-nums">{formatNumero(tot.itens)}</div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2 dark:border-slate-700">
          <input
            type="search"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar PD, cliente, produto, vendedor…"
            className="min-w-[14rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          {truncado ? (
            <span className="text-xs text-amber-700 dark:text-amber-300">
              Lista limitada às 2.500 linhas de maior valor.
            </span>
          ) : null}
        </div>

        {erro ? (
          <div className="shrink-0 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
            {erro}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <p className="p-8 text-center text-sm text-slate-500">Carregando detalhe das vendas…</p>
          ) : pagina.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">Nenhuma venda neste recorte.</p>
          ) : (
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-2 py-2 text-left">PD</th>
                  <th className="px-2 py-2 text-left">Emissão</th>
                  <th className="px-2 py-2 text-left">Cliente</th>
                  <th className="px-2 py-2 text-left">Vendedor</th>
                  <th className="px-2 py-2 text-left">Equipe</th>
                  <th className="px-2 py-2 text-left">Produto</th>
                  <th className="px-2 py-2 text-left">Grupo</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-right">Qtde</th>
                  <th className="px-2 py-2 text-right">Valor</th>
                  <th className="px-2 py-2 text-right">Custo</th>
                  <th className="px-2 py-2 text-right">Margem</th>
                  <th className="px-2 py-2 text-right">Margem %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {pagina.map((r) => (
                  <tr key={`${r.idItem}-${r.pdId}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40">
                    <td className="px-2 py-1.5 tabular-nums font-medium">{r.pdCodigo || r.pdId}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{formatYmdBr(r.dataEmissao)}</td>
                    <td className="max-w-[10rem] truncate px-2 py-1.5" title={r.cliente}>
                      {r.cliente || '—'}
                    </td>
                    <td className="max-w-[9rem] truncate px-2 py-1.5" title={r.vendedor}>
                      {r.vendedor || '—'}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {EQUIPE_LABEL[r.equipe] ?? r.equipe}
                    </td>
                    <td className="max-w-[14rem] px-2 py-1.5" title={r.descricaoProduto}>
                      <div className="truncate font-medium">{r.codigoProduto || '—'}</div>
                      <div className="truncate text-slate-500">{r.descricaoProduto}</div>
                    </td>
                    <td className="max-w-[8rem] truncate px-2 py-1.5">{r.grupoProduto || '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.status || '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatNumero(r.qtde)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                      {formatMoeda(r.valorVendido)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {r.custoTotal != null ? formatMoeda(r.custoTotal) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {r.margem != null ? formatMoeda(r.margem) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {r.margemPct != null ? `${r.margemPct.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-600">
          <span className="text-xs text-slate-500">
            {filtradas.length === 0
              ? '0 registros'
              : `Exibindo ${(pageSafe - 1) * PAGE_SIZE + 1}–${Math.min(pageSafe * PAGE_SIZE, filtradas.length)} de ${filtradas.length}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pageSafe <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-600"
            >
              Anterior
            </button>
            <span className="text-xs text-slate-500">
              Página {pageSafe}/{totalPages}
            </span>
            <button
              type="button"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-600"
            >
              Próxima
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
