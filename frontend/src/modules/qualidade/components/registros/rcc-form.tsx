import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { temAlertaCadastroRcc } from "@/utils/qualidadePermissoes";
import { Check } from "lucide-react";
import { Dialog, DialogContent } from "@qualidade/components/ui/dialog";
import { FormModalHeader } from "@qualidade/components/ui/form-modal";
import { Textarea } from "@qualidade/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qualidade/components/ui/select";
import { CampoClienteLapis } from "@qualidade/components/registros/campo-cliente-lapis";
import { CampoErro } from "@qualidade/components/registros/campo-erro";
import { ClienteSearchField } from "@qualidade/components/registros/cliente-search-field";
import { OrganicoResponsavelField } from "@qualidade/components/registros/organico-responsavel-field";
import { PessoaSearchField } from "@qualidade/components/registros/pessoa-search-field";
import { RccReclamacoesTable } from "@qualidade/components/registros/rcc-reclamacoes-table";
import { RccServicosTable } from "@qualidade/components/registros/rcc-servicos-table";
import { RncItensProdutoTable } from "@qualidade/components/registros/rnc-itens-produto-table";
import { RegistroAnexosTable } from "@qualidade/components/registros/registro-anexos-table";
import { codigoAlfanumericoMaiusculo } from "@qualidade/lib/registros/codigo-alfanumerico";
import {
  ORIGEM_NOMUS_LABEL,
  RCC_ORIGEM_CLIENTE_INDUSTRIA,
  RCC_ORIGEM_CLIENTE_REVENDEDOR,
  RCC_ORIGEM_RECLAMACAO,
  RCC_SIM_NAO,
  RCC_VENDEDOR_PADRAO,
  rccFieldLabels,
} from "@qualidade/lib/registros/constants";
import {
  clienteErpParaCamposRevendedorRcc,
} from "@qualidade/types/cliente-erp";
import { pessoaErpParaCamposClienteRcc } from "@qualidade/types/pessoa-erp";
import { extrairCodigoProduto } from "@qualidade/types/produto-erp";
import type { RccDados } from "@qualidade/types/rcc";
import { diferencasClienteCadastro, snapshotClienteCadastro } from "@qualidade/types/rcc";
import { rccComAlertaCadastro, dadosAlertaCadastroCliente, montarPreviaAlertaCadastroCliente, resolverCodigoPessoaCliente } from "@qualidade/lib/registros/rcc-alerta-cadastro-cliente";
import {
  isoParaInputDate,
  legadoDasLinhasReclamacao,
  legadoDasLinhasServico,
  normalizarRccDados,
  type RccLinhaReclamacao,
  type RccResponsavelAssistencia,
} from "@qualidade/types/rcc";
import { dataLocalHojeIso, inputDateParaIso, notasFiscaisDistintas } from "@qualidade/types/rnc";
import { criarRncDadosVazio, type RncDados } from "@qualidade/types/rnc";

interface RccFormProps {
  dados: RccDados;
  onChange: (dados: RccDados) => void;
  erros?: Partial<Record<keyof RccDados, string>>;
  disabled?: boolean;
  modo?: "criar" | "visualizar";
  origemNomus?: boolean;
  codigoDocumentoPreview?: string;
  usuarioCriacaoNome?: string;
}

const OPCAO_SELECIONE = "Selecione...";

function valorDaLista(valor: string | null): string {
  if (!valor || valor === OPCAO_SELECIONE) return "";
  return valor;
}

function aplicarLegadoNaPrimeiraLinha(
  linhas: RccLinhaReclamacao[],
  legado: { descricao: string; comentario: string; causa: string }
): RccLinhaReclamacao[] {
  if (linhas.length === 0) return linhas;
  let primeira = linhas[0];
  if (!linhas.some((linha) => (linha.texto ?? "").trim()) && legado.descricao.trim()) {
    primeira = { ...primeira, texto: legado.descricao };
  }
  if (!linhas.some((linha) => (linha.comentario ?? "").trim()) && legado.comentario.trim()) {
    primeira = { ...primeira, comentario: legado.comentario };
  }
  if (!linhas.some((linha) => (linha.causa ?? "").trim()) && legado.causa.trim()) {
    primeira = { ...primeira, causa: legado.causa };
  }
  if (primeira === linhas[0]) return linhas;
  return linhas.map((linha, index) => (index === 0 ? primeira : linha));
}

function ListaComSelecione({ opcoes }: { opcoes: readonly string[] }) {
  return (
    <>
      <SelectItem value={OPCAO_SELECIONE}>{OPCAO_SELECIONE}</SelectItem>
      {opcoes.map((opcao) => (
        <SelectItem key={opcao} value={opcao}>
          {opcao}
        </SelectItem>
      ))}
    </>
  );
}

export function RccForm({
  dados,
  onChange,
  erros = {},
  disabled = false,
  modo = "criar",
  origemNomus = false,
  codigoDocumentoPreview,
  usuarioCriacaoNome = "",
}: RccFormProps) {
  const { hasPermission } = useAuth();
  const podeAlertarCadastro = temAlertaCadastroRcc(hasPermission);
  const dadosRef = useRef(dados);
  dadosRef.current = dados;
  const dataRegistroInicialRef = useRef(false);

  useEffect(() => {
    if (dataRegistroInicialRef.current || modo !== "criar") return;
    dataRegistroInicialRef.current = true;
    if (dadosRef.current.dataRegistroReclamacao.trim()) return;
    const dataRegistroReclamacao = dataLocalHojeIso();
    const next = { ...dadosRef.current, dataRegistroReclamacao };
    dadosRef.current = next;
    onChange(next);
  }, [modo, onChange]);

  function patch(partial: Partial<RccDados>) {
    const next = { ...dadosRef.current, ...partial };
    dadosRef.current = next;
    onChange(next);
  }

  async function abrirPreviaAlerta(reenviar: boolean) {
    setReenviarAlerta(reenviar);
    setObservacaoAlerta("");
    setMensagemAlertaCadastro("");
    setAbrindoPreviaAlerta(true);
    try {
      const codigo = await resolverCodigoPessoaCliente(dadosRef.current);
      if (codigo && codigo !== dadosRef.current.codigoPessoaCliente) {
        const next = { ...dadosRef.current, codigoPessoaCliente: codigo };
        dadosRef.current = next;
        onChange(next);
      }
      setPreviaAlertaAberta(true);
    } catch {
      setPreviaAlertaAberta(true);
    } finally {
      setAbrindoPreviaAlerta(false);
    }
  }

  async function dispararAlertaCadastro(reenviar = false) {
    setEnviandoAlertaCadastro(true);
    setMensagemAlertaCadastro("");
    try {
      const resultado = await rccComAlertaCadastro(dadosRef.current, {
        reenviar,
        observacao: observacaoAlerta,
      });
      const next = {
        ...dadosRef.current,
        codigoPessoaCliente: resultado.rcc.codigoPessoaCliente,
        clienteCorrecaoAlertada: resultado.enviado
          ? resultado.rcc.clienteCorrecaoAlertada
          : dadosRef.current.clienteCorrecaoAlertada,
      };
      dadosRef.current = next;
      onChange(next);
      setMensagemAlertaCadastro(resultado.mensagem);
      if (resultado.enviado) {
        setPreviaAlertaAberta(false);
        setObservacaoAlerta("");
      }
    } catch {
      setMensagemAlertaCadastro(
        "Não foi possível enviar o alerta agora. Tente novamente em instantes."
      );
    } finally {
      setEnviandoAlertaCadastro(false);
    }
  }

  function aplicarGrade(next: RncDados, meta?: { clienteAutomatico?: boolean; codigoPessoa?: string }) {
    const atual = dadosRef.current;
    const trocouPedido = next.temPedidoVenda !== atual.temPedidoVenda;
    const normalizado = normalizarRccDados({
      ...atual,
      temPedidoVenda: next.temPedidoVenda,
      itensProduto: next.itensProduto,
      grupoProduto: next.grupoProduto,
      numeroNf:
        next.temPedidoVenda === "nao"
          ? notasFiscaisDistintas(next.itensProduto)
          : next.notaFiscal,
      numeroPedidoInternoExterno:
        next.temPedidoVenda === "nao" ? "" : atual.numeroPedidoInternoExterno,
    });
    const clienteAutomatico = Boolean(meta?.clienteAutomatico && next.temPedidoVenda === "sim");
    const pronto = {
      ...normalizado,
      codigoPessoaCliente: clienteAutomatico
        ? (meta?.codigoPessoa ?? "").trim()
        : trocouPedido
          ? ""
          : atual.codigoPessoaCliente,
      clienteCadastroOrigem: clienteAutomatico
        ? snapshotClienteCadastro(normalizado)
        : trocouPedido
          ? null
          : atual.clienteCadastroOrigem,
      clienteCorrecaoAlertada:
        clienteAutomatico || trocouPedido ? null : atual.clienteCorrecaoAlertada,
    };
    dadosRef.current = pronto;
    onChange(pronto);
  }

  const somenteLeitura = disabled || modo === "visualizar";
  const [camposVinculadosCliente, setCamposVinculadosCliente] = useState(
    () => dados.clienteCadastroOrigem != null
  );
  const [enviandoAlertaCadastro, setEnviandoAlertaCadastro] = useState(false);
  const [mensagemAlertaCadastro, setMensagemAlertaCadastro] = useState("");
  const [previaAlertaAberta, setPreviaAlertaAberta] = useState(false);
  const [observacaoAlerta, setObservacaoAlerta] = useState("");
  const [reenviarAlerta, setReenviarAlerta] = useState(false);
  const [abrindoPreviaAlerta, setAbrindoPreviaAlerta] = useState(false);

  const ocultarDadosCliente = dados.temPedidoVenda === "sim" && !origemNomus;
  const paraRevendedor = dados.feedbackClienteEnviado === RCC_ORIGEM_CLIENTE_REVENDEDOR;
  const paraIndustriaSemPedido =
    dados.feedbackClienteEnviado === RCC_ORIGEM_CLIENTE_INDUSTRIA &&
    dados.temPedidoVenda === "nao" &&
    !origemNomus;
  const mostrarDadosCliente = (paraRevendedor && !ocultarDadosCliente) || paraIndustriaSemPedido;
  const nomeRevendedorNaGrade = paraRevendedor && dados.temPedidoVenda === "nao" && !origemNomus;
  const rccFinalizada =
    dados.rccFinalizada === "Sim" || dados.rccFinalizada === "Não"
      ? dados.rccFinalizada
      : dados.dataFechamento.trim() ||
          dados.problemaSolucionado === "Sim" ||
          dados.problemaSolucionado === "Não"
        ? "Sim"
        : "";
  const encerrando = rccFinalizada === "Sim";
  const servicoInformado = (dados.linhasServico ?? []).some(
    (linha) => linha.texto.trim() || linha.lista1.trim() || linha.lista2.trim()
  );
  const assistenciaObrigatoria =
    encerrando &&
    Boolean(dados.responsavelAssistencia || dados.funcionarioSolicitado.trim() || servicoInformado);

  const camposClienteAuto =
    camposVinculadosCliente && !somenteLeitura && !origemNomus;
  const correcaoCadastroPendente =
    !somenteLeitura && diferencasClienteCadastro(dados).length > 0;
  const alertaCadastroJaEnviado =
    !somenteLeitura &&
    !correcaoCadastroPendente &&
    diferencasClienteCadastro(dados, { incluirJaAlertadas: true }).length > 0;

  const codigoExibicao =
    dados.codigoProduto?.trim() || extrairCodigoProduto(dados.produto);

  const linhasReclamacaoBase: RccLinhaReclamacao[] =
    dados.linhasReclamacao?.length
      ? dados.linhasReclamacao
      : [
          ...(dados.reclamacao1.trim() ||
          dados.responsavelAnaliseReclamacao.trim() ||
          dados.reclamacaoAceita.trim()
            ? [
                {
                  id: "rec-legado-1",
                  texto: "",
                  lista: dados.reclamacao1,
                  responsavel: dados.responsavelAnaliseReclamacao,
                  aceita: dados.reclamacaoAceita,
                  comentario: "",
                  causa: "",
                  solucao: "",
                },
              ]
            : []),
          ...(dados.reclamacao2.trim()
            ? [
                {
                  id: "rec-legado-2",
                  texto: "",
                  lista: dados.reclamacao2,
                  responsavel: "",
                  aceita: "",
                  comentario: "",
                  causa: "",
                  solucao: "",
                },
              ]
            : []),
        ];
  const linhasReclamacaoTabela = aplicarLegadoNaPrimeiraLinha(linhasReclamacaoBase, {
    descricao: dados.descricaoReclamacao,
    comentario: dados.comentario,
    causa: dados.causaProblema,
  });

  const codigosReclamacao = [
    ...new Set(
      [codigoExibicao, ...(dados.itensProduto ?? []).map((item) => item.codigoProduto.trim())].filter(
        Boolean
      )
    ),
  ];

  const gradeProduto: RncDados = {
    ...criarRncDadosVazio(),
    temPedidoVenda: dados.temPedidoVenda ?? "",
    itensProduto: dados.itensProduto ?? [],
    grupoProduto: dados.grupoProduto,
    tipoProduto:
      (dados.itensProduto ?? []).find((item) => item.tipoProduto.trim())?.tipoProduto ?? "",
    notaFiscal: dados.numeroNf ?? "",
  };

  const mostrarAlertaCadastro =
    podeAlertarCadastro && (correcaoCadastroPendente || alertaCadastroJaEnviado);
  const blocoAlertaCadastro = mostrarAlertaCadastro || mensagemAlertaCadastro ? (
    <div className="space-y-2 sm:col-span-2">
      {mostrarAlertaCadastro ? (
        <Button
          type="button"
          variant={correcaoCadastroPendente ? "default" : "outline"}
          className={
            correcaoCadastroPendente ? "rcc-alerta-disponivel" : "rcc-alerta-enviado"
          }
          disabled={enviandoAlertaCadastro || abrindoPreviaAlerta}
          onClick={() => void abrirPreviaAlerta(alertaCadastroJaEnviado)}
        >
          {enviandoAlertaCadastro ? (
            "Enviando alerta..."
          ) : abrindoPreviaAlerta ? (
            "Abrindo..."
          ) : alertaCadastroJaEnviado ? (
            <>
              <Check />
              Alerta enviado
            </>
          ) : (
            "Avisar correção do cadastro"
          )}
        </Button>
      ) : null}
      {mensagemAlertaCadastro && !previaAlertaAberta ? (
        <p className="text-xs text-muted-foreground">{mensagemAlertaCadastro}</p>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <fieldset className="brand-fieldset space-y-4">
        <legend>Identificação</legend>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table bare className="rcc-identificacao-grade w-max min-w-full">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-40">{rccFieldLabels.codigoDocumento}</TableHead>
                <TableHead className="min-w-44">
                  {rccFieldLabels.dataRegistroReclamacao} *
                </TableHead>
                <TableHead className="min-w-80">{rccFieldLabels.feedbackClienteEnviado} *</TableHead>
                <TableHead className="min-w-44">{rccFieldLabels.usuarioCriacao}</TableHead>
                {origemNomus ? (
                  <>
                    <TableHead className="min-w-40">{rccFieldLabels.dataEmissaoNf}</TableHead>
                    <TableHead className="min-w-32">{rccFieldLabels.numeroNf}</TableHead>
                    <TableHead className="min-w-52">
                      {rccFieldLabels.numeroPedidoInternoExterno}
                    </TableHead>
                  </>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="hover:bg-transparent">
                <TableCell className="align-top">
                  <Input
                    id="rcc-codigo"
                    aria-label={rccFieldLabels.codigoDocumento}
                    value={
                      origemNomus
                        ? dados.codigoDocumento
                        : (codigoDocumentoPreview ?? "Gerado automaticamente ao salvar")
                    }
                    readOnly
                    title={
                      origemNomus
                        ? dados.codigoDocumento
                        : (codigoDocumentoPreview ?? "")
                    }
                    className="campo-copiavel bg-muted/40 font-medium"
                  />
                </TableCell>
                <TableCell className="align-top">
                  <Input
                    id="rcc-data-registro"
                    aria-label={rccFieldLabels.dataRegistroReclamacao}
                    type="date"
                    value={isoParaInputDate(dados.dataRegistroReclamacao)}
                    onChange={(e) =>
                      patch({
                        dataRegistroReclamacao: inputDateParaIso(e.target.value),
                      })
                    }
                    disabled={somenteLeitura}
                    required
                  />
                  <CampoErro mensagem={erros.dataRegistroReclamacao} />
                </TableCell>
                <TableCell className="align-top">
                  <Select
                    value={dados.feedbackClienteEnviado || undefined}
                    onValueChange={(v) => {
                      const origem = valorDaLista(v);
                      const revendedor = origem === RCC_ORIGEM_CLIENTE_REVENDEDOR;
                      patch({
                        feedbackClienteEnviado: origem,
                        clienteDoRevendedor: revendedor,
                        ...(revendedor
                          ? { vendedor: "" }
                          : {
                              nomeRevendedor: "",
                              cidadeRevendedor: "",
                              estadoRevendedor: "",
                              vendedor: RCC_VENDEDOR_PADRAO,
                              nomeClienteConsumidor: "",
                              cidade: "",
                              estado: "",
                              contato: "",
                              telefone: "",
                              bairro: "",
                              endereco: "",
                              pontoReferencia: "",
                              clienteCadastroOrigem: null,
                              clienteCorrecaoAlertada: null,
                              codigoPessoaCliente: "",
                            }),
                      });
                      if (!revendedor) setCamposVinculadosCliente(false);
                    }}
                    disabled={somenteLeitura}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label={rccFieldLabels.feedbackClienteEnviado}
                    >
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <ListaComSelecione opcoes={RCC_ORIGEM_RECLAMACAO} />
                    </SelectContent>
                  </Select>
                  <CampoErro mensagem={erros.feedbackClienteEnviado} />
                </TableCell>
                <TableCell className="align-top">
                  <Input
                    id="rcc-usuario-criacao"
                    aria-label={rccFieldLabels.usuarioCriacao}
                    value={
                      modo === "criar" && !origemNomus
                        ? usuarioCriacaoNome
                        : dados.usuarioCriacao
                    }
                    readOnly
                    title={
                      modo === "criar" && !origemNomus
                        ? usuarioCriacaoNome
                        : dados.usuarioCriacao
                    }
                    className="campo-copiavel bg-muted/40"
                  />
                </TableCell>
                {origemNomus ? (
                  <>
                    <TableCell className="align-top">
                      <Input
                        id="rcc-data-nf"
                        aria-label={rccFieldLabels.dataEmissaoNf}
                        type="date"
                        value={isoParaInputDate(dados.dataEmissaoNf)}
                        onChange={(e) =>
                          patch({ dataEmissaoNf: inputDateParaIso(e.target.value) })
                        }
                        disabled={somenteLeitura}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        id="rcc-numero-nf"
                        aria-label={rccFieldLabels.numeroNf}
                        value={dados.numeroNf ?? ""}
                        onChange={(e) => patch({ numeroNf: e.target.value })}
                        disabled={somenteLeitura}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        id="rcc-numero-pedido"
                        aria-label={rccFieldLabels.numeroPedidoInternoExterno}
                        value={dados.numeroPedidoInternoExterno ?? ""}
                        onChange={(e) =>
                          patch({ numeroPedidoInternoExterno: e.target.value })
                        }
                        disabled={somenteLeitura}
                      />
                    </TableCell>
                  </>
                ) : null}
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          {origemNomus
            ? `Referência do ${ORIGEM_NOMUS_LABEL} — use este código para buscar registros importados.`
            : "O código será atribuído automaticamente (ex.: RCC-0001). A data de registro entra com o dia de hoje e pode ser alterada."}
        </p>
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Produto</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {origemNomus ? (
            <>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="rcc-codigo-produto">
                  {rccFieldLabels.codigoProduto}
                </Label>
                <Input
                  id="rcc-codigo-produto"
                  value={dados.codigoProduto ?? codigoExibicao ?? ""}
                  onChange={(e) => patch({ codigoProduto: e.target.value })}
                  readOnly={somenteLeitura}
                  disabled={somenteLeitura}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="rcc-produto">{rccFieldLabels.produto} *</Label>
                <Input
                  id="rcc-produto"
                  value={dados.produto}
                  onChange={(e) => patch({ produto: e.target.value })}
                  readOnly={somenteLeitura}
                  disabled={somenteLeitura}
                  required
                />
                <CampoErro mensagem={erros.produto} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rcc-quantidade">{rccFieldLabels.quantidade} *</Label>
                <Input
                  id="rcc-quantidade"
                  value={dados.quantidade}
                  onChange={(e) => patch({ quantidade: e.target.value })}
                  readOnly={somenteLeitura}
                  disabled={somenteLeitura}
                />
                <CampoErro mensagem={erros.quantidade} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{rccFieldLabels.possuiNumeroSerie} *</Label>
                <Select
                  value={dados.possuiNumeroSerie || undefined}
                  onValueChange={(valor) => {
                    const resposta = valorDaLista(valor);
                    patch({
                      possuiNumeroSerie: resposta,
                      ...(resposta === "Sim" ? {} : { numeroSerieLoteProduto: "" }),
                    });
                  }}
                  disabled={somenteLeitura}
                >
                  <SelectTrigger className="w-full max-w-md" id="rcc-possui-serie">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <ListaComSelecione opcoes={RCC_SIM_NAO} />
                  </SelectContent>
                </Select>
                <CampoErro mensagem={erros.possuiNumeroSerie} />
              </div>
              {dados.possuiNumeroSerie === "Sim" ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="rcc-serie-lote">{rccFieldLabels.numeroSerieLoteProduto} *</Label>
                  <Input
                    id="rcc-serie-lote"
                    value={codigoAlfanumericoMaiusculo(dados.numeroSerieLoteProduto ?? "")}
                    autoComplete="off"
                    spellCheck={false}
                    className="uppercase"
                    onChange={(e) => {
                      patch({ numeroSerieLoteProduto: codigoAlfanumericoMaiusculo(e.target.value) });
                    }}
                    disabled={somenteLeitura}
                  />
                  <CampoErro mensagem={erros.numeroSerieLoteProduto} />
                </div>
              ) : null}
            </>
          ) : (
            <>
              <RncItensProdutoTable
                dados={gradeProduto}
                disabled={somenteLeitura}
                erro={
                  [
                    erros.temPedidoVenda,
                    erros.itensProduto,
                    erros.quantidade,
                    erros.possuiNumeroSerie,
                    erros.numeroSerieLoteProduto,
                    dados.temPedidoVenda === "sim" ? erros.nomeClienteConsumidor : undefined,
                    nomeRevendedorNaGrade ? erros.nomeRevendedor : undefined,
                  ]
                    .filter(Boolean)
                    .join("\n") || undefined
                }
                quantidadeObrigatoria
                somenteAcabadosIntermediarios
                nomePergunta="rcc-tem-pedido-venda"
                colunaDataEmissaoNf
                colunasClientePedido
                numeroSerie={{
                  possui: dados.possuiNumeroSerie,
                  numero: dados.numeroSerieLoteProduto ?? "",
                  onChange: ({ possui, numero }) =>
                    patch({
                      possuiNumeroSerie: possui,
                      numeroSerieLoteProduto: codigoAlfanumericoMaiusculo(numero),
                    }),
                }}
                nomeRevendedor={
                  nomeRevendedorNaGrade
                    ? {
                        nome: dados.nomeRevendedor ?? "",
                        onChange: (nome) => patch({ nomeRevendedor: nome }),
                        onSelect: (cliente) => {
                          patch(clienteErpParaCamposRevendedorRcc(cliente));
                        },
                      }
                    : undefined
                }
                onChange={aplicarGrade}
              />
            </>
          )}
        </div>
      </fieldset>

      {dados.temPedidoVenda === "sim" && !origemNomus ? (
        <div className="space-y-2">
          <Label htmlFor="rcc-ponto-pedido">{rccFieldLabels.pontoReferencia}</Label>
          <Input
            id="rcc-ponto-pedido"
            value={dados.pontoReferencia}
            onChange={(e) => patch({ pontoReferencia: e.target.value })}
            readOnly={somenteLeitura}
            disabled={somenteLeitura}
          />
          {blocoAlertaCadastro}
        </div>
      ) : null}

      {mostrarDadosCliente ? (
        <fieldset className="brand-fieldset space-y-4">
          <legend>Cliente consumidor</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              {somenteLeitura ? (
                <>
                  <Label htmlFor="rcc-cliente">
                    {rccFieldLabels.nomeClienteConsumidor} *
                  </Label>
                  <Input
                    id="rcc-cliente"
                    value={dados.nomeClienteConsumidor}
                    readOnly
                    className="campo-copiavel bg-muted/40"
                  />
                </>
              ) : camposClienteAuto ? (
                <CampoClienteLapis
                  id="rcc-cliente"
                  label={`${rccFieldLabels.nomeClienteConsumidor} *`}
                  value={dados.nomeClienteConsumidor}
                  bloqueado
                  onChange={(nome) => patch({ nomeClienteConsumidor: nome })}
                />
              ) : (
                <PessoaSearchField
                  id="rcc-cliente"
                  label={`${rccFieldLabels.nomeClienteConsumidor} *`}
                  value={dados.nomeClienteConsumidor}
                  placeholder="Digite o nome da pessoa..."
                  descricao="Busca pessoas ativas cadastradas no Nomus. Cidade, contato, telefone, bairro e endereço entram com o cadastro. O lápis corrige só esta RCC."
                  onValueChange={(nome) => {
                    if (nome.trim()) {
                      patch({ nomeClienteConsumidor: nome });
                      return;
                    }
                    patch({
                      nomeClienteConsumidor: "",
                      cidade: "",
                      estado: "",
                      contato: "",
                      telefone: "",
                      bairro: "",
                      endereco: "",
                      pontoReferencia: "",
                      clienteCadastroOrigem: null,
                      clienteCorrecaoAlertada: null,
                      codigoPessoaCliente: "",
                    });
                    setCamposVinculadosCliente(false);
                  }}
                  onPessoaSelect={(pessoa) => {
                    const campos = pessoaErpParaCamposClienteRcc(pessoa);
                    patch({
                      ...campos,
                      codigoPessoaCliente: pessoa.id,
                      clienteCadastroOrigem: snapshotClienteCadastro(campos),
                      clienteCorrecaoAlertada: null,
                    });
                    setCamposVinculadosCliente(true);
                    setMensagemAlertaCadastro("");
                  }}
                  disabled={somenteLeitura}
                />
              )}
              <CampoErro mensagem={erros.nomeClienteConsumidor} />
            </div>

            <CampoClienteLapis
              id="rcc-cidade"
              label={rccFieldLabels.cidade}
              value={dados.cidade}
              bloqueado={camposClienteAuto}
              disabled={somenteLeitura}
              onChange={(cidade) => patch({ cidade })}
            />
            <CampoClienteLapis
              id="rcc-estado"
              label={rccFieldLabels.estado}
              value={dados.estado}
              bloqueado={camposClienteAuto}
              disabled={somenteLeitura}
              maxLength={2}
              placeholder="UF"
              onChange={(estado) => patch({ estado: estado.toUpperCase() })}
            />
            <CampoClienteLapis
              id="rcc-contato"
              label={rccFieldLabels.contato}
              value={dados.contato}
              bloqueado={camposClienteAuto}
              disabled={somenteLeitura}
              onChange={(contato) => patch({ contato })}
            />
            <CampoClienteLapis
              id="rcc-telefone"
              label={rccFieldLabels.telefone}
              value={dados.telefone}
              bloqueado={camposClienteAuto}
              disabled={somenteLeitura}
              onChange={(telefone) => patch({ telefone })}
            />
            <CampoClienteLapis
              id="rcc-bairro"
              label={rccFieldLabels.bairro}
              value={dados.bairro}
              bloqueado={camposClienteAuto}
              disabled={somenteLeitura}
              onChange={(bairro) => patch({ bairro })}
            />
            <CampoClienteLapis
              id="rcc-endereco"
              label={rccFieldLabels.endereco}
              value={dados.endereco}
              bloqueado={camposClienteAuto}
              disabled={somenteLeitura}
              onChange={(endereco) => patch({ endereco })}
            />
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rcc-ponto">{rccFieldLabels.pontoReferencia}</Label>
              <Input
                id="rcc-ponto"
                value={dados.pontoReferencia}
                onChange={(e) => patch({ pontoReferencia: e.target.value })}
                readOnly={somenteLeitura}
                disabled={somenteLeitura}
              />
            </div>
            {blocoAlertaCadastro}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="brand-fieldset space-y-4">
        <legend>Reclamação e análise de causa</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <RccReclamacoesTable
            erroDescricao={erros.descricaoReclamacao}
            erroCategoria={erros.reclamacao1}
            erroAceita={erros.reclamacaoAceita}
            erroCausa={erros.causaProblema}
            exigirEncerramento={encerrando}
            linhas={linhasReclamacaoTabela}
            codigosProduto={codigosReclamacao}
            disabled={somenteLeitura}
            origemNomus={origemNomus}
            onChange={(linhasReclamacao) => {
              patch({
                linhasReclamacao,
                ...legadoDasLinhasReclamacao(linhasReclamacao),
              });
            }}
          />
        </div>
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Fabricação e garantia</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{rccFieldLabels.produtoNossaFabricacao} *</Label>
            <Select
              value={dados.produtoNossaFabricacao || undefined}
              onValueChange={(v) => patch({ produtoNossaFabricacao: valorDaLista(v) })}
              disabled={somenteLeitura}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <ListaComSelecione opcoes={RCC_SIM_NAO} />
              </SelectContent>
            </Select>
            <CampoErro mensagem={erros.produtoNossaFabricacao} />
          </div>

          <div className="space-y-2">
            <Label>{rccFieldLabels.produtoDentroGarantia} *</Label>
            <Select
              value={dados.produtoDentroGarantia || undefined}
              onValueChange={(v) => patch({ produtoDentroGarantia: valorDaLista(v) })}
              disabled={somenteLeitura}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <ListaComSelecione opcoes={RCC_SIM_NAO} />
              </SelectContent>
            </Select>
            <CampoErro mensagem={erros.produtoDentroGarantia} />
          </div>
        </div>
      </fieldset>

      {paraRevendedor && mostrarDadosCliente && !nomeRevendedorNaGrade ? (
        <fieldset className="brand-fieldset space-y-4">
          <legend>Revendedor</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              {!somenteLeitura && !origemNomus ? (
                <ClienteSearchField
                  id="rcc-revendedor"
                  label={`${rccFieldLabels.nomeRevendedor} *`}
                  value={dados.nomeRevendedor ?? ""}
                  onValueChange={(nome) => patch({ nomeRevendedor: nome })}
                  onClienteSelect={(cliente) => {
                    patch(clienteErpParaCamposRevendedorRcc(cliente));
                  }}
                  disabled={somenteLeitura}
                />
              ) : !somenteLeitura ? (
                <>
                  <Label htmlFor="rcc-revendedor">
                    {rccFieldLabels.nomeRevendedor} *
                  </Label>
                  <Input
                    id="rcc-revendedor"
                    value={dados.nomeRevendedor ?? ""}
                    onChange={(e) => patch({ nomeRevendedor: e.target.value })}
                  />
                </>
              ) : (
                <>
                  <Label htmlFor="rcc-revendedor">
                    {rccFieldLabels.nomeRevendedor} *
                  </Label>
                  <Input
                    id="rcc-revendedor"
                    value={dados.nomeRevendedor ?? ""}
                    readOnly={somenteLeitura}
                    className={somenteLeitura ? "campo-copiavel bg-muted/40" : undefined}
                  />
                </>
              )}
              <CampoErro mensagem={erros.nomeRevendedor} />
            </div>
          </div>
        </fieldset>
      ) : null}

      <fieldset className="brand-fieldset space-y-4">
        <legend>Serviço realizado</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {origemNomus ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rcc-funcionario">{rccFieldLabels.funcionarioSolicitado}</Label>
              <Input
                id="rcc-funcionario"
                value={dados.funcionarioSolicitado}
                readOnly
                disabled={somenteLeitura}
                className="bg-muted/40"
              />
            </div>
          ) : (
            <>
              <div className="space-y-2 sm:col-span-2">
                <Label>
                  {rccFieldLabels.responsavelAssistencia}
                  {assistenciaObrigatoria ? " *" : ""}
                </Label>
                <Select
                  value={dados.responsavelAssistencia || undefined}
                  onValueChange={(valor) => {
                    const tipo = valorDaLista(valor);
                    const responsavelAssistencia: RccResponsavelAssistencia =
                      tipo === "Funcionário interno" || tipo === "Terceirizado" ? tipo : "";
                    const trocouTipo =
                      responsavelAssistencia !== dados.responsavelAssistencia &&
                      dados.responsavelAssistencia !== "";
                    const externo = responsavelAssistencia === "Terceirizado";
                    const linhasSemHorario = (dados.linhasServico ?? []).map((linha) => ({
                      ...linha,
                      horaSaidaEmpresa: "",
                      horaChegadaEmpresa: "",
                    }));
                    patch({
                      responsavelAssistencia,
                      ...(trocouTipo ? { funcionarioSolicitado: "" } : {}),
                      ...(externo
                        ? {
                            linhasServico: linhasSemHorario,
                            ...legadoDasLinhasServico(linhasSemHorario),
                          }
                        : {}),
                    });
                  }}
                  disabled={somenteLeitura}
                >
                  <SelectTrigger className="w-full max-w-md" id="rcc-resp-assistencia">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OPCAO_SELECIONE}>{OPCAO_SELECIONE}</SelectItem>
                    <SelectItem value="Funcionário interno">Funcionário interno</SelectItem>
                    <SelectItem value="Terceirizado">Terceirizado</SelectItem>
                  </SelectContent>
                </Select>
                <CampoErro mensagem={erros.responsavelAssistencia} />
              </div>
              {dados.responsavelAssistencia === "Funcionário interno" ? (
                <div className="sm:col-span-2">
                  <OrganicoResponsavelField
                    id="rcc-funcionario-interno"
                    label={assistenciaObrigatoria ? "Funcionário interno *" : "Funcionário interno"}
                    value={dados.funcionarioSolicitado}
                    onValueChange={(nome) => patch({ funcionarioSolicitado: nome })}
                    disabled={somenteLeitura}
                  />
                  <CampoErro mensagem={erros.funcionarioSolicitado} />
                </div>
              ) : null}
              {dados.responsavelAssistencia === "Terceirizado" ? (
                <div className="sm:col-span-2">
                  <PessoaSearchField
                    id="rcc-funcionario-externo"
                    label={assistenciaObrigatoria ? "Terceirizado *" : "Terceirizado"}
                    value={dados.funcionarioSolicitado}
                    onValueChange={(nome) => patch({ funcionarioSolicitado: nome })}
                    placeholder="Digite o nome do parceiro..."
                    apenasParceiros
                    disabled={somenteLeitura}
                  />
                  <CampoErro mensagem={erros.funcionarioSolicitado} />
                </div>
              ) : null}
              {!dados.responsavelAssistencia && dados.funcionarioSolicitado.trim() ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="rcc-funcionario-legado">
                    {rccFieldLabels.funcionarioSolicitado}
                  </Label>
                  <Input
                    id="rcc-funcionario-legado"
                    value={dados.funcionarioSolicitado}
                    readOnly
                    className="campo-copiavel bg-muted/40"
                  />
                </div>
              ) : null}
            </>
          )}

          {origemNomus || dados.responsavelAssistencia ? (
            <RccServicosTable
              linhas={dados.linhasServico ?? []}
              codigosProduto={codigosReclamacao}
              disabled={somenteLeitura}
              ocultarHorariosEmpresa={dados.responsavelAssistencia === "Terceirizado"}
              erro={erros.servicoRealizado}
              obrigatorio={assistenciaObrigatoria}
              onChange={(linhasServico) =>
                patch({
                  linhasServico,
                  ...legadoDasLinhasServico(linhasServico),
                })
              }
            />
          ) : null}
        </div>
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Status da RCC</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>{rccFieldLabels.rccFinalizada}</Label>
            <Select
              value={rccFinalizada || undefined}
              onValueChange={(valor) => {
                const resposta = valorDaLista(valor);
                if (resposta === "Sim") {
                  patch({
                    rccFinalizada: "Sim",
                    dataFechamento: dados.dataFechamento.trim()
                      ? dados.dataFechamento
                      : dataLocalHojeIso(),
                  });
                  return;
                }
                patch({
                  rccFinalizada: resposta === "Não" ? "Não" : "",
                  dataFechamento: "",
                  problemaSolucionado: "",
                });
              }}
              disabled={somenteLeitura}
            >
              <SelectTrigger className="w-full max-w-md" id="rcc-finalizada">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <ListaComSelecione opcoes={RCC_SIM_NAO} />
              </SelectContent>
            </Select>
          </div>
          {encerrando ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="rcc-data-fechamento">{rccFieldLabels.dataFechamento} *</Label>
                <Input
                  id="rcc-data-fechamento"
                  type="date"
                  value={isoParaInputDate(dados.dataFechamento)}
                  onChange={(event) =>
                    patch({
                      dataFechamento: event.target.value
                        ? `${event.target.value}T12:00:00.000Z`
                        : "",
                    })
                  }
                  disabled={somenteLeitura}
                />
                <CampoErro mensagem={erros.dataFechamento} />
              </div>
              <div className="space-y-2">
                <Label>{rccFieldLabels.problemaSolucionado} *</Label>
                <Select
                  value={dados.problemaSolucionado || undefined}
                  onValueChange={(valor) => patch({ problemaSolucionado: valorDaLista(valor) })}
                  disabled={somenteLeitura}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <ListaComSelecione opcoes={RCC_SIM_NAO} />
                  </SelectContent>
                </Select>
                <CampoErro mensagem={erros.problemaSolucionado} />
              </div>
            </>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Evidências</legend>
        <RegistroAnexosTable
          anexos={dados.anexos ?? []}
          onChange={(anexos) => patch({ anexos })}
          disabled={somenteLeitura}
          comTitulo
          tituloObrigatorio
          erroTitulo={erros.anexos}
        />
      </fieldset>

      <Dialog
        open={previaAlertaAberta}
        onOpenChange={(aberto) => {
          if (enviandoAlertaCadastro) return;
          setPreviaAlertaAberta(aberto);
        }}
      >
        <DialogContent showCloseButton={false} className="max-w-lg gap-0 p-0">
          <FormModalHeader
            titulo="Pré-visualizar alerta"
            descricao="Confira a mensagem antes de enviar. A observação é opcional e aparece no final."
            closeDisabled={enviandoAlertaCadastro}
            onClose={() => {
              if (!enviandoAlertaCadastro) setPreviaAlertaAberta(false);
            }}
          />
          <div className="space-y-4 px-7 py-5">
            {reenviarAlerta ? (
              <p className="text-sm">
                Este alerta já foi enviado. Deseja enviar novamente?
              </p>
            ) : null}
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 font-sans text-sm leading-relaxed">
              {montarPreviaAlertaCadastroCliente(
                dadosAlertaCadastroCliente(dados, reenviarAlerta),
                observacaoAlerta
              )}
            </pre>
            <div className="space-y-2">
              <Label htmlFor="rcc-alerta-observacao">Observação</Label>
              <Textarea
                id="rcc-alerta-observacao"
                value={observacaoAlerta}
                maxLength={500}
                rows={3}
                placeholder="Opcional"
                disabled={enviandoAlertaCadastro}
                onChange={(event) => setObservacaoAlerta(event.target.value)}
              />
            </div>
            {mensagemAlertaCadastro ? (
              <p className="text-sm text-muted-foreground">{mensagemAlertaCadastro}</p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={enviandoAlertaCadastro}
                onClick={() => setPreviaAlertaAberta(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={enviandoAlertaCadastro}
                onClick={() => void dispararAlertaCadastro(reenviarAlerta)}
              >
                {enviandoAlertaCadastro
                  ? "Enviando..."
                  : reenviarAlerta
                    ? "Enviar novamente"
                    : "Enviar alerta"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
