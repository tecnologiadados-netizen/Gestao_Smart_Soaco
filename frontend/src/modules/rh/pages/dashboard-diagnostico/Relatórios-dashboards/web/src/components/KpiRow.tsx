import { ArrowUpRight } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type Kpis = {
  total: number
  inj: number
  jus: number
  nao: number
  pctInj: number
  pctJus: number
  ocorrencias: number
}

type HeroJust = {
  mediaMensal: number
  serie: { mes: string; pct: number }[]
}

type Props = { kpis: Kpis; heroJustificadas: HeroJust }

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

function HeroJustificadasCard({ hero }: { hero: HeroJust }) {
  const data = hero.serie.map((p) => ({ name: p.mes, pct: p.pct }))
  const hasData = data.length > 0

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-navy to-brand-blue p-4 text-white shadow-card">
      <div className="relative z-[1] shrink-0">
        <p className="inline-flex w-fit rounded-lg bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/90">
          % de ausências justificadas
        </p>
        <p className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">{hero.mediaMensal.toFixed(1)}%</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/75">
          Percentual consolidado do período (justificadas ÷ total).
        </p>
        <ArrowUpRight className="absolute right-2 top-2 h-4 w-4 text-white/25" strokeWidth={1.5} />
      </div>

      <div className="relative z-[1] mt-2 flex min-h-0 flex-1 flex-col justify-end">
        {hasData ? (
          <div className="h-[72px] w-full shrink-0 sm:h-[76px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 7 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.18)' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  angle={-35}
                  textAnchor="end"
                  height={34}
                />
                <YAxis domain={[0, 100]} hide width={0} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(4, 30, 66, 0.95)',
                    color: '#fff',
                    fontSize: 12,
                  }}
                  formatter={(value) => {
                    const n = Number(value)
                    if (Number.isNaN(n)) return ['', '']
                    return [`${n.toFixed(1)}%`, 'Justificadas']
                  }}
                  labelFormatter={(l) => String(l)}
                />
                <Line
                  type="monotone"
                  dataKey="pct"
                  name="% justificadas"
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth={1.75}
                  dot={{ r: 1.5, fill: '#FFAD00', strokeWidth: 0 }}
                  activeDot={{ r: 3, fill: '#FFAD00', stroke: 'rgba(255,255,255,0.45)', strokeWidth: 1 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[72px] shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[11px] text-white/60 sm:h-[76px]">
            Sem dados no filtro
          </div>
        )}
      </div>
    </div>
  )
}

export function KpiRow({ kpis, heroJustificadas }: Props) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <HeroJustificadasCard hero={heroJustificadas} />

      <div className="flex h-full min-h-0 flex-col rounded-2xl border border-black/5 bg-white p-4 shadow-soft">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-gray">Total de dias</p>
        <p className="mt-1 text-2xl font-bold leading-tight text-navy sm:text-3xl">{fmt(kpis.total)}</p>
        <p className="mt-auto pt-2 text-[11px] leading-snug text-brand-gray">{fmt(kpis.ocorrencias)} ocorrências no filtro</p>
      </div>

      <div className="flex h-full min-h-0 flex-col rounded-2xl border border-black/5 bg-white p-4 shadow-soft">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-gray">Justificadas</p>
        <p className="mt-1 text-2xl font-bold leading-tight text-brand-blue sm:text-3xl">{fmt(kpis.jus)}</p>
        <p className="mt-auto pt-2 text-[11px] leading-snug text-brand-gray">{kpis.pctJus.toFixed(1)}% do total (período)</p>
      </div>

      <div className="flex h-full min-h-0 flex-col rounded-2xl border border-black/5 bg-white p-4 shadow-soft">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-gray">Injustificadas</p>
        <p className="mt-1 text-2xl font-bold leading-tight text-navy sm:text-3xl">{fmt(kpis.inj)}</p>
        <p className="mt-auto pt-2 text-[11px] leading-snug text-brand-gray">Procedente / colaborador</p>
      </div>
    </div>
  )
}
