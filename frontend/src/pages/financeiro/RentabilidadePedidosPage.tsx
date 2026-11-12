import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchRentabilidadePedidos,
  type RentabilidadePedido,
  type RentabilidadeResumo,
} from '../../api/rentabilidadePedidos';
import { PLACEHOLDER_BUSCA_TEXTO_LIVRE } from '../../utils/textoLivreBusca';
import { downloadRentabilidadePedidosXlsx } from './exportRentabilidadePedidosXlsx';

const FILTRO_LABEL = 'block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1';
const FILTRO_INPUT =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm text-slate-800 dark:text-slate-100';

function hojeYmd(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function inicioMesYmd(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-01`;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const pct1 = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? '—' : `${n.toFixed(1)}%`;

function statusBadge(status: RentabilidadePedido['statusLucro']) {
  if (status === 'positivo') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';
  }
  if (status === 'neutro') {
    return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200';
  }
  return 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200';
}

function statusLabel(status: RentabilidadePedido['statusLucro']) {
  if (status === 'positivo') return 'Lucro';
  if (status === 'neutro') return 'Margem baixa';
  return 'Prejuízo';
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{hint}</div> : null}
    </div>
  );
}

const STATUS_OPCOES: { value: string; label: string }[] = [
  { value: '', label: 'Todos (exceto cancelado)' },
  { value: '1', label: 'Aguardando liberação' },
  { value: '2', label: 'Liberado' },
  { value: '3', label: 'Atendido parcialmente' },
  { value: '4', label: 'Atendido totalmente' },
  { value: '5', label: 'Atendido com corte' },
  { value: '7', label: 'Devolvido parcialmente' },
  { value: '8', label: 'Devolvido totalmente' },
];

export default function RentabilidadePedidosPage() {
  const [faixaFiltrosVisivel, setFaixaFiltrosVisivel] = useState(true);
  const [dataInicio, setDataInicio] = useState(inicioMesYmd);
  const [dataFim, setDataFim] = useState(hojeYmd);
  const [numeroPedido, setNumeroPedido] = useState('');
  const [cliente, setCliente] = useState('');
  const [vendedor, setVendedor] = useState('');
  const [idEmpresa, setIdEmpresa] = useState<'todos' | 1 | 2>('todos');
  const [status, setStatus] = useState('');
  const [somentePrejuizo, setSomentePrejuizo] = useState(false);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resumo, setResumo] = useState<RentabilidadeResumo | null>(null);
  const [pedidos, setPedidos] = useState<RentabilidadePedido[]>([]);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [exportando, setExportando] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const detalheCacheRef = useRef(new Map<number, RentabilidadePedido>());

  const filtrar = async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    detalheCacheRef.current.clear();
    setLoading(true);
    setErro(null);
    setExpandido(null);
    try {
      const resp = await fetchRentabilidadePedidos(
        {
          dataInicio,
          dataFim,
          numeroPedido,
          cliente,
          vendedor,
          idEmpresa,
          status: status || undefined,
          somentePrejuizo,
        },
        { signal: ac.signal }
      );
      if (resp.error) setErro(resp.error);
      setResumo(resp.resumo);
      setPedidos(resp.pedidos);
      for (const p of resp.pedidos) detalheCacheRef.current.set(p.idPedido, p);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setErro(e instanceof Error ? e.message : String(e));
      setResumo(null);
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void filtrar();
    return () => abortRef.current?.abort();
    // carga inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pedidoAberto = useMemo(
    () => (expandido == null ? null : pedidos.find((p) => p.idPedido === expandido) ?? null),
    [expandido, pedidos]
  );

  const exportar = async () => {
    if (!resumo || pedidos.length === 0) return;
    setExportando(true);
    try {
      await downloadRentabilidadePedidosXlsx({
        pedidos,
        resumo,
        dataInicio,
        dataFim,
      });
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 min-h-0 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Rentabilidade de Pedidos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Lucro da operação por pedido/item (CMV da Precificação, impostos e % despesas sobre a
            receita)
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={exportando || loading || pedidos.length === 0}
          onClick={() => void exportar()}
        >
          {exportando ? 'Exportando…' : 'Exportar Excel'}
        </button>
      </div>

      <div className="shrink-0 card-panel relative overflow-visible z-20">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-700/80">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Filtros</span>
          <button
            type="button"
            onClick={() => setFaixaFiltrosVisivel((v) => !v)}
            aria-expanded={faixaFiltrosVisivel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <svg
              className={`h-4 w-4 transition-transform ${faixaFiltrosVisivel ? '' : 'rotate-180'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>

        {faixaFiltrosVisivel ? (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-700">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3">
              <div>
                <label className={FILTRO_LABEL}>Data início</label>
                <input
                  type="date"
                  className={FILTRO_INPUT}
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label className={FILTRO_LABEL}>Data fim</label>
                <input
                  type="date"
                  className={FILTRO_INPUT}
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label className={FILTRO_LABEL}>Nº pedido</label>
                <input
                  className={FILTRO_INPUT}
                  value={numeroPedido}
                  onChange={(e) => setNumeroPedido(e.target.value)}
                  placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
                  disabled={loading}
                />
              </div>
              <div>
                <label className={FILTRO_LABEL}>Cliente</label>
                <input
                  className={FILTRO_INPUT}
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
                  disabled={loading}
                />
              </div>
              <div>
                <label className={FILTRO_LABEL}>Vendedor</label>
                <input
                  className={FILTRO_INPUT}
                  value={vendedor}
                  onChange={(e) => setVendedor(e.target.value)}
                  placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
                  disabled={loading}
                />
              </div>
              <div>
                <label className={FILTRO_LABEL}>Empresa</label>
                <select
                  className={FILTRO_INPUT}
                  value={idEmpresa === 'todos' ? 'todos' : String(idEmpresa)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setIdEmpresa(v === '1' ? 1 : v === '2' ? 2 : 'todos');
                  }}
                  disabled={loading}
                >
                  <option value="todos">Todas</option>
                  <option value="1">Só Aço</option>
                  <option value="2">Só Móveis</option>
                </select>
              </div>
              <div>
                <label className={FILTRO_LABEL}>Status do item</label>
                <select
                  className={FILTRO_INPUT}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={loading}
                >
                  {STATUS_OPCOES.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={somentePrejuizo}
                    onChange={(e) => setSomentePrejuizo(e.target.checked)}
                    disabled={loading}
                  />
                  Somente com prejuízo
                </label>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={loading}
                onClick={() => void filtrar()}
              >
                {loading ? 'Carregando…' : 'Filtrar'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {erro ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {erro}
        </div>
      ) : null}

      {resumo ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          <Kpi label="Receita Bruta" value={brl.format(resumo.receitaBruta)} />
          <Kpi
            label="Impostos s/ venda"
            value={brl.format(resumo.impostosVenda)}
            hint={`${pct1(resumo.aliquotaImpostosPct)} padrão Precificação`}
          />
          <Kpi label="CMV" value={brl.format(resumo.cmv)} hint="BOM + última entrada" />
          <Kpi
            label="Despesas"
            value={brl.format(resumo.despesas)}
            hint={`${pct1(resumo.aliquotaDespesasPct)} s/ receita`}
          />
          <Kpi label="Lucro Líquido" value={brl.format(resumo.lucroLiquido)} />
          <Kpi
            label="Margem Líquida"
            value={pct1(resumo.margemLiquidaPct)}
            hint={`${resumo.qtdePedidosPrejuizo} com prejuízo / ${resumo.qtdePedidos} pedidos`}
          />
        </div>
      ) : null}

      <div className="card-panel overflow-auto min-h-0 flex-1">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Pedido</th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Vendedor</th>
              <th className="px-3 py-2 text-right">Receita</th>
              <th className="px-3 py-2 text-right">Impostos</th>
              <th className="px-3 py-2 text-right">CMV</th>
              <th className="px-3 py-2 text-right">Despesas</th>
              <th className="px-3 py-2 text-right">Lucro</th>
              <th className="px-3 py-2 text-right">Margem %</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && pedidos.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                  Carregando…
                </td>
              </tr>
            ) : null}
            {!loading && pedidos.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                  Nenhum pedido no filtro.
                </td>
              </tr>
            ) : null}
            {pedidos.map((p) => {
              const aberto = expandido === p.idPedido;
              return (
                <tr key={p.idPedido} className="border-t border-slate-100 dark:border-slate-800 align-top">
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="font-medium text-primary-700 dark:text-primary-300 hover:underline"
                      onClick={() => setExpandido(aberto ? null : p.idPedido)}
                    >
                      {p.numeroPedido}
                    </button>
                    {(p.qtdeItensSemCusto > 0 || p.qtdeItensBonificados > 0) && (
                      <div className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                        {p.qtdeItensSemCusto > 0 ? `${p.qtdeItensSemCusto} sem custo` : null}
                        {p.qtdeItensSemCusto > 0 && p.qtdeItensBonificados > 0 ? ' · ' : null}
                        {p.qtdeItensBonificados > 0 ? `${p.qtdeItensBonificados} bonificado` : null}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                    {p.dataEmissao.split('-').reverse().join('/')}
                  </td>
                  <td className="px-3 py-2 max-w-[14rem] truncate" title={p.cliente}>
                    {p.cliente}
                  </td>
                  <td className="px-3 py-2 max-w-[10rem] truncate" title={p.vendedor}>
                    {p.vendedor || '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl.format(p.receitaBruta)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl.format(p.impostosVenda)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl.format(p.cmv)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl.format(p.despesas)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{brl.format(p.lucroLiquido)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct1(p.margemLiquidaPct)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${statusBadge(p.statusLucro)}`}
                    >
                      {statusLabel(p.statusLucro)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pedidoAberto ? (
        <div className="card-panel p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                DRE — pedido {pedidoAberto.numeroPedido}
              </h2>
              <p className="text-sm text-slate-500">
                {pedidoAberto.cliente} · {pedidoAberto.vendedor || 'sem vendedor'}
              </p>
            </div>
            <button type="button" className="btn-secondary text-sm" onClick={() => setExpandido(null)}>
              Fechar
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
            {[
              ['Receita Bruta', pedidoAberto.receitaBruta],
              ['(−) Impostos s/ venda', -pedidoAberto.impostosVenda],
              ['(=) Receita Líquida', pedidoAberto.receitaLiquida],
              ['(−) CMV', -pedidoAberto.cmv],
              ['(=) Margem Bruta', pedidoAberto.margemBruta],
              ['(−) Despesas', -pedidoAberto.despesas],
              ['(=) Lucro Líquido', pedidoAberto.lucroLiquido],
            ].map(([label, valor], idx) => (
              <div
                key={String(label)}
                className={`flex justify-between px-3 py-1.5 ${
                  idx % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800/40' : ''
                } ${label === '(=) Lucro Líquido' ? 'font-semibold' : ''}`}
              >
                <span>{label}</span>
                <span className="tabular-nums">{brl.format(Number(valor))}</span>
              </div>
            ))}
            <div className="flex justify-between px-3 py-1.5 border-t border-slate-200 dark:border-slate-700">
              <span>Margem líquida</span>
              <span className="tabular-nums font-medium">{pct1(pedidoAberto.margemLiquidaPct)}</span>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">Produto</th>
                  <th className="px-2 py-1.5 text-right">Qtde</th>
                  <th className="px-2 py-1.5 text-right">Receita</th>
                  <th className="px-2 py-1.5 text-right">Impostos</th>
                  <th className="px-2 py-1.5 text-right">CMV</th>
                  <th className="px-2 py-1.5 text-right">Despesas</th>
                  <th className="px-2 py-1.5 text-right">Lucro</th>
                  <th className="px-2 py-1.5 text-right">Margem %</th>
                  <th className="px-2 py-1.5">Alertas</th>
                </tr>
              </thead>
              <tbody>
                {pedidoAberto.itens.map((i) => (
                  <tr key={i.idItem} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-1.5">
                      <div className="font-medium">{i.codigoProduto}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[16rem]" title={i.descricaoProduto}>
                        {i.descricaoProduto}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{i.qtdeLiquida}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{brl.format(i.receitaBruta)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{brl.format(i.impostosVenda)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{brl.format(i.cmv)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{brl.format(i.despesas)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                      {brl.format(i.lucroLiquido)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{pct1(i.margemLiquidaPct)}</td>
                    <td className="px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300">
                      {i.alertas.length ? i.alertas.join(' · ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
