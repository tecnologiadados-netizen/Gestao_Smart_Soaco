import { useEffect, useState } from "react";
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Button, buttonVariants } from "@qualidade/components/ui/button";
import { Label } from "@qualidade/components/ui/label";
import { Textarea } from "@qualidade/components/ui/textarea";
import { cn } from "@qualidade/lib/utils";
import { useTransitionRouter } from "@qualidade/hooks/use-transition-router";
import { DocumentoWorkflowPage } from "@qualidade/components/documentos/documento-workflow-page";
import { DocumentoIdentificacaoResumo } from "@qualidade/components/documentos/documento-identificacao-resumo";
import { DocumentoArquivoField } from "@qualidade/components/documentos/documento-arquivo-field";
import {
  DocumentoReprovacaoAlerta,
  getUltimaReprovacao,
} from "@qualidade/components/documentos/documento-historico-workflow";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import { formatDocumentCodigoExibicao } from "@qualidade/lib/documents/document-codigo";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import {
  flushQualidadeDocumentsSync,
  markQualidadeDocumentFilesPending,
  scheduleQualidadeDocumentsFlush,
  softRefreshQualidadeDocuments,
} from "@qualidade/lib/qualidadePersistence";
import { useLoading } from "@qualidade/components/providers/loading-provider";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

function detalharErroServidor(err: unknown): string {
  const detalhe = err instanceof Error ? err.message.trim() : "";
  return detalhe ? ` Detalhe: ${detalhe}` : "";
}

export function ElaborarDocumentoPage() {
  const params = useParams();
  const { push: navigate, exiting, navigate: navigateImmediate } =
    useTransitionRouter();
  const { withLoading } = useLoading();
  const id = params.id as string;

  const getDocumentById = useDocumentsStore((s) => s.getDocumentById);
  const getVersionsByDocumentId = useDocumentsStore(
    (s) => s.getVersionsByDocumentId
  );
  const updateElaboracao = useDocumentsStore((s) => s.updateElaboracao);
  const enviarParaRevisao = useDocumentsStore((s) => s.enviarParaRevisao);
  const reabrirElaboracaoAposFalhaSync = useDocumentsStore(
    (s) => s.reabrirElaboracaoAposFalhaSync
  );
  const getPendingTasks = useDocumentsStore((s) => s.getPendingTasks);

  const documentTypes = useConfigStore((s) => s.documentTypes);
  const departments = useConfigStore((s) => s.departments);
  const users = useConfigStore((s) => s.users);
  const currentUserId = useConfigStore((s) => s.currentUserId);

  const doc = getDocumentById(id);
  const versions = getVersionsByDocumentId(id);
  const versaoAtual =
    versions.find((v) => v.versao === doc?.versaoAtual) ?? versions[0];
  const tarefaCorrecao = getPendingTasks(currentUserId).find(
    (t) =>
      t.referenciaId === id &&
      t.tipo === "elaborar_documento" &&
      t.titulo.startsWith("Corrigir")
  );

  const [arquivoNome, setArquivoNome] = useState("");
  const [arquivoDataUrl, setArquivoDataUrl] = useState("");
  const [arquivoStoragePath, setArquivoStoragePath] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [error, setError] = useState("");
  const [savedHint, setSavedHint] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!versaoAtual) return;
    setArquivoNome(versaoAtual.arquivoNome ?? "");
    setArquivoDataUrl(versaoAtual.arquivoDataUrl ?? "");
    setArquivoStoragePath(versaoAtual.arquivoStoragePath ?? "");
    setObservacoes(versaoAtual.observacoesElaboracao ?? "");
  }, [versaoAtual]);

  if (!doc || !versaoAtual) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Documento não encontrado.</p>
        <Link to="/qualidade/documentos" className={cn(buttonVariants({ variant: "outline" }), "mt-4 inline-flex")}>
          Voltar às pendências
        </Link>
      </div>
    );
  }

  if (doc.status !== "rascunho") {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">
          Este documento não está mais em elaboração.
        </p>
        <Link
          to={`/qualidade/documentos/${id}`}
          className={cn(buttonVariants({ variant: "outline" }), "mt-4 inline-flex")}
        >
          Ver documento
        </Link>
      </div>
    );
  }

  const categoria = documentTypes.find((t) => t.id === doc.tipoId);
  const processo = departments.find((d) => d.id === doc.setorId);
  const reprovacaoConsenso = getUltimaReprovacao(versaoAtual, "consenso");
  const motivoReprovacao =
    reprovacaoConsenso?.motivo?.trim() ||
    (tarefaCorrecao?.descricao &&
    !tarefaCorrecao.descricao.startsWith("Revisão ")
      ? tarefaCorrecao.descricao.trim()
      : "");
  const precisaAjuste = Boolean(motivoReprovacao || tarefaCorrecao);

  function persistArquivoNoServidor(nome: string, dataUrl: string) {
    // UI libera na hora; sync do PDF em segundo plano e depois busca storagePath.
    updateElaboracao(id, {
      arquivoNome: nome || undefined,
      arquivoDataUrl: dataUrl || undefined,
      observacoesElaboracao: observacoes || undefined,
    });
    markQualidadeDocumentFilesPending(id, versaoAtual.id);
    void (async () => {
      try {
        await flushQualidadeDocumentsSync();
        await softRefreshQualidadeDocuments();
        const ver = useDocumentsStore
          .getState()
          .versions.find((v) => v.id === versaoAtual.id);
        if (ver?.arquivoStoragePath) {
          setArquivoStoragePath(ver.arquivoStoragePath);
        }
        setSavedHint(true);
        setTimeout(() => setSavedHint(false), 2500);
      } catch (err) {
        console.error("[qualidade] falha ao gravar anexo da elaboração:", err);
        setError(
          "Arquivo anexado localmente, mas falhou ao gravar no servidor. Tente novamente." +
            detalharErroServidor(err)
        );
      }
    })();
  }

  function processarArquivo(file: File) {
    setError("");

    if (file.size > MAX_FILE_BYTES) {
      setError("Arquivo muito grande. Limite de 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return;
      setArquivoNome(file.name);
      setArquivoDataUrl(result);
      setArquivoStoragePath("");
      persistArquivoNoServidor(file.name, result);
    };
    reader.readAsDataURL(file);
  }

  function handleExcluirArquivo() {
    setError("");
    setArquivoNome("");
    setArquivoDataUrl("");
    setArquivoStoragePath("");
    updateElaboracao(id, {
      arquivoNome: "",
      arquivoDataUrl: "",
      observacoesElaboracao: observacoes || undefined,
    });
    scheduleQualidadeDocumentsFlush();
  }

  async function handleEnviarConsenso() {
    if (!arquivoNome) {
      setError("Anexe o arquivo inicial antes de enviar para consenso.");
      return;
    }
    if (!versaoAtual) return;
    setError("");
    setEnviando(true);

    try {
      await withLoading(async () => {
        // 1) Garante anexo/observações no servidor ainda em rascunho (sem mudar etapa).
        updateElaboracao(id, {
          observacoesElaboracao: observacoes || undefined,
        });

        const verAntes = useDocumentsStore
          .getState()
          .versions.find(
            (v) => v.documentId === id && v.versao === doc.versaoAtual
          );
        const pathServidor =
          verAntes?.arquivoStoragePath?.trim() ||
          arquivoStoragePath.trim() ||
          "";
        const precisaReenviarArquivo =
          arquivoDataUrl.startsWith("data:") && !pathServidor;

        if (precisaReenviarArquivo) {
          updateElaboracao(id, {
            arquivoNome: arquivoNome || undefined,
            arquivoDataUrl: arquivoDataUrl || undefined,
            observacoesElaboracao: observacoes || undefined,
          });
          markQualidadeDocumentFilesPending(id, versaoAtual.id);
        }

        await flushQualidadeDocumentsSync();
        if (precisaReenviarArquivo) {
          await softRefreshQualidadeDocuments();
          const verPos = useDocumentsStore
            .getState()
            .versions.find((v) => v.id === versaoAtual.id);
          if (verPos?.arquivoStoragePath) {
            setArquivoStoragePath(verPos.arquivoStoragePath);
          }
        }

        const consensoLogin = (
          verAntes?.consensoId ||
          versaoAtual.consensoId ||
          ""
        ).trim();
        if (!consensoLogin) {
          throw new Error(
            "Documento sem responsável de consenso configurado. Verifique o cadastro."
          );
        }

        // 2) Avança etapa local e só navega se o servidor confirmar.
        enviarParaRevisao(id, consensoLogin);
        try {
          await flushQualidadeDocumentsSync();
        } catch (flushErr) {
          reabrirElaboracaoAposFalhaSync(id);
          throw flushErr;
        }
        navigateImmediate("/qualidade/documentos");
      }, "Enviando para consenso...");
    } catch (err) {
      console.error("[qualidade] falha ao enviar para consenso:", err);
      setError(
        err instanceof Error && err.message.includes("responsável de consenso")
          ? err.message
          : "Não foi possível gravar o documento no servidor. Verifique a conexão e tente novamente." +
              detalharErroServidor(err)
      );
    } finally {
      setEnviando(false);
    }
  }

  const origemLabel =
    doc.origem === "registro"
      ? "registro"
      : doc.origem === "externo"
        ? "documento externo"
        : "documento interno";

  return (
    <DocumentoWorkflowPage
      title={`${precisaAjuste ? "Correção" : "Elaboração"} — ${formatDocumentCodigoExibicao(doc.codigo, doc.versaoAtual)}`}
      activeStep={1}
      onBack={() => navigate("/qualidade/documentos")}
      exiting={exiting}
      version={versaoAtual}
      users={users}
      footer={
        <>
          <Button
            type="button"
            size="lg"
            className="min-w-40"
            disabled={enviando}
            onClick={() => void handleEnviarConsenso()}
          >
            {enviando
              ? "Enviando..."
              : precisaAjuste
                ? "Reenviar para consenso"
                : "Enviar para consenso"}
          </Button>
          {savedHint && (
            <span className="self-center text-sm text-brand-blue">
              Salvo no servidor
            </span>
          )}
        </>
      }
    >
        {precisaAjuste ? (
          <DocumentoReprovacaoAlerta
            titulo="Documento reprovado no consenso"
            motivo={
              motivoReprovacao ||
              "Consulte o parecer do consenso e ajuste o arquivo antes de reenviar."
            }
            etapaOrigem="consenso"
          />
        ) : null}

        <DocumentoIdentificacaoResumo
          doc={doc}
          version={versaoAtual}
          categoria={categoria}
          processo={processo}
          users={users}
        />

        {versaoAtual.justificativaRevisao && (
          <fieldset className="brand-fieldset space-y-3">
            <legend className="text-base">Justificativa</legend>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Motivo da revisão
              </p>
              <p className="text-sm">{versaoAtual.justificativaRevisao}</p>
            </div>
          </fieldset>
        )}

        <fieldset className="brand-fieldset space-y-4">
          <legend className="text-base">Elaboração do {origemLabel}</legend>

          <DocumentoArquivoField
            label="Arquivo inicial *"
            arquivoNome={arquivoNome}
            arquivoDataUrl={arquivoDataUrl}
            arquivoStoragePath={arquivoStoragePath}
            onFileSelect={processarArquivo}
            onRemove={handleExcluirArquivo}
            accept={ACCEPTED_TYPES}
          />

          <div className="space-y-2">
            <Label className="text-base" htmlFor="obs-elaboracao">
              Observações da elaboração
            </Label>
            <Textarea
              id="obs-elaboracao"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Comentários sobre esta versão do documento..."
              rows={4}
              className="text-base"
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </fieldset>
      </DocumentoWorkflowPage>
  );
}
