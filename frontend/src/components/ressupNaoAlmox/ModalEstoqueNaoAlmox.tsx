import { useEffect, useState, type MutableRefObject } from 'react';
import ResizableModalShell from '../ResizableModalShell';
import {
  fetchRessupNaoAlmoxEstoque,
  type EstoqueEmProducaoNaoAlmox,
  type RessupNaoAlmoxEstoqueSetor,
} from '../../api/ressupNaoAlmox';
import {
  ESTOQUE_PROCESSO_VAZIO,
  calcEstoqueTotalNaoAlmox,
  formatNum,
  normalizarEstoqueProcesso,
  parseNumInputBranco,
  saldoMppFromSetores,
  saldoSetor2FromSetores,
  somaEstoqueProcesso,
  somaSetoresErp,
} from '../../utils/ressupNaoAlmoxCalculos';
import { coletaDestacaSetor2Almox } from '../../utils/ressupNaoAlmoxColetas';
import { numInputDisplayBranco } from '../programacao-producao/programacaoProducaoCalculos';

/** Resultado do estoque ERP por setor (cacheável por idProduto+codigoPintado). */
export type EstoqueNaoAlmoxResultado = {
  setores: RessupNaoAlmoxEstoqueSetor[];
  setoresPintado: RessupNaoAlmoxEstoqueSetor[];
  error?: string;
};

const BTN_SECONDARY =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';
const BTN_PRIMARY =
  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition';
const INPUT =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm dark:bg-slate-900 dark:text-slate-100';

function labelSemPintura(codigo: string): string {
  return codigo.trim() ? `Sem pintura (${codigo.trim()})` : 'Sem pintura';
}

function labelComPintura(codigoPintado?: string | null): string {
  const c = (codigoPintado ?? '').trim();
  return c ? `Com pintura (${c})` : 'Com pintura';
}

function CardsResumoEstoque({
  saldoMpp,
  saldoAlmoxSecundario,
  destacarAlmoxSecundario,
  saldoProducao,
  total,
}: {
  saldoMpp: number;
  saldoAlmoxSecundario: number;
  destacarAlmoxSecundario: boolean;
  saldoProducao: number;
  total: number;
}) {
  const gridCols = destacarAlmoxSecundario
    ? 'grid-cols-2 sm:grid-cols-4'
    : 'grid-cols-2 sm:grid-cols-3';

  return (
    <div className={`mb-4 grid gap-2 ${gridCols}`}>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900/40">
        <div className="text-[11px] text-slate-500 dark:text-slate-400">Estoque MPP</div>
        <div className="text-sm font-medium tabular-nums">{formatNum(saldoMpp)}</div>
      </div>
      {destacarAlmoxSecundario && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/90 px-3 py-2 dark:border-amber-700 dark:bg-amber-900/25">
          <div className="text-[11px] font-medium text-amber-800 dark:text-amber-300">Almox secundário</div>
          <div className="text-sm font-semibold tabular-nums text-amber-900 dark:text-amber-100">
            {formatNum(saldoAlmoxSecundario)}
          </div>
        </div>
      )}
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900/40">
        <div className="text-[11px] text-slate-500 dark:text-slate-400">Estoque em produção</div>
        <div className="text-sm font-medium tabular-nums">{formatNum(saldoProducao)}</div>
      </div>
      <div className="col-span-2 rounded-lg border border-primary-200 bg-primary-50/80 px-3 py-2 dark:border-primary-800 dark:bg-primary-900/30 sm:col-span-1">
        <div className="text-[11px] font-medium text-primary-700 dark:text-primary-300">Total</div>
        <div className="text-sm font-semibold tabular-nums">{formatNum(total)}</div>
      </div>
    </div>
  );
}

export type ModalEstoqueNaoAlmoxProps = {
  idProduto: number;
  codigo: string;
  descricao: string;
  codigoPintado?: string | null;
  /** Coleta FUNDÍVEIS: layout em tabela com sem/com pintura */
  modoFundivel?: boolean;
  /** Isopor, Lamipro e Fundíveis: oculta linha Marcenaria em produção */
  excluirMarcenaria?: boolean;
  /** Coleta do produto — define destaque do almox secundário (setor 2). */
  nomeColeta?: string | null;
  readOnly: boolean;
  estoqueEmProducao?: EstoqueEmProducaoNaoAlmox;
  onClose: () => void;
  onSave: (v: { estoqueEmProducao: EstoqueEmProducaoNaoAlmox; estoqueTotal: number }) => void;
  /** Cache opcional do estoque ERP — reabrir o modal = instantâneo até novo Filtrar. */
  cacheRef?: MutableRefObject<Map<string, EstoqueNaoAlmoxResultado>>;
};

export default function ModalEstoqueNaoAlmox({
  idProduto,
  codigo,
  descricao,
  codigoPintado,
  modoFundivel = false,
  excluirMarcenaria = false,
  nomeColeta = null,
  readOnly,
  estoqueEmProducao,
  onClose,
  onSave,
  cacheRef,
}: ModalEstoqueNaoAlmoxProps) {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [setores, setSetores] = useState<RessupNaoAlmoxEstoqueSetor[]>([]);
  const [setoresPintado, setSetoresPintado] = useState<RessupNaoAlmoxEstoqueSetor[]>([]);
  const [vals, setVals] = useState<EstoqueEmProducaoNaoAlmox>(() =>
    normalizarEstoqueProcesso(estoqueEmProducao ?? ESTOQUE_PROCESSO_VAZIO)
  );

  useEffect(() => {
    const cacheKey = `${idProduto}-${codigoPintado ?? ''}`;
    const cached = cacheRef?.current.get(cacheKey);
    if (cached) {
      setSetores(cached.setores);
      setSetoresPintado(cached.setoresPintado);
      setErro(cached.error ?? null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErro(null);
    void fetchRessupNaoAlmoxEstoque(idProduto, codigoPintado).then((r) => {
      if (cancelled) return;
      cacheRef?.current.set(cacheKey, r);
      setSetores(r.setores);
      setSetoresPintado(r.setoresPintado);
      setErro(r.error ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [idProduto, codigoPintado, cacheRef]);

  const destacarAlmoxSecundario = coletaDestacaSetor2Almox(nomeColeta);
  const saldoSetor2 =
    saldoSetor2FromSetores(setores) + saldoSetor2FromSetores(setoresPintado);
  const saldoMpp =
    saldoMppFromSetores(setores, destacarAlmoxSecundario) +
    saldoMppFromSetores(setoresPintado, destacarAlmoxSecundario);
  const procTotal = somaEstoqueProcesso(vals, modoFundivel, excluirMarcenaria);
  const grandTotal = calcEstoqueTotalNaoAlmox(
    setores,
    setoresPintado,
    vals,
    modoFundivel,
    excluirMarcenaria
  );

  const fieldsSimples: { key: keyof EstoqueEmProducaoNaoAlmox; label: string }[] = [
    { key: 'chaoFabrica', label: 'Estoque chão de fábrica' },
    ...(excluirMarcenaria ? [] : [{ key: 'marcenaria' as const, label: 'Estoque Marcenaria' }]),
  ];

  const fieldsFundivel: { sem: keyof EstoqueEmProducaoNaoAlmox; com: keyof EstoqueEmProducaoNaoAlmox; label: string }[] =
    [
      { sem: 'chaoFabrica', com: 'chaoFabricaComPintura', label: 'Chão de fábrica' },
      ...(excluirMarcenaria
        ? []
        : [{ sem: 'marcenaria' as const, com: 'marcenariaComPintura' as const, label: 'Marcenaria' }]),
    ];

  return (
    <ResizableModalShell
      title={`Estoque — ${codigo}`}
      subtitle={descricao}
      onClose={onClose}
      defaultWidth={modoFundivel ? 560 : 480}
      defaultHeight={modoFundivel ? 480 : 440}
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>
            {readOnly ? 'Fechar' : 'Cancelar'}
          </button>
          {!readOnly && !loading && (
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={() => {
                const normalizado = normalizarEstoqueProcesso(vals);
                onSave({ estoqueEmProducao: normalizado, estoqueTotal: grandTotal });
                onClose();
              }}
            >
              Aplicar
            </button>
          )}
        </>
      }
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-slate-500 dark:text-slate-400">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600 dark:border-slate-600 dark:border-t-primary-400"
            aria-hidden
          />
          <p>Carregando estoque do Nomus…</p>
        </div>
      ) : erro ? (
        <p className="py-6 text-center text-sm text-red-600 dark:text-red-400">{erro}</p>
      ) : (
        <>
          <CardsResumoEstoque
            saldoMpp={saldoMpp}
            saldoAlmoxSecundario={saldoSetor2}
            destacarAlmoxSecundario={destacarAlmoxSecundario}
            saldoProducao={procTotal}
            total={grandTotal}
          />

          <h3 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-2">
            Estoque em produção (manual)
          </h3>

          {modoFundivel ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-600 text-xs uppercase text-slate-500 dark:text-slate-400">
                    <th className="py-1.5 text-left font-semibold">Local</th>
                    <th className="py-1.5 text-right font-semibold">{labelSemPintura(codigo)}</th>
                    <th className="py-1.5 text-right font-semibold">{labelComPintura(codigoPintado)}</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldsFundivel.map(({ sem, com, label }) => (
                    <tr key={label} className="border-b border-slate-100 dark:border-slate-700">
                      <td className="py-2 text-slate-700 dark:text-slate-300 align-middle">{label}</td>
                      <td className="py-2 pl-2 align-middle">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          disabled={readOnly}
                          className={INPUT}
                          value={numInputDisplayBranco(vals[sem])}
                          onChange={(e) =>
                            setVals((prev) => ({ ...prev, [sem]: parseNumInputBranco(e.target.value) }))
                          }
                        />
                      </td>
                      <td className="py-2 pl-2 align-middle">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          disabled={readOnly}
                          className={INPUT}
                          value={numInputDisplayBranco(vals[com])}
                          onChange={(e) =>
                            setVals((prev) => ({ ...prev, [com]: parseNumInputBranco(e.target.value) }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {fieldsSimples.map(({ key, label }) => (
                <label key={key} className="block">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    disabled={readOnly}
                    className={INPUT}
                    value={numInputDisplayBranco(vals[key])}
                    onChange={(e) => setVals((prev) => ({ ...prev, [key]: parseNumInputBranco(e.target.value) }))}
                  />
                </label>
              ))}
            </div>
          )}
        </>
      )}
    </ResizableModalShell>
  );
}

export { calcEstoqueTotalNaoAlmox, somaSetoresErp };
