import { useMemo } from "react";
import {
  formatCurrency,
  formatDate,
  formatDiasAteAtrasar,
  formatDiasAtraso,
  formatText,
  isTituloDescontado,
} from "../lib/formatters";
import { useColumnResize } from "../hooks/useColumnResize";
import { useMultiSort } from "../hooks/useMultiSort";
import type { ContaFinanceira } from "../lib/types";
import CabecalhoSecaoCrm from "./CabecalhoSecaoCrm";

const COLUMN_IDS = [
  "codigo",
  "dataVencimento",
  "dataAgendamento",
  "classificacao",
  "empresa",
  "contaBancaria",
  "formaPagamento",
  "pessoa",
  "descricao",
  "comentariosAgendamento",
  "comentariosLancamento",
  "diasAtraso",
  "nfeOrigem",
  "valor",
] as const;

type ColumnId = (typeof COLUMN_IDS)[number];

const DEFAULT_COLUMN_WIDTHS: Record<ColumnId, number> = {
  codigo: 80,
  dataVencimento: 96,
  dataAgendamento: 96,
  classificacao: 168,
  empresa: 132,
  contaBancaria: 156,
  formaPagamento: 104,
  pessoa: 188,
  descricao: 200,
  comentariosAgendamento: 140,
  comentariosLancamento: 140,
  diasAtraso: 76,
  nfeOrigem: 104,
  valor: 120,
};

export const CONTAS_MODAL_COLUMN_WIDTHS: Record<ColumnId, number> = {
  codigo: 80,
  dataVencimento: 100,
  dataAgendamento: 100,
  classificacao: 180,
  empresa: 140,
  contaBancaria: 170,
  formaPagamento: 110,
  pessoa: 220,
  descricao: 240,
  comentariosAgendamento: 150,
  comentariosLancamento: 150,
  diasAtraso: 84,
  nfeOrigem: 110,
  valor: 130,
};

const CONTAS_FLEX_WEIGHTS: Partial<Record<ColumnId, number>> = {
  classificacao: 2,
  empresa: 1,
  contaBancaria: 1.5,
  pessoa: 2.5,
  descricao: 3,
  comentariosAgendamento: 2,
  comentariosLancamento: 2,
};

interface Props {
  titulo: string;
  valorSecao?: number;
  subtitulo?: string;
  dados: ContaFinanceira[];
  destaque?: "danger" | "success";
  scrollClassName?: string;
  storageKey?: string;
  defaultColumnWidths?: Record<ColumnId, number>;
  preencherLargura?: boolean;
  variant?: "default" | "modal";
  ocultarRodape?: boolean;
}

const td = "px-1.5 py-1.5 align-top";

type ColunaDef = {
  id: ColumnId;
  label: string;
  wrap: boolean;
  align?: "left" | "right" | "center";
};

function buildColunas(isAtraso: boolean): Record<ColumnId, ColunaDef> {
  return {
    codigo: { id: "codigo", label: "Código", wrap: false },
    dataVencimento: {
      id: "dataVencimento",
      label: "Vencimento",
      wrap: false,
    },
    dataAgendamento: {
      id: "dataAgendamento",
      label: "Agendamento",
      wrap: false,
    },
    classificacao: {
      id: "classificacao",
      label: "Classificação",
      wrap: true,
    },
    empresa: { id: "empresa", label: "Empresa", wrap: true },
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
    diasAtraso: {
      id: "diasAtraso",
      label: isAtraso ? "Dias em\natraso" : "Dias até\natrasar",
      wrap: true,
      align: "center",
    },
    nfeOrigem: { id: "nfeOrigem", label: "NF-e origem", wrap: true },
    valor: {
      id: "valor",
      label: "Valor",
      wrap: false,
      align: "right",
    },
  };
}

function ContaRow({
  row,
  index,
  isAtraso,
}: {
  row: ContaFinanceira;
  index: number;
  isAtraso: boolean;
}) {
  return (
    <tr className={index % 2 === 0 ? "table-row-even" : "table-row-odd"}>
      <td className={`${td} cell-nowrap font-mono text-xs`}>{row.codigo}</td>
      <td className={`${td} cell-nowrap`}>{formatDate(row.dataVencimento)}</td>
      <td className={`${td} cell-nowrap`}>
        {formatDate(row.dataAgendamento)}
      </td>
      <td className={`${td} cell-wrap`}>
        <span className="block font-medium text-slate-800 dark:text-slate-100">
          {row.nomeClassificacao ?? "—"}
        </span>
        {row.classificacao && (
          <span className="text-xs text-slate-400 dark:text-slate-500">{row.classificacao}</span>
        )}
      </td>
      <td className={`${td} cell-wrap`}>{row.empresa ?? "—"}</td>
      <td className={`${td} cell-wrap`}>{row.contaBancaria ?? "—"}</td>
      <td className={`${td} cell-wrap`}>{row.formaPagamento ?? "—"}</td>
      <td className={`${td} cell-wrap`}>{row.pessoa ?? "—"}</td>
      <td className={`${td} cell-wrap`}>{row.descricao ?? "—"}</td>
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
      <td
        className={`${td} cell-nowrap text-center font-semibold ${
          isAtraso
            ? row.diasAtraso > 0
              ? "bg-red-500 text-white"
              : "text-slate-400 dark:text-slate-500"
            : "text-emerald-700 dark:text-emerald-400"
        }`}
      >
        {isAtraso
          ? formatDiasAtraso(row.diasAtraso)
          : formatDiasAteAtrasar(row.diasAtraso, row.dataVencimento)}
      </td>
      <td className={`${td} cell-wrap`}>{row.nfeOrigem ?? "—"}</td>
      <td className={`${td} cell-nowrap text-right font-semibold`}>
        {formatCurrency(row.valor)}
      </td>
    </tr>
  );
}

export default function TabelaContas({
  titulo,
  valorSecao,
  subtitulo,
  dados,
  destaque,
  scrollClassName = "table-crm-scroll-y",
  storageKey = "crm-contas-col-widths-v2",
  defaultColumnWidths = DEFAULT_COLUMN_WIDTHS,
  preencherLargura = false,
  variant = "default",
  ocultarRodape = false,
}: Props) {
  const isAtraso = destaque === "danger";
  const colunas = useMemo(() => buildColunas(isAtraso), [isAtraso]);

  const { startResize, tableRef } = useColumnResize(
    COLUMN_IDS,
    defaultColumnWidths,
    {
      minWidthPx: 48,
      storageKey,
      fillContainer: preencherLargura,
      flexColumnWeights: CONTAS_FLEX_WEIGHTS,
    },
  );

  const sortColumns = useMemo(
    () => ({
      codigo: {
        id: "codigo",
        getValue: (row: ContaFinanceira) => row.codigo,
      },
      dataVencimento: {
        id: "dataVencimento",
        getValue: (row: ContaFinanceira) => row.dataVencimento,
      },
      dataAgendamento: {
        id: "dataAgendamento",
        getValue: (row: ContaFinanceira) => row.dataAgendamento,
      },
      classificacao: {
        id: "classificacao",
        getValue: (row: ContaFinanceira) =>
          `${row.nomeClassificacao ?? ""} ${row.classificacao ?? ""}`.trim(),
      },
      empresa: {
        id: "empresa",
        getValue: (row: ContaFinanceira) => row.empresa ?? "",
      },
      contaBancaria: {
        id: "contaBancaria",
        getValue: (row: ContaFinanceira) => row.contaBancaria ?? "",
      },
      formaPagamento: {
        id: "formaPagamento",
        getValue: (row: ContaFinanceira) => row.formaPagamento ?? "",
      },
      pessoa: {
        id: "pessoa",
        getValue: (row: ContaFinanceira) => row.pessoa ?? "",
      },
      descricao: {
        id: "descricao",
        getValue: (row: ContaFinanceira) => row.descricao ?? "",
      },
      comentariosAgendamento: {
        id: "comentariosAgendamento",
        getValue: (row: ContaFinanceira) => row.comentariosAgendamento ?? "",
      },
      comentariosLancamento: {
        id: "comentariosLancamento",
        getValue: (row: ContaFinanceira) => row.comentariosLancamento ?? "",
      },
      diasAtraso: {
        id: "diasAtraso",
        getValue: (row: ContaFinanceira) => row.diasAtraso,
      },
      nfeOrigem: {
        id: "nfeOrigem",
        getValue: (row: ContaFinanceira) => row.nfeOrigem ?? "",
      },
      valor: {
        id: "valor",
        getValue: (row: ContaFinanceira) => row.valor,
      },
    }),
    [],
  );

  const { sortedData, handleSort, getSortMeta } = useMultiSort(
    dados,
    sortColumns,
    [
      { id: "dataVencimento", direction: "asc" },
      { id: "codigo", direction: "asc" },
    ],
  );

  const headerClass =
    destaque === "danger"
      ? "bg-red-600"
      : destaque === "success"
        ? "bg-emerald-600"
        : "bg-blue-700";

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
          subtitulo={subtitulo}
          className={`${headerClass} px-4 py-3`}
        />
      )}
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
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 [&>th]:bg-slate-50 dark:[&>th]:bg-slate-800">
              {COLUMN_IDS.map((columnId) => {
                const coluna = colunas[columnId];
                const sortMeta = getSortMeta(coluna.id);
                const diasHeaderClass =
                  columnId === "diasAtraso" && isAtraso
                    ? "!bg-red-500 text-white"
                    : "";

                return (
                  <th
                    key={coluna.id}
                    className={`sortable text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300 ${diasHeaderClass} ${
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
                      } ${coluna.wrap ? "cell-wrap" : "cell-nowrap"} ${
                        diasHeaderClass ? "text-white hover:bg-red-600" : ""
                      }`}
                      title="Clique para ordenar. Ctrl+clique para ordenar por várias colunas."
                    >
                      <span>{coluna.label}</span>
                      {sortMeta && (
                        <span
                          className={`inline-flex shrink-0 items-center gap-0.5 ${
                            diasHeaderClass ? "text-white" : "text-indigo-600"
                          }`}
                        >
                          <span aria-hidden="true">
                            {sortMeta.direction === "asc" ? "↑" : "↓"}
                          </span>
                          {sortMeta.priority && (
                            <span
                              className={`rounded px-1 text-[10px] font-bold ${
                                diasHeaderClass
                                  ? "bg-red-700 text-white"
                                  : "bg-indigo-100"
                              }`}
                            >
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
                  className="px-4 py-8 text-center text-slate-400 dark:text-slate-500"
                >
                  Não há registros para exibição
                </td>
              </tr>
            ) : (
              sortedData.map((row, index) => (
                <ContaRow
                  key={row.codigo}
                  row={row}
                  index={index}
                  isAtraso={isAtraso}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      {dados.length > 0 && !ocultarRodape && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          {dados.length} registro(s) · Total:{" "}
          <strong>
            {formatCurrency(dados.reduce((acc, item) => acc + item.valor, 0))}
          </strong>
        </div>
      )}
    </section>
  );
}
