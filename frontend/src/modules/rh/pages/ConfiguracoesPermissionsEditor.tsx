import { useId, useMemo, type ReactNode } from "react";
import { Button } from "@rh/components/ui/button";
import { Label } from "@rh/components/ui/label";
import {
  ORGANICO_COMMENT_TONE_OPTIONS,
  ORGANICO_COMMENT_VISIBILITY_OPTIONS,
  type OrganicoCommentTagOption,
  type OrganicoCommentVisibilityId,
} from "@rh/lib/organico-comment-tags";
import {
  ORGANICO_DOCUMENT_CATEGORY_OPTIONS,
  ORGANICO_DOCUMENT_CLASSIFICATION_OPTIONS,
  type OrganicoDocumentCategoryId,
  type OrganicoDocumentClassificationId,
} from "@rh/lib/organico-documents";
import { cloneGroupPermissions, DASHBOARD_MODULE_OPTIONS, ORGANICO_TAB_OPTIONS, type RhGroupPermissions } from "@rh/lib/rh-permissions";

type Props = {
  value: RhGroupPermissions;
  onChange: (next: RhGroupPermissions) => void;
  availableSectors: string[];
  commentTagOptions: OrganicoCommentTagOption[];
};

function PermissionCard({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border/80 bg-card/60 p-4 space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          {description ? <p className="text-xs text-muted-foreground mt-1">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function NativeCheckbox({
  id,
  checked,
  onCheckedChange,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange(event.target.checked)}
      className="h-4 w-4 shrink-0 cursor-pointer rounded-sm border border-primary accent-primary"
    />
  );
}

function BulkActions({
  onSelectAll,
  onClearAll,
}: {
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onSelectAll}>
        Marcar tudo
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onClearAll}>
        Desmarcar tudo
      </Button>
    </div>
  );
}

function ToggleRow({
  label,
  viewChecked,
  editChecked,
  onSetView,
  onSetEdit,
  editLabel = "Editar",
}: {
  label: string;
  viewChecked: boolean;
  editChecked: boolean;
  onSetView: (checked: boolean) => void;
  onSetEdit: (checked: boolean) => void;
  editLabel?: string;
}) {
  const viewId = useId();
  const editId = useId();
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/70 px-3 py-2.5 md:flex-row md:items-center md:justify-between">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <NativeCheckbox id={viewId} checked={viewChecked} onCheckedChange={onSetView} />
          <Label htmlFor={viewId} className="cursor-pointer">
            Visualizar
          </Label>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <NativeCheckbox id={editId} checked={editChecked} onCheckedChange={onSetEdit} />
          <Label htmlFor={editId} className="cursor-pointer">
            {editLabel}
          </Label>
        </div>
      </div>
    </div>
  );
}

function CrudRow({
  label,
  value,
  onSetField,
}: {
  label: string;
  value: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  onSetField: (field: "view" | "create" | "edit" | "delete", checked: boolean) => void;
}) {
  const viewId = useId();
  const createId = useId();
  const editId = useId();
  const deleteId = useId();
  return (
    <div className="rounded-md border border-border/70 px-3 py-2.5">
      <div className="text-sm font-medium text-foreground">{label}</div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <NativeCheckbox id={viewId} checked={value.view} onCheckedChange={(checked) => onSetField("view", checked)} />
          <Label htmlFor={viewId} className="cursor-pointer">
            Visualizar
          </Label>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <NativeCheckbox id={createId} checked={value.create} onCheckedChange={(checked) => onSetField("create", checked)} />
          <Label htmlFor={createId} className="cursor-pointer">
            Inserir
          </Label>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <NativeCheckbox id={editId} checked={value.edit} onCheckedChange={(checked) => onSetField("edit", checked)} />
          <Label htmlFor={editId} className="cursor-pointer">
            Editar
          </Label>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <NativeCheckbox id={deleteId} checked={value.delete} onCheckedChange={(checked) => onSetField("delete", checked)} />
          <Label htmlFor={deleteId} className="cursor-pointer">
            Excluir
          </Label>
        </div>
      </div>
    </div>
  );
}

function DocumentPermissionRow({
  value,
  onSetField,
}: {
  value: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    download: boolean;
    audit: boolean;
    deleteGlobalForOne: boolean;
    deleteGlobalForAll: boolean;
  };
  onSetField: (
    field:
      | "view"
      | "create"
      | "edit"
      | "delete"
      | "download"
      | "audit"
      | "deleteGlobalForOne"
      | "deleteGlobalForAll",
    checked: boolean,
  ) => void;
}) {
  const fields = [
    ["view", "Visualizar pastas e documentos"],
    ["create", "Inserir pastas e anexos"],
    ["edit", "Editar (renomear/mover)"],
    ["delete", "Excluir (com confirmação)"],
    ["deleteGlobalForOne", "Excluir pasta global só neste colaborador"],
    ["deleteGlobalForAll", "Excluir pasta global para todos"],
    ["download", "Baixar/abrir arquivos"],
    ["audit", "Auditar histórico"],
  ] as const;

  return (
    <div className="rounded-md border border-border/70 px-3 py-2.5">
      <div className="text-sm font-medium text-foreground">Documentos confidenciais do colaborador</div>
      <p className="mt-1 text-xs text-muted-foreground">
        Controla visualização, criação de pastas, upload, renomeação, exclusão com confirmação e download no arquivamento digital.
        As opções de pasta global exigem também &quot;Excluir (com confirmação)&quot;.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {fields.map(([field, label]) => {
          const id = `document-permission-${field}`;
          const requiresDelete =
            field === "deleteGlobalForOne" || field === "deleteGlobalForAll";
          const disabled = requiresDelete && !value.delete;
          return (
            <div key={field} className="flex items-center gap-2 text-sm">
              <NativeCheckbox
                id={id}
                checked={value[field]}
                disabled={disabled}
                onCheckedChange={(checked) => onSetField(field, checked)}
              />
              <Label htmlFor={id} className={disabled ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"}>
                {label}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CheckboxCollection({
  title,
  description,
  items,
  onSelectAll,
  onClearAll,
}: {
  title: string;
  description?: string;
  items: Array<{ id: string; label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }>;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  return (
    <div className="rounded-md border border-border/70 px-3 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Label className="text-sm font-medium text-foreground">{title}</Label>
          {description ? <p className="text-xs text-muted-foreground mt-1">{description}</p> : null}
        </div>
        <BulkActions onSelectAll={onSelectAll} onClearAll={onClearAll} />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {items.map((item) => {
          const checkboxId = `collection-${title.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}-${item.id}`;
          return (
            <div key={item.id} className="flex items-center gap-2 text-sm">
              <NativeCheckbox id={checkboxId} checked={item.checked} onCheckedChange={item.onCheckedChange} />
              <Label htmlFor={checkboxId} className="cursor-pointer">
                {item.label}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ConfiguracoesPermissionsEditor({ value, onChange, availableSectors, commentTagOptions }: Props) {
  const permissions = useMemo(() => cloneGroupPermissions(value), [value]);
  const justificarSecullumId = useId();
  const notificarCadastroSecullumId = useId();
  const update = (mutate: (draft: RhGroupPermissions) => void) => {
    const draft = cloneGroupPermissions(permissions);
    mutate(draft);
    onChange(cloneGroupPermissions(draft));
  };

  const normalizedSectors = [...new Set(availableSectors.map((item) => item.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const isAllSectorsAllowed = permissions.organico.allowedSectors.length === 0;

  return (
    <div className="space-y-4">
      <PermissionCard
        title="Aba Orgânico"
        description="Controle acesso aos colaboradores, setores, abas do formulário, comentários e fotos."
        actions={
          <BulkActions
            onSelectAll={() =>
              update((draft) => {
                draft.organico.colaboradores.view = true;
                draft.organico.colaboradores.edit = true;
                draft.organico.allowedSectors = [];
                for (const tab of ORGANICO_TAB_OPTIONS) {
                  draft.organico.formTabs[tab.id].view = true;
                  draft.organico.formTabs[tab.id].edit = true;
                }
                draft.organico.comentarios.view = true;
                draft.organico.comentarios.edit = true;
                for (const item of commentTagOptions) {
                  draft.organico.comentarios.tags[item.id] = true;
                }
                for (const item of ORGANICO_COMMENT_VISIBILITY_OPTIONS) {
                  draft.organico.comentarios.visibilities[item.id] = true;
                }
                draft.organico.fotos.view = true;
                draft.organico.fotos.edit = true;
                draft.organico.documentos.view = true;
                draft.organico.documentos.create = true;
                draft.organico.documentos.edit = true;
                draft.organico.documentos.delete = true;
                draft.organico.documentos.deleteGlobalForOne = true;
                draft.organico.documentos.deleteGlobalForAll = true;
                draft.organico.documentos.download = true;
                draft.organico.documentos.audit = true;
                for (const item of ORGANICO_DOCUMENT_CATEGORY_OPTIONS) {
                  draft.organico.documentos.categories[item.id] = true;
                }
                for (const item of ORGANICO_DOCUMENT_CLASSIFICATION_OPTIONS) {
                  draft.organico.documentos.classifications[item.id] = true;
                }
                draft.organico.justificarAlteracoesSecullum = true;
                draft.organico.notificarCadastroComplementarSecullum = true;
              })
            }
            onClearAll={() =>
              update((draft) => {
                draft.organico.colaboradores.view = false;
                draft.organico.colaboradores.edit = false;
                draft.organico.allowedSectors = [];
                for (const tab of ORGANICO_TAB_OPTIONS) {
                  draft.organico.formTabs[tab.id].view = false;
                  draft.organico.formTabs[tab.id].edit = false;
                }
                draft.organico.comentarios.view = false;
                draft.organico.comentarios.edit = false;
                for (const item of commentTagOptions) {
                  draft.organico.comentarios.tags[item.id] = false;
                }
                for (const item of ORGANICO_COMMENT_VISIBILITY_OPTIONS) {
                  draft.organico.comentarios.visibilities[item.id] = false;
                }
                draft.organico.fotos.view = false;
                draft.organico.fotos.edit = false;
                draft.organico.documentos.view = false;
                draft.organico.documentos.create = false;
                draft.organico.documentos.edit = false;
                draft.organico.documentos.delete = false;
                draft.organico.documentos.deleteGlobalForOne = false;
                draft.organico.documentos.deleteGlobalForAll = false;
                draft.organico.documentos.download = false;
                draft.organico.documentos.audit = false;
                for (const item of ORGANICO_DOCUMENT_CATEGORY_OPTIONS) {
                  draft.organico.documentos.categories[item.id] = false;
                }
                for (const item of ORGANICO_DOCUMENT_CLASSIFICATION_OPTIONS) {
                  draft.organico.documentos.classifications[item.id] = false;
                }
                draft.organico.justificarAlteracoesSecullum = false;
                draft.organico.notificarCadastroComplementarSecullum = false;
              })
            }
          />
        }
      >
        <ToggleRow
          label="Colaboradores por setor"
          viewChecked={permissions.organico.colaboradores.view}
          editChecked={permissions.organico.colaboradores.edit}
          onSetView={(checked) =>
            update((draft) => {
              draft.organico.colaboradores.view = checked;
            })
          }
          onSetEdit={(checked) =>
            update((draft) => {
              draft.organico.colaboradores.edit = checked;
            })
          }
        />

        <div className="rounded-md border border-border/70 px-3 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <Label className="text-sm font-medium text-foreground">Setores permitidos</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Se nenhum setor for marcado, o grupo poderá acessar todos os setores.
              </p>
            </div>
            <BulkActions
              onSelectAll={() =>
                update((draft) => {
                  draft.organico.allowedSectors = [];
                })
              }
              onClearAll={() =>
                update((draft) => {
                  draft.organico.allowedSectors = [];
                })
              }
            />
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {normalizedSectors.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum setor encontrado no orgânico para seleção.</p>
            ) : (
              normalizedSectors.map((sector) => {
                const checked = isAllSectorsAllowed || permissions.organico.allowedSectors.includes(sector);
                const checkboxId = `sector-${sector.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}`;
                return (
                  <div key={sector} className="flex items-center gap-2 text-sm">
                    <NativeCheckbox
                      id={checkboxId}
                      checked={checked}
                      onCheckedChange={(isChecked) =>
                        update((draft) => {
                          if (isChecked) {
                            if (draft.organico.allowedSectors.length === 0) return;
                            draft.organico.allowedSectors = [...draft.organico.allowedSectors, sector]
                              .filter(Boolean)
                              .filter((item, index, list) => list.indexOf(item) === index)
                              .sort((a, b) => a.localeCompare(b, "pt-BR"));
                            return;
                          }
                          if (draft.organico.allowedSectors.length === 0) {
                            draft.organico.allowedSectors = normalizedSectors.filter((item) => item !== sector);
                            return;
                          }
                          draft.organico.allowedSectors = draft.organico.allowedSectors.filter((item) => item !== sector);
                        })
                      }
                    />
                    <Label htmlFor={checkboxId} className="cursor-pointer">
                      {sector}
                    </Label>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm font-medium text-foreground">Abas do formulário do colaborador</div>
            <BulkActions
              onSelectAll={() =>
                update((draft) => {
                  for (const tab of ORGANICO_TAB_OPTIONS) {
                    draft.organico.formTabs[tab.id].view = true;
                    draft.organico.formTabs[tab.id].edit = true;
                  }
                })
              }
              onClearAll={() =>
                update((draft) => {
                  for (const tab of ORGANICO_TAB_OPTIONS) {
                    draft.organico.formTabs[tab.id].view = false;
                    draft.organico.formTabs[tab.id].edit = false;
                  }
                })
              }
            />
          </div>
          {ORGANICO_TAB_OPTIONS.map((tab) => (
            <ToggleRow
              key={tab.id}
              label={tab.label}
              viewChecked={permissions.organico.formTabs[tab.id].view}
              editChecked={permissions.organico.formTabs[tab.id].edit}
              onSetView={(checked) =>
                update((draft) => {
                  draft.organico.formTabs[tab.id].view = checked;
                })
              }
              onSetEdit={(checked) =>
                update((draft) => {
                  draft.organico.formTabs[tab.id].edit = checked;
                })
              }
            />
          ))}
        </div>

        <ToggleRow
          label="Comentários do colaborador"
          viewChecked={permissions.organico.comentarios.view}
          editChecked={permissions.organico.comentarios.edit}
          onSetView={(checked) =>
            update((draft) => {
              draft.organico.comentarios.view = checked;
            })
          }
          onSetEdit={(checked) =>
            update((draft) => {
              draft.organico.comentarios.edit = checked;
            })
          }
        />

        <CheckboxCollection
          title="Visibilidades de comentários permitidas"
          description="Define quais níveis de visibilidade esse grupo pode enxergar no histórico de comentários."
          items={ORGANICO_COMMENT_VISIBILITY_OPTIONS.map((item) => ({
            id: item.id,
            label: item.label,
            checked: permissions.organico.comentarios.visibilities[item.id],
            onCheckedChange: (checked) =>
              update((draft) => {
                draft.organico.comentarios.visibilities[item.id as OrganicoCommentVisibilityId] = checked;
              }),
          }))}
          onSelectAll={() =>
            update((draft) => {
              for (const item of ORGANICO_COMMENT_VISIBILITY_OPTIONS) {
                draft.organico.comentarios.visibilities[item.id] = true;
              }
            })
          }
          onClearAll={() =>
            update((draft) => {
              for (const item of ORGANICO_COMMENT_VISIBILITY_OPTIONS) {
                draft.organico.comentarios.visibilities[item.id] = false;
              }
            })
          }
        />

        {ORGANICO_COMMENT_TONE_OPTIONS.map((tone) => (
          <CheckboxCollection
            key={tone.id}
            title={`Categorias visíveis (${tone.label})`}
            items={commentTagOptions.filter((item) => item.tone === tone.id).map((item) => ({
              id: item.id,
              label: item.label,
              checked: permissions.organico.comentarios.tags[item.id] ?? true,
              onCheckedChange: (checked) =>
                update((draft) => {
                  draft.organico.comentarios.tags[item.id] = checked;
                }),
            }))}
            onSelectAll={() =>
              update((draft) => {
                for (const item of commentTagOptions.filter((tag) => tag.tone === tone.id)) {
                  draft.organico.comentarios.tags[item.id] = true;
                }
              })
            }
            onClearAll={() =>
              update((draft) => {
                for (const item of commentTagOptions.filter((tag) => tag.tone === tone.id)) {
                  draft.organico.comentarios.tags[item.id] = false;
                }
              })
            }
          />
        ))}

        <ToggleRow
          label="Fotos do colaborador"
          viewChecked={permissions.organico.fotos.view}
          editChecked={permissions.organico.fotos.edit}
          onSetView={(checked) =>
            update((draft) => {
              draft.organico.fotos.view = checked;
            })
          }
          onSetEdit={(checked) =>
            update((draft) => {
              draft.organico.fotos.edit = checked;
            })
          }
        />

        <DocumentPermissionRow
          value={permissions.organico.documentos}
          onSetField={(field, checked) =>
            update((draft) => {
              draft.organico.documentos[field] = checked;
              if (field === "delete" && !checked) {
                draft.organico.documentos.deleteGlobalForOne = false;
                draft.organico.documentos.deleteGlobalForAll = false;
              }
            })
          }
        />

        <CheckboxCollection
          title="Classificações de documentos permitidas"
          description="Define quais níveis de sigilo esse grupo poderá ver quando os anexos reais forem implementados."
          items={ORGANICO_DOCUMENT_CLASSIFICATION_OPTIONS.map((item) => ({
            id: item.id,
            label: item.label,
            checked: permissions.organico.documentos.classifications[item.id],
            onCheckedChange: (checked) =>
              update((draft) => {
                draft.organico.documentos.classifications[item.id as OrganicoDocumentClassificationId] = checked;
              }),
          }))}
          onSelectAll={() =>
            update((draft) => {
              for (const item of ORGANICO_DOCUMENT_CLASSIFICATION_OPTIONS) {
                draft.organico.documentos.classifications[item.id] = true;
              }
            })
          }
          onClearAll={() =>
            update((draft) => {
              for (const item of ORGANICO_DOCUMENT_CLASSIFICATION_OPTIONS) {
                draft.organico.documentos.classifications[item.id] = false;
              }
            })
          }
        />

        <CheckboxCollection
          title="Categorias de documentos permitidas"
          description="Evita liberar automaticamente todos os tipos de documentos para um grupo."
          items={ORGANICO_DOCUMENT_CATEGORY_OPTIONS.map((item) => ({
            id: item.id,
            label: item.label,
            checked: permissions.organico.documentos.categories[item.id],
            onCheckedChange: (checked) =>
              update((draft) => {
                draft.organico.documentos.categories[item.id as OrganicoDocumentCategoryId] = checked;
              }),
          }))}
          onSelectAll={() =>
            update((draft) => {
              for (const item of ORGANICO_DOCUMENT_CATEGORY_OPTIONS) {
                draft.organico.documentos.categories[item.id] = true;
              }
            })
          }
          onClearAll={() =>
            update((draft) => {
              for (const item of ORGANICO_DOCUMENT_CATEGORY_OPTIONS) {
                draft.organico.documentos.categories[item.id] = false;
              }
            })
          }
        />

        <div className="rounded-md border border-border/70 px-3 py-2.5">
          <div className="flex items-start gap-3">
            <NativeCheckbox
              id={justificarSecullumId}
              checked={permissions.organico.justificarAlteracoesSecullum}
              onCheckedChange={(checked) =>
                update((draft) => {
                  draft.organico.justificarAlteracoesSecullum = checked;
                })
              }
            />
            <div className="min-w-0">
              <Label className="text-sm font-medium text-foreground cursor-pointer" htmlFor={justificarSecullumId}>
                Justificar alterações da Secullum (CTPS e cargo)
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Exibe pendências e permite registrar o motivo quando o salário base (CTPS) ou o cargo mudarem pela API
                Secullum. O master sempre pode justificar, independentemente desta opção.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border/70 px-3 py-2.5">
          <div className="flex items-start gap-3">
            <NativeCheckbox
              id={notificarCadastroSecullumId}
              checked={permissions.organico.notificarCadastroComplementarSecullum}
              onCheckedChange={(checked) =>
                update((draft) => {
                  draft.organico.notificarCadastroComplementarSecullum = checked;
                })
              }
            />
            <div className="min-w-0">
              <Label className="text-sm font-medium text-foreground cursor-pointer" htmlFor={notificarCadastroSecullumId}>
                Notificar novos colaboradores (cadastro complementar Secullum)
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Exibe um aviso quando a sincronização criar uma linha nova vinda da Secullum (cadastro a completar no
                Orgânico). Respeita os setores que este grupo pode ver. O master sempre recebe o aviso.
              </p>
            </div>
          </div>
        </div>
      </PermissionCard>

      <PermissionCard
        title="Aba Faltas e Atestados"
        description="Permissões por operação para ausências, sanções disciplinares e cadastros auxiliares."
        actions={
          <BulkActions
            onSelectAll={() =>
              update((draft) => {
                draft.faltas.ausencias.view = true;
                draft.faltas.ausencias.create = true;
                draft.faltas.ausencias.edit = true;
                draft.faltas.ausencias.delete = true;
                draft.faltas.sancoes.view = true;
                draft.faltas.sancoes.create = true;
                draft.faltas.sancoes.edit = true;
                draft.faltas.sancoes.delete = true;
                draft.faltas.cadastros.view = true;
                draft.faltas.cadastros.edit = true;
                draft.faltas.tiposRegras.view = true;
                draft.faltas.tiposRegras.edit = true;
                draft.faltas.regrasAlertas.view = true;
                draft.faltas.regrasAlertas.edit = true;
              })
            }
            onClearAll={() =>
              update((draft) => {
                draft.faltas.ausencias.view = false;
                draft.faltas.ausencias.create = false;
                draft.faltas.ausencias.edit = false;
                draft.faltas.ausencias.delete = false;
                draft.faltas.sancoes.view = false;
                draft.faltas.sancoes.create = false;
                draft.faltas.sancoes.edit = false;
                draft.faltas.sancoes.delete = false;
                draft.faltas.cadastros.view = false;
                draft.faltas.cadastros.edit = false;
                draft.faltas.tiposRegras.view = false;
                draft.faltas.tiposRegras.edit = false;
                draft.faltas.regrasAlertas.view = false;
                draft.faltas.regrasAlertas.edit = false;
              })
            }
          />
        }
      >
        <CrudRow
          label="Gestão de ausências"
          value={permissions.faltas.ausencias}
          onSetField={(field, checked) =>
            update((draft) => {
              draft.faltas.ausencias[field] = checked;
            })
          }
        />

        <CrudRow
          label="Sanções disciplinares"
          value={permissions.faltas.sancoes}
          onSetField={(field, checked) =>
            update((draft) => {
              draft.faltas.sancoes[field] = checked;
            })
          }
        />

        <ToggleRow
          label="Cadastros auxiliares"
          viewChecked={permissions.faltas.cadastros.view}
          editChecked={permissions.faltas.cadastros.edit}
          onSetView={(checked) =>
            update((draft) => {
              draft.faltas.cadastros.view = checked;
            })
          }
          onSetEdit={(checked) =>
            update((draft) => {
              draft.faltas.cadastros.edit = checked;
            })
          }
        />
        <ToggleRow
          label="Regras dos tipos de ausência"
          viewChecked={permissions.faltas.tiposRegras.view}
          editChecked={permissions.faltas.tiposRegras.edit}
          onSetView={(checked) =>
            update((draft) => {
              draft.faltas.tiposRegras.view = checked;
            })
          }
          onSetEdit={(checked) =>
            update((draft) => {
              draft.faltas.tiposRegras.edit = checked;
            })
          }
        />
        <ToggleRow
          label="Regras de alertas (inconsistências)"
          viewChecked={permissions.faltas.regrasAlertas.view}
          editChecked={permissions.faltas.regrasAlertas.edit}
          editLabel="Gerenciar"
          onSetView={(checked) =>
            update((draft) => {
              draft.faltas.regrasAlertas.view = checked;
            })
          }
          onSetEdit={(checked) =>
            update((draft) => {
              draft.faltas.regrasAlertas.edit = checked;
            })
          }
        />
      </PermissionCard>

      <PermissionCard
        title="Aba Dashboard"
        description="Controle cada dashboard ou módulo separadamente."
        actions={
          <BulkActions
            onSelectAll={() =>
              update((draft) => {
                for (const moduleItem of DASHBOARD_MODULE_OPTIONS) {
                  draft.dashboard.modulos[moduleItem.id].view = true;
                  draft.dashboard.modulos[moduleItem.id].edit = true;
                }
              })
            }
            onClearAll={() =>
              update((draft) => {
                for (const moduleItem of DASHBOARD_MODULE_OPTIONS) {
                  draft.dashboard.modulos[moduleItem.id].view = false;
                  draft.dashboard.modulos[moduleItem.id].edit = false;
                }
              })
            }
          />
        }
      >
        {DASHBOARD_MODULE_OPTIONS.map((moduleItem) => (
          <ToggleRow
            key={moduleItem.id}
            label={moduleItem.label}
            viewChecked={permissions.dashboard.modulos[moduleItem.id].view}
            editChecked={permissions.dashboard.modulos[moduleItem.id].edit}
            onSetView={(checked) =>
              update((draft) => {
                draft.dashboard.modulos[moduleItem.id].view = checked;
              })
            }
            onSetEdit={(checked) =>
              update((draft) => {
                draft.dashboard.modulos[moduleItem.id].edit = checked;
              })
            }
          />
        ))}
      </PermissionCard>

      <PermissionCard
        title="Cargos e Salários"
        description="Controle o acesso ao módulo de cargos e faixas salariais."
      >
        <ToggleRow
          label="Permissões do módulo"
          viewChecked={permissions.cargos.view}
          editChecked={permissions.cargos.edit}
          onSetView={(checked) =>
            update((draft) => {
              draft.cargos.view = checked;
            })
          }
          onSetEdit={(checked) =>
            update((draft) => {
              draft.cargos.edit = checked;
            })
          }
        />
      </PermissionCard>

      <PermissionCard
        title="Organograma"
        description="Controle o acesso à visualização e edição do organograma."
      >
        <ToggleRow
          label="Permissões do módulo"
          viewChecked={permissions.organograma.view}
          editChecked={permissions.organograma.edit}
          onSetView={(checked) =>
            update((draft) => {
              draft.organograma.view = checked;
            })
          }
          onSetEdit={(checked) =>
            update((draft) => {
              draft.organograma.edit = checked;
            })
          }
        />
        <ToggleRow
          label="Fotos da Empresa e Diretorias"
          editLabel="Inserir / editar"
          viewChecked={permissions.organograma.fotos.view}
          editChecked={permissions.organograma.fotos.edit}
          onSetView={(checked) =>
            update((draft) => {
              draft.organograma.fotos.view = checked;
            })
          }
          onSetEdit={(checked) =>
            update((draft) => {
              draft.organograma.fotos.edit = checked;
            })
          }
        />
      </PermissionCard>

      <PermissionCard
        title="Configurações do sistema"
        description="Controle o acesso à área administrativa de configurações."
      >
        <ToggleRow
          label="Permissões do módulo"
          viewChecked={permissions.configuracoes.view}
          editChecked={permissions.configuracoes.edit}
          onSetView={(checked) =>
            update((draft) => {
              draft.configuracoes.view = checked;
            })
          }
          onSetEdit={(checked) =>
            update((draft) => {
              draft.configuracoes.edit = checked;
            })
          }
        />
      </PermissionCard>
    </div>
  );
}
