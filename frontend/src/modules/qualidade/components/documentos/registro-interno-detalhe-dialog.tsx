import { useMemo, useState } from "react";
import { FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { Dialog, DialogContent } from "@qualidade/components/ui/dialog";
import { Badge } from "@qualidade/components/ui/badge";
import { ConfirmacaoDialog } from "@qualidade/components/ui/confirmacao-dialog";
import { CadastroRegistroDialog } from "@qualidade/components/documentos/cadastro-registro-dialog";
import { AdicionarRegistroOcorrenciaDialog } from "@qualidade/components/documentos/adicionar-registro-ocorrencia-dialog";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import { cancelQualidadeDocumentsDebounce } from "@qualidade/lib/qualidadePersistence";
import { deleteQualidadeDocument } from "@qualidade/lib/api/qualidadeApi";
import { flushQualidadeDocumentsSync } from "@qualidade/lib/qualidadePersistence";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import {
  documentOrigemLabelsLong,
  documentStatusLabels,
  getDocumentStatusVariant,
} from "@qualidade/lib/utils/status-labels";
import { formatarData, formatarDataHora } from "@qualidade/lib/utils/dates";
import { formatDocumentCodigoExibicao } from "@qualidade/lib/documents/document-codigo";
import {
  labelResponsavel,
  permissaoAcessoSelectLabel,
} from "@qualidade/lib/utils/select-display";
import { openQualidadeArquivo } from "@qualidade/lib/documents/file-actions";
import { SgqArquivoAcoes } from "@qualidade/components/documentos/sgq-arquivo-imprimir-btn";
import { buildLocalizacaoOpcoes } from "@qualidade/lib/enderecamentos-sync";
import {
  labelPrazoRetencaoDocumento,
  mergeRegistroOcorrencias,
  modeloDoRegistro,
  ocorrenciaTemArquivo,
  sortOcorrenciasMaisRecente,
} from "@qualidade/lib/documents/registro-interno";

interface Props {
  documentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium leading-relaxed text-brand-navy">
        {value}
      </p>
    </div>
  );
}

export function RegistroInternoDetalheDialog({
  documentId,
  open,
  onOpenChange,
}: Props) {
  const documents = useDocumentsStore((s) => s.documents);
  const allVersions = useDocumentsStore((s) => s.versions);
  const getVersionsByDocumentId = useDocumentsStore(
    (s) => s.getVersionsByDocumentId
  );
  const inativarDocumento = useDocumentsStore((s) => s.inativarDocumento);
  const excluirDocumento = useDocumentsStore((s) => s.excluirDocumento);
  const removeRegistroInternoOcorrencia = useDocumentsStore(
    (s) => s.removeRegistroInternoOcorrencia
  );

  const [edicaoAberta, setEdicaoAberta] = useState(false);
  const [adicionarAberto, setAdicionarAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState<"inativar" | "excluir" | null>(
    null
  );
  const [ocorrenciaExcluirId, setOcorrenciaExcluirId] = useState<string | null>(
    null
  );
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [erroArquivo, setErroArquivo] = useState("");

  const users = useConfigStore((s) => s.users);
  const departments = useConfigStore((s) => s.departments);
  const enderecamentos = useConfigStore((s) => s.enderecamentos);

  const doc = useMemo(
    () =>
      documentId ? documents.find((d) => d.id === documentId) : undefined,
    [documents, documentId]
  );
  const versoes = useMemo(
    () => (documentId ? getVersionsByDocumentId(documentId) : []),
    [documentId, getVersionsByDocumentId, allVersions]
  );
  const versaoAtual = versoes.find((v) => v.versao === doc?.versaoAtual);
  const setor = departments.find((d) => d.id === doc?.setorId);
  const localizacaoLabel = useMemo(() => {
    const valor = doc?.localizacao?.trim() ?? "";
    if (!valor) return "—";
    const opcoes = buildLocalizacaoOpcoes(enderecamentos, departments, valor);
    return opcoes.find((opcao) => opcao.value === valor)?.label ?? valor;
  }, [departments, doc?.localizacao, enderecamentos]);

  const ocorrencias = useMemo(
    () =>
      sortOcorrenciasMaisRecente(
        mergeRegistroOcorrencias(
          doc?.externoRegistro?.ocorrencias,
          versaoAtual?.anexos
        )
      ),
    [doc?.externoRegistro?.ocorrencias, versaoAtual?.anexos]
  );
  const modelo = useMemo(
    () => (doc ? modeloDoRegistro(doc, versaoAtual) : null),
    [doc, versaoAtual]
  );

  async function abrirArquivo(arquivo: {
    nome: string;
    dataUrl: string;
    storagePath?: string;
  }) {
    if (!arquivo.nome?.trim()) return;
    setErroArquivo("");
    try {
      await openQualidadeArquivo(arquivo, "print");
    } catch (error) {
      setErroArquivo(
        error instanceof Error
          ? error.message
          : "Não foi possível abrir o arquivo."
      );
    }
  }

  function confirmarInativacao() {
    if (!documentId) return;
    inativarDocumento(documentId);
    onOpenChange(false);
  }

  async function confirmarExclusao() {
    if (!documentId || excluindo) return;
    setExcluindo(true);
    setErroExclusao(null);
    try {
      await deleteQualidadeDocument(documentId);
      cancelQualidadeDocumentsDebounce();
      excluirDocumento(documentId);
      onOpenChange(false);
    } catch (err) {
      setErroExclusao(
        err instanceof Error
          ? err.message
          : "Não foi possível excluir o registro."
      );
      setConfirmacao(null);
    } finally {
      setExcluindo(false);
    }
  }

  async function confirmarExclusaoOcorrencia() {
    if (!documentId || !ocorrenciaExcluirId) return;
    const ok = removeRegistroInternoOcorrencia(documentId, ocorrenciaExcluirId);
    setOcorrenciaExcluirId(null);
    if (!ok) {
      setErroArquivo("Não foi possível remover o registro.");
      return;
    }
    try {
      await flushQualidadeDocumentsSync();
    } catch (err) {
      console.error("[qualidade] falha ao sincronizar exclusão de ocorrência:", err);
      setErroArquivo("Removido localmente, mas falhou ao gravar no servidor.");
    }
  }

  if (!doc) return null;

  const permissaoLabel =
    permissaoAcessoSelectLabel(doc.externoRegistro?.permissaoAcesso ?? "") ??
    (doc.permissoes?.consultarTodos ? "Todos" : "Restrito");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[min(94vh,100dvh)] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
        >
          <div className="modal-header-bar flex items-center justify-between px-8 py-4">
            <h2 className="text-base font-semibold text-white">
              Registro interno
            </h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded p-1.5 hover:bg-white/20"
              aria-label="Fechar"
            >
              <X className="size-5 text-white" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20">
            <div className="space-y-8 p-8">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-md bg-brand-blue px-2.5 py-1 text-sm font-bold text-white">
                      {formatDocumentCodigoExibicao(doc.codigo, doc.versaoAtual)}
                    </span>
                    <Badge variant={getDocumentStatusVariant(doc.status)}>
                      {documentStatusLabels[doc.status]}
                    </Badge>
                  </div>
                  <h3 className="max-w-3xl text-xl font-semibold leading-snug text-brand-navy">
                    {doc.titulo}
                  </h3>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  className="shrink-0 gap-2 border-brand-blue/30 px-4 text-brand-blue hover:bg-brand-blue-light/40"
                  onClick={() => setEdicaoAberta(true)}
                >
                  <Pencil className="size-3.5" />
                  Editar
                </Button>
              </div>

              <section className="rounded-xl border border-brand-blue-muted/60 bg-card p-6 shadow-sm">
                <p className="mb-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Identificação
                </p>
                <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
                  <MetaItem
                    label="Documento referente ao setor"
                    value={setor?.nome ?? "—"}
                  />
                  <MetaItem
                    label="Responsável pelo cadastro"
                    value={labelResponsavel(users, versaoAtual?.elaboradorId)}
                  />
                  <MetaItem
                    label="Localização do documento"
                    value={localizacaoLabel}
                  />
                  <MetaItem label="Permissão de acesso" value={permissaoLabel} />
                  <MetaItem
                    label="Prazo de retenção"
                    value={labelPrazoRetencaoDocumento(doc.externoRegistro)}
                  />
                  <MetaItem
                    label="Atualizado em"
                    value={formatarDataHora(doc.updatedAt)}
                  />
                  <MetaItem
                    label="Origem"
                    value={documentOrigemLabelsLong[doc.origem]}
                  />
                </div>
                <div className="mt-6 border-t border-border/60 pt-5">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Modelo do documento
                  </p>
                  {modelo?.nome ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className="break-all text-left text-sm font-medium text-brand-blue hover:underline"
                        onClick={() => void abrirArquivo(modelo)}
                      >
                        {modelo.nome}
                      </button>
                      <SgqArquivoAcoes
                        arquivo={modelo}
                        onError={setErroArquivo}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum modelo anexado.
                    </p>
                  )}
                </div>
                {doc.externoRegistro?.observacao?.trim() ? (
                  <div className="mt-6 border-t border-border/60 pt-5">
                    <MetaItem
                      label="Observação"
                      value={doc.externoRegistro.observacao}
                    />
                  </div>
                ) : null}
              </section>

              <section className="rounded-xl border border-brand-blue-muted/60 bg-card p-6 shadow-sm">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Registros
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setAdicionarAberto(true)}
                    disabled={doc.status !== "vigente"}
                  >
                    <Plus className="size-3.5" />
                    Adicionar registro
                  </Button>
                </div>

                {ocorrencias.length === 0 ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Nenhum registro inserido ainda. Clique em Adicionar registro
                    para anexar a primeira ocorrência.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/70">
                    {ocorrencias.map((ocorrencia) => {
                      const disponivel = ocorrenciaTemArquivo(ocorrencia);
                      return (
                        <li
                          key={ocorrencia.id}
                          className="flex flex-wrap items-center justify-between gap-3 bg-muted/10 px-4 py-3"
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className="rounded-lg bg-brand-blue-light p-2">
                              <FileText className="size-4 text-brand-blue" />
                            </div>
                            <div className="min-w-0">
                              {disponivel ? (
                                <button
                                  type="button"
                                  className="break-all text-left text-sm font-medium text-brand-blue hover:underline"
                                  onClick={() => void abrirArquivo(ocorrencia)}
                                >
                                  {ocorrencia.nome}
                                </button>
                              ) : (
                                <p className="break-all text-sm font-medium text-brand-navy">
                                  {ocorrencia.nome}
                                </p>
                              )}
                              {ocorrencia.observacao ? (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {ocorrencia.observacao}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <span className="text-sm tabular-nums text-muted-foreground">
                              {formatarData(
                                /^\d{4}-\d{2}-\d{2}$/.test(
                                  ocorrencia.dataOcorrencia
                                )
                                  ? `${ocorrencia.dataOcorrencia}T12:00:00`
                                  : ocorrencia.dataOcorrencia
                              )}
                            </span>
                            <div className="flex gap-1">
                              <SgqArquivoAcoes
                                arquivo={ocorrencia}
                                disabled={!disponivel}
                                onError={setErroArquivo}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                title="Excluir registro"
                                className="text-destructive hover:text-destructive"
                                onClick={() =>
                                  setOcorrenciaExcluirId(ocorrencia.id)
                                }
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {erroArquivo ? (
                  <p className="mt-3 text-sm text-destructive">{erroArquivo}</p>
                ) : null}
              </section>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-brand-blue-muted bg-card px-8 py-5">
            {erroExclusao ? (
              <p className="mr-auto text-sm text-destructive">{erroExclusao}</p>
            ) : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={doc.status !== "vigente"}
              onClick={() => setConfirmacao("inativar")}
            >
              Inativar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmacao("excluir")}
            >
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CadastroRegistroDialog
        open={edicaoAberta}
        onOpenChange={setEdicaoAberta}
        documentId={documentId}
      />

      <AdicionarRegistroOcorrenciaDialog
        documentId={documentId}
        open={adicionarAberto}
        onOpenChange={setAdicionarAberto}
      />

      <ConfirmacaoDialog
        open={confirmacao === "inativar"}
        onOpenChange={(v) => {
          if (!v) setConfirmacao(null);
        }}
        titulo="Inativar registro"
        mensagem="O registro interno ficará inativo e não receberá novas ocorrências. Deseja continuar?"
        confirmarLabel="Inativar"
        onConfirmar={confirmarInativacao}
      />

      <ConfirmacaoDialog
        open={confirmacao === "excluir"}
        onOpenChange={(v) => {
          if (!v) setConfirmacao(null);
        }}
        titulo="Excluir registro"
        mensagem="Esta ação remove a ficha e todos os arquivos anexados. Deseja continuar?"
        confirmarLabel={excluindo ? "Excluindo..." : "Excluir"}
        variant="destructive"
        onConfirmar={() => {
          void confirmarExclusao();
        }}
      />

      <ConfirmacaoDialog
        open={Boolean(ocorrenciaExcluirId)}
        onOpenChange={(v) => {
          if (!v) setOcorrenciaExcluirId(null);
        }}
        titulo="Excluir ocorrência"
        mensagem="Remover este arquivo da lista de registros?"
        confirmarLabel="Excluir"
        variant="destructive"
        onConfirmar={() => {
          void confirmarExclusaoOcorrencia();
        }}
      />
    </>
  );
}
