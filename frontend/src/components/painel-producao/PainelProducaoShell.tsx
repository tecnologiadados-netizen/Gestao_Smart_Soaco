import type { ReactNode } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import '../../styles/painel-producao.css';

export function PainelProducaoShell({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const { theme } = useTheme();
  const themeProps = theme === 'dark' ? { 'data-theme': 'dark' as const } : {};
  return (
    <div className={`painel-producao-module ${className}`.trim()} {...themeProps}>
      {children}
    </div>
  );
}
