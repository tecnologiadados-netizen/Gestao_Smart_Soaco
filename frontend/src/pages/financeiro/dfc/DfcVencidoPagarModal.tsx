import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchDfcDespesasPagamentoEmAberto,
  type DfcDespesaPagamentoEmAbertoLinha,
} from '../../../api/financeiro';
import { labelEmpresaDfc } from './dfcEmpresas';
import DfcVencidoPagarDetalheModal from './DfcVencidoPagarDetalheModal';
import {
  agregar,
  brl,
  CORES_CATEGORIA,
  diasAtraso,
  exportarCsvVencidos,
  FAIXAS_ATRASO,
  filtrarFaixa,
  fmtDataBr,
  labelCategoria,
  pctDoTotal,
  type DrillDownPayload,
} from './dfcVencidoPagarShared';

type Props = {
  aberto: boolean;
  onClose: () => void;
  dataInicio: string;
  dataFim: string;
  idEmpresas: number[];
  totalKpi?: number;
};

type SegmentoDonut = { chave: string; valor: number; cor: string };

function DonutChart({
  segmentos,
  total,
  onSegmentClick,
}: {
  segmentos: SegmentoDonut[];
  total: number;
  onSegmentClick: (s: SegmentoDonut) => void;
}) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const rOut = 88;
  const rIn = 58;
  let acc = 0;

  const arcos = segmentos.map((seg) => {
    const pct = total > 0 ? seg.valor / total : 0;
    const start = acc;
    acc += pct;
    const end = acc;
    const large = pct > 0.5 ? 1 : 0;
    const a0 = start * 2 * Math.PI - Math.PI / 2;
    const a1 = end * 2 * Math.PI - Math.PI / 2;
    const x0 = cx + rOut * Math.cos(a0);
    const y0 = cy + rOut * Math.sin(a0);
    const x1 = cx + rOut * Math.cos(a1);
    const y1 = cy + rOut * Math.sin(a1);
    const xi0 = cx + rIn * Math.cos(a1);
    const yi0 = cy + rIn * Math.sin(a1);
    const xi1 = cx + rIn * Math.cos(a0);
    const yi1 = cy + rIn * Math.sin(a0);
    const d =
      pct <= 0
        ? ''
        : `M ${x0} ${y0} A ${rOut} ${rOut} 0 ${large} 1 ${x1} ${y1} L ${xi0} ${yi0} A ${rIn} ${rIn} 0 ${large} 0 ${xi1} ${yi1} Z`;
    const mid = ((start + end) / 2) * 360 - 90;
    const lr = (rOut + rIn) / 2 + 18;
    const lx = cx + lr * Math.cos((mid * Math.PI) / 180);
    const ly = cy + lr * Math.sin((mid * Math.PI) / 180);
    return { seg, d, pct, lx, ly, showLabel: pct >= 0.04 };
  });

  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {arcos.map(({ seg, d, pct, lx, ly, showLabel }) =>
          d ? (
            <g key={seg.chave}>
              <path
                d={d}
                fill={seg.cor}
                className="cursor-pointer transition-opacity hover:opacity-80"
                onClick={() => onSegmentClick(seg)}
              >
                <title>
                  {seg.chave}: {brl.format(seg.valor)} ({pctDoTotal(seg.valor, total)})
                </title>
              </path>
              {showLabel ? (
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-600 text-[9px] font-medium pointer-events-none"
                >
                  {pctDoTotal(seg.valor, total)}
                </text>
              ) : null}
            </g>
          ) : null,
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-8">
        <span className="text-[11px] text-slate-500 font-medium">Total</span>
        <span className="text-xs font-bold text-slate-800 tabular-nums leading-tight mt-0.5">
          {brl.format(total)}
        </span>
      </div>
    </div>
  );
}

function KpiCard({
  titulo,
  valor,
  sub,
  iconBg,
  children,
}: {
  titulo: string;
  valor: string;
  sub?: ReactNode;
  iconBg: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm min-w-0">
      <div className="flex items-start gap-3">
        <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${iconBg}`}>
          {children}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
          <p className="mt-1 text-xl font-bold text-slate-900 tabular-nums leading-tight truncate">{valor}</p>
          {sub ? <div className="mt-1 text-[11px] text-slate-500 leading-snug">{sub}</div> : null}
        </div>
      </div>
    </div>
  );
}

function PainelCard({
  titulo,
  linkLabel,
  onLink,
  children,
  className = '',
}: {
  titulo: string;
  linkLabel?: string;
  onLink?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-slate-800">{titulo}</h3>
        {linkLabel && onLink ? (
          <button
            type="button"
            onClick={onLink}
            className="text-xs font-medium text-primary-600 hover:text-primary-700 hover:underline shrink-0"
          >
            {linkLabel}
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export default function DfcVencidoPagarModal({
  aberto,
  onClose,
  dataInicio,
  dataFim,
  idEmpresas,
  totalKpi,
}: Props) {
  const [linhas, setLinhas] = useState<DfcDespesaPagamentoEmAbertoLinha[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [drill, setDrill] = useState<DrillDownPayload | null>(null);

  const carregar = useCallback(async () => {
    if (!dataInicio || !dataFim) return;
    setLoading(true);
    setErro(null);
    const r = await fetchDfcDespesasPagamentoEmAberto({
      dataInicio,
      dataFim,
      idEmpresas: idEmpresas.length > 0 ? idEmpresas : [1],
    });
    setLoading(false);
    if (r.erro) setErro(r.erro);
    setLinhas(r.linhas.filter((l) => l.situacao === 'vencido'));
    setAtualizadoEm(new Date());
  }, [dataInicio, dataFim, idEmpresas]);

  useEffect(() => {
    if (!aberto) return;
    setDrill(null);
    void carregar();
  }, [aberto, carregar]);

  const vencidos = linhas;

  const resumo = useMemo(() => {
    const total = vencidos.reduce((s, r) => s + r.saldoBaixar, 0);
    const qtd = vencidos.length;
    let somaDias = 0;
    let maior = 0;
    for (const r of vencidos) {
      const d = diasAtraso(r.dataVencimento);
      somaDias += d;
      if (r.saldoBaixar > maior) maior = r.saldoBaixar;
    }
    const mediaDias = qtd > 0 ? somaDias / qtd : 0;
    const ticketMedio = qtd > 0 ? total / qtd : 0;
    return { total, qtd, mediaDias, maior, ticketMedio };
  }, [vencidos]);

  const porCategoria = useMemo(
    () => agregar(vencidos, labelCategoria),
    [vencidos],
  );

  const porFornecedor = useMemo(
    () => agregar(vencidos, (r) => r.nome?.trim() || '(sem favorecido)'),
    [vencidos],
  );

  const porEmpresa = useMemo(
    () => agregar(vencidos, (r) => labelEmpresaDfc(r.idEmpresa)),
    [vencidos],
  );

  const faixasAtraso = useMemo(
    () =>
      FAIXAS_ATRASO.map((f) => {
        const subset = filtrarFaixa(vencidos, f.min, f.max);
        const valor = subset.reduce((s, r) => s + r.saldoBaixar, 0);
        return { ...f, valor, qtd: subset.length, linhas: subset };
      }),
    [vencidos],
  );

  const maiorFaixa = useMemo(() => {
    if (faixasAtraso.length === 0) return null;
    return [...faixasAtraso].sort((a, b) => b.valor - a.valor)[0];
  }, [faixasAtraso]);

  const topCategorias = porCategoria.slice(0, 10);
  const segmentosDonut: SegmentoDonut[] = topCategorias.map((c, i) => ({
    chave: c.chave,
    valor: c.valor,
    cor: CORES_CATEGORIA[i % CORES_CATEGORIA.length],
  }));

  const topFornecedor = porFornecedor[0];
  const maiorEmpresa = porEmpresa[0];

  const abrirDrill = useCallback((payload: DrillDownPayload) => {
    setDrill(payload);
  }, []);

  const filtrarPorCategoria = useCallback(
    (chave: string) => vencidos.filter((r) => labelCategoria(r) === chave),
    [vencidos],
  );

  const filtrarPorFornecedor = useCallback(
    (chave: string) =>
      vencidos.filter((r) => (r.nome?.trim() || '(sem favorecido)') === chave),
    [vencidos],
  );

  const filtrarPorEmpresa = useCallback(
    (chave: string) => vencidos.filter((r) => labelEmpresaDfc(r.idEmpresa) === chave),
    [vencidos],
  );

  const fmtAtualizado =
    atualizadoEm != null
      ? atualizadoEm.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  if (!aberto || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[10050] flex items-center justify-center p-3 sm:p-4 bg-black/70"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="relative flex w-full max-w-[min(98vw,1280px)] max-h-[min(96vh,940px)] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#f1f5f9] shadow-2xl font-sans"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dfc-vencido-pagar-titulo"
        >
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between gap-3 bg-white border-b border-slate-200 px-5 py-4">
            <div className="min-w-0">
              <h2 id="dfc-vencido-pagar-titulo" className="text-xl font-bold text-slate-900">
                Vencido a pagar — análise estratégica
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Período {fmtDataBr(dataInicio)} a {fmtDataBr(dataFim)} · pagamentos vencidos e em aberto (Nomus)
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Fechar"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
            {erro ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{erro}</div>
            ) : null}

            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
              <KpiCard
                titulo="Total vencido"
                valor={loading ? '…' : brl.format(resumo.total)}
                iconBg="bg-emerald-100"
                sub={
                  totalKpi != null && !loading ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                      </svg>
                      KPI card: {brl.format(totalKpi)}
                    </span>
                  ) : undefined
                }
              >
                <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </KpiCard>

              <KpiCard titulo="Títulos" valor={loading ? '…' : String(resumo.qtd)} sub="agendamentos em aberto" iconBg="bg-primary-100">
                <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </KpiCard>

              <KpiCard
                titulo="Atraso médio"
                valor={loading ? '…' : `${resumo.mediaDias.toFixed(0)} dias`}
                sub="desde o vencimento"
                iconBg="bg-orange-100"
              >
                <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </KpiCard>

              <KpiCard titulo="Maior título" valor={loading ? '…' : brl.format(resumo.maior)} iconBg="bg-violet-100">
                <svg className="h-5 w-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                </svg>
              </KpiCard>

              <KpiCard
                titulo="Maior fornecedor"
                valor={loading ? '…' : topFornecedor ? brl.format(topFornecedor.valor) : '—'}
                sub={topFornecedor?.chave}
                iconBg="bg-teal-100"
              >
                <svg className="h-5 w-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </KpiCard>
            </div>

            {/* Middle row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PainelCard
                titulo="Por categoria (plano de contas)"
                linkLabel="Ver todas as categorias"
                onLink={() =>
                  abrirDrill({
                    titulo: 'Todas as categorias',
                    subtitulo: `${porCategoria.length} categorias · ${resumo.qtd} títulos`,
                    linhas: vencidos,
                  })
                }
              >
                {loading ? (
                  <div className="h-52 rounded-lg bg-slate-100 animate-pulse" />
                ) : (
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 min-w-0 overflow-auto max-h-[280px]">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">
                            <th className="pb-2 text-left font-semibold">Categoria</th>
                            <th className="pb-2 text-right font-semibold">Valor vencido</th>
                            <th className="pb-2 text-right font-semibold w-14">% do total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topCategorias.map((row, i) => (
                            <tr
                              key={row.chave}
                              className="border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors"
                              onClick={() =>
                                abrirDrill({
                                  titulo: row.chave,
                                  subtitulo: `Categoria · ${row.qtd} título(s)`,
                                  linhas: filtrarPorCategoria(row.chave),
                                })
                              }
                            >
                              <td className="py-2 pr-2">
                                <span className="inline-flex items-center gap-2 min-w-0">
                                  <span
                                    className="shrink-0 w-2 h-2 rounded-full"
                                    style={{ backgroundColor: CORES_CATEGORIA[i % CORES_CATEGORIA.length] }}
                                  />
                                  <span className="truncate text-slate-700 font-medium" title={row.chave}>
                                    {row.chave}
                                  </span>
                                </span>
                              </td>
                              <td className="py-2 text-right tabular-nums text-slate-800 font-medium whitespace-nowrap">
                                {brl.format(row.valor)}
                              </td>
                              <td className="py-2 text-right tabular-nums text-slate-500">
                                {pctDoTotal(row.valor, resumo.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="shrink-0 flex items-center justify-center md:w-[220px]">
                      <DonutChart
                        segmentos={segmentosDonut}
                        total={resumo.total}
                        onSegmentClick={(seg) =>
                          abrirDrill({
                            titulo: seg.chave,
                            subtitulo: 'Categoria (gráfico)',
                            linhas: filtrarPorCategoria(seg.chave),
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </PainelCard>

              <PainelCard titulo="Faixa de atraso">
                {loading ? (
                  <div className="h-52 rounded-lg bg-slate-100 animate-pulse" />
                ) : (
                  <div className="space-y-4">
                    {faixasAtraso.map((f) => {
                      const pctNum = resumo.total > 0 ? (f.valor / resumo.total) * 100 : 0;
                      return (
                        <button
                          key={f.label}
                          type="button"
                          className="w-full text-left group cursor-pointer"
                          onClick={() =>
                            abrirDrill({
                              titulo: f.label,
                              subtitulo: `${f.qtd} título(s) · ${pctDoTotal(f.valor, resumo.total)} do total`,
                              linhas: f.linhas,
                            })
                          }
                        >
                          <div className="flex items-baseline justify-between gap-2 mb-1.5">
                            <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                              {f.label}
                            </span>
                            <span className="text-xs tabular-nums text-slate-600 shrink-0">
                              {brl.format(f.valor)}{' '}
                              <span className="text-slate-400">
                                {pctDoTotal(f.valor, resumo.total)} ({f.qtd})
                              </span>
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${f.barClass} transition-all group-hover:opacity-90`}
                              style={{ width: `${Math.max(pctNum > 0 ? 3 : 0, pctNum)}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                    {maiorFaixa && maiorFaixa.valor > 0 ? (
                      <div className="rounded-lg bg-sky-50 border border-sky-100 px-3 py-2.5 text-sm">
                        <span className="font-semibold text-sky-900">Maior concentração: {maiorFaixa.label}</span>
                        <span className="text-sky-700">
                          {' '}
                          · {pctDoTotal(maiorFaixa.valor, resumo.total)} do total vencido{' '}
                          <span className="font-semibold tabular-nums">{brl.format(maiorFaixa.valor)}</span>
                        </span>
                      </div>
                    ) : null}
                  </div>
                )}
              </PainelCard>
            </div>

            {/* Bottom row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PainelCard
                titulo="Por empresa"
                linkLabel="Ver todas"
                onLink={() =>
                  abrirDrill({
                    titulo: 'Todas as empresas',
                    subtitulo: `${porEmpresa.length} empresa(s)`,
                    linhas: vencidos,
                  })
                }
              >
                {loading ? (
                  <div className="h-28 rounded-lg bg-slate-100 animate-pulse" />
                ) : (
                  <div className="space-y-4">
                    {porEmpresa.slice(0, 6).map((row, i) => {
                      const pctNum = resumo.total > 0 ? (row.valor / resumo.total) * 100 : 0;
                      const barCor = i === 0 ? 'bg-blue-800' : 'bg-blue-400';
                      return (
                        <button
                          key={row.chave}
                          type="button"
                          className="w-full text-left group cursor-pointer"
                          onClick={() =>
                            abrirDrill({
                              titulo: row.chave,
                              subtitulo: `Empresa · ${row.qtd} título(s)`,
                              linhas: filtrarPorEmpresa(row.chave),
                            })
                          }
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-700">{row.chave}</span>
                            <span className="text-sm font-semibold text-slate-800 tabular-nums">
                              {pctDoTotal(row.valor, resumo.total)}
                            </span>
                          </div>
                          <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barCor} group-hover:opacity-90`}
                              style={{ width: `${Math.max(pctNum > 0 ? 4 : 0, pctNum)}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                    <div className="rounded-lg bg-sky-50 border border-sky-100 px-3 py-2 text-xs text-sky-800 flex items-start gap-2">
                      <svg className="shrink-0 mt-0.5 h-4 w-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                      </svg>
                      <span>
                        {porEmpresa.length} empresa{porEmpresa.length !== 1 ? 's' : ''} · Ticket médio:{' '}
                        <strong>{brl.format(resumo.ticketMedio)}</strong>
                        {maiorEmpresa
                          ? ` · Maior concentração: ${maiorEmpresa.chave} (${pctDoTotal(maiorEmpresa.valor, resumo.total)})`
                          : ''}
                      </span>
                    </div>
                  </div>
                )}
              </PainelCard>

              <PainelCard
                titulo="Top fornecedores"
                linkLabel="Ver todos"
                onLink={() =>
                  abrirDrill({
                    titulo: 'Todos os fornecedores',
                    subtitulo: `${porFornecedor.length} fornecedor(es)`,
                    linhas: vencidos,
                  })
                }
              >
                {loading ? (
                  <div className="h-28 rounded-lg bg-slate-100 animate-pulse" />
                ) : (
                  <div className="space-y-4">
                    {porFornecedor.slice(0, 3).map((row, i) => {
                      const pctNum = resumo.total > 0 ? (row.valor / resumo.total) * 100 : 0;
                      const barCor = i === 0 ? 'bg-red-700' : 'bg-rose-400';
                      return (
                        <button
                          key={row.chave}
                          type="button"
                          className="w-full text-left group cursor-pointer"
                          onClick={() =>
                            abrirDrill({
                              titulo: row.chave,
                              subtitulo: `Fornecedor · ${row.qtd} título(s)`,
                              linhas: filtrarPorFornecedor(row.chave),
                            })
                          }
                        >
                          <div className="flex items-start gap-2 mb-1">
                            <span className="shrink-0 mt-0.5 text-slate-400">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 1.5H21m-16.5 18h16.5" />
                              </svg>
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-sm font-medium text-slate-700 truncate" title={row.chave}>
                                  {row.chave}
                                </span>
                                <span className="text-sm font-semibold text-slate-800 tabular-nums shrink-0">
                                  {pctDoTotal(row.valor, resumo.total)}
                                </span>
                              </div>
                              <div className="h-3 rounded-full bg-slate-100 overflow-hidden mt-1.5">
                                <div
                                  className={`h-full rounded-full ${barCor} group-hover:opacity-90`}
                                  style={{ width: `${Math.max(pctNum > 0 ? 4 : 0, pctNum)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </PainelCard>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3">
            <p className="inline-flex items-center gap-2 text-xs text-slate-500">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
              Dados atualizados em {fmtAtualizado}
            </p>
            <button
              type="button"
              disabled={loading || vencidos.length === 0}
              onClick={() => exportarCsvVencidos(vencidos, `vencido-a-pagar-${dataInicio}-${dataFim}.csv`)}
              className="inline-flex items-center gap-2 rounded-lg border border-primary-600 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Exportar relatório
            </button>
          </div>
        </div>
      </div>

      <DfcVencidoPagarDetalheModal payload={drill} onClose={() => setDrill(null)} />
    </>,
    document.body,
  );
}
