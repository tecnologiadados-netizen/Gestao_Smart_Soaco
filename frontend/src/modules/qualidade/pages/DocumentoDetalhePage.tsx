import { useState } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { ArrowLeft } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qualidade/components/ui/table";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import { formatDocumentCodigoExibicao } from "@qualidade/lib/documents/document-codigo";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import {
  documentStatusLabels,
  getDocumentStatusVariant,
} from "@qualidade/lib/utils/status-labels";
import { formatarData, formatarDataHora } from "@qualidade/lib/utils/dates";
import { labelResponsavel } from "@qualidade/lib/utils/select-display";
import {
  formatPrazosResumo,
} from "@qualidade/components/documentos/documento-responsaveis-fieldset";
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
            <h1 className="text-2xl font-bold">
              {formatDocumentCodigoExibicao(doc.codigo, doc.versaoAtual)}
            </h1>
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
                <p className="text-xs text-muted-foreground">Código</p>
                <p className="font-medium">
                  {formatDocumentCodigoExibicao(doc.codigo, doc.versaoAtual)}
                </p>
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
              <CardDescription>Uma linha por revisão do documento</CardDescription>
            </CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma revisão registrada.
                </p>
              ) : (
                <Table surface>
                  <TableHeader>
                    <TableRow className="border-b-2 border-border">
                      <TableHead className="w-28 border-r border-border/70">
                        Revisão
                      </TableHead>
                      <TableHead className="min-w-[9rem] border-r border-border/70">
                        Elaboração
                      </TableHead>
                      <TableHead className="min-w-[9rem] border-r border-border/70">
                        Aprovação
                      </TableHead>
                      <TableHead className="min-w-[11rem] border-r border-border/70">
                        Prazos
                      </TableHead>
                      <TableHead className="min-w-0">Arquivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((ver) => {
                      const elaboradorNome = labelResponsavel(
                        users,
                        ver.elaboradorId
                      );
                      const aprovadorNome = labelResponsavel(
                        users,
                        ver.aprovadorId
                      );
                      const isAtual = ver.versao === doc.versaoAtual;
                      return (
                        <TableRow
                          key={ver.id}
                          className={cn(
                            "border-b border-border/80 last:border-b-0",
                            isAtual && "bg-brand-blue-light/20"
                          )}
                        >
                          <TableCell className="border-r border-border/60 !whitespace-normal">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-brand-navy">
                                {ver.versao}
                              </span>
                              {isAtual ? (
                                <Badge
                                  variant="outline"
                                  className="border-brand-blue/40 text-brand-blue"
                                >
                                  Atual
                                </Badge>
                              ) : null}
                            </div>
                            {ver.justificativaRevisao ? (
                              <p
                                className="mt-1 max-w-[14rem] text-xs text-muted-foreground"
                                title={ver.justificativaRevisao}
                              >
                                Motivo: {ver.justificativaRevisao}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="border-r border-border/60 !whitespace-normal text-muted-foreground">
                            <span className="font-medium text-brand-navy">
                              {elaboradorNome}
                            </span>
                            <span className="mt-0.5 block text-xs">
                              {formatarData(ver.dataElaboracao)}
                            </span>
                          </TableCell>
                          <TableCell className="border-r border-border/60 !whitespace-normal text-muted-foreground">
                            {ver.dataAprovacao ? (
                              <>
                                <span className="font-medium text-brand-navy">
                                  {aprovadorNome}
                                </span>
                                <span className="mt-0.5 block text-xs">
                                  {formatarData(ver.dataAprovacao)}
                                </span>
                              </>
                            ) : ver.aprovadorId ? (
                              <span className="text-xs">{aprovadorNome}</span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="border-r border-border/60 !whitespace-normal text-xs text-muted-foreground">
                            {formatPrazosResumo(ver.prazos)}
                          </TableCell>
                          <TableCell className="max-w-0 !whitespace-normal">
                            {ver.arquivoNome ? (
                              <span
                                className="block truncate text-xs font-medium text-brand-blue"
                                title={ver.arquivoNome}
                              >
                                {ver.arquivoNome}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
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
