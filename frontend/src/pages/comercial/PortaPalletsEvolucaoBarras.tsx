import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MesPortaPallets } from '../../api/portaPalletsComercial';
import { formatMoeda, formatNumero } from '../../components/painel-comercial/painelComercialUtils';
import { formatTaxa, labelMes } from './portaPalletsComercialFormat';

export type MetricaEvolucao = 'valor' | 'qtde';

type Ponto = {
  mes: string;
  label: string;
  externo: number;
  interno: number;
  topo: number;
  pct: number | null;
};

const COR_FUNDO = 'rgba(148,163,184,0.32)';
const COR_PREENCHIDO = '#5C92D6';
const COR_PREENCHIDO_TEXTO = '#7FB0EE';
const COR_ACIMA = '#34D399';
const COR_ABAIXO = '#FB7185';
/** Acima deste número de meses os rótulos sobre as barras ficam ilegíveis. */
const MAX_MESES_COM_ROTULO = 18;

type Props = {
  meses: MesPortaPallets[];
  metrica: MetricaEvolucao;
  /** Percentual do recorte inteiro; o rótulo do mês fica verde acima dele e vermelho abaixo. */
  pctReferencia: number | null;
  onMes: (mes: MesPortaPallets) => void;
};

function compacto(v: number, metrica: MetricaEvolucao): string {
  return metrica === 'valor' ? formatMoeda(v, true) : formatNumero(v);
}

export default function PortaPalletsEvolucaoBarras({ meses, metrica, pctReferencia, onMes }: Props) {
  const pontos = useMemo<Ponto[]>(
    () =>
      [...meses]
        .sort((a, b) => a.mes.localeCompare(b.mes))
        .map((m) => {
          const externo = metrica === 'valor' ? m.valorPropostas : m.qtdPropostas;
          const interno = metrica === 'valor' ? m.valorPedidosGerados : m.qtdConvertidas;
          return {
            mes: m.mes,
            label: labelMes(m.mes),
            externo,
            interno,
            topo: Math.max(externo, interno),
            pct: externo > 0 ? interno / externo : null,
          };
        }),
    [meses, metrica]
  );
  const porMes = useMemo(() => new Map(meses.map((m) => [m.mes, m])), [meses]);
  const maior = Math.max(...pontos.map((p) => p.topo), 1);
  const comRotulo = pontos.length <= MAX_MESES_COM_ROTULO;

  if (pontos.length === 0) return <p className="py-16 text-center text-sm text-slate-400">Sem movimento no recorte.</p>;

  return (
    <ResponsiveContainer>
      <BarChart data={pontos} margin={{ top: comRotulo ? 36 : 12, right: 8, left: 8, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.16)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
        <YAxis
          domain={[0, maior * 1.05]}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          width={metrica === 'valor' ? 72 : 36}
          tickFormatter={(v: number) => compacto(v, metrica)}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} content={<TooltipBarras metrica={metrica} />} />
        <Bar
          dataKey="topo"
          isAnimationActive={false}
          shape={(props: unknown) => (
            <BarraSobreposta
              {...(props as BarraProps)}
              comRotulo={comRotulo}
              metrica={metrica}
              pctReferencia={pctReferencia}
              onClick={(p) => {
                const m = porMes.get(p.mes);
                if (m) onMes(m);
              }}
            />
          )}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

type BarraProps = { x?: number; y?: number; width?: number; height?: number; payload?: Ponto };

function BarraSobreposta({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  payload,
  comRotulo,
  metrica,
  pctReferencia,
  onClick,
}: BarraProps & {
  comRotulo: boolean;
  metrica: MetricaEvolucao;
  pctReferencia: number | null;
  onClick: (p: Ponto) => void;
}) {
  if (!payload || width <= 0) return null;
  const base = y + height;
  const porUnidade = payload.topo > 0 ? height / payload.topo : 0;
  const hExterno = payload.externo * porUnidade;
  const hInterno = payload.interno * porUnidade;
  const largInterno = Math.max(4, width * 0.55);
  const xInterno = x + (width - largInterno) / 2;
  const corPct =
    payload.pct == null || pctReferencia == null ? '#94a3b8' : payload.pct >= pctReferencia ? COR_ACIMA : COR_ABAIXO;
  const cx = x + width / 2;
  const topoExterno = base - hExterno;
  const topoInterno = base - hInterno;
  const yTopo = Math.min(topoExterno, topoInterno);

  return (
    <g className="cursor-pointer" onClick={() => onClick(payload)}>
      <rect x={x} y={topoExterno} width={width} height={hExterno} rx={3} fill={COR_FUNDO} />
      <rect
        x={xInterno}
        y={topoInterno}
        width={largInterno}
        height={hInterno}
        rx={2}
        fill={COR_PREENCHIDO}
        style={{ filter: 'drop-shadow(0 0 4px rgba(92,146,214,0.55))' }}
      />
      {comRotulo && payload.topo > 0 ? (
        <>
          <text x={cx} y={yTopo - 18} textAnchor="middle" fill={corPct} className="text-[12px] font-bold">
            {formatTaxa(payload.pct)}
          </text>
          <text x={cx} y={yTopo - 6} textAnchor="middle" fill={COR_PREENCHIDO_TEXTO} className="text-[10px] font-medium">
            {compacto(payload.interno, metrica)}
          </text>
        </>
      ) : null}
    </g>
  );
}

function TooltipBarras({
  active,
  payload,
  metrica,
}: {
  active?: boolean;
  payload?: Array<{ payload?: Ponto }>;
  metrica: MetricaEvolucao;
}) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const fmt = (v: number) => (metrica === 'valor' ? formatMoeda(v) : formatNumero(v));
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-xs shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#12141c]/95">
      <p className="mb-1 font-medium text-slate-400">{p.label}</p>
      <p className="text-slate-800 dark:text-slate-100">
        {metrica === 'valor' ? 'Propostas' : 'Propostas emitidas'}: {fmt(p.externo)}
      </p>
      <p className="text-slate-800 dark:text-slate-100">
        {metrica === 'valor' ? 'Vendido nos pedidos gerados' : 'Viraram pedido'}: {fmt(p.interno)} ({formatTaxa(p.pct)})
      </p>
      <p className="mt-1 text-[11px] text-slate-400">Clique para abrir a origem do mês</p>
    </div>
  );
}
