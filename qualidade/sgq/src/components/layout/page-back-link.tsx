import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageBackLinkProps {
  href: string;
  label?: string;
  className?: string;
}

export function PageBackLink({
  href,
  label = "Voltar",
  className,
}: PageBackLinkProps) {
  return (
    <Link
      href={href}
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
