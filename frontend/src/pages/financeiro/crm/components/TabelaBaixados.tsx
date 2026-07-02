import { useEffect, useMemo } from "react";
import {
  formatCurrency,
  formatDate,
  formatText,
  formatWeekday,
  isTituloDescontado,
  shouldHighlightVencimentoDayLabel,
} from "../lib/formatters";
import { isRecebimentoDesconsideradoPorDiaNaoUtil } from "../lib/atraso-recebimento";
import { LEGENDA_CORES_BAIXADOS } from "../lib/legenda-baixados";
import { useColumnResize } from "../hooks/useColumnResize";
import { useMultiSort } from "../hooks/useMultiSort";
import type { Recebimento } from "../lib/types";
import CabecalhoSecaoCrm from "./CabecalhoSecaoCrm";

const COLUMN_IDS = [
  "codigo",
  "dataEmissao",
  "dataCompetencia",
  "dataVencimento",
  "dataBaixa",
  "dataRecebimento",
  "formaPagamento",
  "contaBancaria",
  "pessoa",
  "descricao",
  "comentariosAgendamento",
  "comentariosLancamento",
  "nfeOrigem",
  "totalDias",
  "valorAteVencimento",
  "valorBaixado",
  "valorRecebido",
  "valorJuros",
] as const;

type ColumnId = (typeof COLUMN_IDS)[number];

/** Larguras iniciais em pixels */
const DEFAULT_COLUMN_WIDTHS: Record<ColumnId, number> = {
  codigo: 80,
  dataEmissao: 96,
  dataCompetencia: 96,
  dataVencimento: 96,
  dataBaixa: 96,
  dataRecebimento: 108,
  formaPagamento: 96,
  contaBancaria: 140,
  pessoa: 168,
  descricao: 200,
  comentariosAgendamento: 160,
  comentariosLancamento: 160,
  nfeOrigem: 104,
  totalDias: 80,
  valorAteVencimento: 128,
  valorBaixado: 120,
  valorRecebido: 128,
  valorJuros: 96,
};

export const BAIXADOS_MODAL_COLUMN_WIDTHS: Record<ColumnId, number> = {
  codigo: 80,
  dataEmissao: 100,
  dataCompetencia: 100,
  dataVencimento: 100,
  dataBaixa: 100,
  dataRecebimento: 112,
  formaPagamento: 100,
  contaBancaria: 150,
  pessoa: 200,
  descricao: 240,
  comentariosAgendamento: 170,
  comentariosLancamento: 170,
  nfeOrigem: 110,
  totalDias: 80,
  valorAteVencimento: 128,
  valorBaixado: 120,
  valorRecebido: 128,
  valorJuros: 100,
};

const BAIXADOS_FLEX_WEIGHTS: Partial<Record<ColumnId, number>> = {
  contaBancaria: 1,
  pessoa: 2.5,
  descricao: 3,
  comentariosAgendamento: 2,
  comentariosLancamento: 2,
};

interface Props {
  titulo: string;
  valorSecao?: number;
  dados: Recebimento[];
  tipo?: "receber" | "pagar";
  /** Ref atualizada com a ordem exibida na tabela (para exportação em PDF). */
  sortedDataRef?: React.MutableRefObject<Recebimento[] | null>;
  scrollClassName?: string;
  storageKey?: string;
  defaultColumnWidths?: Record<ColumnId, number>;
  preencherLargura?: boolean;
  variant?: "default" | "modal";
  ocultarRodape?: boolean;
  /** Destaca cada linha em verde (recebimentos recuperados no modal). */
  linhaRecuperado?: boolean;
}

const td = "px-1.5 py-1.5 align-top";

type ColunaDef = {
  id: string;
  label: string;
  wrap: boolean;
  align?: "left" | "right" | "center";
};

const ATRASO_DESCONSIDERADO_TITLE =
  "Atraso desconsiderado — vencimento em sábado, domingo ou feriado (nacional/Nordeste), pago no 1º dia útil";

function totalDiasClass(
  row: Recebimento,
  value: number | null,
): string {
  if (value == null) return "";
  if (isRecebimentoDesconsideradoPorDiaNaoUtil(row)) {
    return "bg-slate-400 font-semibold text-white";
  }
  if (value < 0) return "bg-red-500 font-semibold text-white";
  return "";
}

function valorJurosClass(row: Recebimento): string {
  if (isRecebimentoDesconsideradoPorDiaNaoUtil(row)) {
    return "bg-slate-400 font-semibold text-white";
  }
  if (
    row.totalDias != null &&
    row.totalDias < 0 &&
    row.valorJuros <= 0
  ) {
    return "bg-orange-500 font-semibold text-white";
  }
  return "";
}

function buildColunas(tipo: "receber" | "pagar"): Record<ColumnId, ColunaDef> {
  return {
    codigo: { id: "codigo", label: "Código", wrap: false },
    dataEmissao: {
      id: "dataEmissao",
      label: "Data de\nEmissão NF",
      wrap: true,
    },
    dataVencimento: {
      id: "dataVencimento",
      label: "Data vencim.",
      wrap: false,
    },
    dataBaixa: { id: "dataBaixa", label: "Data baixa", wrap: false },
    dataRecebimento: {
      id: "dataRecebimento",
      label:
        tipo === "receber"
          ? "Data recebim./\nde fidc"
          : "Data pagam./\nde fidc",
      wrap: true,
    },
    dataCompetencia: {
      id: "dataCompetencia",
      label: "Competência",
      wrap: false,
    },
    contaBancaria: {
      id: "contaBancaria",
      label: "Conta bancária",
      wrap: true,
    },
    formaPagamento: {
      id: "formaPagamento",
      label: "Forma pagamento",
      wrap: true,
    },
    pessoa: { id: "pessoa", label: "Pessoa", wrap: true },
    descricao: {
      id: "descricao",
      label: "Descrição do\nlançamento",
      wrap: true,
    },
    comentariosAgendamento: {
      id: "comentariosAgendamento",
      label: "Comentário\nCont. a Receber",
      wrap: true,
    },
    comentariosLancamento: {
      id: "comentariosLancamento",
      label: "Comentário\nRecebimentos",
      wrap: true,
    },
    nfeOrigem: {
      id: "nfeOrigem",
      label: "NF-e origem",
      wrap: true,
    },
    totalDias: {
      id: "totalDias",
      label: "Total de dias",
      wrap: false,
      align: "center" as const,
    },
    valorAteVencimento: {
      id: "valorAteVencimento",
      label: "Valor até a\ndata de vencimento",
      wrap: true,
      align: "right" as const,
    },
    valorBaixado: {
      id: "valorBaixado",
      label: "Valor baixado",
      wrap: false,
      align: "right" as const,
    },
    valorRecebido: {
      id: "valorRecebido",
      label:
        tipo === "receber"
          ? "Total Valor\nrecebido"
          : "Total Valor\npago",
      wrap: true,
      align: "right" as const,
    },
    valorJuros: {
      id: "valorJuros",
      label: "Total Juros",
      wrap: false,
      align: "right" as const,
    },
  };
}

function BaixadoRow({
  row,
  index,
  linhaRecuperado = false,
}: {
  row: Recebimento;
  index: number;
  linhaRecuperado?: boolean;
}) {
  const rowClass = linhaRecuperado
    ? index % 2 === 0
      ? "bg-emerald-50"
      : "bg-emerald-100"
    : index % 2 === 0
      ? "table-row-even"
      : "table-row-odd";

  return (
    <tr className={rowClass}>
      <td className={`${td} cell-nowrap font-mono text-xs`}>{row.codigo}</td>
      <td className={`${td} cell-nowrap`}>{formatDate(row.dataEmissao)}</td>
      <td className={`${td} cell-nowrap`}>{formatDate(row.dataCompetencia)}</td>
      <td className={`${td} cell-wrap`}>
        <span className="block whitespace-nowrap">
          {formatDate(row.dataVencimento)}
        </span>
        {formatWeekday(row.dataVencimento) && (
          <span
            className={`block text-[11px] capitalize leading-tight ${
              shouldHighlightVencimentoDayLabel(row.dataVencimento)
                ? "font-semibold text-orange-500"
                : "text-slate-500"
            }`}
          >
            {formatWeekday(row.dataVencimento)}
          </span>
        )}
      </td>
      <td className={`${td} cell-nowrap`}>{formatDate(row.dataBaixa)}</td>
      <td className={`${td} cell-nowrap`}>{formatDate(row.dataRecebimento)}</td>
      <td className={`${td} cell-wrap`}>{row.formaPagamento ?? "—"}</td>
      <td className={`${td} cell-wrap`}>{row.contaBancaria ?? "—"}</td>
      <td className={`${td} cell-wrap`}>{row.pessoa ?? "—"}</td>
      <td className={`${td} cell-wrap`}>{formatText(row.descricao)}</td>
      <td
        className={`${td} cell-wrap ${
          isTituloDescontado(row.comentariosAgendamento)
            ? "bg-yellow-300 font-semibold text-slate-900"
            : ""
        }`}
      >
        {formatText(row.comentariosAgendamento)}
      </td>
      <td
        className={`${td} cell-wrap ${
          isTituloDescontado(row.comentariosLancamento)
            ? "bg-yellow-300 font-semibold text-slate-900"
            : ""
        }`}
      >
        {formatText(row.comentariosLancamento)}
      </td>
      <td className={`${td} cell-wrap`}>{formatText(row.nfeOrigem)}</td>
      <td
        className={`${td} cell-nowrap text-center ${totalDiasClass(row, row.totalDias)}`}
        title={
          isRecebimentoDesconsideradoPorDiaNaoUtil(row)
            ? ATRASO_DESCONSIDERADO_TITLE
            : undefined
        }
      >
        {row.totalDias == null ? "—" : row.totalDias}
      </td>
      <td className={`${td} cell-nowrap text-right`}>
        {formatCurrency(row.valorAteVencimento)}
      </td>
      <td className={`${td} cell-nowrap text-right`}>
        {formatCurrency(row.valorBaixado)}
      </td>
      <td className={`${td} cell-nowrap text-right font-semibold`}>
        {formatCurrency(row.valorRecebido)}
      </td>
      <td
        className={`${td} cell-nowrap text-right ${valorJurosClass(row)}`}
        title={
          isRecebimentoDesconsideradoPorDiaNaoUtil(row)
            ? ATRASO_DESCONSIDERADO_TITLE
            : row.totalDias != null && row.totalDias < 0 && row.valorJuros <= 0
              ? "Pagamento em atraso sem juros lançados"
              : undefined
        }
      >
        {formatCurrency(row.valorJuros)}
      </td>
    </tr>
  );
}

function LegendaCoresBaixados() {
  const dot = (className: string) => (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`}
      aria-hidden="true"
    />
  );

  const sep = (
    <span className="hidden text-slate-300 sm:inline" aria-hidden="true">
      ;
    </span>
  );

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] leading-snug text-slate-600 sm:text-xs">
      {LEGENDA_CORES_BAIXADOS.map((item, index) => (
        <span key={item.descricao} className="contents">
          {index > 0 && sep}
          {item.tipo === "texto-colorido" ? (
            <span className="inline-flex items-center gap-1.5">
              <span className={`font-semibold ${item.corRotuloClass}`}>
                {item.rotulo}
              </span>
              {dot(item.corBolinhaClass)}
              <span>: {item.descricao}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              {dot(item.corBolinhaClass)}
              <span>{item.descricao}</span>
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

export default function TabelaBaixados({
  titulo,
  valorSecao,
  dados,
  tipo = "receber",
  sortedDataRef,
  scrollClassName = "table-crm-scroll-y",
  storageKey = "crm-baixados-col-widths-v3",
  defaultColumnWidths = DEFAULT_COLUMN_WIDTHS,
  preencherLargura = false,
  variant = "default",
  ocultarRodape = false,
  linhaRecuperado = false,
}: Props) {
  const COLunas = useMemo(() => buildColunas(tipo), [tipo]);
  const { startResize, tableRef } = useColumnResize(
    COLUMN_IDS,
    defaultColumnWidths,
    {
      minWidthPx: 48,
      storageKey,
      fillContainer: preencherLargura,
      flexColumnWeights: BAIXADOS_FLEX_WEIGHTS,
    },
  );
  const sortColumns = useMemo(
    () => ({
      codigo: {
        id: "codigo",
        getValue: (row: Recebimento) => row.codigo,
      },
      dataEmissao: {
        id: "dataEmissao",
        getValue: (row: Recebimento) => row.dataEmissao,
      },
      dataVencimento: {
        id: "dataVencimento",
        getValue: (row: Recebimento) => row.dataVencimento,
      },
      dataBaixa: {
        id: "dataBaixa",
        getValue: (row: Recebimento) => row.dataBaixa,
      },
      dataRecebimento: {
        id: "dataRecebimento",
        getValue: (row: Recebimento) => row.dataRecebimento,
      },
      dataCompetencia: {
        id: "dataCompetencia",
        getValue: (row: Recebimento) => row.dataCompetencia,
      },
      contaBancaria: {
        id: "contaBancaria",
        getValue: (row: Recebimento) => row.contaBancaria ?? "",
      },
      formaPagamento: {
        id: "formaPagamento",
        getValue: (row: Recebimento) => row.formaPagamento ?? "",
      },
      pessoa: {
        id: "pessoa",
        getValue: (row: Recebimento) => row.pessoa ?? "",
      },
      descricao: {
        id: "descricao",
        getValue: (row: Recebimento) => row.descricao ?? "",
      },
      comentariosAgendamento: {
        id: "comentariosAgendamento",
        getValue: (row: Recebimento) => row.comentariosAgendamento ?? "",
      },
      comentariosLancamento: {
        id: "comentariosLancamento",
        getValue: (row: Recebimento) => row.comentariosLancamento ?? "",
      },
      nfeOrigem: {
        id: "nfeOrigem",
        getValue: (row: Recebimento) => row.nfeOrigem ?? "",
      },
      totalDias: {
        id: "totalDias",
        getValue: (row: Recebimento) => row.totalDias ?? Number.NEGATIVE_INFINITY,
      },
      valorAteVencimento: {
        id: "valorAteVencimento",
        getValue: (row: Recebimento) => row.valorAteVencimento,
      },
      valorBaixado: {
        id: "valorBaixado",
        getValue: (row: Recebimento) => row.valorBaixado,
      },
      valorRecebido: {
        id: "valorRecebido",
        getValue: (row: Recebimento) => row.valorRecebido,
      },
      valorJuros: {
        id: "valorJuros",
        getValue: (row: Recebimento) => row.valorJuros,
      },
    }),
    [],
  );

  const { sortedData, handleSort, getSortMeta } = useMultiSort(
    dados,
    sortColumns,
    [
      { id: "dataVencimento", direction: "asc" },
      { id: "dataRecebimento", direction: "asc" },
      { id: "codigo", direction: "asc" },
    ],
  );

  useEffect(() => {
    if (sortedDataRef) {
      sortedDataRef.current = sortedData;
    }
  }, [sortedData, sortedDataRef]);

  const isModal = variant === "modal";
  const wrapperClass =
    variant === "modal"
      ? "table-crm-wrapper table-crm-scroll-modal"
      : `table-crm-wrapper ${scrollClassName}`;

  return (
    <section
      className={
        isModal
          ? "table-crm-section table-crm-section-modal"
          : "table-crm-section w-full max-w-full min-w-0"
      }
    >
      {titulo && (
        <CabecalhoSecaoCrm
          titulo={titulo}
          valorSecao={valorSecao}
          className="border-b border-slate-200 bg-indigo-700 px-4 py-3"
        />
      )}
      {!isModal && <LegendaCoresBaixados />}
      <div className={wrapperClass}>
        <table
          ref={tableRef}
          className="table-crm table-crm-dense table-crm-resizable text-sm"
        >
          <colgroup>
            {COLUMN_IDS.map((id) => (
              <col key={id} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500 [&>th]:bg-slate-50">
              {COLUMN_IDS.map((columnId) => {
                const coluna = COLunas[columnId];
                const sortMeta = getSortMeta(coluna.id);
                return (
                  <th
                    key={coluna.id}
                    className={`sortable text-xs uppercase tracking-wide text-slate-500 ${
                      coluna.align === "right"
                        ? "text-right"
                        : coluna.align === "center"
                          ? "text-center"
                          : "text-left"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(event) =>
                        handleSort(
                          coluna.id,
                          event.ctrlKey || event.metaKey,
                        )
                      }
                      className={`sort-header ${
                        coluna.align === "right"
                          ? "sort-header-right"
                          : coluna.align === "center"
                            ? "justify-center"
                            : ""
                      } ${coluna.wrap ? "cell-wrap" : "cell-nowrap"}`}
                      title="Clique para ordenar. Ctrl+clique para ordenar por várias colunas."
                    >
                      <span>{coluna.label}</span>
                      {sortMeta && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-indigo-600">
                          <span aria-hidden="true">
                            {sortMeta.direction === "asc" ? "↑" : "↓"}
                          </span>
                          {sortMeta.priority && (
                            <span className="rounded bg-indigo-100 px-1 text-[10px] font-bold">
                              {sortMeta.priority}
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Redimensionar coluna ${coluna.label.replace("\n", " ")}`}
                      className="col-resize-handle"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        startResize(columnId, event.clientX);
                      }}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMN_IDS.length}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  Não há registros para exibição
                </td>
              </tr>
            ) : (
              sortedData.map((row, index) => (
                <BaixadoRow
                  key={`${row.codigo}-${index}`}
                  row={row}
                  index={index}
                  linhaRecuperado={linhaRecuperado}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      {sortedData.length > 0 && !ocultarRodape && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          {sortedData.length} registro(s)
        </div>
      )}
    </section>
  );
}
