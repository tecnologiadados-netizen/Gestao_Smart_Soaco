import { useId } from 'react';
import type { FunilPortaPallets, IndicadorPortaPallets } from '../../api/portaPalletsComercial';
import { formatMoeda, formatNumero } from '../../components/painel-comercial/painelComercialUtils';
import { formatDias, formatTaxa } from './portaPalletsComercialFormat';

type Etapa = {
  rotulo: string;
  valor: number;
  dinheiro: number;
  indicador: IndicadorPortaPallets;
  legenda?: string[];
};

type Props = {
  funil: FunilPortaPallets;
  onAbrir: (indicador: IndicadorPortaPallets, titulo: string, subtitulo: string) => void;
};

const ALTURA = 84;
const GAP = 14;
const LARGURA = 190;
/** Margem interna para o contorno arredondado (strokeLinejoin) não sair do desenho. */
const MARGEM = 6;
/** Largura relativa de cada borda do funil: topo da 1ª fatia, base da 1ª = topo da 2ª, base da 2ª. */
const BORDAS = [1, 0.66, 0.42];
const GRADIENTES = [
  { de: '#E4E6FB', ate: '#AEB3EC', texto: '#1E1B4B' },
  { de: '#8F96EA', ate: '#4F56C6', texto: '#FFFFFF' },
];

function razao(parte: number, todo: number): string {
  return todo > 0 ? formatTaxa(parte / todo) : '—';
}

export default function PortaPalletsFunil({ funil, onAbrir }: Props) {
  const etapas: Etapa[] = [
    { rotulo: 'Propostas emitidas', valor: funil.propostas, dinheiro: funil.valorPropostas, indicador: 'propostas' },
    {
      rotulo: 'Pedidos gerados',
      valor: funil.pedidosGerados,
      dinheiro: funil.valorPedidosGerados,
      indicador: 'pedidos_gerados',
      legenda: [
        `${formatNumero(funil.convertidas)} de ${formatNumero(funil.propostas)} propostas`,
        `viraram pedido (${razao(funil.convertidas, funil.propostas)})`,
      ],
    },
  ];
  const idBase = useId().replace(/:/g, '');

  const infos: Array<{
    titulo: string;
    valor: string;
    detalhe: string;
    indicador: IndicadorPortaPallets;
    novos?: { valor: number; detalhe: string; titulo: string; indicador: IndicadorPortaPallets };
  }> = [
    {
      titulo: 'Lead time',
      valor: formatDias(funil.tempoMedioDias),
      detalhe: 'da proposta ao primeiro pedido, em média',
      indicador: 'tempo',
    },
    {
      titulo: 'Clientes ao todo',
      valor: formatNumero(funil.clientesTotal),
      detalhe: 'com proposta aberta no recorte',
      indicador: 'clientes_total',
      novos: {
        valor: funil.clientesNovos,
        detalhe: `${razao(funil.clientesNovos, funil.clientesTotal)} do total`,
        titulo: 'Clientes novos',
        indicador: 'clientes_novos',
      },
    },
    {
      titulo: 'Clientes que fecharam negócio',
      valor: formatNumero(funil.clientesComPedido),
      detalhe: `${razao(funil.clientesComPedido, funil.clientesTotal)} dos clientes · pedido gerado pela proposta`,
      indicador: 'clientes_com_pedido',
      novos: {
        valor: funil.novosComPedido,
        detalhe: `${razao(funil.novosComPedido, funil.clientesComPedido)} de quem fechou`,
        titulo: 'Novos que fecharam negócio',
        indicador: 'novos_com_pedido',
      },
    },
  ];

  const larguraFunil = LARGURA;
  const larguraTotal = LARGURA + 160;
  const alturaTotal = etapas.length * ALTURA + (etapas.length - 1) * GAP + MARGEM * 2;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Funil de vendas</h2>
        <p className="text-xs text-slate-500">
          Propostas abertas no recorte e os pedidos gerados por elas. Clique para ver a origem.
        </p>
      </div>
      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <svg
          viewBox={`0 0 ${larguraTotal} ${alturaTotal}`}
          className="mx-auto block w-full max-w-[350px]"
          role="img"
          aria-label="Funil de propostas e pedidos"
        >
          <defs>
            {GRADIENTES.map((g, i) => (
              <linearGradient key={i} id={`${idBase}-g${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={g.de} />
                <stop offset="100%" stopColor={g.ate} />
              </linearGradient>
            ))}
            <filter id={`${idBase}-brilho`} x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#6E76D6" floodOpacity="0.35" />
            </filter>
          </defs>
          {etapas.map((etapa, i) => {
            const topo = BORDAS[i]! * (larguraFunil - MARGEM * 2);
            const base = BORDAS[i + 1]! * (larguraFunil - MARGEM * 2);
            const y = MARGEM + i * (ALTURA + GAP);
            const xt = (larguraFunil - topo) / 2;
            const xb = (larguraFunil - base) / 2;
            const xBordaMeio = (xt + topo + xb + base) / 2;
            const xRotulo = larguraFunil + 14;
            const cor = GRADIENTES[i]!;
            return (
              <g
                key={etapa.rotulo}
                className="cursor-pointer transition-opacity hover:opacity-85"
                onClick={() => onAbrir(etapa.indicador, etapa.rotulo, formatNumero(etapa.valor))}
              >
                <path
                  d={`M${xt},${y} L${xt + topo},${y} L${xb + base},${y + ALTURA} L${xb},${y + ALTURA} Z`}
                  fill={`url(#${idBase}-g${i})`}
                  stroke={`url(#${idBase}-g${i})`}
                  strokeWidth={10}
                  strokeLinejoin="round"
                  filter={`url(#${idBase}-brilho)`}
                />
                <path
                  d={`M${xt + 6},${y + 1} L${xt + topo - 6},${y + 1}`}
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
                <text
                  x={larguraFunil / 2}
                  y={y + ALTURA / 2 + 8}
                  textAnchor="middle"
                  fill={cor.texto}
                  className="text-[24px] font-bold tabular-nums"
                >
                  {formatNumero(etapa.valor)}
                </text>
                <line
                  x1={xBordaMeio + 8}
                  x2={xRotulo - 6}
                  y1={y + ALTURA / 2}
                  y2={y + ALTURA / 2}
                  className="stroke-slate-300 dark:stroke-slate-600"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <circle cx={xRotulo - 6} cy={y + ALTURA / 2} r={2.5} fill={cor.ate} />
                <text x={xRotulo} y={y + ALTURA / 2 - 12} className="fill-slate-700 text-[10px] font-semibold uppercase dark:fill-slate-200">
                  {etapa.rotulo}
                </text>
                <text x={xRotulo} y={y + ALTURA / 2 + 4} className="fill-slate-900 text-[13px] font-bold tabular-nums dark:fill-white">
                  {formatMoeda(etapa.dinheiro)}
                </text>
                {etapa.legenda?.map((linha, j) => (
                  <text
                    key={linha}
                    x={xRotulo}
                    y={y + ALTURA / 2 + 18 + j * 12}
                    className="fill-slate-500 text-[10px] dark:fill-slate-400"
                  >
                    {linha}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <ul className="space-y-2">
        {infos.map((info) => (
          <li
            key={info.titulo}
            className="flex items-stretch overflow-hidden rounded-lg border-l-4 border-[#6E76D6] bg-slate-50 dark:bg-white/[0.04]"
          >
            <button
              type="button"
              className="min-w-0 flex-1 px-3 py-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-white/[0.08]"
              onClick={() => onAbrir(info.indicador, info.titulo, info.valor)}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-semibold text-[#3B43B8] dark:text-[#C5C9EF]">{info.titulo}</span>
                <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{info.valor}</span>
              </span>
              <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{info.detalhe}</span>
            </button>
            {info.novos ? (
              <button
                type="button"
                className="flex w-32 shrink-0 flex-col items-end justify-center border-l border-slate-200 px-3 py-1.5 text-right transition hover:bg-emerald-50 dark:border-white/10 dark:hover:bg-emerald-500/10"
                onClick={() => onAbrir(info.novos!.indicador, info.novos!.titulo, formatNumero(info.novos!.valor))}
              >
                <span className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatNumero(info.novos.valor)}{' '}
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">
                    novos
                  </span>
                </span>
                <span className="whitespace-nowrap text-[10px] text-slate-500 dark:text-slate-400">{info.novos.detalhe}</span>
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      </div>
    </div>
  );
}
