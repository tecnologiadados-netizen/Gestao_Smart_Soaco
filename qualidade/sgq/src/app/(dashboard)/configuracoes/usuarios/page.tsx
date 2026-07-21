"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { departmentSelectLabel } from "@/lib/utils/select-display";
import type { UserRole } from "@/types/user";

const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  gestor_qualidade: "Gestor da Qualidade",
  elaborador: "Elaborador",
  revisor: "Revisor",
  aprovador: "Aprovador",
  operador: "Operador",
};

const roles = Object.keys(roleLabels) as UserRole[];

const defaultForm = {
  nome: "",
  email: "",
  role: "" as UserRole | "",
  setorId: "",
  ativo: true,
};

type UsuarioSortKey = "nome" | "email" | "papel" | "setor" | "status";

export default function UsuariosPage() {
  const users = useConfigStore((s) => s.users);
  const departments = useConfigStore((s) => s.departments);
  const currentUserId = useConfigStore((s) => s.currentUserId);
  const addUser = useConfigStore((s) => s.addUser);
  const updateUser = useConfigStore((s) => s.updateUser);
  const removeUser = useConfigStore((s) => s.removeUser);

  const [form, setForm] = useState(defaultForm);
  const [addError, setAddError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(defaultForm);
  const [editError, setEditError] = useState("");

  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [pageError, setPageError] = useState("");
  const { sorts, toggleSort, getSortState } = useTableSort<UsuarioSortKey>();

  const usuariosOrdenados = useMemo(() => {
    return sortByRules(users, sorts, (user, key) => {
      const setor = departments.find((d) => d.id === user.setorId);
      switch (key) {
        case "nome":
          return user.nome;
        case "email":
          return user.email;
        case "papel":
          return roleLabels[user.role] ?? user.role;
        case "setor":
          return setor?.nome ?? "";
        case "status":
          return user.ativo;
      }
    });
  }, [users, departments, sorts]);

  const usuarioParaExcluir = users.find((u) => u.id === excluirId);
  const usuarioEmEdicao = users.find((u) => u.id === editingId);

  function resetAddForm() {
    setForm(defaultForm);
    setAddError("");
  }

  function fecharEdicao() {
    setEditingId(null);
    setEditForm(defaultForm);
    setEditError("");
  }

  function patchForm(partial: Partial<typeof defaultForm>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function patchEditForm(partial: Partial<typeof defaultForm>) {
    setEditForm((prev) => ({ ...prev, ...partial }));
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();

    const nome = form.nome.trim();
    const email = form.email.trim();
    if (!nome || !email || !form.role || !form.setorId) {
      setAddError("Preencha todos os campos obrigatórios.");
      return;
    }

    addUser({
      nome,
      email,
      role: form.role,
      setorId: form.setorId,
      ativo: form.ativo,
    });
    resetAddForm();
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;

    const nome = editForm.nome.trim();
    const email = editForm.email.trim();
    if (!nome || !email || !editForm.role || !editForm.setorId) {
      setEditError("Preencha todos os campos obrigatórios.");
      return;
    }

    updateUser(editingId, {
      nome,
      email,
      role: editForm.role,
      setorId: editForm.setorId,
      ativo: editForm.ativo,
    });
    fecharEdicao();
  }

  function iniciarEdicao(id: string) {
    const user = users.find((u) => u.id === id);
    if (!user) return;
    setEditingId(id);
    setEditForm({
      nome: user.nome,
      email: user.email,
      role: user.role,
      setorId: user.setorId,
      ativo: user.ativo,
    });
    setEditError("");
    setPageError("");
  }

  function confirmarExclusao() {
    if (!excluirId) return;
    const ok = removeUser(excluirId);
    if (!ok) {
      setPageError("Não é possível excluir o usuário logado no momento.");
      setExcluirId(null);
      return;
    }
    if (editingId === excluirId) {
      fecharEdicao();
    }
    setExcluirId(null);
  }

  return (
    <div className="space-y-6">
      <PageBackLink href="/configuracoes" />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          {users.filter((u) => u.ativo).length} usuários ativos
        </p>
      </div>

      <form
        onSubmit={handleAdd}
        className="space-y-3 rounded-lg border bg-card p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="usuario-nome">Nome *</Label>
            <Input
              id="usuario-nome"
              value={form.nome}
              onChange={(e) => patchForm({ nome: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="usuario-email">E-mail *</Label>
            <Input
              id="usuario-email"
              type="email"
              value={form.email}
              onChange={(e) => patchForm({ email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="usuario-papel">Papel *</Label>
            <Select
              value={form.role || undefined}
              onValueChange={(v) => v && patchForm({ role: v as UserRole })}
            >
              <SelectTrigger id="usuario-papel" className="w-full">
                <SelectValue placeholder="Selecione">
                  {form.role ? roleLabels[form.role] : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {roleLabels[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="usuario-setor">Setor *</Label>
            <Select
              value={form.setorId || undefined}
              onValueChange={(v) => v && patchForm({ setorId: v })}
            >
              <SelectTrigger id="usuario-setor" className="w-full">
                <SelectValue placeholder="Selecione">
                  {departmentSelectLabel(departments, form.setorId, "nome") ??
                    null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-input accent-primary"
              checked={form.ativo}
              onChange={(e) => patchForm({ ativo: e.target.checked })}
            />
            Usuário ativo
          </label>
          <Button type="submit">Adicionar</Button>
        </div>
        {addError ? (
          <p className="text-sm text-destructive" role="alert">
            {addError}
          </p>
        ) : null}
      </form>

      {pageError ? (
        <p className="text-sm text-destructive" role="alert">
          {pageError}
        </p>
      ) : null}

      <Table surface>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              sortKey="nome"
              sortState={getSortState("nome")}
              onSort={toggleSort}
            >
              Nome
            </SortableTableHead>
            <SortableTableHead
              sortKey="email"
              sortState={getSortState("email")}
              onSort={toggleSort}
            >
              E-mail
            </SortableTableHead>
            <SortableTableHead
              sortKey="papel"
              sortState={getSortState("papel")}
              onSort={toggleSort}
            >
              Papel
            </SortableTableHead>
            <SortableTableHead
              sortKey="setor"
              sortState={getSortState("setor")}
              onSort={toggleSort}
            >
              Setor
            </SortableTableHead>
            <SortableTableHead
              sortKey="status"
              sortState={getSortState("status")}
              onSort={toggleSort}
            >
              Status
            </SortableTableHead>
            <TableHead className="w-[140px] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuariosOrdenados.map((user) => {
            const setor = departments.find((d) => d.id === user.setorId);
            return (
              <TableRow key={user.id} className="group">
                <TableCell className="font-medium">{user.nome}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{roleLabels[user.role] ?? user.role}</TableCell>
                <TableCell>{setor?.nome ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={user.ativo ? "default" : "secondary"}>
                    {user.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <TableRowActions
                    onEdit={() => iniciarEdicao(user.id)}
                    onDelete={() => {
                      if (user.id === currentUserId) {
                        setPageError(
                          "Não é possível excluir o usuário logado no momento."
                        );
                        return;
                      }
                      setExcluirId(user.id);
                    }}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <FormDialog
        open={editingId !== null}
        onOpenChange={(open) => !open && fecharEdicao()}
        titulo="Editar usuário"
        descricao={
          usuarioEmEdicao
            ? `Altere os dados de ${usuarioEmEdicao.nome}.`
            : undefined
        }
        onSubmit={handleEdit}
        submitLabel="Salvar alterações"
        error={editError}
        className="max-w-2xl"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="edit-usuario-nome">Nome *</Label>
            <Input
              id="edit-usuario-nome"
              value={editForm.nome}
              onChange={(e) => patchEditForm({ nome: e.target.value })}
              autoFocus
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="edit-usuario-email">E-mail *</Label>
            <Input
              id="edit-usuario-email"
              type="email"
              value={editForm.email}
              onChange={(e) => patchEditForm({ email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-usuario-papel">Papel *</Label>
            <Select
              value={editForm.role || undefined}
              onValueChange={(v) => v && patchEditForm({ role: v as UserRole })}
            >
              <SelectTrigger id="edit-usuario-papel" className="w-full">
                <SelectValue placeholder="Selecione">
                  {editForm.role ? roleLabels[editForm.role] : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {roleLabels[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-usuario-setor">Setor *</Label>
            <Select
              value={editForm.setorId || undefined}
              onValueChange={(v) => v && patchEditForm({ setorId: v })}
            >
              <SelectTrigger id="edit-usuario-setor" className="w-full">
                <SelectValue placeholder="Selecione">
                  {departmentSelectLabel(
                    departments,
                    editForm.setorId,
                    "nome"
                  ) ?? null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-input accent-primary"
                checked={editForm.ativo}
                onChange={(e) => patchEditForm({ ativo: e.target.checked })}
              />
              Usuário ativo
            </label>
          </div>
        </div>
      </FormDialog>

      <ConfirmacaoDialog
        open={excluirId !== null}
        onOpenChange={(open) => !open && setExcluirId(null)}
        titulo="Excluir usuário"
        mensagem={
          usuarioParaExcluir
            ? `Deseja excluir o usuário ${usuarioParaExcluir.nome}? Esta ação não pode ser desfeita.`
            : "Deseja excluir este usuário?"
        }
        confirmarLabel="Excluir"
        variant="destructive"
        onConfirmar={confirmarExclusao}
      />
    </div>
  );
}
