import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchOrdensNomusPorComponente } from '../../api/programacaoProducao';
import ResizableModalShell from '../ResizableModalShell';
import { useHorizontalWheelScroll } from '../../hooks/useHorizontalWheelScroll';
import {
  limiteQtdeProduzirLinha,
  opJaSelecionada,
  ordensProducaoNomusDaLinha,
  podeIncluirOp,
  somaSaldoOpsSelecionadas,
} from '../../utils/programacaoProducaoOpsNomus';
import { formatNum } from './programacaoProducaoCalculos';
import type { LinhaProgramacaoProducao, OrdemNomusOpcao, OrdemProducaoNomusSelecionada } from './types';

const BTN_SECONDARY =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';

const BTN_PRIMARY =
  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition disabled:opacity-50';

const INPUT =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm dark:bg-slate-900 dark:text-slate-100';

type Props = {
  linha: LinhaProgramacaoProducao;
  readOnly: boolean;
  onClose: () => void;
  onSave: (ordens: OrdemProducaoNomusSelecionada[]) => void;
};

export default function ModalOpsNomus({ linha, readOnly, onClose, onSave }: Props) {
  const [busca, setBusca] = useState('');
  const [selecionadas, setSelecionadas] = useState<OrdemProducaoNomusSelecionada[]>(() =>
    ordensProducaoNomusDaLinha(linha)
  );
  const [opcoes, setOpcoes] = useState<OrdemNomusOpcao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [erroApply, setErroApply] = useState<string | null>(null);

  const limite = limiteQtdeProduzirLinha(linha);
  const soma = somaSaldoOpsSelecionadas(selecionadas);

  const subtitle = [linha.cod_componente, linha.descricao_simplificada?.trim()]
    .filter(Boolean)
    .join(' — ');

  const carregarOpsNomus = useCallback(async () => {
    setLoading(true);
    setErro(null);
    const { data, erro: errApi } = await fetchOrdensNomusPorComponente(linha.idComponente);
    setOpcoes(data);
    setErro(errApi ?? null);
    setLoading(false);
  }, [linha.idComponente]);

  useEffect(() => {
    void carregarOpsNomus();
  }, [carregarOpsNomus]);

  /** OPs com saldo acima da qtde produzir não entram na lista. */
  const opcoesElegiveis = useMemo(() => {
    if (limite <= 0) return opcoes;
    return opcoes.filter(
      (op) => op.saldo <= limite + 1e-9 || opJaSelecionada(selecionadas, op.ordem)
    );
  }, [opcoes, limite, selecionadas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = q
      ? opcoesElegiveis.filter((op) => {
          const blob = `${op.ordem} ${op.status} ${op.tipo_ordem} ${op.descricao_produto}`.toLowerCase();
          return blob.includes(q);
        })
      : opcoesElegiveis;
    return [...base].sort((a, b) => {
      const ta = a.data_emissao ? new Date(a.data_emissao).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = b.data_emissao ? new Date(b.data_emissao).getTime() : Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });
  }, [opcoesElegiveis, busca]);

  const toggleOp = (op: OrdemNomusOpcao) => {
    if (readOnly) return;
    setErroApply(null);
    if (opJaSelecionada(selecionadas, op.ordem)) {
      setSelecionadas((prev) => prev.filter((s) => s.ordem !== op.ordem));
      return;
    }
    if (!podeIncluirOp(selecionadas, op, limite)) {
      setErroApply(
        `Não é possível incluir ${op.ordem}: soma das OPs (${formatNum(somaSaldoOpsSelecionadas(selecionadas) + op.saldo)}) ultrapassa Qtde produzir (${formatNum(limite)}).`
      );
      return;
    }
    setSelecionadas((prev) => [...prev, { ordem: op.ordem, saldo: op.saldo }]);
  };

  const handleApply = () => {
    setErroApply(null);
    if (limite > 0 && soma > limite + 1e-9) {
      setErroApply(
        `A soma das OPs selecionadas (${formatNum(soma)}) deve ser igual ou inferior à Qtde produzir (${formatNum(limite)}).`
      );
      return;
    }
    onSave(selecionadas);
    onClose();
  };

  const bodyScrollRef = useRef<HTMLDivElement>(null);
  useHorizontalWheelScroll(bodyScrollRef);

  return (
    <ResizableModalShell
      onClose={onClose}
      defaultWidth={560}
      defaultHeight={480}
      ariaLabelledBy="pp-ops-nomus-title"
    >
      <div className="flex h-full min-h-0 flex-col pb-1">
        <div className="shrink-0 border-b border-slate-200 p-4 dark:border-slate-600">
          <h2 id="pp-ops-nomus-title" className="text-base font-semibold text-slate-800 dark:text-slate-100">
            OP Nomus
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 truncate">
            {subtitle || linha.cod_componente}
          </p>
        </div>
        <div ref={bodyScrollRef} className="min-h-0 flex-1 overflow-auto p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            Qtde produzir: <strong className="tabular-nums">{formatNum(limite)}</strong> · Soma OPs:{' '}
            <strong
              className={`tabular-nums ${limite > 0 && soma > limite + 1e-9 ? 'text-red-600' : ''}`}
            >
              {formatNum(soma)}
            </strong>
          </p>
          {!readOnly && (
            <div className="mb-3 flex gap-2">
              <input
                type="search"
                className={`${INPUT} min-w-0 flex-1`}
                placeholder="Buscar OP (código, status, descrição…)"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              <button
                type="button"
                className={BTN_SECONDARY}
                disabled={loading}
                onClick={() => void carregarOpsNomus()}
              >
                Atualizar
              </button>
            </div>
          )}
          {loading && <p className="text-sm text-slate-500">Carregando OPs do Nomus…</p>}
          {erro && <p className="text-sm text-red-600 dark:text-red-300">{erro}</p>}
          {!loading && !erro && filtradas.length === 0 && (
            <p className="text-sm text-slate-500">Nenhuma OP encontrada.</p>
          )}
          <ul className="space-y-1 max-h-[min(50vh,320px)] overflow-y-auto pr-1">
            {filtradas.map((op) => {
              const checked = opJaSelecionada(selecionadas, op.ordem);
              const disabled = !readOnly && !checked && !podeIncluirOp(selecionadas, op, limite);
              return (
                <li key={op.ordem}>
                  <label
                    className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 text-sm cursor-pointer ${
                      disabled
                        ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-700'
                        : checked
                          ? 'border-primary-400 bg-primary-50 dark:border-primary-600 dark:bg-primary-900/20'
                          : 'border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 shrink-0"
                      checked={checked}
                      disabled={readOnly || disabled}
                      onChange={() => toggleOp(op)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-mono font-medium text-slate-800 dark:text-slate-100">
                        {op.ordem}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400"> — {op.status}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        Saldo: {formatNum(op.saldo)} · Planejada: {formatNum(op.qtde_planejada)} · Emissão:{' '}
                        {op.data_emissao
                          ? new Date(op.data_emissao).toLocaleDateString('pt-BR')
                          : '—'}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {erroApply && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{erroApply}</p>
          )}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-600">
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>
            {readOnly ? 'Fechar' : 'Cancelar'}
          </button>
          {!readOnly && (
            <button type="button" className={BTN_PRIMARY} onClick={handleApply}>
              Aplicar
            </button>
          )}
        </div>
      </div>
    </ResizableModalShell>
  );
}
