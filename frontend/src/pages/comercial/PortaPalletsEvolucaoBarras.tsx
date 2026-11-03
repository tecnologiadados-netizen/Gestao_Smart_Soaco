import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MesPortaPallets } from '../../api/portaPalletsComercial';
import { formatMoeda, formatNumero } from '../../components/painel-comercial/painelComercialUtils';
import { formatTaxa, labelMes } from './portaPalletsComercialFormat';

export type MetricaEvolucao = 'valor' | 'qtde';
/** Rótulo sobre a barra escolhida na legenda: a azul (virou pedido, padrão) ou a cinza (proposto). */
export type RotuloEvolucao = 'pedido' | 'proposto';

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
/** Largura mínima por mês; acima disso o painel rola na horizontal e os rótulos continuam legíveis. */
export const LARGURA_MES_FECHAMENTO = 64;

type Props = {
  meses: MesPortaPallets[];
  metrica: MetricaEvolucao;
  rotulo: RotuloEvolucao;
  onMes: (mes: MesPortaPallets) => void;
};

function compacto(v: number, metrica: MetricaEvolucao): string {
  return metrica === 'valor' ? formatMoeda(v, true) : formatNumero(v);
}

/**
 * O eixo usa raiz quadrada: o fechado costuma ser bem menor que o proposto e sumiria na escala linear.
 * A ordem entre os meses e os valores do eixo continuam corretos; a altura não é proporcional.
 */
export function alturaRelativa(v: number, max: number): number {
  if (max <= 0 || v <= 0) return 0;
  return Math.sqrt(v) / Math.sqrt(max);
}

export function ticksEixo(max: number): number[] {
  const n = 4;
  return Array.from({ length: n + 1 }, (_, i) => max * (i / n) ** 2);
}

export default function PortaPalletsEvolucaoBarras({ meses, metrica, rotulo, onMes }: Props) {
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
  const maior = Math.max(...pontos.map((p) => p.topo), 1) * 1.05;
  const comRotulo = true;

  if (pontos.length === 0) return <p className="py-16 text-center text-sm text-slate-400">Sem movimento no recorte.</p>;

  return (
    <ResponsiveContainer>
      <BarChart data={pontos} margin={{ top: comRotulo ? 22 : 12, right: 8, left: 8, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.16)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} interval={0} axisLine={false} tickLine={false} />
        <YAxis
          scale="sqrt"
          domain={[0, maior]}
          ticks={ticksEixo(maior)}
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
              rotulo={rotulo}
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
  rotulo,
  onClick,
}: BarraProps & {
  comRotulo: boolean;
  metrica: MetricaEvolucao;
  rotulo: RotuloEvolucao;
  onClick: (p: Ponto) => void;
}) {
  if (!payload || width <= 0) return null;
  const base = y + height;
  const hExterno = height * alturaRelativa(payload.externo, payload.topo);
  const hInterno = height * alturaRelativa(payload.interno, payload.topo);
  const largInterno = Math.max(4, width * 0.55);
  const xInterno = x + (width - largInterno) / 2;
  const cx = x + width / 2;
  const topoExterno = base - hExterno;
  const topoInterno = base - hInterno;
  const yRotulo = rotulo === 'pedido' ? topoInterno : topoExterno;

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
        <text
          x={cx}
          y={yRotulo - 6}
          textAnchor="middle"
          fill={rotulo === 'pedido' ? COR_PREENCHIDO_TEXTO : '#CBD5E1'}
          className="text-[10px] font-semibold"
        >
          {compacto(rotulo === 'pedido' ? payload.interno : payload.externo, metrica)}
        </text>
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
      <p className="mt-1 text-[11px] text-slate-400">Clique para auditar as propostas e os pedidos do mês</p>
    </div>
  );
}
