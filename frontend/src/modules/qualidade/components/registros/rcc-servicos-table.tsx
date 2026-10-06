import { Plus, Trash2 } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { Input } from "@qualidade/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qualidade/components/ui/table";
import { RccReclamacaoCatalogoSelect, TEXTOS_SERVICO_REALIZADO } from "@qualidade/components/registros/rcc-reclamacao-catalogo-select";
import { listarServicosRealizados } from "@qualidade/lib/api/qualidadeApi";
import { codigoAlfanumericoMaiusculo } from "@qualidade/lib/registros/codigo-alfanumerico";
import { rccFieldLabels } from "@qualidade/lib/registros/constants";
import { isoParaInputDate, criarRccLinhaServicoVazia, type RccLinhaServico } from "@qualidade/types/rcc";

interface RccServicosTableProps {
  linhas: RccLinhaServico[];
  codigosProduto?: string[];
  disabled?: boolean;
  /** Terceirizado não registra os horários de saída e chegada à empresa. */
  ocultarHorariosEmpresa?: boolean;
  erro?: string;
  obrigatorio?: boolean;
  onChange: (linhas: RccLinhaServico[]) => void;
}

function dataParaIso(valor: string): string {
  return valor ? `${valor}T12:00:00.000Z` : "";
}

function servicoDaLinha(linha: RccLinhaServico): string {
  return linha.texto.trim() || linha.lista1.trim() || linha.lista2.trim();
}

export function RccServicosTable({
  linhas,
  codigosProduto = [],
  disabled = false,
  ocultarHorariosEmpresa = false,
  erro,
  obrigatorio = false,
  onChange,
}: RccServicosTableProps) {
  const linhasExibidas = linhas.length > 0 ? linhas : [criarRccLinhaServicoVazia()];

  function atualizar(id: string, parcial: Partial<RccLinhaServico>) {
    onChange(linhasExibidas.map((linha) => (linha.id === id ? { ...linha, ...parcial } : linha)));
  }

  function adicionar() {
    onChange([...linhasExibidas, criarRccLinhaServicoVazia()]);
  }

  function remover(id: string) {
    const proximas = linhasExibidas.filter((linha) => linha.id !== id);
    onChange(proximas.length > 0 ? proximas : [criarRccLinhaServicoVazia()]);
  }

  return (
    <div
      className="space-y-3 sm:col-span-2"
      data-campo-pendente={erro ? "" : undefined}
    >
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table
          bare
          className={`rcc-servicos-grade w-full ${ocultarHorariosEmpresa ? "min-w-[960px]" : "min-w-[1280px]"}`}
        >
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-64">
                {rccFieldLabels.servicoRealizado}
                {obrigatorio ? " *" : ""}
              </TableHead>
              {ocultarHorariosEmpresa ? null : (
                <>
                  <TableHead className="min-w-40">{rccFieldLabels.horaSaidaEmpresa}</TableHead>
                  <TableHead className="min-w-40">{rccFieldLabels.horaChegadaEmpresa}</TableHead>
                </>
              )}
              <TableHead className="min-w-40">{rccFieldLabels.horaChegadaCliente}</TableHead>
              <TableHead className="min-w-40">{rccFieldLabels.horaSaidaCliente}</TableHead>
              <TableHead className="min-w-48">{rccFieldLabels.numeroSerieCompressor}</TableHead>
              <TableHead className="min-w-44">{rccFieldLabels.dataConclusaoServico}</TableHead>
              {disabled ? null : <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhasExibidas.map((linha, index) => (
              <TableRow key={linha.id} className="hover:bg-transparent">
                <TableCell className="align-top">
                  <RccReclamacaoCatalogoSelect
                    id={`rcc-servico-${linha.id}`}
                    value={servicoDaLinha(linha)}
                    onChange={(texto) => atualizar(linha.id, { texto, lista1: "", lista2: "" })}
                    codigosProduto={codigosProduto}
                    disabled={disabled}
                    ocultarRotulo
                    ocultarAjuda={index > 0}
                    carregarCatalogo={listarServicosRealizados}
                    textos={TEXTOS_SERVICO_REALIZADO}
                  />
                </TableCell>
                {ocultarHorariosEmpresa ? null : (
                  <>
                    <TableCell className="align-top">
                      <Input
                        type="time"
                        aria-label={rccFieldLabels.horaSaidaEmpresa}
                        value={linha.horaSaidaEmpresa}
                        disabled={disabled}
                        onChange={(event) =>
                          atualizar(linha.id, { horaSaidaEmpresa: event.target.value })
                        }
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        type="time"
                        aria-label={rccFieldLabels.horaChegadaEmpresa}
                        value={linha.horaChegadaEmpresa}
                        disabled={disabled}
                        onChange={(event) =>
                          atualizar(linha.id, { horaChegadaEmpresa: event.target.value })
                        }
                      />
                    </TableCell>
                  </>
                )}
                <TableCell className="align-top">
                  <Input
                    type="time"
                    aria-label={rccFieldLabels.horaChegadaCliente}
                    value={linha.horaChegadaCliente}
                    disabled={disabled}
                    onChange={(event) =>
                      atualizar(linha.id, { horaChegadaCliente: event.target.value })
                    }
                  />
                </TableCell>
                <TableCell className="align-top">
                  <Input
                    type="time"
                    aria-label={rccFieldLabels.horaSaidaCliente}
                    value={linha.horaSaidaCliente}
                    disabled={disabled}
                    onChange={(event) =>
                      atualizar(linha.id, { horaSaidaCliente: event.target.value })
                    }
                  />
                </TableCell>
                <TableCell className="align-top">
                  <Input
                    aria-label={rccFieldLabels.numeroSerieCompressor}
                    value={codigoAlfanumericoMaiusculo(linha.numeroSerieCompressor)}
                    autoComplete="off"
                    spellCheck={false}
                    className="uppercase"
                    disabled={disabled}
                    onChange={(event) => {
                      atualizar(linha.id, {
                        numeroSerieCompressor: codigoAlfanumericoMaiusculo(event.target.value),
                      });
                    }}
                  />
                </TableCell>
                <TableCell className="align-top">
                  <Input
                    type="date"
                    aria-label={rccFieldLabels.dataConclusaoServico}
                    value={isoParaInputDate(linha.dataConclusaoServico)}
                    disabled={disabled}
                    onChange={(event) =>
                      atualizar(linha.id, { dataConclusaoServico: dataParaIso(event.target.value) })
                    }
                  />
                </TableCell>
                {disabled ? null : (
                  <TableCell className="align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remover serviço"
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
      {disabled ? null : (
        <Button type="button" variant="outline" size="sm" onClick={adicionar}>
          <Plus className="size-4" />
          Adicionar linha
        </Button>
      )}
      {erro ? (
        <p className="text-xs text-destructive" role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
