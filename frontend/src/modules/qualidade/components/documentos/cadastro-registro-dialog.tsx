import { useNavigate } from "react-router-dom";
import { useEffect, useId, useMemo, useState } from "react";
import { Paperclip, Upload, X } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
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
import {
  buildPermissoesFromRegistroInterno,
  buildRegistroInternoMeta,
  defaultRegistroInternoValues,
  registroInternoValuesFromDocument,
  REGISTRO_INTERNO_SIGLA,
  type RegistroInternoFormValues,
} from "@qualidade/lib/documents/registro-interno";
import { afterUiTransition } from "@qualidade/lib/motion";
import {
  flushQualidadeDocumentsSync,
  markQualidadeDocumentFilesPending,
} from "@qualidade/lib/qualidadePersistence";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { cn } from "@qualidade/lib/utils";
import {
  departmentSelectLabel,
  permissaoAcessoSelectLabel,
  userSelectLabel,
} from "@qualidade/lib/utils/select-display";
import type { PermissaoAcessoDocumento, RetencaoUnidade } from "@qualidade/types/document";
import {
  SGQ_ANEXO_ACCEPT,
  SGQ_ANEXO_MAX_BYTES,
} from "@qualidade/types/registro-anexo";

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
  const createDocument = useDocumentsStore((s) => s.createDocument);
  const updateRegistroInternoCadastro = useDocumentsStore(
    (s) => s.updateRegistroInternoCadastro
  );
  const getDocumentById = useDocumentsStore((s) => s.getDocumentById);
  const getVersionsByDocumentId = useDocumentsStore(
    (s) => s.getVersionsByDocumentId
  );
  const getNextDocumentCode = useDocumentsStore((s) => s.getNextDocumentCode);
  const documentTypes = useConfigStore((s) => s.documentTypes);
  const departments = useConfigStore((s) => s.departments);
  const users = useConfigStore((s) => s.users);
  const currentUserId = useConfigStore((s) => s.currentUserId);

  const [values, setValues] = useState<RegistroInternoFormValues>(() =>
    defaultRegistroInternoValues(currentUserId)
  );
  const [erro, setErro] = useState("");
  const [saving, setSaving] = useState(false);
  const modeloInputId = useId();

  const editando = Boolean(documentId);

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
    setValues(defaultRegistroInternoValues(currentUserId));
    setErro("");
  }

  useEffect(() => {
    if (!open) return;
    if (!documentId) {
      setValues(defaultRegistroInternoValues(currentUserId));
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
        versaoAtual?.elaboradorId || currentUserId
      )
    );
    setErro("");
  }, [
    open,
    documentId,
    currentUserId,
    getDocumentById,
    getVersionsByDocumentId,
  ]);

  function patch(partial: Partial<RegistroInternoFormValues>) {
    setValues((prev) => ({ ...prev, ...partial }));
    if (erro) setErro("");
  }

  function selecionarModelo(file: File) {
    if (file.size > SGQ_ANEXO_MAX_BYTES) {
      setErro(`"${file.name}" excede o limite de 5 MB.`);
      return;
    }
    setErro("");
    const reader = new FileReader();
    reader.onload = () => {
      patch({
        modeloNome: file.name,
        modeloDataUrl: reader.result as string,
        modeloStoragePath: undefined,
      });
    };
    reader.readAsDataURL(file);
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
    if (!values.responsavelId) pendentes.push("Responsável pelo cadastro");
    if (
      !values.modeloNome.trim() ||
      !(values.modeloDataUrl.trim() || values.modeloStoragePath?.trim())
    ) {
      pendentes.push("Modelo do documento");
    }
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
    const modeloArquivo = values.modeloNome.trim()
      ? {
          nome: values.modeloNome.trim(),
          dataUrl: values.modeloDataUrl,
          ...(values.modeloStoragePath
            ? { storagePath: values.modeloStoragePath }
            : {}),
        }
      : null;
    const modeloNovo = Boolean(values.modeloDataUrl.startsWith("data:"));

    try {
      if (editando && documentId) {
        const ok = updateRegistroInternoCadastro(documentId, {
          ...payload,
          modelo: modeloArquivo,
        });
        if (!ok) {
          setErro("Não foi possível atualizar o registro.");
          return;
        }
        if (modeloNovo) {
          const versaoAtual = getVersionsByDocumentId(documentId).find(
            (v) => v.versao === getDocumentById(documentId)?.versaoAtual
          );
          markQualidadeDocumentFilesPending(documentId, versaoAtual?.id ?? "");
        }
        await flushQualidadeDocumentsSync();
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
        arquivoNome: modeloArquivo?.nome,
        arquivoDataUrl: modeloArquivo?.dataUrl,
        ...payload,
      });

      if (modeloNovo) {
        markQualidadeDocumentFilesPending(novoId);
      }

      await flushQualidadeDocumentsSync();
      onOpenChange(false);
      afterUiTransition(() => {
        resetForm();
        if (onSalvo) {
          onSalvo(novoId);
        } else {
          navigate("/qualidade/documentos/consulta?guia=registro");
        }
      });
    } catch (err) {
      console.error("[qualidade] falha ao sincronizar registro interno:", err);
      setErro(
        editando
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
  const responsavelNome = userSelectLabel(users, values.responsavelId);
  const permissaoNome = permissaoAcessoSelectLabel(values.permissaoAcesso);

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

                  <div className="space-y-2">
                    <Label className="text-base">Responsável pelo cadastro *</Label>
                    <Select
                      value={values.responsavelId}
                      onValueChange={(v) => v && patch({ responsavelId: v })}
                    >
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Selecione">
                          {responsavelNome ?? null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className={selectContentClass}>
                        {users
                          .filter((u) => u.ativo)
                          .map((u) => (
                            <SelectItem
                              key={u.id}
                              value={u.id}
                              className={selectItemClass}
                            >
                              {u.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-base">Modelo do documento *</Label>
                  <input
                    id={modeloInputId}
                    type="file"
                    className="hidden"
                    accept={SGQ_ANEXO_ACCEPT}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) selecionarModelo(file);
                      e.target.value = "";
                    }}
                  />
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                    <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {values.modeloNome ? (
                        <span className="font-medium text-foreground">
                          {values.modeloNome}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Nenhum modelo anexado
                        </span>
                      )}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() =>
                        document.getElementById(modeloInputId)?.click()
                      }
                    >
                      <Upload className="size-3.5" />
                      {values.modeloNome ? "Substituir" : "Anexar"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Arquivo-base deste registro (formulário em branco, ata padrão,
                    planilha modelo, etc.).
                  </p>
                </div>
              </fieldset>

              <DocumentoEnderecamentoFieldset
                value={values.localizacao}
                onChange={(localizacao) => patch({ localizacao })}
                setorId={values.processoId}
                label="Localização do documento"
              />

              <fieldset className="brand-fieldset space-y-4">
                <legend className="text-base">Controle</legend>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-base">Permissão de acesso</Label>
                    <Select
                      value={values.permissaoAcesso || undefined}
                      onValueChange={(v) =>
                        v &&
                        patch({
                          permissaoAcesso: v as PermissaoAcessoDocumento,
                        })
                      }
                    >
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Selecione">
                          {permissaoNome ?? null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className={selectContentClass}>
                        <SelectItem value="todos" className={selectItemClass}>
                          Todos
                        </SelectItem>
                        <SelectItem value="restrito" className={selectItemClass}>
                          Restrito
                        </SelectItem>
                        <SelectItem
                          value="responsavel"
                          className={selectItemClass}
                        >
                          Apenas responsável
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

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
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleClose}
              disabled={saving}
            >
              Fechar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
