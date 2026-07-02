import { useEffect, useState, useCallback } from 'react';
import CardsResumo from '../components/CardsResumo';
import ObservacoesColumnChart from '../components/ObservacoesColumnChart';
import AtrasadosPieChart from '../components/AtrasadosPieChart';
import MotivosBarChart from '../components/MotivosBarChart';
import { obterResumo, obterResumoObservacoes, obterResumoMotivos, type Resumo, type ObservacaoResumo, type MotivoResumo } from '../api/pedidos';

export default function DashboardPage() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [obsResumo, setObsResumo] = useState<ObservacaoResumo[]>([]);
  const [loadingObs, setLoadingObs] = useState(true);
  const [motivosResumo, setMotivosResumo] = useState<MotivoResumo[]>([]);
  const [loadingMotivos, setLoadingMotivos] = useState(true);
  const [rotaSelecionada, setRotaSelecionada] = useState<string | null>(null);
  const [resumoRota, setResumoRota] = useState<Resumo | null>(null);
  const [loadingResumoRota, setLoadingResumoRota] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await obterResumo();
      setResumo(r);
    } catch {
      setResumo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarObservacoes = useCallback(async () => {
    setLoadingObs(true);
    try {
      const r = await obterResumoObservacoes();
      setObsResumo(r);
    } catch {
      setObsResumo([]);
    } finally {
      setLoadingObs(false);
    }
  }, []);

  const carregarMotivos = useCallback(async () => {
    setLoadingMotivos(true);
    try {
      const r = await obterResumoMotivos();
      setMotivosResumo(r);
    } catch {
      setMotivosResumo([]);
    } finally {
      setLoadingMotivos(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    carregarObservacoes();
  }, [carregarObservacoes]);

  useEffect(() => {
    carregarMotivos();
  }, [carregarMotivos]);

  useEffect(() => {
    if (!rotaSelecionada) {
      setResumoRota(null);
      setLoadingResumoRota(false);
      return;
    }
    setLoadingResumoRota(true);
    obterResumo(rotaSelecionada)
      .then(setResumoRota)
      .catch(() => setResumoRota(null))
      .finally(() => setLoadingResumoRota(false));
  }, [rotaSelecionada]);

  const resumoParaRosca = rotaSelecionada ? resumoRota : resumo;
  const loadingRosca = rotaSelecionada ? loadingResumoRota : loading;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Dash Entregas — visão geral</h2>
        <CardsResumo resumo={resumo} loading={loading} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Gráficos</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card-panel p-4 shadow-sm">
            <ObservacoesColumnChart
              data={obsResumo}
              loading={loadingObs}
              selectedRota={rotaSelecionada}
              onColumnClick={setRotaSelecionada}
            />
          </div>
          <div className="card-panel p-4 shadow-sm">
            <AtrasadosPieChart
              resumo={resumoParaRosca}
              loading={loadingRosca}
              rotaFiltro={rotaSelecionada}
            />
          </div>
        </div>
        <div className="card-panel p-4 shadow-sm">
          <MotivosBarChart data={motivosResumo} loading={loadingMotivos} />
        </div>
      </section>
    </div>
  );
}
