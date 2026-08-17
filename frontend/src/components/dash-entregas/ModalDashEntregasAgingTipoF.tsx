import { useCallback } from 'react';
import {
  obterDashEntregasAgingTipoF,
  type AgingFaixaResumo,
  type DashEntregasFaixaAtraso,
  type FiltrosPedidos,
  type TipoFValorResumo,
} from '../../api/pedidos';
import ModalDashEntregasTipoFChart from './ModalDashEntregasTipoFChart';
import { formatMoedaDash, formatNumero } from './dashEntregasUtils';

type Props = {
  open: boolean;
  faixa: AgingFaixaResumo | null;
  filtrosGlobais?: Omit<FiltrosPedidos, 'page' | 'limit' | 'faixa_atraso'>;
  onClose: () => void;
  onTipoFClick: (faixa: AgingFaixaResumo, item: TipoFValorResumo) => void;
};

export default function ModalDashEntregasAgingTipoF({
  open,
  faixa,
  filtrosGlobais = {},
  onClose,
  onTipoFClick,
}: Props) {
  const fetchData = useCallback(async () => {
    if (!faixa) return [];
    return obterDashEntregasAgingTipoF(faixa.faixa as DashEntregasFaixaAtraso, filtrosGlobais);
  }, [faixa, filtrosGlobais]);

  if (!faixa) return null;

  return (
    <ModalDashEntregasTipoFChart
      open={open}
      modalId="dash-entregas-aging-tipof"
      titulo={`${faixa.label} — saldo por TipoF`}
      subtitulo={`${formatMoedaDash(faixa.valor)} · ${formatNumero(faixa.quantidade)} linhas`}
      onClose={onClose}
      onTipoFClick={(item) => onTipoFClick(faixa, item)}
      fetchData={fetchData}
    />
  );
}
