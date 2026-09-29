import { useEffect, useRef, useState } from "react";
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
import { ClienteSearchField } from "@qualidade/components/registros/cliente-search-field";
import { OrganicoResponsavelField } from "@qualidade/components/registros/organico-responsavel-field";
import { PessoaSearchField } from "@qualidade/components/registros/pessoa-search-field";
import { RccReclamacoesTable } from "@qualidade/components/registros/rcc-reclamacoes-table";
import { RccServicosTable } from "@qualidade/components/registros/rcc-servicos-table";
import { RncItensProdutoTable } from "@qualidade/components/registros/rnc-itens-produto-table";
import { RegistroAnexosTable } from "@qualidade/components/registros/registro-anexos-table";
import {
  ORIGEM_NOMUS_LABEL,
  RCC_SIM_NAO,
  RCC_VENDEDOR_PADRAO,
  rccFieldLabels,
} from "@qualidade/lib/registros/constants";
import {
  clienteErpParaCamposRcc,
  clienteErpParaCamposRevendedorRcc,
} from "@qualidade/types/cliente-erp";
import { extrairCodigoProduto } from "@qualidade/types/produto-erp";
import type { RccDados } from "@qualidade/types/rcc";
import {
  isoParaInputDate,
  legadoDasLinhasReclamacao,
  legadoDasLinhasServico,
  normalizarRccDados,
  type RccLinhaReclamacao,
  type RccResponsavelAssistencia,
} from "@qualidade/types/rcc";
import { dataLocalHojeIso, inputDateParaIso } from "@qualidade/types/rnc";
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

function CampoErro({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null;
  return (
    <p className="text-xs text-destructive" role="alert">
      {mensagem}
    </p>
  );
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

  function aplicarGrade(next: RncDados) {
    const atual = dadosRef.current;
    const normalizado = normalizarRccDados({
      ...atual,
      temPedidoVenda: next.temPedidoVenda,
      itensProduto: next.itensProduto,
      grupoProduto: next.grupoProduto,
      numeroNf: next.temPedidoVenda === "nao" ? "" : next.notaFiscal,
      numeroPedidoInternoExterno:
        next.temPedidoVenda === "nao" ? "" : atual.numeroPedidoInternoExterno,
    });
    dadosRef.current = normalizado;
    onChange(normalizado);
  }

  const somenteLeitura = disabled || modo === "visualizar";
  const [camposVinculadosCliente, setCamposVinculadosCliente] = useState(false);
  const [camposVinculadosRevendedor, setCamposVinculadosRevendedor] =
    useState(false);

  const pedidoVinculado = (dados.itensProduto ?? []).some((item) => item.pedidoId.trim());
  const ocultarDadosCliente = dados.temPedidoVenda === "sim" && !origemNomus;
  const mostrarDadosCliente =
    dados.feedbackClienteEnviado === "Sim" && !ocultarDadosCliente;
  const encerrando = Boolean(dados.dataFechamento.trim());
  const servicoInformado = (dados.linhasServico ?? []).some(
    (linha) => linha.texto.trim() || linha.lista1.trim() || linha.lista2.trim()
  );
  const assistenciaObrigatoria =
    encerrando &&
    Boolean(dados.responsavelAssistencia || dados.funcionarioSolicitado.trim() || servicoInformado);

  const usarBuscaCliente =
    !somenteLeitura && !dados.clienteDoRevendedor && !pedidoVinculado;

  const camposClienteAuto =
    (camposVinculadosCliente || pedidoVinculado) &&
    !dados.clienteDoRevendedor &&
    !somenteLeitura &&
    !origemNomus;

  const camposRevendedorAuto =
    camposVinculadosRevendedor && !somenteLeitura && !origemNomus;

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
                <TableHead className="min-w-44">{rccFieldLabels.feedbackClienteEnviado} *</TableHead>
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
                    onValueChange={(v) =>
                      patch({ feedbackClienteEnviado: valorDaLista(v) })
                    }
                    disabled={somenteLeitura}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label={rccFieldLabels.feedbackClienteEnviado}
                    >
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <ListaComSelecione opcoes={RCC_SIM_NAO} />
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
                    value={(dados.numeroSerieLoteProduto ?? "").replace(/\D/g, "")}
                    inputMode="numeric"
                    autoComplete="off"
                    onChange={(e) => {
                      const numero = e.target.value.replace(/\D/g, "");
                      e.target.value = numero;
                      patch({ numeroSerieLoteProduto: numero });
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
                  ]
                    .filter(Boolean)
                    .join("\n") || undefined
                }
                quantidadeObrigatoria
                nomePergunta="rcc-tem-pedido-venda"
                colunaDataEmissaoNf
                colunasClientePedido
                numeroSerie={{
                  possui: dados.possuiNumeroSerie,
                  numero: dados.numeroSerieLoteProduto ?? "",
                  onChange: ({ possui, numero }) =>
                    patch({
                      possuiNumeroSerie: possui,
                      numeroSerieLoteProduto: numero.replace(/\D/g, ""),
                    }),
                }}
                onChange={aplicarGrade}
              />
            </>
          )}
        </div>
      </fieldset>

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
        <legend>{mostrarDadosCliente ? "Cliente" : "Fabricação e garantia"}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {mostrarDadosCliente && !somenteLeitura ? (
            <div className="sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input accent-brand-blue"
                  checked={dados.clienteDoRevendedor}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    patch({
                      clienteDoRevendedor: checked,
                      ...(checked
                        ? {
                            vendedor: "",
                          }
                        : {
                            nomeRevendedor: "",
                            cidadeRevendedor: "",
                            estadoRevendedor: "",
                            vendedor: RCC_VENDEDOR_PADRAO,
                          }),
                    });
                    setCamposVinculadosCliente(false);
                    if (!checked) setCamposVinculadosRevendedor(false);
                  }}
                />
                {rccFieldLabels.clienteDoRevendedor}
              </label>
            </div>
          ) : null}
          {mostrarDadosCliente && somenteLeitura && dados.clienteDoRevendedor ? (
            <div className="sm:col-span-2">
              <p className="text-sm text-muted-foreground">
                {rccFieldLabels.clienteDoRevendedor}: Sim
              </p>
            </div>
          ) : null}

          {mostrarDadosCliente ? (
          <>
          <div className="space-y-2 sm:col-span-2">
            {usarBuscaCliente ? (
              <ClienteSearchField
                id="rcc-cliente"
                label={`${rccFieldLabels.nomeClienteConsumidor} *`}
                value={dados.nomeClienteConsumidor}
                onValueChange={(nome) =>
                  patch({ nomeClienteConsumidor: nome })
                }
                onClienteSelect={(cliente) => {
                  patch(clienteErpParaCamposRcc(cliente));
                  setCamposVinculadosCliente(true);
                }}
                onVinculoClear={() => setCamposVinculadosCliente(false)}
                disabled={somenteLeitura}
              />
            ) : (
              <>
                <Label htmlFor="rcc-cliente">
                  {rccFieldLabels.nomeClienteConsumidor} *
                </Label>
                <Input
                  id="rcc-cliente"
                  value={dados.nomeClienteConsumidor}
                  onChange={(e) =>
                    patch({ nomeClienteConsumidor: e.target.value })
                  }
                  readOnly={somenteLeitura}
                  disabled={somenteLeitura}
                  className={somenteLeitura ? "bg-muted/40" : undefined}
                  required
                />
              </>
            )}
            <CampoErro mensagem={erros.nomeClienteConsumidor} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rcc-cidade">{rccFieldLabels.cidade} *</Label>
            <Input
              id="rcc-cidade"
              value={dados.cidade}
              onChange={(e) => patch({ cidade: e.target.value })}
              readOnly={somenteLeitura || camposClienteAuto}
              className={
                somenteLeitura || camposClienteAuto
                  ? "campo-copiavel bg-muted/40"
                  : undefined
              }
            />
            <CampoErro mensagem={erros.cidade} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rcc-estado">{rccFieldLabels.estado}</Label>
            <Input
              id="rcc-estado"
              value={dados.estado}
              onChange={(e) =>
                patch({ estado: e.target.value.toUpperCase() })
              }
              readOnly={somenteLeitura || camposClienteAuto}
              className={
                somenteLeitura || camposClienteAuto
                  ? "campo-copiavel bg-muted/40"
                  : undefined
              }
              maxLength={2}
              placeholder="UF"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rcc-contato">{rccFieldLabels.contato}</Label>
            <Input
              id="rcc-contato"
              value={dados.contato}
              onChange={(e) => patch({ contato: e.target.value })}
              readOnly={somenteLeitura || camposClienteAuto}
              className={
                somenteLeitura || camposClienteAuto
                  ? "campo-copiavel bg-muted/40"
                  : undefined
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rcc-telefone">{rccFieldLabels.telefone} *</Label>
            <Input
              id="rcc-telefone"
              value={dados.telefone}
              onChange={(e) => patch({ telefone: e.target.value })}
              readOnly={somenteLeitura || camposClienteAuto}
              className={
                somenteLeitura || camposClienteAuto
                  ? "campo-copiavel bg-muted/40"
                  : undefined
              }
            />
            <CampoErro mensagem={erros.telefone} />
          </div>

          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="rcc-bairro">{rccFieldLabels.bairro}</Label>
              <Input
                id="rcc-bairro"
                value={dados.bairro}
                onChange={(e) => patch({ bairro: e.target.value })}
                readOnly={somenteLeitura || camposClienteAuto}
                className={
                  somenteLeitura || camposClienteAuto
                    ? "campo-copiavel bg-muted/40"
                    : undefined
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rcc-endereco">{rccFieldLabels.endereco}</Label>
              <Input
                id="rcc-endereco"
                value={dados.endereco}
                onChange={(e) => patch({ endereco: e.target.value })}
                readOnly={somenteLeitura || camposClienteAuto}
                className={
                  somenteLeitura || camposClienteAuto
                    ? "campo-copiavel bg-muted/40"
                    : undefined
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rcc-ponto-ref">
                {rccFieldLabels.pontoReferencia}
              </Label>
              <Input
                id="rcc-ponto-ref"
                value={dados.pontoReferencia}
                onChange={(e) => patch({ pontoReferencia: e.target.value })}
                readOnly={somenteLeitura}
                disabled={somenteLeitura}
                className={somenteLeitura ? "bg-muted/40" : undefined}
              />
            </div>
          </div>
          </>
          ) : null}

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

      {dados.clienteDoRevendedor && mostrarDadosCliente ? (
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
                    setCamposVinculadosRevendedor(true);
                  }}
                  onVinculoClear={() => setCamposVinculadosRevendedor(false)}
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

            <div className="space-y-2">
              <Label htmlFor="rcc-cidade-revendedor">
                {rccFieldLabels.cidadeRevendedor}
              </Label>
              <Input
                id="rcc-cidade-revendedor"
                value={dados.cidadeRevendedor ?? ""}
                onChange={(e) => patch({ cidadeRevendedor: e.target.value })}
                readOnly={somenteLeitura || camposRevendedorAuto}
                className={
                  somenteLeitura || camposRevendedorAuto
                    ? "campo-copiavel bg-muted/40"
                    : undefined
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rcc-estado-revendedor">
                {rccFieldLabels.estadoRevendedor}
              </Label>
              <Input
                id="rcc-estado-revendedor"
                value={dados.estadoRevendedor ?? ""}
                onChange={(e) =>
                  patch({ estadoRevendedor: e.target.value.toUpperCase() })
                }
                readOnly={somenteLeitura || camposRevendedorAuto}
                className={
                  somenteLeitura || camposRevendedorAuto
                    ? "campo-copiavel bg-muted/40"
                    : undefined
                }
                maxLength={2}
                placeholder="UF"
              />
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
                      tipo === "Funcionário interno" || tipo === "Funcionário externo" ? tipo : "";
                    const trocouTipo =
                      responsavelAssistencia !== dados.responsavelAssistencia &&
                      dados.responsavelAssistencia !== "";
                    const externo = responsavelAssistencia === "Funcionário externo";
                    const linhasSemHorario = (dados.linhasServico ?? []).map((linha) => ({
                      ...linha,
                      horaSaidaEmpresa: "",
                      horaChegadaEmpresa: "",
                      horaChegadaCliente: "",
                      horaSaidaCliente: "",
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
                    <SelectItem value="Funcionário externo">Funcionário externo</SelectItem>
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
                    apenasAssistenteTecnico
                    disabled={somenteLeitura}
                  />
                  <CampoErro mensagem={erros.funcionarioSolicitado} />
                </div>
              ) : null}
              {dados.responsavelAssistencia === "Funcionário externo" ? (
                <div className="sm:col-span-2">
                  <PessoaSearchField
                    id="rcc-funcionario-externo"
                    label={assistenciaObrigatoria ? "Funcionário externo *" : "Funcionário externo"}
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
              ocultarHorarios={dados.responsavelAssistencia === "Funcionário externo"}
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
          <div className="space-y-2">
            <Label htmlFor="rcc-data-fechamento">
              {rccFieldLabels.dataFechamento}
              {dados.problemaSolucionado === "Sim" ? " *" : ""}
            </Label>
            <Input
              id="rcc-data-fechamento"
              type="date"
              value={isoParaInputDate(dados.dataFechamento)}
              onChange={(event) =>
                patch({
                  dataFechamento: event.target.value ? `${event.target.value}T12:00:00.000Z` : "",
                })
              }
              disabled={somenteLeitura}
            />
            <CampoErro mensagem={erros.dataFechamento} />
          </div>
          <div className="space-y-2">
            <Label>
              {rccFieldLabels.problemaSolucionado}
              {encerrando ? " *" : ""}
            </Label>
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
        </div>
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Evidências</legend>
        <RegistroAnexosTable
          anexos={dados.anexos ?? []}
          onChange={(anexos) => patch({ anexos })}
          disabled={somenteLeitura}
        />
      </fieldset>
    </div>
  );
}
