import { Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@qualidade/components/ui/textarea";
import {
  RNC_ACAO_STATUS_OPCOES,
  RNC_SIM_NAO,
  rncFieldLabels,
} from "@qualidade/lib/registros/constants";
import {
  criarRncAcaoApartadaVazia,
  isoParaInputDate,
  type RncAcaoApartada,
  type RncDados,
} from "@qualidade/types/rnc";

interface RncAcoesApartadasTableProps {
  dados: RncDados;
  onChange: (dados: RncDados) => void;
  disabled?: boolean;
}

export function RncAcoesApartadasTable({
  dados,
  onChange,
  disabled = false,
}: RncAcoesApartadasTableProps) {
  const somenteLeitura = disabled;
  const acoes = dados.acoesApartadas ?? [];

  function patch(partial: Partial<RncDados>) {
    onChange({ ...dados, ...partial });
  }

  function atualizarAcao(id: string, partial: Partial<RncAcaoApartada>) {
    patch({
      acoesApartadas: acoes.map((item) =>
        item.id === id ? { ...item, ...partial } : item
      ),
    });
  }

  function definirInserirAcoes(valor: string) {
    const inserir = valor === "Sim";
    patch({
      inserirAcoesApartadas: inserir,
      acoesApartadas: inserir
        ? acoes.length > 0
          ? acoes
          : [criarRncAcaoApartadaVazia()]
        : [],
    });
  }

  function adicionarLinha() {
    patch({
      acoesApartadas: [...acoes, criarRncAcaoApartadaVazia()],
    });
  }

  function removerLinha(id: string) {
    const proximas = acoes.filter((item) => item.id !== id);
    patch({
      acoesApartadas:
        proximas.length > 0 ? proximas : [criarRncAcaoApartadaVazia()],
    });
  }

  return (
    <div className="space-y-4 sm:col-span-2">
      <div className="space-y-2">
        <Label>{rncFieldLabels.inserirAcoesApartadas}</Label>
        <Select
          value={dados.inserirAcoesApartadas ? "Sim" : "Não"}
          onValueChange={definirInserirAcoes}
          disabled={somenteLeitura}
        >
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {RNC_SIM_NAO.map((opcao) => (
              <SelectItem key={opcao} value={opcao}>
                {opcao}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {dados.inserirAcoesApartadas ? (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table bare>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Ação</TableHead>
                  <TableHead className="min-w-[160px]">Responsável</TableHead>
                  <TableHead className="min-w-[150px]">Prazo de execução</TableHead>
                  <TableHead className="min-w-[150px]">Status da ação</TableHead>
                  {!somenteLeitura ? (
                    <TableHead className="w-12" />
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {acoes.map((acao, index) => (
                  <TableRow key={acao.id}>
                    <TableCell className="align-top">
                      <Textarea
                        rows={2}
                        value={acao.acao}
                        onChange={(e) =>
                          atualizarAcao(acao.id, { acao: e.target.value })
                        }
                        placeholder={`Ação ${index + 1}`}
                        disabled={somenteLeitura}
                        className="min-w-[200px]"
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        value={acao.responsavel}
                        onChange={(e) =>
                          atualizarAcao(acao.id, { responsavel: e.target.value })
                        }
                        placeholder={`Responsável ação ${index + 1}`}
                        disabled={somenteLeitura}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        type="date"
                        value={isoParaInputDate(acao.prazoExecucao)}
                        onChange={(e) =>
                          atualizarAcao(acao.id, {
                            prazoExecucao: e.target.value
                              ? `${e.target.value}T12:00:00.000Z`
                              : "",
                          })
                        }
                        disabled={somenteLeitura}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Select
                        value={acao.status || undefined}
                        onValueChange={(v) =>
                          v &&
                          atualizarAcao(acao.id, {
                            status: v as RncAcaoApartada["status"],
                          })
                        }
                        disabled={somenteLeitura}
                      >
                        <SelectTrigger className="w-full min-w-[140px]">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {RNC_ACAO_STATUS_OPCOES.map((opcao) => (
                            <SelectItem key={opcao.value} value={opcao.value}>
                              {opcao.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    {!somenteLeitura ? (
                      <TableCell className="align-top">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removerLinha(acao.id)}
                          disabled={acoes.length <= 1}
                          aria-label={`Remover ação ${index + 1}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {!somenteLeitura ? (
            <Button type="button" variant="outline" size="sm" onClick={adicionarLinha}>
              <Plus className="mr-1 size-4" />
              Adicionar ação
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
