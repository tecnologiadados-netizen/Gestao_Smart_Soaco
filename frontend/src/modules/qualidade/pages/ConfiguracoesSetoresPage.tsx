import { useCallback, useState } from "react";
import { Button } from "@qualidade/components/ui/button";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
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
import { SgqGradeFiltroCabecalho } from "@qualidade/components/ui/sgq-grade-filtro-cabecalho";
import { SgqGradeFiltroPortal } from "@qualidade/components/ui/sgq-grade-filtro-portal";
import { SgqGradeSurface } from "@qualidade/components/ui/sgq-grade-surface";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import type { Department } from "@qualidade/types/user";
import { useGradeFiltrosExcel } from "@/hooks/useGradeFiltrosExcel";

export function SetoresPage() {
  const departments = useConfigStore((s) => s.departments);
  const addDepartment = useConfigStore((s) => s.addDepartment);
  const updateDepartment = useConfigStore((s) => s.updateDepartment);
  const removeDepartment = useConfigStore((s) => s.removeDepartment);

  const [nome, setNome] = useState("");
  const [addError, setAddError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editError, setEditError] = useState("");

  const [excluirId, setExcluirId] = useState<string | null>(null);

  const getCellText = useCallback(
    (dep: Department, columnId: string) => (columnId === "nome" ? dep.nome : ""),
    []
  );
  const grade = useGradeFiltrosExcel<Department>({
    rows: departments,
    columnIds: ["nome"],
    getCellText,
  });
  const setoresOrdenados = grade.rowsExibidas;

  const setorParaExcluir = departments.find((d) => d.id === excluirId);
  const setorEmEdicao = departments.find((d) => d.id === editingId);

  function resetAddForm() {
    setNome("");
    setAddError("");
  }

  function fecharEdicao() {
    setEditingId(null);
    setEditNome("");
    setEditError("");
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();

    const nomeTrim = nome.trim();

    if (!nomeTrim) {
      setAddError("Preencha o nome.");
      return;
    }

    const ok = addDepartment(nomeTrim);
    if (!ok) {
      setAddError("Já existe um setor com este nome.");
      return;
    }

    resetAddForm();
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;

    const nomeTrim = editNome.trim();

    if (!nomeTrim) {
      setEditError("Preencha o nome.");
      return;
    }

    const ok = updateDepartment(editingId, nomeTrim);
    if (!ok) {
      setEditError("Já existe um setor com este nome.");
      return;
    }

    fecharEdicao();
  }

  function iniciarEdicao(id: string) {
    const dep = departments.find((d) => d.id === id);
    if (!dep) return;
    setEditingId(id);
    setEditNome(dep.nome);
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
      <PageBackLink to="/qualidade/configuracoes" />

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
          <Button type="submit">Adicionar</Button>
        </div>
        {addError ? (
          <p className="text-sm text-destructive" role="alert">
            {addError}
          </p>
        ) : null}
      </form>

      <SgqGradeSurface
        scrollRef={grade.tableScrollRef}
        temFiltros={grade.temFiltrosOuOrdem}
        onLimparFiltros={grade.limparFiltrosGrade}
      >
      <Table bare>
        <TableHeader>
          <TableRow>
            <SgqGradeFiltroCabecalho
              label="Nome"
              ativo={grade.colunaComFiltroAtivo("nome")}
              onClick={(e) => grade.abrirFiltroExcel("nome", e)}
            />
            <TableHead className="sticky top-0 z-10 w-[140px] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {setoresOrdenados.map((dep) => (
            <TableRow key={dep.id} className="group">
              <TableCell className="font-medium">{dep.nome}</TableCell>
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
      </SgqGradeSurface>
      <SgqGradeFiltroPortal grade={grade} />

      <FormDialog
        open={editingId !== null}
        onOpenChange={(open) => !open && fecharEdicao()}
        titulo="Editar setor"
        descricao={
          setorEmEdicao
            ? `Altere o nome do setor ${setorEmEdicao.nome}.`
            : undefined
        }
        onSubmit={handleEdit}
        submitLabel="Salvar alterações"
        error={editError}
      >
        <div className="space-y-2">
          <Label htmlFor="edit-nome">Nome</Label>
          <Input
            id="edit-nome"
            value={editNome}
            onChange={(e) => setEditNome(e.target.value)}
            autoFocus
            required
          />
        </div>
      </FormDialog>

      <ConfirmacaoDialog
        open={excluirId !== null}
        onOpenChange={(open) => !open && setExcluirId(null)}
        titulo="Excluir setor"
        mensagem={
          setorParaExcluir
            ? `Deseja excluir o setor ${setorParaExcluir.nome}? Esta ação não pode ser desfeita.`
            : "Deseja excluir este setor?"
        }
        confirmarLabel="Excluir"
        variant="destructive"
        onConfirmar={confirmarExclusao}
      />
    </div>
  );
}
