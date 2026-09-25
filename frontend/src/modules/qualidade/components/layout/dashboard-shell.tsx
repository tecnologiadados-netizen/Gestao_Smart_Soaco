import { QualidadeSubnav } from '@qualidade/components/layout/qualidade-subnav';

/** @deprecated Prefer QualidadeModuleLayout — mantido para imports legados. */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="sgq-shell flex min-h-0 w-full flex-1 flex-col">
      <QualidadeSubnav />
      <div className="sgq-page w-full flex-1">{children}</div>
    </div>
  );
}
