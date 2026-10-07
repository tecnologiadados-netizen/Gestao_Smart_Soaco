import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import {
  fetchGestaoEntradasDia,
  type GestaoEntradasNotaDia,
} from '../../api/gestaoEntradas';
import { GestaoEntradasNotaDivergenciaModal } from './GestaoEntradasDiaModal';

export type CardGestaoEntrada = 'entradas' | 'conferidas' | 'pendentes' | 'media';

export type RecorteGestaoEntrada =
  | { origem: 'card'; card: CardGestaoEntrada }
  | { origem: 'anel'; fatia: 'sem' | 'com' }
  | {
      origem: 'tipo';
      idTipoMovimentacao: number;
      nomeTipo: string;
      modo: 'volume' | 'divergencias';
    };

const TITULO: Record<CardGestaoEntrada, string> = {
  entradas: 'Entradas',
  conferidas: 'Conferidas',
  pendentes: 'Pendentes',
  media: 'Média ao dia',
};

const STATUS_LABEL: Record<GestaoEntradasNotaDia['status'], string> = {
  aceita: 'Divergência aceita',
  recusa: 'Divergência recusada',
  limpa: 'Sem divergência',
  pendente: 'Pendente',
  nao_aplicada: 'Não aplicada',
};

const STATUS_CLASS: Record<GestaoEntradasNotaDia['status'], string> = {
  aceita: 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-100',
  recusa: 'border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-100',
  limpa: 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-100',
  pendente: 'border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
  nao_aplicada: 'border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

function fmtDataBr(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split('-');
  if (!y || !m || !d) return ymd || '—';
  return `${d}/${m}/${y}`;
}

function passaCard(nota: GestaoEntradasNotaDia, card: CardGestaoEntrada): boolean {
  if (card === 'pendentes') return nota.status === 'pendente';
  if (card === 'conferidas') return nota.status !== 'pendente' && nota.status !== 'nao_aplicada';
  return true;
}

function passaRecorte(nota: GestaoEntradasNotaDia, recorte: RecorteGestaoEntrada): boolean {
  if (recorte.origem === 'card') return passaCard(nota, recorte.card);
  if (recorte.origem === 'anel') {
    if (recorte.fatia === 'sem') return nota.status === 'limpa';
    return nota.status === 'aceita' || nota.status === 'recusa';
  }
  if (nota.idTipoMovimentacao !== recorte.idTipoMovimentacao) return false;
  return recorte.modo === 'volume' || nota.divergeAtual;
}

function tituloRecorte(recorte: RecorteGestaoEntrada): string {
  if (recorte.origem === 'card') return TITULO[recorte.card];
  if (recorte.origem === 'anel') {
    return recorte.fatia === 'sem' ? 'Sem divergência' : 'Com divergência';
  }
  return recorte.nomeTipo;
}

const COLUNAS = [
  { id: 'entrada', label: 'Entrada', align: 'left' as const },
  { id: 'doc', label: 'Doc. fiscal', align: 'left' as const },
  { id: 'nfe', label: 'NF-e', align: 'left' as const },
  { id: 'parceiro', label: 'Parceiro', align: 'left' as const },
  { id: 'itens', label: 'Itens', align: 'right' as const },
  { id: 'situacao', label: 'Situação', align: 'left' as const },
];

const COL_IDS = COLUNAS.map((c) => c.id);
const ORDEM_ENTRADA = [{ id: 'entrada', dir: 'desc' as const }];

function textoCelula(nota: GestaoEntradasNotaDia, coluna: string): string {
  if (coluna === 'entrada') return fmtDataBr(nota.dataEntrada);
  if (coluna === 'doc') return nota.numeroDocumentoFiscal ?? `Documento ${nota.idDocumento}`;
  if (coluna === 'nfe') return nota.numeroNfe ?? '—';
  if (coluna === 'parceiro') return nota.nomeParceiro ?? 'Parceiro não informado';
  if (coluna === 'itens') return String(nota.itens);
  return STATUS_LABEL[nota.status];
}

function valorOrdenacao(nota: GestaoEntradasNotaDia, coluna: string): string | number {
  if (coluna === 'entrada') return nota.dataEntrada || '';
  if (coluna === 'itens') return nota.itens;
  return textoCelula(nota, coluna);
}

export default function GestaoEntradasCardModal({
  recorte,
  dataInicio,
  dataFim,
  escopo,
  media,
  diasComMovimento,
  onClose,
}: {
  recorte: RecorteGestaoEntrada;
  dataInicio: string;
  dataFim: string;
  escopo: 'reais' | 'geral';
  media: number | null;
  diasComMovimento: number;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [notas, setNotas] = useState<GestaoEntradasNotaDia[]>([]);
  const [notaDivergencia, setNotaDivergencia] = useState<GestaoEntradasNotaDia | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || notaDivergencia) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, notaDivergencia]);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro(null);
    void fetchGestaoEntradasDia({ dataInicio, dataFim, escopo }).then((r) => {
      if (!ativo) return;
      if (r.erro || !r.data) {
        setErro(r.erro ?? 'Falha ao carregar os documentos.');
        setNotas([]);
      } else {
        setNotas(r.data.notas);
      }
      setLoading(false);
    });
    return () => {
      ativo = false;
    };
  }, [dataInicio, dataFim, escopo]);

  const linhas = useMemo(
    () => notas.filter((nota) => passaRecorte(nota, recorte)),
    [notas, recorte],
  );
  const getCellText = useCallback(
    (nota: GestaoEntradasNotaDia, coluna: string) => textoCelula(nota, coluna),
    [],
  );
  const valueForSort = useCallback(
    (nota: GestaoEntradasNotaDia, coluna: string) => valorOrdenacao(nota, coluna),
    [],
  );
  const grade = useGradeFiltrosExcel<GestaoEntradasNotaDia>({
    rows: linhas,
    columnIds: COL_IDS,
    getCellText,
    valueForSort,
    defaultSortLevels: ORDEM_ENTRADA,
    dateColumnIds: ['entrada'],
  });
  const exibidas = grade.rowsExibidas;
  const itens = exibidas.reduce((total, nota) => total + nota.itens, 0);
  const dias = new Set(exibidas.map((nota) => nota.dataEntrada).filter(Boolean)).size;
  const leitura = escopo === 'reais' ? 'visão real' : 'visão geral';

  let resumo = `${exibidas.length} ${exibidas.length === 1 ? 'documento' : 'documentos'} · ${itens} itens`;
  if (exibidas.length !== linhas.length) {
    resumo = `${exibidas.length} de ${linhas.length} documentos · ${itens} itens`;
  }
  const card = recorte.origem === 'card' ? recorte.card : null;
  if (card === 'media') {
    const mediaTxt =
      media != null ? media.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : '—';
    resumo = `${exibidas.length} entradas em ${diasComMovimento} ${diasComMovimento === 1 ? 'dia' : 'dias'} com movimento · média ${mediaTxt}`;
  } else if (card !== 'entradas') {
    resumo =
      exibidas.length === linhas.length
        ? `${exibidas.length} ${exibidas.length === 1 ? 'documento' : 'documentos'} · ${leitura}`
        : `${exibidas.length} de ${linhas.length} documentos · ${leitura}`;
  }

  return createPortal(
    <div className="fixed inset-0 z-[17000] flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ge-card-titulo"
        className="relative flex h-[min(90vh,860px)] w-[min(96vw,1100px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-xl dark:border-white/10 dark:bg-[#161822]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <h2 id="ge-card-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {tituloRecorte(recorte)}
            </h2>
            <p className="text-xs text-slate-500">
              {loading ? 'Carregando documentos…' : `${resumo} · ${fmtDataBr(dataInicio)} a ${fmtDataBr(dataFim)}`}
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
          {!loading && !erro && linhas.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">Nenhum documento nesta seleção.</p>
          )}
          {!loading && !erro && linhas.length > 0 && (
            <div
              ref={grade.tableScrollRef}
              className="overflow-auto rounded-xl border border-slate-200 dark:border-white/10"
            >
              <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-white">
                  <tr className="bg-primary-600">
                    {COLUNAS.map((col) => {
                      const sortAtivo =
                        grade.sortState?.key === col.id || grade.sortLevels.some((l) => l.id === col.id);
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
                        Nenhum documento com os filtros da grade.
                      </td>
                    </tr>
                  ) : (
                    exibidas.map((nota, indice) => {
                      const abreDivergencia = nota.divergencias.length > 0;
                      const faixa = indice % 2 === 0 ? 'bg-white dark:bg-[#161822]' : 'bg-slate-100 dark:bg-[#232838]';
                      return (
                      <tr
                        key={nota.idDocumento}
                        className={`${faixa} ${abreDivergencia ? 'cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-950/30' : ''}`}
                        onClick={abreDivergencia ? () => setNotaDivergencia(nota) : undefined}
                        title={abreDivergencia ? 'Ver as divergências deste documento' : undefined}
                      >
                        <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-200">
                          {fmtDataBr(nota.dataEntrada)}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">
                          {nota.numeroDocumentoFiscal ?? `Documento ${nota.idDocumento}`}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-200">
                          {nota.numeroNfe ?? '—'}
                        </td>
                        <td className="max-w-[18rem] truncate px-3 py-2 text-slate-700 dark:text-slate-200">
                          {nota.nomeParceiro ?? 'Parceiro não informado'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                          {nota.itens}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[nota.status]}`}
                          >
                            {STATUS_LABEL[nota.status]}
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
          {!loading && !erro && exibidas.some((nota) => nota.divergencias.length > 0) && (
            <p className="mt-2 text-xs text-slate-500">
              Clique no documento com divergência para ver o campo, a natureza, o valor na NF e o valor no pedido.
            </p>
          )}
          {!loading && !erro && card === 'media' && dias > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              A média divide as entradas pelos dias que tiveram ao menos uma nota. Esta lista é o numerador.
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
            showNumericFilters={grade.colunaFiltroAberta === 'itens'}
            showDateRangeFilters={grade.colunaFiltroAberta === 'entrada'}
            sortAscLabel={grade.colunaFiltroAberta === 'itens' ? 'Menor para maior' : undefined}
            sortDescLabel={grade.colunaFiltroAberta === 'itens' ? 'Maior para menor' : undefined}
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
        {notaDivergencia && (
          <GestaoEntradasNotaDivergenciaModal
            nota={notaDivergencia}
            escopo={escopo}
            onClose={() => setNotaDivergencia(null)}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
