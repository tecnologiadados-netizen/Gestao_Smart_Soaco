"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmacaoDialog } from "@/components/ui/confirmacao-dialog";
import { FormDialog } from "@/components/ui/form-dialog";
import { PageBackLink } from "@/components/layout/page-back-link";
import { TableRowActions } from "@/components/ui/table-row-actions";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { useTableSort } from "@/hooks/use-table-sort";
import { useConfigStore } from "@/lib/store/config-store";
import { sortByRules } from "@/lib/utils/table-sort";

type CategoriaSortKey = "sigla" | "nome";

export default function TiposDocumentoPage() {
  const documentTypes = useConfigStore((s) => s.documentTypes);
  const addDocumentType = useConfigStore((s) => s.addDocumentType);
  const updateDocumentType = useConfigStore((s) => s.updateDocumentType);
  const removeDocumentType = useConfigStore((s) => s.removeDocumentType);

  const [nome, setNome] = useState("");
  const [sigla, setSigla] = useState("");
  const [addError, setAddError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editSigla, setEditSigla] = useState("");
  const [editError, setEditError] = useState("");

  const [excluirId, setExcluirId] = useState<string | null>(null);
  const { sorts, toggleSort, getSortState } = useTableSort<CategoriaSortKey>();

  const categoriasOrdenadas = useMemo(() => {
    return sortByRules(documentTypes, sorts, (tipo, key) =>
      key === "sigla" ? tipo.sigla : tipo.nome
    );
  }, [documentTypes, sorts]);

  const categoriaParaExcluir = documentTypes.find((t) => t.id === excluirId);
  const categoriaEmEdicao = documentTypes.find((t) => t.id === editingId);

  function resetAddForm() {
    setNome("");
    setSigla("");
    setAddError("");
  }

  function fecharEdicao() {
    setEditingId(null);
    setEditNome("");
    setEditSigla("");
    setEditError("");
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();

    const nomeTrim = nome.trim();
    const siglaTrim = sigla.trim();

    if (!nomeTrim || !siglaTrim) {
      setAddError("Preencha nome e sigla.");
      return;
    }

    const ok = addDocumentType(nomeTrim, siglaTrim);
    if (!ok) {
      setAddError("Já existe uma categoria com esta sigla.");
      return;
    }

    resetAddForm();
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;

    const nomeTrim = editNome.trim();
    const siglaTrim = editSigla.trim();

    if (!nomeTrim || !siglaTrim) {
      setEditError("Preencha nome e sigla.");
      return;
    }

    const ok = updateDocumentType(editingId, nomeTrim, siglaTrim);
    if (!ok) {
      setEditError("Já existe uma categoria com esta sigla.");
      return;
    }

    fecharEdicao();
  }

  function iniciarEdicao(id: string) {
    const tipo = documentTypes.find((t) => t.id === id);
    if (!tipo) return;
    setEditingId(id);
    setEditNome(tipo.nome);
    setEditSigla(tipo.sigla);
    setEditError("");
  }

  function confirmarExclusao() {
    if (!excluirId) return;
    removeDocumentType(excluirId);
    if (editingId === excluirId) {
      fecharEdicao();
    }
    setExcluirId(null);
  }

  return (
    <div className="space-y-6">
      <PageBackLink href="/configuracoes" />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>
        <p className="text-sm text-muted-foreground">
          Categorias documentais do SGQ
        </p>
      </div>

      <form
        onSubmit={handleAdd}
        className="space-y-3 rounded-lg border bg-card p-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sigla">Sigla</Label>
            <Input
              id="sigla"
              value={sigla}
              onChange={(e) => setSigla(e.target.value.toUpperCase())}
              className="w-24 uppercase"
              maxLength={6}
              required
            />
          </div>
          <Button type="submit">Adicionar</Button>
        </div>
        {addError ? (
          <p className="text-sm text-destructive" role="alert">
            {addError}
          </p>
        ) : null}
      </form>

      <Table surface>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              sortKey="sigla"
              sortState={getSortState("sigla")}
              onSort={toggleSort}
            >
              Sigla
            </SortableTableHead>
            <SortableTableHead
              sortKey="nome"
              sortState={getSortState("nome")}
              onSort={toggleSort}
            >
              Nome
            </SortableTableHead>
            <TableHead className="w-[140px] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categoriasOrdenadas.map((tipo) => (
            <TableRow key={tipo.id} className="group">
              <TableCell className="font-medium">{tipo.sigla}</TableCell>
              <TableCell>{tipo.nome}</TableCell>
              <TableCell>
                <TableRowActions
                  onEdit={() => iniciarEdicao(tipo.id)}
                  onDelete={() => setExcluirId(tipo.id)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <FormDialog
        open={editingId !== null}
        onOpenChange={(open) => !open && fecharEdicao()}
        titulo="Editar categoria"
        descricao={
          categoriaEmEdicao
            ? `Altere os dados da categoria ${categoriaEmEdicao.sigla}.`
            : undefined
        }
        onSubmit={handleEdit}
        submitLabel="Salvar alterações"
        error={editError}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="edit-nome">Nome</Label>
            <Input
              id="edit-nome"
              value={editNome}
              onChange={(e) => setEditNome(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-sigla">Sigla</Label>
            <Input
              id="edit-sigla"
              value={editSigla}
              onChange={(e) => setEditSigla(e.target.value.toUpperCase())}
              className="w-full uppercase"
              maxLength={6}
              required
            />
          </div>
        </div>
      </FormDialog>

      <ConfirmacaoDialog
        open={excluirId !== null}
        onOpenChange={(open) => !open && setExcluirId(null)}
        titulo="Excluir categoria"
        mensagem={
          categoriaParaExcluir
            ? `Deseja excluir a categoria ${categoriaParaExcluir.sigla} — ${categoriaParaExcluir.nome}? Esta ação não pode ser desfeita.`
            : "Deseja excluir esta categoria?"
        }
        confirmarLabel="Excluir"
        variant="destructive"
        onConfirmar={confirmarExclusao}
      />
    </div>
  );
}
