import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { Dialog, DialogContent } from "@qualidade/components/ui/dialog";
import {
  buildExternoRegistroMeta,
  buildPermissoesFromExternoRegistro,
  buildValidadeFromExternoRegistro,
  defaultExternoRegistroValues,
  DocumentoExternoRegistroCampos,
  externoRegistroValuesFromDocument,
  type ExternoRegistroFormValues,
} from "@qualidade/components/documentos/documento-externo-registro-campos";
import { anexosPreenchidos } from "@qualidade/types/registro-anexo";
import { afterUiTransition } from "@qualidade/lib/motion";
import { flushQualidadeDocumentsSync, markQualidadeDocumentFilesPending } from "@qualidade/lib/qualidadePersistence";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando informado, abre em modo edição do cadastro externo. */
  documentId?: string | null;
  onSalvo?: () => void;
}

export function CadastroDocumentoExternoDialog({
  open,
  onOpenChange,
  documentId = null,
  onSalvo,
}: Props) {
  const navigate = useNavigate();
  const createDocument = useDocumentsStore((s) => s.createDocument);
  const updateDocumentoExternoCadastro = useDocumentsStore(
    (s) => s.updateDocumentoExternoCadastro
  );
  const getDocumentById = useDocumentsStore((s) => s.getDocumentById);
  const getVersionsByDocumentId = useDocumentsStore(
    (s) => s.getVersionsByDocumentId
  );
  const documents = useDocumentsStore((s) => s.documents);
  const departments = useConfigStore((s) => s.departments);
  const users = useConfigStore((s) => s.users);
  const currentUserId = useConfigStore((s) => s.currentUserId);

  const editando = Boolean(documentId);
  const [values, setValues] = useState<ExternoRegistroFormValues>(() =>
    defaultExternoRegistroValues(currentUserId)
  );
  const [erro, setErro] = useState("");

  function resetForm() {
    setValues(defaultExternoRegistroValues(currentUserId));
    setErro("");
  }

  useEffect(() => {
    if (!open) return;
    if (!documentId) {
      setValues(defaultExternoRegistroValues(currentUserId));
      setErro("");
      return;
    }
    const doc = getDocumentById(documentId);
    if (!doc) return;
    const versaoAtual = getVersionsByDocumentId(documentId).find(
      (v) => v.versao === doc.versaoAtual
    );
    setValues(
      externoRegistroValuesFromDocument(
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

  function handleChange(next: ExternoRegistroFormValues) {
    setValues(next);
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
    if (!values.processoId) pendentes.push("Setor");
    if (!values.localizacao.trim()) pendentes.push("Localização");
    if (!values.responsavelId) pendentes.push("Responsável");
    if (!values.distEletronica && !values.distFisica) pendentes.push("Distribuição");
    if (pendentes.length > 0) {
      setErro(`Preencha os campos obrigatórios: ${pendentes.join(", ")}.`);
      return;
    }
    setErro("");

    const anexos = anexosPreenchidos(values.anexos);
    const principal = anexos[0];
    const payloadBase = {
      titulo: values.titulo,
      setorId: values.processoId,
      elaboradorId: values.responsavelId,
      localizacao: values.localizacao,
      permissoes: buildPermissoesFromExternoRegistro(values),
      validade: buildValidadeFromExternoRegistro(values),
      externoRegistro: buildExternoRegistroMeta(values),
      anexos: anexos.length ? anexos : undefined,
    };

    if (editando && documentId) {
      const ok = updateDocumentoExternoCadastro(documentId, payloadBase);
      if (!ok) {
        setErro("Não foi possível atualizar o documento.");
        return;
      }
      const versaoAtual = getVersionsByDocumentId(documentId).find(
        (v) => v.versao === getDocumentById(documentId)?.versaoAtual
      );
      if (anexos.some((a) => a.dataUrl.startsWith("data:"))) {
        markQualidadeDocumentFilesPending(documentId, versaoAtual?.id ?? "");
      }
      try {
        await flushQualidadeDocumentsSync();
        onOpenChange(false);
        afterUiTransition(() => {
          resetForm();
          onSalvo?.();
        });
      } catch (err) {
        console.error("[qualidade] falha ao sincronizar edição externa:", err);
        setErro("Alterações salvas localmente, mas falhou ao gravar no servidor.");
      }
      return;
    }

    const codigo = `EXT-${Date.now().toString().slice(-6)}`;
    const novoId = createDocument({
      codigo,
      tipoId: "tipo-man",
      origem: "externo",
      arquivoNome: principal?.nome,
      arquivoDataUrl: principal?.dataUrl,
      ...payloadBase,
    });

    if (anexos.some((a) => a.dataUrl.startsWith("data:"))) {
      markQualidadeDocumentFilesPending(novoId);
    }

    try {
      await flushQualidadeDocumentsSync();
      onOpenChange(false);
      afterUiTransition(() => {
        resetForm();
        navigate("/qualidade/documentos/consulta");
      });
    } catch (err) {
      console.error("[qualidade] falha ao sincronizar documento externo:", err);
      setErro("Documento criado localmente, mas falhou ao salvar no servidor. Tente novamente.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[min(92vh,100dvh)] w-full max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <div className="modal-header-bar flex shrink-0 items-center justify-between px-5 py-3.5">
          <h2 className="text-base font-semibold text-white">
            {editando
              ? "Editar documento externo"
              : "Cadastro de documento externo"}
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
            <DocumentoExternoRegistroCampos
              values={values}
              onChange={handleChange}
              users={users}
              departments={departments}
              documents={documents}
            />
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
            <Button type="submit" size="lg" className="min-w-28">
              {editando ? "Salvar" : "Gravar"}
            </Button>
            {!editando ? (
              <Button type="button" variant="secondary" size="lg" disabled>
                Inativar
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleClose}
            >
              Fechar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
