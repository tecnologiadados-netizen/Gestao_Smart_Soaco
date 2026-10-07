/** Centroides OSM (suburb/quarter) — os mesmos rótulos do mapa de ruas. */

export type PontoBairroOsm = { lat: number; lng: number };

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function chaveBairroOsm(uf: string, cidade: string, bairro: string): string {
  return `${uf.trim().toUpperCase()}|${normalizar(cidade)}|${normalizar(bairro)}`;
}

const TERESINA: Record<string, PontoBairroOsm> = {
  AREIAS: { lat: -5.1589709, lng: -42.7930784 },
  "PEDRA MIUDA": { lat: -5.2036555, lng: -42.7386618 },
  "SANTO ANTONIO": { lat: -5.1531794, lng: -42.7756977 },
  ESPLANADA: { lat: -5.1924686, lng: -42.7547267 },
  ANGELIM: { lat: -5.1818157, lng: -42.7810193 },
  "VILA IRMA DULCE": { lat: -5.1925999, lng: -42.7741595 },
  "IRMA DULCE": { lat: -5.1925999, lng: -42.7741595 },
  "PORTAL DA ALEGRIA": { lat: -5.192725, lng: -42.7438477 },
  "PARQUE SUL": { lat: -5.1462338, lng: -42.7538109 },
  "PORTO ALEGRE": { lat: -5.1736699, lng: -42.7505966 },
  "EDUARDO COSTA": { lat: -5.222091, lng: -42.741932 },
  "SANTA CRUZ": { lat: -5.1576994, lng: -42.7852517 },
  PROMORAR: { lat: -5.1490654, lng: -42.7857292 },
  "PARQUE PIAUI": { lat: -5.1433993, lng: -42.7861969 },
  "DIRCEU ARCOVERDE": { lat: -5.1021281, lng: -42.7548827 },
  DIRCEU: { lat: -5.1021281, lng: -42.7548827 },
  "BELA VISTA": { lat: -5.1345436, lng: -42.7738309 },
  CENTRO: { lat: -5.0897725, lng: -42.8130528 },
  "LOURIVAL PARENTE": { lat: -5.1333468, lng: -42.787478 },
  SATELITE: { lat: -5.0474506, lng: -42.7579193 },
  ITARARE: { lat: -5.1046335, lng: -42.7597654 },
  REDENCAO: { lat: -5.1181595, lng: -42.7930213 },
  "SAO PEDRO": { lat: -5.1183823, lng: -42.8091098 },
  PLANALTO: { lat: -5.0578171, lng: -42.7766089 },
  MOCAMBINHO: { lat: -5.0253266, lng: -42.8128339 },
  FATIMA: { lat: -5.068136, lng: -42.7925973 },
  "NOVA BRASILIA": { lat: -5.051008, lng: -42.8281271 },
  "NOVA BRASIL": { lat: -5.051008, lng: -42.8281271 },
  "PEDRA MOLE": { lat: -5.0113636, lng: -42.7816688 },
  OLARIAS: { lat: -5.0418383, lng: -42.8375256 },
  MAFRENSE: { lat: -5.042672, lng: -42.8320324 },
  "ALTO ALEGRE": { lat: -5.0404731, lng: -42.8239201 },
  "SAO JOAQUIM": { lat: -5.0567363, lng: -42.8345215 },
  ITAPERU: { lat: -5.0479515, lng: -42.822355 },
  MEMORARE: { lat: -5.0459209, lng: -42.8172051 },
  "MORADA NOVA": { lat: -5.1248111, lng: -42.7884901 },
  TABULETA: { lat: -5.1226881, lng: -42.8036522 },
  TRIUNFO: { lat: -5.1273414, lng: -42.795825 },
  "PARQUE SAO JOAO": { lat: -5.1307395, lng: -42.8014469 },
  ACARAPE: { lat: -5.0709927, lng: -42.8298866 },
  COLORADO: { lat: -5.095899, lng: -42.7346159 },
  "SANTA MARIA": { lat: -4.9890498, lng: -42.8376268 },
  GURUPI: { lat: -5.0846391, lng: -42.7387691 },
  PICARRA: { lat: -5.0936472, lng: -42.7988169 },
  CABRAL: { lat: -5.0820069, lng: -42.8015041 },
  JOQUEI: { lat: -5.0762366, lng: -42.7895289 },
  NOIVOS: { lat: -5.0844226, lng: -42.7853232 },
  ILHOTAS: { lat: -5.0917626, lng: -42.792798 },
  VERMELHA: { lat: -5.1053361, lng: -42.8087881 },
  "POTI VELHO": { lat: -5.0369008, lng: -42.8298223 },
  "BUENOS AIRES": { lat: -5.0380224, lng: -42.8085923 },
  "AGUA MINERAL": { lat: -5.0460074, lng: -42.8073712 },
  "CIDADE NOVA": { lat: -5.1087721, lng: -42.7895698 },
  "MONTE CASTELO": { lat: -5.1035626, lng: -42.7964461 },
  ININGA: { lat: -5.0551964, lng: -42.7937519 },
  HORTO: { lat: -5.0661055, lng: -42.7774268 },
  "MORADA DO SOL": { lat: -5.0695917, lng: -42.7662525 },
  "SANTA LIA": { lat: -5.0627306, lng: -42.7528672 },
  "PARQUE IDEAL": { lat: -5.0998199, lng: -42.7482881 },
  ZOOBOTANICO: { lat: -5.0427921, lng: -42.7768369 },
  MATINHA: { lat: -5.0813049, lng: -42.8250504 },
  "SAO CRISTOVAO": { lat: -5.0780929, lng: -42.769979 },
  EXTREMA: { lat: -5.1209031, lng: -42.7581107 },
  "SANTA ROSA": { lat: -5.0246838, lng: -42.8336052 },
  "NOVA TERESINA": { lat: -5.0123789, lng: -42.7956219 },
  PRIMAVERA: { lat: -5.0631586, lng: -42.8129912 },
  "CIDADE JARDIM": { lat: -5.0199177, lng: -42.774207 },
  "RECANTO DAS PALMEIRAS": { lat: -5.0834817, lng: -42.7587604 },
  "VERDE LAR": { lat: -5.0384091, lng: -42.7365904 },
  "NOVO HORIZONTE": { lat: -5.1120996, lng: -42.7492126 },
  "PARQUE JACINTA": { lat: -5.1707674, lng: -42.764411 },
  "VALE QUEM TEM": { lat: -5.0492033, lng: -42.7381782 },
  "CIDADE SUL": { lat: -5.1712607, lng: -42.7545754 },
  RENASCENCA: { lat: -5.0994875, lng: -42.7410008 },
  AEROPORTO: { lat: -5.0680318, lng: -42.8175831 },
};

const TIMON: Record<string, PontoBairroOsm> = {
  MATEUZINHO: { lat: -5.1127802, lng: -42.8222858 },
};

const POR_CIDADE: Record<string, Record<string, PontoBairroOsm>> = {
  "PI|TERESINA": TERESINA,
  "MA|TIMON": TIMON,
};

/** Sede OSM do município — quando o cadastro repete o nome da cidade no bairro. */
const CIDADES_OSM: Record<string, PontoBairroOsm> = {
  "PI|DEMERVAL LOBAO": { lat: -5.3640643, lng: -42.673993 },
  "PI|NAZARIA": { lat: -5.3512851, lng: -42.8152823 },
  "PI|LAGOA DO PIAUI": { lat: -5.4116544, lng: -42.6450588 },
  "PI|BENEDITINOS": { lat: -5.4565671, lng: -42.3605061 },
  "PI|MONSENHOR GIL": { lat: -5.5609098, lng: -42.6127716 },
  "PI|COIVARAS": { lat: -5.0927005, lng: -42.2052489 },
  "PI|ALTO LONGA": { lat: -5.2549051, lng: -42.2072388 },
  "PI|PAU D ARCO DO PIAUI": { lat: -5.2522265, lng: -42.3884018 },
  "PI|CURRALINHOS": { lat: -5.6190404, lng: -42.8280018 },
  "MA|TIMON": { lat: -5.1004341, lng: -42.8312018 },
};

export function bairroEhACidade(bairro: string, cidade: string): boolean {
  const bairroNorm = normalizar(bairro);
  const cidadeNorm = normalizar(cidade);
  return bairroNorm.length > 0 && bairroNorm === cidadeNorm;
}

export function pontoCidadeOsmConhecido(uf: string, cidade: string): PontoBairroOsm | null {
  const ufNorm = uf.trim().toUpperCase();
  const cidadeNorm = normalizar(cidade);
  if (!ufNorm || !cidadeNorm) return null;
  return CIDADES_OSM[`${ufNorm}|${cidadeNorm}`] ?? null;
}

function resolverBairroNaTabela(tabela: Record<string, PontoBairroOsm>, bairroNorm: string): PontoBairroOsm | null {
  const exato = tabela[bairroNorm];
  if (exato) return exato;
  if (bairroNorm.length < 6) return null;
  const prefixos = Object.keys(tabela).filter((chave) => chave.startsWith(bairroNorm) && chave !== bairroNorm);
  if (prefixos.length === 1) return tabela[prefixos[0]] ?? null;
  return null;
}

export function pontoBairroOsmConhecido(uf: string, cidade: string, bairro: string): PontoBairroOsm | null {
  const ufNorm = uf.trim().toUpperCase();
  const cidadeNorm = normalizar(cidade);
  const bairroNorm = normalizar(bairro);
  if (!ufNorm || !cidadeNorm || !bairroNorm) return null;
  if (bairroEhACidade(bairro, cidade)) return pontoCidadeOsmConhecido(uf, cidade);
  const tabela = POR_CIDADE[`${ufNorm}|${cidadeNorm}`];
  if (!tabela) return null;
  return resolverBairroNaTabela(tabela, bairroNorm);
}
