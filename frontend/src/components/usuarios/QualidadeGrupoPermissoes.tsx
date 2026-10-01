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
  nivel = 0,
  onToggle,
}: {
  label: string;
  marcado: boolean;
  disabled?: boolean;
  nivel?: 0 | 1 | 2;
  onToggle: () => void;
}) {
  const recuo = nivel === 2 ? 'ml-12' : nivel === 1 ? 'ml-6' : '';
  return (
    <label
      className={`flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100 ${recuo} ${
        nivel > 0 ? 'border-l-2 border-slate-300 pl-3 dark:border-slate-600' : ''
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
        Permissão total libera o SGQ inteiro. A tela libera consultar, criar e editar. Inativar, excluir, importar e o alerta de cadastro são permissões à parte.
      </p>
      <Linha label="Permissão total" marcado={marcado('total')} disabled={disabled} onToggle={() => alternar('total')} />
      <Linha label="Documentos" marcado={marcado('documentos')} disabled={disabled} onToggle={() => alternar('documentos')} />
      <Linha label="Inativar documentos" marcado={marcado('documentos-inativar')} disabled={disabled} nivel={1} onToggle={() => alternar('documentos-inativar')} />
      <Linha label="Excluir documentos" marcado={marcado('documentos-excluir')} disabled={disabled} nivel={1} onToggle={() => alternar('documentos-excluir')} />
      <Linha label="Calibrações" marcado={marcado('calibracoes')} disabled={disabled} onToggle={() => alternar('calibracoes')} />
      <Linha label="Inativar equipamentos" marcado={marcado('calibracoes-inativar')} disabled={disabled} nivel={1} onToggle={() => alternar('calibracoes-inativar')} />
      <Linha label="Excluir equipamentos" marcado={marcado('calibracoes-excluir')} disabled={disabled} nivel={1} onToggle={() => alternar('calibracoes-excluir')} />
      <div className="space-y-1">
        <Linha label="Registros" marcado={marcado('registros')} disabled={disabled} onToggle={() => alternar('registros')} />
        <Linha label="RNC — Registro de Não Conformidade" marcado={marcado('rnc')} disabled={disabled} nivel={1} onToggle={() => alternar('rnc')} />
        <Linha label="Excluir RNC" marcado={marcado('rnc-excluir')} disabled={disabled} nivel={2} onToggle={() => alternar('rnc-excluir')} />
        <Linha label="RCC — Registro de Reclamação do Cliente" marcado={marcado('rcc')} disabled={disabled} nivel={1} onToggle={() => alternar('rcc')} />
        <Linha label="Excluir RCC" marcado={marcado('rcc-excluir')} disabled={disabled} nivel={2} onToggle={() => alternar('rcc-excluir')} />
        <Linha label="Alertar correção de cadastro" marcado={marcado('rcc-alerta')} disabled={disabled} nivel={2} onToggle={() => alternar('rcc-alerta')} />
        <Linha label="Avaliação de fornecedor" marcado={marcado('avaliacao-fornecedor')} disabled={disabled} nivel={1} onToggle={() => alternar('avaliacao-fornecedor')} />
        <Linha label="Excluir avaliação de fornecedor" marcado={marcado('avaliacao-excluir')} disabled={disabled} nivel={2} onToggle={() => alternar('avaliacao-excluir')} />
        <Linha label="Importar registros" marcado={marcado('registros-importar')} disabled={disabled} nivel={1} onToggle={() => alternar('registros-importar')} />
      </div>
      <div className="space-y-1">
        <Linha label="Configurações" marcado={marcado('configuracoes')} disabled={disabled} onToggle={() => alternar('configuracoes')} />
        <Linha label="Setores" marcado={marcado('setores')} disabled={disabled} nivel={1} onToggle={() => alternar('setores')} />
        <Linha label="Excluir setores" marcado={marcado('setores-excluir')} disabled={disabled} nivel={2} onToggle={() => alternar('setores-excluir')} />
        <Linha label="Categorias" marcado={marcado('categorias')} disabled={disabled} nivel={1} onToggle={() => alternar('categorias')} />
        <Linha label="Excluir categorias" marcado={marcado('categorias-excluir')} disabled={disabled} nivel={2} onToggle={() => alternar('categorias-excluir')} />
        <Linha label="Endereçamento" marcado={marcado('enderecamento')} disabled={disabled} nivel={1} onToggle={() => alternar('enderecamento')} />
        <Linha label="Excluir endereçamento" marcado={marcado('enderecamento-excluir')} disabled={disabled} nivel={2} onToggle={() => alternar('enderecamento-excluir')} />
        <Linha label="Reclamações de produto" marcado={marcado('reclamacoes')} disabled={disabled} nivel={1} onToggle={() => alternar('reclamacoes')} />
        <Linha label="Excluir reclamações de produto" marcado={marcado('reclamacoes-excluir')} disabled={disabled} nivel={2} onToggle={() => alternar('reclamacoes-excluir')} />
        <Linha label="Causas do problema" marcado={marcado('causas')} disabled={disabled} nivel={1} onToggle={() => alternar('causas')} />
        <Linha label="Excluir causas do problema" marcado={marcado('causas-excluir')} disabled={disabled} nivel={2} onToggle={() => alternar('causas-excluir')} />
        <Linha label="Serviços realizados" marcado={marcado('servicos')} disabled={disabled} nivel={1} onToggle={() => alternar('servicos')} />
        <Linha label="Excluir serviços realizados" marcado={marcado('servicos-excluir')} disabled={disabled} nivel={2} onToggle={() => alternar('servicos-excluir')} />
      </div>
    </div>
  );
}
