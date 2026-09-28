import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Search, Trash2 } from "lucide-react";
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
import { ListaSugestaoFlutuante } from "@qualidade/components/registros/lista-sugestao-flutuante";
import { PedidoVendaSearchField } from "@qualidade/components/registros/pedido-venda-search-field";
import { criarMatcherTextoLivre } from "@/utils/textoLivreBusca";
import { cn } from "@qualidade/lib/utils";
import { ProdutoCodigoField } from "@qualidade/components/registros/produto-codigo-field";
import { rncFieldLabels } from "@qualidade/lib/registros/constants";
import {
  fetchItensPedidoVendaAtendidos,
  fetchNotasFiscaisPedidoVenda,
} from "@qualidade/lib/registros/fetch-pedidos-venda-client";
import { produtoErpParaCamposRnc } from "@qualidade/types/produto-erp";
import type { ItemPedidoVendaAtendidoErp } from "@qualidade/types/pedido-venda-erp";
import {
  criarRncItemProdutoVazio,
  notasFiscaisDistintas,
  type RncDados,
  type RncItemProduto,
  type RncPedidoVendaResposta,
} from "@qualidade/types/rnc";

interface RncItensProdutoTableProps {
  dados: RncDados;
  onChange: (dados: RncDados) => void;
  disabled?: boolean;
  erro?: string;
}

function descricaoDoItem(item: RncItemProduto): string {
  const produto = item.produto.trim();
  const codigo = item.codigoProduto.trim();
  if (!produto) return "";
  if (codigo && produto.toLowerCase().startsWith(codigo.toLowerCase())) {
    return produto.slice(codigo.length).replace(/^\s*-\s*/, "").trim();
  }
  return produto;
}

function rotuloStatusItem(status: number): string {
  if (status === 3) return "Atendido parcialmente";
  if (status === 4) return "Atendido totalmente";
  if (status === 5) return "Atendido com corte";
  return "";
}

/** A busca entra no mesmo ponto dos outros seletores do módulo. */
const QUANTIDADE_BUSCA_A_PARTIR_DE = 11;
/** Acima disso a lista não é montada inteira: só entram os resultados da pesquisa. */
const QUANTIDADE_SELECT_LIMITE = 250;
const QUANTIDADE_RESULTADOS_VISIVEIS = 80;

function maximaNumerica(valor: string): number | null {
  const n = Number(String(valor).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function quantidadeEhInteira(max: number): boolean {
  return Math.abs(max - Math.round(max)) < 1e-6;
}

function rotuloQuantidadeOpcao(n: number): string {
  if (quantidadeEhInteira(n)) return String(Math.round(n));
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 4, useGrouping: false });
}

function totalQuantidadesDisponiveis(max: number): number {
  if (quantidadeEhInteira(max)) return Math.max(0, Math.round(max));
  return Math.floor(max) + 1;
}

function rotuloPorIndice(indice: number, max: number): string {
  const ultimoInteiro = quantidadeEhInteira(max) ? Math.round(max) : Math.floor(max);
  if (indice <= ultimoInteiro) return String(indice);
  return rotuloQuantidadeOpcao(max);
}

function listarQuantidades(max: number): string[] {
  const total = totalQuantidadesDisponiveis(max);
  const lista: string[] = [];
  for (let i = 1; i <= total; i += 1) lista.push(rotuloPorIndice(i, max));
  return lista;
}

function quantidadeSalvaNaLista(valor: string, max: number): string {
  const n = Number(valor.trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n > max + 1e-6) return "";
  const total = totalQuantidadesDisponiveis(max);
  for (let i = 1; i <= total; i += 1) {
    const rotulo = rotuloPorIndice(i, max);
    const candidato = Number(rotulo.replace(",", "."));
    if (Math.abs(candidato - n) < 1e-6) return rotulo;
  }
  return "";
}

function filtrarQuantidades(max: number, busca: string): string[] {
  const matcher = criarMatcherTextoLivre(busca);
  const total = totalQuantidadesDisponiveis(max);
  const itens: string[] = [];
  for (let i = 1; i <= total && itens.length < QUANTIDADE_RESULTADOS_VISIVEIS; i += 1) {
    const rotulo = rotuloPorIndice(i, max);
    if (matcher(rotulo)) itens.push(rotulo);
  }
  return itens;
}

function textoQuantidadeMaxima(maxima: string): string {
  const max = Number(maxima.replace(",", "."));
  if (!Number.isFinite(max) || max <= 0) return "";
  return max.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

function idsPedidos(itens: RncItemProduto[]): string[] {
  return [...new Set(itens.map((item) => item.pedidoId.trim()).filter(Boolean))].sort();
}

export function RncItensProdutoTable({
  dados,
  onChange,
  disabled = false,
  erro,
}: RncItensProdutoTableProps) {
  const itens = dados.itensProduto ?? [];
  const dadosRef = useRef(dados);
  const itensRef = useRef(itens);
  dadosRef.current = dados;
  itensRef.current = itens;
  const geracaoNfRef = useRef(0);
  const [pedidosBuscando, setPedidosBuscando] = useState<string[]>([]);
  const [erroNf, setErroNf] = useState("");

  function publicar(proximos: RncItemProduto[], extra?: Partial<RncDados>) {
    const base = dadosRef.current;
    const primeiro = proximos.find((item) => item.codigoProduto.trim());
    const resposta = extra?.temPedidoVenda ?? base.temPedidoVenda;
    itensRef.current = proximos;
    const proximo: RncDados = {
      ...base,
      ...extra,
      itensProduto: proximos,
      notaFiscal: resposta === "sim" ? notasFiscaisDistintas(proximos) : "",
      grupoProduto: primeiro?.grupoProduto || base.grupoProduto,
      tipoProduto: primeiro?.tipoProduto || base.tipoProduto,
    };
    dadosRef.current = proximo;
    onChange(proximo);
  }

  function aplicarNotasPorPedido(porPedido: Map<string, string>) {
    const atualizados = itensRef.current.map((item) => {
      const id = item.pedidoId.trim();
      const nota = id ? (porPedido.get(id) ?? "") : "";
      return item.notaFiscal === nota ? item : { ...item, notaFiscal: nota };
    });
    const mudou = atualizados.some(
      (item, index) => item.notaFiscal !== itensRef.current[index]?.notaFiscal
    );
    if (!mudou) return;
    publicar(atualizados);
  }

  function agendarNotasFiscais(proximos: RncItemProduto[]) {
    const ids = idsPedidos(proximos);
    const geracao = ++geracaoNfRef.current;
    setErroNf("");

    queueMicrotask(() => {
      if (geracao !== geracaoNfRef.current) return;
      if (ids.length === 0) {
        setPedidosBuscando([]);
        aplicarNotasPorPedido(new Map());
        return;
      }

      setPedidosBuscando(ids);
      void Promise.all(ids.map((id) => fetchNotasFiscaisPedidoVenda(id)))
        .then((listas) => {
          if (geracao !== geracaoNfRef.current) return;
          const porPedido = new Map<string, string>();
          ids.forEach((id, index) => {
            const notas = [
              ...new Set((listas[index] ?? []).map((nota) => nota.trim()).filter(Boolean)),
            ].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
            porPedido.set(id, notas.join(", "));
          });
          aplicarNotasPorPedido(porPedido);
        })
        .catch(() => {
          if (geracao !== geracaoNfRef.current) return;
          aplicarNotasPorPedido(new Map(ids.map((id) => [id, ""])));
          setErroNf("Não foi possível buscar a nota fiscal do pedido.");
        })
        .finally(() => {
          if (geracao === geracaoNfRef.current) setPedidosBuscando([]);
        });
    });
  }

  function definirResposta(valor: RncPedidoVendaResposta) {
    geracaoNfRef.current += 1;
    setPedidosBuscando([]);
    setErroNf("");
    publicar([criarRncItemProdutoVazio()], {
      temPedidoVenda: valor,
      grupoProduto: "",
      tipoProduto: "",
      numeroOrdemProducao: valor === "nao" ? "" : dados.numeroOrdemProducao,
      notaFiscal: "",
    });
  }

  function atualizar(
    id: string,
    partial: Partial<RncItemProduto>,
    opcoes?: { notas?: boolean }
  ) {
    const proximos = itensRef.current.map((item) =>
      item.id === id ? { ...item, ...partial } : item
    );
    publicar(proximos);
    if (opcoes?.notas) agendarNotasFiscais(proximos);
  }

  function adicionarLinha() {
    publicar([...itens, criarRncItemProdutoVazio()]);
  }

  function removerLinha(id: string) {
    const proximos = itens.filter((item) => item.id !== id);
    const finais = proximos.length > 0 ? proximos : [criarRncItemProdutoVazio()];
    publicar(finais);
    if (dados.temPedidoVenda === "sim") agendarNotasFiscais(finais);
  }

  return (
    <div className="space-y-4 sm:col-span-2">
      <div className="space-y-3">
        <Label>Tem pedido de venda emitido? *</Label>
        <div className="flex flex-wrap gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="rnc-tem-pedido-venda"
              className="size-4 accent-brand-blue"
              checked={dados.temPedidoVenda === "sim"}
              disabled={disabled}
              onChange={() => definirResposta("sim")}
            />
            Sim
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="rnc-tem-pedido-venda"
              className="size-4 accent-brand-blue"
              checked={dados.temPedidoVenda === "nao"}
              disabled={disabled}
              onChange={() => definirResposta("nao")}
            />
            Não
          </label>
        </div>
        {dados.temPedidoVenda === "sim" ? (
          <p className="text-xs text-muted-foreground">
            Só entram pedidos com item atendido parcialmente, totalmente ou com
            corte. A quantidade fica limitada ao que foi vendido.
          </p>
        ) : null}
        {erro ? (
          <p className="text-xs text-destructive" role="alert">
            {erro}
          </p>
        ) : null}
      </div>

      {dados.temPedidoVenda ? (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-border">
          <Table bare className="rnc-itens-grade min-w-[820px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {dados.temPedidoVenda === "sim" ? (
                  <TableHead className="min-w-52">Pedido de venda *</TableHead>
                ) : null}
                <TableHead className="min-w-56">
                  {dados.temPedidoVenda === "sim" ? "Item *" : "Código do produto *"}
                </TableHead>
                {dados.temPedidoVenda === "nao" ? (
                  <TableHead className="min-w-56">Descrição *</TableHead>
                ) : null}
                <TableHead className="w-36">Quantidade</TableHead>
                {dados.temPedidoVenda === "sim" ? (
                  <TableHead className="min-w-36">{rncFieldLabels.notaFiscal}</TableHead>
                ) : null}
                {disabled ? null : <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item) => (
                <TableRow key={item.id} className="hover:bg-transparent">
                  {dados.temPedidoVenda === "sim" ? (
                    <TableCell className="align-top">
                      {disabled ? (
                        <span>{item.pedidoNumero || "—"}</span>
                      ) : (
                        <PedidoVendaSearchField
                          id={`rnc-pedido-${item.id}`}
                          value={item.pedidoNumero}
                          ocultarRotulo
                          somenteAtendidos
                          onValueChange={(numero) =>
                            atualizar(
                              item.id,
                              {
                                pedidoNumero: numero,
                                pedidoId: "",
                                itemPedidoId: "",
                                codigoProduto: "",
                                produto: "",
                                grupoProduto: "",
                                tipoProduto: "",
                                quantidade: "",
                                quantidadeMaxima: "",
                                notaFiscal: "",
                              },
                              { notas: true }
                            )
                          }
                          onPedidoSelect={(pedido) =>
                            atualizar(
                              item.id,
                              {
                                pedidoId: pedido.pedidoId,
                                pedidoNumero: pedido.numero,
                                itemPedidoId: "",
                                codigoProduto: "",
                                produto: "",
                                grupoProduto: "",
                                tipoProduto: "",
                                quantidade: "",
                                quantidadeMaxima: "",
                                notaFiscal: "",
                              },
                              { notas: true }
                            )
                          }
                          disabled={disabled}
                        />
                      )}
                    </TableCell>
                  ) : null}
                  <TableCell className="align-top">
                    {dados.temPedidoVenda === "sim" ? (
                      <ItemPedidoSelect
                        item={item}
                        disabled={disabled || !item.pedidoId}
                        onSelect={(escolhido) =>
                          atualizar(item.id, {
                            itemPedidoId: escolhido.itemId,
                            codigoProduto: escolhido.codigo,
                            produto: escolhido.descricao
                              ? `${escolhido.codigo} - ${escolhido.descricao}`
                              : escolhido.codigo,
                            grupoProduto: escolhido.grupoProduto,
                            tipoProduto: escolhido.tipoProduto,
                            quantidade: "",
                            quantidadeMaxima: String(escolhido.quantidadeVendida),
                          })
                        }
                      />
                    ) : disabled ? (
                      <span>{item.codigoProduto || item.produto || "—"}</span>
                    ) : (
                      <ProdutoCodigoField
                        id={`rnc-codigo-${item.id}`}
                        value={item.codigoProduto}
                        ocultarRotulo
                        onCodigoChange={(codigo) =>
                          atualizar(item.id, {
                            codigoProduto: codigo,
                            produto: "",
                            grupoProduto: "",
                            tipoProduto: "",
                          })
                        }
                        onProdutoSelect={(produto) => {
                          const campos = produtoErpParaCamposRnc(produto);
                          atualizar(item.id, campos);
                        }}
                        disabled={disabled}
                      />
                    )}
                  </TableCell>
                  {dados.temPedidoVenda === "nao" ? (
                    <TableCell className="align-top">
                      <Input
                        value={descricaoDoItem(item)}
                        readOnly
                        disabled
                        placeholder="Descrição do item"
                        className="bg-muted/40"
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="align-top">
                    {dados.temPedidoVenda === "sim" ? (
                      <QuantidadePedidoField
                        quantidade={item.quantidade}
                        quantidadeMaxima={item.quantidadeMaxima}
                        disabled={disabled || !item.itemPedidoId}
                        onChange={(quantidade) => atualizar(item.id, { quantidade })}
                      />
                    ) : (
                      <Input
                        value={item.quantidade}
                        inputMode="decimal"
                        disabled={disabled}
                        onChange={(e) =>
                          atualizar(item.id, {
                            quantidade: e.target.value.replace(/[^\d.,]/g, ""),
                          })
                        }
                      />
                    )}
                  </TableCell>
                  {dados.temPedidoVenda === "sim" ? (
                    <TableCell className="align-top">
                      <Input
                        value={item.notaFiscal}
                        readOnly
                        disabled
                        aria-label={rncFieldLabels.notaFiscal}
                        placeholder={
                          !item.pedidoId
                            ? "Selecione o pedido"
                            : pedidosBuscando.includes(item.pedidoId)
                              ? "Buscando..."
                              : "Sem nota fiscal"
                        }
                        className="bg-muted/40"
                      />
                    </TableCell>
                  ) : null}
                  {disabled ? null : (
                    <TableCell className="align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remover item"
                        onClick={() => removerLinha(item.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          {disabled ? null : (
            <Button type="button" variant="outline" size="sm" onClick={adicionarLinha}>
              <Plus className="size-4" />
              Adicionar item
            </Button>
          )}
          {erroNf ? <p className="text-xs text-destructive">{erroNf}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function QuantidadePedidoField({
  quantidade,
  quantidadeMaxima,
  disabled,
  onChange,
}: {
  quantidade: string;
  quantidadeMaxima: string;
  disabled?: boolean;
  onChange: (quantidade: string) => void;
}) {
  const max = maximaNumerica(quantidadeMaxima);
  const opcoes = useMemo(() => {
    if (max == null || totalQuantidadesDisponiveis(max) > QUANTIDADE_SELECT_LIMITE) return [];
    return listarQuantidades(max);
  }, [max]);

  if (max == null) {
    return <Input disabled placeholder="Selecione o item..." />;
  }

  const selecionada = quantidadeSalvaNaLista(quantidade, max);

  if (totalQuantidadesDisponiveis(max) > QUANTIDADE_SELECT_LIMITE) {
    return (
      <QuantidadePedidoListaGrande
        max={max}
        selecionada={selecionada}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  return (
    <Select
      value={selecionada || null}
      onValueChange={(valor) => valor && onChange(valor)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Selecione...">{selecionada || null}</SelectValue>
      </SelectTrigger>
      <SelectContent
        align="start"
        pesquisavel={opcoes.length >= QUANTIDADE_BUSCA_A_PARTIR_DE}
      >
        {opcoes.map((opcao) => (
          <SelectItem key={opcao} value={opcao}>
            {opcao}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function QuantidadePedidoListaGrande({
  max,
  selecionada,
  disabled,
  onChange,
}: {
  max: number;
  selecionada: string;
  disabled?: boolean;
  onChange: (quantidade: string) => void;
}) {
  const listId = useId();
  const ancoraRef = useRef<HTMLButtonElement>(null);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const opcoes = useMemo(() => filtrarQuantidades(max, busca), [max, busca]);
  const total = totalQuantidadesDisponiveis(max);

  useEffect(() => {
    if (!aberto) return;
    function handleClickOutside(event: MouseEvent) {
      const alvo = event.target;
      if (!(alvo instanceof Node)) return;
      if (ancoraRef.current?.contains(alvo)) return;
      if (alvo instanceof Element && alvo.closest("[data-lista-sugestao]")) return;
      setAberto(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [aberto]);

  return (
    <div>
      <button
        ref={ancoraRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={listId}
        onClick={() => {
          setBusca("");
          setAberto((atual) => !atual);
        }}
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors outline-none select-none",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
        )}
      >
        <span className={cn("truncate text-left", !selecionada && "text-muted-foreground")}>
          {selecionada || "Selecione..."}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>
      <ListaSugestaoFlutuante
        aberto={aberto && !disabled}
        ancoraRef={ancoraRef}
        id={listId}
        cabecalho={
          <div className="shrink-0 border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Digite para pesquisar… (% refina)"
                autoComplete="off"
                autoFocus
                className="h-9 w-full rounded-md border border-input bg-background pr-3 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {total.toLocaleString("pt-BR")} quantidades disponíveis
            </p>
          </div>
        }
      >
        {opcoes.length === 0 ? (
          <li className="px-3 py-2 text-sm text-muted-foreground">Nenhuma quantidade encontrada.</li>
        ) : (
          opcoes.map((opcao) => (
            <li key={opcao} role="option" aria-selected={selecionada === opcao}>
              <button
                type="button"
                className={cn(
                  "flex w-full px-3 py-2 text-left text-sm hover:bg-muted",
                  selecionada === opcao && "bg-muted/60 font-medium"
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(opcao);
                  setAberto(false);
                  setBusca("");
                }}
              >
                {opcao}
              </button>
            </li>
          ))
        )}
        {opcoes.length >= QUANTIDADE_RESULTADOS_VISIVEIS &&
        total > QUANTIDADE_RESULTADOS_VISIVEIS ? (
          <li className="px-3 py-2 text-[11px] text-muted-foreground">
            Refine a pesquisa para ver outras quantidades.
          </li>
        ) : null}
      </ListaSugestaoFlutuante>
    </div>
  );
}

function ItemPedidoSelect({
  item,
  disabled,
  onSelect,
}: {
  item: RncItemProduto;
  disabled?: boolean;
  onSelect: (itemPedido: ItemPedidoVendaAtendidoErp) => void;
}) {
  const [opcoes, setOpcoes] = useState<ItemPedidoVendaAtendidoErp[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!item.pedidoId) {
      setOpcoes([]);
      setErro("");
      return;
    }

    let ativo = true;
    setCarregando(true);
    setErro("");
    fetchItensPedidoVendaAtendidos(item.pedidoId)
      .then((lista) => {
        if (ativo) setOpcoes(lista);
      })
      .catch(() => {
        if (!ativo) return;
        setOpcoes([]);
        setErro("Não foi possível carregar os itens deste pedido.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [item.pedidoId]);

  const valorAtual =
    opcoes.some((opcao) => opcao.itemId === item.itemPedidoId)
      ? item.itemPedidoId
      : undefined;

  return (
    <div className="space-y-1">
      <Select
        value={valorAtual}
        onValueChange={(id) => {
          const escolhido = opcoes.find((opcao) => opcao.itemId === id);
          if (escolhido) onSelect(escolhido);
        }}
        disabled={disabled || carregando || opcoes.length === 0}
      >
        <SelectTrigger className="w-full">
          <SelectValue
            placeholder={
              !item.pedidoId
                ? "Selecione o pedido..."
                : carregando
                  ? "Carregando itens..."
                  : "Selecione o item..."
            }
          >
            {item.codigoProduto
              ? item.produto || item.codigoProduto
              : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {opcoes.map((opcao) => {
            const status = rotuloStatusItem(opcao.statusItem);
            const max = textoQuantidadeMaxima(String(opcao.quantidadeVendida));
            return (
              <SelectItem key={opcao.itemId} value={opcao.itemId}>
                {opcao.codigo}
                {opcao.descricao ? ` — ${opcao.descricao}` : ""}
                {status ? ` · ${status}` : ""}
                {max ? ` · vendido ${max}` : ""}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {erro ? (
        <p className="text-xs text-destructive" role="alert">
          {erro}
        </p>
      ) : null}
      {!carregando && item.pedidoId && opcoes.length === 0 && !erro ? (
        <p className="text-xs text-muted-foreground">
          Este pedido não tem item atendido parcial, total ou com corte.
        </p>
      ) : null}
    </div>
  );
}
