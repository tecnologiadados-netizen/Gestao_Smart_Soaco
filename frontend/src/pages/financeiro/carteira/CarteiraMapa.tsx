import { useMemo } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { CarteiraMapaPonto } from '../../../api/financeiro';
import { formatarReais } from '../dashboard/dashboardFormat';

const CENTRO_NE: [number, number] = [-4.5, -44.5];
const ZOOM = 6;
const RAIO_MIN = 8;
const RAIO_MAX = 42;

const COR_UF: Record<string, string> = {
  PI: '#0d9488',
  MA: '#2563eb',
  PA: '#d97706',
  CE: '#7c3aed',
};

type Props = {
  pontos: CarteiraMapaPonto[];
  semLocalizacao: number;
  onSelectMunicipio: (municipio: string) => void;
};

function raioPorValor(valor: number, maxSqrt: number): number {
  if (maxSqrt <= 0) return RAIO_MIN;
  const t = Math.sqrt(Math.max(0, valor)) / maxSqrt;
  return RAIO_MIN + t * (RAIO_MAX - RAIO_MIN);
}

export default function CarteiraMapa({ pontos, semLocalizacao, onSelectMunicipio }: Props) {
  const maxSqrt = useMemo(() => {
    let m = 0;
    for (const p of pontos) m = Math.max(m, Math.sqrt(Math.max(0, p.saldoAReceber)));
    return m;
  }, [pontos]);

  return (
    <div className="card-panel p-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
        Mapa por Cidade (Saldo a Receber)
      </h3>
      <div className="h-[360px] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
        <MapContainer
          center={CENTRO_NE}
          zoom={ZOOM}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {pontos.map((p) => (
            <CircleMarker
              key={`${p.municipio}-${p.uf}`}
              center={[p.lat, p.lng]}
              radius={raioPorValor(p.saldoAReceber, maxSqrt)}
              pathOptions={{
                color: COR_UF[p.uf] ?? '#475569',
                fillColor: COR_UF[p.uf] ?? '#64748b',
                fillOpacity: 0.55,
                weight: 1.5,
              }}
              eventHandlers={{
                click: () => onSelectMunicipio(p.municipio),
              }}
            >
              <Tooltip sticky>
                <div className="text-xs space-y-0.5 min-w-[180px]">
                  <div className="font-semibold">
                    {p.municipio} – {p.uf}
                  </div>
                  <hr className="my-1 border-slate-300" />
                  <div>Saldo a Receber: {formatarReais(p.saldoAReceber)}</div>
                  <div>Saldo a Faturar: {formatarReais(p.saldoAFaturar)}</div>
                  <div>Saldo Romaneado: {formatarReais(p.saldoRomaneado)}</div>
                  <div>Pedidos: {p.qtdPedidos}</div>
                  <div>Clientes: {p.qtdClientes}</div>
                </div>
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      {semLocalizacao > 0 && (
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          Sem localização: {semLocalizacao} município{semLocalizacao === 1 ? '' : 's'}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-500">
        {Object.entries(COR_UF).map(([uf, cor]) => (
          <span key={uf} className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: cor }} />
            {uf}
          </span>
        ))}
      </div>
    </div>
  );
}
