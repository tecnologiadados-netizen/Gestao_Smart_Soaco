import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MesPortaPallets } from '../../api/portaPalletsComercial';
import { formatMoeda, formatNumero } from '../../components/painel-comercial/painelComercialUtils';
import { formatTaxa, labelMes } from './portaPalletsComercialFormat';
import { alturaRelativa, ticksEixo, type MetricaEvolucao } from './PortaPalletsEvolucaoBarras';

const COR_PROPOSTO = 'rgba(148,163,184,0.26)';
const COR_PEDIDO_ANTERIOR = '#94A3B8';
const COR_PEDIDO_ATUAL = '#5C92D6';
/** Largura mínima por mês; acima disso o painel rola na horizontal e os rótulos continuam legíveis. */
export const LARGURA_MES_ANO_ANO = 76;

type Lado = { proposto: number; pedido: number };

type Ponto = {
  mes: string;
  mesAnterior: string;
  label: string;
  atual: Lado;
  anterior: Lado | null;
  topo: number;
  /** Variação em % do que virou pedido sobre o mesmo mês do ano anterior. */
  variacao: number | null;
};

type Props = {
  meses: MesPortaPallets[];
  mesesAnoAnterior: MesPortaPallets[] | null;
  metrica: MetricaEvolucao;
  onBarra: (mes: MesPortaPallets, anoAnterior: boolean) => void;
};

function lado(m: MesPortaPallets, metrica: MetricaEvolucao): Lado {
  return metrica === 'valor'
    ? { proposto: m.valorPropostas, pedido: m.valorPedidosGerados }
    : { proposto: m.qtdPropostas, pedido: m.qtdConvertidas };
}

function compacto(v: number, metrica: MetricaEvolucao): string {
  return metrica === 'valor' ? formatMoeda(v, true) : formatNumero(v);
}

function mesMenosUmAno(mes: string): string {
  const [a, m] = mes.split('-');
  return `${Number(a) - 1}-${m}`;
}

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Ex.: "Jan 25 vs 26" — mês e os dois anos comparados. */
function rotuloComparacao(mes: string): string {
  const [a, m] = mes.split('-');
  const ano = Number(a);
  const nome = MESES_CURTOS[Number(m) - 1] ?? m;
  return `${nome} ${String(ano - 1).slice(2)} vs ${String(ano).slice(2)}`;
}

function textoVariacao(v: number): string {
  return `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`;
}

/**
 * Mês a mês, duas barras lado a lado (ano anterior e período atual). Em cada uma, a barra larga translúcida
 * é o proposto e a barra interna é o que virou pedido — mesma lógica de "Propostas x fechamento".
 */
export default function PortaPalletsAnoAnoBarras({ meses, mesesAnoAnterior, metrica, onBarra }: Props) {
  const anteriorPorMes = useMemo(
    () => new Map((mesesAnoAnterior ?? []).map((m) => [m.mes, m])),
    [mesesAnoAnterior]
  );
  const atualPorMes = useMemo(() => new Map(meses.map((m) => [m.mes, m])), [meses]);

  const pontos = useMemo<Ponto[]>(
    () =>
      [...meses]
        .sort((a, b) => a.mes.localeCompare(b.mes))
        .map((m) => {
          const mesAnterior = mesMenosUmAno(m.mes);
          const ant = anteriorPorMes.get(mesAnterior);
          const atual = lado(m, metrica);
          const anterior = ant ? lado(ant, metrica) : null;
          const variacao =
            anterior && anterior.pedido > 0 ? ((atual.pedido - anterior.pedido) / anterior.pedido) * 100 : null;
          const topo = Math.max(atual.proposto, atual.pedido, anterior?.proposto ?? 0, anterior?.pedido ?? 0);
          return { mes: m.mes, mesAnterior, label: rotuloComparacao(m.mes), atual, anterior, topo, variacao };
        }),
    [anteriorPorMes, meses, metrica]
  );
  const maior = Math.max(...pontos.map((p) => p.topo), 1) * 1.08;
  const comRotulo = true;

  if (pontos.length === 0) return <p className="py-16 text-center text-sm text-slate-400">Sem movimento no recorte.</p>;

  const clicar = (p: Ponto, anterior: boolean) => {
    const m = anterior ? anteriorPorMes.get(p.mesAnterior) : atualPorMes.get(p.mes);
    if (m) onBarra(m, anterior);
  };

  return (
    <ResponsiveContainer>
      <BarChart data={pontos} margin={{ top: comRotulo ? 24 : 12, right: 8, left: 8, bottom: 0 }} barCategoryGap="18%">
        <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.16)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          interval={0}
          axisLine={false}
          tickLine={false}
        />
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
        <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} content={<TooltipAnoAno metrica={metrica} />} />
        <Bar
          dataKey="topo"
          isAnimationActive={false}
          shape={(props: unknown) => (
            <GrupoAnoAno {...(props as GrupoProps)} comRotulo={comRotulo} onClick={clicar} />
          )}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

type GrupoProps = { x?: number; y?: number; width?: number; height?: number; payload?: Ponto };

function BarraPreenchida({
  x,
  base,
  largura,
  alturaTotal,
  topo,
  valores,
  corPedido,
  brilho,
  onClick,
}: {
  x: number;
  base: number;
  largura: number;
  alturaTotal: number;
  topo: number;
  valores: Lado;
  corPedido: string;
  brilho: boolean;
  onClick: () => void;
}) {
  const hProposto = alturaTotal * alturaRelativa(valores.proposto, topo);
  const hPedido = alturaTotal * alturaRelativa(valores.pedido, topo);
  const largPedido = Math.max(3, largura * 0.55);
  const xPedido = x + (largura - largPedido) / 2;
  return (
    <g className="cursor-pointer" onClick={onClick}>
      <rect x={x} y={base - hProposto} width={largura} height={hProposto} rx={3} fill={COR_PROPOSTO} />
      <rect
        x={xPedido}
        y={base - hPedido}
        width={largPedido}
        height={hPedido}
        rx={2}
        fill={corPedido}
        style={brilho ? { filter: 'drop-shadow(0 0 4px rgba(92,146,214,0.55))' } : undefined}
      />
    </g>
  );
}

function GrupoAnoAno({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  payload,
  comRotulo,
  onClick,
}: GrupoProps & { comRotulo: boolean; onClick: (p: Ponto, anterior: boolean) => void }) {
  if (!payload || width <= 0) return null;
  const base = y + height;
  const gap = Math.max(2, width * 0.08);
  const largura = (width - gap) / 2;
  const xAtual = x + largura + gap;
  const hAtual = Math.max(
    height * alturaRelativa(payload.atual.proposto, payload.topo),
    height * alturaRelativa(payload.atual.pedido, payload.topo)
  );
  const cx = xAtual + largura / 2;

  let rotulo: { texto: string; cor: string } | null = null;
  if (payload.anterior) {
    if (payload.variacao == null) {
      if (payload.atual.pedido > 0) rotulo = { texto: '▲ novo', cor: '#34d399' };
    } else if (payload.variacao > 0.5) {
      rotulo = { texto: `▲ ${textoVariacao(payload.variacao)}`, cor: '#34d399' };
    } else if (payload.variacao < -0.5) {
      rotulo = { texto: `▼ ${textoVariacao(payload.variacao)}`, cor: '#fb7185' };
    } else {
      rotulo = { texto: '► 0%', cor: '#94a3b8' };
    }
  }

  return (
    <g>
      {payload.anterior ? (
        <BarraPreenchida
          x={x}
          base={base}
          largura={largura}
          alturaTotal={height}
          topo={payload.topo}
          valores={payload.anterior}
          corPedido={COR_PEDIDO_ANTERIOR}
          brilho={false}
          onClick={() => onClick(payload, true)}
        />
      ) : null}
      <BarraPreenchida
        x={xAtual}
        base={base}
        largura={largura}
        alturaTotal={height}
        topo={payload.topo}
        valores={payload.atual}
        corPedido={COR_PEDIDO_ATUAL}
        brilho
        onClick={() => onClick(payload, false)}
      />
      {comRotulo && rotulo ? (
        <text x={cx} y={base - hAtual - 6} textAnchor="middle" fill={rotulo.cor} className="text-[10px] font-semibold">
          {rotulo.texto}
        </text>
      ) : null}
    </g>
  );
}

function TooltipAnoAno({
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
  const linha = (titulo: string, l: Lado | null, cor: string) => (
    <div className="mt-1">
      <p className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
        <span className="inline-block h-2 w-2 rounded-sm" style={{ background: cor }} />
        {titulo}
      </p>
      {l ? (
        <p className="pl-3.5 text-slate-500 dark:text-slate-400">
          Proposto {fmt(l.proposto)} · virou pedido {fmt(l.pedido)} ({formatTaxa(l.proposto > 0 ? l.pedido / l.proposto : null)})
        </p>
      ) : (
        <p className="pl-3.5 text-slate-500">sem dados</p>
      )}
    </div>
  );
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-xs shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#12141c]/95">
      {linha(labelMes(p.mes), p.atual, COR_PEDIDO_ATUAL)}
      {linha(labelMes(p.mesAnterior), p.anterior, COR_PEDIDO_ANTERIOR)}
      {p.variacao != null ? (
        <p className={`mt-1.5 font-semibold ${p.variacao >= 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
          {p.variacao >= 0 ? 'Melhora' : 'Piora'} de {textoVariacao(p.variacao)} no que virou pedido
        </p>
      ) : null}
      <p className="mt-1 text-[11px] text-slate-400">Clique na barra para abrir a origem</p>
    </div>
  );
}
