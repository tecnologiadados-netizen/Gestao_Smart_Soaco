import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@rh/components/ui/dialog";
import {
  ORGANICO_EMPRESA_SO_ACO,
  resolveEmpresaFromOrganicoCells,
} from "@rh/lib/organico-empresa";
import {
  LIDER_A_DEFINIR,
  normalizarChave,
  type SetorOrganizacional,
} from "@rh/lib/organograma-vinculacoes";
import { cn } from "@rh/lib/utils";
import {
  ORGANICO_IDX,
  getStatusFromRow,
  isOrganicoHistoricoLocal,
} from "@rh/pages/Organico/organico-derive";
import { useOrganicoCardFoto } from "@rh/pages/Organico/useOrganicoCardFoto";
import type { OrganicoRow } from "@rh/types/api";

const STATUS_VALIDOS = new Set(["Ativo", "Férias", "Afastado"]);

export type SetorSelecionadoMapa = {
  setor: SetorOrganizacional;
  area: string;
};

export type MembroSetorOrganograma = {
  matricula: string;
  nome: string;
  cargo: string;
  status: string;
  eLider: boolean;
};

function cell(values: unknown[], index: number): string {
  return values[index] != null ? String(values[index]).trim() : "";
}

function iniciais(nome: string): string {
  const partes = nome
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toLocaleUpperCase("pt-BR");
  return `${partes[0][0] ?? ""}${partes[partes.length - 1][0] ?? ""}`.toLocaleUpperCase("pt-BR");
}

function empresaDaLinhaOrganico(values: unknown[]): string {
  return resolveEmpresaFromOrganicoCells({
    setor: cell(values, ORGANICO_IDX.SETOR),
    area: cell(values, ORGANICO_IDX.AREA),
    diretoria: cell(values, ORGANICO_IDX.DIRETORIA),
    historicoLocal: isOrganicoHistoricoLocal(values),
  });
}

/** Contagem de colaboradores da Só Aço Industrial por setor (chave normalizada). */
export function contarColaboradoresPorSetorSoAco(
  organicoRows: OrganicoRow[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of organicoRows) {
    const values = Array.isArray(row.values) ? row.values : [];
    if (!STATUS_VALIDOS.has(getStatusFromRow(values))) continue;
    if (empresaDaLinhaOrganico(values) !== ORGANICO_EMPRESA_SO_ACO) continue;
    const setor = cell(values, ORGANICO_IDX.SETOR);
    if (!setor) continue;
    const key = normalizarChave(setor);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Colaboradores ativos do setor na Só Aço Industrial, com líder da vinculação no topo. */
export function listarMembrosDoSetor(
  organicoRows: OrganicoRow[],
  setorNome: string,
  lider: { nome: string; matricula?: string },
): MembroSetorOrganograma[] {
  const setorKey = normalizarChave(setorNome);
  const liderMatKey = lider.matricula ? normalizarChave(lider.matricula) : "";
  const liderNomeKey =
    lider.nome && normalizarChave(lider.nome) !== normalizarChave(LIDER_A_DEFINIR)
      ? normalizarChave(lider.nome)
      : "";

  const membros: MembroSetorOrganograma[] = [];
  for (const row of organicoRows) {
    const values = Array.isArray(row.values) ? row.values : [];
    if (!STATUS_VALIDOS.has(getStatusFromRow(values))) continue;
    if (empresaDaLinhaOrganico(values) !== ORGANICO_EMPRESA_SO_ACO) continue;
    if (normalizarChave(cell(values, ORGANICO_IDX.SETOR)) !== setorKey) continue;
    const matricula = cell(values, ORGANICO_IDX.MATRICULA) || String(row.id ?? "").trim();
    const nome = cell(values, ORGANICO_IDX.NOME);
    if (!nome) continue;
    const eLider =
      (liderMatKey !== "" && normalizarChave(matricula) === liderMatKey) ||
      (liderNomeKey !== "" && normalizarChave(nome) === liderNomeKey);
    membros.push({
      matricula,
      nome,
      cargo: cell(values, ORGANICO_IDX.CARGO) || "—",
      status: getStatusFromRow(values),
      eLider,
    });
  }

  membros.sort((a, b) => {
    if (a.eLider !== b.eLider) return a.eLider ? -1 : 1;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
  return membros;
}

const statusColors: Record<string, string> = {
  Ativo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  Férias: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Afastado: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

function MembroAvatar({
  membro,
  fotoDisponivel,
  podeBuscarFoto,
  destaque = false,
}: {
  membro: MembroSetorOrganograma;
  fotoDisponivel: boolean;
  podeBuscarFoto: boolean;
  destaque?: boolean;
}) {
  const { rootRef, fotoSrc, isLoading } = useOrganicoCardFoto({
    matricula: membro.matricula,
    nome: membro.nome,
    fotoDisponivel,
    podeBuscar: podeBuscarFoto,
  });

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-bold text-muted-foreground ring-2 ring-card",
        destaque ? "h-16 w-16 text-base" : "h-11 w-11 text-xs",
        membro.eLider && "ring-soaco-gold",
      )}
    >
      {fotoSrc ? (
        <img src={fotoSrc} alt={`Foto de ${membro.nome}`} className="h-full w-full object-cover" />
      ) : isLoading && fotoDisponivel ? (
        <span className="text-[10px] font-medium text-muted-foreground">…</span>
      ) : (
        iniciais(membro.nome)
      )}
    </div>
  );
}

function MembroLinha({
  membro,
  fotoDisponivel,
  podeBuscarFoto,
}: {
  membro: MembroSetorOrganograma;
  fotoDisponivel: boolean;
  podeBuscarFoto: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5",
        membro.eLider
          ? "border-soaco-gold/50 bg-amber-50/80 dark:border-soaco-gold/40 dark:bg-amber-950/30"
          : "border-border bg-card",
      )}
    >
      <MembroAvatar
        membro={membro}
        fotoDisponivel={fotoDisponivel}
        podeBuscarFoto={podeBuscarFoto}
        destaque={membro.eLider}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={cn(
              "truncate font-semibold text-foreground",
              membro.eLider ? "text-sm" : "text-[13px]",
            )}
          >
            {membro.nome}
          </p>
          {membro.eLider && (
            <span className="rounded-full bg-soaco-gold px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-soaco-navy">
              Líder
            </span>
          )}
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              statusColors[membro.status] ?? "bg-muted text-muted-foreground",
            )}
          >
            {membro.status}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{membro.cargo}</p>
        {membro.matricula ? (
          <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground/80">
            Mat. {membro.matricula}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function OrganogramaSetorMembrosDialog({
  open,
  onOpenChange,
  selecionado,
  organicoRows,
  matriculasComFoto,
  podeBuscarFotos,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selecionado: SetorSelecionadoMapa | null;
  organicoRows: OrganicoRow[];
  matriculasComFoto: Set<string>;
  podeBuscarFotos: boolean;
}) {
  const membros = useMemo(() => {
    if (!selecionado) return [];
    return listarMembrosDoSetor(organicoRows, selecionado.setor.nome, {
      nome: selecionado.setor.lider,
      matricula: selecionado.setor.matricula,
    });
  }, [organicoRows, selecionado]);

  const liderDefinido =
    selecionado &&
    selecionado.setor.lider &&
    normalizarChave(selecionado.setor.lider) !== normalizarChave(LIDER_A_DEFINIR);

  const liderNaLista = membros.some((m) => m.eLider);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] w-[min(96vw,520px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-5 py-4 text-left">
          <DialogTitle className="text-base">
            {selecionado?.setor.nome ?? "Setor"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {selecionado?.area ? `${selecionado.area} · ` : ""}
            {membros.length} colaborador{membros.length === 1 ? "" : "es"} na Só Aço Industrial
            {liderDefinido && !liderNaLista
              ? ` · líder cadastrado: ${selecionado?.setor.lider} (não encontrado neste setor)`
              : !liderDefinido
                ? " · líder a definir"
                : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {membros.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum colaborador ativo encontrado neste setor no Orgânico.
            </p>
          ) : (
            <ul className="space-y-2">
              {membros.map((membro) => (
                <MembroLinha
                  key={`${membro.matricula}-${membro.nome}`}
                  membro={membro}
                  fotoDisponivel={Boolean(
                    membro.matricula && matriculasComFoto.has(membro.matricula),
                  )}
                  podeBuscarFoto={podeBuscarFotos}
                />
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
