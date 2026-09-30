import {
  alternarPermissaoQualidade,
  permissaoQualidadeMarcada,
  type AlvoPermissaoQualidade,
} from '../../utils/qualidadePermissoes';

type Props = {
  permissoes: string[];
  disabled?: boolean;
  onChange: (permissoes: string[]) => void;
};

function Linha({
  label,
  marcado,
  disabled,
  recuo,
  onToggle,
}: {
  label: string;
  marcado: boolean;
  disabled?: boolean;
  recuo?: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100 ${
        recuo ? 'ml-6 border-l-2 border-slate-300 pl-3 dark:border-slate-600' : ''
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      <input type="checkbox" checked={marcado} onChange={onToggle} disabled={disabled} />
      {label}
    </label>
  );
}

export function QualidadeGrupoPermissoes({ permissoes, disabled, onChange }: Props) {
  const alternar = (alvo: AlvoPermissaoQualidade) => {
    if (disabled) return;
    onChange(alternarPermissaoQualidade(permissoes, alvo));
  };
  const marcado = (alvo: AlvoPermissaoQualidade) => permissaoQualidadeMarcada(permissoes, alvo);

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Permissão total libera o SGQ inteiro. Os itens abaixo limitam Documentos, Calibrações, cada registro e cada opção de Configurações.
      </p>
      <Linha label="Permissão total" marcado={marcado('total')} disabled={disabled} onToggle={() => alternar('total')} />
      <Linha label="Documentos" marcado={marcado('documentos')} disabled={disabled} onToggle={() => alternar('documentos')} />
      <Linha label="Calibrações" marcado={marcado('calibracoes')} disabled={disabled} onToggle={() => alternar('calibracoes')} />
      <div className="space-y-1">
        <Linha label="Registros" marcado={marcado('registros')} disabled={disabled} onToggle={() => alternar('registros')} />
        <Linha label="RNC — Registro de Não Conformidade" marcado={marcado('rnc')} disabled={disabled} recuo onToggle={() => alternar('rnc')} />
        <Linha label="RCC — Registro de Reclamação do Cliente" marcado={marcado('rcc')} disabled={disabled} recuo onToggle={() => alternar('rcc')} />
        <Linha label="Avaliação de fornecedor" marcado={marcado('avaliacao-fornecedor')} disabled={disabled} recuo onToggle={() => alternar('avaliacao-fornecedor')} />
      </div>
      <div className="space-y-1">
        <Linha label="Configurações" marcado={marcado('configuracoes')} disabled={disabled} onToggle={() => alternar('configuracoes')} />
        <Linha label="Setores" marcado={marcado('setores')} disabled={disabled} recuo onToggle={() => alternar('setores')} />
        <Linha label="Categorias" marcado={marcado('categorias')} disabled={disabled} recuo onToggle={() => alternar('categorias')} />
        <Linha label="Endereçamento" marcado={marcado('enderecamento')} disabled={disabled} recuo onToggle={() => alternar('enderecamento')} />
        <Linha label="Reclamações de produto" marcado={marcado('reclamacoes')} disabled={disabled} recuo onToggle={() => alternar('reclamacoes')} />
        <Linha label="Causas do problema" marcado={marcado('causas')} disabled={disabled} recuo onToggle={() => alternar('causas')} />
        <Linha label="Serviços realizados" marcado={marcado('servicos')} disabled={disabled} recuo onToggle={() => alternar('servicos')} />
      </div>
    </div>
  );
}
