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
  DocumentoHistoricoElaboracao,
  DocumentoReprovacaoAlerta,
  exigeSubstituicaoNoConsenso,
  getUltimaReprovacao,
} from "@qualidade/components/documentos/documento-historico-workflow";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

export function ConsensoDocumentoPage() {
  const params = useParams();
  const { push: navigate, exiting } = useTransitionRouter();
  const id = params.id as string;

  const doc = useDocumentsStore((s) => s.documents.find((d) => d.id === id));
  const versaoAtual = useDocumentsStore((s) => {
    const document = s.documents.find((d) => d.id === id);
    if (!document) return undefined;
    return s.versions.find(
      (v) => v.documentId === id && v.versao === document.versaoAtual
    );
  });
  const updateConsenso = useDocumentsStore((s) => s.updateConsenso);
  const aprovarConsenso = useDocumentsStore((s) => s.aprovarConsenso);
  const reenviarParaAprovacao = useDocumentsStore(
    (s) => s.reenviarParaAprovacao
  );
  const reprovarConsenso = useDocumentsStore((s) => s.reprovarConsenso);

  const documentTypes = useConfigStore((s) => s.documentTypes);
  const departments = useConfigStore((s) => s.departments);
  const users = useConfigStore((s) => s.users);

  const [observacoes, setObservacoes] = useState("");
  const [justificativaReprovacao, setJustificativaReprovacao] = useState("");
  const [modoReprovacao, setModoReprovacao] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (modoReprovacao) {
      document.getElementById("justificativa-reprovar")?.focus();
    }
  }, [modoReprovacao]);

  useEffect(() => {
    if (!versaoAtual) return;
    setObservacoes(versaoAtual.observacoesConsenso ?? "");
  }, [versaoAtual]);

  if (!doc || !versaoAtual) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Documento não encontrado.</p>
        <Link
          to="/qualidade/documentos"
          className={cn(buttonVariants({ variant: "outline" }), "mt-4 inline-flex")}
        >
          Voltar às pendências
        </Link>
      </div>
    );
  }

  if (doc.status !== "em_revisao") {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">
          Este documento não está mais em consenso.
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
  const reprovacaoAprovacao = getUltimaReprovacao(versaoAtual, "aprovacao");
  const retornoDaAprovacao = exigeSubstituicaoNoConsenso(versaoAtual);

  function processarArquivo(file: File) {
    setError("");

    if (file.size > MAX_FILE_BYTES) {
      setError("Arquivo muito grande. Limite de 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        updateConsenso(id, {
          arquivoNome: file.name,
          arquivoDataUrl: result,
          observacoesConsenso: observacoes || undefined,
        });
      }
    };
    reader.readAsDataURL(file);
  }

  function handleExcluirArquivoConsenso() {
    setError("");
    updateConsenso(id, {
      arquivoNome: "",
      arquivoDataUrl: "",
      observacoesConsenso: observacoes || undefined,
    });
  }

  function handleAprovar() {
    if (!versaoAtual) return;
    setModoReprovacao(false);
    setError("");
    if (!versaoAtual.arquivoNome) {
      setError("Não há arquivo para analisar.");
      return;
    }

    updateConsenso(id, { observacoesConsenso: observacoes || undefined });
    const ok = aprovarConsenso(id, observacoes);
    if (!ok) {
      setError("Não foi possível aprovar. Verifique o documento anexado.");
      return;
    }
    navigate("/qualidade/documentos");
  }

  function handleEnviarParaAprovacao() {
    if (!versaoAtual) return;
    setError("");
    if (!versaoAtual.arquivoNome) {
      setError("Anexe o documento ajustado antes de enviar para aprovação.");
      return;
    }
    if (!versaoAtual.arquivoAtualizadoEm) {
      setError(
        "Substitua o documento atual antes de enviar — é necessário anexar a versão ajustada."
      );
      return;
    }

    updateConsenso(id, { observacoesConsenso: observacoes || undefined });
    const ok = reenviarParaAprovacao(id, observacoes);
    if (!ok) {
      setError("Não foi possível enviar para aprovação. Verifique o anexo.");
      return;
    }
    navigate("/qualidade/documentos");
  }

  function handleReprovar() {
    setError("");
    if (!modoReprovacao) {
      setModoReprovacao(true);
      return;
    }

    if (!justificativaReprovacao.trim()) {
      setError("Informe a justificativa obrigatória para reprovar.");
      return;
    }

    const ok = reprovarConsenso(id, justificativaReprovacao.trim());
    if (!ok) return;
    navigate("/qualidade/documentos");
  }

  return (
    <DocumentoWorkflowPage
      title={`Consenso — ${doc.codigo}`}
      activeStep={2}
      onBack={() => navigate("/qualidade/documentos")}
      exiting={exiting}
      version={versaoAtual}
      users={users}
      footer={
        retornoDaAprovacao ? (
          <>
            <Button
              type="button"
              size="lg"
              className="min-w-48"
              onClick={handleEnviarParaAprovacao}
            >
              Enviar para aprovação
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => navigate("/qualidade/documentos")}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              size="lg"
              className="min-w-32"
              onClick={handleAprovar}
            >
              Aprovar
            </Button>
            <Button
              type="button"
              size="lg"
              variant="destructive"
              onClick={handleReprovar}
            >
              {modoReprovacao ? "Confirmar reprovação" : "Reprovar"}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => navigate("/qualidade/documentos")}
            >
              Cancelar
            </Button>
          </>
        )
      }
    >
      <DocumentoIdentificacaoResumo
        doc={doc}
        version={versaoAtual}
        categoria={categoria}
        processo={processo}
        users={users}
      />

      <DocumentoHistoricoElaboracao
        version={versaoAtual}
        users={users}
        ocultarArquivo={retornoDaAprovacao}
      />

      {reprovacaoAprovacao?.motivo && (
        <DocumentoReprovacaoAlerta
          titulo="Documento reprovado na aprovação"
          motivo={reprovacaoAprovacao.motivo}
          etapaOrigem="aprovação"
        />
      )}

      {retornoDaAprovacao ? (
        <fieldset className="brand-fieldset space-y-4">
          <legend className="text-base">Documento para reenvio</legend>
          <p className="text-sm text-muted-foreground">
            Insira o anexo ajustado conforme o parecer da aprovação e envie
            novamente para análise.
          </p>
          <DocumentoArquivoField
            inputId="arquivo-consenso"
            label="Documento ajustado *"
            arquivoNome={versaoAtual.arquivoNome}
            arquivoDataUrl={versaoAtual.arquivoDataUrl}
            onFileSelect={processarArquivo}
            onRemove={handleExcluirArquivoConsenso}
            accept={ACCEPTED_TYPES}
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </fieldset>
      ) : (
        <>
          <fieldset className="brand-fieldset space-y-4">
            <legend className="text-base">Parecer do consenso</legend>
            <div className="space-y-2">
              <Label className="text-base" htmlFor="obs-consenso">
                Observações (opcional na aprovação)
              </Label>
              <Textarea
                id="obs-consenso"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                onBlur={() =>
                  updateConsenso(id, {
                    observacoesConsenso: observacoes || undefined,
                  })
                }
                placeholder="Registre observações sobre o documento..."
                rows={4}
                className="text-base"
              />
            </div>

            {modoReprovacao && (
              <div className="space-y-2">
                <Label className="text-base" htmlFor="justificativa-reprovar">
                  Justificativa da reprovação *
                </Label>
                <Textarea
                  id="justificativa-reprovar"
                  value={justificativaReprovacao}
                  onChange={(e) => setJustificativaReprovacao(e.target.value)}
                  placeholder="Descreva o motivo para o elaborador corrigir..."
                  rows={4}
                  className="text-base"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => {
                    setModoReprovacao(false);
                    setJustificativaReprovacao("");
                    setError("");
                  }}
                >
                  Cancelar reprovação
                </Button>
              </div>
            )}

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </fieldset>
        </>
      )}
    </DocumentoWorkflowPage>
  );
}
