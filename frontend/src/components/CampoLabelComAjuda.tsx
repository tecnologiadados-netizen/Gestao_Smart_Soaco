import HelpTooltipIcon from './HelpTooltipIcon';

type CampoLabelComAjudaProps = {
  label: string;
  ajuda: string;
  className?: string;
};

export default function CampoLabelComAjuda({ label, ajuda, className = '' }: CampoLabelComAjudaProps) {
  return (
    <div className={`mb-1 flex items-center gap-1.5 ${className}`.trim()}>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <HelpTooltipIcon text={ajuda} />
    </div>
  );
}

export const AJUDA_CAMPO_MENSAGEM =
  'Campo para troca de mensagens entre usuários na Comunicação PD. Preencha ao atualizar o card quando quiser registrar uma comunicação com outros participantes.';

export const AJUDA_CAMPO_OBSERVACAO =
  'Informação complementar ao motivo selecionado que gerou a alteração na data de entrega. Também fica registrada no histórico do item no Gerenciador de Pedidos.';
