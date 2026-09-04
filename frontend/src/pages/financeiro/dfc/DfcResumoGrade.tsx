import { useMemo, useState } from 'react';

import type { DfcContribuicaoLinha } from '../../../api/financeiro';

import type { DfcPrioridade } from '../../../api/dfcPrioridade';

import { montarColunasResumo } from './dfcAgruparPeriodos';

import {

  montarResumoDfc,

  ORDEM_LINHAS_RESUMO,

  ROTULOS_LINHA_RESUMO,

  type LinhaResumoDfc,

} from './dfcResumoAgregacao';

import DfcResumoCelulaModal, { type DfcResumoCelulaContexto } from './DfcResumoCelulaModal';



const nf = new Intl.NumberFormat('pt-BR', {

  style: 'currency',

  currency: 'BRL',

  minimumFractionDigits: 2,

  maximumFractionDigits: 2,

});



function fmtValor(v: number | null): string {

  if (v == null || !Number.isFinite(v) || Math.abs(v) < 0.005) return '—';

  return nf.format(v);

}



function classeLinha(linha: LinhaResumoDfc): string {

  if (linha === 'saldoFinal') return 'bg-red-600 text-white font-bold';

  if (linha === 'aReceber') return 'text-emerald-700 dark:text-emerald-400';

  if (linha === 'aPagar' || linha === 'semPriorizacao') return 'text-rose-700 dark:text-rose-400';

  return 'text-slate-800 dark:text-slate-100 font-medium';

}



function linhaClicavel(linha: LinhaResumoDfc): linha is DfcResumoCelulaContexto['linha'] {

  return linha === 'aPagar' || linha === 'semPriorizacao';

}



export type DfcResumoGradeProps = {

  periodos: string[];

  granularidade: 'dia' | 'mes';

  dataInicio: string;

  dataFim: string;

  idEmpresas: number[];

  contasBancarias: string[];

  valoresPorConta: Record<number, Record<string, number>>;

  projecaoReceitasPorPeriodo?: Record<string, number>;

  saldosIniciaisPorPeriodo: Record<string, number>;

  saldosFinaisPorPeriodo: Record<string, number>;

  contribuicoesFiltradas: DfcContribuicaoLinha[];

  contribuicoesSemPriorizacao: DfcContribuicaoLinha[];

  prioridadesContasMap: Record<string, DfcPrioridade>;

  prioridadesLancsMap: Record<string, DfcPrioridade>;

  onPrioridadeLancAtualizada?: (

    idEmpresa: number,

    tipoRef: 'A' | 'L' | 'S',

    idRef: number,

    prioridade: DfcPrioridade | null,

  ) => void;

  loading?: boolean;

  error?: string | null;

  compacto?: boolean;

};



export default function DfcResumoGrade({

  periodos,

  granularidade,

  dataInicio,

  dataFim,

  idEmpresas,

  contasBancarias,

  valoresPorConta,

  projecaoReceitasPorPeriodo,

  saldosIniciaisPorPeriodo,

  saldosFinaisPorPeriodo,

  contribuicoesFiltradas,

  contribuicoesSemPriorizacao,

  prioridadesContasMap,

  prioridadesLancsMap,

  onPrioridadeLancAtualizada,

  loading,

  error,

  compacto = false,

}: DfcResumoGradeProps) {

  const [modalCelula, setModalCelula] = useState<DfcResumoCelulaContexto | null>(null);



  const colunas = useMemo(

    () => montarColunasResumo(periodos, granularidade),

    [periodos, granularidade],

  );



  const dados = useMemo(

    () =>

      montarResumoDfc({

        periodos,

        granularidade,

        colunas,

        valoresPorConta,

        projecaoReceitasPorPeriodo,

        saldosIniciaisPorPeriodo,

        saldosFinaisPorPeriodo,

        contribuicoesFiltradas,
        contribuicoesSemPriorizacao,

        prioridadesContasMap,

        prioridadesLancsMap,

      }),

    [

      periodos,

      granularidade,

      colunas,

      valoresPorConta,

      projecaoReceitasPorPeriodo,

      saldosIniciaisPorPeriodo,

      saldosFinaisPorPeriodo,
      contribuicoesFiltradas,
      contribuicoesSemPriorizacao,
      prioridadesContasMap,

      prioridadesLancsMap,

    ],

  );



  if (error) {

    return (

      <p className="text-sm text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-3">

        {error}

      </p>

    );

  }



  if (loading) {

    return (

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 animate-pulse">

        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4" />

        <div className="h-40 bg-slate-100 dark:bg-slate-700/60 rounded" />

      </div>

    );

  }



  if (periodos.length === 0 || dados.length === 0) {

    return (

      <p className="text-sm text-slate-500 dark:text-slate-400 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-4 py-3">

        Nenhum período para exibir na visão resumida.

      </p>

    );

  }



  const maxH = compacto ? 'max-h-[min(50vh,480px)]' : 'max-h-[min(70vh,720px)]';



  const abrirCelula = (

    linha: LinhaResumoDfc,

    col: (typeof dados)[number],

    valor: number | null,

  ) => {

    if (!linhaClicavel(linha) || valor == null || Math.abs(valor) < 0.005) return;

    const rotulo =

      col.rotuloSecundario && col.rotuloPrincipal

        ? `${col.rotuloPrincipal} ${col.rotuloSecundario}`

        : col.rotuloPrincipal || col.rotuloSecundario;

    setModalCelula({

      linha,

      periodos: [...col.periodos],

      rotuloPeriodo: rotulo,

      valor,

      agrupado: col.agrupado,

    });

  };



  return (

    <>

      <div className="card-panel w-full min-w-0 overflow-hidden shadow-sm">

        <div className={`overflow-auto ${maxH}`}>

          <table className="w-full min-w-max border-collapse text-sm">

            <thead className="sticky top-0 z-10">

              <tr>

                <th

                  className="sticky left-0 z-20 min-w-[140px] border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200"

                  scope="col"

                >

                  &nbsp;

                </th>

                {dados.map((col, i) => (

                  <th

                    key={`${col.tipo}-${col.periodos.join('-')}-${i}`}

                    className={`min-w-[96px] border border-slate-300 dark:border-slate-600 px-2 py-2 text-center ${

                      col.agrupado

                        ? 'bg-sky-100 dark:bg-sky-900/40 text-sky-900 dark:text-sky-100'

                        : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100'

                    }`}

                    scope="col"

                  >

                    <div className="text-[11px] font-bold leading-tight">{col.rotuloPrincipal}</div>

                    {col.rotuloSecundario ? (

                      <div className="text-[10px] font-normal mt-0.5 opacity-80">{col.rotuloSecundario}</div>

                    ) : null}

                  </th>

                ))}

              </tr>

            </thead>

            <tbody>

              {ORDEM_LINHAS_RESUMO.map((linha) => (

                <tr key={linha}>

                  <th

                    className={`sticky left-0 z-10 border border-slate-300 dark:border-slate-600 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap ${

                      linha === 'saldoFinal'

                        ? 'bg-red-700 text-white'

                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'

                    }`}

                    scope="row"

                  >

                    {ROTULOS_LINHA_RESUMO[linha]}

                  </th>

                  {dados.map((col, i) => {

                    const cel = col.celulas[linha];

                    const amarelo = cel.destaqueAmarelo && linha === 'aPagar';

                    const isFinal = linha === 'saldoFinal';

                    const clicavel =

                      linhaClicavel(linha) &&

                      cel.valor != null &&

                      Math.abs(cel.valor) >= 0.005;

                    return (

                      <td

                        key={`${linha}-${col.periodos.join('-')}-${i}`}

                        className={`border border-slate-300 dark:border-slate-600 px-2 py-2 text-right tabular-nums ${

                          isFinal

                            ? 'bg-red-600 text-white font-bold'

                            : amarelo

                              ? 'bg-yellow-300 dark:bg-yellow-400/90 text-slate-900 font-semibold'

                              : classeLinha(linha)

                        } ${col.agrupado && !isFinal && !amarelo ? 'bg-sky-50/50 dark:bg-sky-950/20' : ''} ${

                          clicavel

                            ? 'cursor-pointer hover:ring-2 hover:ring-primary-500/60 hover:ring-inset underline-offset-2 hover:underline'

                            : ''

                        }`}

                        onClick={clicavel ? () => abrirCelula(linha, col, cel.valor) : undefined}

                        onKeyDown={

                          clicavel

                            ? (e) => {

                                if (e.key === 'Enter' || e.key === ' ') {

                                  e.preventDefault();

                                  abrirCelula(linha, col, cel.valor);

                                }

                              }

                            : undefined

                        }

                        role={clicavel ? 'button' : undefined}

                        tabIndex={clicavel ? 0 : undefined}

                        title={clicavel ? 'Clique para ver detalhes' : undefined}

                      >

                        {fmtValor(cel.valor)}

                      </td>

                    );

                  })}

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>



      {modalCelula ? (

        <DfcResumoCelulaModal

          contexto={modalCelula}

          onClose={() => setModalCelula(null)}

          dataInicio={dataInicio}

          dataFim={dataFim}

          granularidade={granularidade}

          idEmpresas={idEmpresas}

          contasBancarias={contasBancarias}

          prioridadesContasMap={prioridadesContasMap}

          prioridadesLancsMap={prioridadesLancsMap}

          onPrioridadeLancAtualizada={onPrioridadeLancAtualizada}

        />

      ) : null}

    </>

  );

}


