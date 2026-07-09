"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TableRowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
  deleteLabel?: string;
}

export function TableRowActions({
  onEdit,
  onDelete,
  editLabel = "Editar",
  deleteLabel = "Excluir",
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
    </div>
  );
}
