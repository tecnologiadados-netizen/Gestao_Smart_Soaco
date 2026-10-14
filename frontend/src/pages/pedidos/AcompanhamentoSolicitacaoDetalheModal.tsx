import { useCallback, useEffect, useState, type MutableRefObject } from 'react';
import ModalConsultaEstoqueDetalhe, { fmtQtde } from '../../components/pcp/ModalConsultaEstoqueDetalhe';
import {
  obterDetalheAcompanhamento,
  type DetalheAcompanhamento,
  type EtapaAcompanhamento,
  type LinhaDetalheComprado,
  type LinhaDetalhePreEntrada,
  type LinhaDetalheSolicitado,
} from '../../api/acompanhamentoSolicitacao';

const TITULO: Record<EtapaAcompanhamento, string> = {
  solicitado: 'Solicitado',
  comprado: 'Comprado',
  pre_entrada: 'Pré-entrada',
};

type Alvo = {
  idProduto: number;
  etapa: EtapaAcompanhamento;
  codigo: string;
  descricao: string;
  qtdeGrade: number;
};

type Props = {
  alvo: Alvo | null;
  cacheRef: MutableRefObject<Map<string, DetalheAcompanhamento>>;
  onClose: () => void;
};

function chave(alvo: Alvo): string {
  return `${alvo.idProduto}:${alvo.etapa}`;
}

function soma(linhas: { qtde: number }[]): number {
  return Math.round(linhas.reduce((acc, l) => acc + l.qtde, 0) * 100) / 100;
}

function celula(valor: string | null | undefined): string {
  const t = valor?.trim();
  return t ? t : '—';
}

export default function AcompanhamentoSolicitacaoDetalheModal({ alvo, cacheRef, onClose }: Props) {
  const [detalhe, setDetalhe] = useState<DetalheAcompanhamento | null>(null);

  useEffect(() => {
    setDetalhe(null);
  }, [alvo?.idProduto, alvo?.etapa]);

  const onLoad = useCallback(async () => {
    if (!alvo) return {};
    const key = chave(alvo);
    const cached = cacheRef.current.get(key);
    if (cached) {
      setDetalhe(cached);
      return {};
    }
    const r = await obterDetalheAcompanhamento(alvo.idProduto, alvo.etapa);
    if (r.error || !r.detalhe) return { error: r.error ?? 'Não foi possível carregar o detalhe.' };
    cacheRef.current.set(key, r.detalhe);
    setDetalhe(r.detalhe);
    return {};
  }, [alvo, cacheRef]);

  const linhas = detalhe && alvo && detalhe.etapa === alvo.etapa ? detalhe.linhas : [];
  const total = soma(linhas);

  return (
    <ModalConsultaEstoqueDetalhe
      open={alvo != null}
      detailKey={alvo ? chave(alvo) : null}
      titulo={alvo ? `${TITULO[alvo.etapa]} · ${alvo.codigo}` : ''}
      subtitulo={alvo?.descricao ?? ''}
      onClose={onClose}
      onLoad={onLoad}
      largo
      backdropMode="fixed"
      zIndex={14020}
    >
      {({ carregando, erro }) => {
        if (erro) return <p className="text-sm text-red-600">{erro}</p>;
        if (carregando || !detalhe) return <p className="text-sm text-slate-500">Carregando detalhe…</p>;
        if (!alvo || linhas.length === 0) {
          return <p className="text-sm text-slate-500">Nenhuma linha nesta etapa.</p>;
        }
        return (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                {alvo.etapa === 'solicitado' ? (
                  <tr>
                    <th className="px-2 py-2 font-medium">Solicitação</th>
                    <th className="px-2 py-2 font-medium">Emissão</th>
                    <th className="px-2 py-2 font-medium">Necessidade</th>
                    <th className="px-2 py-2 font-medium">Usuário</th>
                    <th className="px-2 py-2 text-right font-medium">Qtde</th>
                  </tr>
                ) : alvo.etapa === 'comprado' ? (
                  <tr>
                    <th className="px-2 py-2 font-medium">Solicitação</th>
                    <th className="px-2 py-2 font-medium">Pedido</th>
                    <th className="px-2 py-2 font-medium">Fornecedor</th>
                    <th className="px-2 py-2 font-medium">Entrega</th>
                    <th className="px-2 py-2 text-right font-medium">Saldo</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-2 py-2 font-medium">Solicitação</th>
                    <th className="px-2 py-2 font-medium">Pedido</th>
                    <th className="px-2 py-2 font-medium">Documento</th>
                    <th className="px-2 py-2 font-medium">NF</th>
                    <th className="px-2 py-2 font-medium">Fornecedor</th>
                    <th className="px-2 py-2 font-medium">Emissão</th>
                    <th className="px-2 py-2 font-medium">Situação</th>
                    <th className="px-2 py-2 text-right font-medium">Qtde</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {alvo.etapa === 'solicitado' &&
                  (linhas as LinhaDetalheSolicitado[]).map((l) => (
                    <tr key={l.idSolicitacao} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-2 py-2 font-medium text-slate-800 dark:text-slate-100">{l.idSolicitacao}</td>
                      <td className="px-2 py-2">{celula(l.dataEmissao)}</td>
                      <td className="px-2 py-2">{celula(l.dataNecessidade)}</td>
                      <td className="px-2 py-2">{celula(l.usuario)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmtQtde(l.qtde)}</td>
                    </tr>
                  ))}
                {alvo.etapa === 'comprado' &&
                  (linhas as LinhaDetalheComprado[]).map((l) => (
                    <tr key={l.idItem} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-2 py-2 font-medium text-slate-800 dark:text-slate-100">{celula(l.solicitacoes)}</td>
                      <td className="px-2 py-2">{l.pedido}</td>
                      <td className="px-2 py-2">{celula(l.fornecedor)}</td>
                      <td className="px-2 py-2">{celula(l.dataEntrega)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmtQtde(l.qtde)}</td>
                    </tr>
                  ))}
                {alvo.etapa === 'pre_entrada' &&
                  (linhas as LinhaDetalhePreEntrada[]).map((l) => (
                    <tr key={l.idItem} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-2 py-2 font-medium text-slate-800 dark:text-slate-100">{celula(l.solicitacoes)}</td>
                      <td className="px-2 py-2">{celula(l.pedidos)}</td>
                      <td className="px-2 py-2">{celula(l.numeroDocumento)}</td>
                      <td className="px-2 py-2">{celula(l.numeroNfe)}</td>
                      <td className="px-2 py-2">{celula(l.fornecedor)}</td>
                      <td className="px-2 py-2">{celula(l.dataEmissao)}</td>
                      <td className="px-2 py-2">{l.situacao}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmtQtde(l.qtde)}</td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold dark:border-slate-600 dark:bg-slate-900">
                  <td className="px-2 py-2" colSpan={alvo.etapa === 'pre_entrada' ? 7 : alvo.etapa === 'solicitado' ? 4 : 4}>
                    Total do detalhe
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtQtde(total)}</td>
                </tr>
              </tfoot>
            </table>
            <p className="mt-2 text-xs text-slate-500">
              Quantidade na linha do pipeline: {fmtQtde(alvo.qtdeGrade)}. A soma do detalhe usa a mesma regra.
            </p>
          </div>
        );
      }}
    </ModalConsultaEstoqueDetalhe>
  );
}
