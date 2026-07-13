import { useState } from "react";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qualidade/components/ui/select";
import { Textarea } from "@qualidade/components/ui/textarea";
import { ClienteSearchField } from "@qualidade/components/registros/cliente-search-field";
import { OpcaoListaPesquisavelField } from "@qualidade/components/registros/opcao-lista-pesquisavel-field";
import { PedidoVendaSearchField } from "@qualidade/components/registros/pedido-venda-search-field";
import { ProdutoCodigoField } from "@qualidade/components/registros/produto-codigo-field";
import { RegistroAnexosTable } from "@qualidade/components/registros/registro-anexos-table";
import {
  ORIGEM_NOMUS_LABEL,
  RCC_CAUSAS_PROBLEMA,
  RCC_RECLAMACOES,
  RCC_SERVICOS_REALIZADOS,
  RCC_SIM_NAO,
  RCC_VENDEDOR_PADRAO,
  rccFieldLabels,
} from "@qualidade/lib/registros/constants";
import {
  RCC_RECLAMACOES_OPCOES_STORAGE_KEY,
  RCC_SERVICOS_OPCOES_STORAGE_KEY,
} from "@qualidade/lib/registros/opcoes-lista-customizadas";
import {
  clienteErpParaCamposRcc,
  clienteErpParaCamposRevendedorRcc,
} from "@qualidade/types/cliente-erp";
import {
  extrairCodigoProduto,
  produtoErpParaCamposRcc,
} from "@qualidade/types/produto-erp";
import { pedidoVendaErpParaCamposRcc } from "@qualidade/types/pedido-venda-erp";
import type { RccDados } from "@qualidade/types/rcc";
import { isoParaInputDate } from "@qualidade/types/rcc";

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
  function patch(partial: Partial<RccDados>) {
    onChange({ ...dados, ...partial });
  }

  const somenteLeitura = disabled || modo === "visualizar";
  const [camposVinculadosProduto, setCamposVinculadosProduto] = useState(
    Boolean(dados.codigoProduto?.trim())
  );
  const [camposVinculadosCliente, setCamposVinculadosCliente] = useState(false);
  const [camposVinculadosRevendedor, setCamposVinculadosRevendedor] =
    useState(false);
  const [pedidoInterno, setPedidoInterno] = useState(false);
  const [camposVinculadosPedido, setCamposVinculadosPedido] = useState(false);

  const camposProdutoAuto =
    camposVinculadosProduto && !somenteLeitura && !origemNomus;

  const usarBuscaCliente =
    !somenteLeitura && !dados.clienteDoRevendedor && !camposVinculadosPedido;

  const camposClienteAuto =
    (camposVinculadosCliente || camposVinculadosPedido) &&
    !dados.clienteDoRevendedor &&
    !somenteLeitura &&
    !origemNomus;

  const camposRevendedorAuto =
    camposVinculadosRevendedor && !somenteLeitura && !origemNomus;

  const codigoExibicao =
    dados.codigoProduto?.trim() || extrairCodigoProduto(dados.produto);

  return (
    <div className="space-y-6">
      <fieldset className="brand-fieldset space-y-4">
        <legend>Identificação</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rcc-codigo">{rccFieldLabels.codigoDocumento}</Label>
            {origemNomus ? (
              <div className="space-y-1">
                <Input
                  id="rcc-codigo"
                  value={dados.codigoDocumento}
                  readOnly
                  disabled
                  className="bg-muted/40 font-medium"
                />
                <p className="text-xs text-muted-foreground">
                  Referência do {ORIGEM_NOMUS_LABEL} — use este código para
                  buscar registros importados.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <Input
                  id="rcc-codigo"
                  value={
                    codigoDocumentoPreview ?? "Gerado automaticamente ao salvar"
                  }
                  readOnly
                  disabled
                  className="bg-muted/40"
                />
                <p className="text-xs text-muted-foreground">
                  O código será atribuído automaticamente (ex.: RCC-0001).
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rcc-data-registro">
              {rccFieldLabels.dataRegistroReclamacao} *
            </Label>
            <Input
              id="rcc-data-registro"
              type="date"
              value={isoParaInputDate(dados.dataRegistroReclamacao)}
              onChange={(e) =>
                patch({
                  dataRegistroReclamacao: e.target.value
                    ? `${e.target.value}T12:00:00.000Z`
                    : "",
                })
              }
              disabled={somenteLeitura}
              required
            />
            <CampoErro mensagem={erros.dataRegistroReclamacao} />
          </div>

          <div className="space-y-2">
            <Label>{rccFieldLabels.feedbackClienteEnviado}</Label>
            <Select
              value={dados.feedbackClienteEnviado || undefined}
              onValueChange={(v) => v && patch({ feedbackClienteEnviado: v })}
              disabled={somenteLeitura}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {RCC_SIM_NAO.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {opcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rcc-usuario-criacao">
              {rccFieldLabels.usuarioCriacao}
            </Label>
            <Input
              id="rcc-usuario-criacao"
              value={
                modo === "criar" && !origemNomus
                  ? usuarioCriacaoNome
                  : dados.usuarioCriacao
              }
              readOnly
              disabled
              className="bg-muted/40"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rcc-data-nf">{rccFieldLabels.dataEmissaoNf}</Label>
            <Input
              id="rcc-data-nf"
              type="date"
              value={isoParaInputDate(dados.dataEmissaoNf)}
              onChange={(e) =>
                patch({
                  dataEmissaoNf: e.target.value
                    ? `${e.target.value}T12:00:00.000Z`
                    : "",
                })
              }
              disabled={somenteLeitura}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rcc-numero-nf">{rccFieldLabels.numeroNf}</Label>
            <Input
              id="rcc-numero-nf"
              value={dados.numeroNf ?? ""}
              onChange={(e) => patch({ numeroNf: e.target.value })}
              disabled={somenteLeitura}
            />
          </div>

          <div className="space-y-3 sm:col-span-2">
            {!somenteLeitura && !origemNomus ? (
              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input accent-brand-blue"
                  checked={pedidoInterno}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setPedidoInterno(checked);
                    setCamposVinculadosPedido(false);
                    setCamposVinculadosCliente(false);
                    if (!checked) {
                      patch({ numeroPedidoInternoExterno: "" });
                    }
                  }}
                />
                Pedido interno?
              </label>
            ) : null}

            {pedidoInterno && !somenteLeitura && !origemNomus ? (
              <PedidoVendaSearchField
                id="rcc-numero-pedido"
                label={rccFieldLabels.numeroPedidoInternoExterno}
                value={dados.numeroPedidoInternoExterno ?? ""}
                onValueChange={(numero) =>
                  patch({ numeroPedidoInternoExterno: numero })
                }
                onPedidoSelect={(pedido) => {
                  patch(pedidoVendaErpParaCamposRcc(pedido));
                  setCamposVinculadosPedido(true);
                  if (pedido.cliente) setCamposVinculadosCliente(true);
                }}
                onVinculoClear={() => {
                  setCamposVinculadosPedido(false);
                  setCamposVinculadosCliente(false);
                }}
                disabled={somenteLeitura}
              />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="rcc-numero-pedido">
                  {rccFieldLabels.numeroPedidoInternoExterno}
                </Label>
                <Input
                  id="rcc-numero-pedido"
                  value={dados.numeroPedidoInternoExterno ?? ""}
                  onChange={(e) =>
                    patch({ numeroPedidoInternoExterno: e.target.value })
                  }
                  disabled={somenteLeitura}
                  placeholder={
                    pedidoInterno ? undefined : "Informe o número do pedido externo"
                  }
                />
              </div>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Produto</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {somenteLeitura ? (
            codigoExibicao ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="rcc-codigo-produto">
                  {rccFieldLabels.codigoProduto}
                </Label>
                <Input
                  id="rcc-codigo-produto"
                  value={codigoExibicao}
                  readOnly
                  disabled
                  className="bg-muted/40"
                />
              </div>
            ) : null
          ) : origemNomus ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rcc-codigo-produto">
                {rccFieldLabels.codigoProduto}
              </Label>
              <Input
                id="rcc-codigo-produto"
                value={dados.codigoProduto ?? codigoExibicao ?? ""}
                onChange={(e) => patch({ codigoProduto: e.target.value })}
              />
            </div>
          ) : (
            <div className="sm:col-span-2">
              <ProdutoCodigoField
                label={rccFieldLabels.codigoProduto}
                value={dados.codigoProduto}
                onCodigoChange={(codigo) => patch({ codigoProduto: codigo })}
                onProdutoSelect={(produto) => {
                  patch(produtoErpParaCamposRcc(produto));
                  setCamposVinculadosProduto(true);
                }}
                onVinculoClear={() => setCamposVinculadosProduto(false)}
                disabled={somenteLeitura}
              />
            </div>
          )}

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rcc-produto">{rccFieldLabels.produto} *</Label>
            <Input
              id="rcc-produto"
              value={dados.produto}
              onChange={(e) => patch({ produto: e.target.value })}
              readOnly={camposProdutoAuto}
              disabled={somenteLeitura || camposProdutoAuto}
              className={camposProdutoAuto ? "bg-muted/40" : undefined}
              required
            />
            <CampoErro mensagem={erros.produto} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rcc-grupo">{rccFieldLabels.grupoProduto}</Label>
            <Input
              id="rcc-grupo"
              value={dados.grupoProduto}
              onChange={(e) => patch({ grupoProduto: e.target.value })}
              readOnly={camposProdutoAuto}
              disabled={somenteLeitura || camposProdutoAuto}
              className={camposProdutoAuto ? "bg-muted/40" : undefined}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rcc-quantidade">{rccFieldLabels.quantidade}</Label>
            <Input
              id="rcc-quantidade"
              value={dados.quantidade}
              onChange={(e) => patch({ quantidade: e.target.value })}
              disabled={somenteLeitura}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rcc-serie-lote">
              {rccFieldLabels.numeroSerieLoteProduto}
            </Label>
            <Input
              id="rcc-serie-lote"
              value={dados.numeroSerieLoteProduto ?? ""}
              onChange={(e) =>
                patch({ numeroSerieLoteProduto: e.target.value })
              }
              disabled={somenteLeitura}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Cliente</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {!somenteLeitura ? (
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
          ) : dados.clienteDoRevendedor ? (
            <div className="sm:col-span-2">
              <p className="text-sm text-muted-foreground">
                {rccFieldLabels.clienteDoRevendedor}: Sim
              </p>
            </div>
          ) : null}

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
            <Label htmlFor="rcc-cidade">{rccFieldLabels.cidade}</Label>
            <Input
              id="rcc-cidade"
              value={dados.cidade}
              onChange={(e) => patch({ cidade: e.target.value })}
              readOnly={camposClienteAuto}
              disabled={somenteLeitura || camposClienteAuto}
              className={camposClienteAuto ? "bg-muted/40" : undefined}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rcc-estado">{rccFieldLabels.estado}</Label>
            <Input
              id="rcc-estado"
              value={dados.estado}
              onChange={(e) =>
                patch({ estado: e.target.value.toUpperCase() })
              }
              readOnly={camposClienteAuto}
              disabled={somenteLeitura || camposClienteAuto}
              className={camposClienteAuto ? "bg-muted/40" : undefined}
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
              readOnly={camposClienteAuto}
              disabled={somenteLeitura || camposClienteAuto}
              className={camposClienteAuto ? "bg-muted/40" : undefined}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rcc-telefone">{rccFieldLabels.telefone}</Label>
            <Input
              id="rcc-telefone"
              value={dados.telefone}
              onChange={(e) => patch({ telefone: e.target.value })}
              readOnly={camposClienteAuto}
              disabled={somenteLeitura || camposClienteAuto}
              className={camposClienteAuto ? "bg-muted/40" : undefined}
            />
          </div>

          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="rcc-bairro">{rccFieldLabels.bairro}</Label>
              <Input
                id="rcc-bairro"
                value={dados.bairro}
                onChange={(e) => patch({ bairro: e.target.value })}
                readOnly={camposClienteAuto}
                disabled={somenteLeitura || camposClienteAuto}
                className={camposClienteAuto ? "bg-muted/40" : undefined}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rcc-endereco">{rccFieldLabels.endereco}</Label>
              <Input
                id="rcc-endereco"
                value={dados.endereco}
                onChange={(e) => patch({ endereco: e.target.value })}
                readOnly={camposClienteAuto}
                disabled={somenteLeitura || camposClienteAuto}
                className={camposClienteAuto ? "bg-muted/40" : undefined}
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

          <div className="space-y-2">
            <Label>{rccFieldLabels.produtoNossaFabricacao}</Label>
            <Select
              value={dados.produtoNossaFabricacao || undefined}
              onValueChange={(v) => v && patch({ produtoNossaFabricacao: v })}
              disabled={somenteLeitura}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {RCC_SIM_NAO.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {opcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{rccFieldLabels.produtoDentroGarantia}</Label>
            <Select
              value={dados.produtoDentroGarantia || undefined}
              onValueChange={(v) => v && patch({ produtoDentroGarantia: v })}
              disabled={somenteLeitura}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {RCC_SIM_NAO.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {opcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </fieldset>

      {dados.clienteDoRevendedor ? (
        <fieldset className="brand-fieldset space-y-4">
          <legend>Revendedor</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              {!somenteLeitura && !origemNomus ? (
                <ClienteSearchField
                  id="rcc-revendedor"
                  label={rccFieldLabels.nomeRevendedor}
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
                    {rccFieldLabels.nomeRevendedor}
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
                    {rccFieldLabels.nomeRevendedor}
                  </Label>
                  <Input
                    id="rcc-revendedor"
                    value={dados.nomeRevendedor ?? ""}
                    readOnly={somenteLeitura}
                    disabled={somenteLeitura}
                    className={somenteLeitura ? "bg-muted/40" : undefined}
                  />
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="rcc-cidade-revendedor">
                {rccFieldLabels.cidadeRevendedor}
              </Label>
              <Input
                id="rcc-cidade-revendedor"
                value={dados.cidadeRevendedor ?? ""}
                onChange={(e) => patch({ cidadeRevendedor: e.target.value })}
                readOnly={camposRevendedorAuto}
                disabled={somenteLeitura || camposRevendedorAuto}
                className={camposRevendedorAuto ? "bg-muted/40" : undefined}
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
                readOnly={camposRevendedorAuto}
                disabled={somenteLeitura || camposRevendedorAuto}
                className={camposRevendedorAuto ? "bg-muted/40" : undefined}
                maxLength={2}
                placeholder="UF"
              />
            </div>
          </div>
        </fieldset>
      ) : (
        <fieldset className="brand-fieldset space-y-4">
          <legend>Vendedor</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rcc-vendedor">{rccFieldLabels.vendedor}</Label>
              <Input
                id="rcc-vendedor"
                value={dados.vendedor ?? RCC_VENDEDOR_PADRAO}
                onChange={(e) => patch({ vendedor: e.target.value })}
                readOnly={somenteLeitura}
                disabled={somenteLeitura}
                className={somenteLeitura ? "bg-muted/40" : undefined}
              />
            </div>
          </div>
        </fieldset>
      )}

      <fieldset className="brand-fieldset space-y-4">
        <legend>Reclamação</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rcc-descricao">
              {rccFieldLabels.descricaoReclamacao} *
            </Label>
            <Textarea
              id="rcc-descricao"
              rows={4}
              value={dados.descricaoReclamacao}
              onChange={(e) => patch({ descricaoReclamacao: e.target.value })}
              disabled={somenteLeitura}
              required
            />
            <CampoErro mensagem={erros.descricaoReclamacao} />
          </div>

          <div className="space-y-2">
            <OpcaoListaPesquisavelField
              id="rcc-reclamacao-1"
              label={rccFieldLabels.reclamacao1}
              value={dados.reclamacao1}
              onChange={(v) => patch({ reclamacao1: v })}
              opcoesBase={RCC_RECLAMACOES}
              storageKey={RCC_RECLAMACOES_OPCOES_STORAGE_KEY}
              disabled={somenteLeitura}
            />
          </div>

          <div className="space-y-2">
            <OpcaoListaPesquisavelField
              id="rcc-reclamacao-2"
              label={rccFieldLabels.reclamacao2}
              value={dados.reclamacao2}
              onChange={(v) => patch({ reclamacao2: v })}
              opcoesBase={RCC_RECLAMACOES}
              storageKey={RCC_RECLAMACOES_OPCOES_STORAGE_KEY}
              disabled={somenteLeitura}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rcc-responsavel-analise">
              {rccFieldLabels.responsavelAnaliseReclamacao}
            </Label>
            <Input
              id="rcc-responsavel-analise"
              value={dados.responsavelAnaliseReclamacao}
              onChange={(e) =>
                patch({ responsavelAnaliseReclamacao: e.target.value })
              }
              disabled={somenteLeitura}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>{rccFieldLabels.reclamacaoAceita}</Label>
            <Select
              value={dados.reclamacaoAceita || undefined}
              onValueChange={(v) => v && patch({ reclamacaoAceita: v })}
              disabled={somenteLeitura}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {RCC_SIM_NAO.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {opcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Análise e tratamento</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rcc-comentario">{rccFieldLabels.comentario}</Label>
            <Textarea
              id="rcc-comentario"
              rows={3}
              value={dados.comentario}
              onChange={(e) => patch({ comentario: e.target.value })}
              disabled={somenteLeitura}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>{rccFieldLabels.causaProblema}</Label>
            <Select
              value={dados.causaProblema || undefined}
              onValueChange={(v) => v && patch({ causaProblema: v })}
              disabled={somenteLeitura}
            >
              <SelectTrigger id="rcc-causa" className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {RCC_CAUSAS_PROBLEMA.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {opcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Serviço realizado</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rcc-funcionario">
              {rccFieldLabels.funcionarioSolicitado}
            </Label>
            <Input
              id="rcc-funcionario"
              value={dados.funcionarioSolicitado}
              onChange={(e) => patch({ funcionarioSolicitado: e.target.value })}
              readOnly={somenteLeitura}
              disabled={somenteLeitura}
              className={somenteLeitura ? "bg-muted/40" : undefined}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rcc-servico">{rccFieldLabels.servicoRealizado}</Label>
            <Textarea
              id="rcc-servico"
              rows={4}
              value={dados.servicoRealizado}
              onChange={(e) => patch({ servicoRealizado: e.target.value })}
              disabled={somenteLeitura}
            />
          </div>

          <div className="space-y-2">
            <OpcaoListaPesquisavelField
              id="rcc-servico-1"
              label={rccFieldLabels.servicoRealizado1}
              value={dados.servicoRealizado1}
              onChange={(v) => patch({ servicoRealizado1: v })}
              opcoesBase={RCC_SERVICOS_REALIZADOS}
              storageKey={RCC_SERVICOS_OPCOES_STORAGE_KEY}
              disabled={somenteLeitura}
            />
          </div>

          <div className="space-y-2">
            <OpcaoListaPesquisavelField
              id="rcc-servico-2"
              label={rccFieldLabels.servicoRealizado2}
              value={dados.servicoRealizado2}
              onChange={(v) => patch({ servicoRealizado2: v })}
              opcoesBase={RCC_SERVICOS_REALIZADOS}
              storageKey={RCC_SERVICOS_OPCOES_STORAGE_KEY}
              disabled={somenteLeitura}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rcc-hora-saida-empresa">
              {rccFieldLabels.horaSaidaEmpresa}
            </Label>
            <Input
              id="rcc-hora-saida-empresa"
              type="time"
              value={dados.horaSaidaEmpresa}
              onChange={(e) => patch({ horaSaidaEmpresa: e.target.value })}
              readOnly={somenteLeitura}
              disabled={somenteLeitura}
              className={somenteLeitura ? "bg-muted/40" : undefined}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rcc-hora-chegada-empresa">
              {rccFieldLabels.horaChegadaEmpresa}
            </Label>
            <Input
              id="rcc-hora-chegada-empresa"
              type="time"
              value={dados.horaChegadaEmpresa}
              onChange={(e) => patch({ horaChegadaEmpresa: e.target.value })}
              readOnly={somenteLeitura}
              disabled={somenteLeitura}
              className={somenteLeitura ? "bg-muted/40" : undefined}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rcc-hora-chegada-cliente">
              {rccFieldLabels.horaChegadaCliente}
            </Label>
            <Input
              id="rcc-hora-chegada-cliente"
              type="time"
              value={dados.horaChegadaCliente}
              onChange={(e) => patch({ horaChegadaCliente: e.target.value })}
              readOnly={somenteLeitura}
              disabled={somenteLeitura}
              className={somenteLeitura ? "bg-muted/40" : undefined}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rcc-hora-saida-cliente">
              {rccFieldLabels.horaSaidaCliente}
            </Label>
            <Input
              id="rcc-hora-saida-cliente"
              type="time"
              value={dados.horaSaidaCliente}
              onChange={(e) => patch({ horaSaidaCliente: e.target.value })}
              readOnly={somenteLeitura}
              disabled={somenteLeitura}
              className={somenteLeitura ? "bg-muted/40" : undefined}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rcc-serie-compressor">
              {rccFieldLabels.numeroSerieCompressor}
            </Label>
            <Input
              id="rcc-serie-compressor"
              value={dados.numeroSerieCompressor}
              onChange={(e) => patch({ numeroSerieCompressor: e.target.value })}
              readOnly={somenteLeitura}
              disabled={somenteLeitura}
              className={somenteLeitura ? "bg-muted/40" : undefined}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rcc-data-conclusao-servico">
              {rccFieldLabels.dataConclusaoServico}
            </Label>
            <Input
              id="rcc-data-conclusao-servico"
              type="date"
              value={isoParaInputDate(dados.dataConclusaoServico)}
              onChange={(e) =>
                patch({
                  dataConclusaoServico: e.target.value
                    ? `${e.target.value}T12:00:00.000Z`
                    : "",
                })
              }
              disabled={somenteLeitura}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rcc-data-fechamento">
              {rccFieldLabels.dataFechamento}
            </Label>
            <Input
              id="rcc-data-fechamento"
              type="date"
              value={isoParaInputDate(dados.dataFechamento)}
              onChange={(e) =>
                patch({
                  dataFechamento: e.target.value
                    ? `${e.target.value}T12:00:00.000Z`
                    : "",
                })
              }
              disabled={somenteLeitura}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>{rccFieldLabels.problemaSolucionado}</Label>
            <Select
              value={dados.problemaSolucionado || undefined}
              onValueChange={(v) => v && patch({ problemaSolucionado: v })}
              disabled={somenteLeitura}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {RCC_SIM_NAO.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {opcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
