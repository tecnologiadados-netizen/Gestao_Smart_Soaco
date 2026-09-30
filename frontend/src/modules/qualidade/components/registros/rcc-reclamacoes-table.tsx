import { useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { Textarea } from "@qualidade/components/ui/textarea";
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
import {
  RccReclamacaoCatalogoSelect,
  TEXTOS_CAUSA_PROBLEMA,
} from "@qualidade/components/registros/rcc-reclamacao-catalogo-select";
import { listarCausasProblema } from "@qualidade/lib/api/qualidadeApi";
import { RCC_SIM_NAO } from "@qualidade/lib/registros/constants";
import {
  criarRccLinhaReclamacaoVazia,
  type RccLinhaReclamacao,
} from "@qualidade/types/rcc";

const OPCAO_SELECIONE = "Selecione...";

interface RccReclamacoesTableProps {
  linhas: RccLinhaReclamacao[];
  codigosProduto: string[];
  disabled?: boolean;
  somenteLeitura?: boolean;
  origemNomus?: boolean;
  erroDescricao?: string;
  erroCategoria?: string;
  erroAceita?: string;
  erroCausa?: string;
  /** Aceita e causa passam a ser obrigatórias quando a RCC está sendo encerrada. */
  exigirEncerramento?: boolean;
  onChange: (linhas: RccLinhaReclamacao[]) => void;
}

export function RccReclamacoesTable({
  linhas,
  codigosProduto,
  disabled = false,
  somenteLeitura = false,
  origemNomus = false,
  erroDescricao,
  erroCategoria,
  erroAceita,
  erroCausa,
  exigirEncerramento = false,
  onChange,
}: RccReclamacoesTableProps) {
  const travado = disabled || somenteLeitura;
  const linhaVaziaRef = useRef<RccLinhaReclamacao | null>(null);
  if (!linhaVaziaRef.current) linhaVaziaRef.current = criarRccLinhaReclamacaoVazia();
  const linhasExibidas = linhas.length > 0 ? linhas : [linhaVaziaRef.current];

  function atualizar(id: string, patch: Partial<RccLinhaReclamacao>) {
    onChange(linhasExibidas.map((linha) => (linha.id === id ? { ...linha, ...patch } : linha)));
  }

  function adicionar() {
    onChange([...linhasExibidas, criarRccLinhaReclamacaoVazia()]);
  }

  function remover(id: string) {
    const proximas = linhasExibidas.filter((linha) => linha.id !== id);
    onChange(proximas.length > 0 ? proximas : [criarRccLinhaReclamacaoVazia()]);
  }

  const pendente = Boolean(erroDescricao || erroCategoria || erroAceita || erroCausa);

  return (
    <div
      className="space-y-3 sm:col-span-2"
      data-campo-pendente={pendente ? "" : undefined}
    >
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table bare className="rcc-reclamacoes-grade w-full min-w-[1040px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-64">Descrição da reclamação *</TableHead>
              <TableHead className="min-w-56">Categorize a reclamação *</TableHead>
              <TableHead className="w-40">Aceita{exigirEncerramento ? " *" : ""}</TableHead>
              <TableHead className="min-w-64">
                Causa do problema{exigirEncerramento ? " *" : ""}
              </TableHead>
              <TableHead className="min-w-56">Comentário</TableHead>
              {travado ? null : <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhasExibidas.map((linha, index) => (
              <TableRow key={linha.id} className="hover:bg-transparent">
                <TableCell className="align-top">
                  <Textarea
                    value={linha.texto}
                    aria-label="Descrição da reclamação"
                    rows={3}
                    disabled={travado}
                    readOnly={origemNomus}
                    onChange={(event) => atualizar(linha.id, { texto: event.target.value })}
                  />
                </TableCell>
                <TableCell className="align-top">
                  <RccReclamacaoCatalogoSelect
                    id={`rcc-reclamacao-lista-${linha.id}`}
                    value={linha.lista}
                    onChange={(lista) => atualizar(linha.id, { lista })}
                    codigosProduto={codigosProduto}
                    disabled={travado}
                    ocultarRotulo
                    ocultarAjuda={index > 0}
                  />
                </TableCell>
                <TableCell className="align-top">
                  <Select
                    value={linha.aceita || undefined}
                    onValueChange={(valor) =>
                      atualizar(linha.id, {
                        aceita: !valor || valor === OPCAO_SELECIONE ? "" : valor,
                      })
                    }
                    disabled={travado}
                  >
                    <SelectTrigger className="w-full" aria-label="Reclamação aceita?">
                      <SelectValue placeholder={OPCAO_SELECIONE} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={OPCAO_SELECIONE}>{OPCAO_SELECIONE}</SelectItem>
                      {RCC_SIM_NAO.map((opcao) => (
                        <SelectItem key={opcao} value={opcao}>
                          {opcao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="align-top">
                  <RccReclamacaoCatalogoSelect
                    id={`rcc-causa-${linha.id}`}
                    value={linha.causa ?? ""}
                    onChange={(causa) => atualizar(linha.id, { causa })}
                    codigosProduto={codigosProduto}
                    disabled={travado}
                    ocultarRotulo
                    ocultarAjuda={index > 0}
                    carregarCatalogo={listarCausasProblema}
                    textos={TEXTOS_CAUSA_PROBLEMA}
                  />
                </TableCell>
                <TableCell className="align-top">
                  <Textarea
                    value={linha.comentario ?? ""}
                    aria-label="Comentário"
                    rows={3}
                    disabled={travado}
                    readOnly={origemNomus}
                    onChange={(event) => atualizar(linha.id, { comentario: event.target.value })}
                  />
                </TableCell>
                {travado ? null : (
                  <TableCell className="align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remover reclamação"
                      onClick={() => remover(linha.id)}
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
      {travado ? null : (
        <Button type="button" variant="outline" size="sm" onClick={adicionar}>
          <Plus className="size-4" />
          Adicionar linha
        </Button>
      )}
      {[erroDescricao, erroCategoria, erroAceita, erroCausa].filter(Boolean).map((mensagem) => (
        <p key={mensagem} className="text-xs text-destructive" role="alert">
          {mensagem}
        </p>
      ))}
    </div>
  );
}
