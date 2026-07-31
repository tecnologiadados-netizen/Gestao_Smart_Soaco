/**
 * Organograma alinhado ao esboço Miro:
 * Diretoria → áreas → colaboradores de gestão → liderados.
 */

import {
  ORGANICO_EMPRESA_SO_ACO,
  resolveEmpresaFromOrganicoCells,
} from "@rh/lib/organico-empresa";
import {
  normalizarChave,
  type DiretoriaTree,
  type OrganogramaDiretoriaId,
} from "@rh/lib/organograma-vinculacoes";
import {
  ORGANICO_IDX,
  getStatusFromRow,
  isOrganicoHistoricoLocal,
} from "@rh/pages/Organico/organico-derive";
import type { OrganicoRow } from "@rh/types/api";

const STATUS_VALIDOS = new Set(["Ativo", "Férias", "Afastado"]);

export type HierarquiaPessoa = {
  id: string;
  nome: string;
  matricula: string;
  cargo: string;
  status: string;
  setor: string;
  area: string;
  gestorImediato: string;
};

export type HierarquiaNo =
  | {
      kind: "pessoa";
      id: string;
      pessoa: HierarquiaPessoa;
      filhos: HierarquiaNo[];
    }
  | {
      kind: "grupo";
      id: string;
      label: string;
      /** Contagem opcional (ex.: pessoas no setor), sem listar todas. */
      qtd?: number;
      filhos: HierarquiaNo[];
    };

export type HierarquiaNivel = {
  id: string;
  label: string;
  pessoas: HierarquiaPessoa[];
};

export type HierarquiaDiretoriaNode = {
  id: OrganogramaDiretoriaId;
  nome: string;
  diretor: string;
  fotoKey: string;
  /** Áreas → colaboradores de gestão → liderados. */
  ancoras: HierarquiaNo[];
  niveis: HierarquiaNivel[];
  outros: HierarquiaPessoa[];
  qtdPessoas: number;
};

function cell(values: unknown[], index: number): string {
  return values[index] != null ? String(values[index]).trim() : "";
}

function empresaDaLinha(values: unknown[]): string {
  return resolveEmpresaFromOrganicoCells({
    setor: cell(values, ORGANICO_IDX.SETOR),
    area: cell(values, ORGANICO_IDX.AREA),
    diretoria: cell(values, ORGANICO_IDX.DIRETORIA),
    historicoLocal: isOrganicoHistoricoLocal(values),
  });
}

function cargoN(c: string): string {
  return normalizarChave(c);
}

function setorN(s: string): string {
  return normalizarChave(s);
}

function nomeKey(valor: string): string {
  return normalizarChave(valor)
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function temSup(c: string): boolean {
  return c.includes("supervisor") || c.includes("supervisao") || /(^|\s)sup(\.|\s|$)/.test(c);
}

function sortPessoas(a: HierarquiaPessoa, b: HierarquiaPessoa): number {
  const byCargo = a.cargo.localeCompare(b.cargo, "pt-BR");
  return byCargo !== 0 ? byCargo : a.nome.localeCompare(b.nome, "pt-BR");
}

function parsePessoas(organicoRows: OrganicoRow[]): HierarquiaPessoa[] {
  const byId = new Map<string, HierarquiaPessoa>();
  for (const row of organicoRows) {
    const values = Array.isArray(row.values) ? row.values : [];
    if (!STATUS_VALIDOS.has(getStatusFromRow(values))) continue;
    if (empresaDaLinha(values) !== ORGANICO_EMPRESA_SO_ACO) continue;
    const nome = cell(values, ORGANICO_IDX.NOME);
    if (!nome) continue;
    const matricula = cell(values, ORGANICO_IDX.MATRICULA) || String(row.id ?? "").trim();
    const id = matricula || `nome:${normalizarChave(nome)}`;
    byId.set(id, {
      id,
      nome,
      matricula,
      cargo: cell(values, ORGANICO_IDX.CARGO) || "—",
      status: getStatusFromRow(values),
      setor: cell(values, ORGANICO_IDX.SETOR) || "—",
      area: cell(values, ORGANICO_IDX.AREA) || "",
      gestorImediato: cell(values, ORGANICO_IDX.GESTOR_IMEDIATO),
    });
  }
  return [...byId.values()];
}

function setorKeysDaDiretoria(diretoria: DiretoriaTree): Set<string> {
  return new Set(diretoria.areas.flatMap((a) => a.setores.map((s) => normalizarChave(s.nome))));
}

function membrosDiretoria(
  todos: HierarquiaPessoa[],
  diretoria: DiretoriaTree,
): HierarquiaPessoa[] {
  const setorKeys = setorKeysDaDiretoria(diretoria);
  const diretorKey = nomeKey(diretoria.diretor);
  return todos.filter((p) => {
    if (nomeKey(p.nome) === diretorKey) return false;
    if (p.setor && setorKeys.has(normalizarChave(p.setor))) return true;
    if (diretorKey && nomeKey(p.gestorImediato) === diretorKey) return true;
    return false;
  });
}

function noPessoa(
  pessoa: HierarquiaPessoa,
  filhos: HierarquiaNo[] = [],
  id = `p:${pessoa.id}`,
): HierarquiaNo {
  return { kind: "pessoa", id, pessoa, filhos };
}

function noGrupo(id: string, label: string, filhos: HierarquiaNo[] = [], qtd?: number): HierarquiaNo {
  return { kind: "grupo", id, label, qtd, filhos };
}

/** Card de área (entre diretoria e colaboradores de gestão). */
function noArea(slug: string, label: string, filhos: HierarquiaNo[]): HierarquiaNo {
  if (filhos.length === 0) {
    return noGrupo(`area:${slug}`, label, []);
  }
  return noGrupo(`area:${slug}`, label, filhos);
}

export function isNoArea(no: HierarquiaNo): boolean {
  return no.kind === "grupo" && no.id.startsWith("area:");
}

function takeFirst(list: HierarquiaPessoa[], pred: (p: HierarquiaPessoa) => boolean): HierarquiaPessoa | null {
  return list.find(pred) ?? null;
}

function takeAll(list: HierarquiaPessoa[], pred: (p: HierarquiaPessoa) => boolean): HierarquiaPessoa[] {
  return list.filter(pred).sort(sortPessoas);
}

function contarSetor(membros: HierarquiaPessoa[], pred: (p: HierarquiaPessoa) => boolean): number {
  return membros.filter(pred).length;
}

function isManutencao(p: HierarquiaPessoa): boolean {
  return setorN(p.setor).includes("manutenc");
}

function isTransporte(p: HierarquiaPessoa): boolean {
  const s = setorN(p.setor);
  return s.includes("transporte") || s.includes("logistic");
}

function isPortaria(p: HierarquiaPessoa): boolean {
  const c = cargoN(p.cargo);
  const s = setorN(p.setor);
  return (
    s.includes("portaria") ||
    c.includes("porteiro") ||
    c.includes("agente de portaria") ||
    c.includes("vigia")
  );
}

function isRecepcao(p: HierarquiaPessoa): boolean {
  const c = cargoN(p.cargo);
  const s = setorN(p.setor);
  return c.includes("recepcion") || s.includes("recepcao");
}

function isCobranca(p: HierarquiaPessoa): boolean {
  const c = cargoN(p.cargo);
  const s = setorN(p.setor);
  return c.includes("cobranca") || s.includes("cobranca");
}

function isServicosGerais(p: HierarquiaPessoa): boolean {
  const c = cargoN(p.cargo);
  const s = setorN(p.setor);
  return c.includes("servicos gerais") || s.includes("servicos gerais");
}

function isAuxAdminFinanceiro(p: HierarquiaPessoa): boolean {
  const c = cargoN(p.cargo);
  const s = setorN(p.setor);
  return (
    s.includes("financeiro") &&
    (c.includes("auxiliar") || c.includes("aux.")) &&
    c.includes("administrativo")
  );
}

function subordinadosDe(gestor: HierarquiaPessoa, universo: HierarquiaPessoa[]): HierarquiaPessoa[] {
  const g = nomeKey(gestor.nome);
  if (!g) return [];
  return universo.filter((p) => p.id !== gestor.id && nomeKey(p.gestorImediato) === g);
}

/** Liderados diretos (pessoas) — exclusão de outras âncoras N.1. */
function ramoLiderados(
  gestor: HierarquiaPessoa,
  universo: HierarquiaPessoa[],
  excludeIds: Set<string>,
): HierarquiaNo[] {
  const list = subordinadosDe(gestor, universo)
    .filter((p) => !excludeIds.has(p.id))
    .sort(sortPessoas);
  for (const p of list) excludeIds.add(p.id);
  return list.map((p) => noPessoa(p));
}

/** Miro — Diretoria Comercial / Presidência. */
function buildAncorasComercial(
  membros: HierarquiaPessoa[],
  universo: HierarquiaPessoa[],
): HierarquiaNo[] {
  const areas: HierarquiaNo[] = [];
  const used = new Set<string>();

  const gerente = takeFirst(
    membros,
    (p) =>
      cargoN(p.cargo).includes("gerente") &&
      cargoN(p.cargo).includes("comercial") &&
      !cargoN(p.cargo).includes("loja"),
  );
  if (gerente) {
    used.add(gerente.id);
    areas.push(noArea("vendas", "Vendas", [noPessoa(gerente, ramoLiderados(gerente, universo, used))]));
  }

  // Supervisor de produção = Maucídio → Manutenção + Transporte.
  const maucidio = takeFirst(universo, (p) => nomeKey(p.nome).includes("maucidio"));
  const qManut = contarSetor(membros, isManutencao);
  const qTransp = contarSetor(membros, isTransporte);
  if (maucidio || qManut > 0 || qTransp > 0) {
    const filhos: HierarquiaNo[] = [];
    if (qManut > 0) {
      filhos.push(noGrupo("manut-com", "Manutenção facilities / oficina", [], qManut));
    }
    if (qTransp > 0) {
      filhos.push(noGrupo("transp-com", "Transporte / Logística", [], qTransp));
    }
    const gestao = maucidio
      ? noPessoa(maucidio, filhos, `p:${maucidio.id}:com`)
      : noGrupo("sup-prod-com", "Supervisor de produção", filhos);
    areas.push(noArea("manutencao", "Manutenção", [gestao]));
  }

  const compras = takeFirst(
    membros,
    (p) => !used.has(p.id) && setorN(p.setor).includes("compra") && temSup(cargoN(p.cargo)),
  );
  if (compras) {
    used.add(compras.id);
    const porSetor = takeAll(
      membros,
      (p) => !used.has(p.id) && setorN(p.setor).includes("compra"),
    ).map((p) => {
      used.add(p.id);
      return noPessoa(p);
    });
    const porGestor = ramoLiderados(compras, universo, used);
    areas.push(noArea("compras", "Compras", [noPessoa(compras, [...porSetor, ...porGestor])]));
  }

  const anaLuciaCom =
    takeFirst(
      universo,
      (p) =>
        nomeKey(p.nome).includes("ana lucia") &&
        (cargoN(p.cargo).includes("sub-gerente") ||
          cargoN(p.cargo).includes("sub gerente") ||
          cargoN(p.cargo).includes("sub. gere")) &&
        !setorN(p.setor).includes("loja"),
    ) ??
    takeFirst(membros, (p) => {
      if (used.has(p.id)) return false;
      const c = cargoN(p.cargo);
      return (
        (c.includes("sub-gerente") || c.includes("sub gerente") || c.includes("sub. gere")) &&
        !setorN(p.setor).includes("loja")
      );
    });

  if (anaLuciaCom) {
    const porteiros = takeAll(membros, (p) => !used.has(p.id) && isPortaria(p));
    for (const p of porteiros) used.add(p.id);
    areas.push(
      noArea("administrativo", "Administrativo", [
        noPessoa(anaLuciaCom, porteiros.map((p) => noPessoa(p)), `p:${anaLuciaCom.id}:com`),
      ]),
    );
  } else {
    const porteiros = takeAll(membros, (p) => !used.has(p.id) && isPortaria(p));
    if (porteiros.length > 0) {
      for (const p of porteiros) used.add(p.id);
      areas.push(
        noArea("administrativo", "Administrativo", [
          noGrupo(
            "portaria-com",
            "Portaria",
            porteiros.map((p) => noPessoa(p)),
          ),
        ]),
      );
    }
  }

  return areas;
}

/** Miro — Diretoria de Operações. */
function buildAncorasOperacao(
  membros: HierarquiaPessoa[],
  universo: HierarquiaPessoa[],
): HierarquiaNo[] {
  const areas: HierarquiaNo[] = [];
  const used = new Set<string>();

  const supProducao = takeAll(membros, (p) => {
    const c = cargoN(p.cargo);
    return temSup(c) && (c.includes("produc") || c.includes("area"));
  }).sort((a, b) => {
    const aDir = nomeKey(a.gestorImediato).includes("marques") ? 0 : 1;
    const bDir = nomeKey(b.gestorImediato).includes("marques") ? 0 : 1;
    if (aDir !== bDir) return aDir - bDir;
    return sortPessoas(a, b);
  });
  for (const p of supProducao) used.add(p.id);
  if (supProducao.length > 0) {
    areas.push(
      noArea(
        "producao",
        "Produção",
        supProducao.map((p) => noPessoa(p, ramoLiderados(p, universo, used))),
      ),
    );
  }

  const eng = takeFirst(membros, (p) => {
    if (used.has(p.id)) return false;
    const c = cargoN(p.cargo);
    return temSup(c) && (c.includes("projeto") || c.includes("engenharia"));
  });
  if (eng) {
    used.add(eng.id);
    areas.push(noArea("engenharia", "Engenharia", [noPessoa(eng, ramoLiderados(eng, universo, used))]));
  }

  const pcp = takeFirst(membros, (p) => {
    if (used.has(p.id)) return false;
    const c = cargoN(p.cargo);
    return c.includes("analista") && c.includes("pcp") && c.includes("iii");
  });
  if (pcp) {
    used.add(pcp.id);
    areas.push(noArea("pcp", "PCP", [noPessoa(pcp, ramoLiderados(pcp, universo, used))]));
  }

  const dados = takeFirst(membros, (p) => {
    if (used.has(p.id)) return false;
    const c = cargoN(p.cargo);
    return c.includes("analista") && c.includes("dados") && c.includes("processo");
  });
  if (dados) {
    used.add(dados.id);
    areas.push(
      noArea("dados-e-processos", "Dados e processos", [
        noPessoa(dados, ramoLiderados(dados, universo, used)),
      ]),
    );
  }

  const ti = takeFirst(membros, (p) => {
    if (used.has(p.id)) return false;
    const c = cargoN(p.cargo);
    const s = setorN(p.setor);
    return (
      s.includes("t.i") ||
      s.startsWith("ti") ||
      c.includes("analista de suporte") ||
      (c.includes("analista") && (c.includes("ti") || c.includes("sistemas")))
    );
  });
  if (ti) {
    used.add(ti.id);
    areas.push(noArea("ti", "T.I", [noPessoa(ti, ramoLiderados(ti, universo, used))]));
  }

  const isSesmt = (p: HierarquiaPessoa) => {
    const c = cargoN(p.cargo);
    const s = setorN(p.setor);
    return (
      s.includes("sesmt") ||
      c.includes("seg. trabalho") ||
      c.includes("seguranca do trabalho") ||
      (c.includes("tec") && c.includes("seg") && c.includes("trabalho"))
    );
  };
  const sesmtPessoas = takeAll(membros, (p) => !used.has(p.id) && isSesmt(p));
  if (sesmtPessoas.length > 0) {
    const lider =
      takeFirst(sesmtPessoas, (p) => {
        const c = cargoN(p.cargo);
        return c.includes("tec") && c.includes("seg");
      }) ?? sesmtPessoas[0];
    for (const p of sesmtPessoas) used.add(p.id);
    const colegas = sesmtPessoas.filter((p) => p.id !== lider.id).map((p) => noPessoa(p));
    areas.push(
      noArea("sesmt", "SESMT", [
        noPessoa(lider, [...colegas, ...ramoLiderados(lider, universo, used)]),
      ]),
    );
  }

  return areas;
}

/** Miro — Diretoria Financeira. */
function buildAncorasFinanceira(
  membros: HierarquiaPessoa[],
  universo: HierarquiaPessoa[],
): HierarquiaNo[] {
  const areas: HierarquiaNo[] = [];
  const used = new Set<string>();

  const rh = takeFirst(membros, (p) => {
    const c = cargoN(p.cargo);
    return (
      c.includes("analista") &&
      (c.includes("rh") || c.includes("recursos humanos") || c.includes("humano"))
    );
  });
  if (rh) {
    used.add(rh.id);
    const filhos: HierarquiaNo[] = [];
    for (const p of takeAll(membros, (x) => !used.has(x.id) && isRecepcao(x))) {
      used.add(p.id);
      filhos.push(noPessoa(p));
    }
    for (const p of takeAll(membros, (x) => !used.has(x.id) && isCobranca(x))) {
      used.add(p.id);
      filhos.push(noPessoa(p));
    }
    areas.push(noArea("rh", "RH", [noPessoa(rh, filhos)]));
  }

  const fin = takeFirst(membros, (p) => {
    if (used.has(p.id)) return false;
    const c = cargoN(p.cargo);
    return c.includes("assistente") && c.includes("financeiro");
  });
  if (fin) {
    used.add(fin.id);
    const filhos = takeAll(membros, (x) => !used.has(x.id) && isAuxAdminFinanceiro(x)).map((p) => {
      used.add(p.id);
      return noPessoa(p);
    });
    areas.push(noArea("financeiro", "Financeiro", [noPessoa(fin, filhos)]));
  }

  const sub =
    takeFirst(
      universo,
      (p) =>
        !used.has(p.id) &&
        nomeKey(p.nome).includes("ana lucia") &&
        (cargoN(p.cargo).includes("sub-gerente") ||
          cargoN(p.cargo).includes("sub gerente") ||
          cargoN(p.cargo).includes("sub. gere")),
    ) ??
    takeFirst(membros, (p) => {
      if (used.has(p.id)) return false;
      const c = cargoN(p.cargo);
      return c.includes("sub-gerente") || c.includes("sub gerente") || c.includes("sub. gere");
    });

  const servGerais = takeAll(membros, (x) => !used.has(x.id) && isServicosGerais(x));
  for (const p of servGerais) used.add(p.id);

  if (sub) {
    used.add(sub.id);
    const outros = ramoLiderados(sub, universo, used).filter(
      (no) => no.kind === "pessoa" && !isServicosGerais(no.pessoa) && !isPortaria(no.pessoa),
    );
    areas.push(
      noArea("servicos-gerais", "Faturamento", [
        noPessoa(sub, [...servGerais.map((p) => noPessoa(p)), ...outros], `p:${sub.id}:fin`),
      ]),
    );
  } else if (servGerais.length > 0) {
    areas.push(
      noArea("servicos-gerais", "Faturamento", [
        noGrupo(
          "sub-ger-fin",
          "Sub-gerente",
          servGerais.map((p) => noPessoa(p)),
        ),
      ]),
    );
  }

  return areas;
}

function contarNos(nos: HierarquiaNo[]): number {
  let n = 0;
  for (const no of nos) {
    if (no.kind === "pessoa") n += 1;
    n += contarNos(no.filhos);
  }
  return n;
}

export function buildHierarquiaDiretorias(
  diretorias: DiretoriaTree[],
  organicoRows: OrganicoRow[],
): HierarquiaDiretoriaNode[] {
  const todos = parsePessoas(organicoRows);

  return diretorias.map((diretoria) => {
    const membros = membrosDiretoria(todos, diretoria);
    let ancoras: HierarquiaNo[] = [];
    if (diretoria.id === "presidencia") ancoras = buildAncorasComercial(membros, todos);
    else if (diretoria.id === "operacao") ancoras = buildAncorasOperacao(membros, todos);
    else if (diretoria.id === "financeira") ancoras = buildAncorasFinanceira(membros, todos);

    return {
      id: diretoria.id,
      nome: diretoria.nome,
      diretor: diretoria.diretor,
      fotoKey: diretoria.fotoKey,
      ancoras,
      niveis: [],
      outros: [],
      qtdPessoas: contarNos(ancoras),
    };
  });
}

export function flattenHierarquiaPessoas(node: HierarquiaDiretoriaNode): HierarquiaPessoa[] {
  const out: HierarquiaPessoa[] = [];
  const walk = (nos: HierarquiaNo[]) => {
    for (const no of nos) {
      if (no.kind === "pessoa") out.push(no.pessoa);
      walk(no.filhos);
    }
  };
  walk(node.ancoras);
  return out;
}
