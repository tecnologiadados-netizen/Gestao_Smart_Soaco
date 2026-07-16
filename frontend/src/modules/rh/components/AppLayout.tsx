interface AppLayoutProps {
  children: React.ReactNode;
}

/** No Gestor, o layout principal fica no shell global — aqui só repassamos o conteúdo da página. */
const AppLayout = ({ children }: AppLayoutProps) => {
  return <div className="min-h-0 flex-1">{children}</div>;
};

export default AppLayout;
