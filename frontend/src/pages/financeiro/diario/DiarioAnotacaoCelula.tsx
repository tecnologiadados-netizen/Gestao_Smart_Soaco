import { useEffect, useState } from 'react';
import { salvarAnotacaoDiario, type DiarioContaPagarLinha } from '../../../api/diarioFinanceiro';

export function DiarioAnotacaoCelula({
  linha,
  onGravada,
}: {
  linha: DiarioContaPagarLinha;
  onGravada: (texto: string | null) => void;
}) {
  const [valor, setValor] = useState(linha.anotacao ?? '');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setValor(linha.anotacao ?? '');
  }, [linha.anotacao, linha.origem, linha.codigo]);

  const gravar = async () => {
    const texto = valor.trim();
    if (texto === (linha.anotacao ?? '').trim()) return;
    if (!(linha.codigo > 0)) return;
    setSalvando(true);
    try {
      const gravado = await salvarAnotacaoDiario({
        origem: linha.origem,
        codigo: linha.codigo,
        texto,
      });
      onGravada(gravado);
    } catch (err) {
      setValor(linha.anotacao ?? '');
      throw err;
    } finally {
      setSalvando(false);
    }
  };

  return (
    <input
      value={valor}
      disabled={salvando || !(linha.codigo > 0)}
      maxLength={1000}
      placeholder="Observação"
      title={valor || 'Digite a observação desta conta'}
      onChange={(e) => setValor(e.target.value)}
      onBlur={() => {
        void gravar().catch((err: unknown) => {
          window.alert(err instanceof Error ? err.message : String(err));
        });
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
      }}
      className="w-full min-w-[10rem] rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] uppercase outline-none hover:border-slate-300 focus:border-primary-500 focus:bg-white disabled:opacity-60 dark:hover:border-slate-600 dark:focus:bg-slate-800"
    />
  );
}
