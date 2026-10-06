import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ban, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import {
  excluirDoubleCheckInJustificativa,
  fetchDoubleCheckInJustificativasGestao,
  salvarDoubleCheckInJustificativa,
  type DoubleCheckInCampoComparativo,
  type DoubleCheckInJustificativaOpcao,
} from '../../api/compras';

const CAMPOS: Array<{ id: DoubleCheckInCampoComparativo; label: string }> = [
  { id: 'valor_unitario', label: 'Valor unitário' },
  { id: 'ipi', label: 'IPI' },
  { id: 'qtde', label: 'Quantidade' },
  { id: 'condicao_pagamento', label: 'Condição de pagamento' },
];

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

type Rascunho = {
  id?: number;
  label: string;
  campos: DoubleCheckInCampoComparativo[];
  ativo: boolean;
};

function rascunhoNovo(campo?: DoubleCheckInCampoComparativo): Rascunho {
  return { label: '', campos: campo ? [campo] : [], ativo: true };
}

function labelCampos(item: DoubleCheckInJustificativaOpcao): string {
  const nomes = CAMPOS.filter((c) => item.campos?.includes(c.id)).map((c) => c.label);
  return nomes.length > 0 ? nomes.join(', ') : '—';
}

const COLUNAS = [
  { id: 'motivo', label: 'Motivo' },
  { id: 'blocos', label: 'Blocos' },
  { id: 'situacao', label: 'Situação' },
  { id: 'acoes', label: 'Ações' },
];

function BlocoMotivos({
  campo,
  itens,
  alternandoId,
  onNovo,
  onEditar,
  onExcluir,
  onAlternar,
}: {
  campo: (typeof CAMPOS)[number];
  itens: DoubleCheckInJustificativaOpcao[];
  alternandoId: number | null;
  onNovo: () => void;
  onEditar: (item: DoubleCheckInJustificativaOpcao) => void;
  onExcluir: (item: DoubleCheckInJustificativaOpcao) => void;
  onAlternar: (item: DoubleCheckInJustificativaOpcao) => void;
}) {
  const textoCelula = useCallback((item: DoubleCheckInJustificativaOpcao, coluna: string) => {
    if (coluna === 'motivo') return item.label;
    if (coluna === 'blocos') return labelCampos(item);
    if (coluna === 'situacao') return item.ativo ? 'Ativo' : 'Inativo';
    return '';
  }, []);
  const grade = useGradeFiltrosExcel<DoubleCheckInJustificativaOpcao>({
    rows: itens,
    columnIds: ['motivo', 'blocos', 'situacao'],
    getCellText: textoCelula,
    defaultSortLevels: [{ id: 'motivo', dir: 'asc' }],
  });
  const exibidas = grade.rowsExibidas;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{campo.label}</h3>
        <button type="button" className={btnSecondary} onClick={onNovo}>
          <Plus className="h-4 w-4" />
          Novo motivo
        </button>
      </div>
      {itens.length === 0 ? (
        <p className="px-3 py-4 text-sm text-slate-500">Nenhum motivo neste bloco.</p>
      ) : (
        <div ref={grade.tableScrollRef} className="overflow-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-white">
              <tr className="bg-primary-600">
                {COLUNAS.map((col) => {
                  const filtravel = col.id !== 'acoes';
                  const sortAtivo = grade.sortState?.key === col.id || grade.sortLevels.some((l) => l.id === col.id);
                  return (
                    <th
                      key={col.id}
                      className="sticky top-0 z-10 border-b border-primary-500/40 bg-primary-600 px-3 py-2 font-medium"
                    >
                      <div className="flex min-w-0 items-center justify-between gap-1">
                        <span className="min-w-0 truncate">{col.label}</span>
                        {filtravel && (
                          <GradeFiltroCabecalhoBtn
                            ativo={grade.colunaComFiltroAtivo(col.id) || sortAtivo}
                            onClick={(e) => grade.abrirFiltroExcel(col.id, e)}
                          />
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-slate-200 dark:[&_td]:border-white/10">
              {exibidas.length === 0 ? (
                <tr>
                  <td colSpan={COLUNAS.length} className="bg-white px-3 py-6 text-center text-slate-500 dark:bg-[#161822]">
                    Nenhum motivo com os filtros da grade.
                  </td>
                </tr>
              ) : (
                exibidas.map((item, indice) => {
                  const faixa = indice % 2 === 0 ? 'bg-white dark:bg-[#161822]' : 'bg-slate-100 dark:bg-[#232838]';
                  return (
                    <tr key={item.id} className={faixa}>
                      <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{item.label}</td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{labelCampos(item)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                            item.ativo
                              ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-100'
                              : 'border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {item.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className={btnSecondary}
                            disabled={alternandoId === item.id}
                            onClick={() => onAlternar(item)}
                          >
                            {item.ativo ? <Ban className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                            {alternandoId === item.id ? 'Salvando…' : item.ativo ? 'Inativar' : 'Reativar'}
                          </button>
                          <button type="button" className={btnSecondary} onClick={() => onEditar(item)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </button>
                          <button type="button" className={btnSecondary} onClick={() => onExcluir(item)}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      {grade.colunaFiltroAberta && grade.filtroAbertoRect && (
        <GradeFiltroExcelPortal
          colunaAberta={grade.colunaFiltroAberta}
          rect={grade.filtroAbertoRect}
          dropdownRef={grade.filtroDropdownRef}
          excelFilterDrafts={grade.excelFilterDrafts}
          setExcelFilterDrafts={grade.setExcelFilterDrafts}
          valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
          zIndex={18000}
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
    </section>
  );
}

export default function DoubleCheckInJustificativasModal({ onClose }: { onClose: () => void }) {
  const [lista, setLista] = useState<DoubleCheckInJustificativaOpcao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluir, setExcluir] = useState<DoubleCheckInJustificativaOpcao | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [alternandoId, setAlternandoId] = useState<number | null>(null);

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    const r = await fetchDoubleCheckInJustificativasGestao();
    if (r.erro) {
      setErro(r.erro);
      setLista([]);
    } else {
      setLista(r.justificativas);
    }
    setLoading(false);
  };

  useEffect(() => {
    void carregar();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (excluir) {
        setExcluir(null);
        return;
      }
      if (rascunho) {
        setRascunho(null);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [excluir, onClose, rascunho]);

  const salvar = async () => {
    if (!rascunho) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await salvarDoubleCheckInJustificativa(rascunho);
      if (r.erro || !r.justificativa) {
        setErro(r.erro ?? 'Não foi possível salvar o motivo.');
        return;
      }
      setRascunho(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar o motivo.');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    setExcluindo(true);
    setErro(null);
    const r = await excluirDoubleCheckInJustificativa(excluir.id);
    setExcluindo(false);
    if (r.erro) {
      setErro(r.erro);
      setExcluir(null);
      return;
    }
    setExcluir(null);
    await carregar();
  };

  const alternarAtivo = async (item: DoubleCheckInJustificativaOpcao) => {
    setAlternandoId(item.id);
    setErro(null);
    const r = await salvarDoubleCheckInJustificativa({
      id: item.id,
      label: item.label,
      campos: item.campos ?? [],
      ativo: !item.ativo,
    });
    setAlternandoId(null);
    if (r.erro || !r.justificativa) {
      setErro(r.erro ?? 'Não foi possível alterar a situação.');
      return;
    }
    setLista((atual) => atual.map((j) => (j.id === r.justificativa!.id ? r.justificativa! : j)));
  };

  const alternarCampo = (campo: DoubleCheckInCampoComparativo) => {
    setRascunho((atual) => {
      if (!atual) return atual;
      const tem = atual.campos.includes(campo);
      return {
        ...atual,
        campos: tem ? atual.campos.filter((c) => c !== campo) : [...atual.campos, campo],
      };
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[10055] flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-slate-900/55" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dc-cadastros-titulo"
        className="relative flex h-[min(90vh,820px)] w-[min(96vw,980px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2 id="dc-cadastros-titulo" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Cadastros
            </h2>
            <p className="text-sm text-slate-500">
              Motivo inativo deixa de aparecer nas próximas conferências. As já gravadas permanecem.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" className={btnSecondary} onClick={onClose}>
              Fechar
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4">
          {erro && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
              {erro}
            </p>
          )}
          {loading && <p className="py-8 text-center text-sm text-slate-500">Carregando motivos…</p>}
          {!loading &&
            CAMPOS.map((campo) => (
              <BlocoMotivos
                key={campo.id}
                campo={campo}
                itens={lista.filter((item) => item.campos?.includes(campo.id))}
                alternandoId={alternandoId}
                onNovo={() => {
                  setErro(null);
                  setRascunho(rascunhoNovo(campo.id));
                }}
                onEditar={(item) => {
                  setErro(null);
                  setRascunho({
                    id: item.id,
                    label: item.label,
                    campos: item.campos ?? [],
                    ativo: item.ativo,
                  });
                }}
                onExcluir={setExcluir}
                onAlternar={(item) => void alternarAtivo(item)}
              />
            ))}
        </div>
      </div>

      {rascunho && (
        <div className="fixed inset-0 z-[10060] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Cancelar"
            onClick={() => setRascunho(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {rascunho.id ? 'Editar motivo' : 'Novo motivo'}
            </h3>
            {erro && (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                {erro}
              </p>
            )}
            <label className="mt-3 block text-xs font-medium text-slate-500">
              Nome
              <input
                className={`${inputClass} mt-1`}
                value={rascunho.label}
                maxLength={120}
                autoFocus
                onChange={(e) => setRascunho({ ...rascunho, label: e.target.value })}
              />
            </label>
            <fieldset className="mt-3">
              <legend className="text-xs font-medium text-slate-500">
                Blocos de divergência
                <span className="mt-0.5 block font-normal">Marque um ou mais. O motivo aparece em cada bloco marcado.</span>
              </legend>
              <div className="mt-2 space-y-1.5">
                {CAMPOS.map((campo) => (
                  <label key={campo.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={rascunho.campos.includes(campo.id)}
                      onChange={() => alternarCampo(campo.id)}
                    />
                    {campo.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="mt-3 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!rascunho.ativo}
                onChange={(e) => setRascunho({ ...rascunho, ativo: !e.target.checked })}
              />
              <span>
                Inativar
                <span className="mt-0.5 block text-xs text-slate-500">
                  Motivo inativo não aparece nas próximas conferências.
                </span>
              </span>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={btnSecondary} onClick={() => setRascunho(null)} disabled={salvando}>
                Cancelar
              </button>
              <button type="button" className={btnPrimary} onClick={() => void salvar()} disabled={salvando}>
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {excluir && (
        <div className="fixed inset-0 z-[10060] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Cancelar exclusão"
            onClick={() => setExcluir(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Excluir motivo</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Excluir <strong>{excluir.label}</strong>? Essa ação tira o motivo de todas as divergências em que ele
              aparece. Conferências que já usaram esse motivo não podem ser apagadas por aqui.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={btnSecondary} onClick={() => setExcluir(null)} disabled={excluindo}>
                Cancelar
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                onClick={() => void confirmarExclusao()}
                disabled={excluindo}
              >
                {excluindo ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
