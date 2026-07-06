import { redirect } from "next/navigation";

export default function AvaliacaoFornecedorRedirectPage() {
  redirect("/registros?tipo=avaliacao-fornecedor");
}
