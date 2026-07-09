import { cn } from '@qualidade/lib/utils';

interface SgqFormLayoutProps {
  children: React.ReactNode;
  aside?: React.ReactNode;
  /** Painel compacto no topo em telas pequenas; padrão = `aside`. */
  mobileAside?: React.ReactNode;
  className?: string;
}

/** Grade formulário + painel lateral (etapas, histórico) com separação visual clara. */
export function SgqFormLayout({ children, aside, mobileAside, className }: SgqFormLayoutProps) {
  const mobilePanel = mobileAside ?? aside;

  return (
    <div className={cn('sgq-form-layout', className)}>
      {mobilePanel ? (
        <div className="sgq-form-layout-mobile-aside lg:hidden">{mobilePanel}</div>
      ) : null}

      <div className="sgq-form-layout-grid">
        <main className="sgq-form-layout-main">{children}</main>
        {aside ? <aside className="sgq-form-layout-aside hidden lg:block">{aside}</aside> : null}
      </div>
    </div>
  );
}
