import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { rhFetchJson } from "@rh/lib/rh-fetch";
import type { Feature, FeatureCollection, GeoJsonObject, MultiPolygon, Polygon } from "geojson";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import estadosGeo from "@rh/lib/geo/brazil-states.json";

export type PessoaLocalidade = {
  uf: string;
  cidade: string;
  cidadeChave: string;
  bairro: string;
  bairroChave: string;
  endereco: string;
  logradouro: string;
  cep: string;
  matricula: string;
  nome: string;
};

export type SelecaoLocalidade = {
  uf: string;
  cidade: string | null;
  bairroChave: string | null;
  matricula: string | null;
  rotulo: string;
};

type PropsCidade = { nome: string; codigo: string; chave: string; uf: string };
type Ponto = { lat: number; lng: number };
type GrupoBairro = {
  id: string;
  uf: string;
  cidade: string;
  cidadeChave: string;
  bairro: string;
  bairroChave: string;
  quantidade: number;
};

/** Prédio da Só Aço no Polo Empresarial Sul (OpenStreetMap, Estr. Pedra Miúda / Via Coletora III). */
const SEDE_SOACO = {
  lat: -5.20334,
  lng: -42.7443366,
  uf: "PI",
  cidadeChave: chaveCidade("Teresina"),
  bairroChave: chaveCidade("Pedra Miuda"),
};

const iconeSedeSoaco = L.divIcon({
  className: "rh-sede-soaco",
  html: `<div style="display:flex;align-items:flex-start;gap:4px;width:108px">
    <svg width="22" height="30" viewBox="0 0 22 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="flex:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))">
      <path d="M11 28 C11 28 2 17 2 10 A9 9 0 1 1 20 10 C20 17 11 28 11 28 Z" fill="#041E42" stroke="#FFAD00" stroke-width="1.6"/>
      <circle cx="11" cy="10" r="3.2" fill="#FFAD00"/>
    </svg>
    <span style="margin-top:2px;background:#041E42;color:#fff;border:1px solid #FFAD00;font:700 11px/1.2 system-ui,sans-serif;padding:3px 6px;white-space:nowrap">Só Aço</span>
  </div>`,
  iconSize: [108, 30],
  iconAnchor: [11, 28],
});

function sedeCabeNoFiltro(filtro: { uf: string; cidadeChave: string; bairroChave: string | null } | null): boolean {
  if (!filtro) return true;
  if (filtro.uf !== SEDE_SOACO.uf || filtro.cidadeChave !== SEDE_SOACO.cidadeChave) return false;
  return filtro.bairroChave == null || filtro.bairroChave === SEDE_SOACO.bairroChave;
}

const ESTADOS = estadosGeo as FeatureCollection<Polygon | MultiPolygon, { sigla: string; nome: string; ibge: string }>;
const IBGE_POR_UF = new Map(ESTADOS.features.map((feature) => [feature.properties.sigla, feature.properties.ibge]));
const cacheMalha = new Map<string, FeatureCollection<Polygon | MultiPolygon, PropsCidade>>();
const cacheGeo = new Map<string, Ponto | null>();
const CACHE_GEO = "rh-mapa-bairros-v7";

function normalizarLocalidade(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function chaveCidade(cidade: string): string {
  return normalizarLocalidade(cidade);
}

const BAIRRO_GENERICO =
  /^(ZONA RURAL|ZONA URBANA|AREA RURAL|RURAL|INTERIOR|DISTRITO|ZONA|SEM BAIRRO|NAO INFORMADO|NAO INFORMADA|NAO CONSTA|SITIO|POVOADO|RODOVIA|AREA)$/;

function bairroGenerico(bairro: string): boolean {
  const nome = chaveCidade(bairro);
  if (!nome) return false;
  return BAIRRO_GENERICO.test(nome);
}

function extrairEndereco(endereco: string, bairro: string, cidade: string): { logradouro: string; cep: string } {
  const cepMatch = endereco.match(/(\d{5})-?(\d{3})/);
  const cep = cepMatch ? `${cepMatch[1]}${cepMatch[2]}` : "";
  const antesCep = (endereco.split(/-?\s*CEP:/i)[0] ?? endereco).trim();
  const partes = antesCep.split(",").map((parte) => parte.trim()).filter(Boolean);
  const bairroN = chaveCidade(bairro);
  const cidadeN = chaveCidade(cidade);
  const corte = partes.findIndex((parte) => {
    const nome = chaveCidade(parte);
    return nome === bairroN || nome === cidadeN || /^[A-Z]{2}$/.test(parte);
  });
  const logradouro = (corte > 0 ? partes.slice(0, corte) : [])
    .filter((parte) => chaveCidade(parte) !== cidadeN && !/^[A-Z]{2}$/.test(parte))
    .join(", ");
  return { logradouro, cep };
}

function chaveEndereco(pessoa: PessoaLocalidade): string | null {
  const extraido = extrairEndereco(pessoa.endereco, pessoa.bairro, pessoa.cidade);
  const logradouro = (pessoa.logradouro || extraido.logradouro).trim();
  const cep = (pessoa.cep || extraido.cep).replace(/\D/g, "");
  if (!logradouro) return null;
  return `end:${pessoa.uf}|${pessoa.cidadeChave}|${chaveCidade(logradouro)}|${chaveCidade(pessoa.bairro)}|${cep}`;
}

function corCalor(peso: number): string {
  const t = Math.min(1, Math.max(0, peso));
  const paradas: Array<[number, number, number]> = [
    [90, 143, 212],
    [255, 173, 0],
    [220, 38, 38],
  ];
  const escala = t * (paradas.length - 1);
  const indice = Math.min(paradas.length - 2, Math.floor(escala));
  const mistura = escala - indice;
  const origem = paradas[indice] ?? paradas[0]!;
  const destino = paradas[indice + 1] ?? origem;
  const canal = (posicao: number) => Math.round(origem[posicao]! + (destino[posicao]! - origem[posicao]!) * mistura);
  return `rgb(${canal(0)}, ${canal(1)}, ${canal(2)})`;
}

function distanciaKm(a: Ponto, b: Ponto): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function deslocar(centro: Ponto, indice: number, passo = 0.0075): Ponto {
  const angulo = indice * 2.399963;
  const raio = passo * Math.sqrt(indice + 1);
  return {
    lat: centro.lat + raio * Math.cos(angulo),
    lng: centro.lng + (raio * Math.sin(angulo)) / Math.max(0.2, Math.cos((centro.lat * Math.PI) / 180)),
  };
}

function lerCacheGeo(): Record<string, Ponto> {
  try {
    const cru = localStorage.getItem(CACHE_GEO);
    if (!cru) return {};
    const dados = JSON.parse(cru) as Record<string, Ponto>;
    return dados && typeof dados === "object" ? dados : {};
  } catch {
    return {};
  }
}

function gravarCacheGeo(chave: string, ponto: Ponto) {
  try {
    const atual = lerCacheGeo();
    atual[chave] = ponto;
    localStorage.setItem(CACHE_GEO, JSON.stringify(atual));
  } catch {
    /* o cache só evita repetir a busca */
  }
}

type ConsultaGeo = {
  chave: string;
  consulta: string;
  cidade: string;
  bairro: string;
  uf: string;
  logradouro?: string;
  cep?: string;
  lat?: number;
  lng?: number;
};

async function pedirPontos(
  consultas: ConsultaGeo[],
  aoReceber?: (pontos: Record<string, Ponto>) => void,
): Promise<Record<string, Ponto>> {
  const saida: Record<string, Ponto> = {};
  const faltantes: ConsultaGeo[] = [];
  const disco = lerCacheGeo();
  for (const consulta of consultas) {
    if (cacheGeo.has(consulta.chave)) {
      const memoria = cacheGeo.get(consulta.chave);
      if (memoria) saida[consulta.chave] = memoria;
      continue;
    }
    const salvo = disco[consulta.chave];
    if (salvo && Number.isFinite(salvo.lat) && Number.isFinite(salvo.lng)) {
      cacheGeo.set(consulta.chave, salvo);
      saida[consulta.chave] = salvo;
      continue;
    }
    faltantes.push(consulta);
  }
  if (faltantes.length === 0) return saida;
  try {
    for (let inicio = 0; inicio < faltantes.length; inicio += 12) {
      const lote = faltantes.slice(inicio, inicio + 12);
      const resposta = await rhFetchJson<{ pontos?: Array<{ chave: string; lat: number; lng: number }> }>("geocode-localidades", {
        method: "POST",
        body: { consultas: lote },
      });
      const recebidos = new Set<string>();
      for (const ponto of resposta.pontos ?? []) {
        if (!ponto || !Number.isFinite(ponto.lat) || !Number.isFinite(ponto.lng)) continue;
        const valor = { lat: ponto.lat, lng: ponto.lng };
        cacheGeo.set(ponto.chave, valor);
        gravarCacheGeo(ponto.chave, valor);
        saida[ponto.chave] = valor;
        recebidos.add(ponto.chave);
      }
      for (const consulta of lote) {
        if (!recebidos.has(consulta.chave)) cacheGeo.set(consulta.chave, null);
      }
      const parciais: Record<string, Ponto> = {};
      for (const chave of recebidos) {
        const ponto = saida[chave];
        if (ponto) parciais[chave] = ponto;
      }
      if (Object.keys(parciais).length > 0) aoReceber?.(parciais);
    }
  } catch {
    /* sem rede, as bolhas ficam espalhadas a partir do centro da cidade */
  }
  return saida;
}

async function carregarMunicipios(ibge: string, uf: string): Promise<FeatureCollection<Polygon | MultiPolygon, PropsCidade>> {
  const emCache = cacheMalha.get(ibge);
  if (emCache) return emCache;
  const [malha, nomes] = await Promise.all([
    fetch(
      `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${ibge}?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio`,
    ).then((resposta) => {
      if (!resposta.ok) throw new Error("malha");
      return resposta.json() as Promise<FeatureCollection<Polygon | MultiPolygon, { codarea?: string }>>;
    }),
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ibge}/municipios`).then((resposta) => {
      if (!resposta.ok) throw new Error("nomes");
      return resposta.json() as Promise<Array<{ id: number; nome: string }>>;
    }),
  ]);
  const nomePorCodigo = new Map(nomes.map((municipio) => [String(municipio.id), municipio.nome]));
  const recursos: FeatureCollection<Polygon | MultiPolygon, PropsCidade> = {
    type: "FeatureCollection",
    features: malha.features.map((feature) => {
      const codigo = String(feature.properties?.codarea ?? "");
      const nome = nomePorCodigo.get(codigo) ?? codigo;
      return {
        type: "Feature",
        geometry: feature.geometry,
        properties: { nome, codigo, chave: normalizarLocalidade(nome), uf },
      };
    }),
  };
  cacheMalha.set(ibge, recursos);
  return recursos;
}

function centroDaFeature(feature: Feature<Polygon | MultiPolygon, PropsCidade>): Ponto | null {
  const bounds = L.geoJSON(feature as GeoJsonObject).getBounds();
  if (!bounds.isValid()) return null;
  const centro = bounds.getCenter();
  return { lat: centro.lat, lng: centro.lng };
}

function separarCoincidentes(itens: Array<{ id: string; ponto: Ponto; quantidade: number }>): Map<string, Ponto> {
  const ordenados = [...itens].sort((a, b) => b.quantidade - a.quantidade);
  const ocupados: Ponto[] = [];
  const saida = new Map<string, Ponto>();
  for (const item of ordenados) {
    let ponto = item.ponto;
    let tentativa = 0;
    while (ocupados.some((outro) => distanciaKm(outro, ponto) < 0.08) && tentativa < 18) {
      ponto = deslocar(item.ponto, tentativa + 1);
      tentativa += 1;
    }
    ocupados.push(ponto);
    saida.set(item.id, ponto);
  }
  return saida;
}

function Enquadrar({ token, box, maxZoom }: { token: number; box: string; maxZoom: number }) {
  const map = useMap();
  const ultimo = useRef("");
  useEffect(() => {
    if (!box) return;
    const assinatura = `${token}:${box}`;
    if (assinatura === ultimo.current) return;
    const primeiro = ultimo.current === "";
    ultimo.current = assinatura;
    const [oeste, sul, leste, norte] = box.split(",").map(Number);
    if ([oeste, sul, leste, norte].some((valor) => !Number.isFinite(valor))) return;
    const bounds = L.latLngBounds([sul!, oeste!], [norte!, leste!]);
    if (!bounds.isValid()) return;
    map.fitBounds(bounds, { padding: [42, 42], maxZoom, animate: !primeiro });
  }, [box, map, maxZoom, token]);
  return null;
}

function AjustarTamanhoMapa({ telaCheia }: { telaCheia: boolean }) {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 60);
    return () => window.clearTimeout(id);
  }, [map, telaCheia]);
  return null;
}

function PaneColaboradores() {
  const map = useMap();
  if (!map.getPane("rh-colaboradores")) {
    const pane = map.createPane("rh-colaboradores");
    pane.style.zIndex = "620";
  }
  if (!map.getPane("rh-sede")) {
    const pane = map.createPane("rh-sede");
    pane.style.zIndex = "640";
  }
  return null;
}

function RankingLocalidade({
  titulo,
  itens,
  total,
  maior,
}: {
  titulo: string;
  itens: Array<{ chave: string; nome: string; detalhe: string; quantidade: number; ativo?: boolean; aoClicar: () => void }>;
  total: number;
  maior: number;
}) {
  return (
    <div className="flex min-h-0 flex-col border border-border bg-background/50 p-4">
      <span className="label-industrial">{titulo}</span>
      {itens.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Sem dados neste filtro.</p>
      ) : (
        <ol className="mt-3 flex min-h-0 flex-1 flex-col justify-center gap-3">
          {itens.map((item, indice) => {
            const percentual = total > 0 ? (item.quantidade / total) * 100 : 0;
            const largura = maior > 0 ? (item.quantidade / maior) * 100 : 0;
            return (
              <li key={item.chave}>
                <button
                  type="button"
                  aria-pressed={item.ativo}
                  className={`w-full rounded-sm px-1.5 py-1 text-left ${item.ativo ? "bg-[#1E22AA]/10 ring-1 ring-[#1E22AA]" : ""}`}
                  onClick={item.aoClicar}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                      {indice + 1}. {item.nome}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {item.quantidade.toLocaleString("pt-BR")} · {percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{item.detalhe}</span>
                  <span className="mt-1.5 block h-1.5 bg-muted">
                    <span className="block h-full" style={{ width: `${largura}%`, backgroundColor: corCalor(largura / 100) }} />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function MapaLocalidadeCard({
  pessoas,
  semLocalidade,
  semBairro,
  referencia,
  onSelect,
}: {
  pessoas: PessoaLocalidade[];
  semLocalidade: number;
  semBairro: number;
  referencia: string;
  onSelect: (selecao: SelecaoLocalidade) => void;
}) {
  const [enquadramento, setEnquadramento] = useState(0);
  const [telaCheia, setTelaCheia] = useState(false);
  const [filtroMapa, setFiltroMapa] = useState<{ uf: string; cidadeChave: string; bairroChave: string | null } | null>(null);
  const mapaHostRef = useRef<HTMLDivElement>(null);
  const [malhas, setMalhas] = useState<FeatureCollection<Polygon | MultiPolygon, PropsCidade>[]>([]);
  const [carregandoCidades, setCarregandoCidades] = useState(false);
  const [malhaPronta, setMalhaPronta] = useState(false);
  const [falhaCidades, setFalhaCidades] = useState(false);
  const [pontos, setPontos] = useState<Record<string, Ponto>>({});
  const [centrosExtras, setCentrosExtras] = useState<Record<string, Ponto>>({});
  const [centrosUrbanos, setCentrosUrbanos] = useState<Record<string, Ponto>>({});
  const [localizando, setLocalizando] = useState(false);

  useEffect(() => {
    const aoMudar = () => setTelaCheia(document.fullscreenElement === mapaHostRef.current);
    document.addEventListener("fullscreenchange", aoMudar);
    return () => document.removeEventListener("fullscreenchange", aoMudar);
  }, []);

  const alternarTelaCheia = () => {
    const alvo = mapaHostRef.current;
    if (!alvo) return;
    if (document.fullscreenElement === alvo) {
      void document.exitFullscreen();
      return;
    }
    void alvo.requestFullscreen();
  };

  const alternarFiltro = (proximo: { uf: string; cidadeChave: string; bairroChave: string | null }) => {
    setFiltroMapa((atual) => {
      const igual =
        atual != null &&
        atual.uf === proximo.uf &&
        atual.cidadeChave === proximo.cidadeChave &&
        atual.bairroChave === proximo.bairroChave;
      return igual ? null : proximo;
    });
  };

  const selecionar = (selecao: SelecaoLocalidade) => {
    if (document.fullscreenElement) void document.exitFullscreen();
    onSelect(selecao);
  };

  const grupos = useMemo(() => {
    const mapa = new Map<string, GrupoBairro>();
    for (const pessoa of pessoas) {
      const id = `${pessoa.uf}|${pessoa.cidadeChave}|${pessoa.bairroChave}`;
      const atual = mapa.get(id);
      if (atual) {
        atual.quantidade += 1;
        continue;
      }
      mapa.set(id, {
        id,
        uf: pessoa.uf,
        cidade: pessoa.cidade,
        cidadeChave: pessoa.cidadeChave,
        bairro: pessoa.bairro,
        bairroChave: pessoa.bairroChave,
        quantidade: 1,
      });
    }
    return [...mapa.values()].sort((a, b) => b.quantidade - a.quantidade);
  }, [pessoas]);

  const porCidade = useMemo(() => {
    const mapa = new Map<string, { uf: string; cidade: string; cidadeChave: string; quantidade: number }>();
    for (const grupo of grupos) {
      const id = `${grupo.uf}|${grupo.cidadeChave}`;
      const atual = mapa.get(id);
      if (atual) atual.quantidade += grupo.quantidade;
      else mapa.set(id, { uf: grupo.uf, cidade: grupo.cidade, cidadeChave: grupo.cidadeChave, quantidade: grupo.quantidade });
    }
    return [...mapa.values()].sort((a, b) => b.quantidade - a.quantidade);
  }, [grupos]);

  const ufs = useMemo(() => [...new Set(porCidade.map((cidade) => cidade.uf))], [porCidade]);
  const total = pessoas.length;
  const maiorBairro = grupos[0]?.quantidade ?? 1;

  const chavesPrincipais = useMemo(() => {
    const chaves = new Set<string>();
    if (porCidade.length === 0 || total <= 0) return chaves;
    const maior = porCidade[0];
    if (!maior) return chaves;
    if (maior.quantidade / total >= 0.7) {
      chaves.add(`${maior.uf}|${maior.cidadeChave}`);
      return chaves;
    }
    let acumulado = 0;
    for (const cidade of porCidade) {
      chaves.add(`${cidade.uf}|${cidade.cidadeChave}`);
      acumulado += cidade.quantidade;
      if (acumulado / total >= 0.9) break;
    }
    return chaves;
  }, [porCidade, total]);

  useEffect(() => {
    if (ufs.length === 0) {
      setMalhas([]);
      setFalhaCidades(false);
      setMalhaPronta(true);
      return;
    }
    let ativo = true;
    setMalhaPronta(false);
    setCarregandoCidades(true);
    setFalhaCidades(false);
    Promise.all(
      ufs.map(async (uf) => {
        const ibge = IBGE_POR_UF.get(uf);
        if (!ibge) return null;
        return carregarMunicipios(ibge, uf);
      }),
    )
      .then((listas) => {
        if (!ativo) return;
        const validas = listas.filter((lista): lista is FeatureCollection<Polygon | MultiPolygon, PropsCidade> => lista != null);
        setMalhas(validas);
        setFalhaCidades(validas.length === 0);
      })
      .catch(() => {
        if (!ativo) return;
        setMalhas([]);
        setFalhaCidades(true);
      })
      .finally(() => {
        if (!ativo) return;
        setCarregandoCidades(false);
        setMalhaPronta(true);
      });
    return () => {
      ativo = false;
    };
  }, [ufs]);

  const malhaCidades = useMemo(() => {
    const presentes = new Set(porCidade.map((cidade) => `${cidade.uf}|${cidade.cidadeChave}`));
    const features = malhas.flatMap((malha) => malha.features).filter((feature) => presentes.has(`${feature.properties.uf}|${feature.properties.chave}`));
    return { type: "FeatureCollection" as const, features };
  }, [malhas, porCidade]);

  const centroPorCidade = useMemo(() => {
    const mapa = new Map<string, Ponto>();
    for (const feature of malhaCidades.features) {
      const centro = centroDaFeature(feature);
      if (centro) mapa.set(`${feature.properties.uf}|${feature.properties.chave}`, centro);
    }
    return mapa;
  }, [malhaCidades]);

  const assinaturaGrupos = grupos.map((grupo) => grupo.id).join(";");
  const assinaturaCentros = [...centroPorCidade.keys()].sort().join(";");

  useEffect(() => {
    if (!malhaPronta || carregandoCidades || grupos.length === 0) return;
    let ativo = true;
    const comBairro = grupos.filter((grupo) => grupo.bairroChave && !bairroGenerico(grupo.bairro));
    const enderecos = new Map<string, PessoaLocalidade>();
    for (const pessoa of pessoas) {
      const chave = chaveEndereco(pessoa);
      if (chave && !enderecos.has(chave)) enderecos.set(chave, pessoa);
    }
    if (comBairro.length === 0 && enderecos.size === 0) {
      setLocalizando(false);
      return;
    }
    setLocalizando(true);
    void (async () => {
      const urbanos = await pedirPontos(
        porCidade.map((cidade) => ({
          chave: `urbano:${cidade.uf}|${cidade.cidadeChave}`,
          consulta: `${cidade.cidade}, ${cidade.uf}, Brazil`,
          cidade: cidade.cidade,
          bairro: "",
          uf: cidade.uf,
        })),
      );
      if (!ativo) return;
      const urbanoPorCidade: Record<string, Ponto> = {};
      for (const [chave, ponto] of Object.entries(urbanos)) {
        urbanoPorCidade[chave.replace(/^urbano:/, "")] = ponto;
      }
      if (Object.keys(urbanoPorCidade).length > 0) setCentrosUrbanos((atual) => ({ ...atual, ...urbanoPorCidade }));
      const centroDa = (uf: string, cidadeChave: string) =>
        urbanoPorCidade[`${uf}|${cidadeChave}`] ?? null;
      const achadosEndereco = await pedirPontos(
        [...enderecos.entries()].map(([chave, pessoa]) => {
          const centro = centroDa(pessoa.uf, pessoa.cidadeChave);
          const extraido = extrairEndereco(pessoa.endereco || pessoa.logradouro, pessoa.bairro, pessoa.cidade);
          const logradouro = (extraido.logradouro || pessoa.logradouro).trim();
          const cep = (pessoa.cep || extraido.cep).replace(/\D/g, "");
          return {
            chave,
            consulta: logradouro || pessoa.cidade,
            cidade: pessoa.cidade,
            bairro: pessoa.bairro,
            uf: pessoa.uf,
            logradouro,
            cep,
            lat: centro?.lat,
            lng: centro?.lng,
          };
        }),
        (parciais) => {
          if (!ativo) return;
          if (Object.keys(parciais).length > 0) setPontos((atual) => ({ ...atual, ...parciais }));
        },
      );
      if (!ativo) return;
      if (Object.keys(achadosEndereco).length > 0) setPontos((atual) => ({ ...atual, ...achadosEndereco }));
      const semContorno = porCidade.filter((cidade) => !centroPorCidade.has(`${cidade.uf}|${cidade.cidadeChave}`));
      const centrosAchados = await pedirPontos(
        semContorno.map((cidade) => ({
          chave: `cidade:${cidade.uf}|${cidade.cidadeChave}`,
          consulta: `${cidade.cidade}, ${cidade.uf}, Brazil`,
          cidade: cidade.cidade,
          bairro: "",
          uf: cidade.uf,
        })),
      );
      if (!ativo) return;
      if (Object.keys(centrosAchados).length > 0) {
        setCentrosExtras((atual) => {
          const proximo = { ...atual };
          for (const [chave, ponto] of Object.entries(centrosAchados)) {
            const id = chave.replace(/^cidade:/, "");
            if (!proximo[id]) proximo[id] = ponto;
          }
          return proximo;
        });
      }
      const achados = await pedirPontos(
        comBairro.map((grupo) => {
          const idCidade = `${grupo.uf}|${grupo.cidadeChave}`;
          const centro = urbanoPorCidade[idCidade] ?? centrosAchados[`cidade:${idCidade}`] ?? null;
          return {
            chave: grupo.id,
            consulta: `${grupo.bairro}, ${grupo.cidade}, ${grupo.uf}, Brazil`,
            cidade: grupo.cidade,
            bairro: grupo.bairro,
            uf: grupo.uf,
            lat: centro?.lat,
            lng: centro?.lng,
          };
        }),
        (parciais) => {
          if (!ativo) return;
          if (Object.keys(parciais).length > 0) setPontos((atual) => ({ ...atual, ...parciais }));
        },
      );
      if (!ativo) return;
      if (Object.keys(achados).length > 0) setPontos((atual) => ({ ...atual, ...achados }));
      setLocalizando(false);
    })();
    return () => {
      ativo = false;
    };
  }, [assinaturaCentros, assinaturaGrupos, carregandoCidades, centroPorCidade, grupos, malhaPronta, pessoas, porCidade]);

  const bolhas = useMemo(() => {
    const indiceNaCidade = new Map<string, number>();
    const basePorBairro = new Map<string, { ponto: Ponto; aproximada: boolean; quantidade: number }>();
    for (const grupo of grupos) {
      if (bairroGenerico(grupo.bairro)) continue;
      const idCidade = `${grupo.uf}|${grupo.cidadeChave}`;
      const centro = centrosUrbanos[idCidade] ?? centrosExtras[idCidade];
      const geocodificado = pontos[grupo.id];
      const indice = indiceNaCidade.get(idCidade) ?? 0;
      indiceNaCidade.set(idCidade, indice + 1);
      const ponto = geocodificado ?? (centro ? deslocar(centro, indice) : null);
      if (!ponto) continue;
      basePorBairro.set(grupo.id, { ponto, aproximada: !geocodificado, quantidade: grupo.quantidade });
    }
    const ajustados = separarCoincidentes(
      [...basePorBairro.entries()].map(([id, base]) => ({ id, ponto: base.ponto, quantidade: base.quantidade })),
    );
    const indiceNoEndereco = new Map<string, number>();
    const indiceNoBairro = new Map<string, number>();
    const saida: Array<{ pessoa: PessoaLocalidade; ponto: Ponto; quantidade: number; aproximada: boolean }> = [];
    for (const pessoa of pessoas) {
      const enderecoId = chaveEndereco(pessoa);
      const pontoEndereco = enderecoId ? pontos[enderecoId] : undefined;
      if (enderecoId && pontoEndereco) {
        const idBairro = `${pessoa.uf}|${pessoa.cidadeChave}|${pessoa.bairroChave}`;
        const baseBairro = basePorBairro.get(idBairro);
        const pontoBairro = baseBairro && !baseBairro.aproximada ? (ajustados.get(idBairro) ?? baseBairro.ponto) : null;
        const origem = pontoBairro && distanciaKm(pontoEndereco, pontoBairro) > 8 ? pontoBairro : pontoEndereco;
        const indice = indiceNoEndereco.get(enderecoId) ?? 0;
        indiceNoEndereco.set(enderecoId, indice + 1);
        saida.push({
          pessoa,
          ponto: indice === 0 ? origem : deslocar(origem, indice, 0.0015),
          quantidade: 1,
          aproximada: false,
        });
        continue;
      }
      const id = `${pessoa.uf}|${pessoa.cidadeChave}|${pessoa.bairroChave}`;
      const base = basePorBairro.get(id);
      if (!base) continue;
      const indice = indiceNoBairro.get(id) ?? 0;
      indiceNoBairro.set(id, indice + 1);
      const origem = ajustados.get(id) ?? base.ponto;
      saida.push({
        pessoa,
        ponto: indice === 0 ? origem : deslocar(origem, indice, 0.0015),
        quantidade: base.quantidade,
        aproximada: base.aproximada,
      });
    }
    return saida;
  }, [centroPorCidade, centrosExtras, centrosUrbanos, grupos, pessoas, pontos]);

  const bolhasVisiveis = useMemo(() => {
    if (!filtroMapa) return bolhas;
    return bolhas.filter((bolha) => {
      if (bolha.pessoa.uf !== filtroMapa.uf || bolha.pessoa.cidadeChave !== filtroMapa.cidadeChave) return false;
      if (filtroMapa.bairroChave != null && bolha.pessoa.bairroChave !== filtroMapa.bairroChave) return false;
      return true;
    });
  }, [bolhas, filtroMapa]);

  const cidadesComBolha = useMemo(
    () => new Set(bolhas.map((bolha) => `${bolha.pessoa.uf}|${bolha.pessoa.cidadeChave}`)),
    [bolhas],
  );

  const porCidadeNoMapa = useMemo(
    () => porCidade.filter((cidade) => cidadesComBolha.has(`${cidade.uf}|${cidade.cidadeChave}`)),
    [cidadesComBolha, porCidade],
  );

  const malhaVisivel = useMemo(() => {
    const comGente = malhaCidades.features.filter((feature) =>
      cidadesComBolha.has(`${feature.properties.uf}|${feature.properties.chave}`),
    );
    if (!filtroMapa) return { type: "FeatureCollection" as const, features: comGente };
    return {
      type: "FeatureCollection" as const,
      features: comGente.filter(
        (feature) => feature.properties.uf === filtroMapa.uf && feature.properties.chave === filtroMapa.cidadeChave,
      ),
    };
  }, [cidadesComBolha, filtroMapa, malhaCidades]);

  const box = useMemo(() => {
    const bounds = L.latLngBounds([]);
    if (filtroMapa) {
      for (const feature of malhaVisivel.features) {
        const caixa = L.geoJSON(feature as GeoJsonObject).getBounds();
        if (caixa.isValid() && !filtroMapa.bairroChave) bounds.extend(caixa);
      }
      for (const bolha of bolhasVisiveis) bounds.extend([bolha.ponto.lat, bolha.ponto.lng]);
      if (sedeCabeNoFiltro(filtroMapa)) bounds.extend([SEDE_SOACO.lat, SEDE_SOACO.lng]);
      if (bounds.isValid()) {
        const centro = bounds.getCenter();
        const nordeste = bounds.getNorthEast();
        const sudoeste = bounds.getSouthWest();
        if (nordeste.equals(sudoeste)) {
          bounds.extend([centro.lat + 0.012, centro.lng + 0.012]);
          bounds.extend([centro.lat - 0.012, centro.lng - 0.012]);
        }
      }
      return bounds.isValid() ? bounds.toBBoxString() : "";
    }
    for (const feature of malhaCidades.features) {
      const id = `${feature.properties.uf}|${feature.properties.chave}`;
      if (!chavesPrincipais.has(id) || (cidadesComBolha.size > 0 && !cidadesComBolha.has(id))) continue;
      const caixa = L.geoJSON(feature as GeoJsonObject).getBounds();
      if (caixa.isValid()) bounds.extend(caixa);
    }
    for (const id of chavesPrincipais) {
      if (cidadesComBolha.size > 0 && !cidadesComBolha.has(id)) continue;
      const extra = centrosExtras[id];
      if (!extra) continue;
      bounds.extend([extra.lat - 0.05, extra.lng - 0.05]);
      bounds.extend([extra.lat + 0.05, extra.lng + 0.05]);
    }
    return bounds.isValid() ? bounds.toBBoxString() : "";
  }, [bolhasVisiveis, centrosExtras, chavesPrincipais, cidadesComBolha, filtroMapa, malhaCidades.features, malhaVisivel.features]);

  const resumoCidades = useMemo(() => {
    if (porCidadeNoMapa.length === 0) return "";
    const primeiras = porCidadeNoMapa.slice(0, 2).map((cidade) => cidade.cidade);
    const resto = porCidadeNoMapa.length - primeiras.length;
    return resto > 0 ? `${primeiras.join(", ")} e mais ${resto}` : primeiras.join(" e ");
  }, [porCidadeNoMapa]);

  const topCidades = porCidadeNoMapa.slice(0, 3);
  const topBairros = grupos.filter((grupo) => grupo.bairroChave).slice(0, 3);
  const maiorCidadeTop = topCidades[0]?.quantidade ?? 1;
  const maiorBairroTop = topBairros[0]?.quantidade ?? 1;

  const aproximadas = bolhas.filter((bolha) => bolha.aproximada).length;

  const pintarCidade = (feature?: Feature) => {
    const props = feature?.properties as PropsCidade | undefined;
    const quantidade = porCidade.find((cidade) => cidade.uf === props?.uf && cidade.cidadeChave === props?.chave)?.quantidade ?? 0;
    const peso = total > 0 ? quantidade / total : 0;
    return {
      fillColor: corCalor(Math.min(1, peso / 0.45)),
      color: "#1e293b",
      weight: 1.25,
      fillOpacity: 0.16,
      className: "cursor-pointer",
    };
  };

  const prepararCidade: L.GeoJSONOptions["onEachFeature"] = (feature, layer) => {
    const props = feature.properties as PropsCidade;
    const cidade = porCidade.find((item) => item.uf === props.uf && item.cidadeChave === props.chave);
    const quantidade = cidade?.quantidade ?? 0;
    const nome = cidade?.cidade ?? props.nome;
    layer.bindTooltip(`${nome} · ${quantidade.toLocaleString("pt-BR")}`, { sticky: false, opacity: 0.95 });
    layer.on("click", (evento) => {
      L.DomEvent.stopPropagation(evento);
      if (quantidade <= 0) return;
      alternarFiltro({ uf: props.uf, cidadeChave: props.chave, bairroChave: null });
    });
  };

  return (
    <div className="overflow-hidden border border-border bg-card p-6 shadow-level-1">
      <style>{`
        .rh-mapa-folha .leaflet-container img.leaflet-tile {
          mix-blend-mode: normal !important;
        }
        .rh-mapa-folha .rh-sede-soaco {
          background: transparent;
          border: none;
        }
        .rh-mapa-folha:fullscreen {
          height: 100%;
          width: 100%;
          border-radius: 0;
          background: #e8eef4;
        }
        .rh-mapa-folha .leaflet-control-zoom a {
          background: #0f172a;
          color: #fff;
          border-color: rgba(255,255,255,.16);
        }
        .rh-mapa-folha .leaflet-tooltip {
          background: rgba(4, 30, 66, 0.92);
          border: none;
          border-radius: 2px;
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          box-shadow: none;
          padding: 3px 7px;
        }
        .rh-mapa-folha .leaflet-tooltip::before { display: none; }
        .rh-mapa-folha .leaflet-control-attribution {
          background: rgba(11, 18, 32, 0.72);
          color: #94a3b8;
          font-size: 10px;
        }
        .rh-mapa-folha .leaflet-control-attribution a { color: #cbd5e1; }
      `}</style>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <span className="label-industrial">Distribuição por localidade</span>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-sm border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            aria-pressed={telaCheia}
            onClick={alternarTelaCheia}
          >
            {telaCheia ? "Sair da tela cheia" : "Tela cheia"}
          </button>
          {filtroMapa ? (
            <button
              type="button"
              className="rounded-sm border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setFiltroMapa(null)}
            >
              Ver todos
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-sm border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => {
              setFiltroMapa(null);
              setEnquadramento((atual) => atual + 1);
            }}
          >
            Enquadrar principais
          </button>
          <span className="text-xs text-muted-foreground">{referencia}</span>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {resumoCidades
          ? `${resumoCidades}. Cada bolha é um colaborador, no bairro em que mora. A cor esquenta onde o bairro concentra mais gente.`
          : "Cada bolha é um colaborador, no bairro em que mora. A cor esquenta onde o bairro concentra mais gente."}
        {carregandoCidades ? " Carregando cidades…" : ""}
        {localizando ? " Posicionando os bairros…" : ""}
        {falhaCidades ? " Não foi possível carregar o contorno das cidades." : ""}
      </p>

      {total <= 0 ? (
        <p className="mt-4 border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          Sem localidade informada na Secullum para os colaboradores ativos deste filtro.
        </p>
      ) : (
        <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div
          ref={mapaHostRef}
          className={`rh-mapa-folha relative overflow-hidden rounded-sm border border-border/40 bg-[#e8eef4] ${telaCheia ? "h-full" : "h-[480px]"}`}
        >
          {telaCheia ? (
            <button
              type="button"
              className="absolute right-3 top-3 z-[1000] rounded-sm border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground shadow-level-1"
              onClick={alternarTelaCheia}
            >
              Sair da tela cheia
            </button>
          ) : null}
          <MapContainer
            center={[-14.2, -51.9]}
            zoom={4}
            minZoom={4}
            maxZoom={17}
            scrollWheelZoom
            zoomControl
            className="h-full w-full bg-[#e8eef4]"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Enquadrar token={enquadramento} box={box} maxZoom={filtroMapa?.bairroChave ? 16 : 13} />
            <AjustarTamanhoMapa telaCheia={telaCheia} />
            <PaneColaboradores />
            {malhaVisivel.features.length > 0 ? (
              <GeoJSON
                key={`cidades-${filtroMapa ? `${filtroMapa.uf}|${filtroMapa.cidadeChave}|${filtroMapa.bairroChave ?? ""}` : "todas"}-${malhaVisivel.features.map((feature) => feature.properties.chave).join("|")}`}
                data={malhaVisivel as GeoJsonObject}
                style={pintarCidade}
                onEachFeature={prepararCidade}
              />
            ) : null}
            {sedeCabeNoFiltro(filtroMapa) ? (
              <Marker position={[SEDE_SOACO.lat, SEDE_SOACO.lng]} icon={iconeSedeSoaco} pane="rh-sede" zIndexOffset={800}>
                <Tooltip direction="right" offset={[12, -18]} opacity={1}>
                  Polo Empresarial Sul · Estr. Pedra Miúda, 9519
                </Tooltip>
              </Marker>
            ) : null}
            {bolhasVisiveis.map((bolha) => {
              const peso = bolha.quantidade / maiorBairro;
              const cor = corCalor(peso);
              const rotuloBairro = bolha.pessoa.bairro || "Sem bairro";
              const nome = bolha.pessoa.nome || bolha.pessoa.matricula;
              return (
                <CircleMarker
                  key={`${bolha.pessoa.matricula}-${bolha.ponto.lat.toFixed(5)}-${bolha.ponto.lng.toFixed(5)}`}
                  center={[bolha.ponto.lat, bolha.ponto.lng]}
                  radius={8}
                  pane="rh-colaboradores"
                  pathOptions={{
                    color: "#ffffff",
                    weight: 1.5,
                    fillColor: cor,
                    fillOpacity: 1,
                    bubblingMouseEvents: false,
                    className: "cursor-pointer",
                  }}
                  eventHandlers={{
                    click: () =>
                      selecionar({
                        uf: bolha.pessoa.uf,
                        cidade: bolha.pessoa.cidade,
                        bairroChave: bolha.pessoa.bairroChave,
                        matricula: bolha.pessoa.matricula,
                        rotulo: nome,
                      }),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                    {`${nome} · ${rotuloBairro}`}
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
        <div className="grid gap-4 lg:h-[480px] lg:grid-rows-2">
          <RankingLocalidade
            titulo="Top 3 cidades"
            total={total}
            maior={maiorCidadeTop}
            itens={topCidades.map((cidade) => ({
              chave: `${cidade.uf}|${cidade.cidadeChave}`,
              nome: cidade.cidade,
              detalhe: cidade.uf,
              quantidade: cidade.quantidade,
              ativo:
                filtroMapa != null &&
                filtroMapa.uf === cidade.uf &&
                filtroMapa.cidadeChave === cidade.cidadeChave &&
                filtroMapa.bairroChave == null,
              aoClicar: () => alternarFiltro({ uf: cidade.uf, cidadeChave: cidade.cidadeChave, bairroChave: null }),
            }))}
          />
          <RankingLocalidade
            titulo="Top 3 bairros"
            total={total}
            maior={maiorBairroTop}
            itens={topBairros.map((bairro) => ({
              chave: bairro.id,
              nome: bairro.bairro,
              detalhe: `${bairro.cidade} — ${bairro.uf}`,
              quantidade: bairro.quantidade,
              ativo:
                filtroMapa != null &&
                filtroMapa.uf === bairro.uf &&
                filtroMapa.cidadeChave === bairro.cidadeChave &&
                filtroMapa.bairroChave === bairro.bairroChave,
              aoClicar: () =>
                alternarFiltro({ uf: bairro.uf, cidadeChave: bairro.cidadeChave, bairroChave: bairro.bairroChave }),
            }))}
          />
        </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: corCalor(0.08) }} />
            Poucos
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: corCalor(0.5) }} />
            Concentração média
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: corCalor(1) }} />
            Maior concentração
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 border border-[#FFAD00] bg-[#041E42]" />
            Só Aço
          </span>
        </span>
        <span>
          Clique na cidade ou no bairro da lista para ver só eles no mapa. Clique na bolha para abrir o colaborador.
          {semBairro > 0 ? ` ${semBairro.toLocaleString("pt-BR")} sem bairro informado.` : ""}
          {semLocalidade > 0 ? ` ${semLocalidade.toLocaleString("pt-BR")} sem cidade ou UF.` : ""}
          {!localizando && aproximadas > 0 ? " Parte dos bairros ficou espalhada a partir do centro da cidade." : ""}
        </span>
      </div>
    </div>
  );
}
