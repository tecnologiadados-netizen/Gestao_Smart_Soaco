import { useState } from "react";
import { Button } from "@qualidade/components/ui/button";
import { Label } from "@qualidade/components/ui/label";
import { Textarea } from "@qualidade/components/ui/textarea";
import { Badge } from "@qualidade/components/ui/badge";
import { FornecedorSearchField } from "@qualidade/components/avaliacao-fornecedor/fornecedor-search-field";
import { AvaliacaoCriteriosForm } from "@qualidade/components/avaliacao-fornecedor/avaliacao-criterios-form";
import { AvaliacaoMetadadosForm } from "@qualidade/components/avaliacao-fornecedor/avaliacao-metadados-form";
import {
  criarNotasVazias,
  validarNotas,
  type CriterioId,
} from "@qualidade/lib/avaliacao-fornecedor/criterios";
import { validarMetadados } from "@qualidade/lib/avaliacao-fornecedor/validacao";
import { useAvaliacaoFornecedorStore } from "@qualidade/lib/store/avaliacao-fornecedor-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { formatarData } from "@qualidade/lib/utils/dates";
import {
  criarMetadadosVazios,
  getDataAvaliacao,
  type Fornecedor,
} from "@qualidade/types/avaliacao-fornecedor";

interface AvaliacaoFornecedorFormProps {
  onSuccess?: () => void;
}

export function AvaliacaoFornecedorForm({ onSuccess }: AvaliacaoFornecedorFormProps) {
  const currentUserId = useConfigStore((s) => s.currentUserId);
  const users = useConfigStore((s) => s.users);
  const salvarAvaliacao = useAvaliacaoFornecedorStore((s) => s.salvarAvaliacao);
  const getUltimaAvaliacao = useAvaliacaoFornecedorStore(
    (s) => s.getUltimaAvaliacao
  );

  const responsavelNome =
    users.find((u) => u.id === currentUserId)?.nome ?? "—";

  const [fornecedorSelecionado, setFornecedorSelecionado] =
    useState<Fornecedor | null>(null);

  const [metadados, setMetadados] = useState(criarMetadadosVazios);
  const [notas, setNotas] = useState(criarNotasVazias);
  const [observacoes, setObservacoes] = useState("");
  const [error, setError] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [avaliacaoSalvaNaSessao, setAvaliacaoSalvaNaSessao] = useState(false);

  const ultimaAvaliacao = fornecedorSelecionado
    ? getUltimaAvaliacao(fornecedorSelecionado.id)
    : undefined;

  function limparFormulario() {
    setMetadados(criarMetadadosVazios());
    setNotas(criarNotasVazias());
    setObservacoes("");
  }

  function selecionarFornecedor(fornecedor: Fornecedor) {
    setFornecedorSelecionado(fornecedor);
    limparFormulario();
    setError("");
    setSucesso("");
    setAvaliacaoSalvaNaSessao(false);
  }

  function limparFornecedor() {
    setFornecedorSelecionado(null);
    limparFormulario();
    setError("");
    setSucesso("");
    setAvaliacaoSalvaNaSessao(false);
  }

  function reiniciar() {
    limparFornecedor();
  }

  function alterarNota(criterioId: CriterioId, nota: number | "") {
    setNotas((prev) => ({ ...prev, [criterioId]: nota }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fornecedorSelecionado || avaliacaoSalvaNaSessao) return;

    const erroMetadados = validarMetadados(metadados);
    if (erroMetadados) {
      setError(erroMetadados);
      return;
    }

    if (!validarNotas(notas)) {
      setError("Classifique todos os critérios com estrelas (1 a 5).");
      return;
    }

    const ok = salvarAvaliacao({
      fornecedorId: fornecedorSelecionado.id,
      fornecedorNome: fornecedorSelecionado.nome,
      avaliadorId: currentUserId,
      dataReferencia: metadados.dataReferencia,
      dataAvaliacao: metadados.dataAvaliacao,
      numeroDocumento: metadados.numeroDocumento,
      fornecedorAprovado: metadados.fornecedorAprovado as boolean,
      rncNumero: metadados.rncNumero,
      notas,
      observacoes,
    });

    if (!ok) {
      setError("Não foi possível salvar a avaliação.");
      return;
    }

    setAvaliacaoSalvaNaSessao(true);
    limparFormulario();
    setError("");
    setSucesso("Avaliação registrada com sucesso.");
    onSuccess?.();
  }

  return (
    <div className="space-y-6">
      <FornecedorSearchField
        value={fornecedorSelecionado}
        onSelect={selecionarFornecedor}
        onClear={limparFornecedor}
        disabled={avaliacaoSalvaNaSessao}
      />

      {fornecedorSelecionado ? (
        <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {fornecedorSelecionado.nome}
              </p>
              <p className="text-xs text-muted-foreground">
                Código: {fornecedorSelecionado.id}
                {fornecedorSelecionado.documento
                  ? ` · ${fornecedorSelecionado.documento}`
                  : ""}
              </p>
            </div>
            {ultimaAvaliacao ? (
              <Badge variant="outline">
                Última: {ultimaAvaliacao.media.toFixed(1)}/5 (
                {formatarData(getDataAvaliacao(ultimaAvaliacao))})
              </Badge>
            ) : (
              <Badge variant="secondary">Sem avaliações anteriores</Badge>
            )}
          </div>
        </div>
      ) : null}

      {fornecedorSelecionado && !avaliacaoSalvaNaSessao ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <AvaliacaoMetadadosForm
            metadados={metadados}
            responsavelNome={responsavelNome}
            onChange={setMetadados}
          />

          <AvaliacaoCriteriosForm notas={notas} onChange={alterarNota} />

          <div className="space-y-2">
            <Label htmlFor="av-forn-obs">Observações</Label>
            <Textarea
              id="av-forn-obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Comentários adicionais (opcional)"
              rows={3}
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={reiniciar}>
              Limpar
            </Button>
            <Button type="submit">Salvar avaliação</Button>
          </div>
        </form>
      ) : null}

      {sucesso ? (
        <p className="text-sm text-primary" role="status">
          {sucesso}
        </p>
      ) : null}

      {avaliacaoSalvaNaSessao && fornecedorSelecionado ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Avaliação concluída para{" "}
            <span className="font-medium text-foreground">
              {fornecedorSelecionado.nome}
            </span>
            . Busque outro fornecedor para uma nova avaliação.
          </p>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={reiniciar}>
              Nova avaliação
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
