import { useMemo, useState } from 'react';
import type { RessupEmpenhoPedidoResultado } from '../../api/compras';
import RotuloComDica from './RotuloComDica';
import ModalEstoquePaDetalhe from './ModalEstoquePaDetalhe';
import {
  calcularSaldoProjetadoPorPedido,
  DICA_EMPENHO_LIQ_GRADE,
  DICA_ESTOQUE_PA,
  RUPTURA_CELL_CLASS,
  RUPTURA_ROW_CLASS,
} from './empenhoModalUtils';

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtData(ymd: string | null): string {
  if (!ymd) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const DICA_EMP_BRUTO = 'Demanda total dos pedidos incluídos no recorte (BOM + venda direta), antes de abater PA.';
const DICA_EMP_REQUISICAO =
  'Parte do empenho bruto de pedidos com atributo Requisitado (313) = Sim (requisições de loja).';
const DICA_EMP_PD_ESTOQUE =
  'Parte do empenho bruto de pedidos tipo Produção para estoque (ex.: PD 44711). Sempre incluído.';
const DICA_VENDA_DIRETA =
  'Pedidos que consomem o item diretamente, sem explosão de PA.';

type Props = {
  detalhe: RessupEmpenhoPedidoResultado;
  /** Código do componente (título do modal Estoque em PA). */
  codigo?: string;
  /** Descrição do componente. */
  descricao?: string;
  /** Estoque atual da grade — base do saldo projetado em cascata. */
  saldoAtual?: number;
  /** Rótulo do total destacado (ex.: "Empenho líquido"). */
  rotuloTotal?: string;
  /** Exibir cards de resumo no topo. */
  mostrarCards?: boolean;
  compacto?: boolean;
  /** Layout com cabeçalho/cards sticky e tabela scrollável (modal Consulta Estoque). */
  layoutSticky?: boolean;
};

function CardsResumo({
  detalhe,
  rotuloTotal,
  compacto,
  onAbrirEstoquePa,
}: {
  detalhe: RessupEmpenhoPedidoResultado;
  rotuloTotal: string;
  compacto: boolean;
  onAbrirEstoquePa?: () => void;
}) {
  const vendaDireta = detalhe.vendaDireta ?? 0;
  const totalBruto = detalhe.totalBruto ?? 0;
  const totalLiquido = detalhe.totalLiquido ?? 0;
  const empenhoRequisicao = detalhe.empenhoRequisicao ?? 0;
  const empenhoPdEstoque = detalhe.empenhoPdEstoque ?? 0;
  const usaExplosaoPa =
    detalhe.estoquePaExplosao != null && Number.isFinite(detalhe.estoquePaExplosao);
  const estoquePa = usaExplosaoPa
    ? detalhe.estoquePaExplosao!
    : (detalhe.totalCoberto ?? 0);
  const linhasPa = detalhe.linhasEstoquePa ?? [];
  const cardClicavel = Boolean(onAbrirEstoquePa) && linhasPa.length > 0 && estoquePa > 0;

  const gridClass = compacto
    ? 'grid-cols-2'
    : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6';

  const cardEstoquePaClass =
    'rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left dark:border-slate-600 dark:bg-slate-900/40';
  /** Mesmo padrão das células clicáveis PCP (`GradeCelulaModalBtn`). */
  const cardEstoquePaClicavelClass =
    'w-full rounded-lg border border-primary-500/70 bg-primary-600 px-3 py-2 text-left text-white shadow-sm transition hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-400/60 dark:border-primary-400 dark:bg-primary-500 dark:hover:bg-primary-400';

  return (
    <div className={`grid gap-2 ${gridClass}`}>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900/40">
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          <RotuloComDica rotulo="Empenho bruto" dica={DICA_EMP_BRUTO} />
        </div>
        <div className="text-sm font-medium tabular-nums">{fmt(totalBruto)}</div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900/40">
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          <RotuloComDica rotulo="Empenho Requisição" dica={DICA_EMP_REQUISICAO} />
        </div>
        <div className="text-sm font-medium tabular-nums">{fmt(empenhoRequisicao)}</div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900/40">
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          <RotuloComDica rotulo="Empenho PD Estoque" dica={DICA_EMP_PD_ESTOQUE} />
        </div>
        <div className="text-sm font-medium tabular-nums">{fmt(empenhoPdEstoque)}</div>
      </div>
      {!compacto && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900/40">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            <RotuloComDica rotulo="Venda direta" dica={DICA_VENDA_DIRETA} />
          </div>
          <div className="text-sm font-medium tabular-nums">{fmt(vendaDireta)}</div>
        </div>
      )}
      {!compacto &&
        (cardClicavel ? (
          <button
            type="button"
            className={cardEstoquePaClicavelClass}
            onClick={onAbrirEstoquePa}
            title="Ver detalhe do estoque em PA"
          >
            <div className="text-[11px] text-white/90">
              <RotuloComDica rotulo="Estoque MP em PA" dica={DICA_ESTOQUE_PA} headerClaro />
            </div>
            <div className="text-sm font-semibold tabular-nums text-white">{fmt(estoquePa)}</div>
          </button>
        ) : (
          <div className={cardEstoquePaClass}>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              <RotuloComDica rotulo="Estoque MP em PA" dica={DICA_ESTOQUE_PA} />
            </div>
            <div className="text-sm font-medium tabular-nums">{fmt(estoquePa)}</div>
          </div>
        ))}
      <div className="rounded-lg border border-primary-200 bg-primary-50/80 px-3 py-2 dark:border-primary-800 dark:bg-primary-900/30">
        <div className="text-[11px]">
          <RotuloComDica rotulo={rotuloTotal} dica={DICA_EMPENHO_LIQ_GRADE} primario />
        </div>
        <div className="text-sm font-semibold tabular-nums">{fmt(totalLiquido)}</div>
      </div>
    </div>
  );
}

/**
 * Painel reutilizável do empenho por pedido (Ressup e Consulta de Estoque).
 * A soma do empenho líquido (card) é igual ao valor da grade por construção.
 */
export default function EmpenhoLiquidoPainel({
  detalhe,
  codigo = '',
  descricao = '',
  saldoAtual,
  rotuloTotal = 'Empenho Liq (Grade)',
  mostrarCards = true,
  compacto = false,
  layoutSticky = false,
}: Props) {
  const [estoquePaOpen, setEstoquePaOpen] = useState(false);
  const totalBruto = detalhe.totalBruto ?? 0;
  const linhasEstoquePa = detalhe.linhasEstoquePa ?? [];

  const linhasComSaldo = useMemo(() => {
    const base = detalhe.linhas ?? [];
    if (saldoAtual == null || !Number.isFinite(saldoAtual)) return null;
    return calcularSaldoProjetadoPorPedido(base, saldoAtual);
  }, [detalhe.linhas, saldoAtual]);

  const linhasExibir = linhasComSaldo ?? detalhe.linhas ?? [];

  const cabecalho = (
    <>
      {saldoAtual != null && Number.isFinite(saldoAtual) && (
        <p className="mb-3 text-sm">
          <span className="text-slate-500 dark:text-slate-400">Estoque atual:</span>{' '}
          <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {fmt(saldoAtual)}
          </span>
        </p>
      )}
      {mostrarCards && (
        <CardsResumo
          detalhe={detalhe}
          rotuloTotal={rotuloTotal}
          compacto={compacto}
          onAbrirEstoquePa={() => setEstoquePaOpen(true)}
        />
      )}
    </>
  );

  const tabela = (
    <>
      {linhasExibir.length === 0 ? (
        <p className="py-2 text-sm text-slate-500">Nenhum empenho em aberto para este item.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-[1] bg-slate-50 dark:bg-slate-900/95">
              <tr className="border-b border-slate-200 text-left dark:border-slate-600">
                <th className="py-2 pr-2 font-semibold text-slate-700 dark:text-slate-200">Pedido</th>
                <th className="py-2 pr-2 font-semibold text-slate-700 dark:text-slate-200">Data produção</th>
                {!compacto && (
                  <th className="py-2 pr-2 font-semibold text-slate-700 dark:text-slate-200">Rota</th>
                )}
                <th className="py-2 pr-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                  Emp Bruto
                </th>
                <th className="py-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                  Saldo projetado
                </th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-200">
              {linhasComSaldo && saldoAtual != null && Number.isFinite(saldoAtual) && (
                <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-900/40">
                  <td className="py-1.5 pr-2 font-medium text-slate-600 dark:text-slate-300">
                    Estoque atual
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums text-slate-400">—</td>
                  {!compacto && <td className="py-1.5 pr-2 text-slate-400">—</td>}
                  <td className="py-1.5 pr-2 text-right tabular-nums text-slate-400">—</td>
                  <td className="py-1.5 text-right tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                    {fmt(saldoAtual)}
                  </td>
                </tr>
              )}
              {linhasComSaldo
                ? linhasComSaldo.map((l, i) => (
                    <tr
                      key={`${l.pedido}-${i}`}
                      className={
                        l.ruptura
                          ? `border-b ${RUPTURA_ROW_CLASS}`
                          : 'border-b border-slate-100 dark:border-slate-700'
                      }
                    >
                      <td className="py-1.5 pr-2 font-mono">{l.pedido || '—'}</td>
                      <td className="py-1.5 pr-2 tabular-nums">{fmtData(l.dataEntrega)}</td>
                      {!compacto && (
                        <td className="py-1.5 pr-2">
                          <span className="line-clamp-1" title={l.rota}>
                            {l.rota || '—'}
                          </span>
                        </td>
                      )}
                      <td className="py-1.5 pr-2 text-right tabular-nums">{fmt(l.bruto)}</td>
                      <td
                        className={`py-1.5 text-right tabular-nums font-medium ${
                          l.ruptura ? RUPTURA_CELL_CLASS : ''
                        }`}
                      >
                        {fmt(l.saldoProjetado)}
                      </td>
                    </tr>
                  ))
                : linhasExibir.map((l, i) => (
                    <tr key={`${l.pedido}-${i}`} className="border-b border-slate-100 dark:border-slate-700">
                      <td className="py-1.5 pr-2 font-mono">{l.pedido || '—'}</td>
                      <td className="py-1.5 pr-2 tabular-nums">{fmtData(l.dataEntrega)}</td>
                      {!compacto && (
                        <td className="py-1.5 pr-2">
                          <span className="line-clamp-1" title={l.rota}>
                            {l.rota || '—'}
                          </span>
                        </td>
                      )}
                      <td className="py-1.5 pr-2 text-right tabular-nums">{fmt(l.bruto)}</td>
                      <td className="py-1.5 text-right tabular-nums">—</td>
                    </tr>
                  ))}
              <tr className="border-t-2 border-primary-200 bg-primary-50/80 font-semibold dark:border-primary-800 dark:bg-primary-900/30">
                <td className="py-2 pr-2" colSpan={compacto ? 2 : 3}>
                  Total
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">{fmt(totalBruto)}</td>
                <td className="py-2 text-right tabular-nums" />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  const modalEstoquePa = (
    <ModalEstoquePaDetalhe
      open={estoquePaOpen}
      codigo={codigo}
      descricao={descricao}
      linhas={linhasEstoquePa}
      onClose={() => setEstoquePaOpen(false)}
    />
  );

  if (layoutSticky) {
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-slate-200 pb-3 dark:border-slate-600">
            {cabecalho}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pt-2">{tabela}</div>
        </div>
        {modalEstoquePa}
      </>
    );
  }

  return (
    <>
      {cabecalho}
      <div className={mostrarCards ? 'mt-3' : undefined}>{tabela}</div>
      {modalEstoquePa}
    </>
  );
}
