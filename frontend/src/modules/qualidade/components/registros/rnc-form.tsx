import { useEffect, useMemo, useState } from "react";
import { useConfigStore } from "@qualidade/lib/store/config-store";
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
  RNC_SIM_NAO,
  RNC_TIPOS_ACAO,
  RNC_TIPO_OCORRENCIA_OUTRO,
  RNC_TIPOS_OCORRENCIA,
  RNC_TIPOS_PRODUTO,
  ORIGEM_NOMUS_LABEL,
  rncFieldLabels,
} from "@qualidade/lib/registros/constants";
import { OrganicoResponsavelField } from "@qualidade/components/registros/organico-responsavel-field";
import { RncItensProdutoTable } from "@qualidade/components/registros/rnc-itens-produto-table";
import { RegistroAnexosTable } from "@qualidade/components/registros/registro-anexos-table";
import { RncAcoesApartadasTable } from "@qualidade/components/registros/rnc-acoes-apartadas-table";
import { RncPlanoAcaoPorques } from "@qualidade/components/registros/rnc-plano-acao-porques";
import { extrairCodigoProduto } from "@qualidade/types/produto-erp";
import type { RncDados } from "@qualidade/types/rnc";
import {
  dataLocalHojeIso,
  isoParaInputDate,
  normalizarRncDados,
  sincronizarAcoesApartadasLegado,
} from "@qualidade/types/rnc";

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

function tipoOcorrenciaNaLista(valor: string): boolean {
  return (RNC_TIPOS_OCORRENCIA as readonly string[]).includes(valor);
}

function valorSelectTipoOcorrencia(valor: string): string | undefined {
  if (!valor.trim()) return undefined;
  if (tipoOcorrenciaNaLista(valor)) return valor;
  return RNC_TIPO_OCORRENCIA_OUTRO;
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
  const dadosAtuais = useMemo(
    () => normalizarRncDados(dados, { manterAnexosVazios: true }),
    [dados]
  );

  function patch(partial: Partial<RncDados>) {
    onChange(sincronizarAcoesApartadasLegado({ ...dadosAtuais, ...partial }));
  }

  const departments = useConfigStore((s) => s.departments);
  const setores = useMemo(
    () =>
      [...departments].sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
      ),
    [departments]
  );

  const somenteLeitura = disabled || modo === "visualizar";
  const [camposVinculadosProduto, setCamposVinculadosProduto] = useState(
    Boolean(dadosAtuais.codigoProduto?.trim())
  );

  const camposProdutoAuto =
    camposVinculadosProduto && !somenteLeitura && !origemNomus;

  useEffect(() => {
    if (origemNomus) return;
    setCamposVinculadosProduto(
      dadosAtuais.itensProduto.some((item) => item.codigoProduto.trim())
    );
  }, [dadosAtuais.itensProduto, origemNomus]);

  const codigoExibicao =
    dadosAtuais.codigoProduto?.trim() || extrairCodigoProduto(dadosAtuais.produto);
  const tipoOcorrenciaSelecionado = valorSelectTipoOcorrencia(
    dadosAtuais.tipoOcorrencia
  );
  const outroTipoOcorrencia =
    tipoOcorrenciaSelecionado === RNC_TIPO_OCORRENCIA_OUTRO;
  const textoOutroTipoOcorrencia =
    outroTipoOcorrencia &&
    dadosAtuais.tipoOcorrencia !== RNC_TIPO_OCORRENCIA_OUTRO
      ? dadosAtuais.tipoOcorrencia
      : "";
  const setorOcorrenciaAtual = dadosAtuais.setorOcorrencia.trim();
  const setorOcorrenciaCadastrado = setores.find(
    (setor) =>
      setor.nome.localeCompare(setorOcorrenciaAtual, "pt-BR", {
        sensitivity: "base",
      }) === 0
  );
  const setorOcorrenciaLegado =
    Boolean(setorOcorrenciaAtual) && !setorOcorrenciaCadastrado;
  const setorDeteccaoAtual = dadosAtuais.setorDeteccao.trim();
  const setorDeteccaoCadastrado = setores.find(
    (setor) =>
      setor.nome.localeCompare(setorDeteccaoAtual, "pt-BR", {
        sensitivity: "base",
      }) === 0
  );
  const setorDeteccaoLegado =
    Boolean(setorDeteccaoAtual) && !setorDeteccaoCadastrado;
  const exigeFechamento = dadosAtuais.statusRnc === "finalizada";

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
                  value={dadosAtuais.codigoDocumento}
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
              value={isoParaInputDate(dadosAtuais.dataOcorrencia)}
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
            <Label htmlFor="rnc-usuario-criacao">
              {rncFieldLabels.usuarioCriacao}
            </Label>
            <Input
              id="rnc-usuario-criacao"
              value={
                modo === "criar" && !origemNomus
                  ? usuarioCriacaoNome
                  : dadosAtuais.usuarioCriacao
              }
              readOnly
              disabled
              className="bg-muted/40"
            />
          </div>

        </div>
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Classificação</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{rncFieldLabels.tipoAcao} *</Label>
            <Select
              value={dadosAtuais.tipoAcao || undefined}
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
              value={tipoOcorrenciaSelecionado}
              onValueChange={(v) => {
                if (!v) return;
                if (v === RNC_TIPO_OCORRENCIA_OUTRO) {
                  patch({ tipoOcorrencia: RNC_TIPO_OCORRENCIA_OUTRO });
                  return;
                }
                patch({ tipoOcorrencia: v });
              }}
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
                <SelectItem value={RNC_TIPO_OCORRENCIA_OUTRO}>Outro</SelectItem>
              </SelectContent>
            </Select>
            {outroTipoOcorrencia ? (
              <Input
                className="mt-2"
                placeholder="Digite o tipo de ocorrência..."
                value={textoOutroTipoOcorrencia}
                onChange={(e) =>
                  patch({
                    tipoOcorrencia:
                      e.target.value.trim() === ""
                        ? RNC_TIPO_OCORRENCIA_OUTRO
                        : e.target.value,
                  })
                }
                disabled={somenteLeitura}
              />
            ) : null}
            <CampoErro mensagem={erros.tipoOcorrencia} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rnc-setor-ocorrencia">
              {rncFieldLabels.setorOcorrencia} *
            </Label>
            <Select
              value={
                setorOcorrenciaCadastrado?.nome ??
                (setorOcorrenciaAtual || undefined)
              }
              onValueChange={(v) => v && patch({ setorOcorrencia: v })}
              disabled={somenteLeitura || setores.length === 0}
            >
              <SelectTrigger id="rnc-setor-ocorrencia" className="w-full">
                <SelectValue placeholder="Selecione o setor..." />
              </SelectTrigger>
              <SelectContent>
                {setorOcorrenciaLegado ? (
                  <SelectItem value={setorOcorrenciaAtual}>
                    {setorOcorrenciaAtual}
                  </SelectItem>
                ) : null}
                {setores.map((setor) => (
                  <SelectItem key={setor.id} value={setor.nome}>
                    {setor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {setores.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum setor cadastrado. Cadastre em Qualidade → Configurações
                → Setores.
              </p>
            ) : null}
            <CampoErro mensagem={erros.setorOcorrencia} />
          </div>
        </div>
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Produto</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {origemNomus ? (
            <>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="rnc-codigo-produto">
                  {rncFieldLabels.codigoProduto} *
                </Label>
                <Input
                  id="rnc-codigo-produto"
                  value={dadosAtuais.codigoProduto ?? codigoExibicao ?? ""}
                  onChange={(e) => patch({ codigoProduto: e.target.value })}
                  readOnly={somenteLeitura}
                  disabled={somenteLeitura}
                />
                <CampoErro mensagem={erros.codigoProduto} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="rnc-produto">{rncFieldLabels.produto} *</Label>
                <Input
                  id="rnc-produto"
                  value={dadosAtuais.produto}
                  onChange={(e) => patch({ produto: e.target.value })}
                  readOnly={somenteLeitura}
                  disabled={somenteLeitura}
                />
                <CampoErro mensagem={erros.produto} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="rnc-quantidade">{rncFieldLabels.quantidade}</Label>
                <Input
                  id="rnc-quantidade"
                  value={dadosAtuais.quantidade}
                  onChange={(e) => patch({ quantidade: e.target.value })}
                  readOnly={somenteLeitura}
                  disabled={somenteLeitura}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="rnc-nf">{rncFieldLabels.notaFiscal}</Label>
                <Input
                  id="rnc-nf"
                  value={dadosAtuais.notaFiscal}
                  readOnly
                  disabled
                  className="bg-muted/40"
                />
              </div>
            </>
          ) : (
            <RncItensProdutoTable
              dados={dadosAtuais}
              disabled={somenteLeitura}
              erro={erros.temPedidoVenda || erros.itensProduto || erros.quantidade}
              onChange={(next) =>
                onChange(sincronizarAcoesApartadasLegado(normalizarRncDados(next, { manterAnexosVazios: true })))
              }
            />
          )}

          {origemNomus || dadosAtuais.temPedidoVenda ? (
            <>
          <div className="space-y-2">
            <Label htmlFor="rnc-grupo">{rncFieldLabels.grupoProduto}</Label>
            <Input
              id="rnc-grupo"
              value={dadosAtuais.grupoProduto}
              onChange={(e) => patch({ grupoProduto: e.target.value })}
              readOnly={camposProdutoAuto}
              disabled={somenteLeitura || camposProdutoAuto}
              className={camposProdutoAuto ? "bg-muted/40" : undefined}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rnc-lote-serie">{rncFieldLabels.loteSerie}</Label>
            <Input
              id="rnc-lote-serie"
              value={dadosAtuais.loteSerie}
              onChange={(e) => patch({ loteSerie: e.target.value })}
              disabled={somenteLeitura}
            />
          </div>

          {origemNomus || dadosAtuais.temPedidoVenda === "sim" ? (
          <div className="space-y-2">
            <Label htmlFor="rnc-op-numero">
              {rncFieldLabels.numeroOrdemProducao}
            </Label>
            <Input
              id="rnc-op-numero"
              value={dadosAtuais.numeroOrdemProducao}
              onChange={(e) => patch({ numeroOrdemProducao: e.target.value })}
              disabled={somenteLeitura}
            />
          </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="rnc-tipo-produto">{rncFieldLabels.tipoProduto} *</Label>
            {camposProdutoAuto ? (
              <Input
                id="rnc-tipo-produto"
                value={dadosAtuais.tipoProduto}
                readOnly
                disabled
                className="bg-muted/40"
              />
            ) : (
              <>
                <Select
                  value={dadosAtuais.tipoProduto || undefined}
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
                      dadosAtuais.tipoProduto as (typeof RNC_TIPOS_PRODUTO)[number]
                    )
                      ? ""
                      : dadosAtuais.tipoProduto
                  }
                  onChange={(e) => patch({ tipoProduto: e.target.value })}
                  disabled={somenteLeitura}
                />
              </>
            )}
            <CampoErro mensagem={erros.tipoProduto} />
          </div>
            </>
          ) : null}
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
              value={dadosAtuais.descricaoOcorrencia}
              onChange={(e) => patch({ descricaoOcorrencia: e.target.value })}
              disabled={somenteLeitura}
              required
            />
            <CampoErro mensagem={erros.descricaoOcorrencia} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rnc-setor-deteccao">
              {rncFieldLabels.setorDeteccao} *
            </Label>
            <Select
              value={
                setorDeteccaoCadastrado?.nome ??
                (setorDeteccaoAtual || undefined)
              }
              onValueChange={(v) => v && patch({ setorDeteccao: v })}
              disabled={somenteLeitura || setores.length === 0}
            >
              <SelectTrigger id="rnc-setor-deteccao" className="w-full">
                <SelectValue placeholder="Selecione o setor..." />
              </SelectTrigger>
              <SelectContent>
                {setorDeteccaoLegado ? (
                  <SelectItem value={setorDeteccaoAtual}>
                    {setorDeteccaoAtual}
                  </SelectItem>
                ) : null}
                {setores.map((setor) => (
                  <SelectItem key={setor.id} value={setor.nome}>
                    {setor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {setores.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum setor cadastrado. Cadastre em Qualidade → Configurações
                → Setores.
              </p>
            ) : null}
            <CampoErro mensagem={erros.setorDeteccao} />
          </div>

          <div className="space-y-2">
            <OrganicoResponsavelField
              id="rnc-responsavel"
              label={`${rncFieldLabels.responsavel} *`}
              value={dadosAtuais.responsavel}
              onValueChange={(nome) => patch({ responsavel: nome })}
              disabled={somenteLeitura}
            />
            <CampoErro mensagem={erros.responsavel} />
          </div>
        </div>
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Ação imediata</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{rncFieldLabels.acaoImediata} *</Label>
            <Select
              value={dadosAtuais.acaoImediata || undefined}
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
            <CampoErro mensagem={erros.acaoImediata} />
          </div>

          <div className="space-y-2">
            <OrganicoResponsavelField
              id="rnc-resp-acao"
              label={`${rncFieldLabels.responsavelAcaoImediata} *`}
              value={dadosAtuais.responsavelAcaoImediata}
              onValueChange={(nome) => patch({ responsavelAcaoImediata: nome })}
              disabled={somenteLeitura}
            />
            <CampoErro mensagem={erros.responsavelAcaoImediata} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rnc-desc-acao">
              {rncFieldLabels.descricaoAcaoImediata} *
            </Label>
            <Textarea
              id="rnc-desc-acao"
              rows={3}
              value={dadosAtuais.descricaoAcaoImediata}
              onChange={(e) =>
                patch({ descricaoAcaoImediata: e.target.value })
              }
              disabled={somenteLeitura}
            />
            <CampoErro mensagem={erros.descricaoAcaoImediata} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rnc-prazo">{rncFieldLabels.prazoExecucao} *</Label>
            <Input
              id="rnc-prazo"
              type="date"
              value={isoParaInputDate(dadosAtuais.prazoExecucao)}
              onChange={(e) =>
                patch({
                  prazoExecucao: e.target.value
                    ? `${e.target.value}T12:00:00.000Z`
                    : "",
                })
              }
              disabled={somenteLeitura}
            />
            <CampoErro mensagem={erros.prazoExecucao} />
          </div>
        </div>
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Análise e tratamento</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>{rncFieldLabels.analiseProblema}</Label>
            <Select
              value={dadosAtuais.analiseProblema || undefined}
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

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rnc-resolucao">
              {rncFieldLabels.resolucaoNaoConformidade}
              {exigeFechamento ? " *" : ""}
            </Label>
            <Textarea
              id="rnc-resolucao"
              rows={3}
              value={dadosAtuais.resolucaoNaoConformidade}
              onChange={(e) =>
                patch({ resolucaoNaoConformidade: e.target.value })
              }
              disabled={somenteLeitura}
            />
            <CampoErro mensagem={erros.resolucaoNaoConformidade} />
          </div>

          <RncPlanoAcaoPorques
            dados={dadosAtuais}
            onChange={(next) =>
              onChange(sincronizarAcoesApartadasLegado(normalizarRncDados(next, { manterAnexosVazios: true })))
            }
            disabled={somenteLeitura}
          />

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="rnc-causa">
              {rncFieldLabels.causa}
              {exigeFechamento ? " *" : ""}
            </Label>
            <Textarea
              id="rnc-causa"
              rows={3}
              value={dadosAtuais.causa}
              onChange={(e) => patch({ causa: e.target.value })}
              disabled={somenteLeitura}
            />
            <CampoErro mensagem={erros.causa} />
          </div>

          <RncAcoesApartadasTable
            dados={dadosAtuais}
            onChange={(next) =>
              onChange(sincronizarAcoesApartadasLegado(normalizarRncDados(next, { manterAnexosVazios: true })))
            }
            disabled={somenteLeitura}
          />

          <div className="space-y-2 sm:col-span-2">
            <Label>
              {rncFieldLabels.analiseEficaz}
              {exigeFechamento ? " *" : ""}
            </Label>
            <Select
              value={dadosAtuais.analiseEficaz || undefined}
              onValueChange={(v) => v && patch({ analiseEficaz: v })}
              disabled={somenteLeitura}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {dadosAtuais.analiseEficaz &&
                !RNC_SIM_NAO.includes(
                  dadosAtuais.analiseEficaz as (typeof RNC_SIM_NAO)[number]
                ) ? (
                  <SelectItem value={dadosAtuais.analiseEficaz}>
                    {dadosAtuais.analiseEficaz}
                  </SelectItem>
                ) : null}
                {RNC_SIM_NAO.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {opcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CampoErro mensagem={erros.analiseEficaz} />
          </div>
        </div>
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Evidências{exigeFechamento ? " *" : ""}</legend>
        <RegistroAnexosTable
          anexos={dadosAtuais.anexos}
          onChange={(anexos) => patch({ anexos })}
          disabled={somenteLeitura}
          comTitulo
        />
        <CampoErro mensagem={erros.anexos} />
      </fieldset>

      <fieldset className="brand-fieldset space-y-4">
        <legend>Status da RNC</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <Label>{rncFieldLabels.statusRnc}</Label>
            <div className="flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="rnc-status"
                  className="size-4 accent-brand-blue"
                  checked={dadosAtuais.statusRnc === "em_andamento"}
                  disabled={somenteLeitura}
                  onChange={() =>
                    patch({ statusRnc: "em_andamento", dataFechamento: "" })
                  }
                />
                Em andamento
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="rnc-status"
                  className="size-4 accent-brand-blue"
                  checked={dadosAtuais.statusRnc === "finalizada"}
                  disabled={somenteLeitura}
                  onChange={() =>
                    patch({
                      statusRnc: "finalizada",
                      dataFechamento: dataLocalHojeIso(),
                    })
                  }
                />
                Finalizada
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rnc-data-fechamento">
              {rncFieldLabels.dataFechamento}
              {dadosAtuais.statusRnc === "finalizada" ? " *" : ""}
            </Label>
            <Input
              id="rnc-data-fechamento"
              type="date"
              value={isoParaInputDate(dadosAtuais.dataFechamento)}
              onChange={(e) =>
                patch({
                  statusRnc: "finalizada",
                  dataFechamento: e.target.value
                    ? `${e.target.value}T12:00:00.000Z`
                    : "",
                })
              }
              disabled={
                somenteLeitura || dadosAtuais.statusRnc !== "finalizada"
              }
            />
            <p className="text-xs text-muted-foreground">
              {dadosAtuais.statusRnc === "finalizada"
                ? "Preenchida com a data de hoje. Você pode alterar para outro dia."
                : "A data é preenchida ao marcar a RNC como finalizada."}
            </p>
            <CampoErro mensagem={erros.dataFechamento} />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
