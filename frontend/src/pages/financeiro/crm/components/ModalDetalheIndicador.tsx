import { useEffect, useMemo, useState } from "react";
import TabelaBaixados, {
  BAIXADOS_MODAL_COLUMN_WIDTHS,
} from "./TabelaBaixados";
import TabelaContas, {
  CONTAS_MODAL_COLUMN_WIDTHS,
} from "./TabelaContas";
import IndicadoresPeriodoContas from "./IndicadoresPeriodoContas";
import IndicadoresRecuperadoContas from "./IndicadoresRecuperadoContas";
import { destaqueModalDetalhe } from "../lib/indicador-detalhe";
import {
  exibirIndicadoresRecuperado,
  filtrarRecuperadosPorPeriodo,
  isRecuperado,
  labelPeriodoRecuperado,
} from "../lib/contas-recuperado-indicadores";
import {
  exibirIndicadoresPeriodoContas,
  filtrarContasPorPeriodo,
  labelPeriodoConta,
  type PeriodoVencimentoConta,
} from "../lib/contas-periodo-indicadores";
import {
  formatCurrency,
  formatDate,
  formatDiasAteAtrasar,
  formatDiasAtraso,
  formatText,
} from "../lib/formatters";
import {
  isRecebimentoTituloDescontado,
} from "../lib/titulo-descontado";
import type { ColunaIndicador, ContaFinanceira, Recebimento } from "../lib/types";

export interface ResumoDetalheModal {
  quantidadeTotal: number;
  valorTotal: number;
  quantidadeCarregada: number;
  limite: number;
}

interface Props {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  subtitulo?: string;
  coluna: ColunaIndicador;
  tipo: "receber" | "pagar";
  modo: "contas" | "recebimentos";
  dadosContas: ContaFinanceira[];
  dadosRecebimentos: Recebimento[];
  resumoDetalhe?: ResumoDetalheModal | null;
  /** Histórico de recebimentos para cartões de recuperado (em atraso / receber). */
  recebimentosRecuperado?: Recebimento[];
  carregando?: boolean;
}

const HEADER_CLASS: Record<"danger" | "success" | "default", string> = {
  danger: "bg-red-600",
  success: "bg-emerald-600",
  default: "bg-blue-700",
};

function limparNomeArquivo(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "tabela";
}

function formatNumeroPlanilha(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value ?? 0);
}

function dataSerialExcel(value: string | null | undefined): number | string {
  if (!value) return "—";
  const iso = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return formatDate(value);

  const [, ano, mes, dia] = match;
  const utc = Date.UTC(Number(ano), Number(mes) - 1, Number(dia));
  const baseExcel = Date.UTC(1899, 11, 30);
  return Math.round((utc - baseExcel) / 86_400_000);
}

function escaparHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function baixarTabelaExcel(
  nomeArquivo: string,
  linhas: Array<Array<string | number>>,
  colunasNumericas: number[],
  colunasData: number[],
) {
  const numericColumns = new Set(colunasNumericas);
  const dateColumns = new Set(colunasData);
  const [cabecalho, ...dados] = linhas;
  const thead = `<tr>${cabecalho
    .map((celula) => `<th>${escaparHtml(celula)}</th>`)
    .join("")}</tr>`;
  const tbody = dados
    .map(
      (linha) =>
        `<tr>${linha
          .map((celula, index) => {
            const className = numericColumns.has(index)
              ? " class=\"numero\""
              : dateColumns.has(index) && typeof celula === "number"
                ? " class=\"data\""
                : "";
            return `<td${className}>${escaparHtml(celula)}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("");
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
    th { background: #1d4ed8; color: #ffffff; font-weight: 700; border: 1px solid #93a4bd; padding: 6px; white-space: nowrap; }
    td { border: 1px solid #cbd5e1; padding: 5px; vertical-align: top; mso-number-format:"\\@"; }
    td.numero { mso-number-format:"0\\,00"; text-align: right; }
    td.data { mso-number-format:"dd/mm/yyyy"; text-align: center; }
  </style>
</head>
<body>
  <table>
    <thead>${thead}</thead>
    <tbody>${tbody}</tbody>
  </table>
</body>
</html>`;
  const blob = new Blob([`\uFEFF${html}`], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function linhasCsvContas(
  contas: ContaFinanceira[],
  isAtraso: boolean,
): Array<Array<string | number>> {
  return [
    [
      "Código",
      "Vencimento",
      "Agendamento",
      "Classificação",
      "Classificação código",
      "Empresa",
      "Conta bancária",
      "Forma pagamento",
      "Pessoa",
      "Descrição do lançamento",
      "Comentário Cont. a Receber",
      "Comentário Recebimentos",
      isAtraso ? "Dias em atraso" : "Dias até atrasar",
      "NF-e origem",
      "Valor",
    ],
    ...contas.map((conta) => [
      conta.codigo,
      dataSerialExcel(conta.dataVencimento),
      dataSerialExcel(conta.dataAgendamento),
      formatText(conta.nomeClassificacao),
      formatText(conta.classificacao),
      formatText(conta.empresa),
      formatText(conta.contaBancaria),
      formatText(conta.formaPagamento),
      formatText(conta.pessoa),
      formatText(conta.descricao),
      formatText(conta.comentariosAgendamento),
      formatText(conta.comentariosLancamento),
      isAtraso
        ? formatDiasAtraso(conta.diasAtraso)
        : formatDiasAteAtrasar(conta.diasAtraso, conta.dataVencimento),
      formatText(conta.nfeOrigem),
      formatNumeroPlanilha(conta.valor),
    ]),
  ];
}

function linhasCsvRecebimentos(
  recebimentos: Recebimento[],
  tipo: "receber" | "pagar",
): Array<Array<string | number>> {
  const dataRecebimentoLabel =
    tipo === "receber" ? "Data recebim./de fidc" : "Data pagam./de fidc";
  const valorRecebidoLabel =
    tipo === "receber" ? "Total Valor recebido" : "Total Valor pago";

  return [
    [
      "Código",
      "Data de Emissão NF",
      "Competência",
      "Vencimento",
      "Data baixa",
      dataRecebimentoLabel,
      "Forma pagamento",
      "Conta bancária",
      "Pessoa",
      "Descrição do lançamento",
      "Comentário Cont. a Receber",
      "Comentário Recebimentos",
      "NF-e origem",
      "Total de dias",
      "Valor até a data de vencimento",
      "Valor baixado",
      valorRecebidoLabel,
      "Total Juros",
    ],
    ...recebimentos.map((recebimento) => [
      recebimento.codigo,
      dataSerialExcel(recebimento.dataEmissao),
      dataSerialExcel(recebimento.dataCompetencia),
      dataSerialExcel(recebimento.dataVencimento),
      dataSerialExcel(recebimento.dataBaixa),
      dataSerialExcel(recebimento.dataRecebimento),
      formatText(recebimento.formaPagamento),
      formatText(recebimento.contaBancaria),
      formatText(recebimento.pessoa),
      formatText(recebimento.descricao),
      formatText(recebimento.comentariosAgendamento),
      formatText(recebimento.comentariosLancamento),
      formatText(recebimento.nfeOrigem),
      recebimento.totalDias == null ? "—" : recebimento.totalDias,
      formatNumeroPlanilha(recebimento.valorAteVencimento),
      formatNumeroPlanilha(recebimento.valorBaixado),
      formatNumeroPlanilha(recebimento.valorRecebido),
      formatNumeroPlanilha(recebimento.valorJuros),
    ]),
  ];
}

function LegendaDetalhe({
  quantidade,
  totalValor,
  labelTotal,
  filtroPeriodo,
  corIndicador = "blue",
  quantidadeCarregada,
  quantidadeTitulos = 0,
}: {
  quantidade: number;
  totalValor: number | null;
  labelTotal: string;
  filtroPeriodo?: string | null;
  corIndicador?: "blue" | "red" | "green";
  quantidadeCarregada?: number | null;
  quantidadeTitulos?: number;
}) {
  const dotClass =
    corIndicador === "green"
      ? "bg-emerald-600"
      : corIndicador === "red"
        ? "bg-red-600"
        : "bg-blue-600";

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-slate-200 bg-slate-50 px-5 py-2.5 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm text-slate-700 dark:text-slate-300">
        <span className="inline-flex flex-wrap items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`}
            aria-hidden="true"
          />
          <strong className="text-base font-bold text-slate-900 dark:text-slate-100">
            {quantidade.toLocaleString("pt-BR")}
          </strong>
          <span>
            {quantidade === 1 ? "linha no total" : "linhas no total"}
            {filtroPeriodo ? ` · filtro: ${filtroPeriodo}` : " neste detalhamento"}
          </span>
          {quantidadeCarregada != null && quantidadeCarregada < quantidade && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {quantidadeCarregada.toLocaleString("pt-BR")} carregadas na tabela
            </span>
          )}
          {quantidadeTitulos > 0 && (
            <>
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-900">
                {quantidadeTitulos.toLocaleString("pt-BR")}{" "}
                {quantidadeTitulos === 1
                  ? "linha referente a título descontado"
                  : "linhas referentes a títulos descontados"}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                {(quantidade - quantidadeTitulos).toLocaleString("pt-BR")}{" "}
                {quantidade - quantidadeTitulos === 1
                  ? "linha sem título descontado"
                  : "linhas sem título descontado"}
              </span>
            </>
          )}
        </span>
      </p>
      {totalValor != null && quantidade > 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {labelTotal}:{" "}
          <strong className="font-semibold text-slate-900 dark:text-slate-100">
            {formatCurrency(totalValor)}
          </strong>
        </p>
      )}
    </div>
  );
}

export default function ModalDetalheIndicador({
  aberto,
  onFechar,
  titulo,
  subtitulo,
  coluna,
  tipo,
  modo,
  dadosContas,
  dadosRecebimentos,
  resumoDetalhe = null,
  recebimentosRecuperado = [],
  carregando = false,
}: Props) {
  const [periodoFiltro, setPeriodoFiltro] =
    useState<PeriodoVencimentoConta | null>(null);
  const [periodoRecuperadoFiltro, setPeriodoRecuperadoFiltro] =
    useState<PeriodoVencimentoConta | null>(null);

  const exibirRecuperado = exibirIndicadoresRecuperado(coluna, tipo);
  const exibirPeriodoInadimplencia =
    modo === "contas" && coluna !== "total" && exibirIndicadoresPeriodoContas(coluna);

  const contasInadimplentes = useMemo(() => {
    if (coluna === "emAtraso" && tipo === "receber" && modo === "contas") {
      return dadosContas.filter(
        (conta) => conta.status === "Pendente" && conta.diasAtraso > 0,
      );
    }
    return dadosContas;
  }, [coluna, dadosContas, modo, tipo]);

  const recebimentosRecuperadoBase = useMemo(
    () => recebimentosRecuperado.filter(isRecuperado),
    [recebimentosRecuperado],
  );

  useEffect(() => {
    if (!aberto) {
      setPeriodoFiltro(null);
      setPeriodoRecuperadoFiltro(null);
    }
  }, [aberto]);

  useEffect(() => {
    setPeriodoFiltro(null);
    setPeriodoRecuperadoFiltro(null);
  }, [coluna, dadosContas, dadosRecebimentos, modo, recebimentosRecuperado]);

  useEffect(() => {
    if (!aberto) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onFechar();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [aberto, onFechar]);

  const contasExibidas = useMemo(() => {
    if (periodoFiltro && exibirPeriodoInadimplencia) {
      return filtrarContasPorPeriodo(
        contasInadimplentes,
        periodoFiltro,
        coluna,
      );
    }
    return contasInadimplentes;
  }, [coluna, contasInadimplentes, exibirPeriodoInadimplencia, periodoFiltro]);

  const recebimentosRecuperadosExibidos = useMemo(() => {
    if (!periodoRecuperadoFiltro) return [];
    return filtrarRecuperadosPorPeriodo(
      recebimentosRecuperadoBase,
      periodoRecuperadoFiltro,
    );
  }, [periodoRecuperadoFiltro, recebimentosRecuperadoBase]);

  const exibindoRecuperados = !!periodoRecuperadoFiltro;

  const labelPeriodoFiltro = useMemo(() => {
    if (periodoRecuperadoFiltro) {
      return labelPeriodoRecuperado(periodoRecuperadoFiltro);
    }
    if (periodoFiltro && exibirPeriodoInadimplencia) {
      return labelPeriodoConta(coluna, periodoFiltro);
    }
    return null;
  }, [coluna, exibirPeriodoInadimplencia, periodoFiltro, periodoRecuperadoFiltro]);

  const resumo = useMemo(() => {
    if (exibindoRecuperados) {
      return {
        quantidade: recebimentosRecuperadosExibidos.length,
        totalValor: recebimentosRecuperadosExibidos.reduce(
          (acc, item) => acc + item.valorRecebido,
          0,
        ),
        quantidadeTitulos: recebimentosRecuperadosExibidos.filter(
          isRecebimentoTituloDescontado,
        ).length,
        labelTotal: "Total recuperado",
      };
    }

    if (modo === "contas") {
      const contas = contasExibidas;
      return {
        quantidade: contas.length,
        totalValor: contas.reduce((acc, item) => acc + item.valor, 0),
        quantidadeTitulos: contas.filter((conta) => conta.tituloDescontadoAberto)
          .length,
        labelTotal: "Total pendente",
      };
    }

    return {
      quantidade: resumoDetalhe?.quantidadeTotal ?? dadosRecebimentos.length,
      totalValor:
        resumoDetalhe?.valorTotal ??
        dadosRecebimentos.reduce((acc, item) => acc + item.valorRecebido, 0),
      quantidadeCarregada: resumoDetalhe?.quantidadeCarregada,
      quantidadeTitulos: dadosRecebimentos.filter(isRecebimentoTituloDescontado)
        .length,
      labelTotal: tipo === "receber" ? "Total recebido" : "Total pago",
    };
  }, [
    coluna,
    contasExibidas,
    dadosRecebimentos,
    exibindoRecuperados,
    modo,
    recebimentosRecuperadosExibidos,
    resumoDetalhe,
    tipo,
  ]);

  const handleSelecionarPeriodoInad = (periodo: PeriodoVencimentoConta | null) => {
    setPeriodoRecuperadoFiltro(null);
    setPeriodoFiltro(periodo);
  };

  const handleSelecionarPeriodoRecuperado = (
    periodo: PeriodoVencimentoConta | null,
  ) => {
    setPeriodoFiltro(null);
    setPeriodoRecuperadoFiltro(periodo);
  };

  const quantidadeLinhasExportacao = exibindoRecuperados
    ? recebimentosRecuperadosExibidos.length
    : modo === "contas"
      ? contasExibidas.length
      : dadosRecebimentos.length;

  const handleExportarTabela = () => {
    const labelFiltro = labelPeriodoFiltro
      ? `-${limparNomeArquivo(labelPeriodoFiltro)}`
      : "";
    const nomeArquivo = `${limparNomeArquivo(titulo)}${labelFiltro}.xls`;

    if (exibindoRecuperados) {
      baixarTabelaExcel(
        nomeArquivo,
        linhasCsvRecebimentos(recebimentosRecuperadosExibidos, tipo),
        [13, 14, 15, 16, 17],
        [1, 2, 3, 4, 5],
      );
      return;
    }

    if (modo === "contas") {
      baixarTabelaExcel(
        nomeArquivo,
        linhasCsvContas(contasExibidas, coluna === "emAtraso"),
        [12, 14],
        [1, 2],
      );
      return;
    }

    baixarTabelaExcel(
      nomeArquivo,
      linhasCsvRecebimentos(dadosRecebimentos, tipo),
      [13, 14, 15, 16, 17],
      [1, 2, 3, 4, 5],
    );
  };

  if (!aberto) return null;

  const destaque = destaqueModalDetalhe(coluna);
  const headerClass = HEADER_CLASS[destaque];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-2 backdrop-blur-[2px] sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-detalhe-indicador-titulo"
      onClick={onFechar}
    >
      <div
        className="flex h-[min(96vh,960px)] w-full max-w-[min(99vw,1920px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700 ${headerClass}`}
        >
          <div className="min-w-0">
            <h2
              id="modal-detalhe-indicador-titulo"
              className="text-base font-semibold text-white"
            >
              {titulo}
            </h2>
            {subtitulo && (
              <p className="mt-0.5 text-sm text-white/80">{subtitulo}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleExportarTabela}
              disabled={carregando || quantidadeLinhasExportacao === 0}
              className="rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              title="Exporta apenas a tabela exibida neste detalhamento"
            >
              Exportar tabela
            </button>
            <button
              type="button"
              onClick={onFechar}
              className="rounded-lg p-1.5 text-white/90 transition hover:bg-white/15 hover:text-white"
              aria-label="Fechar"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        {!carregando && (
          <LegendaDetalhe
            quantidade={resumo.quantidade}
            totalValor={resumo.quantidade > 0 ? resumo.totalValor : null}
            labelTotal={resumo.labelTotal}
            filtroPeriodo={labelPeriodoFiltro}
            quantidadeCarregada={resumo.quantidadeCarregada}
            quantidadeTitulos={resumo.quantidadeTitulos}
            corIndicador={
              exibindoRecuperados
                ? "green"
                : coluna === "emAtraso"
                  ? "red"
                  : "blue"
            }
          />
        )}

        {!carregando && exibirPeriodoInadimplencia && (
          <IndicadoresPeriodoContas
            contas={contasInadimplentes}
            coluna={coluna}
            periodoSelecionado={exibindoRecuperados ? null : periodoFiltro}
            onSelecionarPeriodo={handleSelecionarPeriodoInad}
          />
        )}

        {!carregando && exibirRecuperado && (
          <IndicadoresRecuperadoContas
            recebimentos={recebimentosRecuperadoBase}
            periodoSelecionado={periodoRecuperadoFiltro}
            onSelecionarPeriodo={handleSelecionarPeriodoRecuperado}
          />
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {carregando ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-slate-500 dark:text-slate-400">
              <div className="loading-spinner" aria-hidden="true" />
              <p className="text-sm font-medium">Carregando registros...</p>
            </div>
          ) : exibindoRecuperados ? (
            <TabelaBaixados
              titulo=""
              dados={recebimentosRecuperadosExibidos}
              tipo={tipo}
              variant="modal"
              ocultarRodape
              linhaRecuperado
              storageKey="crm-baixados-recuperado-modal-col-widths-v1"
              defaultColumnWidths={BAIXADOS_MODAL_COLUMN_WIDTHS}
              preencherLargura
            />
          ) : modo === "contas" ? (
            <TabelaContas
              titulo=""
              dados={contasExibidas}
              destaque={destaque === "default" ? undefined : destaque}
              variant="modal"
              ocultarRodape
              storageKey="crm-contas-modal-col-widths-v2"
              defaultColumnWidths={CONTAS_MODAL_COLUMN_WIDTHS}
              preencherLargura
            />
          ) : (
            <TabelaBaixados
              titulo=""
              dados={dadosRecebimentos}
              tipo={tipo}
              variant="modal"
              ocultarRodape
              storageKey="crm-baixados-modal-col-widths-v2"
              defaultColumnWidths={BAIXADOS_MODAL_COLUMN_WIDTHS}
              preencherLargura
            />
          )}
        </div>
      </div>
    </div>
  );
}
