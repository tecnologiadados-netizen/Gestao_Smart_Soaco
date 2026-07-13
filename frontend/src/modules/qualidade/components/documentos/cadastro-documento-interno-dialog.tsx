import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { Dialog, DialogContent } from "@qualidade/components/ui/dialog";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qualidade/components/ui/select";
import { DocumentoStepper } from "@qualidade/components/documentos/documento-stepper";
import {
  defaultPermissoesValues,
  DocumentoPermissoesFieldset,
  type PermissoesFormValues,
} from "@qualidade/components/documentos/documento-permissoes-fieldset";
import {
  defaultResponsaveisValues,
  DocumentoResponsaveisFieldset,
  formatWorkflowObservacoes,
  type ResponsaveisFormValues,
} from "@qualidade/components/documentos/documento-responsaveis-fieldset";
import {
  defaultPublicacaoValues,
  DocumentoPublicacaoFieldset,
  publicacaoFromDocument,
  toDocumentPublicacao,
  toDocumentValidade,
  type PublicacaoFormValues,
} from "@qualidade/components/documentos/documento-publicacao-fieldset";
import { afterUiTransition } from "@qualidade/lib/motion";
import { cn } from "@qualidade/lib/utils";
import { useLoading } from "@qualidade/components/providers/loading-provider";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { INITIAL_REVISION } from "@qualidade/lib/documents/revision";
import type { DocumentType } from "@qualidade/types/user";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId?: string | null;
  onSalvo?: () => void;
}

const selectTriggerClass =
  "h-10 w-full min-w-0 *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal";

const selectContentClass =
  "min-w-[var(--anchor-width)] w-max max-w-md";

const selectItemClass = "py-2.5 whitespace-normal text-base leading-snug";

function formatTipo(t: DocumentType) {
  return `${t.sigla} — ${t.nome}`;
}

export function CadastroDocumentoInternoDialog({
  open,
  onOpenChange,
  documentId = null,
  onSalvo,
}: Props) {
  const navigate = useNavigate();
  const { withLoading } = useLoading();
  const createDocument = useDocumentsStore((s) => s.createDocument);
  const updateDocumentCadastro = useDocumentsStore((s) => s.updateDocumentCadastro);
  const getDocumentById = useDocumentsStore((s) => s.getDocumentById);
  const getVersionsByDocumentId = useDocumentsStore(
    (s) => s.getVersionsByDocumentId
  );
  const getNextDocumentCode = useDocumentsStore((s) => s.getNextDocumentCode);
  const documentTypes = useConfigStore((s) => s.documentTypes);
  const departments = useConfigStore((s) => s.departments);
  const users = useConfigStore((s) => s.users);
  const currentUserId = useConfigStore((s) => s.currentUserId);

  const [categoriaId, setCategoriaId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [processoId, setProcessoId] = useState("");
  const [responsaveis, setResponsaveis] = useState<ResponsaveisFormValues>(() =>
    defaultResponsaveisValues(currentUserId)
  );
  const [permissoes, setPermissoes] = useState<PermissoesFormValues>(() =>
    defaultPermissoesValues()
  );
  const [publicacao, setPublicacao] = useState<PublicacaoFormValues>(() =>
    defaultPublicacaoValues()
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isEdicao = Boolean(documentId);
  const documentoEdicao = documentId ? getDocumentById(documentId) : undefined;

  function resetForm() {
    setCategoriaId("");
    setTitulo("");
    setProcessoId("");
    setResponsaveis(defaultResponsaveisValues(currentUserId));
    setPermissoes(defaultPermissoesValues());
    setPublicacao(defaultPublicacaoValues());
    setFormError(null);
  }

  function validateForm(): string | null {
    if (!categoriaId) return "Selecione a categoria do documento.";
    if (!processoId) return "Selecione o setor do documento.";
    if (!titulo.trim()) return "Informe o título do documento.";
    if (!responsaveis.elaboradorId) return "Selecione o elaborador.";
    if (!responsaveis.consensoId) return "Selecione o responsável pelo consenso.";
    if (!responsaveis.aprovadorId) return "Selecione o aprovador.";
    if (departments.length === 0) {
      return "Nenhum setor cadastrado. Cadastre setores em Qualidade → Configurações.";
    }
    return null;
  }

  useEffect(() => {
    if (!open) return;

    if (!documentId) {
      resetForm();
      return;
    }

    const doc = getDocumentById(documentId);
    if (!doc) return;

    const versao = getVersionsByDocumentId(documentId).find(
      (v) => v.versao === doc.versaoAtual
    );

    setCategoriaId(doc.tipoId);
    setTitulo(doc.titulo);
    setProcessoId(doc.setorId);
    setResponsaveis({
      elaboradorId: versao?.elaboradorId ?? "",
      consensoId: versao?.consensoId ?? "",
      aprovadorId: versao?.aprovadorId ?? "",
      prazos: versao?.prazos ?? defaultResponsaveisValues("").prazos,
    });
    setPermissoes(doc.permissoes ?? defaultPermissoesValues());
    setPublicacao(publicacaoFromDocument(doc.publicacao, doc.validade));
  }, [open, documentId, getDocumentById, getVersionsByDocumentId, currentUserId]);

  const categorias = useMemo(() => {
    const bySigla = new Map<string, DocumentType>();
    for (const t of documentTypes) {
      if (!bySigla.has(t.sigla)) bySigla.set(t.sigla, t);
    }
    return Array.from(bySigla.values()).sort((a, b) =>
      a.sigla.localeCompare(b.sigla)
    );
  }, [documentTypes]);

  const categoria =
    documentTypes.find((t) => t.id === categoriaId) ??
    categorias.find((t) => t.id === categoriaId);
  const codigo = useMemo(() => {
    if (isEdicao && documentoEdicao) return documentoEdicao.codigo;
    return categoria ? getNextDocumentCode(categoria.sigla) : "";
  }, [isEdicao, documentoEdicao, categoria, getNextDocumentCode]);

  const revisaoExibida = isEdicao
    ? (documentoEdicao?.versaoAtual ?? INITIAL_REVISION)
    : INITIAL_REVISION;

  function handleClose() {
    onOpenChange(false);
    afterUiTransition(resetForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError || !categoria || saving) {
      setFormError(validationError ?? "Preencha todos os campos obrigatórios.");
      return;
    }

    setFormError(null);
    setSaving(true);
    await withLoading(async () => {
      if (isEdicao && documentId) {
        updateDocumentCadastro(documentId, {
          titulo,
          setorId: processoId,
          elaboradorId: responsaveis.elaboradorId || currentUserId,
          consensoId: responsaveis.consensoId || undefined,
          aprovadorId: responsaveis.aprovadorId || undefined,
          prazos: responsaveis.prazos,
          permissoes,
          publicacao: toDocumentPublicacao(publicacao),
          validade: toDocumentValidade(publicacao),
        });
        onOpenChange(false);
        afterUiTransition(resetForm);
        onSalvo?.();
        return;
      }

      createDocument({
        tipoSigla: categoria.sigla,
        titulo,
        tipoId: categoriaId,
        setorId: processoId,
        elaboradorId: responsaveis.elaboradorId || currentUserId,
        consensoId: responsaveis.consensoId || undefined,
        aprovadorId: responsaveis.aprovadorId || undefined,
        prazos: responsaveis.prazos,
        origem: "interno",
        permissoes,
        publicacao: toDocumentPublicacao(publicacao),
        validade: toDocumentValidade(publicacao),
        observacoes: formatWorkflowObservacoes(responsaveis.prazos),
      });

      onOpenChange(false);
      afterUiTransition(() => {
        resetForm();
        navigate("/qualidade/documentos/consulta");
      });
    }, isEdicao ? "Salvando alterações..." : "Gravando documento...");
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "max-h-[min(92vh,100dvh)] w-full max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl",
          isEdicao && "z-[60]"
        )}
      >
        <div className="modal-header-bar flex shrink-0 items-center justify-between px-5 py-3.5">
          <h2 className="text-base font-semibold text-white">
            {isEdicao
              ? "Editar cadastro do documento"
              : "Cadastro de documento interno"}
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
          {formError ? (
            <div
              role="alert"
              className="mx-6 mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {formError}
            </div>
          ) : null}
          <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto overscroll-y-contain p-6 lg:grid-cols-[1fr_240px]">
            <div className="space-y-6">
              <fieldset className="brand-fieldset space-y-4">
                <legend className="text-base">Identificação</legend>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-base">Categoria *</Label>
                    {isEdicao ? (
                      <div
                        className="flex min-h-10 items-center rounded-lg border-2 border-brand-blue/30 bg-muted/40 px-3 text-base text-brand-navy"
                        aria-readonly="true"
                      >
                        {categoria ? formatTipo(categoria) : "—"}
                      </div>
                    ) : (
                      <Select
                        value={categoriaId || null}
                        onValueChange={(v) => v && setCategoriaId(v)}
                      >
                        <SelectTrigger className={selectTriggerClass}>
                          <SelectValue placeholder="Selecione a categoria" />
                        </SelectTrigger>
                        <SelectContent className={selectContentClass}>
                          {categorias.map((t) => (
                            <SelectItem
                              key={t.id}
                              value={t.id}
                              className={selectItemClass}
                            >
                              {formatTipo(t)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {isEdicao ? (
                      <p className="text-xs text-muted-foreground">
                        A categoria não pode ser alterada após o cadastro.
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base">Setor *</Label>
                    <Select
                      value={processoId || null}
                      onValueChange={(v) => {
                        if (v) {
                          setProcessoId(v);
                          setFormError(null);
                        }
                      }}
                    >
                      <SelectTrigger
                        className={cn(
                          selectTriggerClass,
                          formError && !processoId && "border-destructive ring-destructive/30"
                        )}
                      >
                        <SelectValue placeholder="Selecione o setor" />
                      </SelectTrigger>
                      <SelectContent className={selectContentClass}>
                        {departments.map((d) => (
                          <SelectItem
                            key={d.id}
                            value={d.id}
                            className={selectItemClass}
                          >
                            {d.sigla} — {d.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(140px,180px)_100px_1fr]">
                  <div className="space-y-2">
                    <Label className="text-base">Código</Label>
                    <div
                      className="flex h-10 items-center rounded-lg border-2 border-brand-blue/30 bg-brand-blue-light/70 px-3 font-mono text-lg font-bold tracking-wide text-brand-navy"
                      aria-live="polite"
                    >
                      {codigo || "—"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Gerado automaticamente
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base">Revisão</Label>
                    <div
                      className="flex h-10 items-center justify-center rounded-lg border-2 border-brand-blue/30 bg-brand-blue-light/70 px-3 font-mono text-lg font-bold tracking-wide text-brand-navy"
                      aria-label={`Revisão ${revisaoExibida}`}
                    >
                      {revisaoExibida}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isEdicao ? "Revisão atual" : "Primeira emissão"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base">Título *</Label>
                    <Input
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      className="h-10 text-base"
                      placeholder="Nome do documento"
                      required
                    />
                  </div>
                </div>
              </fieldset>

              <DocumentoResponsaveisFieldset
                users={users}
                values={responsaveis}
                onChange={setResponsaveis}
              />

              <DocumentoPermissoesFieldset
                users={users}
                departments={departments}
                values={permissoes}
                onChange={setPermissoes}
              />

              <DocumentoPublicacaoFieldset
                values={publicacao}
                onChange={setPublicacao}
              />
            </div>

            <aside className="hidden shrink-0 lg:block">
              <DocumentoStepper activeStep={0} />
            </aside>
          </div>

          <div className="sgq-form-footer">
            <Button type="submit" size="lg" className="min-w-28" loading={saving}>
              Gravar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleClose}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
