import { Link } from 'react-router-dom';
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@qualidade/components/ui/button";
import { cn } from "@qualidade/lib/utils";

interface PageBackLinkProps {
  href?: string;
  to?: string;
  label?: string;
  className?: string;
}

export function PageBackLink({
  href,
  to,
  label = 'Voltar',
  className,
}: PageBackLinkProps) {
  const target = to ?? href ?? '/qualidade';
  return (
    <Link
      to={target}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "inline-flex w-fit gap-1.5 px-2",
        className
      )}
    >
      <ArrowLeft className="size-4" />
      {label}
    </Link>
  );
}
