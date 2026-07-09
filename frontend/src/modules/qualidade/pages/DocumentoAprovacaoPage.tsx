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
import {
  DocumentoHistoricoConsenso,
  DocumentoHistoricoElaboracao,
  documentoAjustadoNoConsenso,
} from "@qualidade/components/documentos/documento-historico-workflow";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";

export function AprovacaoDocumentoPage() {
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
  const aprovarDocumentoFinal = useDocumentsStore(
    (s) => s.aprovarDocumentoFinal
  );
  const reprovarAprovacao = useDocumentsStore((s) => s.reprovarAprovacao);

  const documentTypes = useConfigStore((s) => s.documentTypes);
  const departments = useConfigStore((s) => s.departments);
  const users = useConfigStore((s) => s.users);

  const [observacoes, setObservacoes] = useState("");
  const [justificativaReprovacao, setJustificativaReprovacao] = useState("");
  const [modoReprovacao, setModoReprovacao] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (modoReprovacao) {
      document.getElementById("justificativa-aprovacao")?.focus();
    }
  }, [modoReprovacao]);

  useEffect(() => {
    if (!versaoAtual) return;
    setObservacoes(versaoAtual.observacoesAprovacao ?? "");
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

  if (doc.status !== "em_aprovacao") {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">
          Este documento não está mais em aprovação.
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
  const ajustadoNoConsenso = documentoAjustadoNoConsenso(versaoAtual);

  function handleAprovar() {
    setModoReprovacao(false);
    setError("");
    const ok = aprovarDocumentoFinal(id, observacoes);
    if (!ok) {
      setError("Não foi possível finalizar a aprovação.");
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

    const ok = reprovarAprovacao(id, justificativaReprovacao.trim());
    if (!ok) return;
    navigate("/qualidade/documentos");
  }

  return (
    <DocumentoWorkflowPage
      title={`Aprovação — ${doc.codigo}`}
      activeStep={3}
      onBack={() => navigate("/qualidade/documentos")}
      exiting={exiting}
      version={versaoAtual}
      users={users}
      footer={
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
        documentoAjustadoNoConsenso={ajustadoNoConsenso}
      />

      {ajustadoNoConsenso ? (
        <DocumentoHistoricoConsenso version={versaoAtual} users={users} />
      ) : (
        versaoAtual.observacoesConsenso && (
          <fieldset className="brand-fieldset space-y-2">
            <legend className="text-base">Consenso</legend>
            <p className="text-sm text-muted-foreground">
              Registrado por{" "}
              {users.find((u) => u.id === versaoAtual.consensoId)?.nome ?? "—"}
              {versaoAtual.dataRevisao && (
                <>
                  {" "}
                  ·{" "}
                  {new Date(versaoAtual.dataRevisao).toLocaleDateString(
                    "pt-BR"
                  )}
                </>
              )}
            </p>
            <p className="text-sm">{versaoAtual.observacoesConsenso}</p>
          </fieldset>
        )
      )}

      <fieldset className="brand-fieldset space-y-4">
        <legend className="text-base">Parecer da aprovação</legend>

        <div className="space-y-2">
          <Label className="text-base" htmlFor="obs-aprovacao">
            Observações (opcional na aprovação)
          </Label>
          <Textarea
            id="obs-aprovacao"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Registre observações finais..."
            rows={4}
            className="text-base"
          />
        </div>

        {modoReprovacao && (
          <div className="space-y-2">
            <Label className="text-base" htmlFor="justificativa-aprovacao">
              Justificativa da reprovação *
            </Label>
            <Textarea
              id="justificativa-aprovacao"
              value={justificativaReprovacao}
              onChange={(e) => setJustificativaReprovacao(e.target.value)}
              placeholder="Descreva o motivo para o consenso substituir o documento..."
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
    </DocumentoWorkflowPage>
  );
}
