import { useEffect, useState } from 'react';
import { salvarAnotacaoDiario, type DiarioContaPagarLinha } from '../../../api/diarioFinanceiro';
import { corObservacaoDiario, hexObservacaoDiario, type CorObservacaoDiario } from './coresObservacaoDiario';

export function DiarioAnotacaoCelula({
  linha,
  dataProcesso,
  somenteLeitura = false,
  onGravada,
}: {
  linha: DiarioContaPagarLinha;
  dataProcesso: string;
  somenteLeitura?: boolean;
  onGravada: (valor: { texto: string | null; cor: string | null }) => void;
}) {
  const [valor, setValor] = useState(linha.anotacao ?? '');
  const [cor, setCor] = useState<CorObservacaoDiario | null>(corObservacaoDiario(linha.anotacaoCor));
  const [salvando, setSalvando] = useState(false);
  const bloqueado = somenteLeitura || salvando || !(linha.codigo > 0);

  useEffect(() => {
    setValor(linha.anotacao ?? '');
    setCor(corObservacaoDiario(linha.anotacaoCor));
  }, [linha.anotacao, linha.anotacaoCor, linha.origem, linha.codigo]);

  const gravar = async (textoInformado: string, corInformada: CorObservacaoDiario | null) => {
    const texto = textoInformado.trim();
    if (somenteLeitura) return;
    if (texto === (linha.anotacao ?? '').trim() && corInformada === corObservacaoDiario(linha.anotacaoCor)) return;
    if (!(linha.codigo > 0)) return;
    setSalvando(true);
    try {
      const gravado = await salvarAnotacaoDiario({
        origem: linha.origem,
        codigo: linha.codigo,
        texto,
        cor: corInformada,
        dataProcesso,
      });
      setValor(gravado.texto ?? '');
      setCor(corObservacaoDiario(gravado.cor));
      onGravada(gravado);
    } catch (err) {
      setValor(linha.anotacao ?? '');
      setCor(corObservacaoDiario(linha.anotacaoCor));
      throw err;
    } finally {
      setSalvando(false);
    }
  };

  const falha = (err: unknown) => {
    window.alert(err instanceof Error ? err.message : String(err));
  };

  const fundo = hexObservacaoDiario(cor);

  return (
    <input
      value={valor}
      disabled={bloqueado}
      maxLength={1000}
      placeholder="Observação"
      title={valor || 'Digite a observação desta conta'}
      onChange={(e) => setValor(e.target.value)}
      onBlur={() => {
        void gravar(valor, cor).catch(falha);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
      }}
      className="w-full min-w-[10rem] rounded border border-transparent px-1 py-0.5 text-[11px] uppercase outline-none hover:border-slate-300 focus:border-primary-500 disabled:opacity-60 dark:hover:border-slate-600"
      style={{ backgroundColor: fundo ?? 'transparent' }}
    />
  );
}
