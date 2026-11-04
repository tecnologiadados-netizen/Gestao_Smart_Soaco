import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import {
  fetchConferenciaFisicaDetalhe,
  fetchConferenciaFisicaDocumento,
  type RecorteConferenciaFisica,
  type ResultadoVoltaFisica,
  type VoltaConferenciaFisica,
} from '../../api/gestaoEntradas';
import type { RecebimentoHistoricoEnvioDetalhe } from '../../api/recebimento';
import HistoricoConferenciaResumoModal from '../recebimento/HistoricoConferenciaResumoModal';

const TITULO: Record<RecorteConferenciaFisica['tipo'], string> = {
  destinacoes: 'Destinações',
  finalizadas: 'Conferidas e finalizadas',
  divergencia: 'Taxa de divergência',
  divergencia_primeira: 'Divergência na 1ª ida',
  divergencia_segunda: 'Divergência na 2ª ida ou mais',
  sem_divergencia: 'Sem divergência',
  leadtime: 'Lead time',
  dia: 'Destinações do período',
  conferente: 'Conferente',
};

const RESULTADO_LABEL: Record<ResultadoVoltaFisica, string> = {
  em_conferencia: 'Em conferência',
  conferida: 'Conferida',
  divergencia: 'Com divergência',
};

const RESULTADO_CLASS: Record<ResultadoVoltaFisica, string> = {
  em_conferencia:
    'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-100',
  conferida:
    'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-100',
  divergencia:
    'border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-100',
};

const COLUNAS = [
  { id: 'destinacao', label: 'Destinação', align: 'left' as const },
  { id: 'documento', label: 'Documento', align: 'left' as const },
  { id: 'ida', label: 'Ida', align: 'left' as const },
  { id: 'conferente', label: 'Conferente', align: 'left' as const },
  { id: 'retorno', label: 'Retorno', align: 'left' as const },
  { id: 'leadTime', label: 'Lead time', align: 'right' as const },
  { id: 'itens', label: 'Itens', align: 'right' as const },
  { id: 'resultado', label: 'Resultado', align: 'left' as const },
];

const COL_IDS = COLUNAS.map((coluna) => coluna.id);

function fmtDataBr(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function fmtDataHora(iso: string | null): string {
  if (!iso) return '—';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function fmtTaxaDivergencia(taxa: number | null | undefined): string {
  if (taxa == null || !Number.isFinite(taxa)) return '—';
  return `${taxa.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`;
}

export function labelIda(voltaNumero: number): string {
  if (voltaNumero <= 1) return '1ª ida';
  if (voltaNumero === 2) return '2ª ida';
  return `${voltaNumero}ª ida`;
}

export function fmtHorasConferencia(horas: number | null | undefined): string {
  if (horas == null || !Number.isFinite(horas)) return '—';
  return `${horas.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} h`;
}

function tituloRecorte(recorte: RecorteConferenciaFisica, rotulo?: string): string {
  if (recorte.tipo === 'dia') return rotulo ?? fmtDataBr(recorte.dia);
  if (recorte.tipo === 'conferente') return recorte.nome;
  return TITULO[recorte.tipo];
}

function chaveCache(dataInicio: string, dataFim: string, recorte: RecorteConferenciaFisica): string {
  if (recorte.tipo === 'dia') return `${dataInicio}|${dataFim}|dia|${recorte.dia}`;
  if (recorte.tipo === 'conferente') return `${dataInicio}|${dataFim}|conferente|${recorte.nome}`;
  return `${dataInicio}|${dataFim}|${recorte.tipo}`;
}

function textoCelula(volta: VoltaConferenciaFisica, coluna: string): string {
  if (coluna === 'destinacao') return fmtDataHora(volta.atribuidoEm);
  if (coluna === 'documento') return volta.numeroDocumento ?? `Documento ${volta.idDocumentoEstoque}`;
  if (coluna === 'ida') return labelIda(volta.voltaNumero);
  if (coluna === 'conferente') return volta.conferente;
  if (coluna === 'retorno') return fmtDataHora(volta.finalizadoEm);
  if (coluna === 'leadTime') return fmtHorasConferencia(volta.leadTimeHoras);
  if (coluna === 'itens') return `${volta.itensConferidos}/${volta.itens}`;
  return RESULTADO_LABEL[volta.resultado];
}

function valorOrdenacao(volta: VoltaConferenciaFisica, coluna: string): string | number {
  if (coluna === 'destinacao') return volta.atribuidoEm;
  if (coluna === 'ida') return volta.voltaNumero;
  if (coluna === 'retorno') return volta.finalizadoEm ?? '';
  if (coluna === 'leadTime') return volta.leadTimeHoras ?? -1;
  if (coluna === 'itens') return volta.itens;
  return textoCelula(volta, coluna);
}

export default function GestaoEntradasConferenciaFisicaModal({
  recorte,
  rotulo,
  dataInicio,
  dataFim,
  cacheRef,
  onClose,
}: {
  recorte: RecorteConferenciaFisica;
  rotulo?: string;
  dataInicio: string;
  dataFim: string;
  cacheRef: MutableRefObject<Map<string, VoltaConferenciaFisica[]>>;
  onClose: () => void;
}) {
  const [voltas, setVoltas] = useState<VoltaConferenciaFisica[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [resumoDoc, setResumoDoc] = useState<VoltaConferenciaFisica | null>(null);
  const resumoCacheRef = useRef(new Map<number, RecebimentoHistoricoEnvioDetalhe>());

  useEffect(() => {
    let ativo = true;
    const chave = chaveCache(dataInicio, dataFim, recorte);
    const cached = cacheRef.current.get(chave);
    if (cached) {
      setVoltas(cached);
      setLoading(false);
      setErro(null);
      return;
    }
    setLoading(true);
    setErro(null);
    void fetchConferenciaFisicaDetalhe({ dataInicio, dataFim, recorte }).then((res) => {
      if (!ativo) return;
      if (res.erro || !res.data) {
        setErro(res.erro ?? 'Falha ao carregar as voltas.');
        setVoltas([]);
      } else {
        cacheRef.current.set(chave, res.data.voltas);
        setVoltas(res.data.voltas);
      }
      setLoading(false);
    });
    return () => {
      ativo = false;
    };
  }, [cacheRef, dataFim, dataInicio, recorte]);

  const getCellText = useCallback(
    (volta: VoltaConferenciaFisica, coluna: string) => textoCelula(volta, coluna),
    [],
  );
  const valueForSort = useCallback(
    (volta: VoltaConferenciaFisica, coluna: string) => valorOrdenacao(volta, coluna),
    [],
  );
  const grade = useGradeFiltrosExcel<VoltaConferenciaFisica>({
    rows: voltas,
    columnIds: COL_IDS,
    getCellText,
    valueForSort,
    defaultSortLevels: [{ id: 'destinacao', dir: 'desc' }],
  });
  const exibidas = grade.rowsExibidas;
  const resumo =
    exibidas.length === voltas.length
      ? `${voltas.length} ${voltas.length === 1 ? 'volta' : 'voltas'}`
      : `${exibidas.length} de ${voltas.length} voltas`;

  return createPortal(
    <div className="fixed inset-0 z-[17000] flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ge-fisica-titulo"
        className="relative flex h-[min(90vh,860px)] w-[min(96vw,1100px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-xl dark:border-white/10 dark:bg-[#161822]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <h2 id="ge-fisica-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {tituloRecorte(recorte, rotulo)}
            </h2>
            <p className="text-xs text-slate-500">
              {loading
                ? 'Carregando voltas…'
                : `${resumo} · ${fmtDataBr(dataInicio)} a ${fmtDataBr(dataFim)}`}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={onClose}
          >
            Fechar
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {erro && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
              {erro}
            </p>
          )}
          {loading && <p className="py-10 text-center text-sm text-slate-500">Carregando…</p>}
          {!loading && !erro && voltas.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">Nenhuma volta nesta seleção.</p>
          )}
          {!loading && !erro && voltas.length > 0 && (
            <div
              ref={grade.tableScrollRef}
              className="overflow-auto rounded-xl border border-slate-200 dark:border-white/10"
            >
              <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-white">
                  <tr className="bg-primary-600">
                    {COLUNAS.map((col) => {
                      const sortAtivo =
                        grade.sortState?.key === col.id || grade.sortLevels.some((nivel) => nivel.id === col.id);
                      return (
                        <th
                          key={col.id}
                          className={`sticky top-0 z-10 border-b border-primary-500/40 bg-primary-600 px-3 py-2 font-medium ${
                            col.align === 'right' ? 'text-right' : 'text-left'
                          }`}
                        >
                          <div
                            className={`flex min-w-0 items-center gap-1 ${
                              col.align === 'right' ? 'justify-end' : 'justify-between'
                            }`}
                          >
                            <span className="min-w-0 truncate">{col.label}</span>
                            <GradeFiltroCabecalhoBtn
                              ativo={grade.colunaComFiltroAtivo(col.id) || sortAtivo}
                              onClick={(e) => grade.abrirFiltroExcel(col.id, e)}
                            />
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="[&_td]:border-b [&_td]:border-slate-200 dark:[&_td]:border-white/10">
                  {exibidas.length === 0 ? (
                    <tr>
                      <td colSpan={COLUNAS.length} className="bg-white px-3 py-8 text-center text-slate-500 dark:bg-[#161822]">
                        Nenhuma volta com os filtros da grade.
                      </td>
                    </tr>
                  ) : (
                    exibidas.map((volta, indice) => {
                      const faixa = indice % 2 === 0 ? 'bg-white dark:bg-[#161822]' : 'bg-slate-100 dark:bg-[#232838]';
                      return (
                        <tr
                          key={volta.chave}
                          className={`${faixa} cursor-pointer hover:bg-primary-50/70 dark:hover:bg-slate-700/40`}
                          title="Ver histórico da conferência"
                          onClick={() => setResumoDoc(volta)}
                        >
                          <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-200">
                            {fmtDataHora(volta.atribuidoEm)}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">
                            {volta.numeroDocumento ?? `Documento ${volta.idDocumentoEstoque}`}
                          </td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{labelIda(volta.voltaNumero)}</td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{volta.conferente}</td>
                          <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-200">
                            {fmtDataHora(volta.finalizadoEm)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                            {fmtHorasConferencia(volta.leadTimeHoras)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                            {volta.itensConferidos}/{volta.itens}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${RESULTADO_CLASS[volta.resultado]}`}
                            >
                              {RESULTADO_LABEL[volta.resultado]}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
          {!loading && !erro && voltas.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">Clique na linha para abrir o histórico da conferência.</p>
          )}
          {!loading && !erro && recorte.tipo === 'leadtime' && (
            <p className="mt-2 text-xs text-slate-500">
              A média e a mediana do card usam estas voltas. O tempo é o da destinação até o retorno à Mesa.
            </p>
          )}
          {!loading && !erro && recorte.tipo === 'divergencia' && (
            <p className="mt-2 text-xs text-slate-500">
              Estas voltas são o numerador da taxa. A 1ª ida é a primeira vez que o documento foi ao conferente; a 2ª é o reenvio.
            </p>
          )}
        </div>
        {grade.colunaFiltroAberta && grade.filtroAbertoRect && (
          <GradeFiltroExcelPortal
            colunaAberta={grade.colunaFiltroAberta}
            rect={grade.filtroAbertoRect}
            dropdownRef={grade.filtroDropdownRef}
            excelFilterDrafts={grade.excelFilterDrafts}
            setExcelFilterDrafts={grade.setExcelFilterDrafts}
            valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
            zIndex={18000}
            showNumericFilters={grade.colunaFiltroAberta === 'leadTime' || grade.colunaFiltroAberta === 'itens'}
            sortAscLabel={
              grade.colunaFiltroAberta === 'leadTime' || grade.colunaFiltroAberta === 'itens'
                ? 'Menor para maior'
                : undefined
            }
            sortDescLabel={
              grade.colunaFiltroAberta === 'leadTime' || grade.colunaFiltroAberta === 'itens'
                ? 'Maior para menor'
                : undefined
            }
            onSortAsc={(colId) => {
              grade.setSortState({ key: colId, direction: 'asc' });
              grade.setSortLevels([]);
              grade.fecharFiltroExcel();
            }}
            onSortDesc={(colId) => {
              grade.setSortState({ key: colId, direction: 'desc' });
              grade.setSortLevels([]);
              grade.fecharFiltroExcel();
            }}
            onAplicar={grade.aplicarFiltroExcel}
            onCancelar={grade.fecharFiltroExcel}
          />
        )}
      </div>
      {resumoDoc && (
        <HistoricoConferenciaResumoModal
          idDocumento={resumoDoc.idDocumentoEstoque}
          resumoInicial={{ numeroDocumentoFiscal: resumoDoc.numeroDocumento }}
          cacheRef={resumoCacheRef}
          carregar={fetchConferenciaFisicaDocumento}
          onClose={() => setResumoDoc(null)}
        />
      )}
    </div>,
    document.body,
  );
}
