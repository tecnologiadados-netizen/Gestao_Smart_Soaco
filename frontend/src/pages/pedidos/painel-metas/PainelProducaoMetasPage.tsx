import { useEffect, useState } from 'react';
import { MonthFilter } from '../../../components/painel-producao/MonthFilter';
import { PainelProducaoShell } from '../../../components/painel-producao/PainelProducaoShell';
import { useAuth } from '../../../contexts/AuthContext';
import {
  fetchPainelProducaoFilters,
  fetchPainelProducaoTargets,
  savePainelProducaoTarget,
  type PainelProducaoTargetRow,
} from '../../../api/painelProducao';
import { formatMesLabel } from '../../../utils/painelProducaoFormat';
import { podeEditarPainelMetas } from '../../../utils/painelProducaoPermissoes';

function LoadingOverlay({ message = 'Carregando...' }: { message?: string }) {
  return (
    <div className="loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-overlay-card">
        <div className="loading-spinner" aria-hidden="true">
          <span className="loading-spinner-ring" />
          <span className="loading-spinner-core" />
        </div>
        <p className="loading-overlay-text">{message}</p>
      </div>
    </div>
  );
}

export default function PainelProducaoMetasPage() {
  const { hasPermission } = useAuth();
  const podeEditar = podeEditarPainelMetas(hasPermission);

  const [setores, setSetores] = useState<string[]>([]);
  const [meses, setMeses] = useState<string[]>([]);
  const [mes, setMes] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [semMeta, setSemMeta] = useState<Record<string, boolean>>({});
  const [editingSetores, setEditingSetores] = useState<Set<string>>(() => new Set());
  const [editSnapshots, setEditSnapshots] = useState<
    Record<string, { value: string; semMeta: boolean }>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadFilters() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPainelProducaoFilters();
        if (cancelled) return;
        const list = data.setores ?? [];
        setSetores(list);
        setMeses(data.meses ?? []);
        setMes(
          data.default_mes && data.meses?.includes(data.default_mes)
            ? data.default_mes
            : data.meses?.[0] ?? '',
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao carregar filtros.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadFilters();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mes) return;
    let cancelled = false;
    async function loadTargets() {
      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const rows: PainelProducaoTargetRow[] = await fetchPainelProducaoTargets(mes);
        if (cancelled) return;
        const valueMap: Record<string, string> = {};
        const semMap: Record<string, boolean> = {};
        for (const row of rows) {
          semMap[row.setor] = !!row.sem_meta;
          valueMap[row.setor] = row.sem_meta ? '' : String(row.target);
        }
        setValues(valueMap);
        setSemMeta(semMap);
        setEditingSetores(new Set());
        setEditSnapshots({});
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao carregar metas.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadTargets();
    return () => {
      cancelled = true;
    };
  }, [mes]);

  function startEdit(setor: string) {
    setEditSnapshots((prev) => ({
      ...prev,
      [setor]: {
        value: values[setor] ?? '',
        semMeta: !!semMeta[setor],
      },
    }));
    setEditingSetores((prev) => new Set(prev).add(setor));
    setSuccess(null);
  }

  function cancelEdit(setor: string) {
    const snapshot = editSnapshots[setor];
    if (snapshot) {
      setValues((prev) => ({ ...prev, [setor]: snapshot.value }));
      setSemMeta((prev) => ({ ...prev, [setor]: snapshot.semMeta }));
    }
    setEditingSetores((prev) => {
      const next = new Set(prev);
      next.delete(setor);
      return next;
    });
    setEditSnapshots((prev) => {
      const next = { ...prev };
      delete next[setor];
      return next;
    });
    setError(null);
    setSuccess(null);
  }

  function startEditAll() {
    const snapshots: Record<string, { value: string; semMeta: boolean }> = {};
    for (const setor of setores) {
      snapshots[setor] = {
        value: values[setor] ?? '',
        semMeta: !!semMeta[setor],
      };
    }
    setEditSnapshots(snapshots);
    setEditingSetores(new Set(setores));
    setSuccess(null);
  }

  function cancelEditAll() {
    const setoresEditando = [...editingSetores];
    const snapshots = { ...editSnapshots };
    setValues((prev) => {
      const next = { ...prev };
      for (const setor of setoresEditando) {
        const snapshot = snapshots[setor];
        if (snapshot) next[setor] = snapshot.value;
      }
      return next;
    });
    setSemMeta((prev) => {
      const next = { ...prev };
      for (const setor of setoresEditando) {
        const snapshot = snapshots[setor];
        if (snapshot) next[setor] = snapshot.semMeta;
      }
      return next;
    });
    setEditingSetores(new Set());
    setEditSnapshots({});
    setError(null);
    setSuccess(null);
  }

  function finishEdit(setor: string) {
    setEditingSetores((prev) => {
      const next = new Set(prev);
      next.delete(setor);
      return next;
    });
    setEditSnapshots((prev) => {
      const next = { ...prev };
      delete next[setor];
      return next;
    });
  }

  async function saveTarget(setor: string) {
    if (!podeEditar) return;
    const noMeta = !!semMeta[setor];
    let target = 0;
    if (!noMeta) {
      const raw = values[setor]?.trim() ?? '';
      target = raw === '' ? 0 : Number(raw.replace(/\./g, '').replace(',', '.'));
      if (Number.isNaN(target) || target < 0) {
        setError(`Valor inválido para ${setor}.`);
        return;
      }
    }
    setSaving(setor);
    setError(null);
    setSuccess(null);
    try {
      await savePainelProducaoTarget({
        setor,
        mes_ano: `${mes}-01`,
        target,
        sem_meta: noMeta,
      });
      setSuccess(
        noMeta
          ? `${setor} marcado como "Não haverá meta".`
          : `Meta de ${setor} salva com sucesso.`,
      );
      finishEdit(setor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar meta.');
    } finally {
      setSaving(null);
    }
  }

  async function saveAll() {
    for (const setor of [...editingSetores]) {
      await saveTarget(setor);
    }
  }

  const algumEditando = editingSetores.size > 0;

  if (loading && !mes) {
    return (
      <PainelProducaoShell>
        <div className="dashboard targets-page">
          <LoadingOverlay message="Carregando..." />
        </div>
      </PainelProducaoShell>
    );
  }

  return (
    <PainelProducaoShell>
      <div className="dashboard targets-page">
        <header className="header">
          <div className="title-bar">Cadastro de Metas</div>
          <div className="filters">
            <MonthFilter
              id="targets-mes-select"
              mes={mes}
              meses={meses}
              onChange={setMes}
              onMesesChange={(lista, selected) => {
                setMeses(lista);
                setMes(selected);
              }}
              allowInsert={podeEditar}
              disabled={loading}
            />
          </div>
        </header>

        {loading && <LoadingOverlay message="Carregando metas..." />}

        <main className="targets-main">
          <div className="card targets-card">
            <div className="targets-card-header">
              <h2>Metas por setor — {formatMesLabel(mes)}</h2>
              {podeEditar && (
                <div className="targets-header-actions">
                  {algumEditando ? (
                    <>
                      <button
                        type="button"
                        className="targets-cancel-all"
                        onClick={cancelEditAll}
                        disabled={!!saving}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="targets-save-all"
                        onClick={saveAll}
                        disabled={!!saving || editingSetores.size === 0}
                      >
                        Salvar todas
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="targets-edit-all"
                      onClick={startEditAll}
                      disabled={!!saving || setores.length === 0}
                    >
                      Editar todas
                    </button>
                  )}
                </div>
              )}
            </div>

            {error && <p className="targets-feedback error">{error}</p>}
            {success && <p className="targets-feedback success">{success}</p>}

            <div className="targets-table-wrap">
              <table className="targets-table">
                <thead>
                  <tr>
                    <th>Setor</th>
                    <th>Não haverá meta</th>
                    <th>Meta</th>
                    {podeEditar && <th aria-label="Ações" />}
                  </tr>
                </thead>
                <tbody>
                  {setores.map((setor) => {
                    const noMeta = !!semMeta[setor];
                    const editando = editingSetores.has(setor);
                    return (
                      <tr
                        key={setor}
                        className={[
                          noMeta ? 'targets-row-no-meta' : '',
                          editando ? 'targets-row-editing' : '',
                        ]
                          .filter(Boolean)
                          .join(' ') || undefined}
                      >
                        <td>{setor}</td>
                        <td>
                          <label className="targets-checkbox-label">
                            <input
                              type="checkbox"
                              className="targets-checkbox"
                              checked={noMeta}
                              disabled={!podeEditar || !editando}
                              onChange={(e) => {
                                setSemMeta((prev) => ({ ...prev, [setor]: e.target.checked }));
                                if (e.target.checked) {
                                  setValues((prev) => ({ ...prev, [setor]: '' }));
                                }
                                setSuccess(null);
                              }}
                              aria-label={`Não haverá meta para ${setor}`}
                            />
                            <span>Não haverá meta</span>
                          </label>
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="targets-input"
                            value={values[setor] ?? ''}
                            placeholder={noMeta ? '—' : '0'}
                            disabled={noMeta || !podeEditar || !editando}
                            readOnly={!editando}
                            onChange={(e) => {
                              setValues((prev) => ({ ...prev, [setor]: e.target.value }));
                              setSuccess(null);
                            }}
                            aria-label={`Meta de ${setor}`}
                          />
                        </td>
                        {podeEditar && (
                          <td>
                            <div className="targets-row-actions">
                              {editando ? (
                                <>
                                  <button
                                    type="button"
                                    className="targets-cancel-btn"
                                    onClick={() => cancelEdit(setor)}
                                    disabled={saving === setor}
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    className="targets-save-btn"
                                    onClick={() => saveTarget(setor)}
                                    disabled={saving === setor}
                                  >
                                    {saving === setor ? 'Salvando...' : 'Salvar'}
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="targets-edit-btn"
                                  onClick={() => startEdit(setor)}
                                  disabled={!!saving}
                                >
                                  Editar
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {setores.length === 0 && (
              <p className="state-message">Nenhum setor encontrado.</p>
            )}
          </div>

          <p className="targets-hint">
            {podeEditar
              ? 'Clique em Editar para alterar a meta de um setor. Use "Editar todas" para liberar todos de uma vez.'
              : 'Visualização das metas de produção por setor.'}
          </p>
        </main>
      </div>
    </PainelProducaoShell>
  );
}
