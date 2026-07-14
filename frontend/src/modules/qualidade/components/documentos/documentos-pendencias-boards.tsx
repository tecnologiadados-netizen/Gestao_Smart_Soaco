import { Link } from 'react-router-dom';
import { useMemo } from "react";
import { ArrowRight, CheckCircle2, GitBranch, RefreshCw } from "lucide-react";
import { cn } from "@qualidade/lib/utils";
import { buttonVariants } from "@qualidade/components/ui/button";
import { Badge } from "@qualidade/components/ui/badge";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import { resolveTaskAssignee } from "@qualidade/lib/documents/task-assignee";
import {
  documentoExigeRevalidacao,
  revalidacaoQuadroSituacaoLabels,
  situacaoRevalidacaoQuadro,
} from "@qualidade/lib/documents/validity";
import { formatarData } from "@qualidade/lib/utils/dates";
import { formatDocumentCodigoExibicao } from "@qualidade/lib/documents/document-codigo";
import { taskTypeLabels } from "@qualidade/lib/utils/status-labels";
import {
  getTaskActionHref,
  getTaskActionLabel,
} from "@qualidade/lib/documents/task-routes";
import type { Document } from "@qualidade/types/document";
import type { Task } from "@qualidade/types/task";

interface Props {
  showAll?: boolean;
}

const ETAPAS_FLUXO: Task["tipo"][] = [
  "elaborar_documento",
  "consenso_documento",
  "aprovar_documento",
  "revisar_documento",
];

interface RevalidacaoItem {
  doc: Document;
  situacao: "disponivel" | "vencida";
  task?: Task;
}

function KanbanColumn({
  titulo,
  descricao,
  icon: Icon,
  tasks,
  emptyMessage,
  accent,
}: {
  titulo: string;
  descricao: string;
  icon: typeof RefreshCw;
  tasks: Task[];
  emptyMessage: string;
  accent: "primary" | "warning";
}) {
  return (
    <section
      className={cn(
        "sgq-kanban-column",
        accent === "primary" ? "sgq-kanban-column--primary" : "sgq-kanban-column--warning"
      )}
    >
      <header className="sgq-kanban-header">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="sgq-kanban-icon">
              <Icon className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
              <p className="text-xs text-muted-foreground">{descricao}</p>
            </div>
          </div>
          <Badge variant={tasks.length > 0 ? "warning" : "secondary"}>
            {tasks.length}
          </Badge>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {tasks.length === 0 ? (
          <div className="sgq-kanban-empty">
            <CheckCircle2 className="mb-3 size-8 text-primary/60" />
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          tasks.map((task) => (
            <article
              key={task.id}
              className="rounded-lg border border-border bg-muted/30 p-4 shadow-sm transition-shadow hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-foreground">
                    {task.titulo}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {taskTypeLabels[task.tipo]}
                    {task.prazo ? (
                      <>
                        {" "}
                        · Prazo: {formatarData(task.prazo)}
                      </>
                    ) : null}
                  </p>
                  {task.descricao ? (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {task.descricao}
                    </p>
                  ) : null}
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  Pendente
                </Badge>
              </div>
              <div className="mt-4">
                <Link
                  to={getTaskActionHref(task)}
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "h-8 gap-1.5 text-xs"
                  )}
                >
                  {getTaskActionLabel(task)}
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function RevalidacaoKanbanColumn({
  items,
}: {
  items: RevalidacaoItem[];
}) {
  return (
    <section className="sgq-kanban-column sgq-kanban-column--primary">
      <header className="sgq-kanban-header">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="sgq-kanban-icon">
              <RefreshCw className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Revalidações
              </h2>
              <p className="text-xs text-muted-foreground">
                Disponíveis hoje e vencidas — alertas antecipados ficam no sino
              </p>
            </div>
          </div>
          <Badge variant={items.length > 0 ? "warning" : "secondary"}>
            {items.length}
          </Badge>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {items.length === 0 ? (
          <div className="sgq-kanban-empty">
            <CheckCircle2 className="mb-3 size-8 text-primary/60" />
            <p className="text-sm text-muted-foreground">
              Nenhuma revalidação disponível ou vencida no momento.
            </p>
          </div>
        ) : (
          items.map(({ doc, situacao }) => (
            <article
              key={doc.id}
              className="rounded-lg border border-border bg-muted/30 p-4 shadow-sm transition-shadow hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-foreground">
                    {formatDocumentCodigoExibicao(doc.codigo, doc.versaoAtual)} — {doc.titulo}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Vencimento:{" "}
                    {doc.validade?.dataValidade
                      ? formatarData(doc.validade.dataValidade)
                      : "—"}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {situacao === "disponivel"
                      ? "Validade vence hoje — revalidação liberada."
                      : "Validade vencida — revalidação necessária."}
                  </p>
                </div>
                <Badge
                  variant={situacao === "vencida" ? "destructive" : "warning"}
                  className="shrink-0 text-[10px]"
                >
                  {revalidacaoQuadroSituacaoLabels[situacao]}
                </Badge>
              </div>
              <div className="mt-4">
                <Link
                  to={`/qualidade/documentos?revalidar=${doc.id}`}
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "h-8 gap-1.5 text-xs"
                  )}
                >
                  Revalidar documento
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export function DocumentosPendenciasBoards({ showAll = false }: Props) {
  const currentUserId = useConfigStore((s) => s.currentUserId);
  const documents = useDocumentsStore((s) => s.documents);
  const versions = useDocumentsStore((s) => s.versions);
  const getPendingTasks = useDocumentsStore((s) => s.getPendingTasks);

  const tasks = getPendingTasks(currentUserId, showAll).filter(
    (t) => t.referenciaTipo === "documento"
  );

  const revalidacaoItems = useMemo(() => {
    const pendingRevalidacaoTasks = tasks.filter(
      (t) => t.tipo === "revalidar_documento"
    );

    return documents
      .filter((doc) => documentoExigeRevalidacao(doc))
      .filter((doc) => {
        if (showAll) return true;

        const version = versions.find(
          (v) => v.documentId === doc.id && v.versao === doc.versaoAtual
        );
        const responsavelId = resolveTaskAssignee(version?.elaboradorId);
        const task = pendingRevalidacaoTasks.find(
          (t) => t.referenciaId === doc.id
        );

        return (
          responsavelId === currentUserId ||
          task?.responsavelId === currentUserId
        );
      })
      .map((doc) => {
        const situacao = situacaoRevalidacaoQuadro(doc.validade?.dataValidade);
        const task = pendingRevalidacaoTasks.find(
          (t) => t.referenciaId === doc.id
        );
        return {
          doc,
          situacao: situacao ?? ("vencida" as const),
          task,
        };
      })
      .sort((a, b) => {
        if (a.situacao !== b.situacao) {
          return a.situacao === "disponivel" ? -1 : 1;
        }
        const dateA = a.doc.validade?.dataValidade ?? "";
        const dateB = b.doc.validade?.dataValidade ?? "";
        return dateA.localeCompare(dateB);
      });
  }, [currentUserId, documents, showAll, tasks, versions]);

  const etapaTasks = tasks.filter((t) => ETAPAS_FLUXO.includes(t.tipo));

  const semPendencias = revalidacaoItems.length === 0 && etapaTasks.length === 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-2">
        <RevalidacaoKanbanColumn items={revalidacaoItems} />
        <KanbanColumn
          titulo="Etapas do fluxo"
          descricao="Elaboração, consenso, aprovação e revisão"
          icon={GitBranch}
          tasks={etapaTasks}
          emptyMessage="Nenhuma etapa do fluxo pendente."
          accent="warning"
        />
      </div>

      {semPendencias ? (
        <p className="text-center text-xs text-muted-foreground">
          Consulte o sino de notificações para alertas de validade próximos ao
          vencimento.
        </p>
      ) : null}
    </div>
  );
}
