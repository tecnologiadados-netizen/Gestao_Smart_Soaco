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

type SetorSortKey = "sigla" | "nome";

export default function SetoresPage() {
  const departments = useConfigStore((s) => s.departments);
  const addDepartment = useConfigStore((s) => s.addDepartment);
  const updateDepartment = useConfigStore((s) => s.updateDepartment);
  const removeDepartment = useConfigStore((s) => s.removeDepartment);

  const [nome, setNome] = useState("");
  const [sigla, setSigla] = useState("");
  const [addError, setAddError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editSigla, setEditSigla] = useState("");
  const [editError, setEditError] = useState("");

  const [excluirId, setExcluirId] = useState<string | null>(null);
  const { sorts, toggleSort, getSortState } = useTableSort<SetorSortKey>();

  const setoresOrdenados = useMemo(() => {
    return sortByRules(departments, sorts, (dep, key) =>
      key === "sigla" ? dep.sigla : dep.nome
    );
  }, [departments, sorts]);

  const setorParaExcluir = departments.find((d) => d.id === excluirId);
  const setorEmEdicao = departments.find((d) => d.id === editingId);

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

    const ok = addDepartment(nomeTrim, siglaTrim);
    if (!ok) {
      setAddError("Já existe um setor com esta sigla.");
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

    const ok = updateDepartment(editingId, nomeTrim, siglaTrim);
    if (!ok) {
      setEditError("Já existe um setor com esta sigla.");
      return;
    }

    fecharEdicao();
  }

  function iniciarEdicao(id: string) {
    const dep = departments.find((d) => d.id === id);
    if (!dep) return;
    setEditingId(id);
    setEditNome(dep.nome);
    setEditSigla(dep.sigla);
    setEditError("");
  }

  function confirmarExclusao() {
    if (!excluirId) return;
    removeDepartment(excluirId);
    if (editingId === excluirId) {
      fecharEdicao();
    }
    setExcluirId(null);
  }

  return (
    <div className="space-y-6">
      <PageBackLink href="/configuracoes" />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Setores</h1>
        <p className="text-sm text-muted-foreground">
          Cadastro de setores do SGQ
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
          {setoresOrdenados.map((dep) => (
            <TableRow key={dep.id} className="group">
              <TableCell className="font-medium">{dep.sigla}</TableCell>
              <TableCell>{dep.nome}</TableCell>
              <TableCell>
                <TableRowActions
                  onEdit={() => iniciarEdicao(dep.id)}
                  onDelete={() => setExcluirId(dep.id)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <FormDialog
        open={editingId !== null}
        onOpenChange={(open) => !open && fecharEdicao()}
        titulo="Editar setor"
        descricao={
          setorEmEdicao
            ? `Altere os dados do setor ${setorEmEdicao.sigla}.`
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
        titulo="Excluir setor"
        mensagem={
          setorParaExcluir
            ? `Deseja excluir o setor ${setorParaExcluir.sigla} — ${setorParaExcluir.nome}? Esta ação não pode ser desfeita.`
            : "Deseja excluir este setor?"
        }
        confirmarLabel="Excluir"
        variant="destructive"
        onConfirmar={confirmarExclusao}
      />
    </div>
  );
}
