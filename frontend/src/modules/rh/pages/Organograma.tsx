import AppLayout from "@rh/components/AppLayout";
import { motion } from "framer-motion";
import { canEditRoute } from "@rh/lib/route-permissions";

interface OrgNode {
  name: string;
  role: string;
  children?: OrgNode[];
}

const orgData: OrgNode = {
  name: "Ricardo Monteiro",
  role: "CEO",
  children: [
    {
      name: "Fernanda Costa",
      role: "Dir. Financeiro",
      children: [
        { name: "Ana Paula", role: "Coord. Contábil" },
        { name: "Marcos Vieira", role: "Coord. Tesouraria" },
      ],
    },
    {
      name: "Carlos Silva",
      role: "Dir. Operações",
      children: [
        { name: "João Santos", role: "Ger. Produção" },
        { name: "Juliana Ribeiro", role: "Sup. Logística" },
        { name: "Pedro Almeida", role: "Ger. Qualidade" },
      ],
    },
    {
      name: "Patrícia Lima",
      role: "Dir. Comercial",
      children: [
        { name: "Mariana Santos", role: "Coord. Vendas" },
        { name: "Bruno Teixeira", role: "Coord. Marketing" },
      ],
    },
    {
      name: "Roberto Mendes",
      role: "Dir. Tecnologia",
      children: [
        { name: "Thiago Barbosa", role: "Coord. Dados" },
        { name: "Larissa Campos", role: "Coord. Sistemas" },
      ],
    },
    {
      name: "Ana Beatriz",
      role: "Dir. RH",
      children: [
        { name: "Camila Ferreira", role: "Coord. DP" },
        { name: "Diego Rocha", role: "Coord. T&D" },
      ],
    },
  ],
};

const OrgCard = ({ node, delay = 0 }: { node: OrgNode; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
    className="flex flex-col items-center"
  >
    <div className="border border-border bg-card p-4 shadow-level-1 hover:shadow-level-2 transition-shadow min-w-[160px] text-center">
      <div className="w-10 h-10 bg-primary mx-auto flex items-center justify-center mb-2">
        <span className="text-primary-foreground text-sm font-bold">
          {node.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
        </span>
      </div>
      <h3 className="text-sm font-bold text-foreground">{node.name}</h3>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-1">{node.role}</p>
    </div>

    {node.children && (
      <>
        <div className="w-px h-6 bg-border" />
        <div className="flex gap-2 relative">
          {node.children.length > 1 && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-border" style={{ width: `calc(100% - 160px)` }} />
          )}
          {node.children.map((child, i) => (
            <div key={child.name} className="flex flex-col items-center">
              <div className="w-px h-6 bg-border" />
              <OrgCard node={child} delay={0.1 * (i + 1)} />
            </div>
          ))}
        </div>
      </>
    )}
  </motion.div>
);

const Organograma = () => {
  const canEdit = canEditRoute("/organograma");
  return (
    <AppLayout>
      <div className="py-8 px-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Estrutura Organizacional</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {canEdit ? "Perfil com permissão para editar a estrutura." : "Perfil com acesso somente para visualização."}
          </p>
        </div>

        <div className="border border-border bg-card p-8 shadow-level-1 overflow-x-auto">
          <div className="min-w-[1000px] flex justify-center">
            <OrgCard node={orgData} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Organograma;
