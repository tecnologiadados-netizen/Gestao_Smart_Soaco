/**
 * Hierarquia por diretoria com níveis narrados (patamares mistos por área).
 * Ex.: analista de PCP no mesmo N.1 que supervisores de produção.
 * Setores só delimitam quem entra em cada coluna de diretoria.
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

export type NivelHierarquiaId = string;

export type HierarquiaPessoa = {
  id: string;
  nome: string;
  matricula: string;
  cargo: string;
  status: string;
  setor: string;
  nivelId: NivelHierarquiaId;
};

export type HierarquiaNivelGrupo = {
  id: NivelHierarquiaId;
  label: string;
  pessoas: HierarquiaPessoa[];
};

export type HierarquiaDiretoriaNode = {
  id: OrganogramaDiretoriaId;
  nome: string;
  diretor: string;
  fotoKey: string;
  niveis: HierarquiaNivelGrupo[];
  qtdPessoas: number;
};

type PessoaCtx = { cargo: string; setor: string };

type NivelRegra = {
  id: string;
  label: string;
  /** Se omitido, é o catch-all (demais) — deve ser o último da lista. */
  match?: (p: PessoaCtx) => boolean;
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

function cargoNorm(cargo: string): string {
  return normalizarChave(cargo);
}

function setorNorm(setor: string): string {
  return normalizarChave(setor);
}

function temSupNoCargo(c: string): boolean {
  return (
    c.includes("supervisor") ||
    c.includes("supervisao") ||
    /(^|\s)sup(\.|\s|$)/.test(c)
  );
}

function isLiderOuChefe(c: string): boolean {
  return c.includes("lider") || c.includes("chefe");
}

function isSubGerente(c: string): boolean {
  return (
    c.includes("sub-gerente") ||
    c.includes("sub gerente") ||
    c.includes("sub. gere") ||
    c.includes("sub gere")
  );
}

function isGerenteComercial(c: string): boolean {
  return c.includes("gerente") && c.includes("comercial");
}

function isAnalistaRh(c: string): boolean {
  return (
    c.includes("analista") &&
    (c.includes("rh") || c.includes("recursos humanos") || c.includes("humano"))
  );
}

function isAssisFinanceiro(c: string): boolean {
  return (
    (c.includes("assistente") || c.includes("assis")) &&
    (c.includes("financeiro") || c.includes("cobranca"))
  );
}

function isRecepcao(p: PessoaCtx): boolean {
  const c = cargoNorm(p.cargo);
  const s = setorNorm(p.setor);
  return c.includes("recepcion") || s.includes("recepcao");
}

/** N.1 Operação: supervisão + staff (PCP, TI, dados, engenharia, qualidade). */
function matchOperacaoN1(p: PessoaCtx): boolean {
  const c = cargoNorm(p.cargo);
  const s = setorNorm(p.setor);

  if (c.includes("analista") && c.includes("pcp")) return true;
  if (c.includes("analista") && (c.includes("dados") || c.includes("processo"))) return true;
  if (
    s.includes("t.i") ||
    s.startsWith("ti ") ||
    s === "ti" ||
    c.includes("analista de suporte") ||
    (c.includes("analista") && (c.includes("ti") || c.includes("sistemas") || c.includes("infra")))
  ) {
    return true;
  }
  if (c.includes("assistente") && c.includes("qualidade")) return true;

  if (temSupNoCargo(c)) {
    // Supervisores de produção / área / solda / refrigeração + engenharia/projetos + qualidade
    if (
      c.includes("produc") ||
      c.includes("area") ||
      c.includes("solda") ||
      c.includes("pintura") ||
      c.includes("refriger") ||
      c.includes("projeto") ||
      c.includes("engenharia") ||
      c.includes("qualidade")
    ) {
      return true;
    }
  }
  return false;
}

function matchOperacaoN2(p: PessoaCtx): boolean {
  const c = cargoNorm(p.cargo);
  return isLiderOuChefe(c);
}

function matchOperacaoN3(p: PessoaCtx): boolean {
  const c = cargoNorm(p.cargo);
  return (
    c.includes("tecnico") ||
    c.includes("tec.") ||
    c.includes("especialista") ||
    c.includes("seg. trabalho") ||
    c.includes("seguranca do trabalho")
  );
}

function matchOperacaoN4(p: PessoaCtx): boolean {
  const c = cargoNorm(p.cargo);
  return (
    c.includes("operador") ||
    c.includes("montador") ||
    c.includes("soldador") ||
    c.includes("pintor") ||
    c.includes("pedreiro") ||
    c.includes("funileiro") ||
    c.includes("torneiro") ||
    c.includes("eletricit") ||
    c.includes("mecanico")
  );
}

function matchOperacaoN5(p: PessoaCtx): boolean {
  const c = cargoNorm(p.cargo);
  return (
    c.includes("auxiliar") ||
    c.includes("assistente") ||
    c.includes("almoxarife") ||
    c.includes("aprendiz")
  );
}

/** N.1 Comercial: gestão e supervisão de staff. */
function matchComercialN1(p: PessoaCtx): boolean {
  const c = cargoNorm(p.cargo);
  if (isSubGerente(c)) return true;
  if (isGerenteComercial(c)) return true;
  if (temSupNoCargo(c) && (c.includes("compra") || c.includes("compras"))) return true;
  if (temSupNoCargo(c) && (c.includes("admin") || c.includes("administrativo"))) return true;
  // Narrativa: "Sup. Produção" no N.1 comercial (se existir vínculo nessa coluna)
  if (temSupNoCargo(c) && c.includes("produc")) return true;
  if (c.includes("gerente") && !c.includes("sub")) return true;
  return false;
}

function matchFinanceiraN1(p: PessoaCtx): boolean {
  const c = cargoNorm(p.cargo);
  if (isSubGerente(c)) return true;
  if (isAnalistaRh(c)) return true;
  if (isAssisFinanceiro(c)) return true;
  return false;
}

/**
 * Níveis por diretoria (ordem = prioridade de match).
 * O último item sem `match` recebe quem sobrou ("Demais…").
 */
export const NIVEIS_POR_DIRETORIA: Record<OrganogramaDiretoriaId, NivelRegra[]> = {
  financeira: [
    {
      id: "n1",
      label: "Nível 1 — Sub-gerência, RH e financeiro",
      match: matchFinanceiraN1,
    },
    {
      id: "n2",
      label: "Nível 2 — Recepção (RH)",
      match: isRecepcao,
    },
    { id: "demais", label: "Demais colaboradores" },
  ],
  operacao: [
    {
      id: "n1",
      label: "Nível 1 — Supervisão e staff",
      match: matchOperacaoN1,
    },
    {
      id: "n2",
      label: "Nível 2 — Lideranças e chefias",
      match: matchOperacaoN2,
    },
    {
      id: "n3",
      label: "Nível 3 — Técnicos",
      match: matchOperacaoN3,
    },
    {
      id: "n4",
      label: "Nível 4 — Operacional",
      match: matchOperacaoN4,
    },
    {
      id: "n5",
      label: "Nível 5 — Apoio / Auxiliares",
      match: matchOperacaoN5,
    },
    { id: "demais", label: "Demais colaboradores" },
  ],
  presidencia: [
    {
      id: "n1",
      label: "Nível 1 — Gestão e supervisão",
      match: matchComercialN1,
    },
    { id: "demais", label: "Demais colaboradores" },
  ],
};

export function classificarNivelDiretoria(
  diretoriaId: OrganogramaDiretoriaId,
  pessoa: PessoaCtx,
): { id: string; label: string } {
  const regras = NIVEIS_POR_DIRETORIA[diretoriaId] ?? NIVEIS_POR_DIRETORIA.presidencia;
  for (const regra of regras) {
    if (!regra.match) return { id: regra.id, label: regra.label };
    if (regra.match(pessoa)) return { id: regra.id, label: regra.label };
  }
  const last = regras[regras.length - 1];
  return { id: last?.id ?? "demais", label: last?.label ?? "Demais colaboradores" };
}

/** @deprecated Preferir classificarNivelDiretoria — mantido só se algum import antigo existir. */
export function classificarNivelCargo(cargo: string): NivelHierarquiaId {
  return classificarNivelDiretoria("operacao", { cargo, setor: "" }).id;
}

function coletarPessoasDiretoria(
  diretoria: DiretoriaTree,
  organicoRows: OrganicoRow[],
): HierarquiaPessoa[] {
  const setorKeys = new Set(
    diretoria.areas.flatMap((a) => a.setores.map((s) => normalizarChave(s.nome))),
  );
  const diretorKey = normalizarChave(diretoria.diretor);
  const byId = new Map<string, HierarquiaPessoa>();

  for (const row of organicoRows) {
    const values = Array.isArray(row.values) ? row.values : [];
    if (!STATUS_VALIDOS.has(getStatusFromRow(values))) continue;
    if (empresaDaLinha(values) !== ORGANICO_EMPRESA_SO_ACO) continue;
    const setor = cell(values, ORGANICO_IDX.SETOR);
    const gestorKey = normalizarChave(cell(values, ORGANICO_IDX.GESTOR_IMEDIATO));
    const noSetorVinculado = Boolean(setor && setorKeys.has(normalizarChave(setor)));
    const reportaAoDiretor = Boolean(diretorKey && gestorKey === diretorKey);
    if (!noSetorVinculado && !reportaAoDiretor) continue;
    const nome = cell(values, ORGANICO_IDX.NOME);
    if (!nome) continue;
    // Diretor da coluna não entra nos níveis abaixo.
    if (normalizarChave(nome) === diretorKey) continue;
    const matricula = cell(values, ORGANICO_IDX.MATRICULA) || String(row.id ?? "").trim();
    const cargo = cell(values, ORGANICO_IDX.CARGO) || "—";
    const id = matricula || `nome:${normalizarChave(nome)}`;
    const nivel = classificarNivelDiretoria(diretoria.id, { cargo, setor: setor || "" });
    byId.set(id, {
      id,
      nome,
      matricula,
      cargo,
      status: getStatusFromRow(values),
      setor: setor || "—",
      nivelId: nivel.id,
    });
  }

  return [...byId.values()].sort((a, b) => {
    const byCargo = a.cargo.localeCompare(b.cargo, "pt-BR");
    return byCargo !== 0 ? byCargo : a.nome.localeCompare(b.nome, "pt-BR");
  });
}

export function buildHierarquiaDiretorias(
  diretorias: DiretoriaTree[],
  organicoRows: OrganicoRow[],
): HierarquiaDiretoriaNode[] {
  return diretorias.map((diretoria) => {
    const pessoas = coletarPessoasDiretoria(diretoria, organicoRows);
    const regras = NIVEIS_POR_DIRETORIA[diretoria.id] ?? [];
    const niveis: HierarquiaNivelGrupo[] = regras
      .map((nivel) => ({
        id: nivel.id,
        label: nivel.label,
        pessoas: pessoas.filter((p) => p.nivelId === nivel.id),
      }))
      .filter((g) => g.pessoas.length > 0);

    return {
      id: diretoria.id,
      nome: diretoria.nome,
      diretor: diretoria.diretor,
      fotoKey: diretoria.fotoKey,
      niveis,
      qtdPessoas: pessoas.length,
    };
  });
}
