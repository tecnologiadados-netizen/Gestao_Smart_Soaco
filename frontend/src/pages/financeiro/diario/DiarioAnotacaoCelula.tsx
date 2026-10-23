import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const larguraRef = useRef(0);
  const bloqueado = somenteLeitura || salvando || !(linha.codigo > 0);

  const ajustarAltura = useCallback(() => {
    const campo = campoRef.current;
    if (!campo) return;
    campo.style.height = 'auto';
    campo.style.height = `${Math.max(26, campo.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    setValor(linha.anotacao ?? '');
    setCor(corObservacaoDiario(linha.anotacaoCor));
  }, [linha.anotacao, linha.anotacaoCor, linha.origem, linha.codigo]);

  useLayoutEffect(() => {
    ajustarAltura();
  }, [ajustarAltura, valor]);

  useEffect(() => {
    const campo = campoRef.current;
    if (!campo || typeof ResizeObserver === 'undefined') return;
    larguraRef.current = campo.clientWidth;
    const observer = new ResizeObserver(() => {
      const largura = campo.clientWidth;
      if (largura === larguraRef.current) return;
      larguraRef.current = largura;
      ajustarAltura();
    });
    observer.observe(campo);
    return () => observer.disconnect();
  }, [ajustarAltura]);

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
    <textarea
      ref={campoRef}
      value={valor}
      rows={1}
      wrap="soft"
      disabled={bloqueado}
      maxLength={1000}
      placeholder="Observação"
      title={valor || 'Digite a observação desta conta'}
      onChange={(e) => setValor(e.target.value)}
      onBlur={() => {
        void gravar(valor, cor).catch(falha);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className="block w-full min-w-0 resize-none overflow-hidden whitespace-pre-wrap break-words rounded border border-transparent px-1 py-1 text-[11px] leading-4 uppercase outline-none hover:border-slate-300 focus:border-primary-500 disabled:opacity-60 dark:hover:border-slate-600"
      style={{ backgroundColor: fundo ?? 'transparent' }}
    />
  );
}
