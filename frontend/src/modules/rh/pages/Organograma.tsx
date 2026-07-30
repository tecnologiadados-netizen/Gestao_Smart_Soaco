import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@rh/components/AppLayout";
import { motion } from "framer-motion";
import { Camera, Expand, Shrink } from "lucide-react";
import {
  getConfig,
  getOrganico,
  getOrganicoFotosResumo,
  isApiConfigured,
  setConfig,
} from "@rh/lib/api-client";
import {
  canEditOrganogramaFotos,
  canEditRoute,
  canViewOrganicoPhotos,
  canViewOrganogramaFotos,
} from "@rh/lib/route-permissions";
import {
  ORGANOGRAMA_VINCULACOES_CONFIG_KEY,
  buildDiretoriasTree,
  mergeVinculacoesComSetores,
  normalizarChave,
  parseOrganogramaVinculacoes,
  type DiretoriaTree,
  type SetorOrganizacional,
} from "@rh/lib/organograma-vinculacoes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rh/components/ui/tabs";
import { useToast } from "@rh/hooks/use-toast";
import { classesQuadroPan, useQuadroPan } from "@rh/hooks/useQuadroPan";
import { ORGANICO_IDX, getStatusFromRow } from "@rh/pages/Organico/organico-derive";
import { OrganogramaVinculosConfigPanel } from "@rh/pages/organograma/OrganogramaVinculosConfigPanel";
import { OrganogramaHierarquiaPanel } from "@rh/pages/organograma/OrganogramaHierarquiaPanel";
import {
  OrganogramaSetorMembrosDialog,
  contarColaboradoresPorSetorSoAco,
  type SetorSelecionadoMapa,
} from "@rh/pages/organograma/OrganogramaSetorMembrosDialog";
import { cn } from "@rh/lib/utils";

type OrganogramaAba = "mapa-vinculos" | "hierarquia" | "configuracoes";

const FOTO_EMPRESA_KEY = "organograma-foto:empresa";
const STATUS_VALIDOS = new Set(["Ativo", "Férias", "Afastado"]);
const PALAVRAS_IGNORADAS = new Set(["de", "da", "do", "e", "sr", "sra"]);

function cell(values: unknown[], index: number): string {
  return values[index] != null ? String(values[index]).trim() : "";
}

function iniciais(nome: string): string {
  const palavras = nome
    .split(/[\s/.·-]+/)
    .filter((palavra) => palavra && !PALAVRAS_IGNORADAS.has(palavra.toLocaleLowerCase("pt-BR")));
  if (palavras.length === 0) return nome.slice(0, 2).toLocaleUpperCase("pt-BR");
  if (palavras.length === 1 && palavras[0].length <= 3) return palavras[0].toLocaleUpperCase("pt-BR");
  return palavras
    .map((palavra) => palavra[0])
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase("pt-BR");
}

/** Foto persistida em rh_config (empresa e diretores não existem como colaboradores no Orgânico). */
function useOrganogramaFotoConfig(configKey?: string): string | null {
  const podeVerFoto = canViewOrganogramaFotos();
  const { data } = useQuery({
    queryKey: ["organograma-foto-config", configKey],
    queryFn: async () => (await getConfig(configKey as string)).value,
    enabled: Boolean(configKey) && podeVerFoto,
    staleTime: 5 * 60 * 1000,
  });
  const value = typeof data === "string" ? data.trim() : "";
  return value.startsWith("data:image/") ? value : null;
}

const FotoConfigUploadButton = ({
  configKey,
  nome,
  className = "",
}: {
  configKey: string;
  nome: string;
  className?: string;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Selecione uma imagem.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "Use uma imagem de até 2 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;
      try {
        await setConfig(configKey, dataUrl);
        await queryClient.invalidateQueries({ queryKey: ["organograma-foto-config", configKey] });
        toast({ title: "Foto atualizada", description: `Foto de ${nome} salva com sucesso.` });
      } catch (e) {
        toast({ title: "Erro ao salvar foto", description: (e as Error).message, variant: "destructive" });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <button
        type="button"
        title={`Alterar foto de ${nome}`}
        onClick={() => inputRef.current?.click()}
        className={`absolute z-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-level-1 transition-colors hover:text-foreground ${className}`}
      >
        <Camera className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">Alterar foto de {nome}</span>
      </button>
    </>
  );
};

type NivelVisual = "organizacao" | "diretoria" | "setor";

/** Cores do manual da marca Só Aço: navy #041E42, azul #1E22AA e dourado #FFAD00. */
const NIVEL_ESTILOS: Record<
  NivelVisual,
  { badge: string; avatar: string; arco: string; texto: string }
> = {
  organizacao: {
    badge: "bg-soaco-navy text-white",
    avatar: "bg-soaco-navy text-white",
    arco: "border-soaco-navy",
    texto: "text-soaco-navy dark:text-primary-100",
  },
  diretoria: {
    badge: "bg-soaco-blue text-white",
    avatar: "bg-soaco-blue text-white",
    arco: "border-soaco-blue",
    texto: "text-soaco-blue dark:text-primary-200",
  },
  setor: {
    badge: "bg-soaco-gold text-soaco-navy",
    avatar: "bg-soaco-gold text-soaco-navy",
    arco: "border-soaco-gold",
    texto: "text-accent-700 dark:text-accent-400",
  },
};

const NivelBadge = ({ rotulo, nivel }: { rotulo: string; nivel: NivelVisual }) => (
  <span
    className={`absolute -top-2 right-4 z-20 rounded-full px-3 py-1 text-[8px] font-bold uppercase tracking-widest shadow-level-1 ${NIVEL_ESTILOS[nivel].badge}`}
  >
    {rotulo}
  </span>
);

/** Avatar circular com meio-anel (empresa / diretorias). */
const AvatarComArco = ({
  nome,
  fotoSrc,
  nivel,
  destaque = false,
}: {
  nome: string;
  fotoSrc?: string | null;
  nivel: NivelVisual;
  destaque?: boolean;
}) => {
  const estilos = NIVEL_ESTILOS[nivel];
  return (
    <div className={`relative shrink-0 ${destaque ? "h-[88px] w-[88px]" : "h-16 w-16"}`}>
      <div
        className={`pointer-events-none absolute rounded-full border-r-transparent ${
          destaque ? "-inset-[8px] border-[6px]" : "-inset-[6px] border-[5px]"
        } ${estilos.arco}`}
        aria-hidden="true"
      />
      <div
        className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full font-bold shadow-level-2 ring-4 ring-card ${estilos.avatar} ${
          destaque ? "text-lg" : "text-sm"
        }`}
      >
        {fotoSrc ? (
          <img src={fotoSrc} alt={`Foto de ${nome}`} className="h-full w-full object-cover" />
        ) : (
          iniciais(nome)
        )}
      </div>
    </div>
  );
};

/**
 * Card de diretoria: foto do responsável + nome da diretoria (estrutura).
 */
const DiretoriaPill = ({
  diretoria,
  canEditFoto = false,
}: {
  diretoria: DiretoriaTree;
  canEditFoto?: boolean;
}) => {
  const estilos = NIVEL_ESTILOS.diretoria;
  const fotoSrc = useOrganogramaFotoConfig(diretoria.fotoKey);

  return (
    <div className="relative ml-2 mt-4 pb-3 pl-2">
      <NivelBadge rotulo="Diretoria" nivel="diretoria" />
      <div className="relative flex min-h-[76px] w-[300px] items-center rounded-full border border-soaco-navy/25 bg-card py-3 pl-[104px] pr-8 shadow-level-2 transition-shadow hover:shadow-level-3 dark:border-white/20">
        <div className="absolute -left-3 top-1/2 z-10 -translate-y-1/2">
          <AvatarComArco
            nome={diretoria.diretor}
            fotoSrc={fotoSrc}
            nivel="diretoria"
            destaque
          />
          {canEditFoto && (
            <FotoConfigUploadButton
              configKey={diretoria.fotoKey}
              nome={diretoria.diretor}
              className="-bottom-1 -right-1"
            />
          )}
        </div>
        <div className="min-w-0 text-left">
          <p className={`text-sm font-bold leading-tight ${estilos.texto}`}>{diretoria.nome}</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Card de setor: só nome estrutural; clique abre os colaboradores do Orgânico.
 */
const SetorPill = ({
  titulo,
  subtitulo,
  qtdColaboradores = 0,
  onClick,
}: {
  titulo: string;
  subtitulo?: string;
  qtdColaboradores?: number;
  onClick?: () => void;
}) => {
  const estilos = NIVEL_ESTILOS.setor;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Ver colaboradores de ${titulo}`}
      className="relative mt-1.5 text-left transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-soaco-gold/60"
    >
      <NivelBadge rotulo="Setor" nivel="setor" />
      <span
        className="absolute -bottom-1.5 right-3 z-20 rounded-full border border-soaco-navy/20 bg-card px-2 py-0.5 text-[9px] font-bold tabular-nums text-soaco-navy shadow-level-1 dark:border-white/20 dark:text-white/85"
        title={`${qtdColaboradores} colaborador${qtdColaboradores === 1 ? "" : "es"}`}
      >
        {qtdColaboradores}
      </span>
      <div className="flex min-h-[46px] w-[200px] cursor-pointer items-center rounded-full border border-soaco-navy/20 bg-card px-5 py-2 pb-3 shadow-level-2 transition-shadow hover:border-soaco-gold hover:shadow-level-3 dark:border-white/20">
        <div className="min-w-0 text-left">
          <p className={`text-[13px] font-bold leading-tight ${estilos.texto}`}>{titulo}</p>
          {subtitulo ? (
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {subtitulo}
            </p>
          ) : null}
        </div>
      </div>
    </button>
  );
};

/** Traço dos conectores — visível nos dois temas (o `--border` sozinho some no quadro). */
const LINHA_MAPA = "bg-soaco-navy/45 dark:bg-white/55";

/** Conector horizontal curto entre nós do mapa (esquerda → direita). */
const ConectorHorizontal = ({ className }: { className?: string }) => (
  <div
    className={cn("h-[2px] w-6 shrink-0 self-center", LINHA_MAPA, className)}
    aria-hidden="true"
  />
);

/**
 * Ramo horizontal: Diretoria (com foto) → grade de setores (só estrutura).
 */
const DiretoriaBranch = ({
  diretoria,
  delay,
  canEditFotos,
  contagemPorSetor,
  onSelecionarSetor,
}: {
  diretoria: DiretoriaTree;
  delay: number;
  canEditFotos: boolean;
  contagemPorSetor: Map<string, number>;
  onSelecionarSetor: (payload: { setor: SetorOrganizacional; area: string }) => void;
}) => {
  const setoresComArea = diretoria.areas.flatMap((area) =>
    area.setores.map((info) => ({ area: area.nome, info })),
  );
  /** 2–3 colunas conforme a quantidade, para equilibrar altura e largura. */
  const colunas = Math.min(3, Math.max(2, Math.ceil(setoresComArea.length / 5)));
  const larguraGrade = colunas * 212 + (colunas - 1) * 12;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      className="flex flex-row items-center"
    >
      <DiretoriaPill diretoria={diretoria} canEditFoto={canEditFotos} />
      {setoresComArea.length > 0 && (
        <>
          <ConectorHorizontal />
          <div
            className="flex flex-wrap content-center gap-x-3 gap-y-3 py-1"
            style={{ maxWidth: `${larguraGrade}px` }}
          >
            {setoresComArea.map(({ area, info }) => (
              <SetorPill
                key={`${area}-${info.nome}`}
                titulo={info.nome}
                subtitulo={area || undefined}
                qtdColaboradores={contagemPorSetor.get(normalizarChave(info.nome)) ?? 0}
                onClick={() => onSelecionarSetor({ setor: info, area })}
              />
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
};

/** Nó da empresa à esquerda do mapa horizontal. */
const EmpresaNode = ({
  fotoEmpresa,
  canEditFotos,
}: {
  fotoEmpresa: string | null;
  canEditFotos: boolean;
}) => (
  <div className="relative z-10 flex shrink-0 flex-col items-center">
    <div className="relative z-10 h-28 w-28">
      <div
        className="pointer-events-none absolute -inset-[9px] rounded-full border-[7px] border-r-transparent border-soaco-gold"
        aria-hidden="true"
      />
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-soaco-navy text-3xl font-bold text-white shadow-level-2 ring-4 ring-card">
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
      {canEditFotos && (
        <FotoConfigUploadButton
          configKey={FOTO_EMPRESA_KEY}
          nome="Só Aço Industrial Ltda."
          className="bottom-0 right-0"
        />
      )}
    </div>
    <div className="relative -mt-4">
      <span className="absolute -top-2.5 right-5 z-10 rounded-full bg-soaco-navy px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white shadow-level-1">
        Empresa
      </span>
      <div className="rounded-full border border-soaco-navy/25 bg-card px-10 py-3.5 text-center shadow-level-2 dark:border-white/20">
        <p className="text-base font-bold text-soaco-navy dark:text-primary-100">
          Só Aço Industrial Ltda.
        </p>
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Organização
        </p>
      </div>
    </div>
  </div>
);

const Organograma = () => {
  const [abaAtiva, setAbaAtiva] = useState<OrganogramaAba>("hierarquia");
  const [setorSelecionado, setSetorSelecionado] = useState<SetorSelecionadoMapa | null>(null);
  const [mapaFullscreen, setMapaFullscreen] = useState(false);
  const mapaShellRef = useRef<HTMLDivElement>(null);
  const podeBuscarFotos = isApiConfigured() && canViewOrganicoPhotos();
  const canEditFotos = canEditOrganogramaFotos();
  const canEditVinculos = canEditRoute("/organograma");
  const fotoEmpresa = useOrganogramaFotoConfig(FOTO_EMPRESA_KEY);
  const { ref: mapaRef, isPanning: mapaEmArraste } = useQuadroPan();

  useEffect(() => {
    const onFullscreenChange = () => {
      setMapaFullscreen(document.fullscreenElement === mapaShellRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const alternarMapaTelaCheia = useCallback(async () => {
    const el = mapaShellRef.current;
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

  const { data: fotosResumo = [] } = useQuery({
    queryKey: ["organico-fotos-resumo"],
    queryFn: getOrganicoFotosResumo,
    enabled: podeBuscarFotos,
    staleTime: 5 * 60 * 1000,
  });
  const { data: organicoRows = [] } = useQuery({
    queryKey: ["organico"],
    queryFn: getOrganico,
    staleTime: 60_000,
  });
  const { data: vinculacoesRaw } = useQuery({
    queryKey: ["organograma-vinculacoes"],
    queryFn: async () => (await getConfig(ORGANOGRAMA_VINCULACOES_CONFIG_KEY)).value,
    staleTime: 30_000,
  });

  const matriculasComFoto = useMemo(
    () =>
      new Set(
        fotosResumo
          .map((foto) => String(foto.colaboradorMatricula ?? "").trim())
          .filter(Boolean),
      ),
    [fotosResumo],
  );

  const contagemPorSetor = useMemo(
    () => contarColaboradoresPorSetorSoAco(organicoRows),
    [organicoRows],
  );

  const setoresAtivos = useMemo(() => {
    const bySetor = new Map<string, { setor: string; area: string }>();
    for (const row of organicoRows) {
      const values = Array.isArray(row.values) ? row.values : [];
      if (!STATUS_VALIDOS.has(getStatusFromRow(values))) continue;
      const setor = cell(values, ORGANICO_IDX.SETOR);
      if (!setor) continue;
      const key = normalizarChave(setor);
      const prev = bySetor.get(key);
      if (!prev) {
        bySetor.set(key, { setor, area: cell(values, ORGANICO_IDX.AREA) });
      } else if (!prev.area) {
        prev.area = cell(values, ORGANICO_IDX.AREA);
      }
    }
    return [...bySetor.values()];
  }, [organicoRows]);

  const diretorias = useMemo(() => {
    const salvos = parseOrganogramaVinculacoes(vinculacoesRaw);
    const merged = mergeVinculacoesComSetores(setoresAtivos, salvos);
    return buildDiretoriasTree(merged.filter((item) => item.diretoriaId));
  }, [vinculacoesRaw, setoresAtivos]);

  const totalAreas = diretorias.reduce((total, diretoria) => total + diretoria.areas.length, 0);
  const totalSetores = diretorias.reduce(
    (total, diretoria) =>
      total + diretoria.areas.reduce((subtotal, area) => subtotal + area.setores.length, 0),
    0,
  );

  return (
    <AppLayout>
      <div className="py-8 px-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Estrutura Organizacional</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Consultas de organograma da Só Aço Industrial Ltda.: hierarquia, mapa de vínculos e configurações.
          </p>
        </div>

        <Tabs
          value={abaAtiva}
          onValueChange={(value) => setAbaAtiva(value as OrganogramaAba)}
          className="space-y-6"
        >
          <TabsList className="inline-flex h-auto min-h-10 w-max min-w-max flex-nowrap justify-start gap-1 whitespace-nowrap bg-muted/80 p-1">
            <TabsTrigger value="hierarquia" className="shrink-0 text-xs sm:text-sm px-3 sm:px-4">
              Hierarquia
            </TabsTrigger>
            <TabsTrigger value="mapa-vinculos" className="shrink-0 text-xs sm:text-sm px-3 sm:px-4">
              Mapa de Vínculos Organizacionais
            </TabsTrigger>
            <TabsTrigger value="configuracoes" className="shrink-0 text-xs sm:text-sm px-3 sm:px-4">
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hierarquia" className="mt-0 space-y-4 focus-visible:outline-none">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Hierarquia</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Estrutura de gestão da empresa: diretorias, áreas e equipes.
              </p>
            </div>
            <OrganogramaHierarquiaPanel
              diretorias={diretorias}
              organicoRows={organicoRows}
              matriculasComFoto={matriculasComFoto}
              podeBuscarFotos={podeBuscarFotos}
            />
          </TabsContent>

          <TabsContent value="mapa-vinculos" className="mt-0 space-y-4 focus-visible:outline-none">
            <div
              ref={mapaShellRef}
              className={cn(
                "space-y-4",
                mapaFullscreen && "flex h-full flex-col gap-3 space-y-0 bg-background p-4",
              )}
            >
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Mapa de Vínculos Organizacionais</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Setores vinculados a cada diretoria.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md border border-border bg-card px-3 py-2 font-semibold text-foreground shadow-level-1">
                    {diretorias.length} diretorias
                  </span>
                  <span className="rounded-md border border-border bg-card px-3 py-2 font-semibold text-foreground shadow-level-1">
                    {totalAreas} áreas
                  </span>
                  <span className="rounded-md border border-border bg-card px-3 py-2 font-semibold text-foreground shadow-level-1">
                    {totalSetores} setores
                  </span>
                  {totalSetores > 0 && (
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 font-semibold shadow-level-1 hover:bg-muted hover:text-foreground",
                        mapaFullscreen
                          ? "bg-soaco-navy text-white hover:bg-soaco-navy/90 hover:text-white"
                          : "bg-card text-muted-foreground",
                      )}
                      title={mapaFullscreen ? "Sair da tela cheia (Esc)" : "Tela cheia"}
                      onClick={() => void alternarMapaTelaCheia()}
                    >
                      {mapaFullscreen ? (
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
                  )}
                </div>
              </div>

              {totalSetores === 0 ? (
                <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center shadow-level-1">
                  <div className="max-w-md space-y-2">
                    <p className="text-sm font-semibold text-foreground">Nenhum vínculo configurado</p>
                    <p className="text-sm text-muted-foreground">
                      Abra a aba Configurações para vincular os setores às diretorias e definir os líderes.
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  ref={mapaRef}
                  className={cn(
                    "org-canvas touch-none overflow-auto rounded-xl border p-6 sm:p-8",
                    mapaFullscreen ? "min-h-0 flex-1" : "max-h-[min(78vh,900px)]",
                    classesQuadroPan(mapaEmArraste),
                  )}
                >
                  <div className="flex w-max min-w-full items-center py-2">
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex flex-row items-center"
                    >
                      <EmpresaNode fotoEmpresa={fotoEmpresa} canEditFotos={canEditFotos} />
                      <ConectorHorizontal className="w-8" />
                      <div className="flex flex-col gap-10">
                        {diretorias.map((diretoria, i) => (
                          <div key={diretoria.id} className="relative flex flex-row items-center">
                            {/* Trilho vertical entre diretorias (centro de cada ramo). */}
                            {i > 0 && (
                              <div
                                className={cn(
                                  "pointer-events-none absolute bottom-1/2 left-0 h-[calc(50%+1.25rem)] w-[2px]",
                                  LINHA_MAPA,
                                )}
                                aria-hidden="true"
                              />
                            )}
                            {i < diretorias.length - 1 && (
                              <div
                                className={cn(
                                  "pointer-events-none absolute top-1/2 left-0 h-[calc(50%+1.25rem)] w-[2px]",
                                  LINHA_MAPA,
                                )}
                                aria-hidden="true"
                              />
                            )}
                            <div className={cn("h-[2px] w-5 shrink-0", LINHA_MAPA)} aria-hidden="true" />
                            <DiretoriaBranch
                              diretoria={diretoria}
                              delay={0.08 * (i + 1)}
                              canEditFotos={canEditFotos}
                              contagemPorSetor={contagemPorSetor}
                              onSelecionarSetor={setSetorSelecionado}
                            />
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="configuracoes" className="mt-0 focus-visible:outline-none">
            <OrganogramaVinculosConfigPanel canEdit={canEditVinculos} />
          </TabsContent>
        </Tabs>

        <OrganogramaSetorMembrosDialog
          open={setorSelecionado != null}
          onOpenChange={(open) => {
            if (!open) setSetorSelecionado(null);
          }}
          selecionado={setorSelecionado}
          organicoRows={organicoRows}
          matriculasComFoto={matriculasComFoto}
          podeBuscarFotos={podeBuscarFotos}
        />
      </div>
    </AppLayout>
  );
};

export default Organograma;
