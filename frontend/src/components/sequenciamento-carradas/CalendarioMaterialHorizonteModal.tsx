import { useEffect, useMemo, useState, type MutableRefObject } from 'react';
import type {
  DemandaCalendarioMateriais,
  HorizonteDiaCalendario,
  OrigemConsumoCalendario,
} from '../../api/sequenciamentoCarradas';
import { consultarDisponibilidadeMateriaisItem } from '../../api/sequenciamentoCarradas';
import { formatDataCurta } from './simulacaoCarradas';
import GradeCelulaModalBtn from '../pcp/GradeCelulaModalBtn';
import ModalPcPendDetalhes from '../ressupAlmox/ModalPcPendDetalhes';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const TH = 'px-2 py-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap';
const TD = 'px-2 py-1.5 border-b border-slate-100 dark:border-slate-700';

type HorizonteCache = {
  idProduto: number;
  codigo: string;
  descricao: string;
  saldoInicial: number;
  dias: HorizonteDiaCalendario[];
  origens: OrigemConsumoCalendario[];
};

/** Linha do horizonte com saldo início/projetado em carry livre (pode ser negativo). */
type HorizonteLinhaExibicao = {
  data: string;
  consumo: number;
  entrada: number;
  saldoInicio: number;
  saldoProjetado: number;
};

/**
 * Carry de exibição: saldo projetado do dia vira saldo início do seguinte (sem floor em 0).
 * Não altera o motor de falta/semáforo do backend.
 */
function montarLinhasHorizonteComCarry(
  dias: HorizonteDiaCalendario[],
  saldoInicial: number
): HorizonteLinhaExibicao[] {
  const out: HorizonteLinhaExibicao[] = [];
  let saldo = Number.isFinite(saldoInicial) ? saldoInicial : 0;
  for (const d of dias) {
    const saldoInicio = Math.round(saldo * 100) / 100;
    const saldoProjetado =
      Math.round((saldoInicio - d.consumo + d.entrada) * 100) / 100;
    out.push({
      data: d.data,
      consumo: d.consumo,
      entrada: d.entrada,
      saldoInicio,
      saldoProjetado,
    });
    saldo = saldoProjetado;
  }
  return out;
}

function classSaldoProjetado(saldoProj: number): string {
  if (saldoProj <= 0) return 'bg-red-50 dark:bg-red-950/30';
  return '';
}

export type CalendarioMaterialHorizonteModalProps = {
  open: boolean;
  codigo: string;
  idProdutoHint?: number | null;
  descricaoHint?: string;
  demanda: DemandaCalendarioMateriais[];
  onClose: () => void;
  cacheRef: MutableRefObject<Map<string, HorizonteCache>>;
};

export default function CalendarioMaterialHorizonteModal({
  open,
  codigo,
  idProdutoHint,
  descricaoHint,
  demanda,
  onClose,
  cacheRef,
}: CalendarioMaterialHorizonteModalProps) {
  const [dados, setDados] = useState<HorizonteCache | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pcOpen, setPcOpen] = useState(false);
  const [origemData, setOrigemData] = useState<string | null>(null);

  useRegisterModalEscape({
    id: 'calendario-material-horizonte',
    onClose: () => {
      if (pcOpen) {
        setPcOpen(false);
        return;
      }
      if (origemData) {
        setOrigemData(null);
        return;
      }
      onClose();
    },
    zIndex: 150,
    enabled: open,
  });

  useEffect(() => {
    if (!open || !codigo) {
      setDados(null);
      setErro(null);
      setCarregando(false);
      setPcOpen(false);
      setOrigemData(null);
      return;
    }
    const cached = cacheRef.current.get(codigo);
    if (cached) {
      setDados(cached);
      setErro(null);
      setCarregando(false);
      return;
    }
    let cancelled = false;
    setCarregando(true);
    setErro(null);
    void consultarDisponibilidadeMateriaisItem(demanda, codigo).then((r) => {
      if (cancelled) return;
      setCarregando(false);
      if (r.error || !r.data) {
        setErro(r.error ?? 'Falha ao carregar horizonte.');
        setDados(null);
        return;
      }
      const payload: HorizonteCache = {
        idProduto: r.data.idProduto,
        codigo: r.data.codigo,
        descricao: r.data.descricao,
        saldoInicial: r.data.saldoInicial,
        dias: r.data.dias,
        origens: r.data.origens,
      };
      cacheRef.current.set(codigo, payload);
      setDados(payload);
    });
    return () => {
      cancelled = true;
    };
  }, [open, codigo, demanda, cacheRef]);

  const origensFiltradas = useMemo(() => {
    if (!dados || !origemData) return [];
    return dados.origens.filter((o) => o.dataIso === origemData);
  }, [dados, origemData]);

  const linhasHorizonte = useMemo(() => {
    if (!dados) return [];
    return montarLinhasHorizonteComCarry(dados.dias, dados.saldoInicial);
  }, [dados]);

  if (!open) return null;

  const idProduto = dados?.idProduto ?? idProdutoHint ?? null;
  const descricao = dados?.descricao || descricaoHint || '';

  return (
    <>
      <div
        className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4"
        role="presentation"
        onClick={onClose}
      >
        <div
          className="flex max-h-[min(90vh,720px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
          role="dialog"
          aria-modal
          aria-labelledby="calendario-material-horizonte-titulo"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
            <div>
              <h2
                id="calendario-material-horizonte-titulo"
                className="text-lg font-semibold text-slate-800 dark:text-slate-100"
              >
                Horizonte · {codigo}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {descricao || '—'}
                {dados ? ` · Saldo almox secundário: ${fmtNum(dados.saldoInicial)}` : ''}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Saldo projetado = Saldo início − Consumo + Entrada PC (o projetado vira início do
                dia seguinte). Clique em <strong>Consumo</strong> para PAs/pedidos; em{' '}
                <strong>Entrada</strong> para PCs.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Fechar
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-4">
            {carregando && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Carregando horizonte…</p>
            )}
            {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
            {!carregando && !erro && dados && (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                    <th className={`${TH} text-left`}>Data</th>
                    <th className={`${TH} text-right`}>Saldo início</th>
                    <th className={`${TH} text-right`}>Consumo</th>
                    <th className={`${TH} text-right`}>Entrada PC</th>
                    <th className={`${TH} text-right`}>Saldo Projetado</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasHorizonte.map((d) => (
                    <tr key={d.data} className={classSaldoProjetado(d.saldoProjetado)}>
                      <td className={TD}>{formatDataCurta(d.data)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{fmtNum(d.saldoInicio)}</td>
                      <td className={`${TD} text-right tabular-nums`}>
                        {d.consumo > 0 ? (
                          <GradeCelulaModalBtn
                            onClick={() => setOrigemData(d.data)}
                            title="Ver origem do consumo"
                            align="right"
                          >
                            {fmtNum(d.consumo)}
                          </GradeCelulaModalBtn>
                        ) : (
                          fmtNum(d.consumo)
                        )}
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>
                        {d.entrada > 0 && idProduto != null ? (
                          <GradeCelulaModalBtn
                            onClick={() => setPcOpen(true)}
                            title="Ver pedidos de compra"
                            align="right"
                          >
                            {fmtNum(d.entrada)}
                          </GradeCelulaModalBtn>
                        ) : (
                          fmtNum(d.entrada)
                        )}
                      </td>
                      <td className={`${TD} text-right tabular-nums font-medium`}>
                        {fmtNum(d.saldoProjetado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {origemData && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={() => setOrigemData(null)}
        >
          <div
            className="flex max-h-[min(80vh,560px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
            role="dialog"
            aria-modal
            aria-labelledby="calendario-origem-consumo-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
              <h3
                id="calendario-origem-consumo-titulo"
                className="text-base font-semibold text-slate-800 dark:text-slate-100"
              >
                Origem do consumo · {formatDataCurta(origemData)}
              </h3>
              <button
                type="button"
                onClick={() => setOrigemData(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Fechar
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {origensFiltradas.length === 0 ? (
                <p className="text-sm text-slate-500">Sem origem nesta data.</p>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-600">
                      <th className={`${TH} text-left`}>PA</th>
                      <th className={`${TH} text-left`}>PD</th>
                      <th className={`${TH} text-left`}>Setor</th>
                      <th className={`${TH} text-right`}>Qtde PA</th>
                      <th className={`${TH} text-right`}>Qtde comp.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {origensFiltradas.map((o, i) => (
                      <tr key={`${o.codigoPa}-${o.pd}-${i}`}>
                        <td className={TD}>{o.codigoPa}</td>
                        <td className={TD}>{o.pd || '—'}</td>
                        <td className={TD}>{o.setor || '—'}</td>
                        <td className={`${TD} text-right tabular-nums`}>{fmtNum(o.qtdePa)}</td>
                        <td className={`${TD} text-right tabular-nums`}>
                          {fmtNum(o.qtdeComponente)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {pcOpen && idProduto != null && (
        <ModalPcPendDetalhes
          open
          idProduto={idProduto}
          codigo={codigo}
          descricao={descricao}
          onClose={() => setPcOpen(false)}
        />
      )}
    </>
  );
}
