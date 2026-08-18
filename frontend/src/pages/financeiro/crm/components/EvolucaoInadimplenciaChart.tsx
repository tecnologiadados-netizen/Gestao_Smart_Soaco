import { useEffect, useRef, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import type { PontoSerieInadimplencia } from '../../../../api/crmFinanceiro';
import { formatarPct, formatarReais, rotuloPeriodoMes } from '../../dashboard/dashboardFormat';

type SerieId = 'pctAtraso' | 'pctInadimplente';

type Props = {
  serie: PontoSerieInadimplencia[];
  onPonto?: (ponto: PontoSerieInadimplencia, modo: SerieId) => void;
};
type Row = PontoSerieInadimplencia & { label: string };

function TooltipPonto({
  active,
  payload,
  modo,
}: {
  active?: boolean;
  payload?: Array<{ payload?: Row }>;
  modo: SerieId;
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const p = payload[0].payload;
  const vencido = p.valorVencido;
  const qtdVencido = p.qtdVencido;
  const numerador = modo === 'pctAtraso' ? p.valorAtraso : p.valorAberto;
  const qtdNum = modo === 'pctAtraso' ? p.qtdAtraso : p.qtdAberto;
  const pct = p.valorVencido > 0 ? (numerador / p.valorVencido) * 100 : 0;
  const resto = Math.max(0, vencido - numerador);
  const qtdResto = Math.max(0, qtdVencido - qtdNum);

  return (
    <div className="max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-md dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
      <p className="mb-1.5 font-semibold text-slate-900 dark:text-slate-50">{rotuloPeriodoMes(p.mes)}</p>
      <p className="tabular-nums">
        Vencido no mês: {formatarReais(vencido)} · {qtdVencido.toLocaleString('pt-BR')} tít.
      </p>
      {modo === 'pctAtraso' ? (
        <>
          <p className="mt-1 tabular-nums">
            Atrasou: {formatarReais(numerador)} ({formatarPct(pct)}) · {qtdNum.toLocaleString('pt-BR')} tít.
          </p>
          <p className="tabular-nums text-slate-500 dark:text-slate-400">
            No prazo: {formatarReais(resto)} · {qtdResto.toLocaleString('pt-BR')} tít.
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            Índice = atrasou (pago após o prazo efetivo ou ainda aberto) ÷ vencido no mês.
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 tabular-nums">
            Ainda em aberto: {formatarReais(numerador)} ({formatarPct(pct)}) · {qtdNum.toLocaleString('pt-BR')} tít.
          </p>
          <p className="tabular-nums text-slate-500 dark:text-slate-400">
            Já regularizado: {formatarReais(resto)} · {qtdResto.toLocaleString('pt-BR')} tít.
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            % inadimplente = ainda em aberto hoje ÷ vencido no mês.
          </p>
        </>
      )}
    </div>
  );
}

function Bolinha({
  cx,
  cy,
  payload,
  fill,
  dataKey,
  r = 3,
  ativo = false,
  onAbrir,
}: {
  cx?: number;
  cy?: number;
  payload?: Row;
  fill: string;
  dataKey: SerieId;
  r?: number;
  ativo?: boolean;
  onAbrir: (p?: Row | null) => void;
}) {
  if (cx == null || cy == null) return null;
  const valor = payload ? Number(payload[dataKey] ?? 0) : 0;
  return (
    <g
      className="cursor-pointer"
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation();
        onAbrir(payload ?? null);
      }}
    >
      <circle cx={cx} cy={cy} r={14} fill="transparent" style={{ cursor: 'pointer' }} />
      <circle
        cx={cx}
        cy={cy}
        r={ativo ? 6 : r}
        fill={fill}
        stroke={ativo ? '#fff' : fill}
        strokeWidth={ativo ? 2 : 0}
        style={{ cursor: 'pointer', pointerEvents: 'auto' }}
      />
      {!ativo ? (
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          fill={fill}
          fontSize={10}
          fontWeight={600}
          stroke="currentColor"
          strokeWidth={3}
          paintOrder="stroke"
          className="pointer-events-none tabular-nums text-white dark:text-slate-900"
        >
          {formatarPct(valor)}
        </text>
      ) : null}
    </g>
  );
}

function GraficoSerie({
  rows,
  width,
  dataKey,
  nome,
  cor,
  gradienteId,
  onPonto,
}: {
  rows: Row[];
  width: number;
  dataKey: SerieId;
  nome: string;
  cor: string;
  gradienteId: string;
  onPonto?: (ponto: PontoSerieInadimplencia, modo: SerieId) => void;
}) {
  const ativoRef = useRef<Row | null>(null);
  const maxPct = rows.reduce((m, r) => Math.max(m, Number(r[dataKey] ?? 0)), 0);
  const yMax = Math.max(5, Math.ceil(maxPct * 1.25) || 5);
  const tickEvery = rows.length > 16 ? Math.ceil(rows.length / 14) : 0;

  const abrir = (p?: Row | null) => {
    if (!p?.mes) return;
    onPonto?.(p, dataKey);
  };

  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: cor }}>
        {nome}
      </p>
      <div
        role="presentation"
        className="[&_.recharts-dot]:cursor-pointer [&_.recharts-active-dot]:cursor-pointer [&_.recharts-tooltip-cursor]:pointer-events-none"
        onClick={() => abrir(ativoRef.current)}
      >
        <AreaChart
          width={width}
          height={248}
          data={rows}
          margin={{ top: 22, right: 28, left: 4, bottom: 8 }}
          onMouseMove={(state) => {
            const p = state?.activePayload?.[0]?.payload as Row | undefined;
            ativoRef.current = p?.mes ? p : null;
          }}
          onMouseLeave={() => {
            ativoRef.current = null;
          }}
        >
          <defs>
            <linearGradient id={gradienteId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity={0.72} />
              <stop offset="55%" stopColor={cor} stopOpacity={0.28} />
              <stop offset="100%" stopColor={cor} stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={tickEvery} minTickGap={12} />
          <YAxis
            tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
            tick={{ fontSize: 11 }}
            width={48}
            domain={[0, yMax]}
          />
          <Tooltip
            content={<TooltipPonto modo={dataKey} />}
            cursor={{ stroke: '#94a3b8', strokeWidth: 1, pointerEvents: 'none' }}
            wrapperStyle={{ zIndex: 30, outline: 'none', pointerEvents: 'none' }}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            name={nome}
            stroke={cor}
            strokeWidth={2.5}
            fill={`url(#${gradienteId})`}
            fillOpacity={1}
            isAnimationActive={false}
            dot={(props) => (
              <Bolinha
                cx={props.cx}
                cy={props.cy}
                payload={props.payload as Row | undefined}
                fill={cor}
                dataKey={dataKey}
                r={3}
                onAbrir={abrir}
              />
            )}
            activeDot={(props) => (
              <Bolinha
                cx={props.cx}
                cy={props.cy}
                payload={props.payload as Row | undefined}
                fill={cor}
                dataKey={dataKey}
                r={3}
                ativo
                onAbrir={abrir}
              />
            )}
          />
        </AreaChart>
      </div>
    </div>
  );
}

export default function EvolucaoInadimplenciaChart({ serie, onPonto }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const apply = () => setBoxW(Math.floor(el.clientWidth));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows: Row[] = serie.map((p) => ({
    ...p,
    label: rotuloPeriodoMes(p.mes),
  }));
  const visivel = Math.max(boxW - 8, 0);
  const chartWidth = Math.max(visivel, rows.length * 64);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Evolução no período (por vencimento)
        </h3>
      </div>
      <div ref={boxRef} className="w-full min-w-0">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Sem vencimentos no período.</p>
        ) : visivel < 40 ? (
          <div className="h-56" />
        ) : (
          <div className="overflow-x-auto">
            <div className="space-y-5" style={{ width: chartWidth }}>
              <GraficoSerie
                rows={rows}
                width={chartWidth}
                dataKey="pctAtraso"
                nome="Índice de atraso"
                cor="#1E22AA"
                gradienteId="sombraAtraso"
                onPonto={onPonto}
              />
              <GraficoSerie
                rows={rows}
                width={chartWidth}
                dataKey="pctInadimplente"
                nome="% inadimplente"
                cor="#e11d48"
                gradienteId="sombraInadimplente"
                onPonto={onPonto}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
