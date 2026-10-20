import { Link } from 'react-router-dom';
import { useMemo } from "react";
import { ArrowRight, CheckCircle2, GitBranch, RefreshCw } from "lucide-react";
import { cn } from "@qualidade/lib/utils";
import { buttonVariants } from "@qualidade/components/ui/button";
import { Badge } from "@qualidade/components/ui/badge";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import { situacaoRevalidacaoQuadro } from "@qualidade/lib/documents/validity";
import { formatarData } from "@qualidade/lib/utils/dates";
import { formatDocumentCodigoExibicao } from "@qualidade/lib/documents/document-codigo";
import { taskTypeLabels } from "@qualidade/lib/utils/status-labels";
import {
  getTaskActionHref,
  getTaskActionLabel,
  isTarefaAjusteNecessario,
} from "@qualidade/lib/documents/task-routes";
import type { Document } from "@qualidade/types/document";
import type { Task } from "@qualidade/types/task";

interface Props {
  showAll?: boolean;
  onRevalidar?: (documentId: string) => void;
}

const ETAPAS_FLUXO: Task["tipo"][] = [
  "elaborar_documento",
  "consenso_documento",
  "aprovar_documento",
  "revisar_documento",
];

type SituacaoRevalidacaoCard = "disponivel" | "vencida" | "aberta";

interface RevalidacaoItem {
  doc: Document;
  situacao: SituacaoRevalidacaoCard;
  task: Task;
  responsavelNome: string;
}

const situacaoCardLabels: Record<SituacaoRevalidacaoCard, string> = {
  disponivel: "Disponível",
  vencida: "Vencida",
  aberta: "Pendente",
};

function nomeDoResponsavel(
  users: { id: string; nome: string }[],
  login: string
): string {
  const norm = login.trim().toLowerCase();
  return (
    users.find((u) => u.id.trim().toLowerCase() === norm)?.nome?.trim() ||
    login
  );
}

function KanbanColumn({
  titulo,
  descricao,
  icon: Icon,
  tasks,
  emptyMessage,
  accent,
  nomeResponsavel,
}: {
  titulo: string;
  descricao: string;
  icon: typeof RefreshCw;
  tasks: Task[];
  emptyMessage: string;
  accent: "primary" | "warning";
  nomeResponsavel?: (login: string) => string;
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

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {tasks.length === 0 ? (
          <div className="sgq-kanban-empty">
            <CheckCircle2 className="mb-3 size-8 text-primary/60" />
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          tasks.map((task) => {
            const correcao = isTarefaAjusteNecessario(task);
            return (
            <article
              key={task.id}
              className={cn(
                "rounded-lg border bg-muted/30 p-4 shadow-sm transition-shadow hover:shadow-md",
                correcao
                  ? "border-destructive/50 bg-destructive/5 hover:border-destructive/70"
                  : "border-border hover:border-primary/30"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-foreground">
                    {task.titulo}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {nomeResponsavel
                      ? `${nomeResponsavel(task.responsavelId)} · `
                      : ""}
                    {taskTypeLabels[task.tipo]}
                    {task.prazo ? (
                      <>
                        {" "}
                        · Prazo: {formatarData(task.prazo)}
                      </>
                    ) : null}
                  </p>
                  {correcao ? (
                    <p className="mt-2 text-xs font-semibold text-destructive">
                      Reprovado — ajuste necessário
                    </p>
                  ) : null}
                  {task.descricao ? (
                    <p
                      className={cn(
                        "mt-2 text-xs leading-relaxed",
                        correcao
                          ? "rounded-md border border-destructive/30 bg-background/80 p-2 font-medium text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {task.descricao}
                    </p>
                  ) : null}
                </div>
                <Badge
                  variant={correcao ? "destructive" : "outline"}
                  className="shrink-0 text-[10px]"
                >
                  {correcao ? "Ajuste" : "Pendente"}
                </Badge>
              </div>
              <div className="mt-4">
                <Link
                  to={getTaskActionHref(task)}
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "h-8 gap-1.5 text-xs",
                    correcao && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  )}
                >
                  {getTaskActionLabel(task)}
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function RevalidacaoKanbanColumn({
  items,
  descricao,
  mostrarResponsavel,
  onRevalidar,
}: {
  items: RevalidacaoItem[];
  descricao: string;
  mostrarResponsavel: boolean;
  onRevalidar?: (documentId: string) => void;
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
              <p className="text-xs text-muted-foreground">{descricao}</p>
            </div>
          </div>
          <Badge variant={items.length > 0 ? "warning" : "secondary"}>
            {items.length}
          </Badge>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="sgq-kanban-empty">
            <CheckCircle2 className="mb-3 size-8 text-primary/60" />
            <p className="text-sm text-muted-foreground">
              Nenhuma revalidação pendente.
            </p>
          </div>
        ) : (
          items.map(({ doc, situacao, task, responsavelNome }) => (
            <article
              key={task.id}
              className="rounded-lg border border-border bg-muted/30 p-4 shadow-sm transition-shadow hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-foreground">
                    {formatDocumentCodigoExibicao(doc.codigo, doc.versaoAtual)} — {doc.titulo}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {mostrarResponsavel ? `${responsavelNome} · ` : ""}
                    Vencimento:{" "}
                    {doc.validade?.dataValidade
                      ? formatarData(doc.validade.dataValidade)
                      : "—"}
                    {task.prazo ? ` · Prazo: ${formatarData(task.prazo)}` : ""}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {situacao === "disponivel"
                      ? "Validade vence hoje — revalidação liberada."
                      : situacao === "vencida"
                        ? "Validade vencida — revalidação necessária."
                        : task.descricao?.trim() ||
                          "Revalidação ainda pendente no sistema."}
                  </p>
                </div>
                <Badge
                  variant={
                    situacao === "vencida"
                      ? "destructive"
                      : situacao === "disponivel"
                        ? "warning"
                        : "outline"
                  }
                  className="shrink-0 text-[10px]"
                >
                  {situacaoCardLabels[situacao]}
                </Badge>
              </div>
              <div className="mt-4">
                <Link
                  to={`/qualidade/documentos?revalidar=${doc.id}`}
                  onClick={() => onRevalidar?.(doc.id)}
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

export function DocumentosPendenciasBoards({
  showAll = false,
  onRevalidar,
}: Props) {
  const currentUserId = useConfigStore((s) => s.currentUserId);
  const users = useConfigStore((s) => s.users);
  const documents = useDocumentsStore((s) => s.documents);
  const getPendingTasks = useDocumentsStore((s) => s.getPendingTasks);

  const tasks = getPendingTasks(currentUserId, showAll).filter(
    (t) => t.referenciaTipo === "documento"
  );

  const nomeResponsavel = (login: string) => nomeDoResponsavel(users, login);

  const revalidacaoItems = useMemo(() => {
    const docsById = new Map(documents.map((doc) => [doc.id, doc]));
    const ordem: Record<SituacaoRevalidacaoCard, number> = {
      vencida: 0,
      disponivel: 1,
      aberta: 2,
    };

    return tasks
      .filter((task) => task.tipo === "revalidar_documento")
      .flatMap((task) => {
        const doc = docsById.get(task.referenciaId);
        if (!doc) return [];
        const situacao =
          situacaoRevalidacaoQuadro(doc.validade?.dataValidade) ?? "aberta";
        return [
          {
            doc,
            task,
            situacao,
            responsavelNome: nomeDoResponsavel(users, task.responsavelId),
          },
        ];
      })
      .sort((a, b) => {
        if (a.situacao !== b.situacao) {
          return ordem[a.situacao] - ordem[b.situacao];
        }
        const resp = a.responsavelNome.localeCompare(b.responsavelNome, "pt-BR");
        if (resp !== 0) return resp;
        return (a.task.prazo ?? "").localeCompare(b.task.prazo ?? "");
      });
  }, [documents, tasks, users]);

  const etapaTasks = tasks.filter((t) => ETAPAS_FLUXO.includes(t.tipo));

  const semPendencias = revalidacaoItems.length === 0 && etapaTasks.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="grid min-h-0 flex-1 items-stretch gap-6 lg:grid-cols-2">
        <RevalidacaoKanbanColumn
          items={revalidacaoItems}
          onRevalidar={onRevalidar}
          mostrarResponsavel={showAll}
          descricao={
            showAll
              ? "Todas as revalidações pendentes no sistema"
              : "Revalidações atribuídas a você"
          }
        />
        <KanbanColumn
          titulo="Etapas do fluxo"
          descricao={
            showAll
              ? "Elaboração, consenso, aprovação e revisão de todos"
              : "Elaboração, consenso, aprovação e revisão"
          }
          icon={GitBranch}
          tasks={etapaTasks}
          emptyMessage="Nenhuma etapa do fluxo pendente."
          accent="warning"
          nomeResponsavel={showAll ? nomeResponsavel : undefined}
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
