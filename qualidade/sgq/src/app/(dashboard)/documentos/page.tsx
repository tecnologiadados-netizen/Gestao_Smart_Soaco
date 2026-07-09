"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DocumentosPendenciasBoards } from "@/components/documentos/documentos-pendencias-boards";
import { RevalidarDocumentoDialog } from "@/components/documentos/revalidar-documento-dialog";
import { SolicitarRevisaoDocumentoDialog } from "@/components/documentos/solicitar-revisao-documento-dialog";
import { useDocumentsStore } from "@/lib/store/documents-store";
import { useConfigStore } from "@/lib/store/config-store";

export default function DocumentosPage() {
  const searchParams = useSearchParams();
  const syncValidadeAlertas = useDocumentsStore((s) => s.syncValidadeAlertas);
  const getPendingTasks = useDocumentsStore((s) => s.getPendingTasks);
  const currentUserId = useConfigStore((s) => s.currentUserId);

  const [showAll, setShowAll] = useState(false);
  const [revalidarId, setRevalidarId] = useState<string | null>(null);
  const [revisaoId, setRevisaoId] = useState<string | null>(null);
  const [revisaoFromRevalidacao, setRevisaoFromRevalidacao] = useState(false);

  useEffect(() => {
    syncValidadeAlertas();
  }, [syncValidadeAlertas]);

  useEffect(() => {
    const param = searchParams.get("revalidar");
    if (param) setRevalidarId(param);
  }, [searchParams]);

  const pendenciasCount = useMemo(
    () =>
      getPendingTasks(currentUserId, showAll).filter(
        (t) => t.referenciaTipo === "documento"
      ).length,
    [getPendingTasks, currentUserId, showAll]
  );

  function fecharRevalidacao() {
    setRevalidarId(null);
    setRevisaoFromRevalidacao(false);
    setRevisaoId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Minhas pendências</h1>
          <p className="text-xs text-muted-foreground">
            Documentos aguardando sua ação
            {pendenciasCount > 0 ? ` · ${pendenciasCount} tarefa(s)` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={showAll ? "default" : "outline"}
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Ver minhas pendências" : "Ver pendências de todos"}
          </Button>
        </div>
      </div>

      <DocumentosPendenciasBoards showAll={showAll} />

      {!showAll && (
        <p className="text-left text-xs text-muted-foreground">
          Precisa consultar a base completa?{" "}
          <Link href="/documentos/consulta" className="text-primary underline">
            Ir para consulta
          </Link>
        </p>
      )}

      <RevalidarDocumentoDialog
        documentId={revalidarId}
        open={Boolean(revalidarId)}
        hidden={revisaoFromRevalidacao}
        onOpenChange={(aberto) => !aberto && fecharRevalidacao()}
        onSolicitarRevisao={(id) => {
          setRevisaoId(id);
          setRevisaoFromRevalidacao(true);
        }}
      />

      <SolicitarRevisaoDocumentoDialog
        documentId={revisaoId}
        open={Boolean(revisaoId)}
        fromRevalidacao={revisaoFromRevalidacao}
        onOpenChange={(aberto) => {
          if (!aberto && !revisaoFromRevalidacao) setRevisaoId(null);
        }}
        onVoltar={
          revisaoFromRevalidacao
            ? () => {
                setRevisaoId(null);
                setRevisaoFromRevalidacao(false);
              }
            : undefined
        }
        onConcluido={fecharRevalidacao}
      />
    </div>
  );
}
