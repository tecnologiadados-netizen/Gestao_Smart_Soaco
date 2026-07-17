/** Persistência e montagem do Mapa de Vínculos Organizacionais. */

export const ORGANOGRAMA_VINCULACOES_CONFIG_KEY = "organograma_vinculacoes_v1";

export const LIDER_A_DEFINIR = "A definir";

export type OrganogramaDiretoriaId = "presidencia" | "operacao" | "financeira";

export type OrganogramaDiretoriaCatalogo = {
  id: OrganogramaDiretoriaId;
  nome: string;
  diretor: string;
  fotoKey: string;
};

export const ORGANOGRAMA_DIRETORIAS: OrganogramaDiretoriaCatalogo[] = [
  {
    id: "presidencia",
    nome: "Presidência · Dir. Comercial",
    diretor: "Sr. Marques",
    fotoKey: "organograma-foto:presidencia",
  },
  {
    id: "operacao",
    nome: "Diretoria de Operação",
    diretor: "Marques Filho",
    fotoKey: "organograma-foto:operacao",
  },
  {
    id: "financeira",
    nome: "Diretoria Financeira",
    diretor: "Manuela Cortez",
    fotoKey: "organograma-foto:financeira",
  },
];

export type OrganogramaVinculacao = {
  setor: string;
  /** Área usada só para agrupamento visual no mapa. */
  area: string;
  diretoriaId: OrganogramaDiretoriaId | "";
  liderNome: string;
  liderMatricula?: string;
  cargo?: string;
};

export type OrganogramaVinculacoesPayload = {
  version: 1;
  items: OrganogramaVinculacao[];
};

export type SetorOrganizacional = {
  nome: string;
  lider: string;
  cargo?: string;
  matricula?: string;
};

export type AreaOrganizacional = {
  nome: string;
  setores: SetorOrganizacional[];
};

export type DiretoriaTree = {
  id: OrganogramaDiretoriaId;
  nome: string;
  diretor: string;
  fotoKey: string;
  areas: AreaOrganizacional[];
};

const DIRETORES = new Set(
  ORGANOGRAMA_DIRETORIAS.map((d) => normalizarChave(d.diretor)).concat([
    "sr marques",
    "sr. marques",
    "marques filho",
    "manuela cortez",
  ]),
);

/** Seed inicial alinhado ao organograma já validado (nomes reais do Orgânico/Secullum). */
export const ORGANOGRAMA_VINCULACOES_SEED: OrganogramaVinculacao[] = [
  v("VENDAS - COMERCIAL", "COMERCIAL", "presidencia", "Marcos Vinicius Amorim Carneiro", "1008", "Gerente Comercial"),
  v("COMPRAS", "ADMINISTRATIVO", "presidencia", LIDER_A_DEFINIR),
  v("MANUTENÇÃO - FACILITIES", "MANUTENÇÃO INDUSTRIAL", "presidencia", LIDER_A_DEFINIR),
  v("MANUTENCAO - FACILITIES", "MANUTENÇÃO INDUSTRIAL", "presidencia", LIDER_A_DEFINIR),
  v("MANUTENÇÃO - OFICINA", "MANUTENÇÃO VEICULAR", "presidencia", LIDER_A_DEFINIR),
  v("TRANSPORTE - LOGÍSTICA", "LOGÍSTICA", "presidencia", LIDER_A_DEFINIR),
  v("DEPÓSITO", "LOGÍSTICA", "presidencia", "Gilvania Evangelista Sampaio", "1964", "Gerente Comercial- Loja"),
  v("PORTARIA - ADMINISTRATIVO", "ADMINISTRATIVO", "presidencia", LIDER_A_DEFINIR),
  v("FATURAMENTO", "ADMINISTRATIVO", "presidencia", "Ana Lucia Lima de Carvalho", "84", "Sub-Gerente"),

  v("ALMOXARIFADO", "PRODUÇÃO", "operacao", "Manoel Luiz de Sousa Junior", "80", "Almoxarife II"),
  v("BALCÃO", "PRODUÇÃO", "operacao", "Ricardo Carvalho Pinto", "96", "Sup. de Refrigeração"),
  v("BEBEDOURO", "PRODUÇÃO", "operacao", "Joao da Cruz Alves de Freitas", "1177", "Lider de Equipe I"),
  v("CHAPARIA", "PRODUÇÃO", "operacao", "Herbert da Silva Chaves", "1478", "Lider de Equipe - V"),
  v("FOGÕES", "PRODUÇÃO", "operacao", "Pedro Paulo Machado Rocha", "509", "Montador Lider"),
  v("LIXADEIRA", "PRODUÇÃO", "operacao", "Rian Mateus Alves Fernandes", "530", "Lider de Equipe - III"),
  v("MARCENARIA", "PRODUÇÃO", "operacao", "Regivaldo Alves de Sena", "434", "Chefe da Marcenaria"),
  v("MONTAGEM", "PRODUÇÃO", "operacao", "Juniel Pereira de Sousa Costa", "1348", "Montador I"),
  v("PERFILADEIRAS", "PRODUÇÃO", "operacao", "Jorge Lemos Ribeiro", "168", "Operador Líder I"),
  v("PINTURA", "PRODUÇÃO", "operacao", "Rian Mateus Alves Fernandes", "530", "Lider de Equipe - III"),
  v("POLICORTE", "PRODUÇÃO", "operacao", "Herbert da Silva Chaves", "1478", "Lider de Equipe - V"),
  v("SESMT - ADMINISTRATIVO", "PRODUÇÃO", "operacao", "Francisco de Jesus Alves Silva", "1769", "Tec. Seg. Trabalho"),
  v("SOLDA - PRODUÇÃO", "PRODUÇÃO", "operacao", "Claudiano Ferreira de Macedo", "87", "Supervisor de Solda e Pintura"),
  v("EMBALAGEM", "PRODUÇÃO", "operacao", "Josenildo Santos Coelho", "897", "Lider de Equipe II"),
  v("ESTOQUE", "PRODUÇÃO", "operacao", "Josenildo Santos Coelho", "897", "Lider de Equipe II"),
  v("ENGENHARIA", "ENGENHARIA", "operacao", "Roberval Sampaio de Sousa Junior", "1691", "Supervisor de Projetos"),
  v("QUALIDADE", "QUALIDADE", "operacao", "Lidia Marina Torres Carvalho Moreira", "1577", "Supervisor de Qualidade"),
  v("PCP", "PLANEJAMENTO", "operacao", "Vinicius Rodrigues Barbosa Cavalcante", "1601", "Analista de PCP III"),
  v("T.I - ADMINISTRATIVO", "ADMINISTRATIVO", "operacao", "Joao Wanderson de Freitas e Silva", "1237", "Analista de Suporte Tecnico"),
  v("GÔNDOLA", "PRODUÇÃO", "operacao", "Naelson Romulo Marreiros Gomes", "1148", "Lider de Equipe I"),

  v("RH", "ADMINISTRATIVO", "financeira", LIDER_A_DEFINIR),
  v("RECEPÇÃO - ADMINISTRATIVO", "ADMINISTRATIVO", "financeira", LIDER_A_DEFINIR),
  v("SERVIÇOS GERAIS  - ADMINISTRATIVO", "ADMINISTRATIVO", "financeira", LIDER_A_DEFINIR),
  v("FINANCEIRO", "ADMINISTRATIVO", "financeira", LIDER_A_DEFINIR),
];

function v(
  setor: string,
  area: string,
  diretoriaId: OrganogramaDiretoriaId,
  liderNome: string,
  liderMatricula?: string,
  cargo?: string,
): OrganogramaVinculacao {
  return { setor, area, diretoriaId, liderNome, liderMatricula, cargo };
}

export function normalizarChave(valor: string): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

export function isLiderDiretorOuPendente(nome: string): boolean {
  const n = String(nome ?? "").trim();
  if (!n || normalizarChave(n) === normalizarChave(LIDER_A_DEFINIR)) return true;
  return DIRETORES.has(normalizarChave(n));
}

export function normalizarLiderExibido(nome: string): string {
  return isLiderDiretorOuPendente(nome) ? LIDER_A_DEFINIR : String(nome ?? "").trim();
}

export function parseOrganogramaVinculacoes(raw: unknown): OrganogramaVinculacao[] {
  if (!raw) return [];
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return [];
    try {
      parsed = JSON.parse(text);
    } catch {
      return [];
    }
  }
  const source =
    parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)
      ? (parsed as { items: unknown[] }).items
      : Array.isArray(parsed)
        ? parsed
        : [];

  const bySetor = new Map<string, OrganogramaVinculacao>();
  for (const item of source) {
    const normalized = normalizeVinculacao(item);
    if (!normalized) continue;
    bySetor.set(normalizarChave(normalized.setor), normalized);
  }
  return [...bySetor.values()].sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR"));
}

function normalizeVinculacao(raw: unknown): OrganogramaVinculacao | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const setor = String(o.setor ?? "").trim();
  if (!setor) return null;
  const diretoriaRaw = String(o.diretoriaId ?? "").trim();
  const diretoriaId = ORGANOGRAMA_DIRETORIAS.some((d) => d.id === diretoriaRaw)
    ? (diretoriaRaw as OrganogramaDiretoriaId)
    : "";
  const liderNomeBruto = String(o.liderNome ?? o.lider ?? "").trim();
  const liderNome = normalizarLiderExibido(liderNomeBruto || LIDER_A_DEFINIR);
  const liderMatricula =
    liderNome === LIDER_A_DEFINIR ? undefined : String(o.liderMatricula ?? "").trim() || undefined;
  const cargo = liderNome === LIDER_A_DEFINIR ? undefined : String(o.cargo ?? "").trim() || undefined;
  const area = String(o.area ?? "").trim();
  return { setor, area, diretoriaId, liderNome, liderMatricula, cargo };
}

export function stringifyOrganogramaVinculacoes(items: OrganogramaVinculacao[]): string {
  const payload: OrganogramaVinculacoesPayload = {
    version: 1,
    items: parseOrganogramaVinculacoes(items),
  };
  return JSON.stringify(payload);
}

export function mergeVinculacoesComSetores(
  setores: Array<{ setor: string; area: string }>,
  salvos: OrganogramaVinculacao[],
  seed = ORGANOGRAMA_VINCULACOES_SEED,
): OrganogramaVinculacao[] {
  const salvosMap = new Map(salvos.map((item) => [normalizarChave(item.setor), item]));
  const seedMap = new Map(seed.map((item) => [normalizarChave(item.setor), item]));
  const merged: OrganogramaVinculacao[] = [];

  for (const row of setores) {
    const key = normalizarChave(row.setor);
    const fromSaved = salvosMap.get(key);
    const fromSeed = seedMap.get(key);
    if (fromSaved) {
      merged.push({
        ...fromSaved,
        setor: row.setor,
        area: fromSaved.area || row.area || fromSeed?.area || "",
      });
      continue;
    }
    if (fromSeed) {
      merged.push({
        ...fromSeed,
        setor: row.setor,
        area: row.area || fromSeed.area,
        liderNome: normalizarLiderExibido(fromSeed.liderNome),
      });
      continue;
    }
    merged.push({
      setor: row.setor,
      area: row.area,
      diretoriaId: "",
      liderNome: LIDER_A_DEFINIR,
    });
  }

  return merged.sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR"));
}

export function buildDiretoriasTree(items: OrganogramaVinculacao[]): DiretoriaTree[] {
  return ORGANOGRAMA_DIRETORIAS.map((diretoria) => {
    const setoresDaDiretoria = items.filter((item) => item.diretoriaId === diretoria.id);
    const areasMap = new Map<string, SetorOrganizacional[]>();
    for (const item of setoresDaDiretoria) {
      const areaNome = item.area.trim() || "Sem área";
      const list = areasMap.get(areaNome) ?? [];
      list.push({
        nome: item.setor,
        lider: normalizarLiderExibido(item.liderNome),
        cargo: item.cargo,
        matricula: item.liderMatricula,
      });
      areasMap.set(areaNome, list);
    }
    const areas: AreaOrganizacional[] = [...areasMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
      .map(([nome, setores]) => ({
        nome,
        setores: setores.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      }));
    return {
      id: diretoria.id,
      nome: diretoria.nome,
      diretor: diretoria.diretor,
      fotoKey: diretoria.fotoKey,
      areas,
    };
  });
}
