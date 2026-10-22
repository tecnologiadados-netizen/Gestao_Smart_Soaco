import { useEffect, useState } from 'react';
import { obterRhPermissoesContexto } from '@/api/grupos';
import { ConfiguracoesPermissionsEditor } from '@rh/pages/ConfiguracoesPermissionsEditor';
import {
  buildDefaultGroupPermissions,
  cloneGroupPermissions,
  type RhGroupPermissions,
} from '@rh/lib/rh-permissions';
import {
  DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS,
  type OrganicoCommentTagOption,
} from '@rh/lib/organico-comment-tags';
import '@rh/rh-module.css';

type Props = {
  value: RhGroupPermissions;
  onChange: (next: RhGroupPermissions) => void;
  hasRhAccess: boolean;
  onRhAccessChange: (enabled: boolean) => void;
  disabled?: boolean;
};

function createNoAccessRhGroupPermissions(): RhGroupPermissions {
  const permissions = buildDefaultGroupPermissions();
  for (const id of Object.keys(permissions.organico.comentarios.tags)) {
    permissions.organico.comentarios.tags[id] = false;
  }
  for (const id of Object.keys(permissions.organico.comentarios.visibilities)) {
    permissions.organico.comentarios.visibilities[
      id as keyof typeof permissions.organico.comentarios.visibilities
    ] = false;
  }
  return permissions;
}

export default function GrupoRhPermissoesPanel({
  value,
  onChange,
  hasRhAccess,
  onRhAccessChange,
  disabled = false,
}: Props) {
  const [setores, setSetores] = useState<string[]>([]);
  const [commentTagOptions, setCommentTagOptions] = useState<OrganicoCommentTagOption[]>(
    DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const ctx = await obterRhPermissoesContexto();
        if (!active) return;
        setSetores(ctx.setores ?? []);
        setCommentTagOptions(
          (ctx.commentTagOptions ?? DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS) as OrganicoCommentTagOption[],
        );
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Erro ao carregar editor RH');
        setSetores([]);
        setCommentTagOptions(DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="rh-portal rh-module rounded-xl border border-slate-200 dark:border-slate-600/50 bg-slate-50/80 dark:bg-slate-900/40 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Permissões do módulo RH</h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Controle de acesso interno ao Gestão de Pessoas (telas, abas do orgânico, faltas, dashboard, etc.). Ative
          <strong className="font-medium"> Ver RH</strong> abaixo para liberar a entrada no módulo.
        </p>
        <label
          className={`mt-3 flex items-center gap-2 rounded-lg border border-slate-300 bg-white/50 px-3 py-2 text-sm font-medium text-slate-800 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100 ${
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
          }`}
        >
          <input
            type="checkbox"
            checked={hasRhAccess}
            onChange={(event) => onRhAccessChange(event.target.checked)}
            disabled={disabled}
          />
          Ver RH (Gestão de Pessoas)
        </label>
        {!hasRhAccess ? (
          <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
            Sem acesso ao RH: todas as permissões internas abaixo estão desativadas.
          </p>
        ) : null}
      </div>
      {loading ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Carregando editor…</p>
      ) : error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </p>
      ) : (
        <div className={disabled || !hasRhAccess ? 'pointer-events-none opacity-60' : undefined}>
          <ConfiguracoesPermissionsEditor
            value={hasRhAccess ? cloneGroupPermissions(value) : createNoAccessRhGroupPermissions()}
            onChange={(next) => onChange(cloneGroupPermissions(next))}
            availableSectors={setores}
            commentTagOptions={commentTagOptions}
          />
        </div>
      )}
    </div>
  );
}

export function createDefaultRhGroupPermissions(): RhGroupPermissions {
  return buildDefaultGroupPermissions();
}
