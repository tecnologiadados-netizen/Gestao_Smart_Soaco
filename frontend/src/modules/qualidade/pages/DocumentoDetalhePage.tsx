import { useState } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from "lucide-react";
import { Button, buttonVariants } from "@qualidade/components/ui/button";
import { cn } from "@qualidade/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@qualidade/components/ui/card";
import { Badge } from "@qualidade/components/ui/badge";
import { Separator } from "@qualidade/components/ui/separator";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import {
  documentStatusLabels,
  getDocumentStatusVariant,
} from "@qualidade/lib/utils/status-labels";
import { formatarData, formatarDataHora } from "@qualidade/lib/utils/dates";
import { SolicitarRevisaoDocumentoDialog } from "@qualidade/components/documentos/solicitar-revisao-documento-dialog";

export function DocumentoDetalhePage() {
  const params = useParams();
  const navigate = useNavigate();
  const id = params.id as string;

  const getDocumentById = useDocumentsStore((s) => s.getDocumentById);
  const getVersionsByDocumentId = useDocumentsStore(
    (s) => s.getVersionsByDocumentId
  );
  const getNextRevisionForDocument = useDocumentsStore(
    (s) => s.getNextRevisionForDocument
  );
  const users = useConfigStore((s) => s.users);
  const departments = useConfigStore((s) => s.departments);
  const documentTypes = useConfigStore((s) => s.documentTypes);

  const [revisaoAberta, setRevisaoAberta] = useState(false);

  const doc = getDocumentById(id);
  const versions = getVersionsByDocumentId(id);
  const versaoAtual = versions[0];

  if (!doc) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Documento não encontrado.</p>
        <Link
          to="/qualidade/documentos/consulta"
          className={cn(buttonVariants({ variant: "outline" }), "mt-4 inline-flex")}
        >
          Voltar à consulta
        </Link>
      </div>
    );
  }

  const tipo = documentTypes.find((t) => t.id === doc.tipoId);
  const setor = departments.find((d) => d.id === doc.setorId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{doc.codigo}</h1>
            <Badge variant={getDocumentStatusVariant(doc.status)}>
              {documentStatusLabels[doc.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground">{doc.titulo}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Informações</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Categoria</p>
                <p className="font-medium">{tipo?.nome ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Setor</p>
                <p className="font-medium">{setor?.nome ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Revisão atual</p>
                <p className="font-medium">{doc.versaoAtual}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Última atualização</p>
                <p className="font-medium">{formatarDataHora(doc.updatedAt)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de revisões</CardTitle>
              <CardDescription>Timeline do documento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {versions.map((ver, idx) => {
                const elaborador = users.find((u) => u.id === ver.elaboradorId);
                const consensoVer = users.find((u) => u.id === ver.consensoId);
                const revisorVer = users.find((u) => u.id === ver.revisorId);
                const aprovadorVer = users.find(
                  (u) => u.id === ver.aprovadorId
                );
                return (
                  <div key={ver.id}>
                    {idx > 0 && <Separator className="mb-4" />}
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-muted p-2">
                        <FileText className="size-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">Revisão {ver.versao}</p>
                        <p className="text-sm text-muted-foreground">
                          Elaborado por {elaborador?.nome} em{" "}
                          {formatarData(ver.dataElaboracao)}
                          {ver.prazos ? ` · Prazo: ${ver.prazos.elaboracao} dias` : ""}
                        </p>
                        {consensoVer && (
                          <p className="text-sm text-muted-foreground">
                            Consenso: {consensoVer.nome}
                            {ver.prazos
                              ? ` · Prazo: ${ver.prazos.consenso} dias`
                              : ""}
                          </p>
                        )}
                        {aprovadorVer && !ver.dataAprovacao && ver.prazos && (
                          <p className="text-sm text-muted-foreground">
                            Aprovador: {aprovadorVer.nome} · Prazo:{" "}
                            {ver.prazos.aprovacao} dias
                          </p>
                        )}
                        {ver.dataRevisao && (
                          <p className="text-sm text-muted-foreground">
                            Revisado por {revisorVer?.nome} em{" "}
                            {formatarData(ver.dataRevisao)}
                          </p>
                        )}
                        {ver.dataAprovacao && (
                          <p className="text-sm text-muted-foreground">
                            Aprovado por {aprovadorVer?.nome} em{" "}
                            {formatarData(ver.dataAprovacao)}
                          </p>
                        )}
                        {ver.arquivoNome && (
                          <p className="mt-1 text-sm text-primary">
                            📎 {ver.arquivoNome}
                          </p>
                        )}
                        {ver.observacoesConsenso && (
                          <p className="mt-1 text-sm italic text-muted-foreground">
                            Consenso: {ver.observacoesConsenso}
                          </p>
                        )}
                        {ver.observacoes && (
                          <p className="mt-1 text-sm italic text-muted-foreground">
                            {ver.observacoes}
                          </p>
                        )}
                        {ver.justificativaRevisao && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            <span className="font-medium">Motivo da revisão:</span>{" "}
                            {ver.justificativaRevisao}
                          </p>
                        )}
                        {ver.alteracoesRevisao && (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Alterações:</span>{" "}
                            {ver.alteracoesRevisao}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Fluxo de aprovação</CardTitle>
              <CardDescription>Ações disponíveis para este status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {doc.status === "rascunho" && (
                <>
                  <Link
                    to={`/qualidade/documentos/${id}/elaborar`}
                    className={cn(buttonVariants(), "w-full justify-center")}
                  >
                    Continuar elaboração
                  </Link>
                  {versaoAtual?.arquivoNome ? (
                    <p className="text-sm text-muted-foreground">
                      Arquivo anexado: {versaoAtual.arquivoNome}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Anexe o arquivo inicial na etapa de elaboração.
                    </p>
                  )}
                </>
              )}
              {doc.status === "em_revisao" && (
                <>
                  <Link
                    to={`/qualidade/documentos/${id}/consenso`}
                    className={cn(buttonVariants(), "w-full justify-center")}
                  >
                    Registrar consenso
                  </Link>
                  {versaoAtual?.observacoesConsenso && (
                    <p className="text-sm text-muted-foreground">
                      Parecer registrado parcialmente.
                    </p>
                  )}
                </>
              )}
              {doc.status === "em_aprovacao" && (
                <>
                  <Link
                    to={`/qualidade/documentos/${id}/aprovacao`}
                    className={cn(buttonVariants(), "w-full justify-center")}
                  >
                    Registrar aprovação
                  </Link>
                </>
              )}
              {doc.status === "vigente" && (
                <>
                  <Button
                    className="w-full"
                    onClick={() => setRevisaoAberta(true)}
                  >
                    Solicitar revisão ({getNextRevisionForDocument(id)})
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Configure responsáveis, justificativa e alterações antes de
                    enviar para elaboração.
                  </p>
                </>
              )}
              {doc.status === "obsoleto" && (
                <p className="text-sm text-muted-foreground">
                  Documento obsoleto — apenas consulta.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <SolicitarRevisaoDocumentoDialog
        documentId={id}
        open={revisaoAberta}
        onOpenChange={setRevisaoAberta}
      />
    </div>
  );
}
