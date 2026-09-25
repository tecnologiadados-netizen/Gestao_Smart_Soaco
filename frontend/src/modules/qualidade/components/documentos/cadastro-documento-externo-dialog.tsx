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
import { useLoading } from "@qualidade/components/providers/loading-provider";

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
  const { withLoading } = useLoading();
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

  const editando = Boolean(documentId);
  const [values, setValues] = useState<ExternoRegistroFormValues>(() =>
    defaultExternoRegistroValues()
  );
  const [erro, setErro] = useState("");

  function resetForm() {
    setValues(defaultExternoRegistroValues());
    setErro("");
  }

  useEffect(() => {
    if (!open) return;
    if (!documentId) {
      setValues(defaultExternoRegistroValues());
      setErro("");
      return;
    }
    const doc = getDocumentById(documentId);
    if (!doc) return;
    const versaoAtual = getVersionsByDocumentId(documentId).find(
      (v) => v.versao === doc.versaoAtual
    );
    const carregado = externoRegistroValuesFromDocument(
      doc,
      versaoAtual,
      versaoAtual?.elaboradorId || ""
    );
    const elaboradorEhUsuario = users.some(
      (user) => user.id === carregado.responsavelDocumentoId
    );
    setValues({
      ...carregado,
      responsavelDocumentoId: elaboradorEhUsuario
        ? carregado.responsavelDocumentoId
        : "",
      responsavelId:
        carregado.responsavelId ||
        (!elaboradorEhUsuario ? carregado.responsavelDocumentoId : ""),
    });
    setErro("");
  }, [
    open,
    documentId,
    getDocumentById,
    getVersionsByDocumentId,
    users,
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
    if (!values.distEletronica && !values.distFisica) pendentes.push("A guarda é");
    if (!values.responsavelDocumentoId) pendentes.push("Responsável pelo documento");
    if (values.distFisica && !values.responsavelId) {
      pendentes.push("Responsável pela posse do documento");
    }
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
      elaboradorId: values.responsavelDocumentoId,
      localizacao: values.localizacao,
      permissoes: buildPermissoesFromExternoRegistro(values),
      validade: buildValidadeFromExternoRegistro(values),
      externoRegistro: buildExternoRegistroMeta(values),
      anexos: anexos.length ? anexos : undefined,
    };

    try {
      await withLoading(async () => {
        if (editando && documentId) {
          const ok = updateDocumentoExternoCadastro(documentId, payloadBase);
          if (!ok) {
            throw new Error("Não foi possível atualizar o documento.");
          }
          const versaoAtual = getVersionsByDocumentId(documentId).find(
            (v) => v.versao === getDocumentById(documentId)?.versaoAtual
          );
          if (anexos.some((a) => a.dataUrl.startsWith("data:"))) {
            markQualidadeDocumentFilesPending(documentId, versaoAtual?.id ?? "");
          }
          await flushQualidadeDocumentsSync();
          onOpenChange(false);
          afterUiTransition(() => {
            resetForm();
            onSalvo?.();
          });
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

        await flushQualidadeDocumentsSync();
        onOpenChange(false);
        afterUiTransition(() => {
          resetForm();
          navigate("/qualidade/documentos/consulta?guia=externo");
        });
      }, editando ? "Salvando alterações..." : "Gravando documento...");
    } catch (err) {
      console.error("[qualidade] falha ao sincronizar documento externo:", err);
      setErro(
        err instanceof Error && err.message.startsWith("Não foi possível")
          ? err.message
          : editando
            ? "Alterações salvas localmente, mas falhou ao gravar no servidor."
            : "Documento criado localmente, mas falhou ao salvar no servidor. Tente novamente."
      );
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
              Gravar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
