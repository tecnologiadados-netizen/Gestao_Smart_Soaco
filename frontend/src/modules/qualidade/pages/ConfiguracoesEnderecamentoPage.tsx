import { useMemo, useState } from "react";
import { Button } from "@qualidade/components/ui/button";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qualidade/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qualidade/components/ui/table";
import { ConfirmacaoDialog } from "@qualidade/components/ui/confirmacao-dialog";
import { FormDialog } from "@qualidade/components/ui/form-dialog";
import { PageBackLink } from "@qualidade/components/layout/page-back-link";
import { TableRowActions } from "@qualidade/components/ui/table-row-actions";
import { SortableTableHead } from "@qualidade/components/ui/sortable-table-head";
import { useTableSort } from "@qualidade/hooks/use-table-sort";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { formatEnderecamentoLabel } from "@qualidade/lib/enderecamentos-sync";
import { departmentSelectLabel } from "@qualidade/lib/utils/select-display";
import { sortByRules } from "@qualidade/lib/utils/table-sort";

type EnderecamentoSortKey = "setor" | "endereco";

export function EnderecamentoPage() {
  const departments = useConfigStore((s) => s.departments);
  const enderecamentos = useConfigStore((s) => s.enderecamentos);
  const addEnderecamento = useConfigStore((s) => s.addEnderecamento);
  const updateEnderecamento = useConfigStore((s) => s.updateEnderecamento);
  const removeEnderecamento = useConfigStore((s) => s.removeEnderecamento);

  const [setorId, setSetorId] = useState("");
  const [endereco, setEndereco] = useState("");
  const [addError, setAddError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSetorId, setEditSetorId] = useState("");
  const [editEndereco, setEditEndereco] = useState("");
  const [editError, setEditError] = useState("");

  const [excluirId, setExcluirId] = useState<string | null>(null);
  const { sorts, toggleSort, getSortState } = useTableSort<EnderecamentoSortKey>();

  const enderecamentosOrdenados = useMemo(() => {
    return sortByRules(enderecamentos, sorts, (item, key) => {
      if (key === "endereco") return item.endereco;
      return formatEnderecamentoLabel(item, departments);
    });
  }, [departments, enderecamentos, sorts]);

  const itemParaExcluir = enderecamentos.find((e) => e.id === excluirId);
  const itemEmEdicao = enderecamentos.find((e) => e.id === editingId);

  function resetAddForm() {
    setSetorId("");
    setEndereco("");
    setAddError("");
  }

  function fecharEdicao() {
    setEditingId(null);
    setEditSetorId("");
    setEditEndereco("");
    setEditError("");
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();

    if (!setorId) {
      setAddError("Selecione um setor.");
      return;
    }

    const enderecoTrim = endereco.trim();
    if (!enderecoTrim) {
      setAddError("Informe o endereço.");
      return;
    }

    const ok = addEnderecamento(setorId, enderecoTrim);
    if (!ok) {
      setAddError("Já existe este endereço para o setor selecionado.");
      return;
    }

    resetAddForm();
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;

    if (!editSetorId) {
      setEditError("Selecione um setor.");
      return;
    }

    const enderecoTrim = editEndereco.trim();
    if (!enderecoTrim) {
      setEditError("Informe o endereço.");
      return;
    }

    const ok = updateEnderecamento(editingId, editSetorId, enderecoTrim);
    if (!ok) {
      setEditError("Já existe este endereço para o setor selecionado.");
      return;
    }

    fecharEdicao();
  }

  function iniciarEdicao(id: string) {
    const item = enderecamentos.find((e) => e.id === id);
    if (!item) return;
    setEditingId(id);
    setEditSetorId(item.setorId);
    setEditEndereco(item.endereco);
    setEditError("");
  }

  function confirmarExclusao() {
    if (!excluirId) return;
    removeEnderecamento(excluirId);
    if (editingId === excluirId) {
      fecharEdicao();
    }
    setExcluirId(null);
  }

  return (
    <div className="space-y-6">
      <PageBackLink to="/qualidade/configuracoes" />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Endereçamento</h1>
        <p className="text-sm text-muted-foreground">
          Cadastro de localizações físicas por setor
        </p>
      </div>

      <form
        onSubmit={handleAdd}
        className="space-y-3 rounded-lg border bg-card p-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] space-y-2">
            <Label htmlFor="setor">Setor</Label>
            <Select value={setorId} onValueChange={(v) => v && setSetorId(v)}>
              <SelectTrigger id="setor" className="h-10 w-full">
                <SelectValue placeholder="Selecione o setor">
                  {departmentSelectLabel(departments, setorId, "nome") ?? null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {departments.map((dep) => (
                  <SelectItem key={dep.id} value={dep.id}>
                    {dep.sigla} — {dep.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[280px] flex-1 space-y-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Ex.: Armário A, prateleira 3"
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
              sortKey="setor"
              sortState={getSortState("setor")}
              onSort={toggleSort}
            >
              Setor
            </SortableTableHead>
            <SortableTableHead
              sortKey="endereco"
              sortState={getSortState("endereco")}
              onSort={toggleSort}
            >
              Endereço
            </SortableTableHead>
            <TableHead className="w-[140px] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {enderecamentosOrdenados.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground">
                Nenhum endereçamento cadastrado.
              </TableCell>
            </TableRow>
          ) : (
            enderecamentosOrdenados.map((item) => {
              const setor = departments.find((d) => d.id === item.setorId);
              return (
                <TableRow key={item.id} className="group">
                  <TableCell className="font-medium">
                    {setor ? `${setor.sigla} — ${setor.nome}` : "—"}
                  </TableCell>
                  <TableCell>{item.endereco}</TableCell>
                  <TableCell>
                    <TableRowActions
                      onEdit={() => iniciarEdicao(item.id)}
                      onDelete={() => setExcluirId(item.id)}
                    />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <FormDialog
        open={editingId !== null}
        onOpenChange={(open) => !open && fecharEdicao()}
        titulo="Editar endereçamento"
        descricao={
          itemEmEdicao
            ? `Altere o endereço ${formatEnderecamentoLabel(itemEmEdicao, departments)}.`
            : undefined
        }
        onSubmit={handleEdit}
        submitLabel="Salvar alterações"
        error={editError}
      >
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="edit-setor">Setor</Label>
            <Select
              value={editSetorId}
              onValueChange={(v) => v && setEditSetorId(v)}
            >
              <SelectTrigger id="edit-setor" className="h-10 w-full">
                <SelectValue placeholder="Selecione o setor">
                  {departmentSelectLabel(departments, editSetorId, "nome") ??
                    null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {departments.map((dep) => (
                  <SelectItem key={dep.id} value={dep.id}>
                    {dep.sigla} — {dep.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-endereco">Endereço</Label>
            <Input
              id="edit-endereco"
              value={editEndereco}
              onChange={(e) => setEditEndereco(e.target.value)}
              autoFocus
              required
            />
          </div>
        </div>
      </FormDialog>

      <ConfirmacaoDialog
        open={excluirId !== null}
        onOpenChange={(open) => !open && setExcluirId(null)}
        titulo="Excluir endereçamento"
        mensagem={
          itemParaExcluir
            ? `Deseja excluir o endereço ${formatEnderecamentoLabel(itemParaExcluir, departments)}? Esta ação não pode ser desfeita.`
            : "Deseja excluir este endereçamento?"
        }
        confirmarLabel="Excluir"
        variant="destructive"
        onConfirmar={confirmarExclusao}
      />
    </div>
  );
}
