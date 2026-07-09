import Link from "next/link";
import { FileText, Gauge, User, Wrench } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const links = [
  {
    href: "/configuracoes/usuarios",
    title: "Usuários",
    description: "Gerenciar usuários e papéis do sistema",
    icon: User,
  },
  {
    href: "/configuracoes/setores",
    title: "Setores",
    description: "Setores e áreas da empresa",
    icon: Wrench,
  },
  {
    href: "/configuracoes/tipos-documento",
    title: "Categorias",
    description: "PO, IT, FO, Manual, Registro e outros",
    icon: FileText,
  },
  {
    href: "/documentos",
    title: "Módulo Documentos",
    description: "Ir para gestão documental",
    icon: FileText,
  },
  {
    href: "/calibracoes",
    title: "Módulo Calibrações",
    description: "Ir para gestão de calibrações",
    icon: Gauge,
  },
];

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Administração do SGQ — Só Aço Industrial
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <link.icon className="size-5 text-primary" />
                </div>
                <CardTitle className="text-base">{link.title}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
