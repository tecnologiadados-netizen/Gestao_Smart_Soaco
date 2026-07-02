/**
 * Mensagem exibida quando não há registros para exibição (lista vazia ou filtros sem resultado).
 * Ex.: pedidos "atendido totalmente", combinação de filtros sem resultados, etc.
 */
export function MensagemSemRegistros() {
  return (
    <div className="card-panel p-8 text-center">
      <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-primary-600/10 flex items-center justify-center">
        <svg className="h-5 w-5 text-primary-600 dark:text-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="font-medium text-soaco-navy dark:text-soaco-white">Não há registros para exibição.</p>
      <p className="mt-2 text-sm text-soaco-gray dark:text-white/60">
        Isso pode ocorrer porque: ainda não foram criados registros; nenhum registro corresponde aos filtros aplicados.
      </p>
      <p className="mt-1 text-sm text-soaco-gray dark:text-white/60">Por favor, revise os dados.</p>
    </div>
  );
}

/** Versão inline (ex.: dentro de uma célula de tabela). */
export function MensagemSemRegistrosInline() {
  return (
    <p className="text-soaco-gray dark:text-white/60 text-sm">
      Não há registros para exibição. Isso pode ocorrer porque: ainda não foram criados registros; nenhum registro corresponde aos filtros aplicados. Por favor, revise os dados.
    </p>
  );
}
