import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  EQUIPE_LABEL,
  enviarComissionamentoInativosWhatsapp,
  listarComissionamentoClientesInativos,
  obterComissionamentoInativosWhatsapp,
  salvarComissionamentoInativosWhatsapp,
  type ClienteInativoComissionamento,
  type FiltrosComissionamento,
} from '../../api/comissionamento';
import { formatMoeda, formatNumero, formatYmdBr } from '../painel-comercial/painelComercialUtils';

type Props = {
  aberto: boolean;
  onClose: () => void;
  filtros: FiltrosComissionamento;
};

function waMeUrl(numero: string, texto: string): string | null {
  const digits = numero.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const n = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

function hojeFallback(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function montarPreview(clientes: ClienteInativoComissionamento[], meta: {
  referencia: string;
  dataIniAnalise: string;
  diasSemCompraMin: number;
}): string {
  const top = clientes.slice(0, 25);
  const linhas = top.map(
    (c, i) =>
      `${i + 1}. ${c.cliente} — ${c.diasSemCompra}d (últ. ${c.ultimaCompra.slice(0, 10)}) · ${c.vendedorUltimo}`
  );
  const extras = clientes.length > top.length ? `\n… +${clientes.length - top.length} cliente(s)` : '';
  return [
    `Clientes sem compra há +${meta.diasSemCompraMin} dias`,
    `Análise: ${meta.dataIniAnalise} → ${meta.referencia}`,
    `Total: ${clientes.length}`,
    '',
    ...linhas,
    extras,
  ]
    .filter(Boolean)
    .join('\n');
}

export default function ModalClientesInativosComissionamento({ aberto, onClose, filtros }: Props) {
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [clientes, setClientes] = useState<ClienteInativoComissionamento[]>([]);
  const [referencia, setReferencia] = useState('');
  const [dataIniAnalise, setDataIniAnalise] = useState('2025-01-01');
  const [diasMin, setDiasMin] = useState(90);
  const [busca, setBusca] = useState('');
  const [numero, setNumero] = useState('');

  const carregar = useCallback(async () => {
    if (!aberto) return;
    setLoading(true);
    setErro(null);
    setOkMsg(null);
    try {
      const [data, wa] = await Promise.all([
        listarComissionamentoClientesInativos(filtros),
        obterComissionamentoInativosWhatsapp(),
      ]);
      setClientes(data.clientes ?? []);
      setReferencia(data.referencia ?? '');
      setDataIniAnalise(data.dataIniAnalise ?? '2025-01-01');
      setDiasMin(data.diasSemCompraMin ?? 90);
      setNumero(wa.numero ?? '');
      if (data.erro) setErro(data.erro);
    } catch (e) {
      setClientes([]);
      setErro(e instanceof Error ? e.message : 'Erro ao carregar clientes inativos.');
    } finally {
      setLoading(false);
    }
  }, [aberto, filtros]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR');
    if (!q) return clientes;
    return clientes.filter((c) =>
      [c.cliente, c.vendedorUltimo, EQUIPE_LABEL[c.equipe] ?? c.equipe]
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(q)
    );
  }, [busca, clientes]);

  const preview = useMemo(
    () =>
      montarPreview(clientes, {
        referencia: referencia || formatYmdBr(new Date().toISOString().slice(0, 10)),
        dataIniAnalise,
        diasSemCompraMin: diasMin,
      }),
    [clientes, referencia, dataIniAnalise, diasMin]
  );

  const linkWa = useMemo(() => waMeUrl(numero, preview), [numero, preview]);

  const salvarNumero = async () => {
    setErro(null);
    setOkMsg(null);
    try {
      const saved = await salvarComissionamentoInativosWhatsapp(numero);
      setNumero(saved.numero);
      setOkMsg('Número WhatsApp salvo.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar número.');
    }
  };

  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    setOkMsg(null);
    try {
      const r = await enviarComissionamentoInativosWhatsapp(filtros, numero);
      setOkMsg(
        r.dryRun
          ? `Simulado (dry-run): lista de ${r.total} cliente(s) para ${r.numero}.`
          : `Enviado: ${r.total} cliente(s) para ${r.numero}.`
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar WhatsApp.');
    } finally {
      setEnviando(false);
    }
  };

  if (!aberto) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/70">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Clientes sem compra (+{diasMin} dias)
            </h2>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
              Análise de {formatYmdBr(dataIniAnalise)} até {formatYmdBr(referencia || hojeFallback())} ·
              respeita filtros de equipe/vendedor/grupo/status
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[14rem] flex-1">
              <label className="mb-1 block text-xs text-slate-500">WhatsApp destino (pré-definido)</label>
              <input
                type="text"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ex.: 86999999999 ou grupo@g.us"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <button
              type="button"
              onClick={() => void salvarNumero()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
            >
              Salvar número
            </button>
            <button
              type="button"
              disabled={enviando || loading || clientes.length === 0 || !numero.trim()}
              onClick={() => void enviar()}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {enviando ? 'Enviando…' : 'Disparar WhatsApp'}
            </button>
            {linkWa ? (
              <a
                href={linkWa}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100"
              >
                Abrir no WhatsApp
              </a>
            ) : null}
          </div>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente ou vendedor…"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          {erro ? (
            <p className="text-sm text-rose-600 dark:text-rose-300" role="alert">
              {erro}
            </p>
          ) : null}
          {okMsg ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
              {okMsg}
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <p className="p-8 text-center text-sm text-slate-500">Carregando clientes inativos…</p>
          ) : filtrados.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Nenhum cliente com mais de {diasMin} dias sem compra no recorte.
            </p>
          ) : (
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-2 py-2 text-left">Cliente</th>
                  <th className="px-2 py-2 text-left">Última compra</th>
                  <th className="px-2 py-2 text-right">Dias</th>
                  <th className="px-2 py-2 text-left">Últ. vendedor</th>
                  <th className="px-2 py-2 text-left">Equipe</th>
                  <th className="px-2 py-2 text-right">Pedidos</th>
                  <th className="px-2 py-2 text-right">Venda no período</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtrados.map((c) => (
                  <tr key={c.cliente} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40">
                    <td className="max-w-[16rem] truncate px-2 py-1.5 font-medium" title={c.cliente}>
                      {c.cliente}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{formatYmdBr(c.ultimaCompra)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-amber-800 dark:text-amber-200">
                      {formatNumero(c.diasSemCompra)}
                    </td>
                    <td className="max-w-[10rem] truncate px-2 py-1.5" title={c.vendedorUltimo}>
                      {c.vendedorUltimo}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {EQUIPE_LABEL[c.equipe] ?? c.equipe}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatNumero(c.pedidos)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatMoeda(c.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-600">
          <span className="text-xs text-slate-500">
            {filtrados.length} de {clientes.length} cliente(s)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
