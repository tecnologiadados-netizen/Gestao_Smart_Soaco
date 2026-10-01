import { useCallback, useRef, useState } from 'react';
import {
  obterScDetalhe,
  type CotacaoDetalhe,
  type ScDetalhe,
} from '../../api/consultaEstoque';
import ModalConsultaEstoqueDetalhe, { fmtQtde } from './ModalConsultaEstoqueDetalhe';
import TabelaDetalheSolicitacao from './TabelaDetalheSolicitacao';

type Props = {
  linhas: CotacaoDetalhe[];
  /** Habilita o clique na coluna SC para abrir a solicitação correspondente. */
  idProduto?: number | null;
  codigo?: string;
  descricao?: string;
  /** Fonte das SCs (ao vivo ou congelada). Padrão: detalhe ao vivo da Consulta de Estoque. */
  carregarSolicitacoes?: (idProduto: number) => Promise<{ data: ScDetalhe[]; error?: string }>;
  zIndexSc?: number;
};

function codigosDaCelula(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== '—');
}

export default function TabelaDetalheCotacao({
  linhas,
  idProduto,
  codigo,
  descricao,
  carregarSolicitacoes,
  zIndexSc = 14250,
}: Props) {
  const [scAberta, setScAberta] = useState<number | null>(null);
  const [linhasSc, setLinhasSc] = useState<ScDetalhe[]>([]);
  const cacheRef = useRef(new Map<number, ScDetalhe[]>());
  const pedidoRef = useRef<number | null>(null);
  const cliqueHabilitado = idProduto != null && idProduto > 0;

  const carregarSc = useCallback(async () => {
    if (!cliqueHabilitado || idProduto == null || scAberta == null) return {};
    const codigoPedido = scAberta;
    pedidoRef.current = codigoPedido;
    const cached = cacheRef.current.get(idProduto);
    if (cached) {
      if (pedidoRef.current === codigoPedido) setLinhasSc(cached);
      return {};
    }
    const buscar = carregarSolicitacoes ?? obterScDetalhe;
    const r = await buscar(idProduto);
    if (pedidoRef.current !== codigoPedido) return {};
    if (r.error) {
      setLinhasSc([]);
      return { error: r.error };
    }
    cacheRef.current.set(idProduto, r.data);
    setLinhasSc(r.data);
    return {};
  }, [carregarSolicitacoes, cliqueHabilitado, idProduto, scAberta]);

  if (linhas.length === 0) {
    return <p className="text-slate-500">Sem cotações nos status 1–3.</p>;
  }

  return (
    <>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-slate-50 dark:bg-slate-900/50">
            <th className="py-2 text-left">Cotação</th>
            <th className="py-2 text-left">Emissão</th>
            <th className="py-2 text-left">Comprador</th>
            <th className="py-2 text-left">SC</th>
            <th className="py-2 text-right">Qtde</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((c, i) => {
            const codigos = codigosDaCelula(c.scCodigos);
            return (
              <tr key={`${c.cotacao}-${i}`} className="border-b border-slate-100 dark:border-slate-700">
                <td className="py-1.5 font-mono">{c.cotacao}</td>
                <td className="py-1.5">{c.dataEmissao ?? '—'}</td>
                <td className="py-1.5">{c.comprador}</td>
                <td className="py-1.5 font-mono">
                  {codigos.length === 0 ? (
                    '—'
                  ) : cliqueHabilitado ? (
                    <span className="inline-flex flex-wrap">
                      {codigos.map((sc, idx) => {
                        const n = Number(sc);
                        const clicavel = Number.isFinite(n) && n > 0;
                        return (
                          <span key={`${sc}-${idx}`}>
                            {idx > 0 ? <span className="text-slate-400">, </span> : null}
                            {clicavel ? (
                              <button
                                type="button"
                                className="font-mono text-primary-700 underline decoration-primary-400/70 underline-offset-2 hover:text-primary-500 dark:text-primary-300"
                                title="Ver solicitação de compra"
                                onClick={() => setScAberta(n)}
                              >
                                {sc}
                              </button>
                            ) : (
                              sc
                            )}
                          </span>
                        );
                      })}
                    </span>
                  ) : (
                    c.scCodigos
                  )}
                </td>
                <td className="py-1.5 text-right tabular-nums">{fmtQtde(c.qtde)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {cliqueHabilitado && scAberta != null && idProduto != null && (
        <ModalConsultaEstoqueDetalhe
          open
          titulo={`Solicitação de compra — ${codigo?.trim() || scAberta}`}
          subtitulo={descricao?.trim() || ''}
          onClose={() => setScAberta(null)}
          detailKey={`sc-cotacao-${idProduto}-${scAberta}`}
          onLoad={carregarSc}
          backdropMode="fixed"
          zIndex={zIndexSc}
        >
          {({ carregando, erro }) => {
            if (carregando) return <p className="py-6 text-center text-slate-500">Carregando…</p>;
            if (erro) return <p className="text-red-600">{erro}</p>;
            return <TabelaDetalheSolicitacao linhas={linhasSc} codigos={[scAberta]} />;
          }}
        </ModalConsultaEstoqueDetalhe>
      )}
    </>
  );
}
