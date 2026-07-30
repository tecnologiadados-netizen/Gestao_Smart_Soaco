import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import CarregandoInformacoesOverlay from './CarregandoInformacoesOverlay';
import { LOADER_DURACAO_MINIMA_MS } from '../hooks/useDuracaoMinima';
import { TransicaoRotaContext } from '../contexts/TransicaoRotaContext';

/**
 * Cobre a tela ao trocar de rota. As páginas são importadas de forma estática,
 * então a troca é instantânea — o tempo aqui é fixo para a animação rodar seus
 * ciclos enquanto a tela nova monta e busca os dados por trás do vidro.
 *
 * Enquanto está ativo, os overlays das próprias telas ficam suprimidos, para a
 * troca de tela não mostrar duas animações em sequência.
 */
export default function TransicaoRotaProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [ativa, setAtiva] = useState(false);
  const montagemInicialRef = useRef(true);

  useEffect(() => {
    // A entrada no sistema já tem o loading do gate de autenticação.
    if (montagemInicialRef.current) {
      montagemInicialRef.current = false;
      return;
    }

    setAtiva(true);
    const id = window.setTimeout(() => setAtiva(false), LOADER_DURACAO_MINIMA_MS);
    return () => window.clearTimeout(id);
  }, [pathname]);

  return (
    <>
      <TransicaoRotaContext.Provider value={ativa}>{children}</TransicaoRotaContext.Provider>

      {/* Fora do provider de propósito: aqui dentro o contexto vale `false`,
          senão este overlay se suprimiria junto com os das telas. */}
      <CarregandoInformacoesOverlay
        show={ativa}
        mensagem="Carregando tela…"
        duracaoMinimaMs={0}
        zIndex={15000}
      />
    </>
  );
}
