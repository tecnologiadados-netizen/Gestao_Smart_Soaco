import { Link } from 'react-router-dom';
import { FileText, Gauge, MapPin, Wrench } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@qualidade/components/ui/card";

const links = [
  {
    href: "/qualidade/configuracoes/setores",
    title: "Setores",
    description: "Setores e áreas da empresa",
    icon: Wrench,
  },
  {
    href: "/qualidade/configuracoes/tipos-documento",
    title: "Categorias",
    description: "PO, IT, FO, Manual, Registro e outros",
    icon: FileText,
  },
  {
    href: "/qualidade/configuracoes/enderecamento",
    title: "Endereçamento",
    description: "Localizações físicas por setor",
    icon: MapPin,
  },
  {
    href: "/qualidade/documentos",
    title: "Módulo Documentos",
    description: "Ir para gestão documental",
    icon: FileText,
  },
  {
    href: "/qualidade/calibracoes",
    title: "Módulo Calibrações",
    description: "Ir para gestão de calibrações",
    icon: Gauge,
  },
];

export function ConfiguracoesPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Configurações
        </h1>
        <p className="text-sm text-muted-foreground">
          Administração do SGQ — Só Aço Industrial
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <Link
            key={link.href}
            to={link.href}
            className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Card className="h-full min-h-[9.5rem] border-border/80 transition-all duration-200 group-hover:border-primary/35 group-hover:shadow-md">
              <CardHeader className="h-full justify-between gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <link.icon className="size-5" aria-hidden />
                </div>
                <div className="space-y-1.5">
                  <CardTitle className="text-base group-hover:text-primary">
                    {link.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {link.description}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
