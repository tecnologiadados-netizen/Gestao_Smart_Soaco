import { Copy, Pencil, Trash2 } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";

interface TableRowActionsProps {
  onEdit: () => void;
  onClone?: () => void;
  onDelete?: () => void;
  editLabel?: string;
  cloneLabel?: string;
  deleteLabel?: string;
  cloneDisabled?: boolean;
}

export function TableRowActions({
  onEdit,
  onClone,
  onDelete,
  editLabel = "Editar",
  cloneLabel = "Clonar",
  deleteLabel = "Excluir",
  cloneDisabled = false,
}: TableRowActionsProps) {
  return (
    <div className="flex justify-end gap-1 opacity-35 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title={editLabel}
        onClick={onEdit}
      >
        <Pencil className="size-4" />
      </Button>
      {onClone ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title={cloneLabel}
          disabled={cloneDisabled}
          onClick={onClone}
        >
          <Copy className="size-4" />
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title={deleteLabel}
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
