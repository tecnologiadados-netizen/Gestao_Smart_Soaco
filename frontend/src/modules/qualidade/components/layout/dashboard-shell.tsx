import { StoreHydration } from '@qualidade/components/providers/store-hydration';
import { QualidadeSubnav } from '@qualidade/components/layout/qualidade-subnav';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <StoreHydration>
      <div className="sgq-shell flex min-h-0 w-full flex-1 flex-col">
        <QualidadeSubnav />
        <div className="sgq-page w-full flex-1">{children}</div>
      </div>
    </StoreHydration>
  );
}
