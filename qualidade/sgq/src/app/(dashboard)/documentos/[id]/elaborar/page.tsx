"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTransitionRouter } from "@/hooks/use-transition-router";
import { DocumentoWorkflowPage } from "@/components/documentos/documento-workflow-page";
import { DocumentoIdentificacaoResumo } from "@/components/documentos/documento-identificacao-resumo";
import { DocumentoArquivoField } from "@/components/documentos/documento-arquivo-field";
import {
  DocumentoReprovacaoAlerta,
  getUltimaReprovacao,
} from "@/components/documentos/documento-historico-workflow";
import { useDocumentsStore } from "@/lib/store/documents-store";
import { useConfigStore } from "@/lib/store/config-store";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

export default function ElaborarDocumentoPage() {
  const params = useParams();
  const { push: navigate, exiting } = useTransitionRouter();
  const id = params.id as string;

  const getDocumentById = useDocumentsStore((s) => s.getDocumentById);
  const getVersionsByDocumentId = useDocumentsStore(
    (s) => s.getVersionsByDocumentId
  );
  const updateElaboracao = useDocumentsStore((s) => s.updateElaboracao);
  const enviarParaRevisao = useDocumentsStore((s) => s.enviarParaRevisao);

  const documentTypes = useConfigStore((s) => s.documentTypes);
  const departments = useConfigStore((s) => s.departments);
  const users = useConfigStore((s) => s.users);
  const currentUserId = useConfigStore((s) => s.currentUserId);

  const doc = getDocumentById(id);
  const versions = getVersionsByDocumentId(id);
  const versaoAtual = versions[0];

  const [arquivoNome, setArquivoNome] = useState("");
  const [arquivoDataUrl, setArquivoDataUrl] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [error, setError] = useState("");
  const [savedHint, setSavedHint] = useState(false);

  useEffect(() => {
    if (!versaoAtual) return;
    setArquivoNome(versaoAtual.arquivoNome ?? "");
    setArquivoDataUrl(versaoAtual.arquivoDataUrl ?? "");
    setObservacoes(versaoAtual.observacoesElaboracao ?? "");
  }, [versaoAtual]);

  if (!doc || !versaoAtual) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Documento não encontrado.</p>
        <Link href="/documentos" className={cn(buttonVariants({ variant: "outline" }), "mt-4 inline-flex")}>
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
          href={`/documentos/${id}`}
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

  function persistElaboracao() {
    updateElaboracao(id, {
      arquivoNome: arquivoNome || undefined,
      arquivoDataUrl: arquivoDataUrl || undefined,
      observacoesElaboracao: observacoes || undefined,
    });
    setSavedHint(true);
    setTimeout(() => setSavedHint(false), 2500);
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
      if (typeof result === "string") {
        setArquivoNome(file.name);
        setArquivoDataUrl(result);
        updateElaboracao(id, {
          arquivoNome: file.name,
          arquivoDataUrl: result,
          observacoesElaboracao: observacoes || undefined,
        });
        setSavedHint(true);
        setTimeout(() => setSavedHint(false), 2500);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleExcluirArquivo() {
    setError("");
    setArquivoNome("");
    setArquivoDataUrl("");
    updateElaboracao(id, {
      arquivoNome: "",
      arquivoDataUrl: "",
      observacoesElaboracao: observacoes || undefined,
    });
  }

  function handleEnviarConsenso() {
    if (!arquivoNome) {
      setError("Anexe o arquivo inicial antes de enviar para consenso.");
      return;
    }
    persistElaboracao();
    enviarParaRevisao(id, versaoAtual.consensoId ?? currentUserId);
    navigate("/documentos");
  }

  const origemLabel =
    doc.origem === "registro"
      ? "registro"
      : doc.origem === "externo"
        ? "documento externo"
        : "documento interno";

  return (
    <DocumentoWorkflowPage
      title={`Elaboração — ${doc.codigo}`}
      activeStep={1}
      onBack={() => navigate("/documentos")}
      exiting={exiting}
      version={versaoAtual}
      users={users}
      footer={
        <>
          <Button
            type="button"
            size="lg"
            className="min-w-40"
            onClick={handleEnviarConsenso}
          >
            Enviar para consenso
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => navigate("/documentos")}
          >
            Cancelar
          </Button>
          {savedHint && (
            <span className="self-center text-sm text-brand-blue">
              Salvo no navegador
            </span>
          )}
        </>
      }
    >
        <DocumentoIdentificacaoResumo
          doc={doc}
          version={versaoAtual}
          categoria={categoria}
          processo={processo}
          users={users}
        />

        {reprovacaoConsenso?.motivo && (
          <DocumentoReprovacaoAlerta
            titulo="Documento reprovado no consenso"
            motivo={reprovacaoConsenso.motivo}
            etapaOrigem="consenso"
          />
        )}

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
            inputId="arquivo"
            label="Arquivo inicial *"
            arquivoNome={arquivoNome}
            arquivoDataUrl={arquivoDataUrl}
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
