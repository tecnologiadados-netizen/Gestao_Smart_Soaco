import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@rh/components/AppLayout";
import { motion } from "framer-motion";
import { Camera } from "lucide-react";
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
  LIDER_A_DEFINIR,
  ORGANOGRAMA_VINCULACOES_CONFIG_KEY,
  buildDiretoriasTree,
  mergeVinculacoesComSetores,
  normalizarChave,
  parseOrganogramaVinculacoes,
  type DiretoriaTree,
} from "@rh/lib/organograma-vinculacoes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rh/components/ui/tabs";
import { useOrganicoCardFoto } from "@rh/pages/Organico/useOrganicoCardFoto";
import { useToast } from "@rh/hooks/use-toast";
import { ORGANICO_IDX, getStatusFromRow } from "@rh/pages/Organico/organico-derive";
import { OrganogramaVinculosConfigPanel } from "@rh/pages/organograma/OrganogramaVinculosConfigPanel";

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

/** Avatar circular com moldura branca + meio-anel colorido à esquerda (estilo da referência). */
const AvatarComArco = ({
  nome,
  fotoSrc,
  nivel,
  destaque = false,
  pendente = false,
}: {
  nome: string;
  fotoSrc?: string | null;
  nivel: NivelVisual;
  destaque?: boolean;
  /** Setor sem líder imediato definido: avatar neutro com "?". */
  pendente?: boolean;
}) => {
  const estilos = NIVEL_ESTILOS[nivel];
  return (
    <div className={`relative shrink-0 ${destaque ? "h-[88px] w-[88px]" : "h-16 w-16"}`}>
      <div
        className={`pointer-events-none absolute rounded-full border-r-transparent ${
          destaque ? "-inset-[8px] border-[6px]" : "-inset-[6px] border-[5px]"
        } ${pendente ? "border-dashed border-muted-foreground/50" : estilos.arco}`}
        aria-hidden="true"
      />
      <div
        className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full font-bold shadow-level-2 ring-4 ring-card ${
          pendente ? "bg-muted text-muted-foreground" : estilos.avatar
        } ${destaque ? "text-lg" : "text-sm"}`}
      >
        {pendente ? (
          <span className="text-lg" aria-hidden="true">?</span>
        ) : fotoSrc ? (
          <img src={fotoSrc} alt={`Foto de ${nome}`} className="h-full w-full object-cover" />
        ) : (
          iniciais(nome)
        )}
      </div>
    </div>
  );
};

const NivelBadge = ({ rotulo, nivel }: { rotulo: string; nivel: NivelVisual }) => (
  <span
    className={`absolute -top-2 right-6 z-20 rounded-full px-3 py-1 text-[8px] font-bold uppercase tracking-widest shadow-level-1 ${NIVEL_ESTILOS[nivel].badge}`}
  >
    {rotulo}
  </span>
);

const PillCard = ({
  nome,
  subtitulo,
  rotulo,
  nivel,
  destaque = false,
  matricula = "",
  fotoDisponivel = false,
  podeBuscarFoto = false,
  fotoConfigKey,
  canEditFoto = false,
}: {
  nome: string;
  subtitulo?: string;
  rotulo: string;
  nivel: NivelVisual;
  /** Cartão maior, com foto em evidência (empresa e diretorias). */
  destaque?: boolean;
  matricula?: string;
  fotoDisponivel?: boolean;
  podeBuscarFoto?: boolean;
  /** Foto via rh_config (cards sem colaborador no Orgânico). */
  fotoConfigKey?: string;
  canEditFoto?: boolean;
}) => {
  const estilos = NIVEL_ESTILOS[nivel];
  const { rootRef, fotoSrc } = useOrganicoCardFoto({
    matricula,
    nome,
    fotoDisponivel,
    podeBuscar: podeBuscarFoto,
  });
  const fotoConfigSrc = useOrganogramaFotoConfig(fotoConfigKey);
  const fotoExibida = fotoConfigSrc ?? fotoSrc;
  const pendente = nome === LIDER_A_DEFINIR;

  return (
    <div ref={rootRef} className={`relative ml-2 pl-2 ${destaque ? "mt-4 pb-3" : "mt-3 pb-2"}`}>
      <NivelBadge rotulo={rotulo} nivel={nivel} />
      <div
        className={`relative flex items-center rounded-full border border-border/40 bg-card shadow-level-2 transition-shadow hover:shadow-level-3 ${
          destaque
            ? "min-h-[76px] w-[320px] py-3 pl-[104px] pr-8"
            : "min-h-[58px] w-[250px] py-2 pl-[76px] pr-6"
        }`}
      >
        <div className="absolute -left-3 top-1/2 z-10 -translate-y-1/2">
          <AvatarComArco nome={nome} fotoSrc={fotoExibida} nivel={nivel} destaque={destaque} pendente={pendente} />
          {fotoConfigKey && canEditFoto && (
            <FotoConfigUploadButton configKey={fotoConfigKey} nome={nome} className="-bottom-1 -right-1" />
          )}
        </div>
        <div className="min-w-0 text-left">
          <p
            className={`font-bold leading-tight ${pendente ? "italic text-muted-foreground" : estilos.texto} ${
              destaque ? "text-base" : "text-sm"
            }`}
          >
            {pendente ? "Líder a definir" : nome}
          </p>
          {subtitulo && (
            <p
              className={`mt-0.5 font-bold uppercase tracking-wider text-muted-foreground ${
                destaque ? "text-[10px]" : "text-[9px]"
              }`}
            >
              {subtitulo}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const DiretoriaBranch = ({
  diretoria,
  delay,
  matriculasComFoto,
  podeBuscarFotos,
  canEditFotos,
}: {
  diretoria: DiretoriaTree;
  delay: number;
  matriculasComFoto: Set<string>;
  podeBuscarFotos: boolean;
  canEditFotos: boolean;
}) => {
  const setoresComArea = diretoria.areas.flatMap((area) =>
    area.setores.map((info) => ({ area: area.nome, info })),
  );
  /** Colunas por diretoria: 2 para poucas equipes, 3 para muitas (usa melhor a largura da tela). */
  const colunas = Math.min(3, Math.max(2, Math.ceil(setoresComArea.length / 6)));
  const larguraGrade = colunas * 270 + (colunas - 1) * 16;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="flex flex-col items-center"
    >
      <PillCard
        nome={diretoria.diretor}
        subtitulo={diretoria.nome}
        rotulo="Diretoria"
        nivel="diretoria"
        destaque
        fotoConfigKey={diretoria.fotoKey}
        canEditFoto={canEditFotos}
      />
      <div className="h-6 w-px bg-border" />
      <div
        className="flex flex-wrap justify-center gap-x-4 gap-y-4 pt-1"
        style={{ maxWidth: `${larguraGrade}px` }}
      >
        {setoresComArea.map(({ area, info }) => (
          <PillCard
            key={`${area}-${info.nome}`}
            nome={info.lider}
            subtitulo={`${info.nome} · ${area}`}
            rotulo="Setor"
            nivel="setor"
            matricula={info.matricula}
            fotoDisponivel={Boolean(info.matricula && matriculasComFoto.has(info.matricula))}
            podeBuscarFoto={podeBuscarFotos}
          />
        ))}
      </div>
    </motion.div>
  );
};

const Organograma = () => {
  const [abaAtiva, setAbaAtiva] = useState<OrganogramaAba>("mapa-vinculos");
  const podeBuscarFotos = isApiConfigured() && canViewOrganicoPhotos();
  const canEditFotos = canEditOrganogramaFotos();
  const canEditVinculos = canEditRoute("/organograma");
  const fotoEmpresa = useOrganogramaFotoConfig(FOTO_EMPRESA_KEY);

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
            Consultas de organograma da Só Aço Industrial Ltda.: mapa de vínculos, hierarquia e configurações.
          </p>
        </div>

        <Tabs
          value={abaAtiva}
          onValueChange={(value) => setAbaAtiva(value as OrganogramaAba)}
          className="space-y-6"
        >
          <TabsList className="inline-flex h-auto min-h-10 w-max min-w-max flex-nowrap justify-start gap-1 whitespace-nowrap bg-muted/80 p-1">
            <TabsTrigger value="mapa-vinculos" className="shrink-0 text-xs sm:text-sm px-3 sm:px-4">
              Mapa de Vínculos Organizacionais
            </TabsTrigger>
            <TabsTrigger value="hierarquia" className="shrink-0 text-xs sm:text-sm px-3 sm:px-4">
              Hierarquia
            </TabsTrigger>
            <TabsTrigger value="configuracoes" className="shrink-0 text-xs sm:text-sm px-3 sm:px-4">
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mapa-vinculos" className="mt-0 space-y-4 focus-visible:outline-none">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Mapa de Vínculos Organizacionais</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Quais setores respondem a cada diretoria e quem é o líder imediato de cada setor.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="border border-border bg-card px-3 py-2 font-semibold text-foreground">
                  {diretorias.length} diretorias
                </span>
                <span className="border border-border bg-card px-3 py-2 font-semibold text-foreground">
                  {totalAreas} áreas
                </span>
                <span className="border border-border bg-card px-3 py-2 font-semibold text-foreground">
                  {totalSetores} setores
                </span>
              </div>
            </div>

            {totalSetores === 0 ? (
              <div className="flex min-h-[280px] items-center justify-center border border-dashed border-border bg-muted/20 p-10 text-center shadow-level-1">
                <div className="max-w-md space-y-2">
                  <p className="text-sm font-semibold text-foreground">Nenhum vínculo configurado</p>
                  <p className="text-sm text-muted-foreground">
                    Abra a aba Configurações para vincular os setores às diretorias e definir os líderes.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto border border-border bg-muted/30 p-8 shadow-level-1">
                <div className="flex w-max min-w-full justify-center">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center"
                  >
                    <div className="flex flex-col items-center">
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
                          Nível A
                        </span>
                        <div className="rounded-full border border-border/50 bg-card px-14 py-3.5 text-center shadow-level-2">
                          <p className="text-lg font-bold text-soaco-navy dark:text-primary-100">
                            Só Aço Industrial Ltda.
                          </p>
                          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Empresa
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="h-6 w-px bg-border" />
                    <div className="relative flex gap-8">
                      <div
                        className="absolute top-0 left-1/2 h-px -translate-x-1/2 bg-border"
                        style={{ width: "calc(100% - 230px)" }}
                      />
                      {diretorias.map((diretoria, i) => (
                        <div key={diretoria.id} className="flex flex-col items-center">
                          <div className="h-6 w-px bg-border" />
                          <DiretoriaBranch
                            diretoria={diretoria}
                            delay={0.1 * (i + 1)}
                            matriculasComFoto={matriculasComFoto}
                            podeBuscarFotos={podeBuscarFotos}
                            canEditFotos={canEditFotos}
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="hierarquia" className="mt-0 focus-visible:outline-none">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">Hierarquia</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Organograma de hierarquia de lideranças e subordinados.
              </p>
            </div>
            <div className="flex min-h-[320px] items-center justify-center border border-dashed border-border bg-muted/20 p-10 text-center shadow-level-1">
              <div className="max-w-md space-y-2">
                <p className="text-sm font-semibold text-foreground">Aba em construção</p>
                <p className="text-sm text-muted-foreground">
                  Aqui vamos montar o organograma de hierarquia. O mapa de vínculos permanece na aba Mapa de
                  Vínculos Organizacionais.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="configuracoes" className="mt-0 focus-visible:outline-none">
            <OrganogramaVinculosConfigPanel canEdit={canEditVinculos} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Organograma;
