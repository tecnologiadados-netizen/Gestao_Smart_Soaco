import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@qualidade/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@qualidade/components/ui/dialog";
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
import { PageBackLink } from "@qualidade/components/layout/page-back-link";
import { TableRowActions } from "@qualidade/components/ui/table-row-actions";
import {
  atualizarCausaProblema,
  atualizarReclamacaoProduto,
  buscarSetorProducaoProduto,
  classificacaoCatalogoProduto,
  criarCausaProblema,
  criarReclamacaoProduto,
  excluirCausaProblema,
  excluirReclamacaoProduto,
  listarCausasProblema,
  listarReclamacoesProduto,
  listarServicosRealizados,
  criarServicoRealizado,
  atualizarServicoRealizado,
  excluirServicoRealizado,
  type ProdutoSetorProducao,
  type ReclamacaoProdutoCadastro,
  type ReclamacaoProdutoExemplo,
  type SolucaoCausa,
} from "@qualidade/lib/api/qualidadeApi";
import { criarMatcherTextoLivre } from "@/utils/textoLivreBusca";
import { useAuth } from "@/contexts/AuthContext";
import { temExcluirConfigQualidade } from "@/utils/qualidadePermissoes";

function normalizarCodigo(codigo: string): string {
  return codigo.replace(/\s+/g, "").toUpperCase();
}

interface CatalogoSetorApi {
  listar: () => Promise<ReclamacaoProdutoCadastro[]>;
  criar: (input: {
    descricao: string;
    setorProducao: string;
    exemplo?: ReclamacaoProdutoExemplo | null;
    solucoes?: SolucaoCausa[];
  }) => Promise<ReclamacaoProdutoCadastro>;
  atualizar: (
    id: string,
    input: {
      descricao: string;
      setorProducao: string;
      exemplo?: ReclamacaoProdutoExemplo | null;
      solucoes?: SolucaoCausa[];
    }
  ) => Promise<ReclamacaoProdutoCadastro>;
  excluir: (id: string) => Promise<void>;
}

interface CatalogoSetorTextos {
  titulo: string;
  intro: string;
  campo: string;
  placeholderCampo: string;
  erroVazio: string;
  nota: string;
  filtroPlaceholder: string;
  rodape: string;
  vazio: string;
  excluirTitulo: string;
  excluirFallback: string;
  idPrefix: string;
}

function CatalogoFormulario({
  textos,
  modo,
  inicial,
  salvando,
  onSalvar,
  onCancelar,
}: {
  textos: CatalogoSetorTextos;
  modo: "criar" | "editar";
  inicial?: { descricao: string; setor: string };
  salvando: boolean;
  onSalvar: (dados: {
    descricao: string;
    setor: string;
    exemplo: ReclamacaoProdutoExemplo | null;
  }) => Promise<void>;
  onCancelar?: () => void;
}) {
  const prefixo = `${textos.idPrefix}-${modo}`;
  const [buscaProduto, setBuscaProduto] = useState("");
  const [buscandoProduto, setBuscandoProduto] = useState(false);
  const [erroBusca, setErroBusca] = useState("");
  const [produto, setProduto] = useState<ProdutoSetorProducao | null>(null);
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [erroForm, setErroForm] = useState("");

  useEffect(() => {
    const termo = buscaProduto.trim();
    if (termo.length < 2) {
      setProduto(null);
      setErroBusca("");
      setBuscandoProduto(false);
      return;
    }

    let ativo = true;
    const timer = window.setTimeout(() => {
      setBuscandoProduto(true);
      setErroBusca("");
      buscarSetorProducaoProduto(termo)
        .then((produtos) => {
          if (!ativo) return;
          const alvo = normalizarCodigo(termo);
          const exato = produtos.find((item) => normalizarCodigo(item.codigo) === alvo) ?? null;
          setProduto(exato);
          if (!exato) setErroBusca("Nenhum produto encontrado com esse código.");
        })
        .catch((erro: unknown) => {
          if (!ativo) return;
          setProduto(null);
          setErroBusca(erro instanceof Error ? erro.message : "Falha ao buscar o produto.");
        })
        .finally(() => {
          if (ativo) setBuscandoProduto(false);
        });
    }, 400);

    return () => {
      ativo = false;
      window.clearTimeout(timer);
    };
  }, [buscaProduto]);

  function limpar() {
    setBuscaProduto("");
    setProduto(null);
    setDescricao("");
    setErroForm("");
    setErroBusca("");
  }

  async function enviar(event: FormEvent) {
    event.preventDefault();
    const texto = descricao.trim();
    const classificacao = produto ? classificacaoCatalogoProduto(produto) : null;
    if (produto && !classificacao?.valor) {
      setErroForm("Esse produto não tem setor de produção nem tipo de produto no ERP.");
      return;
    }
    const setor = (classificacao?.valor || inicial?.setor || "").trim();
    if (!setor) {
      setErroForm("Informe o código do produto para identificar o setor ou o tipo de produto.");
      return;
    }
    if (modo === "criar" && !produto?.codigo) {
      setErroForm("Informe o código do produto para puxar a descrição e o setor ou o tipo.");
      return;
    }
    if (!texto) {
      setErroForm(textos.erroVazio);
      return;
    }
    setErroForm("");
    try {
      await onSalvar({
        descricao: texto,
        setor,
        exemplo: produto?.codigo
          ? { codigo: produto.codigo, descricao: produto.descricao }
          : null,
      });
      if (modo === "criar") limpar();
    } catch (erro: unknown) {
      setErroForm(erro instanceof Error ? erro.message : "Falha ao salvar.");
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${prefixo}-busca-produto`}>Código do produto</Label>
          <Input
            id={`${prefixo}-busca-produto`}
            value={buscaProduto}
            onChange={(e) => setBuscaProduto(e.target.value)}
            placeholder="Ex.: PA 9726"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefixo}-descricao-produto`}>Descrição</Label>
          <Input
            id={`${prefixo}-descricao-produto`}
            value={buscandoProduto ? "Buscando..." : (produto?.descricao ?? "")}
            readOnly
            placeholder="Preenchida pelo código do produto"
            className="campo-copiavel bg-muted/40"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefixo}-setor`}>
            {classificacaoCatalogoProduto(produto).origem === "tipo"
              ? "Tipo de produto"
              : "Setor de produção"}
          </Label>
          <Input
            id={`${prefixo}-setor`}
            value={
              produto
                ? classificacaoCatalogoProduto(produto).valor || "Não informado no ERP"
                : (inicial?.setor ?? "")
            }
            readOnly
            placeholder="Preenchido pelo código do produto"
            className="campo-copiavel bg-muted/40"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefixo}-descricao`}>{textos.campo}</Label>
          <Input
            id={`${prefixo}-descricao`}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={textos.placeholderCampo}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={salvando || buscandoProduto}>
          {modo === "editar" ? "Salvar" : "Cadastrar"}
        </Button>
        {modo === "editar" && onCancelar ? (
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
        ) : null}
      </div>
      {modo === "criar" ? (
        <p className="text-sm text-muted-foreground">{textos.nota}</p>
      ) : null}
      {erroBusca ? (
        <p className="text-sm text-destructive" role="alert">
          {erroBusca}
        </p>
      ) : null}
      {erroForm ? (
        <p className="text-sm text-destructive" role="alert">
          {erroForm}
        </p>
      ) : null}
    </form>
  );
}

function CatalogoSetorPage({
  api,
  textos,
  podeExcluir,
}: {
  api: CatalogoSetorApi;
  textos: CatalogoSetorTextos;
  podeExcluir: boolean;
}) {
  const [reclamacoes, setReclamacoes] = useState<ReclamacaoProdutoCadastro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [exemplosAberto, setExemplosAberto] = useState<ReclamacaoProdutoCadastro | null>(null);
  const [editando, setEditando] = useState<ReclamacaoProdutoCadastro | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [excluirId, setExcluirId] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    api.listar()
      .then((lista) => {
        if (ativo) setReclamacoes(lista);
      })
      .catch((erro: unknown) => {
        if (ativo) setErroLista(erro instanceof Error ? erro.message : "Falha ao carregar.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const filtradas = useMemo(() => {
    const match = criarMatcherTextoLivre(filtro);
    return reclamacoes.filter(
      (item) =>
        match(item.descricao) || match(item.setorProducao)
    );
  }, [filtro, reclamacoes]);

  const paraExcluir = reclamacoes.find((item) => item.id === excluirId);

  function ordenar(lista: ReclamacaoProdutoCadastro[]) {
    return [...lista].sort(
      (a, b) =>
        a.setorProducao.localeCompare(b.setorProducao) || a.descricao.localeCompare(b.descricao)
    );
  }

  async function persistir(
    id: string | null,
    dados: {
      descricao: string;
      setor: string;
      exemplo: ReclamacaoProdutoExemplo | null;
    }
  ) {
    setSalvando(true);
    try {
      const payload = {
        descricao: dados.descricao,
        setorProducao: dados.setor,
        exemplo: dados.exemplo,
      };
      if (id) {
        const salva = await api.atualizar(id, payload);
        setReclamacoes((atual) =>
          ordenar(atual.map((item) => (item.id === salva.id ? salva : item)))
        );
        setEditando(null);
        return;
      }
      const criada = await api.criar(payload);
      setReclamacoes((atual) => {
        const existe = atual.some((item) => item.id === criada.id);
        const lista = existe
          ? atual.map((item) => (item.id === criada.id ? criada : item))
          : [...atual, criada];
        return ordenar(lista);
      });
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (!excluirId) return;
    const id = excluirId;
    setExcluirId(null);
    try {
      await api.excluir(id);
      setReclamacoes((atual) => atual.filter((item) => item.id !== id));
      if (editando?.id === id) setEditando(null);
    } catch (erro: unknown) {
      setErroLista(erro instanceof Error ? erro.message : "Falha ao excluir.");
    }
  }

  return (
    <div className="space-y-6">
      <PageBackLink to="/qualidade/configuracoes" />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{textos.titulo}</h1>
        <p className="text-sm text-muted-foreground">{textos.intro}</p>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <CatalogoFormulario
          textos={textos}
          modo="criar"
          salvando={salvando && !editando}
          onSalvar={(dados) => persistir(null, dados)}
        />
      </div>

      <Dialog
        open={Boolean(editando)}
        onOpenChange={(open) => {
          if (!open) setEditando(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Editar {textos.campo.toLowerCase()}</DialogTitle>
            <DialogDescription>
              {editando
                ? `Classificação atual: ${editando.setorProducao}. Informe outro código se quiser trocar o setor ou o tipo de produto.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {editando ? (
            <CatalogoFormulario
              key={editando.id}
              textos={textos}
              modo="editar"
              inicial={{
                descricao: editando.descricao,
                setor: editando.setorProducao,
              }}
              salvando={salvando}
              onSalvar={(dados) => persistir(editando.id, dados)}
              onCancelar={() => setEditando(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${textos.idPrefix}-filtro`}>Filtrar cadastro</Label>
          <Input
            id={`${textos.idPrefix}-filtro`}
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder={textos.filtroPlaceholder}
            className="w-72 max-w-full"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {textos.rodape}{" "}
          <Link to="/qualidade/registros" className="underline">
            RCC
          </Link>
          .
        </p>
      </div>

      {erroLista ? (
        <p className="text-sm text-destructive" role="alert">
          {erroLista}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table bare className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead>{textos.campo}</TableHead>
              <TableHead>Setor ou tipo de produto</TableHead>
              <TableHead className="w-28 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filtradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  {textos.vazio}
                </TableCell>
              </TableRow>
            ) : (
              filtradas.map((item) => (
                <TableRow
                  key={item.id}
                  className="group cursor-pointer"
                  onClick={() => setExemplosAberto(item)}
                >
                  <TableCell>{item.descricao}</TableCell>
                  <TableCell>{item.setorProducao}</TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <TableRowActions
                      onEdit={() => setEditando(item)}
                      onDelete={podeExcluir ? () => setExcluirId(item.id) : undefined}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmacaoDialog
        open={Boolean(excluirId)}
        onOpenChange={(open) => {
          if (!open) setExcluirId(null);
        }}
        titulo={textos.excluirTitulo}
        mensagem={
          paraExcluir
            ? `Excluir "${paraExcluir.descricao}" de ${paraExcluir.setorProducao}?`
            : textos.excluirFallback
        }
        confirmarLabel="Excluir"
        variant="destructive"
        onConfirmar={() => void confirmarExclusao()}
      />

      <Dialog
        open={Boolean(exemplosAberto)}
        onOpenChange={(open) => {
          if (!open) setExemplosAberto(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{exemplosAberto?.descricao ?? "Produtos de exemplo"}</DialogTitle>
            <DialogDescription>
              {exemplosAberto
                ? `Classificação: ${exemplosAberto.setorProducao}. Códigos usados para identificar esse setor ou tipo de produto.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-auto rounded-lg border border-border">
            <Table bare className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(exemplosAberto?.exemplos ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-muted-foreground">
                      Nenhum produto de exemplo cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  exemplosAberto?.exemplos.map((exemplo) => (
                    <TableRow key={exemplo.codigo}>
                      <TableCell className="whitespace-nowrap">{exemplo.codigo}</TableCell>
                      <TableCell>{exemplo.descricao || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const API_RECLAMACAO: CatalogoSetorApi = {
  listar: listarReclamacoesProduto,
  criar: criarReclamacaoProduto,
  atualizar: atualizarReclamacaoProduto,
  excluir: excluirReclamacaoProduto,
};

const TEXTOS_RECLAMACAO: CatalogoSetorTextos = {
  titulo: "Reclamações de produto",
  intro:
    "Informe o código do produto para puxar a descrição e o setor de produção. Se o produto for comprado e não tiver setor, o cadastro usa o tipo de produto do Nomus. No RCC, o usuário só seleciona o que foi cadastrado aqui.",
  campo: "Reclamação",
  placeholderCampo: "Ex.: Chapa amassada",
  erroVazio: "Informe a reclamação.",
  nota: "O código é só um exemplo para achar o setor ou o tipo de produto. A tabela guarda essa classificação e a reclamação. Cadastrar a mesma reclamação com outro código inclui mais um exemplo.",
  filtroPlaceholder: "Reclamação, setor ou tipo. Use % para refinar.",
  rodape: "Essas opções aparecem na coluna Categorize a reclamação do",
  vazio: "Nenhuma reclamação cadastrada.",
  excluirTitulo: "Excluir reclamação",
  excluirFallback: "Excluir esta reclamação?",
  idPrefix: "reclamacao",
};

const API_CAUSA: CatalogoSetorApi = {
  listar: listarCausasProblema,
  criar: criarCausaProblema,
  atualizar: atualizarCausaProblema,
  excluir: excluirCausaProblema,
};

const TEXTOS_CAUSA: CatalogoSetorTextos = {
  titulo: "Causas do problema",
  intro:
    "Informe o código do produto para puxar a descrição e o setor de produção. Se o produto for comprado e não tiver setor, o cadastro usa o tipo de produto do Nomus. No RCC, o usuário só seleciona o que foi cadastrado aqui.",
  campo: "Causa do problema",
  placeholderCampo: "Ex.: Produto com defeito",
  erroVazio: "Informe a causa do problema.",
  nota: "O código é só um exemplo para achar o setor ou o tipo de produto. A tabela guarda essa classificação e a causa.",
  filtroPlaceholder: "Causa, setor ou tipo. Use % para refinar.",
  rodape: "Essas opções aparecem na coluna Causa do problema do",
  vazio: "Nenhuma causa cadastrada.",
  excluirTitulo: "Excluir causa do problema",
  excluirFallback: "Excluir esta causa do problema?",
  idPrefix: "causa-problema",
};

export function ReclamacoesProdutoPage() {
  const { hasPermission } = useAuth();
  return (
    <CatalogoSetorPage
      api={API_RECLAMACAO}
      textos={TEXTOS_RECLAMACAO}
      podeExcluir={temExcluirConfigQualidade(hasPermission, "reclamacoes")}
    />
  );
}

export function CausasProblemaPage() {
  const { hasPermission } = useAuth();
  return (
    <CatalogoSetorPage
      api={API_CAUSA}
      textos={TEXTOS_CAUSA}
      podeExcluir={temExcluirConfigQualidade(hasPermission, "causas")}
    />
  );
}

const API_SERVICO: CatalogoSetorApi = {
  listar: listarServicosRealizados,
  criar: criarServicoRealizado,
  atualizar: atualizarServicoRealizado,
  excluir: excluirServicoRealizado,
};

const TEXTOS_SERVICO: CatalogoSetorTextos = {
  titulo: "Serviços realizados",
  intro:
    "Informe o código do produto para puxar a descrição e o setor de produção. Se o produto for comprado e não tiver setor, o cadastro usa o tipo de produto do Nomus. No RCC, o usuário só seleciona o que foi cadastrado aqui.",
  campo: "Serviço realizado",
  placeholderCampo: "Ex.: Troca do compressor",
  erroVazio: "Informe o serviço realizado.",
  nota: "O código é só um exemplo para achar o setor ou o tipo de produto. A tabela guarda essa classificação e o serviço. Cadastrar o mesmo serviço com outro código inclui mais um exemplo.",
  filtroPlaceholder: "Serviço, setor ou tipo. Use % para refinar.",
  rodape: "Esses serviços aparecem no campo Serviço realizado do",
  vazio: "Nenhum serviço cadastrado.",
  excluirTitulo: "Excluir serviço realizado",
  excluirFallback: "Excluir este serviço realizado?",
  idPrefix: "servico-realizado",
};

export function ServicosRealizadosPage() {
  const { hasPermission } = useAuth();
  return (
    <CatalogoSetorPage
      api={API_SERVICO}
      textos={TEXTOS_SERVICO}
      podeExcluir={temExcluirConfigQualidade(hasPermission, "servicos")}
    />
  );
}
