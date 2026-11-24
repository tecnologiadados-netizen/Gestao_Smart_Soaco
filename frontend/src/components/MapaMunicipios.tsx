import { useEffect, useState, useMemo, useCallback, useRef, Fragment, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MapContainer, TileLayer, Circle, Tooltip, Popup, useMap, Polyline, CircleMarker, Pane, Marker } from 'react-leaflet';
import { MODAL_Z_MAPA_POPUP, useRegisterModalEscape } from '../contexts/ModalStackContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { obterMapaMunicipios, type MapaMunicipioItem, type CorBolhaMapa, type MapaMunicipiosResponse, type FiltrosPedidos } from '../api/pedidos';
import { PONTO_RETORNO_TERESINA } from '../utils/heatmapRoteirizador';
import { iconeBandeiraFiltro, iconeParadaRota, iconeParadaSelecao } from '../utils/heatmapParadaMapaIcon';
import { criarMatcherTextoLivre } from '../utils/textoLivreBusca';
import { aplicarZoomRoteiroNoMapa, type PontoMapaRoteiro } from '../utils/heatmapMapaBoundsRoteiro';
import { MAPA_TILE_ATTRIBUTION, MAPA_TILE_URL } from '../config/mapaTiles';
import { estilosTrechosIntersecao, recortarPolylineForaDaIntersecao } from '../utils/heatmapRotasTodasCarradas';
import HeatmapDetalhesPedidosTable from './HeatmapDetalhesPedidosTable';

const CENTRO_BRASIL: [number, number] = [-14.235, -51.9253];
const ZOOM = 4;
const DADOS_VAZIOS: MapaMunicipioItem[] = [];
const FILTROS_VAZIOS: FiltrosPedidos = {};
const RAIO_MIN_KM = 3;
const RAIO_MAX_KM = 35;

/** Distância em km entre dois pontos (fórmula de Haversine). */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Para cada item, retorna o raio em km limitado para não sobrepor à bolha mais próxima. */
function raiosSemSobreposicao(
  itens: MapaMunicipioItem[],
  raioPorValor: (valor: number) => number
): Map<string, number> {
  const out = new Map<string, number>();
  const n = itens.length;
  for (let i = 0; i < n; i++) {
    const item = itens[i]!;
    const key = item.chave || `${item.municipio}-${item.uf}-${i}`;
    const raioDesejado = raioPorValor(item.valorPendente);
    let distMinimaKm = Infinity;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const other = itens[j]!;
      const d = haversineKm(item.lat, item.lng, other.lat, other.lng);
      if (d < distMinimaKm) distMinimaKm = d;
    }
    // Raio máximo para não sobrepor: metade da distância ao vizinho mais próximo (deixando pequena folga).
    const raioMaxSemSobrepor = distMinimaKm === Infinity ? RAIO_MAX_KM : Math.max(RAIO_MIN_KM, distMinimaKm / 2 - 0.3);
    const raioFinal = Math.max(RAIO_MIN_KM, Math.min(raioDesejado, raioMaxSemSobrepor));
    out.set(key, raioFinal);
  }
  return out;
}

const CORES_BOLHA: Record<CorBolhaMapa, { fillColor: string; color: string }> = {
  vermelho: { fillColor: '#dc2626', color: '#b91c1c' },
  verde: { fillColor: '#16a34a', color: '#15803d' },
  amarelo: { fillColor: '#FFAD00', color: '#E69C00' },
  roxo: { fillColor: '#9333ea', color: '#7e22ce' },
  preto: { fillColor: '#1f2937', color: '#111827' },
};

function formatarValor(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

/** Evita que cliques/scroll dentro do popup fechem o painel ou sejam capturados pelo mapa. */
function stopMapEvent(e: React.MouseEvent | React.TouchEvent) {
  e.stopPropagation();
}

/** Conteúdo do popup: título + tabela ordenável (RM | ROTAS | DATA EMISSÃO | PD | MUNICIPIO | A VISTA | VENDA) + Total */
function PopupConteudo({ item }: { item: MapaMunicipioItem }) {
  const map = useMap();

  const fecharPopup = useCallback(() => {
    map.closePopup();
  }, [map]);

  useRegisterModalEscape({
    id: `mapa-popup:${item.chave ?? item.municipio}`,
    onClose: fecharPopup,
    zIndex: MODAL_Z_MAPA_POPUP,
    enabled: true,
  });

  const municipioLabel = `${item.municipio}${item.uf ? ` (${item.uf})` : ''}`;

  return (
    <div
      className="min-w-[480px] max-w-[90vw] w-max leaflet-popup-content-interact"
      style={{ maxWidth: 'min(720px, 90vw)' }}
      onClick={stopMapEvent}
      onMouseDown={stopMapEvent}
      onTouchStart={stopMapEvent}
      onWheel={(e) => e.stopPropagation()}
    >
      <HeatmapDetalhesPedidosTable
        titulo={municipioLabel}
        subtitulo={item.chave || undefined}
        detalhesBruto={item.detalhes ?? []}
        maxAlturaPx={320}
      />
    </div>
  );
}

function parseMultiFiltro(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function criarMatcherMunicipiosFiltro(termos: string[]): (municipio: string) => boolean {
  if (termos.length === 0) return () => false;
  if (termos.length === 1) return criarMatcherTextoLivre(termos[0]!);
  const matchers = termos.map((t) => criarMatcherTextoLivre(t));
  return (municipio) => matchers.some((m) => m(municipio));
}

/** Ajusta o zoom para caber todos os pontos (quando há dados). */
function AjustarBounds({ items }: { items: MapaMunicipioItem[] }) {
  const map = useMap();
  useEffect(() => {
    if (items.length === 0) return;
    const bounds = L.latLngBounds(items.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.15));
  }, [map, items]);
  return null;
}

/** Enquadra todas as rotas individuais quando o conjunto de carradas muda. */
function AjustarBoundsVariasRotas({
  polylines,
  token,
}: {
  polylines: [number, number][][];
  token: string;
}) {
  const map = useMap();
  const linhasRef = useRef(polylines);
  linhasRef.current = polylines;
  useEffect(() => {
    const linhas = linhasRef.current;
    const pts: [number, number][] = [[PONTO_RETORNO_TERESINA.lat, PONTO_RETORNO_TERESINA.lng]];
    for (const linha of linhas) {
      if (linha.length === 0) continue;
      const step = Math.max(1, Math.floor(linha.length / 30));
      for (let i = 0; i < linha.length; i += step) pts.push(linha[i]!);
      pts.push(linha[linha.length - 1]!);
    }
    if (pts.length < 2) return;
    const t = window.setTimeout(() => {
      const bounds = L.latLngBounds(pts);
      if (!bounds.isValid()) return;
      map.invalidateSize({ animate: false });
      map.fitBounds(bounds.pad(0.12), { animate: false, maxZoom: 9 });
    }, 120);
    return () => window.clearTimeout(t);
  }, [map, token]);
  return null;
}

function amostrarLinha(pts: [number, number][], max = 700): [number, number][] {
  if (pts.length <= max) return pts;
  const out: [number, number][] = [];
  const step = Math.ceil(pts.length / max);
  for (let i = 0; i < pts.length; i += step) out.push(pts[i]!);
  const last = pts[pts.length - 1]!;
  const tail = out[out.length - 1];
  if (!tail || tail[0] !== last[0] || tail[1] !== last[1]) out.push(last);
  return out;
}

/** Mesmo enquadramento usado no PDF: Teresina + paradas da rota. */
function AjustarBoundsRota({
  polyline,
  paradas,
  token,
}: {
  polyline?: [number, number][];
  paradas?: PontoMapaRoteiro[];
  token?: string;
}) {
  const map = useMap();
  useEffect(() => {
    if (!paradas?.length) return;
    const t = window.setTimeout(() => {
      aplicarZoomRoteiroNoMapa(map, polyline ?? [], paradas, {
        padding: [40, 40],
        maxZoom: 14,
        fatorEncolher: 0.78,
      });
    }, 100);
    return () => window.clearTimeout(t);
  }, [map, polyline, paradas, token]);
  return null;
}

export function mapaMunicipioChave(item: MapaMunicipioItem, i: number): string {
  return item.chave || `${item.municipio}-${item.uf}-${i}`;
}

interface MapaMunicipiosProps {
  filtros?: FiltrosPedidos;
  layoutToken?: string;
  /** Itens atuais do mapa (para o pai sincronizar seleção do roteirizador). */
  onItensCarregados?: (itens: MapaMunicipioItem[]) => void;
  roteirizadorChaves?: ReadonlySet<string>;
  /** Chave de Teresina/PI: sempre exibida como selecionada (base da rota). */
  roteirizadorChaveBaseFixa?: string;
  onRoteirizadorToggleChave?: (chave: string) => void;
  /** Linha [lat, lng] na ordem da rota (inclui retorno à base). */
  rotaPolyline?: [number, number][];
  /** Após roteirizar: número da parada (1-based) por chave do município no mapa. */
  paradaSequenciaPorChave?: ReadonlyMap<string, number>;
  /** Coordenadas das paradas (para enquadrar o mapa na rota). */
  paradasRoteiro?: PontoMapaRoteiro[];
  /** Conteúdo flutuante no canto superior esquerdo do mapa (ex.: botão Roteirizar). */
  mapaOverlaySuperiorEsquerdo?: ReactNode;
  /** Uma polyline por carrada. Cada cor é um percurso próprio, não uma rota compartilhada. */
  rotasCarradas?: {
    id: string;
    nome: string;
    cor: string;
    dashArray?: string;
    polyline: [number, number][];
    apagada?: boolean;
  }[];
  /** Trechos em que duas ou mais carradas seguem juntas. */
  trechosComuns?: { id: string; polyline: [number, number][]; carradas: string[] }[];
  /** Cruzamentos pontuais entre carradas. */
  cruzamentosRotas?: { id: string; lat: number; lng: number; rotulo: string }[];
}

function BotaoLegendaMapa({
  aberta,
  onClick,
  className = '',
}: {
  aberta: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white/95 p-1.5 text-slate-700 shadow-sm hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-200 dark:hover:bg-slate-700 ${className}`}
      title={aberta ? 'Recolher legenda' : 'Expandir legenda'}
      aria-label={aberta ? 'Recolher legenda' : 'Expandir legenda'}
      aria-expanded={aberta}
    >
      {aberta ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
    </button>
  );
}

function RecalcularMapa({ token }: { token?: string }) {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => {
      map.invalidateSize();
    }, 80);
    return () => window.clearTimeout(t);
  }, [map, token]);
  return null;
}

/** Ctrl no Windows; ⌘ (metaKey) no Mac. Control+clique no Mac também dispara o menu de contexto. */
function cliqueModificadorRota(ev: MouseEvent | undefined): boolean {
  return !!(ev && (ev.ctrlKey || ev.metaKey));
}

/** Bolha com detalhes ao clique normal; com Ctrl ou ⌘ + clique inclui/remove da rota (sem abrir popup). */
function BolhaMunicipioMapa({
  item,
  raioKm,
  cores,
  chave,
  roteirizadorChaves,
  roteirizadorChaveBaseFixa,
  onRoteirizadorToggleChave,
  sequenciaParada,
}: {
  item: MapaMunicipioItem;
  raioKm: number;
  cores: { fillColor: string; color: string };
  chave: string;
  roteirizadorChaves?: ReadonlySet<string>;
  /** Chave de Teresina/PI: sempre exibida como selecionada (base da rota). */
  roteirizadorChaveBaseFixa?: string;
  onRoteirizadorToggleChave?: (chave: string) => void;
  /** Número da parada na rota calculada (exibe selo no centro). */
  sequenciaParada?: number;
}) {
  const map = useMap();
  /** Clique e menu de contexto do mesmo gesto (Control+clique no Mac) não podem alternar duas vezes. */
  const ultimoToggleMsRef = useRef(0);
  const ehBase = !!(roteirizadorChaveBaseFixa && chave === roteirizadorChaveBaseFixa);
  const sel = ehBase || !!(roteirizadorChaves?.has(chave));
  const seq = sequenciaParada;
  const paradaNaRota = sel && !ehBase;

  const alternarRotaPorModificador = (leafletEv: L.LeafletMouseEvent) => {
    if (!onRoteirizadorToggleChave) return;
    const ev = leafletEv.originalEvent as MouseEvent | undefined;
    if (!cliqueModificadorRota(ev) || !ev) return;
    ev.preventDefault();
    L.DomEvent.stopPropagation(leafletEv);
    if (ehBase) return;
    const agora = performance.now();
    if (agora - ultimoToggleMsRef.current < 120) return;
    ultimoToggleMsRef.current = agora;
    onRoteirizadorToggleChave(chave);
    window.setTimeout(() => map.closePopup(), 0);
  };

  return (
    <Fragment>
    <Circle
      center={[item.lat, item.lng]}
      radius={raioKm * 1000}
      pathOptions={{
        fillColor: paradaNaRota ? cores.fillColor : sel ? '#f97316' : cores.fillColor,
        color: paradaNaRota ? '#ea580c' : sel ? '#c2410c' : cores.color,
        fillOpacity: paradaNaRota ? 0.38 : sel ? 0.72 : 0.55,
        weight: paradaNaRota ? 2.5 : sel ? 3 : 1.5,
        dashArray: paradaNaRota ? '6 4' : undefined,
      }}
      eventHandlers={{
        click: (e) => {
          alternarRotaPorModificador(e as L.LeafletMouseEvent);
        },
        contextmenu: (e) => {
          alternarRotaPorModificador(e as L.LeafletMouseEvent);
        },
        mouseover: (e) => {
          e.target.setStyle({
            fillOpacity: paradaNaRota ? 0.52 : 0.88,
            weight: paradaNaRota ? 3 : sel ? 3 : 2,
          });
          e.target.bringToFront();
        },
        mouseout: (e) => {
          e.target.setStyle({
            fillOpacity: paradaNaRota ? 0.38 : sel ? 0.72 : 0.55,
            weight: paradaNaRota ? 2.5 : sel ? 3 : 1.5,
            dashArray: paradaNaRota ? '6 4' : undefined,
          });
        },
      }}
    >
      <Tooltip permanent={false} direction="top" offset={[0, -8]}>
        {onRoteirizadorToggleChave
          ? ehBase
            ? 'Base da rota (Teresina). Ctrl+clique (⌘ no Mac) em outra bolha para simular.'
            : 'Ctrl+clique (⌘ no Mac): incluir ou remover da rota. Clique: detalhes.'
          : 'Clique para ver detalhes'}
      </Tooltip>
      <Popup className="leaflet-popup-detalhes" minWidth={380} maxWidth={640}>
        <PopupConteudo item={item} formatarValor={formatarValor} />
      </Popup>
    </Circle>
    {paradaNaRota && (
      <Marker
        key={`${chave}-parada-${seq ?? 'sel'}`}
        position={[item.lat, item.lng]}
        icon={seq != null && seq > 0 ? iconeParadaRota(seq) : iconeParadaSelecao()}
        interactive={false}
        zIndexOffset={800}
      />
    )}
    </Fragment>
  );
}

export default function MapaMunicipios({
  filtros: filtrosProp,
  layoutToken,
  onItensCarregados,
  roteirizadorChaves,
  roteirizadorChaveBaseFixa,
  onRoteirizadorToggleChave,
  rotaPolyline,
  paradaSequenciaPorChave,
  paradasRoteiro,
  mapaOverlaySuperiorEsquerdo,
  rotasCarradas,
  trechosComuns,
  cruzamentosRotas,
}: MapaMunicipiosProps) {
  const filtros = filtrosProp ?? FILTROS_VAZIOS;
  const [legendaAberta, setLegendaAberta] = useState(true);
  const tokenMapa = `${layoutToken ?? ''}|leg:${legendaAberta ? 1 : 0}`;
  const municipiosFiltroDestaque = useMemo(
    () => parseMultiFiltro(filtros.municipio_entrega),
    [filtros.municipio_entrega]
  );
  const matcherMunicipioDestaque = useMemo(
    () => criarMatcherMunicipiosFiltro(municipiosFiltroDestaque),
    [municipiosFiltroDestaque]
  );
  const filtrosMapa = useMemo(() => {
    const { municipio_entrega: _municipio, ...resto } = filtros;
    return resto;
  }, [filtros]);
  const filtrosMapaKey = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filtrosMapa).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && k !== 'page' && k !== 'limit') params.set(k, String(v));
    });
    return params.toString();
  }, [filtrosMapa]);
  const [resposta, setResposta] = useState<MapaMunicipiosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErro(null);
    obterMapaMunicipios(filtrosMapa)
      .then(setResposta)
      .catch(() => setErro('Não foi possível carregar o mapa.'))
      .finally(() => setLoading(false));
  }, [filtrosMapaKey]);

  const dados = resposta?.itens ?? DADOS_VAZIOS;

  useEffect(() => {
    onItensCarregados?.(dados);
  }, [dados, onItensCarregados]);
  const semCoordenadas = resposta?.semCoordenadas ?? [];

  const { raioPorItem } = useMemo(() => {
    if (dados.length === 0) return { raioPorItem: new Map<string, number>() };
    const max = Math.max(...dados.map((d) => d.valorPendente), 1);
    const raioPorValor = (valor: number) => {
      const frac = Math.sqrt(Math.max(0, valor) / max);
      return RAIO_MIN_KM + frac * (RAIO_MAX_KM - RAIO_MIN_KM);
    };
    const raioPorItem = raiosSemSobreposicao(dados, raioPorValor);
    return { raioPorItem };
  }, [dados]);

  const rotasSemIntersecao = useMemo(() => {
    const trechos = (trechosComuns ?? []).map((t) => t.polyline);
    return (rotasCarradas ?? []).map((rota) => ({
      ...rota,
      partes: recortarPolylineForaDaIntersecao(amostrarLinha(rota.polyline), trechos),
    }));
  }, [rotasCarradas, trechosComuns]);

  const estiloTrechos = useMemo(
    () => estilosTrechosIntersecao(trechosComuns ?? []),
    [trechosComuns]
  );

  if (loading) {
    return (
      <div className="h-full min-h-[320px] bg-slate-200/60 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/50 rounded-xl overflow-hidden flex items-center justify-center">
        <p className="text-slate-600 dark:text-slate-400">Carregando mapa...</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="h-full min-h-[320px] bg-slate-200/60 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/50 rounded-xl overflow-hidden flex items-center justify-center">
        <p className="text-red-600 dark:text-red-400">{erro}</p>
      </div>
    );
  }

  if (dados.length === 0 && semCoordenadas.length === 0) {
    return (
      <div className="h-full min-h-[320px] bg-slate-200/60 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/50 rounded-xl overflow-hidden flex flex-col">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 p-4 pb-0 shrink-0">
          Roteirizador
        </h3>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-slate-600 dark:text-slate-400 text-sm">Nenhum município com pedidos no momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col min-h-0 bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700/50 rounded-xl overflow-hidden">
      {legendaAberta ? (
        <div className="shrink-0">
          <div className="flex items-start justify-between gap-2 p-4 pb-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Roteirizador
            </h3>
            <BotaoLegendaMapa aberta onClick={() => setLegendaAberta(false)} />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 px-4 pb-1">
            Tamanho da bolha = valor pendente. <strong>Teresina/PI</strong> é a base (sempre ativa). <strong>Ctrl+clique</strong> (<strong>⌘+clique</strong> no Mac) em outra bolha para incluir a cidade; clique normal abre detalhes. Use <strong>Roteirizar</strong> para um percurso. <strong>Exibir todas as rotas</strong> desenha cada carrada sozinha (Teresina → cidades dela → Teresina); onde os percursos se encontram fica uma linha tracejada por grupo de carradas — o ritmo muda quando o grupo muda; passe o cursor para ver os nomes.
            {municipiosFiltroDestaque.length > 0 && (
              <>
                {' '}
                Com filtro de município, a cidade filtrada é marcada com <span aria-hidden>🚩</span> (demais cidades permanecem visíveis).
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-2 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-600 border border-green-800" aria-hidden />
              <span className="text-slate-600 dark:text-slate-400">Cidade com todos os pedidos na mesma rota</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-yellow-500 border border-yellow-700" aria-hidden />
              <span className="text-slate-600 dark:text-slate-400">Cidade com rota mas possui pedidos ainda não alocados em rota</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-600 border border-red-800" aria-hidden />
              <span className="text-slate-600 dark:text-slate-400">Cidade com pedido mas não possui rota</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-purple-600 border border-purple-800" aria-hidden />
              <span className="text-slate-600 dark:text-slate-400">Cidade com 2 ou mais rotas</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-gray-800 border border-gray-900" aria-hidden />
              <span className="text-slate-600 dark:text-slate-400">Cidade com 2 ou mais rotas e com pedidos sem rota</span>
            </span>
          </div>
          {semCoordenadas.length > 0 && (
            <details className="px-4 pb-2 text-xs">
              <summary className="cursor-pointer text-amber-700 dark:text-amber-400 font-medium">
                {semCoordenadas.length} município(s) com pedidos sem coordenadas (não aparecem no mapa)
              </summary>
              <ul className="mt-1 list-disc list-inside text-slate-600 dark:text-slate-400 max-h-24 overflow-y-auto">
                {semCoordenadas.map((s, i) => (
                  <li key={i}><span className="font-mono">{s.chave || `${s.municipio}${s.uf ? ` (${s.uf})` : ''}`}</span> — {formatarValor(s.valorPendente)}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ) : (
        <BotaoLegendaMapa
          aberta={false}
          onClick={() => setLegendaAberta(true)}
          className="absolute right-2 top-2 z-[1200]"
        />
      )}
      <div className={`flex-1 min-h-[280px] w-full relative z-0 overflow-hidden ${legendaAberta ? 'rounded-b-xl' : 'rounded-xl'}`}>
        <MapContainer
          center={CENTRO_BRASIL}
          zoom={ZOOM}
          className="h-full w-full rounded-b-xl relative z-0"
          scrollWheelZoom={true}
          style={{ background: 'hsl(210 40% 96%)', height: '100%', minHeight: 280 }}
        >
          <TileLayer attribution={MAPA_TILE_ATTRIBUTION} url={MAPA_TILE_URL} />
          <RecalcularMapa token={tokenMapa} />
          {rotasCarradas && rotasCarradas.length > 0 ? (
            <AjustarBoundsVariasRotas
              polylines={rotasCarradas.map((r) => r.polyline)}
              token={rotasCarradas.map((r) => r.id).join('|')}
            />
          ) : rotaPolyline && paradasRoteiro && paradasRoteiro.length > 0 ? (
            <AjustarBoundsRota
              polyline={rotaPolyline}
              paradas={paradasRoteiro}
              token={layoutToken}
            />
          ) : (
            <AjustarBounds items={dados} />
          )}
          {dados.map((item, i) => {
            const key = mapaMunicipioChave(item, i);
            const raioKm = raioPorItem.get(key) ?? RAIO_MIN_KM;
            const cores = CORES_BOLHA[item.cor ?? 'verde'];
            const destaqueFiltro = matcherMunicipioDestaque(item.municipio);
            return (
              <Fragment key={key}>
                <BolhaMunicipioMapa
                  item={item}
                  raioKm={raioKm}
                  cores={cores}
                  chave={key}
                  roteirizadorChaves={roteirizadorChaves}
                  roteirizadorChaveBaseFixa={roteirizadorChaveBaseFixa}
                  onRoteirizadorToggleChave={onRoteirizadorToggleChave}
                  sequenciaParada={paradaSequenciaPorChave?.get(key)}
                />
                {destaqueFiltro && (
                  <Marker
                    position={[item.lat, item.lng]}
                    icon={iconeBandeiraFiltro()}
                    interactive={false}
                    zIndexOffset={900}
                  />
                )}
              </Fragment>
            );
          })}
          <Pane name="heatmap-rota-viaria" style={{ zIndex: 360 }}>
            {!(rotasCarradas && rotasCarradas.length > 0) && rotaPolyline && rotaPolyline.length >= 2 && (
              <Polyline
                key={`rota-${rotaPolyline.length}-${rotaPolyline[0]![0].toFixed(4)}`}
                positions={rotaPolyline}
                pathOptions={{
                  color: '#1d4ed8',
                  weight: 4,
                  opacity: 0.92,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            )}
            {rotasSemIntersecao.map((rota) =>
              rota.partes.map((parte, indice) => (
                <Polyline
                  key={`${rota.id}-${indice}-${parte.length}`}
                  positions={parte}
                  pathOptions={{
                    color: rota.cor,
                    weight: rota.apagada ? 2 : 4,
                    opacity: rota.apagada ? 0.22 : 0.9,
                    dashArray: rota.dashArray,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                >
                  <Tooltip sticky>{rota.nome}</Tooltip>
                </Polyline>
              ))
            )}
          </Pane>
          <Pane name="heatmap-rotas-intersecao" style={{ zIndex: 430 }}>
            {trechosComuns?.map((trecho) => {
              const linha = amostrarLinha(trecho.polyline, 400);
              const traco = {
                dashArray: estiloTrechos.dashPorId[trecho.id] ?? '18 8',
                lineCap: 'round' as const,
                lineJoin: 'round' as const,
              };
              return (
                <Fragment key={trecho.id}>
                  <Polyline
                    positions={linha}
                    pathOptions={{ color: '#ffffff', weight: 6, opacity: 0.9, ...traco }}
                    interactive={false}
                  />
                  <Polyline
                    positions={linha}
                    pathOptions={{ color: '#1e293b', weight: 3, opacity: 0.95, ...traco }}
                  >
                    <Tooltip sticky direction="top" opacity={1}>
                      <div className="flex flex-col items-start gap-0.5 py-0.5 text-left">
                        {trecho.carradas.map((nome) => (
                          <span key={nome} className="block whitespace-nowrap text-xs font-medium leading-snug text-slate-800">
                            {nome}
                          </span>
                        ))}
                      </div>
                    </Tooltip>
                  </Polyline>
                </Fragment>
              );
            })}
            {estiloTrechos.emendas.map((emenda) => (
              <CircleMarker
                key={emenda.id}
                center={[emenda.lat, emenda.lng]}
                radius={5}
                interactive={false}
                pathOptions={{ color: '#0f172a', weight: 2, fillColor: '#ffffff', fillOpacity: 1 }}
              />
            ))}
            {cruzamentosRotas?.map((cruz) => (
              <CircleMarker
                key={cruz.id}
                center={[cruz.lat, cruz.lng]}
                radius={7}
                pathOptions={{ color: '#9a3412', weight: 2, fillColor: '#fbbf24', fillOpacity: 0.95 }}
              >
                <Tooltip>{cruz.rotulo}</Tooltip>
              </CircleMarker>
            ))}
          </Pane>
          {(roteirizadorChaveBaseFixa ||
            (roteirizadorChaves && roteirizadorChaves.size > 0) ||
            (rotasCarradas && rotasCarradas.length > 0)) && (
            <CircleMarker
              center={[PONTO_RETORNO_TERESINA.lat, PONTO_RETORNO_TERESINA.lng]}
              radius={9}
              pathOptions={{
                color: '#0f172a',
                weight: 2,
                fillColor: '#38bdf8',
                fillOpacity: 0.95,
              }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                Base / retorno: Teresina, PI
              </Tooltip>
            </CircleMarker>
          )}
        </MapContainer>
        {mapaOverlaySuperiorEsquerdo}
      </div>
    </div>
  );
}
