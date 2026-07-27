import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getConfig } from "@rh/lib/api-client";
import {
  buildHierarquiaDiretorias,
  type HierarquiaDiretoriaNode,
  type HierarquiaNivelGrupo,
  type HierarquiaPessoa,
} from "@rh/lib/organograma-hierarquia";
import type { DiretoriaTree } from "@rh/lib/organograma-vinculacoes";
import { canViewOrganogramaFotos } from "@rh/lib/route-permissions";
import { cn } from "@rh/lib/utils";
import { useOrganicoCardFoto } from "@rh/pages/Organico/useOrganicoCardFoto";
import type { OrganicoRow } from "@rh/types/api";

const FOTO_EMPRESA_KEY = "organograma-foto:empresa";

function iniciais(nome: string): string {
  const partes = nome
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toLocaleUpperCase("pt-BR");
  return `${partes[0][0] ?? ""}${partes[partes.length - 1][0] ?? ""}`.toLocaleUpperCase("pt-BR");
}

function useFotoConfig(configKey?: string): string | null {
  const podeVer = canViewOrganogramaFotos();
  const { data } = useQuery({
    queryKey: ["organograma-foto-config", configKey],
    queryFn: async () => (await getConfig(configKey as string)).value,
    enabled: Boolean(configKey) && podeVer,
    staleTime: 5 * 60 * 1000,
  });
  const value = typeof data === "string" ? data.trim() : "";
  return value.startsWith("data:image/") ? value : null;
}

function AvatarPessoa({
  nome,
  matricula,
  fotoDisponivel,
  podeBuscarFoto,
  fotoConfigSrc,
  tamanho = "md",
}: {
  nome: string;
  matricula?: string;
  fotoDisponivel?: boolean;
  podeBuscarFoto?: boolean;
  fotoConfigSrc?: string | null;
  tamanho?: "sm" | "md" | "lg";
}) {
  const { rootRef, fotoSrc, isLoading } = useOrganicoCardFoto({
    matricula: matricula ?? "",
    nome,
    fotoDisponivel: Boolean(fotoDisponivel && matricula),
    podeBuscar: Boolean(podeBuscarFoto),
  });
  const src = fotoConfigSrc ?? fotoSrc;
  const size =
    tamanho === "lg" ? "h-14 w-14 text-sm" : tamanho === "sm" ? "h-8 w-8 text-[9px]" : "h-10 w-10 text-[11px]";

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-bold text-muted-foreground ring-2 ring-card",
        size,
      )}
    >
      {src ? (
        <img src={src} alt={`Foto de ${nome}`} className="h-full w-full object-cover" />
      ) : isLoading && fotoDisponivel ? (
        <span className="text-[10px]">…</span>
      ) : (
        iniciais(nome)
      )}
    </div>
  );
}

function PessoaMiniCard({
  pessoa,
  matriculasComFoto,
  podeBuscarFotos,
}: {
  pessoa: HierarquiaPessoa;
  matriculasComFoto: Set<string>;
  podeBuscarFotos: boolean;
}) {
  return (
    <div
      className="flex w-full items-center gap-2 rounded-lg border border-border/50 bg-card px-2 py-1.5 shadow-level-1"
      title={`${pessoa.cargo} · ${pessoa.setor}`}
    >
      <AvatarPessoa
        nome={pessoa.nome}
        matricula={pessoa.matricula}
        fotoDisponivel={Boolean(pessoa.matricula && matriculasComFoto.has(pessoa.matricula))}
        podeBuscarFoto={podeBuscarFotos}
        tamanho="sm"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-bold uppercase leading-tight tracking-wide text-accent-700 dark:text-accent-400">
          {pessoa.cargo}
        </p>
        <p className="truncate text-[11px] font-medium leading-tight text-foreground">{pessoa.nome}</p>
      </div>
    </div>
  );
}

function NivelBloco({
  nivel,
  matriculasComFoto,
  podeBuscarFotos,
  defaultOpen,
}: {
  nivel: HierarquiaNivelGrupo;
  matriculasComFoto: Set<string>;
  podeBuscarFotos: boolean;
  defaultOpen: boolean;
}) {
  const [aberto, setAberto] = useState(defaultOpen);

  return (
    <div className="w-full">
      <div className="flex flex-col items-center">
        <div className="h-3 w-px bg-border" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="flex w-full max-w-[280px] items-center justify-between gap-2 rounded-full border border-soaco-blue/30 bg-soaco-blue/10 px-3 py-1.5 text-left transition-colors hover:bg-soaco-blue/15"
        >
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-soaco-blue dark:text-primary-200">
            {aberto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {nivel.label}
          </span>
          <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
            {nivel.pessoas.length}
          </span>
        </button>
      </div>
      {aberto && (
        <>
          <div className="mx-auto h-3 w-px bg-border" aria-hidden="true" />
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {nivel.pessoas.map((p) => (
              <PessoaMiniCard
                key={p.id}
                pessoa={p}
                matriculasComFoto={matriculasComFoto}
                podeBuscarFotos={podeBuscarFotos}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Coluna de uma diretoria — sem “quadro” isolado; pendurada no trilho comum. */
function DiretoriaRamo({
  diretoria,
  matriculasComFoto,
  podeBuscarFotos,
  isFirst,
  isLast,
  total,
}: {
  diretoria: HierarquiaDiretoriaNode;
  matriculasComFoto: Set<string>;
  podeBuscarFotos: boolean;
  isFirst: boolean;
  isLast: boolean;
  total: number;
}) {
  const fotoDiretor = useFotoConfig(diretoria.fotoKey);

  return (
    <div className="relative flex min-w-0 flex-1 flex-col items-center pt-0">
      {/* Segmentos do trilho horizontal no mesmo nível */}
      {total > 1 && (
        <>
          {!isFirst && (
            <div
              className="pointer-events-none absolute top-0 right-1/2 h-px w-1/2 bg-border"
              aria-hidden="true"
            />
          )}
          {!isLast && (
            <div
              className="pointer-events-none absolute top-0 left-1/2 h-px w-1/2 bg-border"
              aria-hidden="true"
            />
          )}
        </>
      )}
      {/* Queda do trilho até o card da diretoria */}
      <div className="h-5 w-px bg-border" aria-hidden="true" />

      <div className="flex w-full flex-col items-center px-2">
        <span className="rounded-full bg-soaco-blue px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
          Diretoria
        </span>
        <div className="mt-2 flex w-full max-w-[240px] flex-col items-center rounded-xl border border-soaco-blue/40 bg-card px-3 py-3 shadow-level-2">
          <AvatarPessoa nome={diretoria.diretor} fotoConfigSrc={fotoDiretor} tamanho="lg" />
          <p className="mt-2 w-full truncate text-center text-[11px] font-bold uppercase tracking-wide text-soaco-blue dark:text-primary-200">
            {diretoria.nome}
          </p>
          <p className="mt-0.5 w-full truncate text-center text-xs font-medium text-foreground">
            {diretoria.diretor}
          </p>
          <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
            {diretoria.qtdPessoas} colaborador{diretoria.qtdPessoas === 1 ? "" : "es"}
          </p>
        </div>

        <div className="mt-1 flex w-full flex-col items-stretch">
          {diretoria.niveis.length === 0 ? (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Nenhum colaborador nesta diretoria.
            </p>
          ) : (
            diretoria.niveis.map((nivel, idx) => (
              <NivelBloco
                key={nivel.id}
                nivel={nivel}
                matriculasComFoto={matriculasComFoto}
                podeBuscarFotos={podeBuscarFotos}
                defaultOpen={idx < 2}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function EmpresaRaiz({ fotoEmpresa }: { fotoEmpresa: string | null }) {
  return (
    <div className="flex flex-col items-center">
      <span className="rounded-full bg-soaco-navy px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
        Empresa
      </span>
      <div className="relative mt-2 flex flex-col items-center">
        <div className="relative z-10 h-20 w-20">
          <div
            className="pointer-events-none absolute -inset-[7px] rounded-full border-[6px] border-r-transparent border-soaco-gold"
            aria-hidden="true"
          />
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-soaco-navy text-2xl font-bold text-white shadow-level-2 ring-4 ring-card">
            {fotoEmpresa ? (
              <img
                src={fotoEmpresa}
                alt="Logo da Só Aço Industrial Ltda."
                className="h-full w-full object-cover"
              />
            ) : (
              iniciais("Só Aço Industrial Ltda.")
            )}
          </div>
        </div>
        <div className="relative -mt-3 rounded-full border border-border/50 bg-card px-8 py-2.5 text-center shadow-level-2">
          <p className="text-sm font-bold text-soaco-navy dark:text-primary-100">Só Aço Industrial Ltda.</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Organização</p>
        </div>
      </div>
    </div>
  );
}

export function OrganogramaHierarquiaPanel({
  diretorias,
  organicoRows,
  matriculasComFoto,
  podeBuscarFotos,
}: {
  diretorias: DiretoriaTree[];
  organicoRows: OrganicoRow[];
  matriculasComFoto: Set<string>;
  podeBuscarFotos: boolean;
}) {
  const fotoEmpresa = useFotoConfig(FOTO_EMPRESA_KEY);
  const arvore = useMemo(
    () => buildHierarquiaDiretorias(diretorias, organicoRows),
    [diretorias, organicoRows],
  );

  const totalPessoas = arvore.reduce((acc, d) => acc + d.qtdPessoas, 0);
  const temVinculos = diretorias.some((d) => d.areas.some((a) => a.setores.length > 0));

  if (!temVinculos) {
    return (
      <div className="flex min-h-[280px] items-center justify-center border border-dashed border-border bg-muted/20 p-10 text-center shadow-level-1">
        <div className="max-w-md space-y-2">
          <p className="text-sm font-semibold text-foreground">Nenhum setor vinculado</p>
          <p className="text-sm text-muted-foreground">
            Configure os vínculos setor → diretoria na aba Configurações para montar o organograma.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="border border-border bg-card px-3 py-2 font-semibold text-foreground">
          {arvore.length} diretorias
        </span>
        <span className="border border-border bg-card px-3 py-2 font-semibold text-foreground">
          {totalPessoas} colaboradores
        </span>
      </div>

      <div className="overflow-x-auto border border-border bg-muted/20 p-4 shadow-level-1 sm:p-6">
        <div className="flex min-w-[720px] flex-col items-center xl:min-w-0">
          <EmpresaRaiz fotoEmpresa={fotoEmpresa} />
          {/* Haste central da empresa até o trilho das diretorias */}
          <div className="h-6 w-px bg-border" aria-hidden="true" />

          {/* Três diretorias no mesmo nível, ligadas pelo trilho */}
          <div className="flex w-full items-start">
            {arvore.map((diretoria, i) => (
              <DiretoriaRamo
                key={diretoria.id}
                diretoria={diretoria}
                matriculasComFoto={matriculasComFoto}
                podeBuscarFotos={podeBuscarFotos}
                isFirst={i === 0}
                isLast={i === arvore.length - 1}
                total={arvore.length}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
