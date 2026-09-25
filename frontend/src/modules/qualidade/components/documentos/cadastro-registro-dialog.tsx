import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { MultiSelectSearch } from "@qualidade/components/ui/multi-select-search";
import { Dialog, DialogContent } from "@qualidade/components/ui/dialog";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import { Textarea } from "@qualidade/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qualidade/components/ui/select";
import { DocumentoEnderecamentoFieldset } from "@qualidade/components/documentos/documento-enderecamento-fieldset";
import { OpcaoListaPesquisavelField } from "@qualidade/components/registros/opcao-lista-pesquisavel-field";
import {
  buildPermissoesFromRegistroInterno,
  buildRegistroInternoMeta,
  defaultRegistroInternoValues,
  registroInternoValuesFromDocument,
  REGISTRO_INTERNO_SIGLA,
  type RegistroInternoFormValues,
} from "@qualidade/lib/documents/registro-interno";
import {
  REGISTRO_PROTECAO_OPCOES_BASE,
  REGISTRO_PROTECAO_OPCOES_STORAGE_KEY,
  REGISTRO_RECUPERACAO_OPCOES_BASE,
  REGISTRO_RECUPERACAO_OPCOES_STORAGE_KEY,
} from "@qualidade/lib/registros/opcoes-lista-customizadas";
import { afterUiTransition } from "@qualidade/lib/motion";
import { scheduleQualidadeDocumentsFlush } from "@qualidade/lib/qualidadePersistence";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { useLoading } from "@qualidade/components/providers/loading-provider";
import { cn } from "@qualidade/lib/utils";
import {
  departmentSelectLabel,
  userSelectLabel,
} from "@qualidade/lib/utils/select-display";
import type { RetencaoUnidade } from "@qualidade/types/document";
import { formatDocumentCodigoExibicao } from "@qualidade/lib/documents/document-codigo";
import { documentOrigemLabelsLong } from "@qualidade/lib/utils/status-labels";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId?: string | null;
  onSalvo?: (id: string) => void;
}

const selectTriggerClass =
  "h-10 w-full min-w-0 *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal";

const selectContentClass = "min-w-[var(--anchor-width)] w-max max-w-md";

const selectItemClass = "py-2.5 whitespace-normal text-base leading-snug";

export function CadastroRegistroDialog({
  open,
  onOpenChange,
  documentId = null,
  onSalvo,
}: Props) {
  const navigate = useNavigate();
  const { withLoading } = useLoading();
  const createDocument = useDocumentsStore((s) => s.createDocument);
  const updateRegistroInternoCadastro = useDocumentsStore(
    (s) => s.updateRegistroInternoCadastro
  );
  const getDocumentById = useDocumentsStore((s) => s.getDocumentById);
  const getVersionsByDocumentId = useDocumentsStore(
    (s) => s.getVersionsByDocumentId
  );
  const getNextDocumentCode = useDocumentsStore((s) => s.getNextDocumentCode);
  const documents = useDocumentsStore((s) => s.documents);
  const documentTypes = useConfigStore((s) => s.documentTypes);
  const departments = useConfigStore((s) => s.departments);
  const users = useConfigStore((s) => s.users);

  const [values, setValues] = useState<RegistroInternoFormValues>(() =>
    defaultRegistroInternoValues()
  );
  const [erro, setErro] = useState("");
  const [saving, setSaving] = useState(false);
  const [guardaFisica, setGuardaFisica] = useState(false);

  const editando = Boolean(documentId);

  const opcoesModelo = useMemo(() => {
    return documents
      .filter(
        (d) =>
          d.id !== documentId &&
          (d.origem === "interno" ||
            d.origem === "externo" ||
            d.origem === "registro")
      )
      .map((d) => ({
        value: d.id,
        label: `${formatDocumentCodigoExibicao(d.codigo, d.versaoAtual)} — ${d.titulo}`,
        description: documentOrigemLabelsLong[d.origem],
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [documentId, documents]);

  const opcoesAssociados = useMemo(
    () => opcoesModelo.filter((opcao) => opcao.value !== values.modeloDocumentoId),
    [opcoesModelo, values.modeloDocumentoId]
  );

  const registroTipo = useMemo(() => {
    const found = documentTypes.find((t) => t.sigla === REGISTRO_INTERNO_SIGLA);
    return (
      found ?? {
        id: "tipo-re",
        nome: "Registro interno",
        sigla: REGISTRO_INTERNO_SIGLA,
      }
    );
  }, [documentTypes]);

  function resetForm() {
    setValues(defaultRegistroInternoValues());
    setErro("");
  }

  useEffect(() => {
    if (!open) return;
    if (!documentId) {
      setValues(defaultRegistroInternoValues());
      setErro("");
      return;
    }
    const doc = getDocumentById(documentId);
    if (!doc) return;
    const versaoAtual = getVersionsByDocumentId(documentId).find(
      (v) => v.versao === doc.versaoAtual
    );
    setValues(
      registroInternoValuesFromDocument(
        doc,
        versaoAtual,
        versaoAtual?.elaboradorId || ""
      )
    );
    setErro("");
  }, [
    open,
    documentId,
    getDocumentById,
    getVersionsByDocumentId,
  ]);

  function patch(partial: Partial<RegistroInternoFormValues>) {
    setValues((prev) => ({ ...prev, ...partial }));
    if (erro) setErro("");
  }

  function handleClose() {
    onOpenChange(false);
    afterUiTransition(resetForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pendentes: string[] = [];
    if (!values.titulo.trim()) pendentes.push("Título");
    if (!values.processoId) pendentes.push("Documento referente ao setor");
    if (guardaFisica && !values.responsavelId) {
      pendentes.push("Responsável pela posse do documento");
    }
    if (!values.modeloDocumentoId) pendentes.push("Modelo do documento");
    if (pendentes.length > 0) {
      setErro(`Preencha os campos obrigatórios: ${pendentes.join(", ")}.`);
      return;
    }
    setErro("");
    setSaving(true);

    const payload = {
      titulo: values.titulo,
      setorId: values.processoId,
      elaboradorId: values.responsavelId,
      localizacao: values.localizacao,
      permissoes: buildPermissoesFromRegistroInterno(values),
      externoRegistro: buildRegistroInternoMeta(values),
    };
    try {
      await withLoading(async () => {
        if (editando && documentId) {
          const ok = updateRegistroInternoCadastro(documentId, {
            ...payload,
            modelo: null,
          });
          if (!ok) {
            throw new Error("Não foi possível atualizar o registro.");
          }
          onOpenChange(false);
          afterUiTransition(() => {
            resetForm();
            onSalvo?.(documentId);
          });
          return;
        }

        const novoId = createDocument({
          tipoSigla: registroTipo.sigla,
          codigo: getNextDocumentCode(registroTipo.sigla),
          tipoId: registroTipo.id,
          origem: "registro",
          ...payload,
        });

        onOpenChange(false);
        afterUiTransition(() => {
          resetForm();
          if (onSalvo) {
            onSalvo(novoId);
          } else {
            navigate("/qualidade/documentos/consulta?guia=registro");
          }
        });
      }, editando ? "Salvando alterações..." : "Gravando registro...");
      scheduleQualidadeDocumentsFlush();
    } catch (err) {
      console.error("[qualidade] falha ao sincronizar registro interno:", err);
      setErro(
        err instanceof Error && err.message.startsWith("Não foi possível")
          ? err.message
          : editando
            ? "Alterações salvas localmente, mas falhou ao gravar no servidor."
            : "Registro criado localmente, mas falhou ao salvar no servidor. Tente novamente."
      );
    } finally {
      setSaving(false);
    }
  }

  const setorNome = departmentSelectLabel(
    departments,
    values.processoId,
    "sigla-nome"
  );
  const responsavelExibicao =
    values.responsavelNome.trim() ||
    userSelectLabel(users, values.responsavelId) ||
    "";
  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "max-h-[min(92vh,100dvh)] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl",
          editando && "z-[60]"
        )}
      >
        <div className="modal-header-bar flex shrink-0 items-center justify-between px-5 py-3.5">
          <h2 className="text-base font-semibold text-white">
            {editando ? "Editar registro interno" : "Cadastro de registro interno"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1.5 hover:bg-white/20"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-6">
            <div className="space-y-6">
              <fieldset className="brand-fieldset space-y-4">
                <legend className="text-base">Identificação</legend>

                <div className="space-y-2">
                  <Label className="text-base">Título *</Label>
                  <Input
                    value={values.titulo}
                    onChange={(e) => patch({ titulo: e.target.value })}
                    className="h-10 text-base"
                    placeholder="Ex.: Ata de reunião de análise crítica"
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-base">Documento referente ao setor *</Label>
                    <Select
                      value={values.processoId}
                      onValueChange={(v) => v && patch({ processoId: v })}
                    >
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Selecione">
                          {setorNome ?? null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className={selectContentClass}>
                        {departments.map((d) => (
                          <SelectItem
                            key={d.id}
                            value={d.id}
                            className={selectItemClass}
                          >
                            {d.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                </div>

                <div className="space-y-2">
                  <Label className="text-base">Modelo do documento *</Label>
                  <MultiSelectSearch
                    multiple={false}
                    options={opcoesModelo}
                    value={values.modeloDocumentoId ? [values.modeloDocumentoId] : []}
                    onChange={(ids) => {
                      const modeloDocumentoId = ids[0] ?? "";
                      patch({
                        modeloDocumentoId,
                        documentosAssociadosIds: values.documentosAssociadosIds.filter(
                          (id) => id !== modeloDocumentoId
                        ),
                      });
                    }}
                    placeholder="Selecione um documento"
                    searchPlaceholder="Pesquisar documento…"
                    emptyMessage="Nenhum documento encontrado."
                  />
                  <p className="text-xs text-muted-foreground">
                    Documento interno, externo ou registro interno já cadastrado,
                    usado como modelo desta ficha.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-base">Associar a outros documentos</Label>
                  <MultiSelectSearch
                    options={opcoesAssociados}
                    value={values.documentosAssociadosIds}
                    onChange={(documentosAssociadosIds) =>
                      patch({ documentosAssociadosIds })
                    }
                    placeholder="Selecione documentos"
                    searchPlaceholder="Pesquisar documento…"
                    emptyMessage="Nenhum documento encontrado."
                  />
                  <p className="text-xs text-muted-foreground">
                    Pode vincular mais de um documento interno, externo ou registro
                    interno.
                  </p>
                </div>
              </fieldset>

              <DocumentoEnderecamentoFieldset
                value={values.localizacao}
                onChange={(localizacao) => patch({ localizacao })}
                setorId={values.processoId}
                responsavelId={values.responsavelId}
                responsavelNome={responsavelExibicao}
                onResponsavelChange={(id, nome) =>
                  patch({ responsavelId: id, responsavelNome: nome })
                }
                onGuardaFisicaChange={setGuardaFisica}
              />

              <fieldset className="brand-fieldset space-y-4">
                <legend className="text-base">Controle</legend>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-base">Prazo de retenção</Label>
                    <div className="grid grid-cols-[minmax(0,1fr)_5.75rem] gap-2">
                      <Select
                        value={values.retencaoUnidade}
                        onValueChange={(v) =>
                          v &&
                          patch({ retencaoUnidade: v as RetencaoUnidade })
                        }
                      >
                        <SelectTrigger className={selectTriggerClass}>
                          <SelectValue placeholder="Unidade">
                            {values.retencaoUnidade === "meses"
                              ? "Meses"
                              : "Anos"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className={selectContentClass}>
                          <SelectItem value="anos" className={selectItemClass}>
                            Anos
                          </SelectItem>
                          <SelectItem value="meses" className={selectItemClass}>
                            Meses
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="h-10 text-base tabular-nums"
                        placeholder="Nº"
                        value={values.retencaoValor}
                        onChange={(e) =>
                          patch({
                            retencaoValor: e.target.value
                              .replace(/\D/g, "")
                              .replace(/^0+(?=\d)/, ""),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <OpcaoListaPesquisavelField
                    id="registro-protecao"
                    label="Proteção"
                    value={values.protecao}
                    onChange={(v) => patch({ protecao: v })}
                    opcoesBase={REGISTRO_PROTECAO_OPCOES_BASE}
                    storageKey={REGISTRO_PROTECAO_OPCOES_STORAGE_KEY}
                    placeholder="Selecione ou adicione..."
                  />
                  <OpcaoListaPesquisavelField
                    id="registro-recuperacao"
                    label="Recuperação"
                    value={values.recuperacao}
                    onChange={(v) => patch({ recuperacao: v })}
                    opcoesBase={REGISTRO_RECUPERACAO_OPCOES_BASE}
                    storageKey={REGISTRO_RECUPERACAO_OPCOES_STORAGE_KEY}
                    placeholder="Selecione ou adicione..."
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base">Observação</Label>
                  <Textarea
                    value={values.observacao}
                    onChange={(e) => patch({ observacao: e.target.value })}
                    rows={3}
                    className="text-base"
                    placeholder="Observações sobre este registro..."
                  />
                </div>
              </fieldset>
            </div>
          </div>

          {erro ? (
            <p
              role="alert"
              className="border-t border-destructive/30 bg-destructive/10 px-6 py-3 text-sm font-medium text-destructive"
            >
              {erro}
            </p>
          ) : null}

          <div className="sgq-form-footer">
            <Button type="submit" size="lg" className="min-w-28" disabled={saving}>
              {saving ? "Gravando..." : "Gravar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
