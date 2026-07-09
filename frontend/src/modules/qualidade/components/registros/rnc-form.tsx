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
import {
  RNC_ACOES_IMEDIATAS,
  RNC_ANALISE_PROBLEMA,
  RNC_TIPOS_ACAO,
  RNC_TIPOS_OCORRENCIA,
  RNC_TIPOS_PRODUTO,
  ORIGEM_NOMUS_LABEL,
  rncFieldLabels,
} from "@qualidade/lib/registros/constants";
import { ProdutoCodigoField } from "@qualidade/components/registros/produto-codigo-field";
import {
  extrairCodigoProduto,
  produtoErpParaCamposRnc,
} from "@qualidade/types/produto-erp";
import type { RncDados } from "@qualidade/types/rnc";
import { isoParaInputDate } from "@qualidade/types/rnc";

interface RncFormProps {
  dados: RncDados;
  onChange: (dados: RncDados) => void;
  erros?: Partial<Record<keyof RncDados, string>>;
  disabled?: boolean;
  modo?: "criar" | "visualizar";
  origemNomus?: boolean;
  codigoDocumentoPreview?: string;
  /** Nome do usuário logado — preenchido automaticamente na criação. */
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

export function RncForm({
  dados,
  onChange,
  erros = {},
  disabled = false,
  modo = "criar",
  origemNomus = false,
  codigoDocumentoPreview,
  usuarioCriacaoNome = "",
}: RncFormProps) {
  function patch(partial: Partial<RncDados>) {
    onChange({ ...dados, ...partial });
  }

  const somenteLeitura = disabled || modo === "visualizar";
  const [camposVinculadosProduto, setCamposVinculadosProduto] = useState(
    Boolean(dados.codigoProduto?.trim())
  );

  const camposProdutoAuto =
    camposVinculadosProduto && !somenteLeitura && !origemNomus;

  const codigoExibicao =
    dados.codigoProduto?.trim() || extrairCodigoProduto(dados.produto);

  return (
    <div className="space-y-6">
      <fieldset className="brand-fieldset space-y-4">
        <legend>Identificação</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rnc-codigo">{rncFieldLabels.codigoDocumento}</Label>
            {origemNomus ? (
              <div className="space-y-1">
                <Input
                  id="rnc-codigo"
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
                  id="rnc-codigo"
                  value={codigoDocumentoPreview ?? "Gerado automaticamente ao salvar"}
                  readOnly
                  disabled
                  className="bg-muted/40"
                />
                <p className="text-xs text-muted-foreground">
                  O código será atribuído automaticamente (ex.: RNC-0001).
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rnc-data-ocorrencia">
              {rncFieldLabels.dataOcorrencia} *
            </Label>
            <Input
              id="rnc-data-ocorrencia"
              type="date"
              value={isoParaInputDate(dados.dataOcorrencia)}
              onChange={(e) =>
                patch({
                  dataOcorrencia: e.target.value
                    ? `${e.target.value}T12:00:00.000Z`
                    : "",
                })
              }
              disabled={somenteLeitura}
              required
            />
            <CampoErro mensagem={erros.dataOcorrencia} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rnc-data-fechamento">
              {rncFieldLabels.dataFechamento}
            </Label>
            <Input
              id="rnc-data-fechamento"
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

          <div className="space-y-2">
            <Label htmlFor="rnc-usuario-criacao">
              {rncFieldLabels.usuarioCriacao}
            </Label>
            <Input
              id="rnc-usuario-criacao"
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
            <Label htmlFor="rnc-prazo">{rncFieldLabels.prazoExecucao}</Label>
            <Input
              id="rnc-prazo"
              type="date"
              value={isoParaInputDate(dados.prazoExecucao)}
              onChange={(e) =>
                patch({
                  prazoExecucao: e.target.value
                    ? `${e.target.value}T12:00:00.000Z`
                    : "",
                })
              }
              disabled={somenteLeitura}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Produto</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {somenteLeitura || origemNomus ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rnc-codigo-produto">
                {rncFieldLabels.codigoProduto}
              </Label>
              <Input
                id="rnc-codigo-produto"
                value={codigoExibicao || "—"}
                readOnly
                disabled
                className="bg-muted/40"
              />
            </div>
          ) : (
            <div className="sm:col-span-2">
              <ProdutoCodigoField
                value={dados.codigoProduto}
                onCodigoChange={(codigo) => patch({ codigoProduto: codigo })}
                onProdutoSelect={(produto) => {
                  patch(produtoErpParaCamposRnc(produto));
                  setCamposVinculadosProduto(true);
                }}
                onVinculoClear={() => setCamposVinculadosProduto(false)}
                disabled={somenteLeitura}
              />
            </div>
          )}

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rnc-produto">{rncFieldLabels.produto}</Label>
            <Input
              id="rnc-produto"
              value={dados.produto}
              onChange={(e) => patch({ produto: e.target.value })}
              readOnly={camposProdutoAuto}
              disabled={somenteLeitura || camposProdutoAuto}
              className={camposProdutoAuto ? "bg-muted/40" : undefined}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rnc-grupo">{rncFieldLabels.grupoProduto}</Label>
            <Input
              id="rnc-grupo"
              value={dados.grupoProduto}
              onChange={(e) => patch({ grupoProduto: e.target.value })}
              readOnly={camposProdutoAuto}
              disabled={somenteLeitura || camposProdutoAuto}
              className={camposProdutoAuto ? "bg-muted/40" : undefined}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rnc-tipo-produto">{rncFieldLabels.tipoProduto}</Label>
            {camposProdutoAuto ? (
              <Input
                id="rnc-tipo-produto"
                value={dados.tipoProduto}
                readOnly
                disabled
                className="bg-muted/40"
              />
            ) : (
              <>
                <Select
                  value={dados.tipoProduto || undefined}
                  onValueChange={(v) => v && patch({ tipoProduto: v })}
                  disabled={somenteLeitura}
                >
                  <SelectTrigger id="rnc-tipo-produto" className="w-full">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {RNC_TIPOS_PRODUTO.map((opcao) => (
                      <SelectItem key={opcao} value={opcao}>
                        {opcao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="mt-2"
                  placeholder="Ou digite outro tipo..."
                  value={
                    RNC_TIPOS_PRODUTO.includes(
                      dados.tipoProduto as (typeof RNC_TIPOS_PRODUTO)[number]
                    )
                      ? ""
                      : dados.tipoProduto
                  }
                  onChange={(e) => patch({ tipoProduto: e.target.value })}
                  disabled={somenteLeitura}
                />
              </>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Classificação</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{rncFieldLabels.tipoAcao} *</Label>
            <Select
              value={dados.tipoAcao || undefined}
              onValueChange={(v) => v && patch({ tipoAcao: v })}
              disabled={somenteLeitura}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {RNC_TIPOS_ACAO.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {opcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CampoErro mensagem={erros.tipoAcao} />
          </div>

          <div className="space-y-2">
            <Label>{rncFieldLabels.tipoOcorrencia} *</Label>
            <Select
              value={dados.tipoOcorrencia || undefined}
              onValueChange={(v) => v && patch({ tipoOcorrencia: v })}
              disabled={somenteLeitura}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {RNC_TIPOS_OCORRENCIA.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {opcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="mt-2"
              placeholder="Ou digite outro tipo..."
              value={
                RNC_TIPOS_OCORRENCIA.includes(
                  dados.tipoOcorrencia as (typeof RNC_TIPOS_OCORRENCIA)[number]
                )
                  ? ""
                  : dados.tipoOcorrencia
              }
              onChange={(e) => patch({ tipoOcorrencia: e.target.value })}
              disabled={somenteLeitura}
            />
            <CampoErro mensagem={erros.tipoOcorrencia} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rnc-setor-ocorrencia">
              {rncFieldLabels.setorOcorrencia}
            </Label>
            <Input
              id="rnc-setor-ocorrencia"
              value={dados.setorOcorrencia}
              onChange={(e) => patch({ setorOcorrencia: e.target.value })}
              disabled={somenteLeitura}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Ocorrência</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rnc-descricao">
              {rncFieldLabels.descricaoOcorrencia} *
            </Label>
            <Textarea
              id="rnc-descricao"
              rows={4}
              value={dados.descricaoOcorrencia}
              onChange={(e) => patch({ descricaoOcorrencia: e.target.value })}
              disabled={somenteLeitura}
              required
            />
            <CampoErro mensagem={erros.descricaoOcorrencia} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rnc-setor-deteccao">
              {rncFieldLabels.setorDeteccao}
            </Label>
            <Input
              id="rnc-setor-deteccao"
              value={dados.setorDeteccao}
              onChange={(e) => patch({ setorDeteccao: e.target.value })}
              disabled={somenteLeitura}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rnc-responsavel">
              {rncFieldLabels.responsavel} *
            </Label>
            <Input
              id="rnc-responsavel"
              value={dados.responsavel}
              onChange={(e) => patch({ responsavel: e.target.value })}
              disabled={somenteLeitura}
              required
            />
            <CampoErro mensagem={erros.responsavel} />
          </div>
        </div>
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Ação imediata</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{rncFieldLabels.acaoImediata}</Label>
            <Select
              value={dados.acaoImediata || undefined}
              onValueChange={(v) => v && patch({ acaoImediata: v })}
              disabled={somenteLeitura}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {RNC_ACOES_IMEDIATAS.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {opcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rnc-resp-acao">
              {rncFieldLabels.responsavelAcaoImediata}
            </Label>
            <Input
              id="rnc-resp-acao"
              value={dados.responsavelAcaoImediata}
              onChange={(e) =>
                patch({ responsavelAcaoImediata: e.target.value })
              }
              disabled={somenteLeitura}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rnc-desc-acao">
              {rncFieldLabels.descricaoAcaoImediata}
            </Label>
            <Textarea
              id="rnc-desc-acao"
              rows={3}
              value={dados.descricaoAcaoImediata}
              onChange={(e) =>
                patch({ descricaoAcaoImediata: e.target.value })
              }
              disabled={somenteLeitura}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rnc-nf">{rncFieldLabels.notaFiscal}</Label>
            <Input
              id="rnc-nf"
              value={dados.notaFiscal}
              onChange={(e) => patch({ notaFiscal: e.target.value })}
              disabled={somenteLeitura}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Análise e tratamento</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>{rncFieldLabels.analiseProblema}</Label>
            <Select
              value={dados.analiseProblema || undefined}
              onValueChange={(v) => v && patch({ analiseProblema: v })}
              disabled={somenteLeitura}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {RNC_ANALISE_PROBLEMA.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {opcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rnc-quantidade">{rncFieldLabels.quantidade}</Label>
            <Input
              id="rnc-quantidade"
              value={dados.quantidade}
              onChange={(e) => patch({ quantidade: e.target.value })}
              disabled={somenteLeitura}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rnc-resolucao">
              {rncFieldLabels.resolucaoNaoConformidade}
            </Label>
            <Textarea
              id="rnc-resolucao"
              rows={3}
              value={dados.resolucaoNaoConformidade}
              onChange={(e) =>
                patch({ resolucaoNaoConformidade: e.target.value })
              }
              disabled={somenteLeitura}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rnc-causa">{rncFieldLabels.causa}</Label>
            <Textarea
              id="rnc-causa"
              rows={3}
              value={dados.causa}
              onChange={(e) => patch({ causa: e.target.value })}
              disabled={somenteLeitura}
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
