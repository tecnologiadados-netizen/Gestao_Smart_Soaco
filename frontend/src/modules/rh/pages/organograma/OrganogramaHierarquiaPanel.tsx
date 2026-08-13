import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import html2canvas from "html2canvas";
import {
  Download,
  Expand,
  FoldVertical,
  Maximize2,
  Shrink,
  UnfoldVertical,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { getConfig } from "@rh/lib/api-client";
import {
  buildHierarquiaDiretorias,
  isNoArea,
  type HierarquiaDiretoriaNode,
  type HierarquiaNo,
  type HierarquiaPessoa,
} from "@rh/lib/organograma-hierarquia";
import type { DiretoriaTree } from "@rh/lib/organograma-vinculacoes";
import { canViewOrganogramaFotos } from "@rh/lib/route-permissions";
import { classesQuadroPan, useQuadroPan, type QuadroPanOffset } from "@rh/hooks/useQuadroPan";
import { cn } from "@rh/lib/utils";
import { useOrganicoCardFoto } from "@rh/pages/Organico/useOrganicoCardFoto";
import type { OrganicoRow } from "@rh/types/api";

const FOTO_EMPRESA_KEY = "organograma-foto:empresa";

const MAX_N1_HORIZONTAL = 8;
/** Permite ver a cadeia inteira (Encaixar / scroll do mouse). */
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.05;

/** Linhas — contraste no claro e no escuro (tema escuro precisa de traço mais visível). */
const LINHA = "bg-soaco-navy/60 dark:bg-white/65";
const LINHA_W = "w-[2px]";
const LINHA_H = "h-[2px]";

type OrgUiTokens = {
  fullscreen: boolean;
  cardWPx: number;
  stubPx: number;
  cardW: string;
  cardHDir: string;
  cardHGestao: string;
  cardHLeaf: string;
  cardSlot: string;
  cardBase: string;
  txtCargo: string;
  txtNomeGestao: string;
  txtNomeLeaf: string;
  txtArea: string;
  txtAreaEyebrow: string;
  txtMeta: string;
  contentPad: string;
};

const UI_NORMAL: OrgUiTokens = {
  fullscreen: false,
  cardWPx: 176,
  stubPx: 28,
  cardW: "w-[176px]",
  cardHDir: "min-h-[152px]",
  cardHGestao: "min-h-[164px]",
  cardHLeaf: "min-h-[168px]",
  cardSlot: "w-max min-w-[280px] px-6",
  cardBase:
    "box-border flex shrink-0 flex-col items-center overflow-visible rounded-md border px-3 py-2.5 text-center shadow-level-2",
  txtCargo: "text-[9px]",
  txtNomeGestao: "text-[11px]",
  txtNomeLeaf: "text-[10px]",
  txtArea: "text-[11px]",
  txtAreaEyebrow: "text-[9px]",
  txtMeta: "text-[9px]",
  contentPad: "p-8",
};

/** Tela cheia: cards e tipografia maiores (legível no out-zoom). */
const UI_FULLSCREEN: OrgUiTokens = {
  fullscreen: true,
  cardWPx: 260,
  stubPx: 36,
  cardW: "w-[260px]",
  cardHDir: "min-h-[198px]",
  cardHGestao: "min-h-[208px]",
  cardHLeaf: "min-h-[214px]",
  cardSlot: "w-max min-w-[400px] px-10",
  cardBase:
    "box-border flex shrink-0 flex-col items-center overflow-visible rounded-md border px-4 py-3.5 text-center shadow-level-2",
  txtCargo: "text-[13px]",
  txtNomeGestao: "text-[15px]",
  txtNomeLeaf: "text-[14px]",
  txtArea: "text-[15px]",
  txtAreaEyebrow: "text-[11px]",
  txtMeta: "text-[12px]",
  contentPad: "p-12",
};

const OrgUiContext = createContext<OrgUiTokens>(UI_NORMAL);

function useOrgUi(): OrgUiTokens {
  return useContext(OrgUiContext);
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
  variante = "sobre-escuro",
}: {
  nome: string;
  matricula?: string;
  fotoDisponivel?: boolean;
  podeBuscarFoto?: boolean;
  fotoConfigSrc?: string | null;
  tamanho?: "xs" | "sm" | "md" | "lg";
  variante?: "sobre-escuro" | "sobre-card";
}) {
  const { rootRef, fotoSrc, isLoading } = useOrganicoCardFoto({
    matricula: matricula ?? "",
    nome,
    fotoDisponivel: Boolean(fotoDisponivel && matricula),
    podeBuscar: Boolean(podeBuscarFoto),
  });
  const src = fotoConfigSrc ?? fotoSrc;
  const size =
    tamanho === "lg"
      ? "h-12 w-12 text-sm"
      : tamanho === "md"
        ? "h-9 w-9 text-[10px]"
        : tamanho === "sm"
          ? "h-6 w-6 text-[8px]"
          : "h-5 w-5 text-[7px]";

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ring-2",
        size,
        variante === "sobre-escuro"
          ? "bg-white/15 text-white ring-white/25"
          : "bg-muted text-muted-foreground ring-border/40",
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

/**
 * Escala de marca Só Aço (claro + escuro):
 * navy → azul → superfície → texto; dourado só como acento (anel / logo).
 */
type NivelVisual = 0 | 1 | 2 | 3;

const CAIXA_NIVEL: Record<
  NivelVisual,
  { box: string; title: string; sub: string; meta: string; avatar: "sobre-escuro" | "sobre-card" }
> = {
  /** Área — fundo mais claro no escuro para contraste com o canvas preto */
  0: {
    box: "border-soaco-navy/40 bg-[#DCE8F8] text-soaco-navy dark:border-white/50 dark:bg-[#3A4556] dark:text-white",
    title: "text-soaco-navy dark:text-white",
    sub: "text-soaco-navy/75 dark:text-white/85",
    meta: "text-soaco-navy/70 dark:text-white/75",
    avatar: "sobre-card",
  },
  /** Respondem à diretoria */
  1: {
    box: "border-soaco-blue bg-soaco-blue text-white",
    title: "text-white",
    sub: "text-white/90",
    meta: "text-white/75",
    avatar: "sobre-escuro",
  },
  /** Respondem a esses colaboradores */
  2: {
    box: "border-soaco-navy/30 bg-white text-soaco-navy dark:border-white/35 dark:bg-[#222830] dark:text-white",
    title: "text-soaco-blue dark:text-soaco-gold",
    sub: "text-soaco-navy dark:text-white/90",
    meta: "text-soaco-navy/65 dark:text-white/65",
    avatar: "sobre-card",
  },
  /** Grupos aninhados (manutenção, etc.) */
  3: {
    box: "border-dashed border-soaco-navy/40 bg-[#EBEFF6] text-soaco-navy dark:border-white/40 dark:bg-[#323B4A] dark:text-white",
    title: "text-soaco-navy dark:text-white",
    sub: "text-soaco-navy/80 dark:text-white/85",
    meta: "text-soaco-navy/65 dark:text-white/65",
    avatar: "sobre-card",
  },
};

/** depth 0 = área · 1 = gestão · 2 = equipe · 3+ = grupos aninhados */
function nivelVisual(depth: number): NivelVisual {
  if (depth <= 0) return 0;
  if (depth === 1) return 1;
  if (depth === 2) return 2;
  return 3;
}

/** Contagem com ícone — legível no out-zoom sem depender só do texto minúsculo. */
function MetaContagem({
  className,
  children,
  invisible,
}: {
  className?: string;
  children: ReactNode;
  invisible?: boolean;
}) {
  const ui = useOrgUi();
  return (
    <p
      className={cn(
        "mt-1.5 flex min-h-5 w-full shrink-0 items-center justify-center gap-1 font-semibold tabular-nums leading-normal",
        className,
        invisible && "invisible",
      )}
    >
      <Users
        className={cn("shrink-0 opacity-90", ui.fullscreen ? "h-3.5 w-3.5" : "h-3 w-3")}
        aria-hidden="true"
      />
      <span className={cn(ui.txtMeta)}>{children}</span>
    </p>
  );
}

function TrilhoFilhos({ children }: { children: ReactNode[] }) {
  const ui = useOrgUi();
  const items = children.filter(Boolean);
  if (items.length === 0) return null;

  if (items.length === 1) {
    return (
      <div className="flex flex-col items-center">
        <div className={cn("h-7 shrink-0", LINHA_W, LINHA)} aria-hidden="true" />
        {items[0]}
      </div>
    );
  }

  if (items.length > MAX_N1_HORIZONTAL) {
    return (
      <div className="flex flex-col items-center">
        <div className={cn("h-6 shrink-0", LINHA_W, LINHA)} aria-hidden="true" />
        <div className="grid grid-cols-2 gap-x-10 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((child, i) => (
            <div key={i} className={cn("flex flex-col items-center", ui.cardSlot)}>
              <div className={cn("h-5 shrink-0", LINHA_W, LINHA)} aria-hidden="true" />
              {child}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Sem gap entre colunas + sobreposição de 2px: evita “cortes” no zoom (subpixel).
  return (
    <div className="flex w-max max-w-none flex-col items-center">
      <div className={cn("h-6 shrink-0", LINHA_W, LINHA)} aria-hidden="true" />
      <div className="relative flex items-start justify-center">
        {items.map((child, i) => (
          <div key={i} className={cn("relative flex flex-col items-center", ui.cardSlot)}>
            {i > 0 && (
              <div
                className={cn("pointer-events-none absolute top-0 right-1/2", LINHA_H, LINHA)}
                style={{ width: "calc(50% + 2px)" }}
                aria-hidden="true"
              />
            )}
            {i < items.length - 1 && (
              <div
                className={cn("pointer-events-none absolute top-0 left-1/2", LINHA_H, LINHA)}
                style={{ width: "calc(50% + 2px)" }}
                aria-hidden="true"
              />
            )}
            <div className={cn("h-6 shrink-0", LINHA_W, LINHA)} aria-hidden="true" />
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Equipe do liderado: à direita do card, em duas linhas horizontais.
 */
function EquipeLateralDuasLinhas({ children }: { children: ReactNode[] }) {
  const ui = useOrgUi();
  const items = children.filter(Boolean);
  if (items.length === 0) return null;

  const cols = Math.max(1, Math.ceil(items.length / 2));
  const row1 = items.slice(0, cols);
  const row2 = items.slice(cols);
  const colGap = ui.fullscreen ? 8 : 6;
  const rowGap = ui.fullscreen ? 8 : 6;
  const stem = ui.fullscreen ? 22 : 16;
  const tick = ui.fullscreen ? 12 : 10;
  const compactH = ui.fullscreen ? 128 : 110;

  const Row = ({ rowItems }: { rowItems: ReactNode[] }) => (
    <div className="flex items-center" style={{ gap: colGap }}>
      {rowItems.map((child, i) => (
        <div key={i} className="shrink-0">
          {child}
        </div>
      ))}
    </div>
  );

  if (row2.length === 0) {
    return (
      <div className="flex items-center">
        <div className={cn("shrink-0", LINHA_H, LINHA)} style={{ width: stem }} aria-hidden="true" />
        <Row rowItems={row1} />
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <div className={cn("shrink-0", LINHA_H, LINHA)} style={{ width: stem }} aria-hidden="true" />
      <div className="relative flex flex-col justify-center" style={{ gap: rowGap }}>
        <div
          className={cn("pointer-events-none absolute", LINHA_W, LINHA)}
          style={{ left: 0, top: compactH / 2, height: compactH + rowGap }}
          aria-hidden="true"
        />
        <div className="flex items-center">
          <div className={cn("shrink-0", LINHA_H, LINHA)} style={{ width: tick }} aria-hidden="true" />
          <Row rowItems={row1} />
        </div>
        <div className="flex items-center">
          <div className={cn("shrink-0", LINHA_H, LINHA)} style={{ width: tick }} aria-hidden="true" />
          <Row rowItems={row2} />
        </div>
      </div>
    </div>
  );
}

/**
 * Lista vertical com ligamento lateral.
 * Ocupa largura real no layout (sem translate) para não colidir com a coluna vizinha.
 */
function PilhaLateral({ children }: { children: ReactNode[] }) {
  const ui = useOrgUi();
  const items = children.filter(Boolean);
  if (items.length === 0) return null;

  const stubPx = ui.stubPx;
  const gapPx = ui.fullscreen ? 24 : 20;
  const dropPx = ui.fullscreen ? 32 : 24;

  // Um único filho: descida vertical direta (evita L quebrado).
  if (items.length === 1) {
    return (
      <div className="flex flex-col items-center">
        <div className={cn("shrink-0", LINHA_W, LINHA)} style={{ height: dropPx }} aria-hidden="true" />
        {items[0]}
      </div>
    );
  }

  // Pad esquerdo = largura do card + stub → spine fica sob o centro do card pai.
  const leftPadPx = ui.cardWPx + stubPx;
  const spineX = leftPadPx;

  return (
    <div className="flex w-max flex-col items-stretch">
      <div className="flex">
        <div className="shrink-0" style={{ width: Math.max(0, spineX - 1) }} aria-hidden="true" />
        <div className={cn("shrink-0", LINHA_W, LINHA)} style={{ height: dropPx }} aria-hidden="true" />
      </div>
      <div className="flex flex-row">
        <div className="shrink-0" style={{ width: leftPadPx }} aria-hidden="true" />
        <ul
          className="relative m-0 flex list-none flex-col p-0"
          style={{ paddingLeft: stubPx, gap: gapPx }}
        >
          {items.map((child, i) => (
            <li key={i} className="relative flex items-center">
              {/* Trilho vertical contínuo (sobrepõe gaps / junta com o stub de cima). */}
              {i === 0 ? (
                <div
                  className={cn("pointer-events-none absolute", LINHA_W, LINHA)}
                  style={{ left: -stubPx, top: -(dropPx + 2), height: `calc(50% + ${dropPx + 2}px)` }}
                  aria-hidden="true"
                />
              ) : (
                <div
                  className={cn("pointer-events-none absolute", LINHA_W, LINHA)}
                  style={{ left: -stubPx, top: -gapPx, height: `calc(50% + ${gapPx}px)` }}
                  aria-hidden="true"
                />
              )}
              {i < items.length - 1 && (
                <div
                  className={cn("pointer-events-none absolute", LINHA_W, LINHA)}
                  style={{ left: -stubPx, top: "50%", height: `calc(50% + ${gapPx}px)` }}
                  aria-hidden="true"
                />
              )}
              {/* Horizontal até o card — +1px de overlap na spine. */}
              <div
                className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2", LINHA_H, LINHA)}
                style={{ left: -(stubPx), width: stubPx + 1 }}
                aria-hidden="true"
              />
              {child}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CaixaPessoa({
  pessoa,
  matriculasComFoto,
  podeBuscarFotos,
  depth,
  fotoConfigSrc,
  qtdAbaixo,
  expansivel,
  aberto,
  onToggle,
}: {
  pessoa: HierarquiaPessoa;
  matriculasComFoto: Set<string>;
  podeBuscarFotos: boolean;
  depth: number;
  fotoConfigSrc?: string | null;
  qtdAbaixo?: number;
  expansivel?: boolean;
  aberto?: boolean;
  onToggle?: () => void;
}) {
  const ui = useOrgUi();
  const nv = nivelVisual(Math.min(depth, 2));
  const estilo = CAIXA_NIVEL[nv];
  const isGestao = depth === 1;
  const compacto = depth >= 3;
  const temMeta = !compacto && typeof qtdAbaixo === "number" && qtdAbaixo > 0;

  const inner = (
    <>
      <AvatarPessoa
        nome={pessoa.nome}
        matricula={pessoa.matricula}
        fotoDisponivel={Boolean(pessoa.matricula && matriculasComFoto.has(pessoa.matricula))}
        podeBuscarFoto={podeBuscarFotos}
        fotoConfigSrc={fotoConfigSrc}
        tamanho={compacto ? "xs" : isGestao ? (ui.fullscreen ? "lg" : "md") : ui.fullscreen ? "sm" : "xs"}
        variante={estilo.avatar}
      />
      <div
        className={cn(
          "flex w-full flex-col justify-start",
          compacto ? "mt-1 gap-0.5" : "mt-1.5 gap-0.5",
        )}
      >
        <p
          className={cn(
            "break-words font-bold uppercase leading-[1.5] tracking-wide py-px",
            compacto ? (ui.fullscreen ? "text-[10px]" : "text-[9px]") : ui.txtCargo,
            estilo.title,
          )}
        >
          {pessoa.cargo}
        </p>
        <p
          className={cn(
            "break-words font-medium uppercase leading-[1.5] py-px",
            compacto
              ? ui.fullscreen
                ? "text-[12px]"
                : "text-[10px]"
              : isGestao
                ? ui.txtNomeGestao
                : ui.txtNomeLeaf,
            estilo.sub,
          )}
          title={pessoa.nome}
        >
          {pessoa.nome}
        </p>
        {!compacto && pessoa.setor ? (
          <p
            className={cn(
              "break-words font-semibold uppercase leading-[1.5] py-px",
              compacto ? "text-[8px]" : ui.txtMeta,
              estilo.meta,
            )}
          >
            Setor: {pessoa.setor}
          </p>
        ) : null}
      </div>
      {isGestao || temMeta ? (
        <MetaContagem className={cn(estilo.meta, "uppercase")} invisible={!temMeta}>
          {temMeta
            ? `${qtdAbaixo} abaixo${expansivel ? (aberto ? " · −" : " · +") : ""}`
            : "\u00a0"}
        </MetaContagem>
      ) : null}
    </>
  );

  const cls = cn(
    ui.cardBase,
    compacto
      ? ui.fullscreen
        ? "min-h-[128px] w-[186px] px-2 py-2"
        : "min-h-[110px] w-[148px] px-2 py-1.5"
      : cn(ui.cardW, isGestao ? ui.cardHGestao : ui.cardHLeaf),
    estilo.box,
    expansivel && "cursor-pointer transition-[box-shadow,opacity] hover:opacity-95",
    aberto && "ring-2 ring-soaco-gold ring-offset-2 ring-offset-background",
  );

  if (expansivel && onToggle) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cls}
        title={`${pessoa.cargo} · ${pessoa.setor}`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={cls} title={`${pessoa.cargo} · ${pessoa.setor}`}>
      {inner}
    </div>
  );
}

function CaixaArea({
  label,
  qtd,
  expansivel,
  aberto,
  onToggle,
}: {
  label: string;
  qtd: number;
  expansivel?: boolean;
  aberto?: boolean;
  onToggle?: () => void;
}) {
  const ui = useOrgUi();
  const estilo = CAIXA_NIVEL[0];
  const cls = cn(
    ui.cardBase,
    ui.cardW,
    ui.cardHGestao,
    estilo.box,
    expansivel && "cursor-pointer transition-[box-shadow,opacity] hover:opacity-95",
    aberto && "ring-2 ring-soaco-gold ring-offset-2 ring-offset-background",
  );
  const body = (
    <>
      <p className={cn("font-bold uppercase tracking-[0.14em]", ui.txtAreaEyebrow, estilo.meta)}>Área</p>
      <div className="mt-1 flex w-full flex-1 flex-col justify-center">
        <p
          className={cn(
            "break-words font-bold uppercase leading-[1.5] tracking-wide py-px",
            ui.txtArea,
            estilo.title,
          )}
          title={label}
        >
          {label}
        </p>
      </div>
      <MetaContagem className={estilo.meta} invisible={qtd <= 0}>
        {qtd > 0
          ? `${qtd} no ramo${expansivel ? (aberto ? " · −" : " · +") : ""}`
          : "\u00a0"}
      </MetaContagem>
    </>
  );
  if (expansivel && onToggle) {
    return (
      <button type="button" onClick={onToggle} className={cls}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

function CaixaGrupo({
  label,
  qtd,
  depth,
  expansivel,
  aberto,
  onToggle,
}: {
  label: string;
  qtd: number;
  depth: number;
  expansivel?: boolean;
  aberto?: boolean;
  onToggle?: () => void;
}) {
  const ui = useOrgUi();
  const nv = nivelVisual(Math.max(depth, 3));
  const estilo = CAIXA_NIVEL[nv];
  const temMeta = qtd > 0;
  const cls = cn(
    ui.cardBase,
    ui.cardW,
    ui.cardHLeaf,
    estilo.box,
    expansivel && "cursor-pointer transition-[box-shadow,opacity] hover:opacity-95",
    aberto && "ring-2 ring-soaco-gold ring-offset-2 ring-offset-background",
  );
  const body = (
    <>
      <div className={cn("shrink-0", ui.fullscreen ? "h-7 w-7" : "h-5 w-5")} aria-hidden="true" />
      <div className="mt-1.5 flex w-full flex-1 flex-col justify-start gap-0.5">
        <p
          className={cn(
            "break-words font-bold uppercase leading-[1.5] tracking-wide py-px",
            ui.txtCargo,
            estilo.title,
          )}
          title={label}
        >
          {label}
        </p>
      </div>
      {temMeta ? (
        <MetaContagem className={estilo.meta}>
          {`${qtd} colaborador${qtd === 1 ? "" : "es"}${expansivel ? (aberto ? " · −" : " · +") : ""}`}
        </MetaContagem>
      ) : null}
    </>
  );
  if (expansivel && onToggle) {
    return (
      <button type="button" onClick={onToggle} className={cls}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

function contarFolhas(nos: HierarquiaNo[]): number {
  let n = 0;
  for (const no of nos) {
    if (no.kind === "pessoa") n += 1;
    else if (typeof no.qtd === "number") n += no.qtd;
    n += contarFolhas(no.filhos);
  }
  return n;
}

/** IDs de nós que têm filhos (podem expandir). */
function coletarExpandiveis(nos: HierarquiaNo[]): string[] {
  const ids: string[] = [];
  for (const no of nos) {
    if (no.filhos.length > 0) {
      ids.push(no.id);
      ids.push(...coletarExpandiveis(no.filhos));
    }
  }
  return ids;
}

function NoOrganograma({
  no,
  matriculasComFoto,
  podeBuscarFotos,
  depth,
  abertos,
  onToggleAberto,
}: {
  no: HierarquiaNo;
  matriculasComFoto: Set<string>;
  podeBuscarFotos: boolean;
  depth: number;
  abertos: Set<string>;
  onToggleAberto: (id: string) => void;
}) {
  const temFilhos = no.filhos.length > 0;
  const qtd =
    no.kind === "grupo" && typeof no.qtd === "number"
      ? no.qtd
      : temFilhos
        ? contarFolhas(no.filhos)
        : 0;

  const isArea = isNoArea(no);
  const isGestao = depth === 1;
  const aberto = temFilhos && abertos.has(no.id);
  const onToggle = temFilhos ? () => onToggleAberto(no.id) : undefined;

  const caixa = isArea ? (
    <CaixaArea label={no.label} qtd={qtd} expansivel={temFilhos} aberto={aberto} onToggle={onToggle} />
  ) : no.kind === "grupo" ? (
    <CaixaGrupo
      label={no.label}
      qtd={qtd}
      depth={depth}
      expansivel={temFilhos}
      aberto={aberto}
      onToggle={onToggle}
    />
  ) : (
    <CaixaPessoa
      pessoa={no.pessoa}
      matriculasComFoto={matriculasComFoto}
      podeBuscarFotos={podeBuscarFotos}
      depth={depth}
      qtdAbaixo={temFilhos ? no.filhos.length : undefined}
      expansivel={temFilhos}
      aberto={aberto}
      onToggle={onToggle}
    />
  );

  const filhosEls =
    aberto && temFilhos
      ? no.filhos.map((filho) => (
          <NoOrganograma
            key={filho.id}
            no={filho}
            matriculasComFoto={matriculasComFoto}
            podeBuscarFotos={podeBuscarFotos}
            depth={depth + 1}
            abertos={abertos}
            onToggleAberto={onToggleAberto}
          />
        ))
      : [];

  const ui = useOrgUi();
  const equipeNaLateral = !isArea && depth >= 2 && filhosEls.length > 0;
  const pilhaAbaixo = !isArea && isGestao && filhosEls.length > 1;
  const cardOffsetPx = pilhaAbaixo ? ui.stubPx + ui.cardWPx / 2 : 0;

  return (
    <div
      className={cn(
        "flex w-max",
        equipeNaLateral ? "flex-row items-center" : pilhaAbaixo ? "flex-col items-start" : "flex-col items-center",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 flex-col items-center",
          (isArea || isGestao) && ui.cardHGestao,
        )}
        style={cardOffsetPx ? { marginLeft: cardOffsetPx } : undefined}
      >
        {caixa}
      </div>
      {filhosEls.length > 0 &&
        (isArea && filhosEls.length > 1 ? (
          <TrilhoFilhos>{filhosEls}</TrilhoFilhos>
        ) : equipeNaLateral ? (
          <EquipeLateralDuasLinhas>{filhosEls}</EquipeLateralDuasLinhas>
        ) : (
          <PilhaLateral>{filhosEls}</PilhaLateral>
        ))}
    </div>
  );
}

function DiretoriaCard({
  diretoria,
  fotoDiretor,
  onFocar,
}: {
  diretoria: HierarquiaDiretoriaNode;
  fotoDiretor: string | null;
  onFocar?: () => void;
}) {
  const ui = useOrgUi();
  return (
    <button
      type="button"
      onClick={onFocar}
      title="Focar neste ramo"
      className={cn(
        ui.cardBase,
        ui.cardW,
        ui.cardHDir,
        "border-soaco-navy bg-soaco-navy text-white transition-opacity hover:opacity-95",
        onFocar && "cursor-pointer",
      )}
    >
      <AvatarPessoa
        nome={diretoria.diretor}
        fotoConfigSrc={fotoDiretor}
        tamanho={ui.fullscreen ? "lg" : "md"}
      />
      <div className="mt-2 flex w-full flex-col justify-start gap-0.5">
        <p
          className={cn(
            "w-full break-words font-bold uppercase leading-[1.5] tracking-wide py-px text-white",
            ui.txtCargo,
          )}
        >
          {diretoria.nome}
        </p>
        <p
          className={cn(
            "w-full break-words font-medium uppercase leading-[1.5] py-px text-white/85",
            ui.txtNomeGestao,
          )}
        >
          {diretoria.diretor}
        </p>
      </div>
      <MetaContagem className="text-white/75">
        {diretoria.qtdPessoas} no organograma
      </MetaContagem>
    </button>
  );
}

function DiretoriaRamo({
  diretoria,
  matriculasComFoto,
  podeBuscarFotos,
  isFirst,
  isLast,
  total,
  abertos,
  onToggleAberto,
  onFocar,
  ramoRef,
}: {
  diretoria: HierarquiaDiretoriaNode;
  matriculasComFoto: Set<string>;
  podeBuscarFotos: boolean;
  isFirst: boolean;
  isLast: boolean;
  total: number;
  abertos: Set<string>;
  onToggleAberto: (id: string) => void;
  onFocar: () => void;
  ramoRef?: (el: HTMLDivElement | null) => void;
}) {
  const fotoDiretor = useFotoConfig(diretoria.fotoKey);

  const ancorasEls = diretoria.ancoras.map((no) => (
    <NoOrganograma
      key={no.id}
      no={no}
      matriculasComFoto={matriculasComFoto}
      podeBuscarFotos={podeBuscarFotos}
      depth={0}
      abertos={abertos}
      onToggleAberto={onToggleAberto}
    />
  ));

  return (
    <div ref={ramoRef} className="relative flex min-w-0 flex-col items-center px-5" data-ramo={diretoria.id}>
      {total > 1 && (
        <>
          {!isFirst && (
            <div
              className={cn("pointer-events-none absolute top-0 right-1/2", LINHA_H, LINHA)}
              style={{ width: "calc(50% + 2px)" }}
              aria-hidden="true"
            />
          )}
          {!isLast && (
            <div
              className={cn("pointer-events-none absolute top-0 left-1/2", LINHA_H, LINHA)}
              style={{ width: "calc(50% + 2px)" }}
              aria-hidden="true"
            />
          )}
        </>
      )}
      <div className={cn("h-6 shrink-0", LINHA_W, LINHA)} aria-hidden="true" />
      <DiretoriaCard diretoria={diretoria} fotoDiretor={fotoDiretor} onFocar={onFocar} />

      {ancorasEls.length === 0 ? (
        <p className="mt-4 max-w-[200px] text-center text-xs text-muted-foreground">
          Nenhum vínculo de gestão nesta diretoria.
        </p>
      ) : (
        <TrilhoFilhos>{ancorasEls}</TrilhoFilhos>
      )}
    </div>
  );
}

function EmpresaRaiz({ fotoEmpresa }: { fotoEmpresa: string | null }) {
  const ui = useOrgUi();
  return (
    <div className="flex flex-col items-center">
      <div className={cn("relative z-10", ui.fullscreen ? "h-24 w-24" : "h-16 w-16")}>
        <div
          className={cn(
            "pointer-events-none absolute rounded-full border-r-transparent border-soaco-gold",
            ui.fullscreen ? "-inset-[8px] border-[6px]" : "-inset-[6px] border-[5px]",
          )}
          aria-hidden="true"
        />
        <div
          className={cn(
            "flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-soaco-navy font-bold text-white shadow-level-2 ring-4 ring-card",
            ui.fullscreen ? "text-2xl" : "text-xl",
          )}
        >
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
      <div
        className={cn(
          "relative -mt-2 rounded-sm border border-soaco-navy bg-soaco-navy text-center text-white shadow-level-1",
          ui.fullscreen ? "px-10 py-3.5" : "px-8 py-2.5",
        )}
      >
        <p className={cn("font-bold", ui.fullscreen ? "text-lg" : "text-sm")}>Só Aço Industrial Ltda.</p>
        <p
          className={cn(
            "font-bold uppercase tracking-wider text-white/70",
            ui.fullscreen ? "text-xs" : "text-[10px]",
          )}
        >
          Organização
        </p>
      </div>
    </div>
  );
}

function LegendaOrganograma() {
  const item = (cls: string, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block h-3 w-5 shrink-0 rounded-sm border", cls)} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
      {item("border-soaco-navy bg-soaco-navy", "Diretorias")}
      {item(
        "border-soaco-navy/40 bg-[#DCE8F8] dark:border-white/50 dark:bg-[#3A4556]",
        "Áreas",
      )}
      {item("border-soaco-blue bg-soaco-blue", "Reportes diretos")}
      {item(
        "border-soaco-navy/30 bg-white dark:border-white/35 dark:bg-[#222830]",
        "Equipe",
      )}
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

  const shellRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const ramoElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [zoom, setZoom] = useState(0.85);
  const panOffsetRef = useRef<QuadroPanOffset>({ x: 0, y: 0 });
  const panRafRef = useRef<number | null>(null);
  const [panOffset, setPanOffset] = useState<QuadroPanOffset>({ x: 0, y: 0 });
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set());
  const [exportando, setExportando] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [encaixeTick, setEncaixeTick] = useState(0);
  const uiTokens = isFullscreen ? UI_FULLSCREEN : UI_NORMAL;

  const clampZoom = useCallback((z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)), []);

  const aplicarPanOffset = useCallback((next: QuadroPanOffset, imediato = false) => {
    panOffsetRef.current = next;
    if (imediato) {
      if (panRafRef.current != null) {
        window.cancelAnimationFrame(panRafRef.current);
        panRafRef.current = null;
      }
      setPanOffset(next);
      return;
    }
    // Um setState por frame — arrastar sem re-render a cada pixel.
    if (panRafRef.current != null) return;
    panRafRef.current = window.requestAnimationFrame(() => {
      panRafRef.current = null;
      setPanOffset(panOffsetRef.current);
    });
  }, []);

  const {
    ref: viewportCallbackRef,
    elementRef: viewportRef,
    isPanning,
  } = useQuadroPan({
    zoomComScroll: true,
    panOffsetRef,
    onPanOffsetChange: aplicarPanOffset,
    onZoomStep: useCallback(
      (direcao: 1 | -1) => setZoom((z) => clampZoom(z + direcao * ZOOM_STEP)),
      [clampZoom],
    ),
  });

  useEffect(() => {
    if (!isPanning) setPanOffset(panOffsetRef.current);
  }, [isPanning]);

  const idsExpandiveis = useMemo(
    () => arvore.flatMap((d) => coletarExpandiveis(d.ancoras)),
    [arvore],
  );
  const temAlgoAberto = abertos.size > 0;

  useLayoutEffect(() => {
    // Remove IDs que sumiram da árvore (ex.: troca de vínculos).
    setAbertos((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(idsExpandiveis);
      let mudou = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
        else mudou = true;
      }
      return mudou ? next : prev;
    });
  }, [idsExpandiveis]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const ativo = document.fullscreenElement === shellRef.current;
      setIsFullscreen(ativo);
      if (ativo) setEncaixeTick((n) => n + 1);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const centralizarConteudo = useCallback(
    (scale: number, cw: number, ch: number, vpW: number, vpH: number) => {
      aplicarPanOffset(
        {
          x: (vpW - cw * scale) / 2,
          y: (vpH - ch * scale) / 2,
        },
        true,
      );
    },
    [aplicarPanOffset],
  );

  const encaixarNaTela = useCallback(() => {
    const vp = viewportRef.current;
    const el = contentRef.current;
    if (!vp || !el) return;
    const pad = 48;
    // offsetWidth/Height ignoram o transform — medem o tamanho lógico do organograma.
    const cw = el.offsetWidth;
    const ch = el.offsetHeight;
    if (cw <= 0 || ch <= 0) return;
    const scale = Math.min((vp.clientWidth - pad) / cw, (vp.clientHeight - pad) / ch, ZOOM_MAX);
    const next = clampZoom(scale);
    setZoom(next);
    centralizarConteudo(next, cw, ch, vp.clientWidth, vp.clientHeight);
  }, [clampZoom, centralizarConteudo, viewportRef]);

  /** Dispara encaixe + centralização após o layout assentar (expandir / tela cheia / 1ª carga). */
  const pedirEncaixeAposLayout = useCallback(() => {
    setEncaixeTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!temVinculos) return;
    pedirEncaixeAposLayout();
  }, [temVinculos, arvore.length, pedirEncaixeAposLayout]);

  useEffect(() => {
    if (encaixeTick === 0) return;
    let cancelled = false;
    const run = () => {
      if (!cancelled) encaixarNaTela();
    };
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });
    const t = window.setTimeout(run, 220);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [encaixeTick, encaixarNaTela]);

  const alternarTelaCheia = useCallback(async () => {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* navegador pode negar fullscreen */
    }
  }, []);

  const onToggleAberto = useCallback((id: string) => {
    setAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const recolherTudo = useCallback(() => {
    setAbertos(new Set());
    pedirEncaixeAposLayout();
  }, [pedirEncaixeAposLayout]);

  const expandirTudo = useCallback(() => {
    setAbertos(new Set(idsExpandiveis));
    pedirEncaixeAposLayout();
  }, [idsExpandiveis, pedirEncaixeAposLayout]);

  const focarRamo = useCallback(
    (diretoriaId: string) => {
      const vp = viewportRef.current;
      const ramo = ramoElsRef.current.get(diretoriaId);
      if (!vp || !ramo) return;

      const nextZoom = clampZoom(0.95);
      setZoom(nextZoom);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const vpRect = vp.getBoundingClientRect();
          const ramoRect = ramo.getBoundingClientRect();
          const cur = panOffsetRef.current;
          const dx = vpRect.left + vp.clientWidth / 2 - (ramoRect.left + ramoRect.width / 2);
          const dy = vpRect.top + Math.min(80, vp.clientHeight * 0.12) - ramoRect.top;
          aplicarPanOffset({ x: cur.x + dx, y: cur.y + dy }, true);
        });
      });
    },
    [aplicarPanOffset, clampZoom, viewportRef],
  );

  const exportarPng = useCallback(async () => {
    const el = contentRef.current;
    if (!el || exportando) return;
    setExportando(true);

    const pad = 56;
    const holder = document.createElement("div");
    holder.style.cssText =
      "position:fixed;left:0;top:0;z-index:-1;pointer-events:none;opacity:1;background:#ffffff;";
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.transform = "none";
    clone.style.willChange = "auto";
    clone.style.padding = `${pad}px`;
    clone.style.backgroundColor = "#ffffff";
    clone.style.overflow = "visible";
    holder.appendChild(clone);
    document.body.appendChild(holder);

    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      const width = Math.ceil(Math.max(clone.scrollWidth, clone.offsetWidth));
      const height = Math.ceil(Math.max(clone.scrollHeight, clone.offsetHeight));

      const canvas = await html2canvas(clone, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
        width,
        height,
        windowWidth: Math.max(width, 1),
        windowHeight: Math.max(height, 1),
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        onclone: (_doc, cloned) => {
          cloned.style.transform = "none";
          cloned.style.willChange = "auto";
          cloned.style.overflow = "visible";
          cloned.style.padding = `${pad}px`;
        },
      });

      const link = document.createElement("a");
      link.download = `organograma-hierarquia-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Falha ao exportar organograma:", err);
    } finally {
      holder.remove();
      setExportando(false);
    }
  }, [exportando]);

  if (!temVinculos) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center shadow-level-1">
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
    <OrgUiContext.Provider value={uiTokens}>
      <div
        ref={shellRef}
        className={cn(
          "space-y-3 print:space-y-2",
          isFullscreen && "flex h-full flex-col gap-2 space-y-0 bg-background p-4",
        )}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs print:hidden">
          <span className="rounded-md border border-border bg-card px-3 py-2 font-semibold text-foreground shadow-level-1">
            {arvore.length} diretorias
          </span>
          <span className="rounded-md border border-border bg-card px-3 py-2 font-semibold text-foreground shadow-level-1">
            {totalPessoas} no organograma
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 font-semibold text-muted-foreground shadow-level-1 hover:bg-muted hover:text-foreground"
            title={temAlgoAberto ? "Recolher todos os ramos" : "Expandir todos os ramos"}
            onClick={temAlgoAberto ? recolherTudo : expandirTudo}
          >
            {temAlgoAberto ? (
              <>
                <FoldVertical className="h-3.5 w-3.5" />
                Recolher tudo
              </>
            ) : (
              <>
                <UnfoldVertical className="h-3.5 w-3.5" />
                Expandir tudo
              </>
            )}
          </button>
          <div className="ml-auto flex items-center gap-1 rounded-md border border-border bg-card p-1 shadow-level-1">
            <button
              type="button"
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Diminuir zoom"
              onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="min-w-[3.25rem] text-center text-[11px] font-semibold tabular-nums text-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Aumentar zoom"
              onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="ml-0.5 flex items-center gap-1 rounded px-2 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Encaixar na tela"
              onClick={encaixarNaTela}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Encaixar
            </button>
            <button
              type="button"
              className={cn(
                "ml-0.5 flex items-center gap-1 rounded px-2 py-1.5 text-[11px] font-semibold hover:bg-muted hover:text-foreground",
                isFullscreen
                  ? "bg-soaco-navy text-white hover:bg-soaco-navy/90 hover:text-white"
                  : "text-muted-foreground",
              )}
              title={isFullscreen ? "Sair da tela cheia (Esc)" : "Tela cheia — cards maiores"}
              onClick={() => void alternarTelaCheia()}
            >
              {isFullscreen ? (
                <>
                  <Shrink className="h-3.5 w-3.5" />
                  Sair
                </>
              ) : (
                <>
                  <Expand className="h-3.5 w-3.5" />
                  Tela cheia
                </>
              )}
            </button>
            <button
              type="button"
              className="ml-0.5 flex items-center gap-1 rounded px-2 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              title="Exportar PNG (fundo branco)"
              disabled={exportando}
              onClick={() => void exportarPng()}
            >
              <Download className="h-3.5 w-3.5" />
              {exportando ? "Exportando…" : "PNG"}
            </button>
          </div>
        </div>

        <LegendaOrganograma />

        <div
          ref={viewportCallbackRef}
          className={cn(
            "org-canvas relative touch-none overflow-hidden rounded-xl border print:h-auto print:overflow-visible print:border-0 print:bg-white print:shadow-none",
            isFullscreen ? "min-h-0 flex-1" : "h-[min(80vh,980px)]",
            classesQuadroPan(isPanning),
          )}
        >
          <div
            ref={contentRef}
            className={cn(
              "inline-flex w-max flex-col items-center bg-transparent print:bg-white print:p-4",
              uiTokens.contentPad,
            )}
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              willChange: isPanning ? "transform" : undefined,
            }}
          >
            <EmpresaRaiz fotoEmpresa={fotoEmpresa} />
            <div
              className={cn(isFullscreen ? "h-9" : "h-7", "shrink-0", LINHA_W, LINHA)}
              aria-hidden="true"
            />

            <div className="flex w-max items-start justify-center">
              {arvore.map((diretoria, i) => (
                <DiretoriaRamo
                  key={diretoria.id}
                  diretoria={diretoria}
                  matriculasComFoto={matriculasComFoto}
                  podeBuscarFotos={podeBuscarFotos}
                  isFirst={i === 0}
                  isLast={i === arvore.length - 1}
                  total={arvore.length}
                  abertos={abertos}
                  onToggleAberto={onToggleAberto}
                  onFocar={() => focarRamo(diretoria.id)}
                  ramoRef={(el) => {
                    if (el) ramoElsRef.current.set(diretoria.id, el);
                    else ramoElsRef.current.delete(diretoria.id);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </OrgUiContext.Provider>
  );
}
