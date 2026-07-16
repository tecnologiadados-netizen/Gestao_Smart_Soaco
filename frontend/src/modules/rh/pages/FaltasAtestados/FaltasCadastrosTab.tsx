import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@rh/components/ui/input";
import { Button } from "@rh/components/ui/button";
import { Save, Plus, Trash2, Search, Upload, Download } from "lucide-react";
import { useToast } from "@rh/hooks/use-toast";
import { useSavingOverlay } from "@rh/contexts/saving-overlay-context";
import {
  getFaltasCadastros,
  replaceFaltasCadastros,
  isApiConfigured,
} from "@rh/lib/api-client";
import type { FaltaCadastrosData, FaltaCadastroItem } from "@rh/types/api";
import { useFaltasAtestadosExcel, parseCadastrosExcelFile } from "@rh/pages/FaltasAtestados/useFaltasAtestadosExcel";
import { randomUUID } from "@rh/lib/utils";
import { textIncludesSearch } from "@rh/lib/normalize-search-text";
import {
  readFaltasCadastrosFilters,
  writeFaltasCadastrosFilters,
} from "@rh/pages/FaltasAtestados/faltas-ui-filters-persistence";
import GruposSintomasColumn from "@rh/pages/FaltasAtestados/GruposSintomasColumn";
import {
  getFaltasGruposSintomasCid,
  replaceFaltasGruposSintomasCid,
} from "@rh/lib/grupos-sintomas-cid-storage";
import { syncGruposSintomasComCadastro, normalizarParaLinhaCadastro } from "@rh/lib/grupos-sintomas-cid-utils";
import type { FaltaGrupoSintomaCidRow } from "@rh/types/api";
import {
  type FaltaTipoRegra,
  normalizeTipoRegraKey,
  classificarTipoFallback,
} from "@rh/pages/FaltasAtestados/faltas-tipos-regras";

type LocalItem = { id: string; valor: string };
type TipoRegraLocal = FaltaTipoRegra;
const FALTAS_TIPOS_REGRAS_VISIBLE_KEY = "faltas_tipos_regras_visible";

function apiItemToLocal(i: FaltaCadastroItem): LocalItem {
  return { id: i.id || randomUUID(), valor: i.valor };
}

function sortLocalByValor(items: LocalItem[]): LocalItem[] {
  return [...items].sort((a, b) => a.valor.localeCompare(b.valor, "pt-BR", { sensitivity: "base" }));
}

function bundleToLocals(data: FaltaCadastrosData): {
  periodos: LocalItem[];
  tipos: LocalItem[];
  cids: LocalItem[];
  tiposSancoes: LocalItem[];
  categoriasDocumentos: LocalItem[];
} {
  return {
    periodos: sortLocalByValor(data.periodos.map(apiItemToLocal)),
    tipos: sortLocalByValor(data.tipos.map(apiItemToLocal)),
    cids: sortLocalByValor(data.cids.map(apiItemToLocal)),
    tiposSancoes: sortLocalByValor((data.tiposSancoes ?? []).map(apiItemToLocal)),
    categoriasDocumentos: sortLocalByValor((data.categoriasDocumentos ?? []).map(apiItemToLocal)),
  };
}

function localsToCadastrosData(
  p: LocalItem[],
  t: LocalItem[],
  c: LocalItem[],
  s: LocalItem[],
  d: LocalItem[],
): FaltaCadastrosData {
  const withOrd = (items: LocalItem[]) =>
    sortLocalByValor(items).map((x, i) => ({ id: x.id, ordem: i + 1, valor: x.valor }));
  return {
    periodos: withOrd(p),
    tipos: withOrd(t),
    cids: withOrd(c),
    tiposSancoes: withOrd(s),
    categoriasDocumentos: withOrd(d),
  };
}

function sortAlphaTrimmed(vals: string[]): string[] {
  return [...vals]
    .map((x) => x.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}

function stringsToLocals(vals: string[]): LocalItem[] {
  return vals.map((valor) => ({ id: `imp-${randomUUID()}`, valor }));
}

function buildTiposRegrasFromApiTipos(tiposApi: FaltaCadastroItem[]): TipoRegraLocal[] {
  const map = new Map<string, TipoRegraLocal>();
  for (const item of tiposApi) {
    const tipo = String(item.valor ?? "").trim();
    const key = normalizeTipoRegraKey(tipo);
    if (!tipo || !key) continue;
    const contabilizaIndicadores = item.contabilizaIndicadores !== false;
    const classificacao = contabilizaIndicadores
      ? item.classificacaoIndicador === "justificada" || item.classificacaoIndicador === "injustificada"
        ? item.classificacaoIndicador
        : classificarTipoFallback(tipo)
      : null;
    map.set(key, {
      tipo,
      contabilizaIndicadores,
      classificacao,
      exibirNoDetalhamento: item.exibirNoDetalhamento !== false,
    });
  }
  return [...map.values()].sort((a, b) => a.tipo.localeCompare(b.tipo, "pt-BR"));
}

/** Alinha o cache do React Query com o que acabou de ser gravado (ordem do arquivo, sem reordenar alfabeticamente). */
function cadastroBundleFromStringLists(parsed: {
  periodos: string[];
  tipos: string[];
  cids: string[];
  tiposSancoes: string[];
  categoriasDocumentos?: string[];
}): FaltaCadastrosData {
  const items = (arr: string[]) =>
    arr
      .map((x) => String(x).trim())
      .filter(Boolean)
      .map((valor, i) => ({ id: `sync-${i}-${randomUUID()}`, ordem: i + 1, valor }));
  return {
    periodos: items(parsed.periodos),
    tipos: items(parsed.tipos),
    cids: items(parsed.cids),
    tiposSancoes: items(parsed.tiposSancoes),
    categoriasDocumentos: items(parsed.categoriasDocumentos ?? []),
  };
}

function CadastroColumn({
  title,
  items,
  setItems,
  canEdit = true,
  search,
  setSearch,
  searchPlaceholder,
}: {
  title: string;
  items: LocalItem[];
  setItems: React.Dispatch<React.SetStateAction<LocalItem[]>>;
  canEdit?: boolean;
  search: string;
  setSearch: (s: string) => void;
  searchPlaceholder: string;
}) {
  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    return items.filter((it) => textIncludesSearch(it.valor, search));
  }, [items, search]);

  const update = useCallback(
    (id: string, valor: string) =>
      setItems((prev) => prev.map((r) => (r.id === id ? { ...r, valor } : r))),
    [setItems],
  );

  const remove = useCallback(
    (id: string) => setItems((prev) => prev.filter((r) => r.id !== id)),
    [setItems],
  );

  const add = useCallback(() => {
    setItems((prev) => [...prev, { id: `new-${randomUUID()}`, valor: "" }]);
  }, [setItems]);

  return (
    <div className="border border-border rounded-sm bg-card shadow-level-1 flex flex-col min-h-[280px] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-muted/60 border-b border-border">
        <span className="text-xs font-semibold tracking-wide text-foreground">{title}</span>
        {canEdit ? (
          <Button type="button" variant="outline" size="sm" onClick={add} className="h-8 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> Linha
          </Button>
        ) : null}
      </div>
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>
      <div className="overflow-auto flex-1 max-h-[calc(100vh-320px)]">
        {filtered.map((it, idx) => (
          <div
            key={it.id}
            className={`group flex gap-1 p-1.5 border-b border-border last:border-b-0 ${
              idx % 2 === 0 ? "bg-card" : "bg-muted/15"
            } hover:bg-accent/5`}
          >
            <textarea
              value={it.valor}
              onChange={(e) => update(it.id, e.target.value)}
              rows={2}
              disabled={!canEdit}
              className="flex-1 min-h-[2.25rem] px-2 py-1 text-sm bg-transparent border border-border/60 rounded-sm focus:ring-1 focus:ring-ring resize-y max-h-28"
            />
            {canEdit ? (
              <button
                type="button"
                onClick={() => remove(it.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-destructive hover:bg-destructive/10 rounded-sm self-start"
                aria-label={`Remover item de ${title}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-10 text-center text-muted-foreground text-xs">Nenhum item.</div>
        )}
      </div>
      <div className="text-[11px] text-muted-foreground px-2.5 py-1.5 border-t border-border bg-muted/30">
        {filtered.length} de {items.length} linhas
      </div>
    </div>
  );
}

export default function FaltasCadastrosTab({
  canEdit = true,
  canViewTiposRegras = true,
  canEditTiposRegras = true,
}: {
  canEdit?: boolean;
  canViewTiposRegras?: boolean;
  canEditTiposRegras?: boolean;
}) {
  const queryClient = useQueryClient();
  const { runWithSaving } = useSavingOverlay();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { exportToExcel } = useFaltasAtestadosExcel();
  const savedFilters = readFaltasCadastrosFilters();
  const {
    data: apiBundle,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["faltas-cadastros"],
    queryFn: getFaltasCadastros,
    retry: 1,
  });
  const { data: gruposApi = [] } = useQuery({
    queryKey: ["faltas-grupos-sintomas"],
    queryFn: getFaltasGruposSintomasCid,
  });
  const [periodos, setPeriodos] = useState<LocalItem[]>([]);
  const [tipos, setTipos] = useState<LocalItem[]>([]);
  const [cids, setCids] = useState<LocalItem[]>([]);
  const [tiposSancoes, setTiposSancoes] = useState<LocalItem[]>([]);
  const [categoriasDocumentos, setCategoriasDocumentos] = useState<LocalItem[]>([]);
  const [sp, setSp] = useState(() => savedFilters.sp ?? "");
  const [st, setSt] = useState(() => savedFilters.st ?? "");
  const [sc, setSc] = useState(() => savedFilters.sc ?? "");
  const [ss, setSs] = useState(() => savedFilters.ss ?? "");
  const [sdoc, setSdoc] = useState(() => savedFilters.sdoc ?? "");
  const [sg, setSg] = useState(() => savedFilters.sg ?? "");
  const [gruposSintomas, setGruposSintomas] = useState<FaltaGrupoSintomaCidRow[]>([]);
  const [tiposRegras, setTiposRegras] = useState<TipoRegraLocal[]>([]);
  const [regrasVisible, setRegrasVisible] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(FALTAS_TIPOS_REGRAS_VISIBLE_KEY);
      return raw == null ? true : raw !== "0";
    } catch {
      return true;
    }
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    writeFaltasCadastrosFilters({ sp, st, sc, ss, sdoc, sg });
  }, [sp, st, sc, ss, sdoc, sg]);

  useEffect(() => {
    if (!gruposApi.length) return;
    const cidsValores = cids.map((c) => c.valor.trim()).filter(Boolean);
    setGruposSintomas(syncGruposSintomasComCadastro(gruposApi, cidsValores));
  }, [gruposApi, cids]);

  useEffect(() => {
    if (!apiBundle) {
      setPeriodos([]);
      setTipos([]);
      setCids([]);
      setTiposSancoes([]);
      setCategoriasDocumentos([]);
      return;
    }
    const loc = bundleToLocals(apiBundle);
    setPeriodos(loc.periodos);
    setTipos(loc.tipos);
    setCids(loc.cids);
    setTiposSancoes(loc.tiposSancoes);
    setCategoriasDocumentos(loc.categoriasDocumentos);
    setTiposRegras(buildTiposRegrasFromApiTipos(apiBundle.tipos));
  }, [apiBundle]);

  useEffect(() => {
    try {
      localStorage.setItem(FALTAS_TIPOS_REGRAS_VISIBLE_KEY, regrasVisible ? "1" : "0");
    } catch {
      // ignore
    }
  }, [regrasVisible]);

  useEffect(() => {
    if (tipos.length === 0) return;
    setTiposRegras((prev) => {
      const map = new Map(prev.map((r) => [normalizeTipoRegraKey(r.tipo), r] as const));
      const tiposOrdenados = sortAlphaTrimmed(tipos.map((x) => x.valor));
      const next: TipoRegraLocal[] = [];
      for (const tipo of tiposOrdenados) {
        const key = normalizeTipoRegraKey(tipo);
        const existing = map.get(key);
        if (existing) {
          next.push({ ...existing, tipo });
          continue;
        }
        const fallback = classificarTipoFallback(tipo);
        next.push({
          tipo,
          contabilizaIndicadores: true,
          classificacao: fallback,
          exibirNoDetalhamento: true,
        });
      }
      return next;
    });
  }, [tipos]);

  const payloadFromState = useCallback(() => {
    return {
      periodos: sortAlphaTrimmed(periodos.map((x) => x.valor)),
      tipos: sortAlphaTrimmed(tipos.map((x) => x.valor)),
      cids: sortAlphaTrimmed(cids.map((x) => x.valor)),
      tiposSancoes: sortAlphaTrimmed(tiposSancoes.map((x) => x.valor)),
      categoriasDocumentos: sortAlphaTrimmed(categoriasDocumentos.map((x) => x.valor)),
      tiposRegras: tiposRegras.map((r) => ({
        tipo: r.tipo,
        contabilizaIndicadores: r.contabilizaIndicadores,
        classificacaoIndicador: r.contabilizaIndicadores ? r.classificacao ?? null : null,
        exibirNoDetalhamento: r.exibirNoDetalhamento,
      })),
    };
  }, [periodos, tipos, cids, tiposSancoes, categoriasDocumentos, tiposRegras]);

  const handleSave = async () => {
    if (isSaving) return;
    const body = payloadFromState();
    const total =
      body.periodos.length +
      body.tipos.length +
      body.cids.length +
      body.tiposSancoes.length +
      body.categoriasDocumentos.length;
    if (total === 0 && gruposSintomas.length === 0) {
      toast({
        title: "Gravação bloqueada",
        description: "O sistema não permite substituir todos os cadastros por uma lista vazia.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      await runWithSaving(async () => {
        await replaceFaltasGruposSintomasCid(gruposSintomas);
        void queryClient.invalidateQueries({ queryKey: ["faltas-grupos-sintomas"] });
        if (!isApiConfigured()) {
          toast({
            title: "Grupos de sintomas salvos",
            description: "CIDs correlatos gravados localmente. Defina VITE_API_URL para salvar demais cadastros no banco.",
          });
          return;
        }
        if (total === 0) {
          toast({
            title: "Grupos de sintomas salvos",
            description: "Demais listas vazias — apenas grupos de sintomas foram atualizados.",
          });
          return;
        }
        const res = await replaceFaltasCadastros(body);
        const refreshed = await getFaltasCadastros();
        void queryClient.setQueryData(["faltas-cadastros"], refreshed);
        const savedCategorias = (refreshed.categoriasDocumentos ?? []).map((x) => x.valor.trim()).filter(Boolean);
        const sentCategorias = body.categoriasDocumentos.map((x) => String(x).trim()).filter(Boolean);
        const categoriasPersistidas =
          sentCategorias.length === 0 ||
          sentCategorias.every((valor) => savedCategorias.some((s) => s.localeCompare(valor, "pt-BR", { sensitivity: "base" }) === 0));
        toast({
          title: categoriasPersistidas ? "Cadastros salvos" : "Salvo parcialmente",
          description: categoriasPersistidas
            ? `${res.inserted} valor(es) gravados com regras persistidas no banco.`
            : `${res.inserted} valor(es) gravados, mas as categorias de documentos não voltaram do banco. Confira se a migration 20260612101000 e o deploy de get/replace-faltas-cadastros foram feitos.`,
          variant: categoriasPersistidas ? "default" : "destructive",
        });
      }, "Salvando cadastros…");
    } catch (err) {
      toast({
        title: "Erro ao gravar",
        description: err instanceof Error ? err.message : "Não foi possível gravar.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".xlsx") && !file.name.toLowerCase().endsWith(".xls")) {
        toast({ title: "Arquivo inválido", description: "Selecione um arquivo Excel (.xlsx ou .xls).", variant: "destructive" });
        return;
      }
      try {
        const parsed = await parseCadastrosExcelFile(file);
        const n =
          parsed.periodos.length +
          parsed.tipos.length +
          parsed.cids.length +
          parsed.tiposSancoes.length;
        if (n === 0) {
          toast({ title: "Aba vazia", description: "Nenhum valor na aba Cadastros.", variant: "destructive" });
          return;
        }
        setPeriodos(stringsToLocals(parsed.periodos));
        setTipos(stringsToLocals(parsed.tipos));
        setCids(stringsToLocals(parsed.cids));
        setTiposSancoes(stringsToLocals(parsed.tiposSancoes));
        if (isApiConfigured()) {
          await runWithSaving(async () => {
            await replaceFaltasCadastros({
              periodos: parsed.periodos,
              tipos: parsed.tipos,
              cids: parsed.cids,
              tiposSancoes: parsed.tiposSancoes,
            });
            queryClient.setQueryData(["faltas-cadastros"], cadastroBundleFromStringLists(parsed));
          }, "Importando cadastros…");
          toast({
            title: "Importação concluída",
            description: `${parsed.periodos.length} período(s), ${parsed.tipos.length} tipo(s), ${parsed.cids.length} CID(s), ${parsed.tiposSancoes.length} tipo(s) de sanção importados e salvos.`,
          });
        } else {
          toast({
            title: "Importação local",
            description: "Listas carregadas na tela. Configure a API para gravar.",
          });
        }
      } catch {
        toast({ title: "Erro na importação", description: "Não foi possível ler o arquivo.", variant: "destructive" });
      }
    },
    [queryClient, toast, runWithSaving],
  );

  const handleExport = useCallback(async () => {
    const bundle = localsToCadastrosData(periodos, tipos, cids, tiposSancoes, categoriasDocumentos);
    const hasAny =
      bundle.periodos.some((x) => x.valor.trim()) ||
      bundle.tipos.some((x) => x.valor.trim()) ||
      bundle.cids.some((x) => x.valor.trim()) ||
      bundle.tiposSancoes.some((x) => x.valor.trim()) ||
      bundle.categoriasDocumentos.some((x) => x.valor.trim());
    if (!hasAny) {
      toast({ title: "Nada para exportar", description: "Inclua ao menos um valor em alguma lista.", variant: "destructive" });
      return;
    }
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await exportToExcel([], bundle, `faltas-cadastros_${stamp}.xlsx`);
      toast({
        title: "Exportação concluída",
        description: "Planilha com aba Cadastros (quatro colunas: período, tipo, CID, tipos de sanções).",
      });
    } catch {
      toast({ title: "Erro na exportação", description: "Não foi possível gerar o arquivo.", variant: "destructive" });
    }
  }, [periodos, tipos, cids, tiposSancoes, categoriasDocumentos, exportToExcel, toast]);

  const cidsCadastro = useMemo(
    () => cids.map((c) => c.valor.trim()).filter(Boolean),
    [cids],
  );
  const totalCidsGrupos = useMemo(
    () => gruposSintomas.reduce((acc, g) => acc + g.cids.length, 0),
    [gruposSintomas],
  );
  const totalLinhas = periodos.length + tipos.length + cids.length + tiposSancoes.length + categoriasDocumentos.length;
  const resumoRegras = useMemo(() => {
    const total = tiposRegras.length;
    let contabiliza = 0;
    let just = 0;
    let injust = 0;
    let foraComDetalhe = 0;
    let foraSemDetalhe = 0;
    for (const regra of tiposRegras) {
      if (regra.contabilizaIndicadores) {
        contabiliza += 1;
        if (regra.classificacao === "justificada") just += 1;
        else if (regra.classificacao === "injustificada") injust += 1;
      } else if (regra.exibirNoDetalhamento) {
        foraComDetalhe += 1;
      } else {
        foraSemDetalhe += 1;
      }
    }
    return { total, contabiliza, just, injust, foraComDetalhe, foraSemDetalhe };
  }, [tiposRegras]);

  if (isLoading && !apiBundle && !isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[32vh] gap-3">
        <p className="text-muted-foreground">Carregando cadastros…</p>
        {isFetching ? <p className="text-xs text-muted-foreground">Consultando o servidor</p> : null}
      </div>
    );
  }
  if (isError && !apiBundle) {
    const detail = error instanceof Error ? error.message : "Erro desconhecido.";
    return (
      <div className="flex flex-col items-center justify-center min-h-[32vh] gap-4 max-w-lg mx-auto text-center px-4">
        <p className="text-destructive font-medium">Não foi possível carregar os cadastros.</p>
        <p className="text-sm text-muted-foreground break-words">{detail}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isError && apiBundle ? (
        <div className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100 flex flex-wrap items-center justify-between gap-2">
          <span>Não foi possível atualizar os dados do servidor; exibindo a última versão carregada.</span>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        {canEdit ? (
          <Button variant="outline" size="sm" onClick={handleImportClick}>
            <Upload className="w-4 h-4 mr-1" /> Importar Excel
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-1" /> Exportar Excel
        </Button>
        {canEdit ? (
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Save className="w-4 h-4 mr-1" /> {isSaving ? "Salvando..." : "Salvar no banco"}
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <CadastroColumn
          title="Períodos"
          items={periodos}
          setItems={setPeriodos}
          canEdit={canEdit}
          search={sp}
          setSearch={setSp}
          searchPlaceholder="Buscar período..."
        />
        <CadastroColumn
          title="Tipos"
          items={tipos}
          setItems={setTipos}
          canEdit={canEdit}
          search={st}
          setSearch={setSt}
          searchPlaceholder="Buscar tipo..."
        />
        <CadastroColumn
          title="CIDs"
          items={cids}
          setItems={setCids}
          canEdit={canEdit}
          search={sc}
          setSearch={setSc}
          searchPlaceholder="Buscar CID..."
        />
        <CadastroColumn
          title="Tipos de sanções"
          items={tiposSancoes}
          setItems={setTiposSancoes}
          canEdit={canEdit}
          search={ss}
          setSearch={setSs}
          searchPlaceholder="Buscar tipo de sanção..."
        />
        <CadastroColumn
          title="Categorias de documentos"
          items={categoriasDocumentos}
          setItems={setCategoriasDocumentos}
          canEdit={canEdit}
          search={sdoc}
          setSearch={setSdoc}
          searchPlaceholder="Buscar categoria..."
        />
        <GruposSintomasColumn
          grupos={gruposSintomas}
          setGrupos={setGruposSintomas}
          cidsCadastro={cidsCadastro}
          canEdit={canEdit}
          search={sg}
          setSearch={setSg}
        />
      </div>

      {canViewTiposRegras ? (
      <div className="rounded-sm border border-border bg-card shadow-level-1">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/50 px-3 py-2.5">
          <p className="text-xs font-semibold tracking-wide">Regras dos tipos de ausência (indicadores e detalhamento)</p>
          <div className="flex items-center gap-2">
            {canEdit && canEditTiposRegras ? (
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save className="mr-1 h-3.5 w-3.5" />
                {isSaving ? "Salvando..." : "Salvar regras no banco"}
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setRegrasVisible((v) => !v)}>
              {regrasVisible ? "Ocultar quadro" : "Mostrar quadro"}
            </Button>
          </div>
        </div>
        {regrasVisible ? (
          <>
        <div className="grid grid-cols-1 gap-3 border-b border-border px-3 py-3 text-xs text-muted-foreground md:grid-cols-5">
          <span>Total: {resumoRegras.total}</span>
          <span>Contabilizam: {resumoRegras.contabiliza}</span>
          <span>Justificadas: {resumoRegras.just}</span>
          <span>Injustificadas: {resumoRegras.injust}</span>
          <span>Fora do indicador: {resumoRegras.foraComDetalhe + resumoRegras.foraSemDetalhe}</span>
        </div>
        <div className="max-h-[min(46vh,26rem)] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/70">
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Contabiliza nos indicadores?</th>
                <th className="px-3 py-2">Classificação</th>
                <th className="px-3 py-2">Exibir no detalhamento?</th>
              </tr>
            </thead>
            <tbody>
              {tiposRegras.map((regra, idx) => (
                <tr key={normalizeTipoRegraKey(regra.tipo) || `tipo-${idx}`} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 align-top">{regra.tipo}</td>
                  <td className="px-3 py-2 align-top">
                    <select
                      value={regra.contabilizaIndicadores ? "sim" : "nao"}
                    disabled={!canEdit || !canEditTiposRegras}
                      className="h-8 rounded-sm border border-border bg-background px-2 text-sm"
                      onChange={(e) => {
                        const contabiliza = e.target.value === "sim";
                        setTiposRegras((prev) =>
                          prev.map((r) =>
                            normalizeTipoRegraKey(r.tipo) === normalizeTipoRegraKey(regra.tipo)
                              ? {
                                  ...r,
                                  contabilizaIndicadores: contabiliza,
                                  classificacao: contabiliza ? r.classificacao ?? classificarTipoFallback(r.tipo) : null,
                                }
                              : r,
                          ),
                        );
                      }}
                    >
                      <option value="sim">Sim</option>
                      <option value="nao">Não</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {regra.contabilizaIndicadores ? (
                      <select
                        value={regra.classificacao ?? ""}
                        disabled={!canEdit || !canEditTiposRegras}
                        className="h-8 rounded-sm border border-border bg-background px-2 text-sm"
                        onChange={(e) => {
                          const val = e.target.value as "justificada" | "injustificada" | "";
                          setTiposRegras((prev) =>
                            prev.map((r) =>
                              normalizeTipoRegraKey(r.tipo) === normalizeTipoRegraKey(regra.tipo)
                                ? { ...r, classificacao: val || null }
                                : r,
                            ),
                          );
                        }}
                      >
                        <option value="">Definir...</option>
                        <option value="justificada">Justificada</option>
                        <option value="injustificada">Injustificada</option>
                      </select>
                    ) : (
                      <span className="text-muted-foreground">Não se aplica</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {!regra.contabilizaIndicadores ? (
                      <select
                        value={regra.exibirNoDetalhamento ? "sim" : "nao"}
                        disabled={!canEdit || !canEditTiposRegras}
                        className="h-8 rounded-sm border border-border bg-background px-2 text-sm"
                        onChange={(e) => {
                          const exibir = e.target.value === "sim";
                          setTiposRegras((prev) =>
                            prev.map((r) =>
                              normalizeTipoRegraKey(r.tipo) === normalizeTipoRegraKey(regra.tipo)
                                ? { ...r, exibirNoDetalhamento: exibir }
                                : r,
                            ),
                          );
                        }}
                      >
                        <option value="sim">Sim</option>
                        <option value="nao">Não</option>
                      </select>
                    ) : (
                      <span className="text-muted-foreground">Sempre (contabiliza)</span>
                    )}
                  </td>
                </tr>
              ))}
              {tiposRegras.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-5 text-center text-xs text-muted-foreground">
                    Sem tipos cadastrados para configurar regras.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
          </>
        ) : null}
      </div>
      ) : null}

      <div className="text-xs text-muted-foreground">
        {totalLinhas} linhas no total ({periodos.length} períodos · {tipos.length} tipos · {cids.length} CIDs ·{" "}
        {tiposSancoes.length} tipos de sanções · {categoriasDocumentos.length} categorias · {gruposSintomas.length}{" "}
        grupos de sintomas / {totalCidsGrupos} CIDs correlatos)
        {!isApiConfigured() ? " · API não configurada" : ""}
      </div>
    </div>
  );
}
