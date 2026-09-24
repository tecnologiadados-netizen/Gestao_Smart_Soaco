import { useCallback, useState } from "react";
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
import { SgqGradeFiltroCabecalho } from "@qualidade/components/ui/sgq-grade-filtro-cabecalho";
import { SgqGradeFiltroPortal } from "@qualidade/components/ui/sgq-grade-filtro-portal";
import { SgqGradeSurface } from "@qualidade/components/ui/sgq-grade-surface";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import {
  enderecamentoSetorLabel,
  formatEnderecamentoLabel,
  normalizarCategoriaEnderecamento,
} from "@qualidade/lib/enderecamentos-sync";
import {
  ENDERECAMENTO_CATEGORIA_LABEL,
  ENDERECAMENTO_SETOR_GERAL_ID,
  ENDERECAMENTO_SETOR_GERAL_LABEL,
  type Enderecamento,
  type EnderecamentoCategoria,
} from "@qualidade/types/enderecamento";
import { useGradeFiltrosExcel } from "@/hooks/useGradeFiltrosExcel";

function setorSelectLabel(
  departments: ReturnType<typeof useConfigStore.getState>["departments"],
  setorId: string
): string | null {
  if (!setorId) return null;
  const label = enderecamentoSetorLabel(departments, setorId);
  return label === "—" ? null : label;
}

export function EnderecamentoPage() {
  const departments = useConfigStore((s) => s.departments);
  const enderecamentos = useConfigStore((s) => s.enderecamentos);
  const addEnderecamento = useConfigStore((s) => s.addEnderecamento);
  const updateEnderecamento = useConfigStore((s) => s.updateEnderecamento);
  const removeEnderecamento = useConfigStore((s) => s.removeEnderecamento);

  const [setorId, setSetorId] = useState("");
  const [categoria, setCategoria] = useState<EnderecamentoCategoria | "">("");
  const [endereco, setEndereco] = useState("");
  const [addError, setAddError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSetorId, setEditSetorId] = useState("");
  const [editCategoria, setEditCategoria] = useState<EnderecamentoCategoria>("fisico");
  const [editEndereco, setEditEndereco] = useState("");
  const [editError, setEditError] = useState("");

  const [excluirId, setExcluirId] = useState<string | null>(null);

  const getCellText = useCallback(
    (item: Enderecamento, columnId: string) => {
      if (columnId === "endereco") return item.endereco;
      if (columnId === "categoria") {
        return ENDERECAMENTO_CATEGORIA_LABEL[
          normalizarCategoriaEnderecamento(item.categoria)
        ];
      }
      return enderecamentoSetorLabel(departments, item.setorId);
    },
    [departments]
  );
  const grade = useGradeFiltrosExcel<Enderecamento>({
    rows: enderecamentos,
    columnIds: ["setor", "categoria", "endereco"],
    getCellText,
  });
  const enderecamentosOrdenados = grade.rowsExibidas;

  const itemParaExcluir = enderecamentos.find((e) => e.id === excluirId);
  const itemEmEdicao = enderecamentos.find((e) => e.id === editingId);

  function resetAddForm() {
    setSetorId("");
    setCategoria("");
    setEndereco("");
    setAddError("");
  }

  function fecharEdicao() {
    setEditingId(null);
    setEditSetorId("");
    setEditCategoria("fisico");
    setEditEndereco("");
    setEditError("");
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();

    if (!setorId) {
      setAddError("Selecione um setor.");
      return;
    }
    if (categoria !== "fisico" && categoria !== "eletronico") {
      setAddError("Selecione a categoria.");
      return;
    }

    const enderecoTrim = endereco.trim();
    if (!enderecoTrim) {
      setAddError("Informe o endereço.");
      return;
    }

    const ok = addEnderecamento(setorId, enderecoTrim, categoria);
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

    const ok = updateEnderecamento(editingId, editSetorId, enderecoTrim, editCategoria);
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
    setEditCategoria(normalizarCategoriaEnderecamento(item.categoria));
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
          Cadastro de localizações por setor e categoria (física ou eletrônica). Use{" "}
          <span className="font-medium text-foreground">
            {ENDERECAMENTO_SETOR_GERAL_LABEL}
          </span>{" "}
          para endereços válidos em todos os setores.
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
                  {setorSelectLabel(departments, setorId)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ENDERECAMENTO_SETOR_GERAL_ID}>
                  {ENDERECAMENTO_SETOR_GERAL_LABEL} — se aplica a todos
                </SelectItem>
                {departments.map((dep) => (
                  <SelectItem key={dep.id} value={dep.id}>
                    {dep.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[180px] space-y-2">
            <Label htmlFor="categoria">Categoria</Label>
            <Select
              value={categoria}
              onValueChange={(v) =>
                v && setCategoria(v as EnderecamentoCategoria)
              }
            >
              <SelectTrigger id="categoria" className="h-10 w-full">
                <SelectValue placeholder="Selecione">
                  {categoria ? ENDERECAMENTO_CATEGORIA_LABEL[categoria] : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fisico">Físico</SelectItem>
                <SelectItem value="eletronico">Eletrônico</SelectItem>
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

      <SgqGradeSurface
        scrollRef={grade.tableScrollRef}
        temFiltros={grade.temFiltrosOuOrdem}
        onLimparFiltros={grade.limparFiltrosGrade}
      >
      <Table bare>
        <TableHeader>
          <TableRow>
            <SgqGradeFiltroCabecalho
              label="Setor"
              ativo={grade.colunaComFiltroAtivo("setor")}
              onClick={(e) => grade.abrirFiltroExcel("setor", e)}
            />
            <SgqGradeFiltroCabecalho
              label="Categoria"
              ativo={grade.colunaComFiltroAtivo("categoria")}
              onClick={(e) => grade.abrirFiltroExcel("categoria", e)}
            />
            <SgqGradeFiltroCabecalho
              label="Endereço"
              ativo={grade.colunaComFiltroAtivo("endereco")}
              onClick={(e) => grade.abrirFiltroExcel("endereco", e)}
            />
            <TableHead className="sticky top-0 z-10 w-[140px] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {enderecamentosOrdenados.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                Nenhum endereçamento cadastrado.
              </TableCell>
            </TableRow>
          ) : (
            enderecamentosOrdenados.map((item) => (
              <TableRow key={item.id} className="group">
                <TableCell className="font-medium">
                  {enderecamentoSetorLabel(departments, item.setorId)}
                </TableCell>
                <TableCell>
                  {
                    ENDERECAMENTO_CATEGORIA_LABEL[
                      normalizarCategoriaEnderecamento(item.categoria)
                    ]
                  }
                </TableCell>
                <TableCell>{item.endereco}</TableCell>
                <TableCell>
                  <TableRowActions
                    onEdit={() => iniciarEdicao(item.id)}
                    onDelete={() => setExcluirId(item.id)}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </SgqGradeSurface>
      <SgqGradeFiltroPortal grade={grade} />

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
                  {setorSelectLabel(departments, editSetorId)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ENDERECAMENTO_SETOR_GERAL_ID}>
                  {ENDERECAMENTO_SETOR_GERAL_LABEL} — se aplica a todos
                </SelectItem>
                {departments.map((dep) => (
                  <SelectItem key={dep.id} value={dep.id}>
                    {dep.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-categoria">Categoria</Label>
            <Select
              value={editCategoria}
              onValueChange={(v) =>
                v && setEditCategoria(v as EnderecamentoCategoria)
              }
            >
              <SelectTrigger id="edit-categoria" className="h-10 w-full">
                <SelectValue>
                  {ENDERECAMENTO_CATEGORIA_LABEL[editCategoria]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fisico">Físico</SelectItem>
                <SelectItem value="eletronico">Eletrônico</SelectItem>
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
