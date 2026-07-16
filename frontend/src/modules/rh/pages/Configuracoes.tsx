import { useState, useCallback, useEffect, useRef } from "react";
import AppLayout from "@rh/components/AppLayout";
import { Button } from "@rh/components/ui/button";
import { Input } from "@rh/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@rh/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rh/components/ui/select";
import { useToast } from "@rh/hooks/use-toast";
import {
  getConfig,
  importOrganicoTrajetoria,
  isApiConfigured,
  parseOrganicoTrajetoriaPdfUpload,
  setConfig,
  type OrganicoTrajetoriaImportResult,
} from "@rh/lib/api-client";
import { canEditRoute } from "@rh/lib/route-permissions";
import {
  buildNextOrganicoCommentTagId,
  DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS,
  ORGANICO_COMMENT_TAGS_CONFIG_KEY,
  ORGANICO_COMMENT_TONE_OPTIONS,
  parseOrganicoCommentTagCatalog,
  stringifyOrganicoCommentTagCatalog,
  type OrganicoCommentTagOption,
} from "@rh/lib/organico-comment-tags";
import { parseOrganicoTrajetoriaSpreadsheet } from "@rh/lib/organico-trajetoria-pdf";
import { History, Loader2, Plus, Shield, Trash2, Upload } from "lucide-react";

const Configuracoes = () => {
  const { toast } = useToast();
  const canEditConfig = canEditRoute("/configuracoes");

  const [commentTagOptions, setCommentTagOptions] = useState<OrganicoCommentTagOption[]>(DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS);
  const [commentTagsLoading, setCommentTagsLoading] = useState(false);
  const [commentTagsSaving, setCommentTagsSaving] = useState(false);

  const trajetoriaImportInputRef = useRef<HTMLInputElement>(null);
  const [trajetoriaImporting, setTrajetoriaImporting] = useState(false);
  const [trajetoriaImportSummary, setTrajetoriaImportSummary] = useState<{
    files: string[];
    parsedRows: number;
    parsedRowsPdf: number;
    parsedRowsSpreadsheet: number;
    colaboradoresDetectados: number;
    colaboradoresVinculados: number;
    colaboradoresSemMatricula: string[];
    result: OrganicoTrajetoriaImportResult;
    warnings: string[];
  } | null>(null);

  const refreshCommentTagCatalog = useCallback(async () => {
    setCommentTagsLoading(true);
    try {
      const response = await getConfig(ORGANICO_COMMENT_TAGS_CONFIG_KEY);
      setCommentTagOptions(parseOrganicoCommentTagCatalog(response.value));
    } catch (error) {
      setCommentTagOptions(DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS);
      toast({
        title: "Erro ao carregar tags",
        description: error instanceof Error ? error.message : "Não foi possível carregar o catálogo de tags.",
        variant: "destructive",
      });
    } finally {
      setCommentTagsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refreshCommentTagCatalog();
  }, [refreshCommentTagCatalog]);

  const handleAddCommentTagOption = () => {
    if (!canEditConfig) return;
    setCommentTagOptions((current) => [
      ...current,
      {
        id: buildNextOrganicoCommentTagId(current),
        label: "",
        tone: "neutral",
      },
    ]);
  };

  const handleUpdateCommentTagOption = (index: number, patch: Partial<OrganicoCommentTagOption>) => {
    if (!canEditConfig) return;
    setCommentTagOptions((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch, id: item.id } : item)),
    );
  };

  const handleDeleteCommentTagOption = (index: number) => {
    if (!canEditConfig) return;
    setCommentTagOptions((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSaveCommentTagCatalog = async () => {
    if (!canEditConfig) return;
    const hasEmptyFields = commentTagOptions.some((item) => !item.label.trim());
    if (hasEmptyFields) {
      toast({
        title: "Dados incompletos",
        description: "Preencha código e rótulo de todas as tags antes de salvar.",
        variant: "destructive",
      });
      return;
    }
    setCommentTagsSaving(true);
    try {
      await setConfig(ORGANICO_COMMENT_TAGS_CONFIG_KEY, stringifyOrganicoCommentTagCatalog(commentTagOptions));
      await refreshCommentTagCatalog();
      toast({
        title: "Tags atualizadas",
        description: "O catálogo foi salvo e já passa a valer para permissões e novos comentários.",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar tags",
        description: error instanceof Error ? error.message : "Não foi possível salvar o catálogo.",
        variant: "destructive",
      });
    } finally {
      setCommentTagsSaving(false);
    }
  };

  const handleTrajetoriaImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    if (!canEditConfig) return;
    if (!isApiConfigured()) {
      toast({
        title: "API não configurada",
        description: "Defina VITE_API_URL para importar e persistir a trajetória no banco.",
        variant: "destructive",
      });
      return;
    }

    const invalid = files.find((file) => {
      const lower = file.name.toLowerCase();
      return !lower.endsWith(".pdf") && !lower.endsWith(".xlsx") && !lower.endsWith(".xls");
    });
    if (invalid) {
      toast({
        title: "Arquivo inválido",
        description: `O arquivo ${invalid.name} não é um PDF ou planilha válida para importação.`,
        variant: "destructive",
      });
      return;
    }

    setTrajetoriaImporting(true);
    try {
      const parsedResults = await Promise.all(
        files.map((file) => {
          const lower = file.name.toLowerCase();
          return lower.endsWith(".pdf") ? parseOrganicoTrajetoriaPdfUpload(file) : parseOrganicoTrajetoriaSpreadsheet(file);
        }),
      );
      const rows = parsedResults.flatMap((result) => result.rows);
      const warnings = parsedResults.flatMap((result) => result.warnings);
      const colaboradoresSemMatricula = Array.from(
        new Set(parsedResults.flatMap((result) => result.colaboradoresSemMatricula)),
      );
      const colaboradoresDetectados = parsedResults.reduce((acc, result) => acc + result.colaboradoresDetectados, 0);
      const colaboradoresVinculados = new Set(
        rows.map((row) => row.matricula.trim() || row.colaboradorNome.trim()).filter(Boolean),
      ).size;
      const parsedRowsPdf = parsedResults
        .filter((result) => result.source === "pdf")
        .reduce((acc, result) => acc + result.rows.length, 0);
      const parsedRowsSpreadsheet = parsedResults
        .filter((result) => result.source === "spreadsheet")
        .reduce((acc, result) => acc + result.rows.length, 0);

      if (rows.length === 0) {
        throw new Error("Nenhuma alteração de salário, cargo ou função foi identificada nos arquivos enviados.");
      }

      const result = await importOrganicoTrajetoria(rows);
      setTrajetoriaImportSummary({
        files: files.map((file) => file.name),
        parsedRows: rows.length,
        parsedRowsPdf,
        parsedRowsSpreadsheet,
        colaboradoresDetectados,
        colaboradoresVinculados,
        colaboradoresSemMatricula,
        result,
        warnings,
      });
      toast({
        title: "Trajetória importada",
        description: `${result.inserted} movimentação(ões) novas gravadas para ${result.affectedMatriculas} colaborador(es).`,
      });
    } catch (error) {
      toast({
        title: "Erro ao importar trajetória",
        description: error instanceof Error ? error.message : "Não foi possível processar os arquivos enviados.",
        variant: "destructive",
      });
    } finally {
      setTrajetoriaImporting(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 flex flex-col min-h-[calc(100vh-4rem)] bg-background">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        </div>

        <div className="grid w-full gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Importação em massa da trajetória
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground border border-border/70 bg-muted/25 rounded-sm p-3 leading-relaxed">
                Envie um ou mais <strong>PDFs</strong> da ficha do empregado ou, de preferência, a
                <strong> planilha consolidada (.xlsx/.xls)</strong> com o histórico já extraído. Para cada colaborador
                presente no lote, a importação <strong>substitui a trajetória anterior</strong> pelas movimentações
                identificadas no novo arquivo e alimenta a aba <strong>Trajetória</strong>. Os PDFs são processados no
                backend para aproximar o resultado do consolidado gerado a partir do script.
              </p>

              <input
                ref={trajetoriaImportInputRef}
                type="file"
                accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,application/vnd.ms-excel,.xls"
                multiple
                className="hidden"
                disabled={!canEditConfig || trajetoriaImporting}
                onChange={(event) => void handleTrajetoriaImport(event)}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => trajetoriaImportInputRef.current?.click()}
                  disabled={!canEditConfig || trajetoriaImporting}
                >
                  {trajetoriaImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Importar arquivos da trajetória
                </Button>
              </div>

              {trajetoriaImportSummary ? (
                <div className="rounded-lg border border-border/80 bg-background/70 p-4 text-sm">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Arquivos</p>
                      <p className="font-medium text-foreground">{trajetoriaImportSummary.files.length}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Colaboradores detectados</p>
                      <p className="font-medium text-foreground">{trajetoriaImportSummary.colaboradoresDetectados}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Colaboradores vinculados</p>
                      <p className="font-medium text-foreground">{trajetoriaImportSummary.colaboradoresVinculados}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Linhas extraídas</p>
                      <p className="font-medium text-foreground">{trajetoriaImportSummary.parsedRows}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Linhas do PDF</p>
                      <p className="font-medium text-foreground">{trajetoriaImportSummary.parsedRowsPdf}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Linhas da planilha</p>
                      <p className="font-medium text-foreground">{trajetoriaImportSummary.parsedRowsSpreadsheet}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Movimentações gravadas</p>
                      <p className="font-medium text-foreground">{trajetoriaImportSummary.result.inserted}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Arquivos processados</p>
                    <ul className="space-y-1 text-sm text-foreground/90">
                      {trajetoriaImportSummary.files.map((file) => (
                        <li key={file}>{file}</li>
                      ))}
                    </ul>
                  </div>

                  {trajetoriaImportSummary.warnings.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Avisos do parser</p>
                      <ul className="space-y-1 text-sm text-foreground/80">
                        {trajetoriaImportSummary.warnings.slice(0, 10).map((warning, index) => (
                          <li key={`${warning}-${index}`}>{warning}</li>
                        ))}
                      </ul>
                      {trajetoriaImportSummary.warnings.length > 10 ? (
                        <p className="text-xs text-muted-foreground">
                          {trajetoriaImportSummary.warnings.length - 10} aviso(s) adicional(is) não exibido(s).
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {trajetoriaImportSummary.colaboradoresSemMatricula.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Colaboradores com movimentações sem matrícula identificada
                      </p>
                      <ul className="space-y-1 text-sm text-foreground/80">
                        {trajetoriaImportSummary.colaboradoresSemMatricula.slice(0, 10).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      {trajetoriaImportSummary.colaboradoresSemMatricula.length > 10 ? (
                        <p className="text-xs text-muted-foreground">
                          {trajetoriaImportSummary.colaboradoresSemMatricula.length - 10} colaborador(es) adicional(is) não exibido(s).
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {trajetoriaImportSummary.result.skippedRows > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Linhas não vinculadas ao orgânico</p>
                      <p className="text-sm text-foreground/80">
                        {trajetoriaImportSummary.result.skippedRows} linha(s) foram ignoradas por falta de vínculo confiável com o Orgânico.
                      </p>
                      {trajetoriaImportSummary.result.unresolvedCollaborators.length > 0 ? (
                        <ul className="space-y-1 text-sm text-foreground/80">
                          {trajetoriaImportSummary.result.unresolvedCollaborators.slice(0, 10).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : null}
                      {trajetoriaImportSummary.result.unresolvedCollaborators.length > 10 ? (
                        <p className="text-xs text-muted-foreground">
                          {trajetoriaImportSummary.result.unresolvedCollaborators.length - 10} colaborador(es) adicional(is) não exibido(s).
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Catálogo de tags de comentários
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground border border-border/70 bg-muted/25 rounded-sm p-3 leading-relaxed">
                Cadastre aqui as categorias usadas no balão de classificação dos comentários do Orgânico. As novas opções
                também aparecem no editor de permissões dos grupos.
              </p>

              <div className="flex justify-end gap-2">
                {canEditConfig ? (
                  <Button type="button" variant="outline" size="sm" onClick={handleAddCommentTagOption}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nova tag
                  </Button>
                ) : null}
                {canEditConfig ? (
                  <Button type="button" size="sm" onClick={() => void handleSaveCommentTagCatalog()} disabled={commentTagsSaving}>
                    {commentTagsSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Salvar catálogo
                  </Button>
                ) : null}
              </div>

              <div className="border rounded-lg overflow-hidden">
                {commentTagsLoading ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">Carregando tags…</div>
                ) : commentTagOptions.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">Nenhuma tag cadastrada.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left py-3 px-4 font-medium">Código</th>
                        <th className="text-left py-3 px-4 font-medium">Rótulo</th>
                        <th className="text-left py-3 px-4 font-medium">Tom</th>
                        <th className="w-20 py-3 px-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {commentTagOptions.map((tag, index) => (
                        <tr key={`${tag.id}-${index}`} className="border-b last:border-0 align-top">
                          <td className="py-3 px-4">
                            <Input
                              value={tag.id}
                              readOnly
                              disabled
                            />
                          </td>
                          <td className="py-3 px-4">
                            <Input
                              value={tag.label}
                              onChange={(event) => handleUpdateCommentTagOption(index, { label: event.target.value })}
                              placeholder="Nome exibido para a tag"
                              disabled={!canEditConfig}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <Select
                              value={tag.tone}
                              onValueChange={(value) =>
                                handleUpdateCommentTagOption(index, { tone: value as OrganicoCommentTagOption["tone"] })
                              }
                              disabled={!canEditConfig}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {ORGANICO_COMMENT_TONE_OPTIONS.map((tone) => (
                                  <SelectItem key={tone.id} value={tone.id}>
                                    {tone.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-3 px-4">
                            {canEditConfig ? (
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteCommentTagOption(index)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Configuracoes;
