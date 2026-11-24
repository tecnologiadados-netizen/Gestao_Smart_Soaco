import type { MapaMunicipioItem } from '../api/pedidos';
import { isCarradaRota } from './rotaCarrada';
import { rotasDoMunicipio } from './heatmapRoteiroFiltrosMapa';
import { isTeresinaMapaItem } from './heatmapTeresinaBase';
import {
  coordsOrdemVisita,
  enriquecerRotaComGeometriaOsrm,
  haversineKm,
  PONTO_RETORNO_TERESINA,
  resolverRoteiroDeposito,
  type RoteiroCoord,
  type RoteiroResultado,
} from './heatmapRoteirizador';

/** Mesmo fator da matriz local do roteirizador (Haversine → estimativa de estrada). */
const FATOR_ESTRADA = 1.22;

const PALETA_ROTAS = [
  '#1d4ed8',
  '#dc2626',
  '#15803d',
  '#7c3aed',
  '#ea580c',
  '#0891b2',
  '#db2777',
  '#a16207',
  '#4f46e5',
  '#0f766e',
  '#be123c',
  '#0369a1',
  '#65a30d',
  '#c026d3',
  '#b45309',
  '#4338ca',
  '#e11d48',
  '#047857',
];

/** Amostras da malha: trechos mais curtos que isso não entram como "rota junta". */
const PASSO_SIMPLIFICACAO_KM = 2;
const RAIO_TRECHO_KM = 0.9;
const MIN_KM_TRECHO = 4;
const JUNCAO_TRECHOS_KM = 8;
const RAIO_CRUZAMENTO_NO_TRECHO_KM = 3;
const AGRUPA_CRUZAMENTO_KM = 8;
const RAIO_ENCONTRO_KM = 0.45;
/** Ponta compartilhada só na base (todas saem de Teresina) não é interseção de percurso. */
const RAIO_IGNORAR_BASE_KM = 18;
const CELL_GRAUS = 0.03;

export type CidadeCarrada = {
  chave: string;
  lat: number;
  lng: number;
  label: string;
};

export type GrupoCidadesCarrada = {
  nome: string;
  cidades: CidadeCarrada[];
};

export type RotaCarradaMapa = {
  id: string;
  nome: string;
  cor: string;
  dashArray?: string;
  polyline: [number, number][];
  totalKm: number;
  cidades: number;
  geometria: 'reta' | 'estrada';
  coords: RoteiroCoord[];
  resultadoBase: RoteiroResultado;
};

export type TrechoComum = {
  id: string;
  polyline: [number, number][];
  /** Nomes das carradas que seguem juntas neste trecho. */
  carradas: string[];
  km: number;
  lat: number;
  lng: number;
  pertoDe: string | null;
};

export type CruzamentoRota = {
  id: string;
  lat: number;
  lng: number;
  carradas: string[];
  pertoDe: string | null;
};

export type AnaliseIntersecaoRotas = {
  trechos: TrechoComum[];
  cruzamentos: CruzamentoRota[];
  /** Verdadeiro quando a malha viária não respondeu e o cruzamento saiu da linha reta. */
  analiseAproximada: boolean;
  /** Rotas em linha reta deixadas de fora quando as demais já têm malha. */
  rotasForaDaAnalise: number;
};

export type ReferenciaIntersecao = { lat: number; lng: number; label: string };

function estiloRotaCarrada(indice: number): { cor: string; dashArray?: string } {
  const cor = PALETA_ROTAS[indice % PALETA_ROTAS.length]!;
  const ciclo = Math.floor(indice / PALETA_ROTAS.length);
  const dashArray = ciclo === 0 ? undefined : ciclo === 1 ? '14 8' : '3 7';
  return { cor, dashArray };
}

function matrizLocalKm(coords: RoteiroCoord[]): number[][] {
  const n = coords.length;
  const m: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d =
        haversineKm(coords[i]!.lat, coords[i]!.lng, coords[j]!.lat, coords[j]!.lng) * FATOR_ESTRADA;
      m[i]![j] = d;
      m[j]![i] = d;
    }
  }
  return m;
}

/** Uma carrada = um ciclo próprio Teresina → cidades dela → Teresina. */
export function agruparCidadesPorCarrada(
  itens: { item: MapaMunicipioItem; chave: string }[]
): GrupoCidadesCarrada[] {
  const porNome = new Map<string, Map<string, CidadeCarrada>>();
  for (const { item, chave } of itens) {
    if (isTeresinaMapaItem(item)) continue;
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) continue;
    for (const rota of rotasDoMunicipio(item)) {
      if (!isCarradaRota(rota)) continue;
      let cidades = porNome.get(rota);
      if (!cidades) {
        cidades = new Map();
        porNome.set(rota, cidades);
      }
      if (cidades.has(chave)) continue;
      const label = item.uf ? `${item.municipio}, ${item.uf}` : item.municipio;
      cidades.set(chave, { chave, lat: item.lat, lng: item.lng, label });
    }
  }
  return [...porNome.entries()]
    .map(([nome, cidades]) => ({
      nome,
      cidades: [...cidades.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    }))
    .filter((g) => g.cidades.length > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
}

export function assinaturaGruposCarrada(grupos: GrupoCidadesCarrada[]): string {
  return grupos
    .map(
      (g) =>
        `${g.nome}|${g.cidades
          .map((c) => `${c.lat.toFixed(4)},${c.lng.toFixed(4)}`)
          .sort()
          .join(';')}`
    )
    .join('\n');
}

/** Ordem e traçado reto, sem rede. A malha viária entra depois, rota a rota. */
export function montarRotaLocal(
  nome: string,
  cidades: CidadeCarrada[],
  indiceCor: number
): RotaCarradaMapa | null {
  if (cidades.length === 0) return null;
  const coords: RoteiroCoord[] = [
    {
      lat: PONTO_RETORNO_TERESINA.lat,
      lng: PONTO_RETORNO_TERESINA.lng,
      label: PONTO_RETORNO_TERESINA.label,
    },
    ...cidades.map((c) => ({ lat: c.lat, lng: c.lng, label: c.label })),
  ];
  const resultado = resolverRoteiroDeposito(coords, matrizLocalKm(coords), false, null);
  if (!resultado) return null;
  const ordem = coordsOrdemVisita(coords, resultado);
  const { cor, dashArray } = estiloRotaCarrada(indiceCor);
  return {
    id: nome,
    nome,
    cor,
    dashArray,
    polyline: ordem.map((c) => [c.lat, c.lng] as [number, number]),
    totalKm: resultado.totalKm,
    cidades: cidades.length,
    geometria: 'reta',
    coords,
    resultadoBase: resultado,
  };
}

export async function calcularRotasIndividuaisCarradas(
  grupos: GrupoCidadesCarrada[],
  hooks: {
    signal: AbortSignal;
    onRotas: (rotas: RotaCarradaMapa[]) => void;
    onProgresso: (feitos: number, total: number) => void;
  }
): Promise<RotaCarradaMapa[] | null> {
  const rotas: RotaCarradaMapa[] = [];
  grupos.forEach((g, i) => {
    const rota = montarRotaLocal(g.nome, g.cidades, i);
    if (rota) rotas.push(rota);
  });
  hooks.onRotas(rotas.slice());
  hooks.onProgresso(0, rotas.length);

  for (let i = 0; i < rotas.length; i++) {
    if (hooks.signal.aborted) return null;
    const atual = rotas[i]!;
    try {
      const geo = await enriquecerRotaComGeometriaOsrm(atual.coords, atual.resultadoBase, hooks.signal);
      if (hooks.signal.aborted) return null;
      if (geo.mapaPolyline && geo.mapaPolyline.length >= 2) {
        rotas[i] = {
          ...atual,
          polyline: geo.mapaPolyline,
          totalKm: geo.totalKm > 0 ? geo.totalKm : atual.totalKm,
          geometria: 'estrada',
          resultadoBase: geo,
        };
      }
    } catch {
      if (hooks.signal.aborted) return null;
    }
    hooks.onProgresso(i + 1, rotas.length);
    hooks.onRotas(rotas.slice());
    if (i + 1 < rotas.length) {
      await new Promise((resolve) => setTimeout(resolve, 60));
      if (hooks.signal.aborted) return null;
    }
  }
  return rotas;
}

function simplificarPolyline(pts: [number, number][], passoKm: number): [number, number][] {
  if (pts.length <= 2) return pts.slice();
  const out: [number, number][] = [pts[0]!];
  let ultimo = pts[0]!;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!;
    if (haversineKm(ultimo[0], ultimo[1], p[0], p[1]) >= passoKm) {
      out.push(p);
      ultimo = p;
    }
  }
  const fim = pts[pts.length - 1]!;
  const cauda = out[out.length - 1]!;
  if (cauda[0] !== fim[0] || cauda[1] !== fim[1]) out.push(fim);
  return out;
}

function comprimentoKm(pts: [number, number][]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    s += haversineKm(pts[i - 1]![0], pts[i - 1]![1], pts[i]![0], pts[i]![1]);
  }
  return s;
}

function distPontoSegmentoKm(p: [number, number], a: [number, number], b: [number, number]): number {
  const lat0 = ((a[0] + b[0] + p[0]) / 3) * (Math.PI / 180);
  const kx = 111.32 * Math.cos(lat0);
  const ky = 111.32;
  const ax = a[1] * kx;
  const ay = a[0] * ky;
  const bx = b[1] * kx;
  const by = b[0] * ky;
  const px = p[1] * kx;
  const py = p[0] * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 1e-9) t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Cruzamento no miolo dos dois segmentos (ponta compartilhada, como a base, não conta). */
function cruzamentoProprio(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number]
): [number, number] | null {
  const rx = b[0] - a[0];
  const ry = b[1] - a[1];
  const sx = d[0] - c[0];
  const sy = d[1] - c[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  const qpx = c[0] - a[0];
  const qpy = c[1] - a[1];
  const t = (qpx * sy - qpy * sx) / den;
  const u = (qpx * ry - qpy * rx) / den;
  const eps = 1e-6;
  if (t < -eps || t > 1 + eps || u < -eps || u > 1 + eps) return null;
  const tPonta = t <= eps || t >= 1 - eps;
  const uPonta = u <= eps || u >= 1 - eps;
  if (tPonta && uPonta) return null;
  return [a[0] + t * rx, a[1] + t * ry];
}

type Seg = { rotaIdx: number; a: [number, number]; b: [number, number] };

function celulasDoSegmento(a: [number, number], b: [number, number]): string[] {
  const i0 = Math.floor(Math.min(a[0], b[0]) / CELL_GRAUS);
  const i1 = Math.floor(Math.max(a[0], b[0]) / CELL_GRAUS);
  const j0 = Math.floor(Math.min(a[1], b[1]) / CELL_GRAUS);
  const j1 = Math.floor(Math.max(a[1], b[1]) / CELL_GRAUS);
  const keys: string[] = [];
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) keys.push(`${i}:${j}`);
  }
  return keys;
}

function celulasVizinhas(p: [number, number]): string[] {
  const i = Math.floor(p[0] / CELL_GRAUS);
  const j = Math.floor(p[1] / CELL_GRAUS);
  const keys: string[] = [];
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) keys.push(`${i + di}:${j + dj}`);
  }
  return keys;
}

function indexarSegmentos(linhas: [number, number][][]): Map<string, Seg[]> {
  const grid = new Map<string, Seg[]>();
  linhas.forEach((linha, rotaIdx) => {
    for (let k = 1; k < linha.length; k++) {
      const a = linha[k - 1]!;
      const b = linha[k]!;
      const seg: Seg = { rotaIdx, a, b };
      for (const key of celulasDoSegmento(a, b)) {
        const lista = grid.get(key);
        if (lista) lista.push(seg);
        else grid.set(key, [seg]);
      }
    }
  });
  return grid;
}

function outrosNoPonto(rotaIdx: number, p: [number, number], grid: Map<string, Seg[]>): number[] {
  const set = new Set<number>();
  for (const key of celulasVizinhas(p)) {
    const segs = grid.get(key);
    if (!segs) continue;
    for (const seg of segs) {
      if (seg.rotaIdx === rotaIdx || set.has(seg.rotaIdx)) continue;
      if (distPontoSegmentoKm(p, seg.a, seg.b) <= RAIO_TRECHO_KM) set.add(seg.rotaIdx);
    }
  }
  return [...set].sort((a, b) => a - b);
}

function polylinesPerto(a: [number, number][], b: [number, number][]): boolean {
  const src = a.length <= b.length ? a : b;
  const dst = src === a ? b : a;
  const step = Math.max(1, Math.floor(src.length / 12));
  for (let i = 0; i < src.length; i += step) {
    const p = src[i]!;
    for (let j = 1; j < dst.length; j++) {
      if (distPontoSegmentoKm(p, dst[j - 1]!, dst[j]!) <= JUNCAO_TRECHOS_KM) return true;
    }
  }
  return false;
}

function pertoDePonto(lat: number, lng: number, referencias: ReferenciaIntersecao[]): string | null {
  let melhor: { label: string; d: number } | null = null;
  for (const r of referencias) {
    const d = haversineKm(lat, lng, r.lat, r.lng);
    if (d > 60) continue;
    if (!melhor || d < melhor.d) melhor = { label: r.label, d };
  }
  return melhor?.label ?? null;
}

function pontoCobertoPorTrecho(lat: number, lng: number, linha: [number, number][]): boolean {
  const p: [number, number] = [lat, lng];
  for (let i = 1; i < linha.length; i++) {
    if (distPontoSegmentoKm(p, linha[i - 1]!, linha[i]!) <= RAIO_CRUZAMENTO_NO_TRECHO_KM) return true;
  }
  return false;
}

/**
 * Onde rotas de carradas diferentes seguem juntas ou se cruzam.
 * A saída comum só em Teresina (ponta compartilhada, sem trecho) não entra.
 */
export function analisarIntersecaoRotas(
  rotas: RotaCarradaMapa[],
  referencias: ReferenciaIntersecao[] = []
): AnaliseIntersecaoRotas {
  const vazio: AnaliseIntersecaoRotas = {
    trechos: [],
    cruzamentos: [],
    analiseAproximada: false,
    rotasForaDaAnalise: 0,
  };
  if (rotas.length < 2) return vazio;

  const todasRetas = rotas.every((r) => r.geometria === 'reta');
  const base = todasRetas ? rotas : rotas.filter((r) => r.geometria === 'estrada');
  if (base.length < 2) {
    return { ...vazio, rotasForaDaAnalise: rotas.length - base.length };
  }

  const linhas = base.map((r) => simplificarPolyline(r.polyline, PASSO_SIMPLIFICACAO_KM));
  const grid = indexarSegmentos(linhas);
  const nomes = base.map((r) => r.nome);

  type Rascunho = { carradas: string[]; polyline: [number, number][]; km: number };
  const rascunhos: Rascunho[] = [];

  linhas.forEach((pontos, rotaIdx) => {
    let atual: { pontos: [number, number][]; chave: string; outros: number[] } | null = null;
    const fecha = () => {
      if (!atual || atual.pontos.length < 2) {
        atual = null;
        return;
      }
      const km = comprimentoKm(atual.pontos);
      if (km >= MIN_KM_TRECHO) {
        const idxs = [rotaIdx, ...atual.outros].sort((a, b) => a - b);
        rascunhos.push({
          carradas: idxs.map((i) => nomes[i]!),
          polyline: atual.pontos,
          km,
        });
      }
      atual = null;
    };
    for (const p of pontos) {
      const outros = outrosNoPonto(rotaIdx, p, grid);
      if (outros.length === 0) {
        fecha();
        continue;
      }
      const chave = outros.join(',');
      if (atual && atual.chave === chave) atual.pontos.push(p);
      else {
        fecha();
        atual = { pontos: [p], chave, outros };
      }
    }
    fecha();
  });

  const fundidos: Rascunho[] = [];
  for (const item of rascunhos) {
    const chave = item.carradas.join('\u0001');
    const existente = fundidos.find(
      (f) => f.carradas.join('\u0001') === chave && polylinesPerto(f.polyline, item.polyline)
    );
    if (!existente) {
      fundidos.push(item);
      continue;
    }
    if (item.km > existente.km) {
      existente.polyline = item.polyline;
      existente.km = item.km;
    }
  }

  const trechos: TrechoComum[] = fundidos.map((f, i) => {
    const meio = f.polyline[Math.floor(f.polyline.length / 2)]!;
    return {
      id: `trecho-${i}`,
      polyline: f.polyline,
      carradas: f.carradas,
      km: f.km,
      lat: meio[0],
      lng: meio[1],
      pertoDe: pertoDePonto(meio[0], meio[1], referencias),
    };
  });
  trechos.sort((a, b) => b.km - a.km || a.carradas[0]!.localeCompare(b.carradas[0]!, 'pt-BR'));

  type Cruze = { i: number; j: number; lat: number; lng: number };
  const cruzes: Cruze[] = [];
  const vistos = new Set<string>();

  const pontosGrid = new Map<string, { rotaIdx: number; p: [number, number] }[]>();
  linhas.forEach((linha, rotaIdx) => {
    for (const p of linha) {
      if (haversineKm(p[0], p[1], PONTO_RETORNO_TERESINA.lat, PONTO_RETORNO_TERESINA.lng) <= RAIO_IGNORAR_BASE_KM) {
        continue;
      }
      const key = `${Math.floor(p[0] / CELL_GRAUS)}:${Math.floor(p[1] / CELL_GRAUS)}`;
      const lista = pontosGrid.get(key);
      const item = { rotaIdx, p };
      if (lista) lista.push(item);
      else pontosGrid.set(key, [item]);
    }
  });
  linhas.forEach((linha, rotaIdx) => {
    for (const p of linha) {
      if (haversineKm(p[0], p[1], PONTO_RETORNO_TERESINA.lat, PONTO_RETORNO_TERESINA.lng) <= RAIO_IGNORAR_BASE_KM) {
        continue;
      }
      const i = Math.floor(p[0] / CELL_GRAUS);
      const j = Math.floor(p[1] / CELL_GRAUS);
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          const lista = pontosGrid.get(`${i + di}:${j + dj}`);
          if (!lista) continue;
          for (const outro of lista) {
            if (outro.rotaIdx <= rotaIdx) continue;
            if (haversineKm(p[0], p[1], outro.p[0], outro.p[1]) > RAIO_ENCONTRO_KM) continue;
            cruzes.push({
              i: rotaIdx,
              j: outro.rotaIdx,
              lat: (p[0] + outro.p[0]) / 2,
              lng: (p[1] + outro.p[1]) / 2,
            });
          }
        }
      }
    }
  });

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]!;
    for (let k = 1; k < linha.length; k++) {
      const a = linha[k - 1]!;
      const b = linha[k]!;
      const candidatos = new Set<Seg>();
      for (const key of celulasDoSegmento(a, b)) {
        const segs = grid.get(key);
        if (!segs) continue;
        for (const seg of segs) {
          if (seg.rotaIdx > i) candidatos.add(seg);
        }
      }
      for (const seg of candidatos) {
        const hit = cruzamentoProprio(a, b, seg.a, seg.b);
        if (!hit) continue;
        const marca = `${i}:${seg.rotaIdx}:${hit[0].toFixed(3)}:${hit[1].toFixed(3)}`;
        if (vistos.has(marca)) continue;
        vistos.add(marca);
        cruzes.push({ i, j: seg.rotaIdx, lat: hit[0], lng: hit[1] });
      }
    }
  }

  const porPar = new Map<string, { i: number; j: number; pts: { lat: number; lng: number }[] }>();
  for (const c of cruzes) {
    const par = `${c.i}:${c.j}`;
    const grupo = porPar.get(par);
    if (grupo) grupo.pts.push({ lat: c.lat, lng: c.lng });
    else porPar.set(par, { i: c.i, j: c.j, pts: [{ lat: c.lat, lng: c.lng }] });
  }

  const cruzamentos: CruzamentoRota[] = [];
  for (const grupo of porPar.values()) {
    const clusters: { lat: number; lng: number; n: number }[] = [];
    for (const p of grupo.pts) {
      const cluster = clusters.find((x) => haversineKm(x.lat, x.lng, p.lat, p.lng) <= AGRUPA_CRUZAMENTO_KM);
      if (cluster) {
        cluster.lat = (cluster.lat * cluster.n + p.lat) / (cluster.n + 1);
        cluster.lng = (cluster.lng * cluster.n + p.lng) / (cluster.n + 1);
        cluster.n += 1;
      } else {
        clusters.push({ lat: p.lat, lng: p.lng, n: 1 });
      }
    }
    const carradas = [nomes[grupo.i]!, nomes[grupo.j]!].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    for (const cluster of clusters) {
      const jaNoTrecho = trechos.some(
        (t) =>
          t.carradas.includes(carradas[0]!) &&
          t.carradas.includes(carradas[1]!) &&
          pontoCobertoPorTrecho(cluster.lat, cluster.lng, t.polyline)
      );
      if (jaNoTrecho) continue;
      cruzamentos.push({
        id: `cruz-${cruzamentos.length}`,
        lat: cluster.lat,
        lng: cluster.lng,
        carradas,
        pertoDe: pertoDePonto(cluster.lat, cluster.lng, referencias),
      });
    }
  }

  return {
    trechos,
    cruzamentos,
    analiseAproximada: todasRetas,
    rotasForaDaAnalise: rotas.length - base.length,
  };
}

const RAIO_RECORTE_INTERSECAO_KM = 1.6;

/**
 * Tira da rota o miolo que já está coberto por um trecho compartilhado.
 * Sobra só o percurso exclusivo; a interseção fica numa linha só.
 */
export function recortarPolylineForaDaIntersecao(
  polyline: [number, number][],
  trechos: [number, number][][],
  raioKm = RAIO_RECORTE_INTERSECAO_KM
): [number, number][][] {
  const linhas = trechos.filter((t) => t.length >= 2);
  if (polyline.length < 2 || linhas.length === 0) {
    return polyline.length >= 2 ? [polyline] : [];
  }

  const grid = indexarSegmentos(linhas);
  const perto = (p: [number, number]) => {
    for (const key of celulasVizinhas(p)) {
      const segs = grid.get(key);
      if (!segs) continue;
      for (const seg of segs) {
        if (distPontoSegmentoKm(p, seg.a, seg.b) <= raioKm) return true;
      }
    }
    return false;
  };

  const partes: [number, number][][] = [];
  let atual: [number, number][] = [];
  let ultimoCompartilhado: [number, number] | null = null;

  const fecha = () => {
    if (atual.length >= 2) partes.push(atual);
    atual = [];
  };

  for (const p of polyline) {
    if (perto(p)) {
      if (atual.length > 0) {
        atual.push(p);
        fecha();
      }
      ultimoCompartilhado = p;
      continue;
    }
    if (atual.length === 0 && ultimoCompartilhado) atual.push(ultimoCompartilhado);
    atual.push(p);
  }
  fecha();
  return partes;
}

/** Ritmos distintos para trechos vizinhos não parecerem a mesma linha. */
const PADROES_TRACEJADO_INTERSECAO = ['18 8', '8 7', '3 8', '14 4 3 5', '22 5', '6 3 2 4'] as const;
const RAIO_EMENDA_KM = 3;

export type EmendaTrechoIntersecao = { id: string; lat: number; lng: number };

export type EstiloTrechosIntersecao = {
  dashPorId: Record<string, string>;
  emendas: EmendaTrechoIntersecao[];
};

function chaveGrupoCarradas(carradas: string[]): string {
  return [...carradas].sort((a, b) => a.localeCompare(b, 'pt-BR')).join('\u0001');
}

function pontaMaisProxima(
  a: [number, number][],
  b: [number, number][]
): { dist: number; lat: number; lng: number } | null {
  if (a.length === 0 || b.length === 0) return null;
  const pontasA = [a[0]!, a[a.length - 1]!];
  const pontasB = [b[0]!, b[b.length - 1]!];
  let melhor: { dist: number; lat: number; lng: number } | null = null;
  for (const pa of pontasA) {
    for (const pb of pontasB) {
      const dist = haversineKm(pa[0], pa[1], pb[0], pb[1]);
      if (!melhor || dist < melhor.dist) {
        melhor = { dist, lat: (pa[0] + pb[0]) / 2, lng: (pa[1] + pb[1]) / 2 };
      }
    }
  }
  return melhor;
}

/**
 * O mesmo grupo de carradas usa sempre o mesmo ritmo.
 * Grupos que se encostam recebem ritmos diferentes, com um ponto na emenda.
 */
export function estilosTrechosIntersecao(
  trechos: { id: string; polyline: [number, number][]; carradas: string[] }[]
): EstiloTrechosIntersecao {
  const chavePorId = new Map<string, string>();
  for (const t of trechos) chavePorId.set(t.id, chaveGrupoCarradas(t.carradas));

  const vizinhos = new Map<string, Set<string>>();
  const emendas: EmendaTrechoIntersecao[] = [];
  const emendasVistas: { lat: number; lng: number }[] = [];

  const liga = (de: string, para: string) => {
    let set = vizinhos.get(de);
    if (!set) {
      set = new Set();
      vizinhos.set(de, set);
    }
    set.add(para);
  };

  for (let i = 0; i < trechos.length; i++) {
    for (let j = i + 1; j < trechos.length; j++) {
      const a = trechos[i]!;
      const b = trechos[j]!;
      const chaveA = chavePorId.get(a.id)!;
      const chaveB = chavePorId.get(b.id)!;
      if (chaveA === chaveB) continue;
      const perto = pontaMaisProxima(a.polyline, b.polyline);
      if (!perto || perto.dist > RAIO_EMENDA_KM) continue;
      liga(chaveA, chaveB);
      liga(chaveB, chaveA);
      const duplicada = emendasVistas.some((e) => haversineKm(e.lat, e.lng, perto.lat, perto.lng) < 1);
      if (duplicada) continue;
      emendasVistas.push({ lat: perto.lat, lng: perto.lng });
      emendas.push({ id: `emenda-${emendas.length}`, lat: perto.lat, lng: perto.lng });
    }
  }

  const chaves = [...new Set(chavePorId.values())].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const ritmoPorChave = new Map<string, number>();
  for (const chave of chaves) {
    const usadas = new Set<number>();
    for (const viz of vizinhos.get(chave) ?? []) {
      const ritmo = ritmoPorChave.get(viz);
      if (ritmo != null) usadas.add(ritmo);
    }
    let ritmo = 0;
    while (usadas.has(ritmo) && ritmo < PADROES_TRACEJADO_INTERSECAO.length) ritmo++;
    ritmoPorChave.set(chave, ritmo % PADROES_TRACEJADO_INTERSECAO.length);
  }

  const dashPorId: Record<string, string> = {};
  for (const t of trechos) {
    const ritmo = ritmoPorChave.get(chavePorId.get(t.id)!) ?? 0;
    dashPorId[t.id] = PADROES_TRACEJADO_INTERSECAO[ritmo]!;
  }
  return { dashPorId, emendas };
}

export function textoCarradas(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? '';
  if (nomes.length === 2) return `${nomes[0]} × ${nomes[1]}`;
  return nomes.join(', ');
}
