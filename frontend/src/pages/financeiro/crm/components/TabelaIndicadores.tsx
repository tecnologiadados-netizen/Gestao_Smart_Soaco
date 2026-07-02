import { formatCurrency } from "../lib/formatters";
import { COLUNA_INDICADOR_LABEL } from "../lib/indicador-detalhe";
import type {
  ColunaIndicador,
  IndicadorClassificacao,
  IndicadorDetalheClickPayload,
  IndicadoresResumo,
} from "../lib/types";

export type { IndicadorDetalheClickPayload };

interface Props {
  titulo?: string;
  dados: IndicadorClassificacao[];
  tipo: "receber" | "pagar";
  totalGeral?: IndicadoresResumo;
  onClickCelula?: (payload: IndicadorDetalheClickPayload) => void;
}

const COLUNAS: {
  key: ColunaIndicador;
  cor?: string;
  destaqueCor?: string;
}[] = [
  { key: "total" },
  { key: "emAtraso", cor: "text-red-600", destaqueCor: "text-red-700" },
  { key: "emDia", cor: "text-emerald-600", destaqueCor: "text-emerald-700" },
  { key: "recebido30d" },
  { key: "recebido90d" },
  { key: "recebidoAno" },
  { key: "recebidoHistorico" },
];

function somarLinhas(dados: IndicadorClassificacao[]): IndicadoresResumo {
  return dados.reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      emAtraso: acc.emAtraso + row.emAtraso,
      emDia: acc.emDia + row.emDia,
      recebido30d: acc.recebido30d + row.recebido30d,
      recebido90d: acc.recebido90d + row.recebido90d,
      recebidoAno: acc.recebidoAno + row.recebidoAno,
      recebidoHistorico: acc.recebidoHistorico + row.recebidoHistorico,
    }),
    {
      total: 0,
      emAtraso: 0,
      emDia: 0,
      recebido30d: 0,
      recebido90d: 0,
      recebidoAno: 0,
      recebidoHistorico: 0,
    },
  );
}

function CelulaValor({
  coluna,
  valor,
  destaque,
  classificacao,
  nomeClassificacao,
  onClickCelula,
  cor,
  destaqueCor,
}: {
  coluna: ColunaIndicador;
  valor: number;
  destaque?: boolean;
  classificacao?: string | null;
  nomeClassificacao?: string;
  onClickCelula?: (payload: IndicadorDetalheClickPayload) => void;
  cor?: string;
  destaqueCor?: string;
}) {
  const cell = destaque
    ? "px-4 py-2.5 text-right font-semibold text-slate-800"
    : "px-4 py-2.5 text-right";
  const corTexto = destaque ? destaqueCor : cor;
  const clicavel = valor > 0 && onClickCelula && nomeClassificacao != null;

  if (clicavel) {
    return (
      <td className={`${cell} whitespace-nowrap ${corTexto ?? ""}`}>
        <button
          type="button"
          onClick={() =>
            onClickCelula({
              coluna,
              classificacao: classificacao ?? null,
              nomeClassificacao,
              valor,
            })
          }
          title={`Clique para ver: ${COLUNA_INDICADOR_LABEL[coluna]}`}
          className={`cursor-pointer rounded px-1 font-semibold underline decoration-slate-300 underline-offset-2 transition hover:bg-slate-100 hover:decoration-slate-600 ${corTexto ?? "text-slate-800"}`}
        >
          {formatCurrency(valor)}
        </button>
      </td>
    );
  }

  return (
    <td className={`${cell} whitespace-nowrap ${corTexto ?? ""}`}>
      {formatCurrency(valor)}
    </td>
  );
}

function LinhaValores({
  valores,
  destaque,
  classificacao,
  nomeClassificacao,
  onClickCelula,
}: {
  valores: IndicadoresResumo;
  destaque?: boolean;
  classificacao?: string | null;
  nomeClassificacao?: string;
  onClickCelula?: (payload: IndicadorDetalheClickPayload) => void;
}) {
  return (
    <>
      {COLUNAS.map(({ key, cor, destaqueCor }) => (
        <CelulaValor
          key={key}
          coluna={key}
          valor={valores[key]}
          destaque={destaque}
          classificacao={classificacao}
          nomeClassificacao={nomeClassificacao}
          onClickCelula={onClickCelula}
          cor={cor}
          destaqueCor={destaqueCor}
        />
      ))}
    </>
  );
}

export default function TabelaIndicadores({
  titulo = "Indicadores de desempenho",
  dados,
  tipo,
  totalGeral,
  onClickCelula,
}: Props) {
  const labelContas =
    tipo === "receber" ? "Contas a receber" : "Contas a pagar";
  const labelBaixado = tipo === "receber" ? "Recebimentos" : "Pagamentos";
  const total = totalGeral ?? somarLinhas(dados);

  return (
    <section className="table-crm-section w-full max-w-full min-w-0">
      <div className="border-b border-slate-200 bg-blue-700 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">{titulo}</h3>
      </div>
      <div className="table-crm-wrapper table-crm-scroll-y">
        <table className="table-crm text-sm">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead>
            <tr className="bg-blue-600 text-left text-xs font-semibold uppercase tracking-wide text-white">
              <th className="cell-wrap px-4 py-2.5 align-top" rowSpan={2}>
                Classificação
              </th>
              <th
                className="cell-nowrap border-l border-blue-500 px-4 py-2.5 text-center"
                colSpan={3}
              >
                {labelContas}
              </th>
              <th
                className="cell-nowrap border-l border-blue-500 px-4 py-2.5 text-center"
                colSpan={4}
              >
                {labelBaixado}
              </th>
            </tr>
            <tr className="bg-blue-500/90 text-left text-[11px] font-medium uppercase tracking-wide text-blue-50">
              <th className="cell-nowrap border-l border-blue-400 px-4 py-2 text-right">
                Total
              </th>
              <th className="cell-nowrap px-4 py-2 text-right">Em atraso</th>
              <th className="cell-nowrap px-4 py-2 text-right">A vencer</th>
              <th className="cell-nowrap border-l border-blue-400 px-4 py-2 text-right">
                Últimos 30 dias
              </th>
              <th className="cell-nowrap px-4 py-2 text-right">
                Últimos 90 dias
              </th>
              <th className="cell-nowrap px-4 py-2 text-right">Último ano</th>
              <th className="cell-nowrap px-4 py-2 text-right">
                Total histórico
              </th>
            </tr>
          </thead>
          <tbody>
            {dados.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  Não há registros para exibição
                </td>
              </tr>
            ) : (
              <>
                {dados.map((row, index) => (
                  <tr
                    key={`${row.classificacao}-${row.nomeClassificacao}`}
                    className={
                      index % 2 === 0 ? "table-row-even" : "table-row-odd"
                    }
                  >
                    <td className="cell-wrap min-w-[260px] px-4 py-2.5 align-top">
                      <span className="block font-medium leading-snug text-slate-800">
                        {row.nomeClassificacao}
                      </span>
                      <span className="text-xs text-slate-400">
                        {row.classificacao}
                      </span>
                    </td>
                    <LinhaValores
                      valores={row}
                      classificacao={row.classificacao}
                      nomeClassificacao={row.nomeClassificacao}
                      onClickCelula={onClickCelula}
                    />
                  </tr>
                ))}
                <tr className="table-row-total border-t-2 border-slate-300">
                  <td className="px-4 py-2.5 font-bold text-slate-800">
                    Total
                  </td>
                  <LinhaValores
                    valores={total}
                    destaque
                    classificacao={null}
                    nomeClassificacao="Total"
                    onClickCelula={onClickCelula}
                  />
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
