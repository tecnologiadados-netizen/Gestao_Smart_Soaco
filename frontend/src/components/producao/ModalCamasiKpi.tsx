import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import type {
  CamasiDashboardResponse,
  CamasiParadaValida,
  CamasiProducaoValida,
} from '../../api/producaoCamasi';
import {
  formatDuracaoDidatica,
  formatHmsCurto,
  formatHoras,
  formatYmdBr,
  formatYmdBrComSemana,
} from './camasiFormat';
import { criarMatcherTextoLivre, PLACEHOLDER_BUSCA_TEXTO_LIVRE } from '../../utils/textoLivreBusca';
import { classesBlocoDia } from './camasiTabelaDia';

export type CamasiKpiModalTipo = 'eventos' | 'parado' | 'disponibilidade' | 'producao';

function duracaoDe(minutos: number | undefined, horas: number): string {
  return formatDuracaoDidatica(minutos ?? Math.round((horas ?? 0) * 60));
}

function TabelaAgrupadaPorDia<T extends { id: number; data: string }>({
  linhas,
  colunasExtra,
}: {
  linhas: T[];
  colunasExtra: (row: T) => ReactNode;
}) {
  const indiceDia = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of linhas) {
      if (!map.has(p.data)) map.set(p.data, map.size);
    }
    return map;
  }, [linhas]);

  if (linhas.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">Sem registros neste indicador.</p>;
  }

  return (
    <table className="w-full border-collapse text-left text-xs">
      <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
        <tr className="text-slate-600 dark:text-slate-300">
          <th className="px-2 py-2 text-center font-semibold">Data</th>
          <th className="px-2 py-2 font-semibold">Início</th>
          <th className="px-2 py-2 font-semibold">Fim</th>
          <th className="px-2 py-2 text-right font-semibold">Duração</th>
          <th className="px-2 py-2 font-semibold">Peça</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((p, idx) => {
          const diaAnterior = idx > 0 ? linhas[idx - 1]!.data : null;
          const mostraData = p.data !== diaAnterior;
          let rowSpan = 1;
          if (mostraData) {
            for (let i = idx + 1; i < linhas.length; i++) {
              if (linhas[i]!.data !== p.data) break;
              rowSpan += 1;
            }
          }
          let inicioIdx = idx;
          while (inicioIdx > 0 && linhas[inicioIdx - 1]!.data === p.data) {
            inicioIdx -= 1;
          }
          const { tr, dataTd } = classesBlocoDia(
            indiceDia.get(p.data) ?? 0,
            idx - inicioIdx,
            mostraData
          );
          return (
            <tr key={p.id} className={tr}>
              {mostraData ? (
                <td
                  rowSpan={rowSpan}
                  className={`whitespace-nowrap px-3 py-2 text-center align-middle font-bold tabular-nums ${dataTd}`}
                >
                  {formatYmdBrComSemana(p.data)}
                </td>
              ) : null}
              {colunasExtra(p)}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function ModalCamasiKpi({
  open,
  tipo,
  data,
  onClose,
}: {
  open: boolean;
  tipo: CamasiKpiModalTipo | null;
  data: CamasiDashboardResponse | null;
  onClose: () => void;
}) {
  const [filtro, setFiltro] = useState('');
  const match = useMemo(() => criarMatcherTextoLivre(filtro), [filtro]);

  useEffect(() => {
    if (open) setFiltro('');
  }, [open, tipo]);

  useRegisterModalEscape({
    id: 'camasi-kpi-modal',
    onClose,
    zIndex: 13000,
    enabled: open,
  });

  const paradas = data?.paradasValidas ?? [];
  const producoes = data?.producaoValidas ?? [];
  const kpis = data?.kpis;

  const paradasFiltradas = useMemo(
    () =>
      paradas.filter(
        (p) =>
          match(p.justificativa) ||
          match(p.peca) ||
          match(p.observacao ?? '') ||
          match(formatYmdBr(p.data))
      ),
    [paradas, match]
  );

  const producoesFiltradas = useMemo(
    () =>
      producoes.filter((p) => match(p.peca) || match(formatYmdBr(p.data))),
    [producoes, match]
  );

  if (!open || !tipo) return null;

  const titulos: Record<CamasiKpiModalTipo, { titulo: string; sub: string }> = {
    eventos: {
      titulo: 'Eventos de parada',
      sub: `${kpis?.qtdeParadas ?? paradas.length} evento(s) com tempo parado na escala — a soma das durações é o tempo parado.`,
    },
    parado: {
      titulo: 'Tempo parado',
      sub: `Total ${formatHoras(kpis?.horasParado ?? 0)} — cada linha é uma parada válida (dentro da escala).`,
    },
    producao: {
      titulo: 'Produção',
      sub: `Total ${formatHoras(kpis?.horasProducao ?? 0)} — cada linha é um intervalo de produção na escala.`,
    },
    disponibilidade: {
      titulo: 'Disponibilidade',
      sub: kpis?.horasEscala
        ? `Produção (${formatHoras(kpis.horasProducao)}) ÷ escala (${formatHoras(kpis.horasEscala)}).`
        : 'Produção ÷ (produção + parado).',
    },
  };

  const meta = titulos[tipo];

  return createPortal(
    <div
      className="fixed inset-0 z-[13000] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(88vh,760px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
        role="dialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{meta.titulo}</h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{meta.sub}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>

        {tipo !== 'disponibilidade' && (
          <div className="border-b border-slate-100 px-5 py-2 dark:border-slate-800">
            <input
              type="search"
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto p-5">
          {tipo === 'disponibilidade' ? (
            <div className="space-y-4">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3 text-slate-500">Horas de escala no período</td>
                    <td className="py-2 text-right font-semibold tabular-nums">
                      {formatHoras(kpis?.horasEscala ?? 0)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3 text-slate-500">Horas em produção (na escala)</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {formatHoras(kpis?.horasProducao ?? 0)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3 text-slate-500">Horas parado (na escala)</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                      {formatHoras(kpis?.horasParado ?? 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-slate-500">Disponibilidade</td>
                    <td className="py-2 text-right text-lg font-bold tabular-nums">
                      {kpis?.disponibilidadePct != null
                        ? `${new Intl.NumberFormat('pt-BR', {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          }).format(kpis.disponibilidadePct)}%`
                        : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Parado maior que produção é possível: a escala conta o tempo em que a máquina deveria
                estar disponível; o que não foi produção entra como parada (ou ociosidade na jornada).
                Hora extra fora da escala ainda não entra.
              </p>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                    <th className="pb-2 pr-2 font-semibold">Mês</th>
                    <th className="pb-2 pr-2 text-right font-semibold">Produção</th>
                    <th className="pb-2 text-right font-semibold">Parado</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.porMes ?? []).map((m) => (
                    <tr key={m.mes} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5 pr-2">{m.label}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-emerald-700 dark:text-emerald-300">
                        {formatHoras(m.horasProducao)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-amber-700 dark:text-amber-300">
                        {formatHoras(m.horasParado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : tipo === 'producao' ? (
            <TabelaAgrupadaPorDia
              linhas={producoesFiltradas}
              colunasExtra={(p: CamasiProducaoValida) => (
                <>
                  <td className="whitespace-nowrap py-2 pr-2 tabular-nums">{formatHmsCurto(p.inicioProducao)}</td>
                  <td className="whitespace-nowrap py-2 pr-2 tabular-nums">{formatHmsCurto(p.fimProducao)}</td>
                  <td className="py-2 pr-2 text-right font-medium text-emerald-700 dark:text-emerald-300">
                    {duracaoDe(p.minutos, p.horas)}
                  </td>
                  <td className="max-w-[14rem] truncate py-2" title={p.peca}>
                    {p.peca}
                  </td>
                </>
              )}
            />
          ) : (
            <TabelaAgrupadaPorDia
              linhas={paradasFiltradas}
              colunasExtra={(p: CamasiParadaValida) => (
                <>
                  <td className="whitespace-nowrap py-2 pr-2 tabular-nums">{formatHmsCurto(p.inicioParado)}</td>
                  <td className="whitespace-nowrap py-2 pr-2 tabular-nums">{formatHmsCurto(p.fimParado)}</td>
                  <td className="py-2 pr-2 text-right font-medium text-amber-700 dark:text-amber-300">
                    {duracaoDe(p.minutos, p.horas)}
                  </td>
                  <td className="max-w-[14rem] py-2">
                    <span className="block truncate font-medium" title={p.peca}>
                      {p.peca}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500" title={p.justificativa}>
                      {p.justificativa}
                    </span>
                  </td>
                </>
              )}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
