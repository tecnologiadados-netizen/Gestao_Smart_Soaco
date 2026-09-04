import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import type {
  CamasiDashboardResponse,
  CamasiParadaValida,
  CamasiProducaoValida,
  CamasiResumoDia,
} from '../../api/producaoCamasi';
import {
  formatDuracaoDidatica,
  formatHmsCurto,
  formatHoras,
  formatHorasDidatico,
  formatYmdBr,
  formatYmdBrComSemana,
} from './camasiFormat';
import { criarMatcherTextoLivre, PLACEHOLDER_BUSCA_TEXTO_LIVRE } from '../../utils/textoLivreBusca';
import { DIAS_SEMANA_ESCALA, formatEscalaResumo } from '../../utils/recursoEscalaLabel';
import { classesBlocoDia } from './camasiTabelaDia';

export type CamasiKpiModalTipo = 'eventos' | 'parado' | 'previsto' | 'producao';

function duracaoDe(minutos: number | undefined, horas: number): string {
  return formatDuracaoDidatica(minutos ?? Math.round((horas ?? 0) * 60));
}

function TabelaAgrupadaPorDia<T extends { id: number; data: string }>({
  linhas,
  ultimaColunaLabel,
  colunasExtra,
  colunaDia,
}: {
  linhas: T[];
  ultimaColunaLabel: string;
  colunasExtra: (row: T) => ReactNode;
  /** Coluna agregada por dia (mesmo rowspan da Data). */
  colunaDia?: {
    label: string;
    thClassName?: string;
    render: (dataYmd: string, rowSpan: number, dataTdClass: string) => ReactNode;
  };
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
    <table className="w-full border-separate border-spacing-0 text-left text-xs">
      <thead>
        <tr className="text-slate-600 dark:text-slate-300">
          <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-2 py-2 text-center font-semibold shadow-[0_1px_0_0_rgba(0,0,0,0.06)] dark:border-slate-600 dark:bg-slate-800 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
            Data
          </th>
          {colunaDia ? (
            <th
              className={`sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-2 py-2 font-semibold shadow-[0_1px_0_0_rgba(0,0,0,0.06)] dark:border-slate-600 dark:bg-slate-800 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)] ${colunaDia.thClassName ?? 'text-right'}`}
            >
              {colunaDia.label}
            </th>
          ) : null}
          <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-2 py-2 font-semibold shadow-[0_1px_0_0_rgba(0,0,0,0.06)] dark:border-slate-600 dark:bg-slate-800 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
            Início
          </th>
          <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-2 py-2 font-semibold shadow-[0_1px_0_0_rgba(0,0,0,0.06)] dark:border-slate-600 dark:bg-slate-800 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
            Fim
          </th>
          <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-2 py-2 text-right font-semibold shadow-[0_1px_0_0_rgba(0,0,0,0.06)] dark:border-slate-600 dark:bg-slate-800 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
            Duração
          </th>
          <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-2 py-2 font-semibold shadow-[0_1px_0_0_rgba(0,0,0,0.06)] dark:border-slate-600 dark:bg-slate-800 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
            {ultimaColunaLabel}
          </th>
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
              {mostraData && colunaDia ? colunaDia.render(p.data, rowSpan, dataTd) : null}
              {colunasExtra(p)}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

type CamasiEscala = NonNullable<CamasiDashboardResponse['escala']>;

function labelDiasEscala(diasSemana: number[]): string {
  const set = new Set(diasSemana);
  return DIAS_SEMANA_ESCALA.filter((d) => set.has(d.valor))
    .map((d) => d.label)
    .join(', ');
}

function BlocoEscalaEmUso({ escala, destaque }: { escala: CamasiEscala; destaque?: boolean }) {
  const nome = escala.recursoNome?.trim() || escala.recursoCod || 'Recurso';
  const dias = labelDiasEscala(escala.diasSemana);
  return (
    <div
      className={
        destaque
          ? 'rounded-lg border border-indigo-200 bg-indigo-50/90 px-4 py-3 dark:border-indigo-800 dark:bg-indigo-950/50'
          : 'rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60'
      }
    >
      <p
        className={
          destaque
            ? 'text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300'
            : 'text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400'
        }
      >
        Escala em uso
      </p>
      <p
        className={
          destaque
            ? 'mt-1 text-base font-semibold text-slate-900 dark:text-slate-50'
            : 'mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100'
        }
      >
        {nome}
        {escala.recursoCod ? (
          <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">
            ({escala.recursoCod})
          </span>
        ) : null}
      </p>
      <p className={destaque ? 'mt-1 text-sm text-slate-700 dark:text-slate-200' : 'mt-0.5 text-xs text-slate-600 dark:text-slate-300'}>
        {dias}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {escala.faixas.map((f) => (
          <span
            key={`${f.inicio}-${f.fim}`}
            className={
              destaque
                ? 'inline-flex items-center rounded-md bg-white px-2.5 py-1 text-sm font-semibold tabular-nums text-indigo-900 shadow-sm ring-1 ring-indigo-200 dark:bg-slate-900 dark:text-indigo-100 dark:ring-indigo-700'
                : 'inline-flex items-center rounded bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-800 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-600'
            }
          >
            {f.inicio}–{f.fim}
          </span>
        ))}
      </div>
      {destaque ? (
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
          Só entra o tempo nestas faixas (intervalo de almoço e fora da jornada não entram). Cadastro em
          PCP → Recursos.
        </p>
      ) : null}
    </div>
  );
}

export default function ModalCamasiKpi({
  open,
  tipo,
  data,
  motivoFiltro = null,
  onClose,
}: {
  open: boolean;
  tipo: CamasiKpiModalTipo | null;
  data: CamasiDashboardResponse | null;
  /** Quando informado, lista só as paradas deste motivo (clique no gráfico de motivos). */
  motivoFiltro?: string | null;
  onClose: () => void;
}) {
  const [filtro, setFiltro] = useState('');
  const match = useMemo(() => criarMatcherTextoLivre(filtro), [filtro]);

  useEffect(() => {
    if (open) setFiltro('');
  }, [open, tipo, motivoFiltro]);

  useRegisterModalEscape({
    id: 'camasi-kpi-modal',
    onClose,
    zIndex: 13000,
    enabled: open,
  });

  const paradas = useMemo(() => {
    const all = data?.paradasValidas ?? [];
    if (!motivoFiltro) return all;
    return all.filter((p) => p.justificativa === motivoFiltro);
  }, [data?.paradasValidas, motivoFiltro]);
  const producoes = data?.producaoValidas ?? [];
  const kpis = data?.kpis;

  const horasMotivo = useMemo(
    () => paradas.reduce((s, p) => s + (p.horas ?? 0), 0),
    [paradas]
  );

  /** Totais dos dias que aparecem neste popup (memorial unificado). */
  const totaisDiasPopup = useMemo(() => {
    const dias = new Set(paradas.map((p) => p.data));
    let previsto = 0;
    let parado = 0;
    let producao = 0;
    for (const ymd of dias) {
      const r = data?.resumoDias?.find((d) => d.data === ymd);
      if (!r) continue;
      previsto += r.escalaHoras;
      parado += r.paradoHoras;
      producao += r.producaoHoras;
    }
    return {
      previsto: Math.round(previsto * 10) / 10,
      parado: Math.round(parado * 10) / 10,
      producao: Math.round(producao * 10) / 10,
      qtdeDias: dias.size,
    };
  }, [paradas, data?.resumoDias]);

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

  /** Memorial do dia (API): parado por união de intervalos; produção = escala − parado. */
  const resumoPorDia = useMemo(() => {
    const map = new Map<string, CamasiResumoDia>();
    for (const d of data?.resumoDias ?? []) {
      map.set(d.data, d);
    }
    return map;
  }, [data?.resumoDias]);

  if (!open || !tipo) return null;

  const temEscala = Boolean(data?.escala?.faixas?.length && data.escala.diasSemana?.length);
  const filtrandoMotivo = Boolean(motivoFiltro);

  const titulos: Record<CamasiKpiModalTipo, { titulo: string; sub: string }> = {
    eventos: {
      titulo: 'Eventos de parada',
      sub: temEscala
        ? `${kpis?.qtdeParadas ?? paradas.length} evento(s) — memorial: previsto − parado unificado (sem sobrepor) = produção.`
        : `${kpis?.qtdeParadas ?? paradas.length} evento(s) com tempo parado na escala — cadastre a escala do recurso para o memorial do dia.`,
    },
    parado: {
      titulo: 'Tempo parado',
      sub: temEscala
        ? `Total ${formatHoras(kpis?.horasParado ?? 0)} — parado unificado na escala (intervalos sobrepostos não somam duas vezes).`
        : `Total ${formatHoras(kpis?.horasParado ?? 0)} — cada linha é uma parada válida (dentro da escala).`,
    },
    producao: {
      titulo: 'Produção',
      sub:
        kpis?.disponibilidadePct != null
          ? `Total ${formatHoras(kpis?.horasProducao ?? 0)} — disponibilidade ${new Intl.NumberFormat('pt-BR', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }).format(kpis.disponibilidadePct)}% (produção ÷ escala).`
          : `Total ${formatHoras(kpis?.horasProducao ?? 0)} — cada linha é um intervalo de produção na escala.`,
    },
    previsto: {
      titulo: 'Tempo previsto de produção',
      sub: data?.escala
        ? `${data.escala.recursoNome ?? data.escala.recursoCod}: ${formatEscalaResumo({
            diasSemana: data.escala.diasSemana,
            faixas: data.escala.faixas,
          })} · ${formatHoras(kpis?.horasEscala ?? 0)} no período (produção ÷ escala = disponibilidade).`
        : kpis?.horasEscala
          ? `Escala no período: ${formatHoras(kpis.horasEscala)} — produção ÷ escala = disponibilidade.`
          : 'Cadastre a escala do recurso para calcular o tempo previsto.',
    },
  };

  const meta = filtrandoMotivo
    ? {
        titulo: `Paradas — ${motivoFiltro}`,
        sub: `${paradas.length} evento(s) · ${formatHoras(horasMotivo)} no período (somente este motivo).`,
      }
    : titulos[tipo];

  const renderColunaProducaoDia = (dataYmd: string, rowSpan: number, dataTd: string) => {
    const r = resumoPorDia.get(dataYmd);
    if (!temEscala || !r || r.escalaHoras <= 0) {
      return (
        <td
          rowSpan={rowSpan}
          className={`min-w-[9.5rem] px-2.5 py-2 align-middle text-slate-400 dark:text-slate-500 ${dataTd}`}
          title={temEscala ? 'Dia fora da escala prevista' : 'Sem escala cadastrada no recurso'}
        >
          —
        </td>
      );
    }
    const titulo = [
      'Produção = escala − parado unificado (sem contar sobreposição duas vezes)',
      r.temSobreposicao
        ? `Sobreposição detectada: soma dos eventos ${formatHorasDidatico(r.paradoSomaEventos)} → união ${formatHorasDidatico(r.paradoHoras)}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');
    return (
      <td
        rowSpan={rowSpan}
        className={`min-w-[10.5rem] px-2.5 py-2 align-middle ${dataTd}`}
        title={titulo}
      >
        <div className="space-y-1 text-[11px] leading-snug tabular-nums text-slate-700 dark:text-slate-200">
          <div className="flex items-baseline justify-between gap-3">
            <span className="shrink-0 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              Previsto
            </span>
            <span className="text-slate-700 dark:text-slate-200">{formatHorasDidatico(r.escalaHoras)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="shrink-0 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              (−) Parado
            </span>
            <span className="text-slate-700 dark:text-slate-200">{formatHorasDidatico(r.paradoHoras)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-slate-300/80 pt-1 dark:border-slate-600">
            <span className="shrink-0 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
              (=) Produção
            </span>
            <span className="font-semibold text-slate-900 dark:text-slate-50">
              {formatHorasDidatico(r.producaoHoras)}
            </span>
          </div>
          {r.temSobreposicao ? (
            <p className="pt-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-300">
              Sobreposição ajustada
            </p>
          ) : null}
        </div>
      </td>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[13000] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(88vh,760px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
        role="dialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{meta.titulo}</h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{meta.sub}</p>
            {filtrandoMotivo && temEscala && totaisDiasPopup.qtdeDias > 0 ? (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] tabular-nums">
                <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="inline-block size-2.5 rounded-sm bg-slate-400 dark:bg-slate-500" aria-hidden />
                  Previsto nos dias: <strong className="font-semibold text-slate-800 dark:text-slate-100">{formatHoras(totaisDiasPopup.previsto)}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                  <span className="inline-block size-2.5 rounded-sm bg-amber-500" aria-hidden />
                  Parado (este motivo): <strong className="font-semibold">{formatHoras(horasMotivo)}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <span className="inline-block size-2.5 rounded-sm bg-emerald-500" aria-hidden />
                  Produção nos dias: <strong className="font-semibold">{formatHoras(totaisDiasPopup.producao)}</strong>
                </span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>

        {tipo !== 'previsto' && data?.escala ? (
          <div className="border-b border-slate-100 px-5 py-2 dark:border-slate-800">
            <BlocoEscalaEmUso escala={data.escala} />
          </div>
        ) : null}

        {tipo !== 'previsto' && !filtrandoMotivo && (
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

        <div className="min-h-0 flex-1 overflow-auto px-5 pb-5 pt-0">
          {/* Espaço acima da tabela sem sticky — cabeçalho cola no topo do scroll */}
          <div className={tipo === 'previsto' ? 'pt-5' : 'pt-3'}>
          {tipo === 'previsto' ? (
            <div className="space-y-4">
              {data?.escala ? <BlocoEscalaEmUso escala={data.escala} destaque /> : null}
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
              ultimaColunaLabel="Peça"
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
              ultimaColunaLabel={filtrandoMotivo ? 'Observação' : 'Justificativa'}
              colunaDia={
                temEscala
                  ? {
                      label: 'Memorial do dia',
                      thClassName: 'text-left leading-tight min-w-[10.5rem]',
                      render: renderColunaProducaoDia,
                    }
                  : undefined
              }
              colunasExtra={(p: CamasiParadaValida) => (
                <>
                  <td className="whitespace-nowrap py-2 pr-2 tabular-nums">{formatHmsCurto(p.inicioParado)}</td>
                  <td className="whitespace-nowrap py-2 pr-2 tabular-nums">{formatHmsCurto(p.fimParado)}</td>
                  <td className="py-2 pr-2 text-right font-medium text-amber-700 dark:text-amber-300">
                    {duracaoDe(p.minutos, p.horas)}
                  </td>
                  {filtrandoMotivo ? (
                    <td
                      className="max-w-[18rem] py-2 text-slate-600 dark:text-slate-300"
                      title={p.observacao ?? undefined}
                    >
                      {p.observacao?.trim() ? p.observacao : '—'}
                    </td>
                  ) : (
                    <td
                      className="max-w-[18rem] py-2 font-medium text-slate-800 dark:text-slate-100"
                      title={p.justificativa}
                    >
                      {p.justificativa}
                    </td>
                  )}
                </>
              )}
            />
          )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
